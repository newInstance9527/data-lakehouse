/**
 * 出湖与回流运营台 API（/lh/export）
 */
import { http } from './http.js'

const BASE = '/lh/export'

export function fetchExportSummary(params = {}) {
  return http.get(`${BASE}/summary`, { ws: params.ws })
}

export function fetchExportJobs(params = {}) {
  return http.get(`${BASE}/jobs`, {
    ws: params.ws,
    status: params.status,
    q: params.q,
  })
}

export function fetchExportAudit(params = {}) {
  return http.get(`${BASE}/audit`, {
    ws: params.ws,
    ticketNo: params.ticketNo,
  })
}
