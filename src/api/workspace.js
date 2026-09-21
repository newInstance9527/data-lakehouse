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

export function fetchWsQuotas() {
  return http.get(`${BASE}/quotas`)
}

export function fetchWsCurrent() {
  return http.get(`${BASE}/current`)
}

export function setWsCurrent(wsCode) {
  return http.put(`${BASE}/current`, { wsCode })
}
