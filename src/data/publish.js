/** 环境与发布 · 环境阶段示意与门禁/历史展示助手（列表走 /lh/compute/releases） */

export const PUBLISH_ENV_STAGES = [
  {
    id: 'dev',
    icon: '🔧',
    name: 'dev 开发',
    prefix: 'dev_iceberg / lh-dev-warehouse',
    lines: ['Catalog dev_* · 独立桶', '开发试跑可写'],
    tone: 'primary',
  },
  {
    id: 'stg',
    icon: '🧪',
    name: 'stg 测试',
    prefix: 'stg_iceberg / lh-stg-warehouse',
    lines: ['Catalog stg_* · 独立桶', '发布流水线可写'],
    tone: 'warning',
  },
  {
    id: 'prod',
    icon: '📦',
    name: 'prod 生产',
    prefix: 'iceberg / warehouse',
    lines: ['生产 Catalog', '仅 PR 合并 + 审批后发布'],
    tone: 'success',
  },
]

export function gateIcon(status) {
  return { pass: '✓', fail: '✗', wait: '○', run: '↻', skip: '–' }[status] || '○'
}

export function historyResultMeta(result) {
  return (
    {
      成功: { cls: 'tag-green', label: '✓ 成功' },
      回滚: { cls: 'tag-orange', label: '↺ 回滚' },
      门禁中: { cls: 'tag-blue', label: '⏳ 门禁中' },
      未通过: { cls: 'tag-red', label: '✗ 未通过' },
    }[result] || { cls: 'tag-gray', label: result }
  )
}
