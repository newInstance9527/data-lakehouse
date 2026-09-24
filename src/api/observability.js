/**
 * 可观测用量 / 成本 / 链路 span（§24.3 · §29）
 */
import { http } from './http'

const BASE = '/lh/observability'

/** 成本卡：默认 group=ws；可选 ws / range */
export function fetchObsCosts({ range = '30d', group = 'ws', ws } = {}) {
  return http.get(`${BASE}/costs`, { range, group, ws })
}

/** 用量聚合（与 costs 同源） */
export function fetchObsUsage({ range = '30d', group = 'ws', ws } = {}) {
  return http.get(`${BASE}/usage`, { range, group, ws })
}

export function fetchObsLinksOverview({ ws } = {}) {
  return http.get(`${BASE}/links/overview`, { ws })
}

export function fetchObsSpans(params = {}) {
  return http.get(`${BASE}/spans`, {
    ws: params.ws,
    linkId: params.linkId,
    traceId: params.traceId,
    runId: params.runId,
    eventId: params.eventId,
    status: params.status,
    current: params.current || 1,
    size: params.size || 50,
  })
}

export function fetchObsTrace(traceId, { ws } = {}) {
  return http.get(`${BASE}/traces/${encodeURIComponent(traceId)}`, { ws })
}

export function fetchObsLogs(params = {}) {
  return http.get(`${BASE}/logs/search`, {
    ws: params.ws,
    q: params.q,
    traceId: params.traceId,
    runId: params.runId,
    eventId: params.eventId,
    current: params.current || 1,
    size: params.size || 50,
  })
}

export function fetchObsSpanError(spanId, { ws } = {}) {
  return http.get(`${BASE}/spans/${encodeURIComponent(spanId)}/error`, { ws })
}
