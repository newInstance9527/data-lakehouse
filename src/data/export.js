/** 出湖与回流 */

export const EXPORT_KPIS = [
  {
    icon: '📤',
    color: 'blue',
    value: '18',
    unit: '个',
    label: '活跃出湖作业',
    trend: '独立 SA',
    trendUp: true,
  },
  {
    icon: '✅',
    color: 'green',
    value: '12',
    unit: '个',
    label: '已审批',
    trend: '含脱敏',
    trendUp: true,
  },
  {
    icon: '⏳',
    color: 'orange',
    value: '3',
    unit: '个',
    label: '待审批',
    trend: '含 1 出域',
    trendUp: false,
  },
  {
    icon: '🔄',
    color: 'purple',
    value: '6',
    unit: '个',
    label: '回流目标',
    trend: 'MySQL/Redis/ES',
    trendUp: true,
  },
  {
    icon: '⏰',
    color: 'red',
    value: '2',
    unit: '个',
    label: '即将到期',
    trend: '7 天内停作业',
    trendUp: false,
  },
]

export const EXPORT_FLOW = [
  { icon: '📝', title: '申请单', sub: '用途=回流/库表/时效' },
  { icon: '🔐', title: '审批', sub: '安全+域负责人' },
  { icon: '🛡️', title: 'DS 脱敏', sub: '出域→静态脱敏' },
  { icon: '📤', title: '出湖', sub: 'ADS → MySQL/Redis/ES' },
  { icon: '📋', title: '审计', sub: 'Gravitino 记录' },
  { icon: '⏰', title: '到期回收', sub: '停作业+通知删副本' },
]

export const EXPORT_JOBS = [
  {
    job: 'EXP-001',
    src: 'ads_gmv_board',
    target: 'MySQL(bi_db)',
    purpose: 'BI 报表库',
    freq: '日 06:00',
    mask: '无',
    expire: '长期',
    status: 'ok',
  },
  {
    job: 'EXP-002',
    src: 'dwd_user_info',
    target: 'Redis',
    purpose: '用户标签缓存',
    freq: '时 :00',
    mask: '手机号脱敏',
    expire: '2026-12-31',
    status: 'ok',
  },
  {
    job: 'EXP-003',
    src: 'ads_user_portrait',
    target: 'ES',
    purpose: '用户搜索',
    freq: '日 04:00',
    mask: 'PII 脱敏',
    expire: '2026-10-15',
    status: 'warn',
  },
  {
    job: 'EXP-004',
    src: 'dwd_order_detail',
    target: 'MySQL(analytics_db)',
    purpose: '分析师自助',
    freq: '日 07:00',
    mask: '无',
    expire: '2026-09-10',
    status: 'urgent',
  },
  {
    job: 'EXP-005',
    src: 'ads_gmv_board',
    target: 'MySQL(report_db)',
    purpose: '财务报表',
    freq: '日 06:30',
    mask: '无',
    expire: '长期',
    status: 'ok',
  },
  {
    job: 'EXP-006',
    src: 'dwd_refund_detail',
    target: 'MySQL(refund_db)',
    purpose: '退款系统',
    freq: '日 05:00',
    mask: '无',
    expire: '2026-09-08',
    status: 'urgent',
  },
]

const EXPORT_STATUS = {
  ok: { tag: 'tag-green', label: '正常' },
  warn: { tag: 'tag-orange', label: '即将到期' },
  urgent: { tag: 'tag-red', label: '紧急到期' },
}

export function exportJobStatusMeta(status) {
  return EXPORT_STATUS[status] || EXPORT_STATUS.ok
}
