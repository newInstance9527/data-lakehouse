/** 生命周期 · 阶段标签与作业状态（板面数据走 /lh/lifecycle） */

export const LC_STAGES = [
  { id: 'hot', label: '热', desc: '高频访问 · 本地/近线' },
  { id: 'warm', label: '温', desc: '中频 · 可压缩' },
  { id: 'cold', label: '冷', desc: '低频 · 归档候选' },
]

export function lcJobStatusMeta(status) {
  return (
    {
      success: { cls: 'success', tag: 'tag-green', label: '成功' },
      warn: { cls: 'warn', tag: 'tag-orange', label: '告警' },
      failed: { cls: 'failed', tag: 'tag-red', label: '失败' },
    }[status] || { cls: 'success', tag: 'tag-green', label: '成功' }
  )
}
