import { computed, ref } from 'vue'
import {
  addAsset as apiAddAsset,
  deleteAsset as apiDeleteAsset,
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
import { resolveWs } from '@/utils/ws'
import { fetchAllPages } from '@/utils/pageFetch'

const assets = ref([])
const loaded = ref(false)
const loading = ref(false)
const loadedWs = ref('')
let loadError = null
let loadPromise = null

export function useAssets() {
  const list = computed(() => {
    ensureLoaded()
    return assets.value
  })

  function ensureLoaded(force = false) {
    const ws = resolveWs()
    if (!force && loaded.value && loadedWs.value === ws) return loadPromise
    if (loading.value && loadPromise && !force) return loadPromise
    loadPromise = loadAssets({ ws, scope: 'workspace' })
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
      const ws = resolveWs(filters.ws)
      if (loadedWs.value && loadedWs.value !== ws) {
        assets.value = []
      }
      const q = { ...filters, ws, scope: filters.scope || 'workspace' }
      const records = await fetchAllPages(({ current, size }) => fetchAssetPage(q, { current, size }))
      assets.value = records.map(normalizeAsset).filter(Boolean)
      loaded.value = true
      loadedWs.value = ws
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
    const saved = await apiAddAsset({ ...payload, ws: resolveWs(payload?.ws) })
    return replaceLocal(saved)
  }

  async function editAsset(payload) {
    const saved = await apiEditAsset(payload)
    return replaceLocal(saved)
  }

  async function removeAsset(id) {
    await apiDeleteAsset(id)
    assets.value = assets.value.filter((a) => a.id !== id)
    return true
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

  function invalidateAssets() {
    assets.value = []
    loaded.value = false
    loadedWs.value = ''
    loadPromise = null
  }

  return {
    assets,
    list,
    loaded,
    loading,
    loadedWs,
    get loadError() {
      return loadError
    },
    ensureLoaded,
    loadAssets,
    invalidateAssets,
    findAsset,
    addAsset,
    editAsset,
    removeAsset,
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
  const ownerName = vo.techOwnerName || vo.ownerName || ''
  const tags = Array.isArray(vo.tags) && vo.tags.length
    ? vo.tags
    : buildDefaultTags(vo)
  const quality =
    vo.qualityScore ??
    vo.quality ??
    vo.extras?.quality?.score ??
    (vo.extras?.quality && vo.extras.quality.score == null ? '—' : undefined) ??
    '—'

  // 列表无 schema 时 fields 为空，length=0 不能当成「0 列」
  let cols = null
  if (vo.cols != null && vo.cols !== '' && Number(vo.cols) > 0) cols = Number(vo.cols)
  else if (schema?.columnCount != null && Number(schema.columnCount) > 0) cols = Number(schema.columnCount)
  else if (fields.length > 0) cols = fields.length

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
    cols,
    partitions: vo.partitions || '',
    updated: formatUpdated(vo.updateTime || vo.updated),
    owner,
    ownerName,
    ownerAvatar: avatarOf(ownerName || owner),
    techOwner: vo.techOwner || owner || '',
    techOwnerName: vo.techOwnerName || ownerName || '',
    bizOwner: vo.bizOwner || '',
    bizOwnerName: vo.bizOwnerName || '',
    createUser: vo.createUser || '',
    createUserName: vo.createUserName || '',
    level,
    levelClass: levelClass(level),
    quality,
    qualityClass: qualityClassOf(quality),
    isGold: !!vo.isGold,
    visibility: vo.visibility || 'private_ws',
    ws: vo.ws || '',
    engine: vo.engine || '',
    storage: vo.storage || '',
    tags,
    metrics: vo.metrics && typeof vo.metrics === 'object' ? vo.metrics : null,
    sourceId: vo.primaryDsId || vo.sourceId || null,
    sourceName: vo.primaryDsName || vo.sourceName || null,
    sourceType: vo.primaryDsType || vo.sourceType || null,
    sourceCode: vo.primaryDsCode || vo.sourceCode || null,
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

function buildDefaultTags(vo) {
  const tags = []
  if (vo.status && vo.status !== 'active') {
    tags.push([vo.status, 'tag-gray'])
  }
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
  if (/^[\u4e00-\u9fff]/.test(s)) return s.slice(0, 1)
  const parts = s.replace(/[()（）].*$/, '').trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return s.slice(0, 2).toUpperCase()
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
