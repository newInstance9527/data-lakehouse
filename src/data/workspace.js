/** 工作空间 · 共享 Catalog 与配额展示助手（列表数据走 /lh/workspace） */

export const SHARED_CATALOG = {
  gravitino: 'lakehouse',
  iceberg: 'iceberg',
  note: '共享资源池 · 发现走资产目录 · 读数走申请中心',
}

export function wsQuotaBarColor(pct) {
  if (pct > 80) return 'var(--danger)'
  if (pct > 60) return 'var(--warning)'
  return 'var(--success)'
}

export function wsQuotaStatusMeta(status) {
  return status === 'warn'
    ? { tag: 'tag-orange', label: '接近上限' }
    : { tag: 'tag-green', label: '正常' }
}
