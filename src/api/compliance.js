/**
 * 合规删除 / 被遗忘权 API（对齐 /lh/compliance · doc/合规删除.md）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

const C = '/lh/compliance'

export function fetchDelSummary(ws) {
  return http.get(`${C}/summary`, { ws: resolveWs(ws) })
}

export function fetchDelRequests(filters = {}) {
  return http.get(`${C}/requests`, {
    ws: resolveWs(filters.ws),
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
  return http.post(`${C}/requests`, { ...payload, ws: resolveWs(payload?.ws) })
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

/** 二次授权下载证据包 ZIP：须回填 reqNo + 用途；写审计；返回 contentBase64 */
export function downloadDelEvidence({ reqId, confirmReqNo, reason } = {}) {
  return http.post(`${C}/evidence/download`, { reqId, confirmReqNo, reason })
}

/** 二次授权查看主体明文：须回填 reqNo + 用途；写审计 */
export function revealDelSubjectPlain({ reqId, confirmReqNo, reason } = {}) {
  return http.post(`${C}/subject-plain`, { reqId, confirmReqNo, reason })
}

export function fetchDelSubjectMaps({ ws, subjectType, carrier } = {}) {
  return http.get(`${C}/subject-maps`, { ws: resolveWs(ws), subjectType, carrier })
}

export function upsertDelSubjectMap(payload) {
  return http.put(`${C}/subject-maps`, { ...payload, ws: resolveWs(payload?.ws) })
}

export function fetchDelCoverage(ws) {
  return http.get(`${C}/coverage`, { ws: resolveWs(ws) })
}

/** E7：补数门禁预检 */
export function checkBackfillGate({ tables, markKey, markValue }) {
  return http.post(`${C}/gate/backfill-check`, { tables, markKey, markValue })
}

/** E7：出湖 restricted 预检 */
export function checkExportGate(exportTable) {
  return http.post(`${C}/gate/export-check`, { exportTable })
}

/** 抑制名单（ETL/CDC 拉取；仅 hash） */
export function fetchDelSuppressions({ ws, subjectIdHash, objectFqn, activeOnly = true } = {}) {
  return http.get(`${C}/suppression`, {
    ws: resolveWs(ws),
    subjectIdHash,
    objectFqn,
    activeOnly,
  })
}

/** 抑制名单登记 / 更新 */
export function upsertDelSuppression(payload) {
  return http.post(`${C}/suppression`, { ...payload, ws: resolveWs(payload?.ws) })
}

/**
 * 出湖回执：outcome = received | residual_statement | timeout_statement
 */
export function registerDelExportReceipt(payload) {
  return http.post(`${C}/export/receipt`, payload)
}

/** SLA 黄/红扫描推夜莺 */
export function scanDelSla(ws) {
  return http.post(`${C}/sla/scan`, {}, { params: { ws: resolveWs(ws) } })
}
