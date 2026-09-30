/**
 * 数据契约 API（/lh/contract）
 */
import { http } from './http.js'
import { releaseIdempotencyKey, stickyIdempotencyKey } from './idempotency.js'
import { resolveWs } from '@/utils/ws'

const BASE = '/lh/contract'

export function fetchContractOverview(params = {}) {
  return http.get(`${BASE}/overview`, { ws: resolveWs(params.ws) })
}

export function fetchContractSchemas(params = {}) {
  return http.get(`${BASE}/schemas`, { ws: resolveWs(params.ws), q: params.q })
}

export function registerContractSchema(body = {}) {
  const fp = {
    ws: resolveWs(body.ws),
    name: body.name || body.topic,
    compat: body.compat,
    fields: body.fields || body.fieldsJson,
  }
  const key = body.idempotencyKey || stickyIdempotencyKey('contract_schema', fp)
  const payload = { ...body, ws: resolveWs(body.ws), idempotencyKey: key }
  return http
    .post(`${BASE}/schemas`, payload, { idempotencyKey: key })
    .then((data) => {
      releaseIdempotencyKey('contract_schema', fp)
      return data
    })
}

export function fetchSchemaVersions(name, params = {}) {
  return http.get(`${BASE}/schemas/${encodeURIComponent(name)}/versions`, { ws: resolveWs(params.ws) })
}

export function fetchContractChanges(params = {}) {
  return http.get(`${BASE}/changes`, { ws: resolveWs(params.ws), status: params.status })
}

export function createContractChange(body = {}) {
  const fp = {
    ws: resolveWs(body.ws),
    schemaName: body.schemaName || body.name || body.topic,
    title: body.title,
    changeSummary: body.changeSummary || body.summary,
  }
  const key = body.idempotencyKey || stickyIdempotencyKey('contract_change', fp)
  const payload = { ...body, ws: resolveWs(body.ws), idempotencyKey: key }
  return http
    .post(`${BASE}/changes`, payload, { idempotencyKey: key })
    .then((data) => {
      releaseIdempotencyKey('contract_change', fp)
      return data
    })
}

export function contractChangeAction(id, action, body = {}) {
  const q = new URLSearchParams({ action: String(action || '') }).toString()
  return http.post(`${BASE}/changes/${encodeURIComponent(id)}/action?${q}`, body || {})
}

export function checkContract(body) {
  return http.post(`${BASE}/check`, body)
}

export function fetchCdcConfig(topic, params = {}) {
  return http.get(`${BASE}/cdc-config/${encodeURIComponent(topic)}`, { ws: resolveWs(params.ws) })
}

export function putCdcConfig(topic, body, params = {}) {
  const ws = resolveWs(params.ws)
  const q = `?ws=${encodeURIComponent(ws)}`
  return http.put(`${BASE}/cdc-config/${encodeURIComponent(topic)}${q}`, body || {})
}
