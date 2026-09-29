/** 出湖与回流 · 静态流程与状态元数据（KPI/作业列表由 /lh/export 聚合） */

export const EXPORT_FLOW = [
  { icon: '📝', title: '申请单', sub: '用途=回流/库表/时效' },
  { icon: '🔐', title: '审批', sub: '安全+域负责人' },
  { icon: '🛡️', title: '调度脱敏', sub: '出域→静态脱敏' },
  { icon: '📤', title: '出湖', sub: 'ADS → MySQL/Redis/ES' },
  { icon: '📋', title: '审计', sub: '元数据记录' },
  { icon: '⏰', title: '到期回收', sub: '停作业+通知删副本', focus: 'expire' },
]

const EXPORT_STATUS = {
  ok: { tag: 'tag-green', label: '正常' },
  warn: { tag: 'tag-orange', label: '即将到期' },
  urgent: { tag: 'tag-red', label: '紧急到期' },
}

export function exportJobStatusMeta(status) {
  return EXPORT_STATUS[status] || EXPORT_STATUS.ok
}
