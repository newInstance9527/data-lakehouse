/**
 * BI 门户 API（Guest Token 内嵌看数 · OIDC 做表 · 无 AUTH_DB 裸深链）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

const B = '/lh/bi'

export function fetchBiStatus() {
  return http.get(`${B}/status`)
}

export function fetchBiProjection() {
  return http.get(`${B}/projection`)
}

export function projectBiDatasources(ids) {
  const body = (ids || []).filter(Boolean).map((id) => ({ id }))
  return http.post(`${B}/projectDatasources`, body)
}

export function publishMetricDataset({ metricCode, ver, ws, dsId, params } = {}) {
  return http.post(`${B}/publishMetricDataset`, {
    metricCode,
    ver,
    ws: resolveWs(ws),
    dsId,
    params: params || {},
  })
}

export function fetchBiDatasets(ws) {
  return http.get(`${B}/datasets`, { ws: resolveWs(ws) })
}

export function syncBiDashboards(ws) {
  return http.post(`${B}/syncDashboards?ws=${encodeURIComponent(resolveWs(ws))}`, {})
}

export function fetchBiDashboards(ws, { pinnedOnly } = {}) {
  return http.get(`${B}/dashboards`, {
    ws: resolveWs(ws),
    pinnedOnly: pinnedOnly ? true : undefined,
  })
}

export function pinBiDashboard({ id, pinned, metricCodes, ws } = {}) {
  return http.post(`${B}/pinDashboard`, {
    id,
    pinned,
    metricCodes,
    ws: resolveWs(ws),
  })
}

export function openBiDatasetWithDims({ id, metricCode, ws, filters, params } = {}) {
  return http.post(`${B}/openDatasetWithDims`, {
    id,
    metricCode,
    ws: resolveWs(ws),
    filters: filters || { dims: {} },
    params,
  })
}

/** Guest Token 内嵌会话（可带 filters.dims → urlParams；SDK 到期会再调本接口） */
export function fetchBiEmbedSession({ id, supersetDashboardId, ws, filters, params } = {}) {
  return http.post(`${B}/embedSession`, {
    id,
    supersetDashboardId,
    ws: resolveWs(ws),
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    filters: filters || undefined,
    params: params || undefined,
  })
}

/** OIDC 做表；未启用则 ok=false */
export function fetchBiAuthoringEntry({ kind = 'home', id } = {}) {
  return http.get(`${B}/authoringEntry`, { kind, id })
}
