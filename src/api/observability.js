/**
 * 可观测用量 / 成本 / 链路 span / 任务运维 / 根因 / Trino（§12 · §24.3 · §29）
 */
import { http } from './http'
import { resolveWs } from '@/utils/ws'

const BASE = '/lh/observability'

/** 成本卡：默认 group=ws；可选 ws / range */
export function fetchObsCosts({ range = '30d', group = 'ws', ws } = {}) {
  return http.get(`${BASE}/costs`, { range, group, ws: resolveWs(ws) })
}

/** 用量聚合（与 costs 同源） */
export function fetchObsUsage({ range = '30d', group = 'ws', ws } = {}) {
  return http.get(`${BASE}/usage`, { range, group, ws: resolveWs(ws) })
}

export function fetchObsLinksOverview({ ws } = {}) {
  return http.get(`${BASE}/links/overview`, { ws: resolveWs(ws) })
}

export function fetchObsSpans(params = {}) {
  return http.get(`${BASE}/spans`, {
    ws: resolveWs(params.ws),
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
  return http.get(`${BASE}/traces/${encodeURIComponent(traceId)}`, { ws: resolveWs(ws) })
}

export function fetchObsLogs(params = {}) {
  return http.get(`${BASE}/logs/search`, {
    ws: resolveWs(params.ws),
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

export function ingestObsSpans(body = {}) {
  return http.post(`${BASE}/spans/ingest`, body)
}

/** 基础设施摘要（无采集 source=empty） */
export function fetchObsInfraSummary({ ws } = {}) {
  return http.get(`${BASE}/infra/summary`, { ws })
}

export function fetchObsInfraNodes({ ws } = {}) {
  return http.get(`${BASE}/infra/nodes`, { ws })
}

export function fetchObsInfraProcs({ ws } = {}) {
  return http.get(`${BASE}/infra/procs`, { ws })
}

export function fetchObsInfraAlerts({ ws } = {}) {
  return http.get(`${BASE}/infra/alerts`, { ws })
}

export function fetchObsInfraContainers({ ws } = {}) {
  return http.get(`${BASE}/infra/containers`, { ws })
}

export function fetchObsInfraCluster({ ws } = {}) {
  return http.get(`${BASE}/infra/cluster`, { ws })
}

export function fetchObsInfraCapacityForecast({ ws } = {}) {
  return http.get(`${BASE}/infra/capacity-forecast`, { ws })
}

/** 根因告警焦点 */
export function fetchObsRootcauseAlerts({ ws } = {}) {
  return http.get(`${BASE}/rootcause/alerts`, { ws })
}

/** 根因编排（无证据空态） */
export function postObsRootcauseAnalyze(body = {}) {
  return http.post(`${BASE}/rootcause/analyze`, body)
}

export function postObsRootcauseConclusion(body = {}) {
  return http.post(`${BASE}/rootcause/conclusion`, body)
}

export function postObsRootcauseRemediate(body = {}) {
  return http.post(`${BASE}/rootcause/remediate`, body)
}

/** 任务运维门面 */
export function fetchObsTasks({ group = 'all', ws } = {}) {
  return http.get(`${BASE}/tasks`, { group, ws })
}

export function postObsTaskAction(id, body = {}) {
  return http.post(`${BASE}/tasks/${encodeURIComponent(id)}/action`, body)
}

export function postObsRerunDownstream(id, body = {}) {
  return http.post(`${BASE}/tasks/${encodeURIComponent(id)}/rerun-downstream`, body)
}

export function fetchObsSlaSummary({ ws } = {}) {
  return http.get(`${BASE}/sla/summary`, { ws })
}

/** Trino 门面 */
export function fetchObsTrinoQueues({ ws } = {}) {
  return http.get(`${BASE}/trino/queues`, { ws })
}

export function fetchObsTrinoTopUsers({ ws, range = '30d' } = {}) {
  return http.get(`${BASE}/trino/top-users`, { ws, range })
}

export function fetchObsTrinoSlow({ ws, range = '30d', limit = 20 } = {}) {
  return http.get(`${BASE}/trino/slow`, { ws, range, limit })
}
