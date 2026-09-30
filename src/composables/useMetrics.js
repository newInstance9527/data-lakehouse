/**
 * 指标中心（对接 /lh/metric）
 */
import { computed, ref } from 'vue'
import {
  compileMetric,
  createMetric,
  fetchMetricDetail,
  fetchMetricList,
  fetchMetricOverview,
  materializeMetric,
  queryMetric,
  trialMetric,
  transitionMetric,
  updateMetric,
} from '@/api/metric'
import {
  METRIC_STATUS,
  metricStatusMeta,
  metricTypeMeta,
  setMetricCatalogProvider,
} from '@/data/metrics'
import { resolveWs } from '@/utils/ws'
import { fetchAllPages, BACKEND_PAGE_SIZE_MAX } from '@/utils/pageFetch'

const catalog = ref([])
const overview = ref(null)
const loading = ref(false)
const loaded = ref(false)
const loadedWs = ref('')
const lastError = ref(null)
let loadPromise = null

const DOMAIN_LABEL = {
  trade: '交易域',
  user: '用户域',
  goods: '商品域',
  product: '商品域',
  marketing: '营销域',
  finance: '财务域',
  common: '通用',
}

function formatHistoryTime(t) {
  if (!t) return '—'
  if (typeof t === 'string') return t.length > 16 ? t.slice(0, 16).replace('T', ' ') : t
  try {
    return new Date(t).toISOString().slice(0, 16).replace('T', ' ')
  } catch {
    return String(t)
  }
}

/** 后端 VO → 前端目录行（id = metricCode） */
export function normalizeMetric(row) {
  if (!row) return null
  const kind = row.kind || row.type || '原子'
  const status = row.status || 'draft'
  const st = metricStatusMeta(status)
  const meta = metricTypeMeta(kind)
  const code = row.metricCode || row.id
  const domainCode = row.domainCode || row.domain || 'common'
  const qualifierKeys = Array.isArray(row.qualifierKeys)
    ? row.qualifierKeys
    : []
  const dimKeys = Array.isArray(row.dimKeys) ? row.dimKeys : []
  return {
    id: code,
    pk: row.id,
    metricCode: code,
    name: row.name,
    type: kind,
    typeCls: meta.typeCls,
    kind,
    domain: domainCode === 'product' ? 'goods' : domainCode,
    domainLabel: DOMAIN_LABEL[domainCode] || row.domainLabel || domainCode,
    caliber: row.caliber || '',
    pendingCaliber: row.pendingCaliber || '',
    bind: row.bind || '—',
    formula: row.formula || '',
    formulaAst: row.formulaAst || null,
    atomRef: row.atomRef || '',
    deriveRef: Array.isArray(row.depCodes) ? row.depCodes.join(',') : row.deriveRef || '',
    depCodes: row.depCodes || [],
    qualifier: row.qualifier || (qualifierKeys.length ? qualifierKeys.join(' AND ') : '无限定'),
    qualifierKeys,
    dim: row.dim || (dimKeys.length ? dimKeys.join(' + ') : ''),
    dimKeys,
    dimCustom: false,
    time: row.time || '',
    agg: row.agg || '',
    table: row.table || '',
    field: row.field || '',
    unit: row.unit || '',
    latest: row.latest || '待计算',
    vol: row.vol || '—',
    volCls: row.volCls || 'warn',
    owner: row.owner || '',
    ver: row.ver || 'v1',
    status,
    statusLabel: row.statusLabel || st.label,
    statusCls: st.cls,
    rowWarn: status === 'review' || status === 'version_review' || !!row.rowWarn,
    history: (row.history || []).map((h) => ({
      status: h.status,
      label: h.label || METRIC_STATUS[h.status]?.label || h.status,
      time: formatHistoryTime(h.time),
      note: h.note || '',
    })),
    compiledSql: row.compiledSql || '',
    dialect: row.dialect || '',
    omFqn: row.omFqn,
    gravAssetId: row.gravAssetId,
    revision: row.revision,
    ws: row.ws || '',
    createTime: row.createTime || null,
    updateTime: row.updateTime,
  }
}

/** 目录排序：非 deprecated 在前，组内 createTime 倒序（新→旧） */
export function sortMetricCatalog(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return rows || []
  return [...rows].sort((a, b) => {
    const aDep = a?.status === 'deprecated' ? 1 : 0
    const bDep = b?.status === 'deprecated' ? 1 : 0
    if (aDep !== bDep) return aDep - bDep
    const at = String(a?.createTime || a?.updateTime || '')
    const bt = String(b?.createTime || b?.updateTime || '')
    if (at !== bt) return bt.localeCompare(at)
    return String(b?.id || '').localeCompare(String(a?.id || ''))
  })
}

function upsertLocal(row) {
  const n = normalizeMetric(row)
  if (!n) return null
  const idx = catalog.value.findIndex((r) => r.id === n.id)
  if (idx >= 0) catalog.value[idx] = { ...catalog.value[idx], ...n }
  else catalog.value.push(n)
  catalog.value = sortMetricCatalog(catalog.value)
  return catalog.value.find((r) => r.id === n.id)
}

