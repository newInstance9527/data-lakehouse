/**
 * 数据开发 / 发布 API
 */
import { http } from './http.js'

const C = '/lh/compute'

export function fetchScriptTree(ws) {
  return http.get(`${C}/scripts/tree`, { ws })
}

export function fetchScriptContent(id) {
  return http.get(`${C}/scripts/content`, { id })
}

export function createScript(body) {
  return http.post(`${C}/scripts`, body)
}

export function commitScript(body) {
  return http.post(`${C}/scripts/commit`, body)
}

export function runScript(body) {
  return http.post(`${C}/scripts/run-stg`, body)
}

export function fetchScriptRuns(scriptId) {
  return http.get(`${C}/scripts/runs`, { scriptId })
}

export function fetchScriptRun(runId) {
  return http.get(`${C}/scripts/runs/${encodeURIComponent(runId)}`)
}

export function fetchScriptKpis(ws) {
  return http.get(`${C}/scripts/kpis`, { ws })
}

export function fetchUdfs(engine) {
  return http.get(`${C}/udfs`, { engine })
}

export function fetchReleases(ws) {
  return http.get(`${C}/releases`, { ws })
}

export function createRelease(body) {
  return http.post(`${C}/releases`, body)
}

export function publishRelease(id) {
  return http.post(`${C}/releases/${id}/publish`, {})
}

export function rollbackRelease(id) {
  return http.post(`${C}/releases/${id}/rollback`, {})
}
