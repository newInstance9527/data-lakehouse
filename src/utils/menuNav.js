import { NAV_GROUPS } from '@/config/nav'

const NAV_IDS = new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)))
const PATH_TO_ID = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [normalizePath(i.path), i.id])),
)

function normalizePath(p) {
  if (!p || typeof p !== 'string') return ''
  const s = p.replace(/\/$/, '') || '/'
  return s.startsWith('/') ? s : `/${s}`
}

/**
 * 从 Snowy loginMenu 树收集门户 nav.js id
 * 优先 path（/catalog），其次 name/code 与 nav id 同名
 */
export function collectMenuNavIds(tree) {
  const ids = new Set()
  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return
    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue
      const path = normalizePath(n.path)
      if (path && PATH_TO_ID[path]) ids.add(PATH_TO_ID[path])
      for (const key of ['name', 'code', 'id']) {
        const v = n[key]
        if (typeof v === 'string' && NAV_IDS.has(v)) ids.add(v)
      }
      // hutool Tree 可能把 SysMenu 字段放在 extra
      const extra = n.extra
      if (extra && typeof extra === 'object') {
        const ep = normalizePath(extra.path)
        if (ep && PATH_TO_ID[ep]) ids.add(PATH_TO_ID[ep])
        if (typeof extra.name === 'string' && NAV_IDS.has(extra.name)) ids.add(extra.name)
        if (typeof extra.code === 'string' && NAV_IDS.has(extra.code)) ids.add(extra.code)
      }
      if (Array.isArray(n.children)) walk(n.children)
    }
  }
  walk(tree)
  return ids
}
