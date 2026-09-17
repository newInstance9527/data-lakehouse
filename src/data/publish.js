/** 环境与发布 · 对齐演示 HTML */

export const PUBLISH_KPIS = [
  { icon: '🔧', color: 'blue', value: '42', unit: '个', label: 'dev 作业', trend: '脱敏抽样数据' },
  { icon: '🧪', color: 'orange', value: '6', unit: '个', label: 'stg 待发布', trend: '门禁检查中' },
  { icon: '📦', color: 'green', value: '186', unit: '个', label: 'prod 作业', trend: '仅 CI 发布' },
  { icon: '🔄', color: 'purple', value: '3', unit: '次', label: '本月回滚', trend: '均 < 5min' },
  { icon: '🚫', color: 'red', value: '0', unit: '次', label: '裸改生产', trend: '已禁用' },
]

export const PUBLISH_ENV_STAGES = [
  {
    id: 'dev',
    icon: '🔧',
    name: 'dev 开发',
    prefix: 'dev_*',
    lines: ['42 作业 · 脱敏抽样 / 造数', '开发 SA 可写'],
    tone: 'primary',
  },
  {
    id: 'stg',
    icon: '🧪',
    name: 'stg 测试',
    prefix: 'stg_*',
    lines: ['6 作业待发布 · 近生产抽样脱敏', '发布流水线可写'],
    tone: 'warning',
  },
  {
    id: 'prod',
    icon: '📦',
    name: 'prod 生产',
    prefix: 'ods_ / dwd_ / ...',
    lines: ['186 作业 · 生产数据', '仅 CI 发布可写'],
    tone: 'success',
  },
]

/** 当前焦点发布单的门禁（演示默认 v23） */
export const PUBLISH_GATES = [
  { step: 1, name: 'Git 编译通过', detail: 'v23-dwd-order-clean.sql 编译 ✓', status: 'pass' },
  { step: 2, name: '血缘解析入库', detail: '上游 1 表 → 下游 3 表已解析', status: 'pass' },
  { step: 3, name: '质量规则绑定', detail: '6 条质量规则已绑定（含码值合规）', status: 'pass' },
  { step: 4, name: 'stg 环境跑通', detail: '抽样数据跑通 · 1.2 万行 · 3 条质量告警', status: 'pass' },
  { step: 5, name: '变更影响无阻断', detail: '下游 ads_gmv_board 依赖 pay_amt · 需同步更新', status: 'fail' },
  { step: 6, name: '生产发布', detail: '等待门禁通过后自动发布', status: 'wait' },
]

export const PUBLISH_HISTORY = [
  { pkg: 'v22-dwd-user-info', tag: 'v22.0', env: 'prod', result: '成功', time: '2026-08-20 10:30' },
  { pkg: 'v21-ads-gmv-board', tag: 'v21.0', env: 'prod', result: '成功', time: '2026-08-15 14:20' },
  { pkg: 'v20-dws-order-1d', tag: 'v20.0', env: 'prod', result: '成功', time: '2026-08-10 09:15' },
  { pkg: 'v19-ods-s-refund', tag: 'v19.0', env: 'prod', result: '回滚', time: '2026-08-05 16:40' },
  { pkg: 'v23-dwd-order-clean', tag: 'v23.0', env: 'stg', result: '门禁中', time: '2026-09-02 11:00' },
]

export const PUBLISH_LOG_SNIPPETS = [
  'v1.2.3 — 09-03 14:00 — dwd_clean 脚本上线（CR 通过）',
  'v1.2.2 — 09-02 10:00 — ads_gmv_board 看板更新',
  'v1.2.1 — 09-01 16:00 — ods_trade 分区策略调整',
  'v1.2.0 — 08-31 09:00 — dwd_user_info 脱敏规则更新',
]

export function gateIcon(status) {
  return { pass: '✓', fail: '✗', wait: '○', run: '↻' }[status] || '○'
}

export function historyResultMeta(result) {
  return (
    {
      成功: { cls: 'tag-green', label: '✓ 成功' },
      回滚: { cls: 'tag-orange', label: '↺ 回滚' },
      门禁中: { cls: 'tag-blue', label: '⏳ 门禁中' },
    }[result] || { cls: 'tag-gray', label: result }
  )
}
