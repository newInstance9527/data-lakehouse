/** 合规删除 · 流程词表与状态 meta（工单列表走 /lh/compliance） */

/** 流程阶段（设计口径 · doc/合规删除.md 状态机） */
export const COMPLIANCE_STAGES = [
  { id: 'assessing', label: '受理评估', desc: '主体索引 + 血缘展开出计划' },
  { id: 'pending_approval', label: '审批', desc: '安全 → 法务 → Owner' },
  { id: 'scheduled', label: '排期', desc: '维护窗口 · 避开快照过期' },
  { id: 'executing', label: '执行', desc: '源 → 湖 → CK → 下游 → 平台' },
  { id: 'verifying', label: '验证', desc: '残留反查 · 时间旅行不可读' },
  { id: 'archived', label: '归档 / 销毁', desc: '证据包 · 备份到期物理删' },
]

/** 状态 → 文案与色（对齐后端 gov_del_request.status） */
export const DEL_STATUS_META = {
  assessing: { label: '评估中', cls: 'tag-blue' },
  pending_approval: { label: '待审批', cls: 'tag-orange' },
  scheduled: { label: '已排期', cls: 'tag-blue' },
  executing: { label: '执行中', cls: 'tag-purple' },
  verifying: { label: '验证中', cls: 'tag-purple' },
  partial_failed: { label: '部分失败', cls: 'tag-red' },
  done: { label: '已完成', cls: 'tag-green' },
  archived: { label: '待备份销毁', cls: 'tag-gray' },
  destroyed: { label: '已销毁', cls: 'tag-gray' },
  restricted: { label: '限制处理', cls: 'tag-orange' },
  on_hold: { label: '法务冻结', cls: 'tag-red' },
  rejected: { label: '已驳回', cls: 'tag-red' },
}

export const COMPLIANCE_STATUS_TABS = [
  { id: '', label: '全部' },
  { id: 'assessing', label: '评估中' },
  { id: 'pending_approval', label: '待审批' },
  { id: 'scheduled', label: '待执行' },
  { id: 'verifying', label: '验证中' },
  { id: 'restricted', label: '限制处理' },
  { id: 'archived', label: '归档/销毁' },
  { id: 'done', label: '已完成' },
  { id: 'rejected', label: '已驳回' },
]

export const COMPLIANCE_TYPE_META = {
  被遗忘权: { cls: 'tag-red' },
  错误数据擦除: { cls: 'tag-orange' },
  监管责令删除: { cls: 'tag-purple' },
  合同到期清除: { cls: 'tag-blue' },
  forget: { cls: 'tag-red' },
  erase_error: { cls: 'tag-orange' },
  regulator: { cls: 'tag-purple' },
  contract_expire: { cls: 'tag-blue' },
}

/** 计划目标行状态色 */
export const DEL_TARGET_STATUS_CLS = {
  planned: 'tag-blue',
  queued: 'tag-blue',
  running: 'tag-purple',
  executing: 'tag-purple',
  done: 'tag-green',
  success: 'tag-green',
  skipped: 'tag-gray',
  restricted: 'tag-orange',
  failed: 'tag-red',
  error: 'tag-red',
}

export function complianceTypeCls(type) {
  return COMPLIANCE_TYPE_META[type]?.cls || 'tag-gray'
}
