/**
 * 出湖与回流运营台 API（/lh/export）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

const BASE = '/lh/export'

export function fetchExportSummary(params = {}) {
  return http.get(`${BASE}/summary`, { ws: resolveWs(params.ws) })
}

export function fetchExportJobs(params = {}) {
  return http.get(`${BASE}/jobs`, {
    ws: resolveWs(params.ws),
    status: params.status,
    q: params.q,
  })
}

export function fetchExportAudit(params = {}) {
  return http.get(`${BASE}/audit`, {
    ws: resolveWs(params.ws),
    ticketNo: params.ticketNo,
  })
}
