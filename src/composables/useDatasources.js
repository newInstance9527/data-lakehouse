import { computed, ref } from 'vue'
import {
  addDatasource,
  addTable as apiAddTable,
  batchSyncTables as apiBatchSync,
  deleteTables as apiDeleteTables,
  editDatasource,
  editTable as apiEditTable,
  fetchDatasourceDetail,
  fetchDatasourcePage,
  fetchTablePage,
  syncTables as apiSyncTables,
  testDatasource as apiTest,
  toggleDatasourceStatus,
} from '@/api/datasource'
import { tablesToSchema } from '@/utils/schemaList'

const sources = ref([])
/** ETL 编排可用源（usable_in_dag），与全量 sources 分轨，避免冲掉数据源中心列表 */
const dagSources = ref([])
const loaded = ref(false)
const loading = ref(false)
let loadError = null

export function useDatasources() {
  const list = computed(() => sources.value)

  async function loadSources(filters = {}) {
    loading.value = true
    loadError = null
    try {
      const page = await fetchDatasourcePage(filters, { current: 1, size: 500 })
      sources.value = (page?.records || []).map(normalizeSource)
      loaded.value = true
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
  async function loadDagUsableSources() {
    try {
      const page = await fetchDatasourcePage({ usableInDag: '1' }, { current: 1, size: 500 })
      dagSources.value = (page?.records || []).map(normalizeSource)
      return dagSources.value
    } catch (e) {
      console.warn('[datasource] loadDagUsableSources failed', e)
      // 回退：用本地 sources 客户端过滤
      dagSources.value = (sources.value || []).filter(isUsableInDag)
      return dagSources.value
    }
  }

  function getSource(id) {
    return sources.value.find((s) => s.id === id) || null
  }

  function replaceLocal(row) {
    if (!row?.id) return null
    const idx = sources.value.findIndex((s) => s.id === row.id)
    const next = normalizeSource(row)
    if (idx >= 0) sources.value[idx] = { ...sources.value[idx], ...next }
    else sources.value.unshift(next)
    return sources.value.find((s) => s.id === row.id)
  }

  function updateSource(id, patch) {
    const idx = sources.value.findIndex((s) => s.id === id)
    if (idx < 0) return null
    sources.value[idx] = { ...sources.value[idx], ...patch }
    return sources.value[idx]
  }

  async function upsertSource(payload) {
    const existed = !!getSource(payload.id)
    const saved = existed ? await editDatasource(payload) : await addDatasource(payload)
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

  async function ensureTables(id) {
    const s = getSource(id)
    if (!s) return []
    if (Array.isArray(s.tables) && s.tables.length) return s.tables
    const page = await fetchTablePage(id, { current: 1, size: 500 })
    const tables = (page?.records || []).map(normalizeTable)
    updateSource(id, { tables, schema: tablesToSchema(tables) || s.schema })
    return getSource(id)?.tables || tables
  }

  async function setTables(id, tables) {
    return updateSource(id, {
      tables,
      schema: tablesToSchema(tables),
    })
  }

  async function syncTables(id) {
    const res = await apiSyncTables(id)
    const detail = await fetchDatasourceDetail(id)
    const page = await fetchTablePage(id, { current: 1, size: 500 })
    replaceLocal({
      ...detail,
      tables: (page?.records || []).map(normalizeTable),
      schema: res?.schema || detail?.schema,
    })
    return getSource(id)
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
    getLoadError: () => loadError,
    loadSources,
    loadDagUsableSources,
    getSource,
    updateSource,
    upsertSource,
    testSource,
    toggleStatus,
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
  return {
    ...row,
    ...Object.fromEntries(
      Object.entries(conn).filter(([k]) => row[k] == null || row[k] === ''),
    ),
    password: row.password || (conn.password ? '******' : '') || '******',
    health: row.health ?? row.healthScore ?? 0,
    schema: row.schema || tablesToSchema(row.tables) || '',
    lag: row.lag || '',
    desc: row.desc || '',
    asset: row.asset ?? null,
    linkedAssets: Array.isArray(row.linkedAssets) ? row.linkedAssets : [],
    host: row.host || conn.host || '',
    port: row.port || conn.port || '',
    database: row.database || conn.database || '',
    user: row.user || conn.user || conn.username || '',
    tables: Array.isArray(row.tables) ? row.tables.map(normalizeTable) : row.tables,
    conn,
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
