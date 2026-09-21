/**
 * 指标中心 API（对齐 /lh/metric · doc/指标中心.md）
 */
import { http } from './http.js'

const M = '/lh/metric'

export function fetchMetricOverview(ws) {
  return http.get(`${M}/overview`, { ws })
}

export function fetchMetricList(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${M}/list`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    domain: filters.domain ?? filters.domainCode,
    kind: filters.kind ?? filters.type,
    status: filters.status,
    ws: filters.ws,
  })
}

export function fetchMetricDetail(code, ws) {
  return http.get(`${M}/${encodeURIComponent(code)}`, { ws })
}

export function createMetric(payload) {
  return http.post(`${M}`, toUpsertBody(payload))
}

export function updateMetric(code, payload) {
  return http.put(`${M}/${encodeURIComponent(code)}`, toUpsertBody({ ...payload, metricCode: code }))
}

export function transitionMetric(code, { action, note, ws } = {}) {
  return http.post(`${M}/${encodeURIComponent(code)}/transition`, {
    metricCode: code,
    action,
    note,
    ws,
  })
}

export function compileMetric(payload = {}) {
  return http.post(`${M}/compile`, payload)
}

export function queryMetric(payload = {}) {
  return http.post(`${M}/query`, payload)
}

export function trialMetric(code, payload = {}) {
  return http.post(`${M}/${encodeURIComponent(code)}/trial`, payload)
}

export function fetchMetricLineage(code, ws) {
  return http.get(`${M}/${encodeURIComponent(code)}/lineage`, { ws })
}

function toUpsertBody(payload = {}) {
  return {
    metricCode: payload.metricCode || payload.id,
    kind: payload.kind || payload.type,
    name: payload.name,
    domain: payload.domain || payload.domainCode || payload.domainLabel,
    unit: payload.unit,
    caliber: payload.caliber,
    owner: payload.owner,
    ws: payload.ws,
    remark: payload.remark,
    table: payload.table,
    field: payload.field,
    agg: payload.agg,
    gravAssetId: payload.gravAssetId,
    assetId: payload.assetId,
    atomRef: payload.atomRef,
    qualifier: Array.isArray(payload.qualifier)
      ? payload.qualifier
      : payload.qualifierKeys || undefined,
    dim: Array.isArray(payload.dim) ? payload.dim : payload.dimKeys || undefined,
    time: payload.time,
    deriveRef: Array.isArray(payload.deriveRef)
      ? payload.deriveRef
      : payload.depCodes || undefined,
    formula: payload.formula,
  }
}
