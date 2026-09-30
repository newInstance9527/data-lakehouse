/**
 * 数据服务 API（对齐 /lh/dataapi · 治理壳 + SQLREST Manager）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

const BASE = '/lh/dataapi'
const DS = '/lh/datasource'

export function fetchDataapiOverview(ws) {
  return http.get(`${BASE}/overview`, { ws: resolveWs(ws) })
}

export function fetchDataapiApis(filters = {}) {
  return http.get(`${BASE}/apis`, {
    q: filters.q ?? filters.keyword,
    state: filters.state,
    domain: filters.domain,
    tag: filters.tag,
    ws: resolveWs(filters.ws),
  })
}

export function fetchDataapiDetail(id, withSqlrest = true) {
  return http.get(`${BASE}/detail`, { id, withSqlrest })
}

export function buildDataapi(payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  return http.post(`${BASE}/build`, { ...p, ws: resolveWs(p.ws) })
}

export function trialDataapi(payload) {
  return http.post(`${BASE}/trial`, payload)
}

export function publishDataapi(id, ws, publishTicketNo) {
  return http.post(`${BASE}/publish`, { id, ws: resolveWs(ws), publishTicketNo })
}

/** 取消发布 → 草稿（须重新申请发布）；与永久下线 retire 不同 */
export function unpublishDataapi(id, ws) {
  return http.post(`${BASE}/unpublish`, { id, ws: resolveWs(ws) })
}

export function retireDataapi(id, ws) {
  return http.post(`${BASE}/retire`, { id, ws: resolveWs(ws) })
}

/** 删除绑定（本人/超管；已发布须先取消发布；同步 SQLREST/Key） */
export function deleteDataapi(id, ws) {
  return http.post(`${BASE}/delete`, { id, ws: resolveWs(ws) })
}

export function fetchDataapiVersions(id) {
  return http.get(`${BASE}/versions`, { id })
}

/** 回退到历史 commit 并 deploy */
export function rollbackDataapi(id, commitId, version) {
  return http.post(`${BASE}/rollback`, { id, commitId, version })
}

export function syncDataapiApisix(ws) {
  const w = resolveWs(ws)
  return http.post(`${BASE}/syncApisix?ws=${encodeURIComponent(w)}`, {})
}

export function fetchDataapiRoutes() {
  return http.get(`${BASE}/routes`)
}

export function fetchDataapiKeys(ws) {
  return http.get(`${BASE}/keys`, { ws: resolveWs(ws) })
}

/** 二次查看订阅 Key 密文（Vault）；body: { id, reason? } */
export function revealDataapiKey({ id, reason } = {}) {
  return http.post(`${BASE}/keys/reveal`, { id, reason })
}

export function fetchDataapiEmbedUrl() {
  return http.get(`${BASE}/embedUrl`)
}

export function fetchDataapiWorkbench(ws) {
  return http.get(`${BASE}/workbench`, { ws: resolveWs(ws) })
}

export function syncFromSqlrest(ws) {
  const w = resolveWs(ws)
  return http.post(`${BASE}/syncFromSqlrest?ws=${encodeURIComponent(w)}`, {})
}

export function registerDataapi(payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  return http.post(`${BASE}/register`, { ...p, ws: resolveWs(p.ws) })
}

/** 全量替换自定义标签（已发布亦可）；body: { id, tags: string[] } */
export function updateDataapiTags({ id, tags } = {}) {
  return http.post(`${BASE}/updateTags`, { id, tags: Array.isArray(tags) ? tags : [] })
}

export function parseDataapiParams(payload) {
  return http.post(`${BASE}/parseParams`, payload)
}

export function fetchSqlrestOptions() {
  return http.get(`${BASE}/sqlrest/options`)
}

export function gatewayProbe(payload) {
  return http.post(`${BASE}/gatewayProbe`, payload)
}

export function fetchDataapiCallStats(days = 7, ws) {
  return http.get(`${BASE}/callStats`, { days, ws: resolveWs(ws) })
}

export function fetchDataapiOpenapi({ ws, id } = {}) {
  return http.get(`${BASE}/openapi.json`, { ws: resolveWs(ws), id })
}

export function fetchListForSqlrest() {
  return http.get(`${DS}/listForSqlrest`)
}

export function projectToSqlrest(ids = []) {
  return http.post(`${DS}/projectToSqlrest`, ids.map((id) => ({ id })))
}

/** 元数据浏览：优先平台 /lh/datasource/meta/*（见 datasource.js） */
export {
  fetchMetaSchemas,
  fetchMetaTables,
  fetchMetaViews,
  fetchMetaColumns,
} from './datasource.js'