async function fetchAllMetricRecords(filters) {
  return fetchAllPages(({ current, size }) => fetchMetricList(filters, { current, size }), {
    pageSize: BACKEND_PAGE_SIZE_MAX,
  })
}

setMetricCatalogProvider(() => catalog.value)

export function useMetrics() {
  const list = computed(() => {
    ensureLoaded()
    return catalog.value
  })

  function ensureLoaded() {
    const ws = resolveWs()
    if (loaded.value && loadedWs.value === ws) return loadPromise
    if (loading.value && loadPromise) return loadPromise
    loadPromise = loadAll({ ws, scope: 'workspace' })
      .catch(() => {})
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  async function loadAll(filters = {}) {
    loading.value = true
    lastError.value = null
    try {
      const ws = resolveWs(filters.ws)
      if (loadedWs.value && loadedWs.value !== ws) {
        catalog.value = []
        overview.value = null
      }
      const q = { ...filters, ws, scope: filters.scope || 'workspace' }
      const [records, ov] = await Promise.all([
        fetchAllMetricRecords(q),
        fetchMetricOverview(ws).catch(() => null),
      ])
      catalog.value = sortMetricCatalog(records.map(normalizeMetric).filter(Boolean))
      overview.value = ov
      loaded.value = true
      loadedWs.value = ws
      return { catalog: catalog.value, overview: overview.value }
    } catch (e) {
      lastError.value = e
      console.error('[metrics] load failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function refreshOverview(ws) {
    try {
      overview.value = await fetchMetricOverview(resolveWs(ws))
    } catch (e) {
      console.warn('[metrics] overview failed', e)
    }
  }

  async function reloadDetail(code, ws) {
    const raw = await fetchMetricDetail(code, resolveWs(ws))
    return upsertLocal(raw)
  }

  async function addMetric(payload) {
    const ws = resolveWs(payload?.ws)
    const saved = await createMetric({ ...payload, ws })
    // 以服务端本空间列表为准，避免仅本地 upsert 后被筛选项/旧缓存挡住
    await loadAll({ ws, scope: 'workspace' })
    const row =
      upsertLocal(saved) || catalog.value.find((r) => r.id === (saved?.metricCode || saved?.id))
    await refreshOverview(ws)
    return row
  }

  async function saveMetric(code, payload) {
    const ws = resolveWs(payload?.ws)
    const saved = await updateMetric(code, { ...payload, ws })
    const row = upsertLocal(saved)
    await refreshOverview(ws)
    return row
  }

  async function runTransition(code, action, note) {
    const ws = resolveWs()
    const saved = await transitionMetric(code, { action, note, ws })
    const row = upsertLocal(saved)
    await refreshOverview(ws)
    return row
  }

  async function runCompile(payload) {
    return compileMetric({ ...payload, ws: resolveWs(payload?.ws) })
  }

  async function runQuery(payload) {
    return queryMetric({ ...payload, ws: resolveWs(payload?.ws) })
  }

  async function runTrial(code, payload = {}) {
    return trialMetric(code, { ...payload, ws: resolveWs(payload?.ws) })
  }

  async function runMaterialize(code, payload = {}) {
    return materializeMetric(code, { ...payload, ws: resolveWs(payload?.ws) })
  }

  const liveKpis = computed(() => {
    const ov = overview.value
    const all = catalog.value
    const total = ov?.total ?? all.length
    const atom = ov?.atomCount ?? all.filter((r) => r.type === '原子').length
    const derive = ov?.deriveCount ?? all.filter((r) => r.type === '衍生').length
    const composite = ov?.compositeCount ?? all.filter((r) => r.type === '复合').length
    const enabled = ov?.activeCount ?? all.filter((r) => r.status === 'active').length
    const matOk = ov?.materializeReconOk
    const matBlocked = ov?.materializeBlocked
    return [
      {
        icon: '📊',
        color: 'blue',
        value: String(total),
        unit: '个',
        label: '总指标数',
        trend: '',
        trendUp: true,
      },
      {
        icon: '⚛️',
        color: 'green',
        value: String(atom),
        unit: '个',
        label: '原子指标',
        trend: '',
        trendUp: true,
      },
      {
        icon: '🎯',
        color: 'purple',
        value: String(derive),
        unit: '个',
        label: '衍生指标',
        trend: '',
        trendUp: true,
      },
      {
        icon: '🧩',
        color: 'cyan',
        value: String(composite),
        unit: '个',
        label: '复合指标',
        trend: '',
        trendUp: true,
      },
      {
        icon: matBlocked > 0 ? '⚠️' : '✅',
        color: matBlocked > 0 ? 'orange' : 'green',
        value: String(enabled),
        unit: '个',
        label: '已启用',
        trend:
          matOk != null
            ? `看板就绪物化 ${matOk} · 未对账 ${matBlocked ?? 0}`
            : '可被报表 / API 引用',
        trendUp: !(matBlocked > 0),
      },
    ]
  })

  return {
    catalog: list,
    catalogRaw: catalog,
    overview,
    liveKpis,
    loading,
    loaded,
    loadedWs,
    lastError,
    ensureLoaded,
    loadAll,
    refreshOverview,
    reloadDetail,
    addMetric,
    saveMetric,
    runTransition,
    runCompile,
    runQuery,
    runTrial,
    runMaterialize,
  }
}
