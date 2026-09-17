/** 生命周期 · 存储趋势页 · 对齐演示 HTML 弹窗 + §32.4 水位 */

export const ST_KPIS = [
  {
    icon: '💾',
    color: 'blue',
    value: '3.4',
    unit: 'TB',
    label: '近 7 日统计口径',
    trend: '总存储 +2.3%',
  },
  {
    icon: '🔥',
    color: 'orange',
    value: '1.2',
    unit: 'TB',
    label: 'ODS 层',
    trend: '+1.8% · 入湖主路径',
  },
  {
    icon: '💧',
    color: 'green',
    value: '1.8',
    unit: 'TB',
    label: 'DWD 层',
    trend: '+1.2% · 明细膨胀',
  },
  {
    icon: '📦',
    color: 'purple',
    value: '128',
    unit: 'GB',
    label: 'DWS 层',
    trend: '+0.3% · 平稳',
  },
  {
    icon: '📊',
    color: 'red',
    value: '12',
    unit: 'GB',
    label: 'ADS 层',
    trend: '+5.2% · 看板刷新频繁',
    trendDown: true,
  },
]

/** 分层存量 + 7 日增速 */
export const ST_LAYERS = [
  {
    layer: 'ODS',
    size: '1.2 TB',
    growth: '+1.8%',
    pct: 35,
    color: '#4d8dff',
    note: 'CDC 入湖 · 热→温 90 天',
  },
  {
    layer: 'DWD',
    size: '1.8 TB',
    growth: '+1.2%',
    pct: 53,
    color: '#3dd68c',
    note: '明细宽表 · 温层主力',
  },
  {
    layer: 'DWS',
    size: '128 GB',
    growth: '+0.3%',
    pct: 4,
    color: '#a78bfa',
    note: '日汇总 · 归档候选',
  },
  {
    layer: 'ADS',
    size: '12 GB',
    growth: '+5.2%',
    pct: 1,
    color: '#e6b450',
    note: '看板 / CK 热数据',
  },
  {
    layer: 'DIM / 其它',
    size: '260 GB',
    growth: '+0.8%',
    pct: 7,
    color: '#94a3b8',
    note: '维度与临时区',
  },
]

/** 近 7 天总存储（TB）柱状趋势 */
export const ST_DAILY = [
  { day: '09-10', total: 3.22, ods: 1.15, dwd: 1.72, growth: '+0.4%' },
  { day: '09-11', total: 3.25, ods: 1.16, dwd: 1.74, growth: '+0.9%' },
  { day: '09-12', total: 3.27, ods: 1.17, dwd: 1.75, growth: '+0.6%' },
  { day: '09-13', total: 3.29, ods: 1.18, dwd: 1.76, growth: '+0.6%' },
  { day: '09-14', total: 3.31, ods: 1.19, dwd: 1.77, growth: '+0.6%' },
  { day: '09-15', total: 3.35, ods: 1.20, dwd: 1.79, growth: '+1.2%' },
  { day: '09-16', total: 3.40, ods: 1.20, dwd: 1.80, growth: '+1.5%' },
]

/** 水位容量条（复用 lifecycle §32.4） */
export const ST_CAPACITY = [
  {
    label: 'MinIO 总量',
    pct: 21,
    used: '4.2',
    cap: '20 TB · 21%',
    gradient: 'linear-gradient(90deg,#3dd68c,#e6b450)',
  },
  {
    label: 'CK 热数据',
    pct: 62,
    used: '312',
    cap: '500 GB · 62%',
    gradient: 'linear-gradient(90deg,#4d8dff,#3dd68c)',
  },
  {
    label: '归档桶',
    pct: 8,
    used: '0.3',
    cap: '4 TB · 8%',
    gradient: 'linear-gradient(90deg,#94a3b8,#64748b)',
  },
]

/** 异常增长表 */
export const ST_ANOMALIES = [
  {
    table: 'dwd_log_action',
    layer: 'DWD',
    size: '620 GB',
    growth: '+8.5%',
    reason: '小文件暴涨 · 分区策略待检',
    status: 'warn',
    action: 'compact',
    actionLabel: '触发合并',
  },
  {
    table: 'ads_gmv_board',
    layer: 'ADS',
    size: '12 GB',
    growth: '+5.2%',
    reason: '看板刷新频繁 · CK 写入放大',
    status: 'warn',
    action: 'catalog',
    actionLabel: '看资产',
  },
  {
    table: 'ods_trade.s_order',
    layer: 'ODS',
    size: '1.2 TB',
    growth: '+3.8%',
    reason: '快照膨胀 · 建议过期',
    status: 'warn',
    action: 'expire',
    actionLabel: '快照过期',
  },
  {
    table: 'dwd_order_detail',
    layer: 'DWD',
    size: '842 GB',
    growth: '+2.1%',
    reason: '业务正常增长',
    status: 'ok',
    action: 'catalog',
    actionLabel: '看资产',
  },
]

/** 7 日增速 Top */
export const ST_TOP_GROWTH = [
  { table: 'ods_trade.s_order', growth: '+28%', tip: '建议扩容', danger: true },
  { table: 'dwd_order_detail', growth: '+18%', tip: '关注分区', danger: false },
  { table: 'dim.dim_sku', growth: '+5%', tip: '正常', danger: false },
]

/** 治理建议 */
export const ST_ADVICE = [
  {
    pri: 'P1',
    priCls: 'tag-red',
    title: 'dwd_log_action 触发小文件合并',
    detail: '近 7 日 +8.5%，文件数 890 · 目标 256MB compaction',
    act: 'compact',
    actLabel: '提交合并',
  },
  {
    pri: 'P1',
    priCls: 'tag-red',
    title: 'ods_trade.s_order 快照过期',
    detail: '保留策略 keepDays=3 · 快照膨胀推高 MinIO 水位',
    act: 'expire',
    actLabel: '执行过期',
  },
  {
    pri: 'P2',
    priCls: 'tag-orange',
    title: '冰川层归档 30 天前 ODS',
    detail: '38 个分区归档候选 · 预计回收 ~90 GB',
    act: 'lifecycle',
    actLabel: '打开生命周期',
  },
]

export function stGrowthCls(status) {
  if (status === 'warn') return 'warn'
  if (status === 'fail') return 'danger'
  return 'ok'
}

export function stBarHeight(total, max = 3.5) {
  return Math.max(8, Math.round((total / max) * 100))
}
