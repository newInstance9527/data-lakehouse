/**
 * 合规删除 / 被遗忘权 API（对齐 /lh/compliance · doc/合规删除.md）
 */
import { http } from './http.js'

const C = '/lh/compliance'

export function fetchDelSummary(ws) {
  return http.get(`${C}/summary`, { ws })
}

export function fetchDelRequests(filters = {}) {
  return http.get(`${C}/requests`, {
    ws: filters.ws,
    status: filters.status,
    reqType: filters.reqType,
    kw: filters.kw,
    current: filters.current,
    size: filters.size,
  })
}

export function fetchDelRequest(reqId) {
  return http.get(`${C}/request`, { reqId })
}

export function createDelRequest(payload) {
  return http.post(`${C}/requests`, payload)
}

export function assessDelRequest(reqId) {
  return http.post(`${C}/assess`, { reqId })
}

export function editDelPlan(payload) {
  return http.put(`${C}/plan`, payload)
}

export function dryRunDelRequest(reqId) {
  return http.post(`${C}/dry-run`, { reqId })
}

export function submitDelRequest(reqId) {
  return http.post(`${C}/submit`, { reqId })
}

export function scheduleDelRequest(reqId, execWindow) {
  return http.post(`${C}/schedule`, { reqId, execWindow })
}

export function executeDelRequest({ reqId, confirmReqNo, execKey, urgent } = {}) {
  return http.post(`${C}/execute`, { reqId, confirmReqNo, execKey, urgent })
}

export function verifyDelRequest(reqId) {
  return http.post(`${C}/verify`, { reqId })
}

export function restrictDelRequest({ reqId, targetIds, reason, reviewAt } = {}) {
  return http.post(`${C}/restrict`, { reqId, targetIds, reason, reviewAt })
}

export function holdDelRequest({ reqId, reason, scope, holdUntil, source } = {}) {
  return http.post(`${C}/hold`, { reqId, reason, scope, holdUntil, source })
}

export function releaseDelHold({ reqId, reason } = {}) {
  return http.post(`${C}/hold/release`, { reqId, reason })
}

export function abortDelRequest({ reqId, remark } = {}) {
  return http.post(`${C}/abort`, { reqId, remark })
}

export function fetchDelEvidence(reqId) {
  return http.get(`${C}/evidence`, { reqId })
}

export function fetchDelSubjectMaps({ ws, subjectType, carrier } = {}) {
  return http.get(`${C}/subject-maps`, { ws, subjectType, carrier })
}

export function upsertDelSubjectMap(payload) {
  return http.put(`${C}/subject-maps`, payload)
}

export function fetchDelCoverage(ws) {
  return http.get(`${C}/coverage`, { ws })
}
