import { computed, ref } from 'vue'
import {
  addAsset as apiAddAsset,
  editAsset as apiEditAsset,
  fetchAssetDetail,
  fetchAssetPage,
  fetchAssetPreview,
  fetchAssetSchema,
  refreshAsset as apiRefresh,
  sensitivityToLevel,
  updateAssetMeta as apiUpdateMeta,
} from '@/api/catalog'
import { domainMeta, layerMeta, levelClass } from '@/data/assetMeta'

const assets = ref([])
const loaded = ref(false)
const loading = ref(false)
let loadError = null
let loadPromise = null

export function useAssets() {
  const list = computed(() => {
    ensureLoaded()
    return assets.value
  })

  function ensureLoaded() {
    if (loaded.value || loading.value || loadPromise) return loadPromise
    loadPromise = loadAssets()
      .catch(() => {})
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  async function loadAssets(filters = {}) {
    loading.value = true
    loadError = null
    try {
      const page = await fetchAssetPage(filters, { current: 1, size: 500 })
      assets.value = (page?.records || []).map(normalizeAsset)
      loaded.value = true
      return assets.value
    } catch (e) {
      loadError = e
      console.error('[catalog] load failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function findAsset(idOrKey) {
    const q = String(idOrKey ?? '').trim()
    if (!q) return null
    return (
      assets.value.find((a) => a.id === q || a.key === q || a.name === q || a.assetCode === q) ||
      assets.value.find((a) => a.key?.endsWith('.' + q) || a.key?.includes(q)) ||
      null
    )
  }

  function replaceLocal(row) {
    if (!row?.id) return null
    const next = normalizeAsset(row)
    const idx = assets.value.findIndex((a) => a.id === next.id)
    if (idx >= 0) assets.value[idx] = { ...assets.value[idx], ...next }
    else assets.value.unshift(next)
    return assets.value.find((a) => a.id === next.id)
  }

  /** 注册：调后端，返回规范化行 */
  async function addAsset(payload) {
    const saved = await apiAddAsset(payload)
    return replaceLocal(saved)
  }

  async function editAsset(payload) {
    const saved = await apiEditAsset(payload)
    return replaceLocal(saved)
  }

  async function loadDetail(id) {
    const detail = await fetchAssetDetail(id)
    return replaceLocal(detail)
  }

  async function loadSchema(id) {
    const schema = await fetchAssetSchema(id)
    const fields = mapSchemaFields(schema) || []
    const idx = assets.value.findIndex((a) => a.id === id)
    if (idx >= 0 && schema) {
      assets.value[idx] = {
        ...assets.value[idx],
        fields,
        cols: schema.columnCount ?? fields.length,
        extras: { ...(assets.value[idx].extras || {}), schema },
      }
      return assets.value[idx]
    }
    return { schema, fields }
  }

  async function refresh(id) {
    const res = await apiRefresh(id)
    await loadDetail(id)
    return res
  }

  async function updateMeta(payload) {
    const res = await apiUpdateMeta(payload)
    if (payload?.id) await loadDetail(payload.id)
    return res
  }

  async function loadPreview(id, opts = {}) {
    return fetchAssetPreview(id, opts)
  }

  return {
    assets,
    list,
    loaded,
    loading,
    get loadError() {
      return loadError
    },
    ensureLoaded,
    loadAssets,
    findAsset,
    addAsset,
    editAsset,
    loadDetail,
    loadSchema,
    loadPreview,
    refresh,
    updateMeta,
    replaceLocal,
  }
}

export function normalizeAsset(vo) {
  if (!vo) return null
  const layer = layerMeta(vo.layer)
  const domain = domainMeta(vo.domainCode || vo.domain)
  const level = sensitivityToLevel(vo.sensitivity) || vo.level || '内部'
  const schema = vo.extras?.schema
  const fields = vo.fields || mapSchemaFields(schema) || []
  const owner = vo.techOwner || vo.owner || ''
  const tags = Array.isArray(vo.tags) && vo.tags.length
    ? vo.tags
    : buildDefaultTags(vo, layer)
  const quality =
    vo.qualityScore ??
    vo.quality ??
    vo.extras?.quality?.score ??
    (vo.extras?.quality && vo.extras.quality.score == null ? '—' : undefined) ??
    '—'

  return {
    id: vo.id,
    key: vo.assetCode || vo.key || vo.name,
    assetCode: vo.assetCode || vo.key,
    name: vo.name || vo.assetCode,
    cnName: vo.cnName || '',
    layer: vo.layer || layer.value,
    layerLabel: vo.layerLabel || layer.label,
    domain: vo.domainCode || vo.domain || domain.value,
    domainLabel: vo.domainLabel || domain.label,
    desc: vo.description || vo.desc || '',
    size: vo.size || '',
    cols: vo.cols ?? schema?.columnCount ?? fields.length ?? '—',
    partitions: vo.partitions || '',
    updated: formatUpdated(vo.updateTime || vo.updated),
    owner,
    ownerAvatar: avatarOf(owner),
    bizOwner: vo.bizOwner || '',
    level,
    levelClass: levelClass(level),
    quality,
    qualityClass: qualityClassOf(quality),
    isGold: !!vo.isGold,
    engine: vo.engine || '',
    storage: vo.storage || '',
    tags,
    metrics: vo.metrics || { read7d: '—' },
    sourceId: vo.primaryDsId || vo.sourceId || null,
    sourceName: vo.primaryDsName || vo.sourceName || vo.sourceSummary || null,
    sourceType: vo.sourceType || null,
    tableName: vo.objectName || vo.tableName || null,
    objectName: vo.objectName || vo.tableName || null,
    omFqn: vo.omFqn || '',
    status: vo.status || '',
    linkStatus: vo.linkStatus || '',
    revision: vo.revision,
    sources: vo.sources || [],
    sourceSummary: vo.sourceSummary || '',
    extras: vo.extras || null,
    fields,
    lastSyncStatus: vo.lastSyncStatus,
  }
}

function buildDefaultTags(vo, layer) {
  const tags = []
  if (vo.status && vo.status !== 'active') {
    tags.push([vo.status, 'tag-gray'])
  }
  if (layer?.label) tags.push([layer.label, 'tag-cyan'])
  if (vo.assetKind && vo.assetKind !== 'table') {
    tags.push([vo.assetKind, 'tag-blue'])
  }
  return tags
}

function mapSchemaFields(schema) {
  if (!schema?.columns || !Array.isArray(schema.columns)) return []
  return schema.columns.map((c) => ({
    cnName: c.comment || c.name || '',
    enName: c.name || '',
    desc: c.comment || '',
    dataType: c.type || '',
    length: null,
    scale: null,
    nullable: c.nullable !== false,
    pk: false,
  }))
}

function avatarOf(owner) {
  const s = String(owner || '').trim()
  if (!s) return '—'
  return s.slice(0, 2).toUpperCase().replace(/\s/g, '') || '—'
}

function formatUpdated(v) {
  if (!v) return ''
  if (typeof v === 'string') return v
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return String(v)
  }
}

function qualityClassOf(q) {
  if (q === '—' || q == null || q === '') return 'qs-mid'
  const n = Number(q)
  if (Number.isNaN(n)) return 'qs-mid'
  if (n >= 95) return 'qs-high'
  if (n >= 80) return 'qs-mid'
  return 'qs-low'
}
