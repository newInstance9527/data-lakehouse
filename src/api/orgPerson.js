/**
 * 部门非系统人员 API（/lh/org/person）
 * 部门树本身走 sys.js 的 /sys/org/*
 */
import { http } from './http.js'

const BASE = '/lh/org/person'

export function listOrgPersons(orgId, kw, includeChild = true) {
  return http.get(BASE, { orgId, kw, includeChild })
}

export function addOrgPerson(body) {
  return http.post(BASE, body)
}

export function editOrgPerson(id, body) {
  return http.put(`${BASE}/${encodeURIComponent(id)}`, body)
}

export function deleteOrgPerson(id) {
  return http.delete(`${BASE}/${encodeURIComponent(id)}`)
}
