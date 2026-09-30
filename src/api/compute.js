/**
 * 数据开发 / 发布 API
 */
import { http } from './http.js'
import { releaseIdempotencyKey, stickyIdempotencyKey } from './idempotency.js'
import { resolveWs } from '@/utils/ws'

const C = '/lh/compute'

export function fetchScriptTree(ws) {
  return http.get(`${C}/scripts/tree`, { ws: resolveWs(ws) })
}

export function fetchScriptContent(id) {
  return http.get(`${C}/scripts/content`, { id })
}

export function createScript(body) {
  return http.post(`${C}/scripts`, { ...body, ws: resolveWs(body?.ws) })
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
  return http.get(`${C}/releases`, { ws: resolveWs(ws) })
}

export function createRelease(body = {}) {
  const fp = {
    scriptId: body.scriptId,
    ws: resolveWs(body.ws),
    engine: body.engine,
    env: body.env,
  }
  const key = body.idempotencyKey || stickyIdempotencyKey('release_create', fp)
  const payload = { ...body, ws: resolveWs(body.ws), idempotencyKey: key }
  return http
    .post(`${C}/releases`, payload, { idempotencyKey: key })
    .then((data) => {
      releaseIdempotencyKey('release_create', fp)
      return data
    })
}

/** 提交上版前门禁预检（不生成发布单） */
export function fetchReleasePrecheck({ scriptId, engine, env } = {}) {
  return http.get(`${C}/scripts/release-precheck`, { scriptId, engine, env })
}

export function publishRelease(id) {
  const releaseId = String(id || '')
  const key = stickyIdempotencyKey('release_publish', releaseId)
  return http
    .post(`${C}/releases/${releaseId}/publish`, {}, { idempotencyKey: key })
    .then((data) => {
      releaseIdempotencyKey('release_publish', releaseId)
      return data
    })
}

export function fetchReleaseGates(id) {
  return http.get(`${C}/releases/${id}/gates`)
}

export function rollbackRelease(id) {
  return http.post(`${C}/releases/${id}/rollback`, {})
}
