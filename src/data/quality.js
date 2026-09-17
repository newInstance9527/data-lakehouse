/** 数据质量中心 · 对齐演示 HTML */

export const QUALITY_METRICS = [
  {
    title: '平均质量分',
    value: '92.4',
    unit: '分',
    ringPct: 92.4,
    ringColor: '#00c48c',
    ringText: '92%',
    sub: '↑ 1.3 较上周',
    subSuccess: true,
  },
  {
    title: '规则通过率',
    value: '94.8',
    unit: '%',
    ringPct: 94.8,
    ringColor: '#1e6fff',
    ringText: '95%',
    sub: '共执行 4,826 次 · 失败 249 次',
    subSuccess: false,
  },
  {
    title: '黄金数据集',
    value: '48',
    unit: '张',
    ringPct: 80,
    ringColor: '#722ed1',
    ringText: '48',
    sub: '质量≥95 + 对账通过 + Owner认责',
    subSuccess: false,
  },
  {
    title: '阻断 DAG',
    value: '7',
    unit: '次',
    ringPct: 14,
    ringColor: '#f5222d',
    ringText: '7',
    sub: '↑ 2 新增 dwd_order_detail 失败',
    subDanger: true,
  },
]

export const QUALITY_TYPE_DIST = [
  { label: '✅ 技术规则（非空/唯一/正则/值域）', count: 168, pct: 51.5, gradient: 'linear-gradient(90deg,#5cdbd3,#00c48c)' },
  { label: '📐 标准码值映射', count: 62, pct: 19.0, gradient: 'linear-gradient(90deg,#82aaff,#1e6fff)' },
  { label: '💰 业务规则（口径/关联/守恒）', count: 58, pct: 17.8, gradient: 'linear-gradient(90deg,#ea9bff,#722ed1)' },
  { label: '⏱️ 时效规则（分区/SLA/延迟）', count: 38, pct: 11.7, gradient: 'linear-gradient(90deg,#ffc069,#ffa940)' },
]

export const QUALITY_GOLD_TABLES = [
  { score: '99.8', table: 'dws_user.dws_user_profile_1d', assetKey: 'dws_user_profile' },
  { score: '99.2', table: 'dim.dim_sku', assetKey: 'dim_sku' },
  { score: '98.7', table: 'ads.ads_order_stat_daily', assetKey: 'ads_order_stat' },
]

export const QUALITY_RULES = [
  {
    id: 'dwd.s_order.PK_UNIQUE',
    table: 'ods_trade.s_order',
    field: 'order_id',
    scope: 'field',
    layer: 'ODS',
    level: '技术',
    type: '唯一性',
    expr: 'SELECT order_id, COUNT(*) c FROM T GROUP BY order_id HAVING c > 1',
    pass: false,
    ok: 98.8,
    fail: 1.2,
    okRows: '231,753,043',
    failRows: '2,814,848',
    status: '失败',
    alert: false,
  },
  {
    id: 'dwd.dwd_order_detail.PK_UNIQUE',
    table: 'dwd_trade.dwd_order_detail',
    field: 'order_id',
    scope: 'field',
    layer: 'DWD',
    level: '技术',
    type: '主键非空+唯一',
    expr: 'order_id 非空且去重计数 = COUNT(1)',
    pass: false,
    ok: 98.8,
    fail: 1.2,
    okRows: '218,769,048',
    failRows: '12,842',
    status: '失败·阻断DAG',
    alert: true,
  },
  {
    id: 'dwd.dwd_order_detail.PAY_AMT_GE0',
    table: 'dwd_trade.dwd_order_detail',
    field: 'pay_amt',
    scope: 'field',
    layer: 'DWD',
    level: '业务',
    type: '业务规则',
    expr: 'pay_amt >= 0 AND (SUCCESS 必有 pay_time)',
    pass: true,
    ok: 99.99,
    fail: 0.01,
    okRows: '221,434,289',
    failRows: '3,921',
    status: '通过',
    alert: false,
  },
  {
    id: 'dwd.dwd_order_detail.ORDER_STATUS_STD',
    table: 'dwd_trade.dwd_order_detail',
    field: 'order_status',
    scope: 'field',
    layer: 'DWD',
    level: '标准',
    type: '码值映射',
    expr: 'order_status IN (SELECT code FROM STD-C0021)',
    pass: true,
    ok: 99.98,
    fail: 0.02,
    okRows: '221,430,219',
    failRows: '7,991',
    status: '通过',
    alert: false,
  },
  {
    id: 'dwd.dwd_user_info.MOBILE_REGEX',
    table: 'dwd_user.dwd_user_info',
    field: 'buyer_mobile',
    scope: 'field',
    layer: 'DWD',
    level: '技术',
    type: '正则',
    expr: 'buyer_mobile REGEXP ^1[3-9]\\d{9}$',
    pass: true,
    ok: 99.94,
    fail: 0.06,
    okRows: '48,572,194',
    failRows: '25,917',
    status: '通过',
    alert: false,
  },
  {
    id: 'sla.ods_order_arrive',
    table: 'ods_trade.s_order',
    field: '',
    scope: 'table',
    layer: 'ODS',
    level: '时效',
    type: 'SLA',
    expr: 'dt 分区必须在 T+1 03:00 前就绪',
    pass: false,
    ok: 98,
    fail: 2,
    okRows: '历史达标',
    failRows: '今日延迟12min',
    status: '告警',
    alert: false,
  },
  {
    id: 'dwd.dwd_order_detail.ROW_COUNT_RECON',
    table: 'dwd_trade.dwd_order_detail',
    field: '',
    scope: 'table',
    layer: 'DWD',
    level: '业务',
    type: '对账',
    expr: '|ODS 行数 - DWD 行数| ≤ 10',
    pass: true,
    ok: 99.99,
    fail: 0.01,
    okRows: '221,438,210',
    failRows: '0',
    status: '通过',
    alert: false,
  },
]

/** 30 日质量分趋势（确定性，对齐演示末 3 天下探） */
export function buildQualityTrendPoints() {
  const arr = []
  for (let i = 0; i < 30; i++) {
    let v = 80 + ((i * 17 + 11) % 180) / 10
    if (i === 27) v = 78
    else if (i === 28) v = 74
    else if (i === 29) v = 68
    const cls = v >= 90 ? 'ok' : v >= 80 ? 'warn' : 'bad'
    arr.push({ v: v.toFixed(1), cls, h: v })
  }
  return arr
}

export const QUALITY_TREND_LABELS = [
  '08/05', '', '', '', '08/09', '', '', '', '', '08/15', '', '', '', '', '今日',
]
