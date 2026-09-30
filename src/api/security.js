/**
 * 安全中心运营台 API（/lh/sec）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

const BASE = '/lh/sec'

export function fetchSecOverview(params = {}) {
  return http.get(`${BASE}/overview`, { ws: resolveWs(params.ws) })
}

export function fetchSecGrants(params = {}) {
  return http.get(`${BASE}/grants`, {
    ws: resolveWs(params.ws),
    q: params.q,
    current: params.current || 1,
    size: params.size || 20,
  })
}

export function fetchSecMasks(params = {}) {
  return http.get(`${BASE}/masks`, {
    ws: resolveWs(params.ws),
    q: params.q,
    current: params.current || 1,
    size: params.size || 20,
  })
}

export function fetchSecClassification(params = {}) {
  return http.get(`${BASE}/classification`, { ws: resolveWs(params.ws) })
}

export function fetchSecAudit(params = {}) {
  return http.get(`${BASE}/audit`, {
    ws: resolveWs(params.ws),
    q: params.q,
    current: params.current || 1,
    size: params.size || 20,
  })
}

export function fetchSecSa(params = {}) {
  return http.get(`${BASE}/sa`, { ws: resolveWs(params.ws) })
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

/** 当前登录用户的 Trino/Gravitino 主体映射 */
export function fetchPrincipalMe() {
  return http.get(`${BASE}/principals/me`)
}

/** 已映射人类主体列表（超管运维） */
export function fetchPrincipals() {
  return http.get(`${BASE}/principals`)
}

/**
 * 绑定门户用户 → Trino 人类主体（仅超管；禁止填服务账号 admin）
 * body: { portalUserId, portalAccount, trinoUser, remark? }
 */
export function bindPrincipal(body) {
  return http.post(`${BASE}/principals`, body)
}

/** 下发 impersonation rules（主体变更后） */
export function syncPrincipalImpersonation() {
  return http.post(`${BASE}/principals/impersonation-sync`, {})
}
