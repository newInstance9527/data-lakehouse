/** 查询治理与成本 · 对齐演示 HTML page-querygov */

export const QG_KPIS = [
  {
    icon: '🎚️',
    color: 'blue',
    value: '3',
    unit: '个',
    label: 'Trino 队列',
    trend: 'dashboard 优先',
    trendUp: true,
  },
  {
    icon: '✅',
    color: 'green',
    value: '1.2',
    unit: 'k',
    label: '日查询量',
    trend: 'P95 3.2s',
    trendUp: true,
  },
  {
    icon: '⚠️',
    color: 'orange',
    value: '12',
    unit: '次',
    label: '超限阻断',
    trend: '无分区过滤',
    trendUp: false,
    trendWarn: true,
  },
  {
    icon: '💰',
    color: 'purple',
    value: '¥3.8',
    unit: '万',
    label: '月计算成本',
    trend: '按域分摊',
    trendUp: true,
  },
  {
    icon: '📦',
    color: 'red',
    value: '7',
    unit: '张',
    label: '无主资产',
    trend: '归档候选',
    trendUp: false,
    trendDanger: true,
  },
]

export const TRINO_QUEUES = [
  {
    name: 'dashboard',
    icon: '📊',
    priority: '高',
    concurrent: 20,
    qps: '850/d',
    scanLimit: '无限制',
    desc: 'Superset 看板查询',
  },
  {
    name: 'adhoc',
    icon: '💻',
    priority: '中',
    concurrent: 5,
    qps: '280/d',
    scanLimit: '≤ 10 GB（硬顶 50GB）',
    desc: '即席查询 / 分析师',
  },
  {
    name: 'etl',
    icon: '🔄',
    priority: '低',
    concurrent: 10,
    qps: '120/d',
    scanLimit: '无限制',
    desc: 'ETL 批处理作业',
  },
]

export const QUERY_AUDITS = [
  {
    user: 'analyst_zhang',
    query: 'SELECT * FROM ods_trade.s_order',
    scan: '1.2 TB',
    time: '45s',
    queue: 'adhoc',
    status: 'blocked',
  },
  {
    user: 'bi_dashboard',
    query: 'SELECT sum(pay_amt) FROM ads_gmv_board WHERE dt>=...',
    scan: '128 MB',
    time: '0.8s',
    queue: 'dashboard',
    status: 'ok',
  },
  {
    user: 'analyst_li',
    query: 'SELECT * FROM dwd_order_detail WHERE dt=...',
    scan: '8.4 GB',
    time: '3.2s',
    queue: 'adhoc',
    status: 'ok',
  },
  {
    user: 'etl_job',
    query: 'INSERT OVERWRITE dws_order_1d SELECT ...',
    scan: '42 GB',
    time: '120s',
    queue: 'etl',
    status: 'ok',
  },
  {
    user: 'analyst_wang',
    query: 'SELECT * FROM dwd_user_info',
    scan: '386 GB',
    time: '28s',
    queue: 'adhoc',
    status: 'warn',
  },
  {
    user: 'bi_dashboard',
    query: 'SELECT count(*) FROM dwd_order_detail WHERE dt=...',
    scan: '8.4 GB',
    time: '1.1s',
    queue: 'dashboard',
    status: 'ok',
  },
]

export const COST_DOMAINS = [
  {
    domain: '交易域',
    minio: '¥8,200',
    ck: '¥6,500',
    trino: '¥4,800',
    total: '¥19,500',
    trend: '+5%',
  },
  {
    domain: '用户域',
    minio: '¥3,800',
    ck: '¥2,100',
    trino: '¥1,600',
    total: '¥7,500',
    trend: '+2%',
  },
  {
    domain: '商品域',
    minio: '¥1,200',
    ck: '¥800',
    trino: '¥600',
    total: '¥2,600',
    trend: '-1%',
  },
  {
    domain: '营销域',
    minio: '¥2,100',
    ck: '¥1,400',
    trino: '¥900',
    total: '¥4,400',
    trend: '+8%',
  },
  {
    domain: '财务域',
    minio: '¥1,800',
    ck: '¥1,200',
    trino: '¥800',
    total: '¥3,800',
    trend: '+3%',
  },
  {
    domain: '无主',
    minio: '¥800',
    ck: '¥200',
    trino: '¥100',
    total: '¥1,100',
    trend: '归档候选',
  },
]

export const QG_RULES = [
  {
    rule: '无分区过滤 ODS 全表扫描',
    threshold: 'ODS 表 + 无 dt 条件',
    action: '阻断',
    actionTag: 'tag-red',
    notify: '用户 + owner',
    status: '启用',
  },
  {
    rule: 'adhoc 扫描字节超限',
    threshold: '> 10 GB（硬顶 50GB）',
    action: '拒绝',
    actionTag: 'tag-red',
    notify: '用户',
    status: '启用',
  },
  {
    rule: 'adhoc 并发超限',
    threshold: '> 5 并发/人',
    action: '排队',
    actionTag: 'tag-orange',
    notify: '—',
    status: '启用',
  },
  {
    rule: 'dashboard 队列优先',
    threshold: 'dashboard > adhoc > etl',
    action: '调度',
    actionTag: 'tag-blue',
    notify: '—',
    status: '启用',
  },
  {
    rule: '无主资产 90 天无查询',
    threshold: '90 天 0 查询',
    action: '归档候选',
    actionTag: 'tag-orange',
    notify: '域负责人',
    status: '启用',
  },
]

export function auditStatusMeta(status) {
  return (
    {
      ok: { tag: 'tag-green', label: '✓' },
      warn: { tag: 'tag-orange', label: '⚠' },
      blocked: { tag: 'tag-red', label: '阻断' },
    }[status] || { tag: 'tag-green', label: '✓' }
  )
}

export function costTrendClass(trend) {
  if (!trend) return 'trend-ok'
  if (String(trend).includes('归档')) return 'trend-danger'
  if (String(trend).startsWith('+')) return 'trend-warn'
  return 'trend-ok'
}

export function truncateQuery(sql, max = 40) {
  const s = sql || ''
  return s.length > max ? `${s.slice(0, max)}...` : s
}
