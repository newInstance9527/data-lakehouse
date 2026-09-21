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

const catalog = ref([])
const overview = ref(null)
const loading = ref(false)
const loaded = ref(false)
const lastError = ref(null)
let loadPromise = null

const DOMAIN_LABEL = {
  trade: '交易',
  user: '用户',
  goods: '商品',
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
  const domainCode = row.domainCode || row.domain || 'trade'
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
    domain: domainCode,
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
    updateTime: row.updateTime,
  }
}

function upsertLocal(row) {
  const n = normalizeMetric(row)
  if (!n) return null
  const idx = catalog.value.findIndex((r) => r.id === n.id)
  if (idx >= 0) catalog.value[idx] = { ...catalog.value[idx], ...n }
  else catalog.value.unshift(n)
  return catalog.value.find((r) => r.id === n.id)
}

setMetricCatalogProvider(() => catalog.value)

export function useMetrics() {
  const list = computed(() => {
    ensureLoaded()
    return catalog.value
  })

  function ensureLoaded() {
    if (loaded.value || loading.value || loadPromise) return loadPromise
    loadPromise = loadAll()
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
      const [page, ov] = await Promise.all([
        fetchMetricList(filters, { current: 1, size: 500 }),
        fetchMetricOverview(filters.ws).catch(() => null),
      ])
      catalog.value = (page?.records || []).map(normalizeMetric).filter(Boolean)
      overview.value = ov
      loaded.value = true
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
      overview.value = await fetchMetricOverview(ws)
    } catch (e) {
      console.warn('[metrics] overview failed', e)
    }
  }

  async function reloadDetail(code) {
    const raw = await fetchMetricDetail(code)
    return upsertLocal(raw)
  }

  async function addMetric(payload) {
    const saved = await createMetric(payload)
    const row = upsertLocal(saved)
    await refreshOverview()
    return row
  }

  async function saveMetric(code, payload) {
    const saved = await updateMetric(code, payload)
    const row = upsertLocal(saved)
    await refreshOverview()
    return row
  }

  async function runTransition(code, action, note) {
    const saved = await transitionMetric(code, { action, note })
    const row = upsertLocal(saved)
    await refreshOverview()
    return row
  }

  async function runCompile(payload) {
    return compileMetric(payload)
  }

  async function runQuery(payload) {
    return queryMetric(payload)
  }

  async function runTrial(code, payload = {}) {
    return trialMetric(code, payload)
  }

  const liveKpis = computed(() => {
    const ov = overview.value
    const all = catalog.value
    const total = ov?.total ?? all.length
    const atom = ov?.atomCount ?? all.filter((r) => r.type === '原子').length
    const derive = ov?.deriveCount ?? all.filter((r) => r.type === '衍生').length
    const composite = ov?.compositeCount ?? all.filter((r) => r.type === '复合').length
    const enabled = ov?.activeCount ?? all.filter((r) => r.status === 'active').length
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
        icon: '✅',
        color: 'green',
        value: String(enabled),
        unit: '个',
        label: '已启用',
        trend: '可被报表 / API 引用',
        trendUp: true,
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
  }
}
