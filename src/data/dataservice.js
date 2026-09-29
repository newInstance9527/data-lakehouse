/** 数据服务 · SQLREST 嵌入默认与网关路由状态 meta（列表走 /lh/dataapi） */

export const SQLREST_MANAGER_URL = 'http://dev3.datagoo.cn:18090'
export const SQLREST_GATEWAY_URL = 'http://dev3.datagoo.cn:18091'

export function defaultSqlrestEmbed(root = SQLREST_MANAGER_URL, gateway = SQLREST_GATEWAY_URL) {
  const base = String(root || SQLREST_MANAGER_URL).replace(/\/$/, '')
  const gw = String(gateway || SQLREST_GATEWAY_URL).replace(/\/$/, '')
  return {
    sqlrest: `${base}/`,
    gateway: gw,
    openapi: `${base}/swagger-ui.html`,
  }
}

const ROUTE_STATUS = {
  ok: { tag: 'tag-green', label: '正常' },
  degraded: { tag: 'tag-orange', label: '降级中' },
  warn: { tag: 'tag-orange', label: '告警' },
  off: { tag: 'tag-gray', label: '停用' },
}

/** Gateway / 绑定路由状态展示 */
export function routeStatusMeta(status) {
  return ROUTE_STATUS[status] || ROUTE_STATUS.ok
}

/** @deprecated 使用 routeStatusMeta */
export function apisixStatusMeta(status) {
  return routeStatusMeta(status)
}

/** 在已加载的 routes 中按 path 匹配；无静态假路由表 */
export function routeOfApi(apiPath, routes = []) {
  const list = Array.isArray(routes) ? routes : []
  const exact = list.find((r) => r.path === apiPath)
  if (exact) return exact
  return (
    list.find((r) => {
      if (!r.path?.includes('*')) return false
      const prefix = r.path.replace(/\*$/, '')
      return String(apiPath || '').startsWith(prefix)
    }) || null
  )
}
