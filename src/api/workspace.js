/**
 * 工作空间 API（对齐 /lh/workspace/* · doc/工作空间.md）
 */
import { http } from './http'

const BASE = '/lh/workspace'

export function fetchWsOverview() {
  return http.get(`${BASE}/overview`)
}

export function fetchWsSpaces() {
  return http.get(`${BASE}/spaces`)
}

export function fetchWsDetail(code) {
  return http.get(`${BASE}/spaces/${encodeURIComponent(code)}`)
}

export function createWsSpace(payload) {
  return http.post(`${BASE}/spaces`, payload)
}

/** 删除空间（软删 status=archived；禁止 default / 最后活跃空间） */
export function deleteWsSpace(code) {
  return http.delete(`${BASE}/spaces/${encodeURIComponent(code)}`)
}

export function archiveWsSpace(code) {
  return http.post(`${BASE}/spaces/${encodeURIComponent(code)}/archive`)
}

export function fetchWsMembers(code) {
  return http.get(`${BASE}/spaces/${encodeURIComponent(code)}/members`)
}

export function replaceWsMembers(code, members) {
  return http.put(`${BASE}/spaces/${encodeURIComponent(code)}/members`, { members })
}

export function addWsMember(code, payload) {
  return http.post(`${BASE}/spaces/${encodeURIComponent(code)}/members`, payload)
}

export function removeWsMember(code, memberId) {
  return http.delete(`${BASE}/spaces/${encodeURIComponent(code)}/members/${encodeURIComponent(memberId)}`)
}

export function fetchWsQuota(code) {
  return http.get(`${BASE}/spaces/${encodeURIComponent(code)}/quota`)
}

/** 更新空间配额（Owner/超管）；AI 传 0 = 不限 */
export function updateWsQuota(code, payload) {
  return http.put(`${BASE}/spaces/${encodeURIComponent(code)}/quota`, payload)
}

export function fetchWsQuotas() {
  return http.get(`${BASE}/quotas`)
}

export function fetchWsCurrent() {
  return http.get(`${BASE}/current`)
}

/** @param {string} wsCode @param {{ confirmNonMember?: boolean }} [opts] */
export function setWsCurrent(wsCode, opts = {}) {
  const body = { wsCode }
  if (opts.confirmNonMember) body.confirmNonMember = true
  return http.put(`${BASE}/current`, body)
}

/** 配额水位告警（≥60% warn / ≥80% alert） */
export function fetchWsQuotaAlerts() {
  return http.get(`${BASE}/quota-alerts`)
}

export function syncWsGitRemote(code) {
  return http.post(`${BASE}/spaces/${encodeURIComponent(code)}/git-remote/sync`)
}

/** 追加空间展示标签（Owner/超管） */
export function addWsTag(code, payload) {
  return http.post(`${BASE}/spaces/${encodeURIComponent(code)}/tags`, payload)
}

/** 全量替换标签；tags=[] 清空 */
export function replaceWsTags(code, tags) {
  return http.put(`${BASE}/spaces/${encodeURIComponent(code)}/tags`, { tags })
}

/** 按文案移除一条标签 */
export function removeWsTag(code, text) {
  return http.delete(`${BASE}/spaces/${encodeURIComponent(code)}/tags`, { text })
}
