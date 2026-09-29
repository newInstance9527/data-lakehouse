/**
 * 数据域 SoT API（/lh/domain）
 */
import { http } from './http'

const BASE = '/lh/domain'

export function fetchDomainList({ ws, status, q } = {}) {
  return http.get(`${BASE}/list`, { ws, status, q })
}

export function fetchDomainOptions() {
  return http.get(`${BASE}/options`)
}

export function fetchDomainDetail(code) {
  return http.get(`${BASE}/${encodeURIComponent(code)}`)
}

export function fetchDomainUsage(code) {
  return http.get(`${BASE}/${encodeURIComponent(code)}/usage`)
}

export function createDomain(payload) {
  return http.post(BASE, payload)
}

export function updateDomain(code, payload) {
  return http.put(`${BASE}/${encodeURIComponent(code)}`, payload)
}

export function disableDomain(code) {
  return http.post(`${BASE}/${encodeURIComponent(code)}/disable`)
}

export function enableDomain(code) {
  return http.post(`${BASE}/${encodeURIComponent(code)}/enable`)
}

export function deleteDomain(code) {
  return http.post(`${BASE}/${encodeURIComponent(code)}/delete`)
}
