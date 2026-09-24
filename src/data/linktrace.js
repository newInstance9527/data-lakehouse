/** 链路调用监控 · 链路分类与展示助手（span 走观测 API，禁止假瀑布） */

/** A–L 链路分类（示意标签，不含采样假数据） */
export const LT_LINKS = [
  { id: 'A', name: 'CDC 入湖' },
  { id: 'B', name: '埋点实时' },
  { id: 'C', name: '离线日批' },
  { id: 'D', name: '即席查询' },
  { id: 'E', name: '申请授权' },
  { id: 'F', name: '质量校验' },
  { id: 'G', name: '血缘变更' },
  { id: 'H', name: '根因(消费)' },
  { id: 'I', name: '指标对账' },
  { id: 'J', name: '出湖同步' },
  { id: 'K', name: '合规删除' },
  { id: 'L', name: '作业发布' },
]

export function spanStatusTag(status) {
  if (status === 'error') return { tag: 'tag-red', label: 'ERROR' }
  if (status === 'warn') return { tag: 'tag-orange', label: 'WARN' }
  if (status === 'ghost') return { tag: 'tag-gray', label: 'SKIP' }
  return { tag: 'tag-green', label: 'OK' }
}

export function spanBarClass(status) {
  if (status === 'ok') return 'ok'
  if (status === 'warn') return 'warn'
  if (status === 'error') return 'error'
  return 'ghost'
}
