/**
 * 血缘图画布自动布局：按拓扑层级 / 数仓分层展开，并做纵向防碰撞
 */

const LAYER_COL = {
  src: 0,
  ods: 1,
  dim: 1,
  dwd: 2,
  dws: 3,
  ads: 4,
  metric: 5,
  report: 6,
  表: 2,
}

const DEFAULTS = {
  nodeW: 200,
  nodeH: 110,
  gapX: 280,
  gapY: 136,
  originX: 48,
  originY: 56,
}

function edgeEnds(e) {
  if (Array.isArray(e)) return { from: e[0], to: e[1] }
  return { from: e.from || e.fromNodeKey, to: e.to || e.toNodeKey }
}

function nodeKey(n) {
  return String(n.id || n.key || n.name || '')
}

/** 检测是否严重重叠（多数节点挤在同一小区域内） */
export function needsRelayout(nodes = []) {
  if (!nodes.length) return false
  if (nodes.length === 1) return false
  const xs = nodes.map((n) => Number(n.x))
  const ys = nodes.map((n) => Number(n.y))
  if (xs.some((v) => Number.isNaN(v)) || ys.some((v) => Number.isNaN(v))) return true
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  // 全部挤在 40px 内，或任意两点距离过近占比过高
  if (maxX - minX < 40 && maxY - minY < 40) return true
  let close = 0
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = Math.abs(xs[i] - xs[j])
      const dy = Math.abs(ys[i] - ys[j])
      if (dx < 60 && dy < 60) close++
    }
  }
  const pairs = (nodes.length * (nodes.length - 1)) / 2
  return pairs > 0 && close / pairs > 0.35
}

/**
 * @param {Array} nodes
 * @param {Array} edges
 * @param {{ focusId?: string }} opts
 */
export function layoutLineageNodes(nodes = [], edges = [], opts = {}) {
  const cfg = { ...DEFAULTS, ...opts }
  const list = (nodes || []).map((n) => ({ ...n }))
  if (!list.length) return list

  const idOf = (n) => nodeKey(n)
  const byId = new Map(list.map((n) => [idOf(n).toLowerCase(), n]))

  const outs = new Map()
  const ins = new Map()
  list.forEach((n) => {
    const id = idOf(n).toLowerCase()
    outs.set(id, [])
    ins.set(id, [])
  })
  ;(edges || []).forEach((e) => {
    const { from, to } = edgeEnds(e)
    const a = String(from || '').toLowerCase()
    const b = String(to || '').toLowerCase()
    if (!byId.has(a) || !byId.has(b) || a === b) return
    outs.get(a).push(b)
    ins.get(b).push(a)
  })

  const focus =
    String(opts.focusId || list.find((n) => n.focus)?.id || list[0]?.id || '').toLowerCase()

  // rank: 以 focus 为 0，上游为负，下游为正；无边时用 layer 列
  const rank = new Map()
  if (byId.has(focus)) {
    const q = [[focus, 0]]
    rank.set(focus, 0)
    while (q.length) {
      const [cur, r] = q.shift()
      ;(ins.get(cur) || []).forEach((p) => {
        if (rank.has(p)) return
        rank.set(p, r - 1)
        q.push([p, r - 1])
      })
      ;(outs.get(cur) || []).forEach((n) => {
        if (rank.has(n)) return
        rank.set(n, r + 1)
        q.push([n, r + 1])
      })
    }
  }
  list.forEach((n) => {
    const id = idOf(n).toLowerCase()
    if (rank.has(id)) return
    const layer = String(n.layer || '表').toLowerCase()
    const col = LAYER_COL[layer] ?? 2
    // 相对 focus 层偏移：无连通分量时按分层摆
    const focusLayer = String(byId.get(focus)?.layer || 'dwd').toLowerCase()
    const focusCol = LAYER_COL[focusLayer] ?? 2
    rank.set(id, col - focusCol)
  })

  const columns = new Map()
  list.forEach((n) => {
    const id = idOf(n).toLowerCase()
    const r = rank.get(id) ?? 0
    if (!columns.has(r)) columns.set(r, [])
    columns.get(r).push(n)
  })

  const ranks = [...columns.keys()].sort((a, b) => a - b)
  const minRank = ranks[0] ?? 0

  ranks.forEach((r) => {
    const colNodes = columns.get(r)
    // 稳定排序：层内按名称，focus 靠中
    colNodes.sort((a, b) => {
      const af = idOf(a).toLowerCase() === focus ? -1 : 0
      const bf = idOf(b).toLowerCase() === focus ? -1 : 0
      if (af !== bf) return af - bf
      return String(a.name || a.id).localeCompare(String(b.name || b.id), 'zh')
    })
    const colIndex = r - minRank
    const x = cfg.originX + colIndex * cfg.gapX
    const totalH = colNodes.length * cfg.gapY
    const startY = Math.max(cfg.originY, cfg.originY + (400 - totalH) / 2)
    colNodes.forEach((n, i) => {
      n.x = x
      n.y = startY + i * cfg.gapY
    })
  })

  // 同列二次防碰撞（保险）
  ranks.forEach((r) => {
    const colNodes = columns.get(r).slice().sort((a, b) => a.y - b.y)
    for (let i = 1; i < colNodes.length; i++) {
      const prev = colNodes[i - 1]
      const cur = colNodes[i]
      const minY = prev.y + cfg.gapY
      if (cur.y < minY) cur.y = minY
    }
  })

  return list
}

/** 若重叠则重排，否则保留原坐标 */
export function ensureLineageLayout(nodes, edges, opts = {}) {
  const list = (nodes || []).map((n) => ({ ...n }))
  if (!list.length) return list
  if (opts.force || needsRelayout(list)) {
    return layoutLineageNodes(list, edges, opts)
  }
  return list
}
