/**
 * 跨模块深链（与后端 LhModuleDeepLinks 同源契约）
 */

function enc(s) {
  return encodeURIComponent(String(s ?? ''))
}

function query(params) {
  const parts = []
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v == null || v === '') return
    parts.push(`${enc(k)}=${enc(v)}`)
  })
  return parts.length ? `?${parts.join('&')}` : ''
}

export function catalogAsset(assetIdOrCode) {
  if (!assetIdOrCode) return '/catalog'
  return `/catalog?asset=${enc(assetIdOrCode)}`
}

export function catalogSearch(q) {
  if (!q) return '/catalog'
  return `/catalog?q=${enc(q)}`
}

export function lineagePath({ focus, omFqn, field, mode } = {}) {
  return `/lineage${query({ focus, omFqn, field, mode })}`
}

export function lineageFocus(focus) {
  return lineagePath({ focus })
}

export function lineageField(focus, field) {
  return lineagePath({ focus, field, mode: 'field' })
}

export function qualityPath(tableQ) {
  if (!tableQ) return '/quality'
  return `/quality?q=${enc(tableQ)}`
}

export function standardMapping(q) {
  return `/standard${query({ tab: 'mapping', q })}`
}

/** 生命周期主台；可选 table 预填 */
export function lifecyclePath(tableFqn) {
  if (!tableFqn) return '/lifecycle'
  return `/lifecycle?table=${enc(tableFqn)}`
}

/** 从 route.query 归一化血缘 focus（别名：node / omFqn / q） */
export function resolveLineageFocus(query = {}) {
  return (
    query.focus ||
    query.node ||
    query.omFqn ||
    query.q ||
    ''
  )
}
