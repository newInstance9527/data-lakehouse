/**
 * 数据服务 API（对齐 /lh/dataapi · 治理壳 + SQLREST Manager）
 */
import { http } from './http.js'

const BASE = '/lh/dataapi'
const DS = '/lh/datasource'

export function fetchDataapiOverview(ws) {
  return http.get(`${BASE}/overview`, { ws })
}

export function fetchDataapiApis(filters = {}) {
  return http.get(`${BASE}/apis`, {
    q: filters.q ?? filters.keyword,
    state: filters.state,
    domain: filters.domain,
    ws: filters.ws,
  })
}

export function fetchDataapiDetail(id, withSqlrest = true) {
  return http.get(`${BASE}/detail`, { id, withSqlrest })
}

export function buildDataapi(payload) {
  return http.post(`${BASE}/build`, payload)
}

export function trialDataapi(payload) {
  return http.post(`${BASE}/trial`, payload)
}

export function publishDataapi(id, ws, publishTicketNo) {
  return http.post(`${BASE}/publish`, { id, ws, publishTicketNo })
}

/** 取消发布 → 草稿（须重新申请发布）；与永久下线 retire 不同 */
export function unpublishDataapi(id, ws) {
  return http.post(`${BASE}/unpublish`, { id, ws })
}

export function retireDataapi(id, ws) {
  return http.post(`${BASE}/retire`, { id, ws })
}

export function fetchDataapiVersions(id) {
  return http.get(`${BASE}/versions`, { id })
}

/** 回退到历史 commit 并 deploy */
export function rollbackDataapi(id, commitId, version) {
  return http.post(`${BASE}/rollback`, { id, commitId, version })
}

export function syncDataapiApisix(ws) {
  return http.post(`${BASE}/syncApisix${ws ? `?ws=${encodeURIComponent(ws)}` : ''}`, {})
}

export function fetchDataapiRoutes() {
  return http.get(`${BASE}/routes`)
}

export function fetchDataapiKeys(ws) {
  return http.get(`${BASE}/keys`, { ws })
}

export function fetchDataapiEmbedUrl() {
  return http.get(`${BASE}/embedUrl`)
}

export function fetchDataapiWorkbench() {
  return http.get(`${BASE}/workbench`)
}

export function syncFromSqlrest(ws) {
  return http.post(`${BASE}/syncFromSqlrest${ws ? `?ws=${encodeURIComponent(ws)}` : ''}`, {})
}

export function registerDataapi(payload) {
  return http.post(`${BASE}/register`, payload)
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

export function fetchDataapiCallStats(days = 7) {
  return http.get(`${BASE}/callStats`, { days })
}

export function fetchDataapiOpenapi({ ws, id } = {}) {
  return http.get(`${BASE}/openapi.json`, { ws, id })
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

