/**
 * 数据质量 API（对齐 /lh/quality）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

const Q = '/lh/quality'

export function fetchQualityOverview(params = {}) {
  return http.get(`${Q}/overview`, { ws: resolveWs(params.ws), range: params.range })
}

export function fetchQualityTrend(params = {}) {
  return http.get(`${Q}/trend`, { ws: resolveWs(params.ws), range: params.range })
}

export function fetchQualityTypeDist(params = {}) {
  return http.get(`${Q}/type-dist`, { ws: resolveWs(params.ws) })
}

export function fetchQualityGold(params = {}) {
  return http.get(`${Q}/gold`, { ws: resolveWs(params.ws), limit: params.limit ?? 5 })
}

export function fetchQualityRules(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${Q}/rules`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    layer: filters.layer,
    status: filters.status,
    range: filters.range,
    ws: resolveWs(filters.ws),
  })
}

/** 对齐 GovDqRuleUpsertParam */
export function upsertQualityRule(payload) {
  return http.post(`${Q}/rules`, {
    id: payload.id,
    ws: resolveWs(payload.ws),
    ruleCode: payload.ruleCode || payload.name,
    ruleType: payload.ruleType || payload.rtype || payload.type,
    ruleLevel: payload.ruleLevel || payload.level,
    scope: payload.scope || (payload.field ? 'field' : 'table'),
    tableName: payload.tableName || payload.table,
    assetId: payload.assetId,
    fieldName: payload.fieldName ?? payload.field ?? '',
    layer: payload.layer,
    exprText: payload.exprText || payload.expr,
    severity: payload.severity || payload.sev,
    enabled: payload.enabled,
    omTestFqn: payload.omTestFqn,
    stdCodeSetId: payload.stdCodeSetId,
    remark: payload.remark,
  })
}

export function deleteQualityRule(id) {
  return http.post(`${Q}/rules/delete`, { id })
}

export function createQualityTicket(payload = {}) {
  return http.post(`${Q}/tickets`, {
    ruleId: payload.ruleId,
    remark: payload.remark,
  })
}

/** OM Profiler/Test 水位 + soft-fail 投影（ws 走 query，对齐 Controller @RequestParam） */
export function syncQualityOm(params = {}) {
  return http.post(`${Q}/sync-om`, null, { params: { ws: resolveWs(params.ws) } })
}

/** Flink 流式探针 → VM lh_dq_stream_* */
export function postStreamProbe(payload = {}) {
  return http.post(`${Q}/rules/stream-probe`, payload)
}

export function fetchQualityGates(params = {}) {
  return http.get(`${Q}/gates`, { ws: resolveWs(params.ws) })
}

export function upsertQualityGate(payload = {}) {
  return http.put(`${Q}/gates`, {
    id: payload.id,
    ws: resolveWs(payload.ws),
    assetId: payload.assetId || '',
    // 显式传空串，后端 blank→null（整层门禁）；勿省略字段导致更新不清空
    tableName: payload.tableName != null ? payload.tableName : payload.table || '',
    layer: payload.layer || '',
    minScore: payload.minScore,
    blockOnFail: payload.blockOnFail,
  })
}

export function deleteQualityGate(id) {
  return http.post(`${Q}/gates/delete`, { id })
}

export function fetchQualityRuns(ruleId, params = {}) {
  return http.get(`${Q}/rules/runs`, {
    ruleId,
    ws: resolveWs(params.ws),
    current: params.current ?? 1,
    size: params.size ?? 20,
  })
}
