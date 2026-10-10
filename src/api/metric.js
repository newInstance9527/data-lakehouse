/**
 * 指标中心 API（对齐 /lh/metric · doc/指标中心.md）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'
import { parseMetricFormula } from '@/data/metrics'

const M = '/lh/metric'

export function fetchMetricOverview(ws) {
  return http.get(`${M}/overview`, { ws: resolveWs(ws) })
}

/** filters.dims ≡ params.dims；省略维键 = 不切片；数组=多选 IN */
export function filtersToQueryParams(filters = {}) {
  const dims =
    filters?.dims && typeof filters.dims === 'object' && !Array.isArray(filters.dims)
      ? Object.fromEntries(
          Object.entries(filters.dims)
            .map(([k, v]) => {
              if (!k || v == null) return null
              if (Array.isArray(v)) {
                const list = v.map((x) => String(x).trim()).filter(Boolean)
                if (!list.length) return null
                return [k, list.length === 1 ? list[0] : list]
              }
              const s = String(v).trim()
              if (!s) return null
              return [k, s]
            })
            .filter(Boolean),
        )
      : {}
  const params = {}
  if (Object.keys(dims).length) params.dims = dims
  return params
}

/** 就绪指标按维查询（仅 ready 卡执行） */
export function queryMetricBoard({ ws, prefer, filters, maxRows } = {}) {
  return http.post(`${M}/board/query`, {
    ws: resolveWs(ws),
    prefer: prefer || 'trino',
    filters: filters || { dims: {} },
    maxRows: maxRows ?? 20,
  })
}

export function fetchMetricList(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${M}/list`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    domain: filters.domain ?? filters.domainCode,
    tag: filters.tag,
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

/** 指标试跑/查询执行审计（无历史行集） */
export function fetchMetricExecs(code, { ws, limit } = {}) {
  return http.get(`${M}/${encodeURIComponent(code)}/execs`, {
    ws: resolveWs(ws),
    limit: limit ?? 20,
  })
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

export function fetchMetricQualifiers(filters = {}) {
  return http.get(`${M}/qualifiers`, {
    ws: resolveWs(filters.ws),
    status: filters.status,
    domain: filters.domain,
    q: filters.q,
  })
}

export function fetchMetricQualifierOptions({ ws, domain, table } = {}) {
  return http.get(`${M}/qualifiers/options`, {
    ws: resolveWs(ws),
    domain,
    table,
  })
}

export function createMetricQualifier(payload) {
  return http.post(`${M}/qualifiers`, { ...payload, ws: resolveWs(payload.ws) })
}

export function updateMetricQualifier(code, payload) {
  return http.put(`${M}/qualifiers/${encodeURIComponent(code)}`, {
    ...payload,
    code,
    ws: resolveWs(payload.ws),
  })
}

export function disableMetricQualifier(code, ws) {
  return http.post(`${M}/qualifiers/${encodeURIComponent(code)}/disable`, null, {
    params: { ws: resolveWs(ws) },
  })
}

export function fetchMetricDims(filters = {}) {
  return http.get(`${M}/dims`, {
    ws: resolveWs(filters.ws),
    status: filters.status,
    domain: filters.domain,
    q: filters.q,
  })
}

export function fetchMetricDimOptions({ ws, domain } = {}) {
  return http.get(`${M}/dims/options`, { ws: resolveWs(ws), domain })
}

export function createMetricDim(payload) {
  return http.post(`${M}/dims`, { ...payload, ws: resolveWs(payload.ws) })
}

export function updateMetricDim(code, payload) {
  return http.put(`${M}/dims/${encodeURIComponent(code)}`, {
    ...payload,
    code,
    ws: resolveWs(payload.ws),
  })
}

export function disableMetricDim(code, ws) {
  return http.post(`${M}/dims/${encodeURIComponent(code)}/disable`, null, {
    params: { ws: resolveWs(ws) },
  })
}

/** DIM 层成员（湖表权威）；不切片时试算侧不传该维 */
export function fetchMetricDimMembers(code, { ws, q, limit } = {}) {
  return http.get(`${M}/dims/${encodeURIComponent(code)}/members`, {
    ws: resolveWs(ws),
    q,
    limit: limit ?? 200,
  })
}

function toUpsertBody(payload = {}) {
  return {
    metricCode: payload.metricCode || payload.id,
    kind: payload.kind || payload.type,
    name: payload.name,
    domain: payload.domain || payload.domainCode || payload.domainLabel,
    unit: payload.unit,
    valueType: payload.valueType,
    valuePrecision:
      payload.valuePrecision === '' || payload.valuePrecision == null
        ? undefined
        : Number(payload.valuePrecision),
    tags: Array.isArray(payload.tags)
      ? payload.tags
      : typeof payload.tags === 'string' && payload.tags.trim()
        ? payload.tags.split(/[,，\s]+/).filter(Boolean)
        : undefined,
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
    deriveRef: (() => {
      const kind = payload.kind || payload.type
      if (kind === '复合' && payload.formula) {
        const parsed = parseMetricFormula(payload.formula)
        if (parsed?.refs?.length) return parsed.refs
      }
      return Array.isArray(payload.deriveRef)
        ? payload.deriveRef
        : payload.depCodes || undefined
    })(),
    formula: payload.formula,
  }
}
