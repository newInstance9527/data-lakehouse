import { computed, ref } from 'vue'
import {
  addDatasource,
  addTable as apiAddTable,
  batchSyncTables as apiBatchSync,
  deleteDatasources as apiDeleteDatasources,
  deleteTables as apiDeleteTables,
  editDatasource,
  editTable as apiEditTable,
  fetchDatasourceDetail,
  fetchDatasourcePage,
  fetchTablePage,
  syncTables as apiSyncTables,
  testDatasource as apiTest,
  toggleDatasourceStatus,
  projectToSqlrest as apiProjectToSqlrest,
} from '@/api/datasource'
import { tablesToSchema } from '@/utils/schemaList'
import { dsTypeMeta } from '@/data/dsForm'
import { resolveWs } from '@/utils/ws'
import { fetchAllPages, BACKEND_PAGE_SIZE_MAX } from '@/utils/pageFetch'

const sources = ref([])
/** ETL 编排可用源（usable_in_dag），与全量 sources 分轨，避免冲掉数据源中心列表 */
const dagSources = ref([])
const loaded = ref(false)
const loading = ref(false)
const loadedWs = ref('')
let loadError = null

export function useDatasources() {
  const list = computed(() => sources.value)

  async function loadSources(filters = {}) {
    loading.value = true
    loadError = null
    try {
      const ws = resolveWs(filters.ws)
      if (loadedWs.value && loadedWs.value !== ws) {
        sources.value = []
      }
      const q = { ...filters, ws }
      const records = await fetchAllPages(({ current, size }) => fetchDatasourcePage(q, { current, size }))
      sources.value = records.map(normalizeSource)
      loaded.value = true
      loadedWs.value = ws
      return sources.value
    } catch (e) {
      loadError = e
      console.error('[datasource] load failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 仅在线且 purposes 含 ingest/export；写入 dagSources，不覆盖 sources */
  async function loadDagUsableSources(filters = {}) {
    try {
      const ws = resolveWs(filters.ws)
      const q = { usableInDag: '1', ws }
      const records = await fetchAllPages(({ current, size }) => fetchDatasourcePage(q, { current, size }))
      dagSources.value = records.map(normalizeSource)
      return dagSources.value
    } catch (e) {
      console.warn('[datasource] loadDagUsableSources failed', e)
      dagSources.value = (sources.value || []).filter(isUsableInDag)
      return dagSources.value
    }
  }

  function getSource(id) {
    if (id == null || id === '') return null
    const key = String(id)
    return sources.value.find((s) => String(s.id) === key) || null
  }

  function replaceLocal(row) {
    if (!row?.id) return null
    const key = String(row.id)
    const idx = sources.value.findIndex((s) => String(s.id) === key)
    const next = normalizeSource({ ...row, id: key })
    if (idx >= 0) sources.value[idx] = { ...sources.value[idx], ...next, id: key }
    else sources.value.unshift(next)
    return getSource(key)
  }

  function updateSource(id, patch) {
    const key = String(id)
    const idx = sources.value.findIndex((s) => String(s.id) === key)
    if (idx < 0) return null
    sources.value[idx] = { ...sources.value[idx], ...patch, id: sources.value[idx].id }
    return sources.value[idx]
  }

  async function upsertSource(payload) {
    const body = { ...payload, ws: resolveWs(payload?.ws) }
    const existed = !!getSource(body.id)
    const saved = existed ? await editDatasource(body) : await addDatasource(body)
    return replaceLocal(saved)
  }

  async function testSource(payloadOrId) {
    const payload =
      typeof payloadOrId === 'string' ? { id: payloadOrId } : { ...payloadOrId }
    return apiTest(payload)
  }

  async function toggleStatus(id) {
    const res = await toggleDatasourceStatus(id)
    if (res?.source) replaceLocal(res.source)
    else if (res?.status) updateSource(id, { status: res.status })
    return res
  }

  async function removeSource(id) {
    await apiDeleteDatasources([id])
    sources.value = sources.value.filter((s) => s.id !== id)
    dagSources.value = dagSources.value.filter((s) => s.id !== id)
    return true
  }

  async function projectSqlrest(ids = []) {
    const r = await apiProjectToSqlrest(ids)
    // 刷新列表以带回 syncState / lastError
    if (ids?.length === 1) {
      try {
        const detail = await fetchDatasourceDetail(ids[0])
        replaceLocal(detail)
      } catch {
        await loadSources()
      }
    } else {
      await loadSources()
    }
    return r
  }

  async function fetchAllTables(id) {
    const pageSize = BACKEND_PAGE_SIZE_MAX
    let current = 1
    let total = Infinity
    const all = []
    while (all.length < total) {
      const page = await fetchTablePage(id, { current, size: pageSize })
      const records = (page?.records || []).map(normalizeTable)
      total = Number(page?.total ?? records.length)
      all.push(...records)
      if (!records.length || records.length < pageSize) break
      current += 1
      if (current > 100) break
    }
    return all
  }

  async function ensureTables(id, { force = false } = {}) {
    const s = getSource(id)
    if (!s) return []
    if (!force && Array.isArray(s.tables) && s.tables.length) {
      // 若本地条数明显少于登记总数（同步后被分页截断），强制重拉
      const reported = Number(s.tableCount ?? s.tablesCount ?? 0)
      if (!reported || s.tables.length >= reported) return s.tables
    }
    const tables = await fetchAllTables(id)
    updateSource(id, {
      tables,
      schema: tablesToSchema(tables, { sourceType: s.type }) || s.schema,
      tableCount: tables.length,
    })
    return getSource(id)?.tables || tables
  }

  async function setTables(id, tables) {
    const s = getSource(id)
    return updateSource(id, {
      tables,
      schema: tablesToSchema(tables, { sourceType: s?.type }),
      tableCount: Array.isArray(tables) ? tables.length : 0,
    })
  }

  async function syncTables(id) {
    const dsId = String(id || '')
    if (!dsId) throw new Error('数据源 id 为空')
    const res = await apiSyncTables(dsId)
    let detail = null
    try {
      detail = await fetchDatasourceDetail(dsId)
    } catch (e) {
      console.warn('[datasource] sync detail refresh failed', e)
    }
    const tables = await fetchAllTables(dsId)
    const schema = res?.schema || detail?.schema
    if (detail && typeof detail === 'object') {
      replaceLocal({
        ...detail,
        id: String(detail.id ?? dsId),
        tables,
        tableCount: tables.length,
        schema,
      })
    } else {
      updateSource(dsId, { tables, tableCount: tables.length, ...(schema != null ? { schema } : {}) })
    }
    return getSource(dsId)
  }

  async function addTable(id, item) {
    const tables = await ensureTables(id)
    if (tables.some((t) => t.name === item.name)) return { ok: false, reason: 'exists' }
    const row = await apiAddTable(id, item)
    const next = [...tables, normalizeTable(row)]
    await setTables(id, next)
    return { ok: true, tables: next }
  }

  async function removeTable(id, name) {
    const tables = await ensureTables(id)
    const hit = tables.find((t) => t.name === name)
    if (hit?.id) await apiDeleteTables([hit.id])
    const next = tables.filter((t) => t.name !== name)
    await setTables(id, next)
    return next
  }

  async function patchTable(id, name, patch) {
    const tables = await ensureTables(id)
    const hit = tables.find((t) => t.name === name)
    if (hit?.id) {
      const saved = await apiEditTable({ ...hit, ...patch, id: hit.id })
      const next = tables.map((t) => (t.name === name ? normalizeTable(saved) : t))
      await setTables(id, next)
      return next
    }
    const next = tables.map((t) => (t.name === name ? { ...t, ...patch } : t))
    await setTables(id, next)
    return next
  }

  async function batchSync(ids) {
    return apiBatchSync(ids)
  }

  return {
    sources,
    dagSources,
    list,
    loaded,
    loading,
    loadedWs,
    getLoadError: () => loadError,
    loadSources,
    loadDagUsableSources,
    getSource,
    updateSource,
    upsertSource,
    testSource,
    toggleStatus,
    removeSource,
    projectSqlrest,
    ensureTables,
    setTables,
    syncTables,
    addTable,
    removeTable,
    patchTable,
    batchSync,
  }
}

/** 与后端 usableInDag=1 对齐 */
export function isUsableInDag(s) {
  if (!s) return false
  const st = String(s.status || '').toLowerCase()
  if (st && st !== 'online') return false
  const raw = s.purposes ?? s.purpose ?? ''
  const p = typeof raw === 'string' ? raw : JSON.stringify(raw || [])
  if (!p || p === '[]' || p === 'null') return true
  return p.includes('ingest') || p.includes('export')
}

function normalizeSource(row) {
  if (!row) return row
  const conn = row.conn && typeof row.conn === 'object' ? row.conn : {}
  const typeLabel = row.type || ''
  const meta = dsTypeMeta(typeLabel)
  return {
    ...row,
    ...Object.fromEntries(
      Object.entries(conn).filter(([k]) => row[k] == null || row[k] === ''),
    ),
    password: row.password || (conn.password ? '******' : '') || '******',
    health: row.health ?? row.healthScore ?? 0,
    schema: row.schema || tablesToSchema(row.tables, { sourceType: typeLabel }) || '',
    lag: row.lag || '',
    desc: row.desc || '',
    asset: row.asset ?? null,
    linkedAssets: Array.isArray(row.linkedAssets) ? row.linkedAssets : [],
    host: row.host || conn.host || '',
    port: row.port || conn.port || '',
    database: row.database || conn.database || '',
    user: row.user || conn.user || conn.username || '',
    baseURL: row.baseURL || conn.baseURL || conn.httpUrl || '',
    access: row.access || conn.access || conn.pollCycle || '',
    bg: '#e6f7ff',
    color: '#1890ff',
    tables: Array.isArray(row.tables) ? row.tables.map(normalizeTable) : row.tables,
    conn,
    sqlrestProjectable: row.sqlrestProjectable ?? false,
    sqlrestSyncState: row.sqlrestSyncState || null,
    sqlrestProjected: !!row.sqlrestProjected,
    sqlrestLastError: row.sqlrestLastError || null,
    sqlrestDatasourceId: row.sqlrestDatasourceId ?? null,
  }
}

function normalizeTable(t) {
  if (!t) return t
  return {
    id: t.id,
    name: t.name || t.tableName,
    cnName: t.cnName || '',
    comment: t.comment || t.commentTxt || '',
    encoding: t.encoding || 'utf8mb4',
    engine: t.engine || '',
    rowCount: t.rowCount,
    syncedAt: t.syncedAt || '',
  }
}
