/**
 * 字段血缘：门户 /lh/lineage（字段边 + graph/impact）+ sync 水位/Marquez
 */
import { computed, ref } from 'vue'
import {
  fetchLineageFields,
  fetchLineageGraph,
  fetchLineageImpact,
  fetchLineageSyncStatus,
  fetchMarquezNamespaces,
  postBlockDdl,
  postChangeEval,
  syncLineageFields,
} from '@/api/lineage'
import { focusTableMeta } from '@/data/lineage'
import { ensureLineageLayout } from '@/utils/lineageLayout'

const fieldEdges = ref([])
const graphPayload = ref(null)
const impactPayload = ref(null)
const syncInfo = ref(null)
const lastParsedAt = ref('')
const loading = ref(false)
const lastError = ref(null)

const LAYER_ICON = {
  ODS: '📋',
  DWD: '🔧',
  DWS: '📊',
  ADS: '🧊',
  DIM: '📦',
  表: '📄',
}

function normalizeEdge(e) {
  if (!e) return null
  return {
    id: e.id,
    fromTable: e.fromTable,
    fromField: e.fromField,
    toTable: e.toTable,
    toField: e.toField,
    transform: e.transform || e.transformText || '',
    confidence: e.confidence || 'explicit',
  }
}

function enrichGraphNodes(nodes = [], focusTable, edges = []) {
  const enriched = (nodes || []).map((n) => {
    const id = n.id || n.name
    const layerRaw = String(n.layer || '表').toLowerCase()
    const layer = ['ods', 'dwd', 'dws', 'ads', 'dim', 'src', 'metric', 'report'].includes(layerRaw)
      ? layerRaw
      : guessLayer(id).toLowerCase()
    return {
      id,
      name: n.name || id,
      layer,
      type: n.type || 'table',
      x: Number.isFinite(Number(n.x)) ? Number(n.x) : undefined,
      y: Number.isFinite(Number(n.y)) ? Number(n.y) : undefined,
      desc: n.desc || '',
      icon: n.icon || LAYER_ICON[guessLayer(id)] || '📋',
      assetId: n.assetId,
      metricCode: n.metricCode || (n.type === 'metric' || layer === 'metric' ? id : undefined),
      path: n.path,
      focus: normalizeTable(id) === normalizeTable(focusTable),
      hop: n.hop,
    }
  })
  return ensureLineageLayout(enriched, edges, { focusId: focusTable, force: true })
}

function guessLayer(table) {
  const t = String(table || '').toLowerCase()
  if (t.includes('ods')) return 'ODS'
  if (t.includes('dwd')) return 'DWD'
  if (t.includes('dws')) return 'DWS'
  if (t.includes('ads')) return 'ADS'
  if (t.includes('dim')) return 'DIM'
  return '表'
}

function normalizeTable(t) {
  return String(t || '').trim().toLowerCase()
}

function mapImpactItem(x = {}) {
  return {
    key: x.key,
    type: x.type || '表',
    note: x.note || '',
    assetId: x.assetId,
    nodeId: x.nodeId,
    metricCode: x.metricCode,
    name: x.name,
    path: x.path,
    owner: x.owner,
    ver: x.ver,
    kind: x.kind,
    status: x.status,
    confidence: x.confidence,
    hop: x.hop,
  }
}

function focusApiKey(focusId) {
  const meta = focusTableMeta(focusId)
  return meta?.tableKey || focusId
}

export function useLineage() {
  const tables = computed(() => {
    const set = new Map()
    fieldEdges.value.forEach((e) => {
      ;[e.fromTable, e.toTable].forEach((t) => {
        if (!t || set.has(t)) return
        set.set(t, { id: t, key: t, fullName: t, fields: [] })
      })
    })
    return [...set.values()]
  })

  const stats = computed(() => ({
    tables: tables.value.length,
    tableEdges: graphPayload.value?.edges?.length || 0,
    fieldEdges: fieldEdges.value.length,
    tasks: 0,
    explicit: fieldEdges.value.filter((e) => e.confidence === 'explicit').length,
    inferred: fieldEdges.value.filter((e) => e.confidence !== 'explicit').length,
  }))

  function findTable(key) {
    const q = String(key || '').trim()
    if (!q) return null
    return (
      tables.value.find((t) => t.id === q || t.key === q) ||
      tables.value.find((t) => t.key.endsWith('.' + q) || t.fullName === q) ||
      null
    )
  }

  async function loadFields(filters = {}) {
    const page = await fetchLineageFields(filters, { current: 1, size: 500 })
    fieldEdges.value = (page?.records || []).map(normalizeEdge).filter(Boolean)
    graphPayload.value = null
    impactPayload.value = null
    lastParsedAt.value = new Date().toLocaleString()
    return fieldEdges.value
  }

  async function loadGraphImpact(focusId, upDepth, downDepth, ws) {
    loading.value = true
    lastError.value = null
    const focus = focusApiKey(focusId)
    try {
      const q = { focus, upDepth, downDepth, ws }
      const [g, imp] = await Promise.all([
        fetchLineageGraph(q),
        fetchLineageImpact(q),
      ])
      const edges = (g?.edges || []).map((e) =>
        Array.isArray(e) ? e : { from: e.from, to: e.to, transform: e.transform },
      )
      graphPayload.value = {
        ...g,
        nodes: enrichGraphNodes(g?.nodes || [], focus, edges),
        edges,
        focusTable: focus || g?.focus || '',
        source: g?.source || 'portal_edges',
        omDegraded: !!g?.omDegraded,
      }
      impactPayload.value = {
        up: (imp?.up || []).map(mapImpactItem),
        down: (imp?.down || []).map(mapImpactItem),
        metricCount: imp?.metricCount ?? 0,
        source: imp?.source,
      }
      return { graph: graphPayload.value, impact: impactPayload.value }
    } catch (e) {
      lastError.value = e
      console.error('[lineage] graph/impact failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 同步水位 + Marquez 探活，并刷新字段边 */
  async function sync(ws) {
    const result = await syncLineageFields({ ws })
    let status = null
    let marquez = result?.marquez || null
    try {
      status = await fetchLineageSyncStatus({ ws })
    } catch {
      /* ignore */
    }
    if (!marquez) {
      try {
        marquez = await fetchMarquezNamespaces()
      } catch {
        /* ignore */
      }
    }
    await loadFields({ ws })
    syncInfo.value = {
      at: new Date().toLocaleString(),
      result,
      status,
      marquez,
    }
    lastParsedAt.value = syncInfo.value.at
    return syncInfo.value
  }

  async function changeEval(table, field, toType) {
    return postChangeEval({ table, field, toType })
  }

  async function blockDdl(table, field, reason) {
    return postBlockDdl({ table, field, reason })
  }

  /** 兼容旧调用名：改为拉门户字段边 */
  async function rebuild() {
    return loadFields({})
  }

  return {
    fieldEdges,
    tables,
    stats,
    graphPayload,
    impactPayload,
    syncInfo,
    lastParsedAt,
    loading,
    lastError,
    findTable,
    loadFields,
    loadGraphImpact,
    sync,
    rebuild,
    changeEval,
    blockDdl,
    focusApiKey,
  }
}
