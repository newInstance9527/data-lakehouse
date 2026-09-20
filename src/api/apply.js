import { http } from './http'

const BASE = '/lh/apply'

/** 提交表级读权限申请 */
export function createApplyTicket(payload) {
  return http.post(`${BASE}/tickets`, payload)
}

/** 我的申请分页 */
export function pageMyTickets(params) {
  return http.get(`${BASE}/tickets`, params)
}

/** 待审批分页（超管/审批人） */
export function pagePendingTickets(params) {
  return http.get(`${BASE}/tickets/pending`, params)
}

/** 通过申请 → 写 sec_auth_grant + 可选 Grav ACL */
export function approveTicket(id, remark) {
  return http.post(`${BASE}/tickets/approve`, { id, remark })
}

/** 驳回 */
export function rejectTicket(id, remark) {
  return http.post(`${BASE}/tickets/reject`, { id, remark })
}
