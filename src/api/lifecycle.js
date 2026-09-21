/**
 * 生命周期与小文件治理 API（对齐 /lh/lifecycle · doc/生命周期.md）
 */
import { http } from './http.js'

const L = '/lh/lifecycle'

export function fetchLcOverview(ws) {
  return http.get(`${L}/overview`, { ws })
}

export function fetchLcJobsLatest(ws) {
  return http.get(`${L}/jobs/latest`, { ws })
}

export function fetchLcTopStorage(ws, limit = 20) {
  return http.get(`${L}/top-storage`, { ws, limit })
}

export function fetchLcStats(table, ws) {
  return http.get(`${L}/stats`, { table, ws })
}

export function fetchLcPolicies(ws) {
  return http.get(`${L}/policies`, { ws })
}

export function fetchLcPolicy(table, ws) {
  return http.get(`${L}/policy`, { table, ws })
}

export function upsertLcPolicy(payload) {
  return http.put(`${L}/policies`, payload)
}

export function triggerLcCompact({ tableFqn, ws, remark } = {}) {
  return http.post(`${L}/compact`, { tableFqn, ws, remark })
}

export function triggerLcExpire({ tableFqn, ws, remark } = {}) {
  return http.post(`${L}/expire`, { tableFqn, ws, remark })
}

export function scanLcOrphan({ ws, bucket, dryRun = true } = {}) {
  return http.post(`${L}/orphan/scan`, { ws, bucket, dryRun })
}

export function runLcJobsNow({ ws, remark } = {}) {
  return http.post(`${L}/jobs/run-now`, { ws, remark })
}

export function fetchLcStorageTrend(ws, rangeOrDays = '30d') {
  const range =
    typeof rangeOrDays === 'number' ? `${rangeOrDays}d` : rangeOrDays || '30d'
  return http.get(`${L}/storage/trend`, { ws, range, group: 'layer' })
}

export function fetchLcStorageSummary(ws, range = '30d') {
  return http.get(`${L}/storage/summary`, { ws, range })
}

export function fetchLcStorageTables(params = {}) {
  return http.get(`${L}/storage/tables`, {
    ws: params.ws,
    range: params.range || '30d',
    layer: params.layer,
    filter: params.filter || 'all',
    sort: params.sort || 'reclaimableBytes',
    order: params.order || 'desc',
    page: params.page || 1,
    size: params.size || 50,
  })
}

export function fetchLcStorageTableDetail(fqtn, ws, range = '90d') {
  return http.get(`${L}/storage/tables/detail`, { fqtn, ws, range })
}

export function fetchLcStorageBuckets(ws) {
  return http.get(`${L}/storage/buckets`, { ws })
}

export function fetchLcStorageAdvice(ws) {
  return http.get(`${L}/storage/advice`, { ws })
}

export function fetchLcStorageShowback(ws, range = '30d', group = 'ws') {
  return http.get(`${L}/storage/showback`, { ws, range, group })
}

export function fetchLcRuns(filters = {}) {
  return http.get(`${L}/runs`, {
    ws: filters.ws,
    kind: filters.kind,
    tableFqn: filters.tableFqn,
    status: filters.status,
    current: filters.current,
    size: filters.size,
  })
}

export function syncLcRun(runId) {
  return http.post(`${L}/runs/sync?runId=${encodeURIComponent(runId)}`, {})
}
