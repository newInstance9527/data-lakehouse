/**
 * 指标中心 API（对齐 /lh/metric · doc/指标中心.md）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

const M = '/lh/metric'

export function fetchMetricOverview(ws) {
  return http.get(`${M}/overview`, { ws: resolveWs(ws) })
}

export function fetchMetricList(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${M}/list`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    domain: filters.domain ?? filters.domainCode,
    kind: filters.kind ?? filters.type,
    status: filters.status,
    ws: resolveWs(filters.ws),
    scope: filters.scope || 'workspace',
  })
}

export function fetchMetricDetail(code, ws) {
  return http.get(`${M}/${encodeURIComponent(code)}`, { ws: resolveWs(ws) })
}

export function createMetric(payload) {
  return http.post(`${M}`, toUpsertBody(payload))
}

export function updateMetric(code, payload) {
  return http.put(`${M}/${encodeURIComponent(code)}`, toUpsertBody({ ...payload, metricCode: code }))
}

export function deleteMetric(code, ws) {
  return http.delete(`${M}/${encodeURIComponent(code)}`, { ws: resolveWs(ws) })
}

export function transitionMetric(code, { action, note, ws } = {}) {
  return http.post(`${M}/${encodeURIComponent(code)}/transition`, {
    metricCode: code,
    action,
    note,
    ws: resolveWs(ws),
  })
}

export function compileMetric(payload = {}) {
  return http.post(`${M}/compile`, { ...payload, ws: resolveWs(payload.ws) })
}

export function queryMetric(payload = {}) {
  return http.post(`${M}/query`, { ...payload, ws: resolveWs(payload.ws) })
}

export function trialMetric(code, payload = {}) {
  return http.post(`${M}/${encodeURIComponent(code)}/trial`, {
    ...payload,
    ws: resolveWs(payload.ws),
  })
}

export function fetchMetricLineage(code, ws) {
  return http.get(`${M}/${encodeURIComponent(code)}/lineage`, { ws: resolveWs(ws) })
}

export function fetchMetricAnomaly(code, { ws, days } = {}) {
  return http.get(`${M}/${encodeURIComponent(code)}/anomaly`, { ws: resolveWs(ws), days })
}

export function rerunMetricSample(ws) {
  return http.post(`${M}/anomaly/rerun`, null, { params: { ws: resolveWs(ws) } })
}

export function fetchMetricBoard(ws) {
  return http.get(`${M}/board`, { ws: resolveWs(ws) })
}

export function fetchMetricMaterialize(code, ws) {
  return http.get(`${M}/${encodeURIComponent(code)}/materialize`, { ws: resolveWs(ws) })
}

export function materializeMetric(code, payload = {}) {
  return http.post(`${M}/${encodeURIComponent(code)}/materialize`, {
    ...payload,
    ws: resolveWs(payload.ws),
  })
}

export function fetchReconPartition({ metricCode, status, limit } = {}) {
  return http.get('/lh/recon/partition', { metricCode, status, limit })
}

export function runReconPartition(payload = {}) {
  return http.post('/lh/recon/partition/run', payload)
}

export function fetchReconRules({ ws, ruleType, enabled } = {}) {
  return http.get('/lh/recon/rules', { ws: resolveWs(ws), ruleType, enabled })
}

export function upsertReconRule(payload = {}) {
  return http.post('/lh/recon/rules', payload)
}

export function deleteReconRule(id) {
  return http.post('/lh/recon/rules/delete', { id })
}

export function fetchReconDiff({ ws, lakeTable, table, partitionKey, dt, ruleId, limit } = {}) {
  return http.get('/lh/recon/diff', {
    ws: resolveWs(ws),
    lakeTable: lakeTable || table,
    partitionKey: partitionKey || dt,
    ruleId,
    limit,
  })
}

export function recordReconDiff(payload = {}) {
  return http.post('/lh/recon/diff', payload)
}

export function postReconGolden(action, payload = {}) {
  const act = action || payload.action
  if (act) {
    return http.post(`/lh/recon/golden/${encodeURIComponent(act)}`, payload)
  }
  return http.post('/lh/recon/golden', payload)
}

export function rewriteCk(table, payload = {}) {
  return http.post(`/lh/recon/${encodeURIComponent(table)}/rewrite-ck`, payload)
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
    ws: resolveWs(payload.ws),
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
