/**
 * 资产目录 API（对齐 /lh/catalog）
 */
import { http } from './http.js'

const CAT = '/lh/catalog'

export function fetchAssetPage(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${CAT}/assets`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    layer: filters.layer,
    domain: filters.domain ?? filters.domainCode,
    dsId: filters.dsId,
    source: filters.source,
    kind: filters.kind ?? filters.assetKind,
    status: filters.status,
    ws: filters.ws,
  })
}

export function fetchAssetDetail(id) {
  return http.get(`${CAT}/assets/detail`, { id })
}

export function fetchAssetSources(id) {
  return http.get(`${CAT}/assets/sources`, { id })
}

export function fetchAssetSchema(id) {
  return http.get(`${CAT}/assets/schema`, { id })
}

export function fetchCatalogMetaOptions() {
  return http.get(`${CAT}/metaOptions`)
}

/** 注册：对齐 GovAssetAddParam */
export function addAsset(payload) {
  return http.post(`${CAT}/assets`, {
    dsId: payload.dsId || payload.sourceId,
    objectName: payload.objectName || payload.tableName,
    layer: payload.layer,
    domain: payload.domain || payload.domainCode,
    assetCode: payload.assetCode || payload.key || payload.id,
    name: payload.name,
    cnName: payload.cnName,
    description: payload.description || payload.desc,
    techOwner: payload.techOwner || payload.owner,
    bizOwner: payload.bizOwner,
    sensitivity: payload.sensitivity || levelToSensitivity(payload.level),
    assetKind: payload.assetKind,
    engine: payload.engine,
    ws: payload.ws,
    remark: payload.remark,
  })
}

export function editAsset(payload) {
  return http.post(`${CAT}/assets/edit`, {
    id: payload.id,
    name: payload.name,
    cnName: payload.cnName,
    description: payload.description ?? payload.desc,
    layer: payload.layer,
    domain: payload.domain || payload.domainCode,
    techOwner: payload.techOwner || payload.owner,
    bizOwner: payload.bizOwner,
    sensitivity: payload.sensitivity || levelToSensitivity(payload.level),
    engine: payload.engine,
    isGold: payload.isGold === true ? 1 : payload.isGold === false ? 0 : payload.isGold,
    status: payload.status,
    remark: payload.remark,
    revision: payload.revision,
  })
}

export function deleteAsset(id) {
  return http.post(`${CAT}/assets/delete`, { id })
}

export function refreshAsset(id) {
  return http.post(`${CAT}/assets/refresh`, { id })
}

export function fetchAssetPreview(id, { limit = 20 } = {}) {
  return http.get(`${CAT}/assets/preview`, { id, limit })
}

export function updateAssetMeta(payload) {
  return http.post(`${CAT}/assets/meta`, {
    id: payload.id,
    description: payload.description,
    displayName: payload.displayName,
    tags: payload.tags,
    syncPortalDraft: payload.syncPortalDraft,
    syncGold: payload.syncGold,
    gold: payload.gold,
  })
}

/** 前端安全等级 → 后端 sensitivity */
export function levelToSensitivity(level) {
  const m = {
    公开: 'public',
    内部: 'internal',
    敏感: 'secret',
    机密: 'confidential',
    public: 'public',
    internal: 'internal',
    secret: 'secret',
    confidential: 'confidential',
  }
  return m[level] || 'internal'
}

/** 后端 sensitivity → 前端展示等级 */
export function sensitivityToLevel(s) {
  const m = {
    public: '公开',
    internal: '内部',
    secret: '敏感',
    confidential: '机密',
  }
  return m[String(s || '').toLowerCase()] || '内部'
}
