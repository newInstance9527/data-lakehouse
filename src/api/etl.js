/**
 * ETL 编排 API（对齐 /lh/etl · doc/ETL编排.md）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

const E = '/lh/etl'

export function fetchEtlDags(filters = {}, { current = 1, size = 100 } = {}) {
  return http.get(`${E}/dags`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    status: filters.status,
    ws: resolveWs(filters.ws),
    scope: filters.scope,
  })
}

export function createEtlDag(payload) {
  return http.post(`${E}/dags`, {
    ws: resolveWs(payload.ws),
    dagCode: payload.dagCode || payload.name,
    name: payload.name || payload.dagCode,
    description: payload.description ?? payload.desc,
    cron: payload.cron,
    owner: payload.owner,
    defaultEngine: payload.defaultEngine || payload.engine,
    sla: payload.sla,
    env: payload.env,
  })
}

export function fetchEtlDagDetail(id) {
  return http.get(`${E}/dags/detail`, { id })
}

export function editEtlDag(payload) {
  return http.post(`${E}/dags/edit`, {
    id: payload.id,
    name: payload.name,
    description: payload.description ?? payload.desc,
    cron: payload.cron,
    owner: payload.owner,
    defaultEngine: payload.defaultEngine || payload.engine,
    sla: payload.sla,
    env: payload.env,
    status: payload.status,
  })
}

/** 软删 DAG（运行中后端拦截；可先 stopRun） */
export function deleteEtlDag(id) {
  return http.post(`${E}/dags/delete`, { id })
}

export function fetchEtlGraph(id) {
  return http.get(`${E}/dags/graph`, { id })
}

/** nodes: [{id,type,name,meta,x,y,conf}] edges: [{from,to,label}] */
export function saveEtlGraph(id, { nodes, edges }) {
  return http.post(`${E}/dags/graph`, { id, nodes, edges })
}

export function updateEtlNodeConfig(payload) {
  return http.put(`${E}/dags/nodes/config`, {
    dagId: payload.dagId,
    nodeKey: payload.nodeKey || payload.id,
    name: payload.name,
    meta: payload.meta,
    conf: payload.conf,
  })
}

export function validateEtlDag(id) {
  return http.post(`${E}/dags/validate`, { id })
}

export function trialEtlDag(id, env = 'stg') {
  return http.post(`${E}/dags/trial`, { id, env })
}

export function deployEtlDag(id, gitRef) {
  return http.post(`${E}/dags/deploy`, { id, gitRef })
}

/** 补数：mark_key / mark_value → DS 实例 + 水位；命中已删分区须 confirmReqNo */
export function backfillEtlDag(id, { markKey, markValue, env, confirmReqNo } = {}) {
  return http.post(`${E}/dags/backfill`, {
    id,
    markKey,
    markValue,
    env,
    confirmReqNo,
  })
}

export function fetchEtlRuns({ dagId, ws, current = 1, size = 50 } = {}) {
  return http.get(`${E}/dags/runs`, { dagId, ws: resolveWs(ws), current, size })
}

export function fetchEtlRunDetail(runId) {
  return http.get(`${E}/dags/runs/detail`, { runId })
}

/** 终止运行中实例（DS STOP + 门户 cancelled） */
export function stopEtlRun(runId) {
  return http.post(`${E}/dags/runs/stop`, { runId })
}

/** 单节点 DS 实时日志；skipLineNum 续拉，limit 默认 1000 */
export function fetchEtlRunNodeLog(runId, nodeKey, { skipLineNum = 0, limit = 1000 } = {}) {
  return http.get(`${E}/dags/runs/node-log`, { runId, nodeKey, skipLineNum, limit })
}

/** 试跑成功后预览 sink 目标表样本；limit 默认 20，上限 50 */
export function fetchEtlRunResultPreview(runId, nodeKey, { limit = 20 } = {}) {
  return http.get(`${E}/dags/runs/resultPreview`, { runId, nodeKey, limit })
}

export function resolveEtlEngine(payload) {
  return http.post(`${E}/engine/resolve`, {
    nodeType: payload.nodeType || payload.type,
    conf: payload.conf,
    confJson: payload.confJson,
  })
}

export function fetchEtlNodeTypes() {
  return http.get(`${E}/meta/node-types`)
}
