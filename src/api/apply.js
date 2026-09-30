import { http } from './http'
import { releaseIdempotencyKey, stickyIdempotencyKey } from './idempotency'
import { resolveWs } from '@/utils/ws'

const BASE = '/lh/apply'

function applyFingerprint(payload = {}) {
  return {
    ticketType: payload.ticketType,
    title: payload.title,
    reason: payload.reason,
    assetId: payload.assetId,
    privilege: payload.privilege,
    expireLabel: payload.expireLabel,
    exportTable: payload.exportTable,
    exportTarget: payload.exportTarget,
    resourceType: payload.resourceType,
    resourceId: payload.resourceId,
    scriptId: payload.scriptId,
    apiBindingId: payload.apiBindingId,
    metricCode: payload.metricCode,
    metricKind: payload.metricKind,
    reqNo: payload.reqNo,
  }
}

/** 提交表级读权限申请（同指纹短时复用 Idempotency-Key） */
export function createApplyTicket(payload) {
  const fp = applyFingerprint(payload)
  const key = payload?.idempotencyKey || stickyIdempotencyKey('apply_ticket', fp)
  const body = { ...payload, idempotencyKey: key }
  return http
    .post(`${BASE}/tickets`, body, { idempotencyKey: key })
    .then((data) => {
      releaseIdempotencyKey('apply_ticket', fp)
      return data
    })
}

/** 我的申请分页 */
export function pageMyTickets(params) {
  return http.get(`${BASE}/tickets`, params)
}

/** 待审批分页（超管/审批人） */
export function pagePendingTickets(params) {
  return http.get(`${BASE}/tickets/pending`, params)
}

/** 看板 KPI：待我审批 / 我申请的 / 本月通过 / 本月驳回 */
export function fetchApplyKpi(params = {}) {
  return http.get(`${BASE}/kpi`, { ws: resolveWs(params.ws) })
}

/** 通过申请 → 写 sec_auth_grant（门户 SoT；不投影 Grav） */
export function approveTicket(id, remark) {
  return http.post(`${BASE}/tickets/approve`, { id, remark })
}

/** 驳回 */
export function rejectTicket(id, remark) {
  return http.post(`${BASE}/tickets/reject`, { id, remark })
}
