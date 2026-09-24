/** 数据质量 · 展示助手（规则/KPI 走 /lh/quality；禁止假行） */

export function qualityRuleStatusMeta(status) {
  return (
    {
      ok: { cls: 'tag-green', label: '通过' },
      pass: { cls: 'tag-green', label: '通过' },
      warn: { cls: 'tag-orange', label: '告警' },
      fail: { cls: 'tag-red', label: '失败' },
      blocked: { cls: 'tag-red', label: '阻断' },
    }[status] || { cls: 'tag-gray', label: status || '—' }
  )
}
