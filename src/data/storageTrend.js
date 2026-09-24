/** 存储趋势 · 图表助手（序列走 /lh/lifecycle/storage） */

export function stGrowthCls(status) {
  if (status === 'warn') return 'warn'
  if (status === 'fail') return 'danger'
  return 'ok'
}

export function stBarHeight(total, max = 3.5) {
  return Math.max(8, Math.round((Number(total) / (max || 1)) * 100))
}
