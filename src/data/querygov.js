/** 查询治理 · 展示助手（列表/KPI 走 /lh/compute/query/gov） */

export function auditStatusMeta(status) {
  return (
    {
      ok: { tag: 'tag-green', label: '✓' },
      warn: { tag: 'tag-orange', label: '⚠' },
      blocked: { tag: 'tag-red', label: '阻断' },
    }[status] || { tag: 'tag-green', label: '✓' }
  )
}

export function costTrendClass(trend) {
  if (!trend) return 'trend-ok'
  if (String(trend).includes('归档')) return 'trend-danger'
  if (String(trend).startsWith('+')) return 'trend-warn'
  return 'trend-ok'
}

export function truncateQuery(sql, max = 40) {
  const s = sql || ''
  return s.length > max ? `${s.slice(0, max)}...` : s
}
