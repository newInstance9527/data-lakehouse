/**
 * 字段血缘 API（对齐 /lh/lineage）
 */
import { http } from './http.js'

const L = '/lh/lineage'

export function fetchLineageGraph(params = {}) {
  return http.get(`${L}/graph`, {
    node: params.node,
    focus: params.focus,
    omFqn: params.omFqn,
    upDepth: params.upDepth,
    downDepth: params.downDepth,
    ws: params.ws,
  })
}

export function fetchLineageImpact(params = {}) {
  return http.get(`${L}/impact`, {
    node: params.node,
    focus: params.focus,
    omFqn: params.omFqn,
    upDepth: params.upDepth,
    downDepth: params.downDepth,
    ws: params.ws,
  })
}

export function fetchLineageFields(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${L}/fields`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    focusTable: filters.focusTable,
    focusField: filters.focusField,
    ws: filters.ws,
  })
}

export function syncLineageFields(params = {}) {
  const qs = new URLSearchParams()
  if (params.ws) qs.set('ws', params.ws)
  if (params.etlJobId) qs.set('etlJobId', params.etlJobId)
  const q = qs.toString()
  return http.post(`${L}/fields/sync${q ? `?${q}` : ''}`, {})
}

export function fetchLineageSyncStatus(params = {}) {
  return http.get(`${L}/fields/sync/status`, { ws: params.ws })
}

export function fetchMarquezNamespaces() {
  return http.get(`${L}/marquez/namespaces`)
}

export function postChangeEval(payload = {}) {
  return http.post(`${L}/change-eval`, {
    table: payload.table,
    field: payload.field,
    toType: payload.toType,
    ws: payload.ws,
  })
}

export function postBlockDdl(payload = {}) {
  return http.post(`${L}/block-ddl`, {
    table: payload.table,
    field: payload.field,
    reason: payload.reason,
    ws: payload.ws,
  })
}
