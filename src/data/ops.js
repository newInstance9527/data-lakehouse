/** 任务运维 · 状态图标 class（列表数据走 /lh/etl） */

const STATUS_ICON_CLASS = {
  success: 'ts-success',
  failed: 'ts-failed',
  warning: 'ts-warning',
  pending: 'ts-pending',
  running: 'ts-pending',
}

export function opsStatusIconClass(status) {
  return STATUS_ICON_CLASS[status] || 'ts-pending'
}
