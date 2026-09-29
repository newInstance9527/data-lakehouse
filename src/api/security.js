/**
 * 安全中心运营台 API（/lh/sec）
 */
import { http } from './http.js'

const BASE = '/lh/sec'

export function fetchSecOverview(params = {}) {
  return http.get(`${BASE}/overview`, { ws: params.ws })
}

export function fetchSecGrants(params = {}) {
  return http.get(`${BASE}/grants`, {
    ws: params.ws,
    q: params.q,
    current: params.current || 1,
    size: params.size || 20,
  })
}

export function fetchSecMasks(params = {}) {
  return http.get(`${BASE}/masks`, {
    ws: params.ws,
    q: params.q,
    current: params.current || 1,
    size: params.size || 20,
  })
}

export function fetchSecClassification(params = {}) {
  return http.get(`${BASE}/classification`, { ws: params.ws })
}

export function fetchSecAudit(params = {}) {
  return http.get(`${BASE}/audit`, {
    ws: params.ws,
    q: params.q,
    current: params.current || 1,
    size: params.size || 20,
  })
}

export function fetchSecSa(params = {}) {
  return http.get(`${BASE}/sa`, { ws: params.ws })
}

export function registerSecSa(body) {
  return http.post(`${BASE}/sa`, body)
}

export function retireSecSa(id) {
  return http.post(`${BASE}/sa/retire`, { id })
}

export function fetchSecVaultHealth() {
  return http.get(`${BASE}/vault/health`)
}

/** 本地动态密轮换；数据源另置 binding stale。body: { vaultPath } */
export function rotateSecVault(body) {
  return http.post(`${BASE}/vault/rotate`, body)
}

export function fetchSecRouteWhitelist() {
  return http.get(`${BASE}/route-whitelist`)
}
