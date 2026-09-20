/**
 * 数据服务 API（对齐 /lh/dataapi · SQLREST + APISIX）
 */
import { http } from './http.js'

const BASE = '/lh/dataapi'

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

export function publishDataapi(id, ws) {
  return http.post(`${BASE}/publish`, { id, ws })
}

export function retireDataapi(id, ws) {
  return http.post(`${BASE}/retire`, { id, ws })
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
