/** 任务运维中心 · 对齐演示 HTML page-ops / RECONCILE_DATA */

export const OPS_KPIS = [
  {
    icon: '🌊',
    color: 'blue',
    value: '38',
    unit: '个',
    label: '流作业 Flink',
    trend: '35 运行 · 1 异常 · 2 暂停',
  },
  {
    icon: '🐬',
    color: 'green',
    value: '142',
    unit: '个',
    label: '批任务 DS 今日',
    trend: '✓ 137 成功 · 3 失败 · 2 运行',
    trendUp: true,
  },
  {
    icon: '🔁',
    color: 'orange',
    value: '21',
    unit: '个',
    label: '湖/CK 对账',
    trend: '1 失败 ads_gmv',
    trendDanger: true,
  },
  {
    icon: '📦',
    color: 'purple',
    value: '76',
    unit: '%',
    label: '小文件合并',
    trend: '今日 compaction 完成',
    trendUp: true,
  },
]

/** status: running | success | failed | warning */
export const OPS_FLINK_JOBS = [
  {
    id: 'cdc.trade.order',
    name: 'cdc.trade.order · Flink CDC 入湖',
    status: 'warning',
    icon: '⚠️',
    tags: [{ text: 'Lag告警', cls: 'tag-orange' }],
    meta: [
      { text: 'CKP 3m24s' },
      { text: '并行度 8' },
      { text: 'Kafka lag 12.5万', tone: 'warning' },
    ],
    progressLabel: '健康度',
    progressText: '72%',
    progress: 72,
    barColor: 'var(--warning)',
    route: '/rootcause',
  },
  {
    id: 'rt.pv.dws_pv_1min',
    name: 'rt.pv.dws_pv_1min · 埋点实时双写',
    status: 'running',
    icon: '⚙️',
    tags: [{ text: '核心', cls: 'tag-green' }],
    meta: [
      { text: 'CKP 30s' },
      { text: '并行度 12' },
      { text: 'Lag 正常', tone: 'success' },
    ],
    progressLabel: '健康度',
    progressText: '98%',
    progress: 98,
    barColor: 'var(--success)',
  },
  {
    id: 'quality.probe.realtime',
    name: 'quality.probe.realtime · 流式质量探针',
    status: 'failed',
    icon: '✕',
    tags: [{ text: '失败', cls: 'tag-red' }],
    meta: [{ text: 'OM Ingestion 连接超时' }, { text: '重启 2 次' }],
    progressLabel: '健康度',
    progressText: '0%',
    progress: 0,
    barColor: 'var(--danger)',
  },
  {
    id: 'cdc.user.user_info',
    name: 'cdc.user.user_info · 用户库 CDC',
    status: 'running',
    icon: '⚙️',
    tags: [],
    meta: [
      { text: 'CKP 1m10s' },
      { text: '并行度 4' },
      { text: 'Lag 2.3s', tone: 'success' },
    ],
    progressLabel: '健康度',
    progressText: '95%',
    progress: 95,
    barColor: 'var(--success)',
  },
]

export const OPS_DS_DAGS = [
  {
    id: 'dag.trade_dwd',
    name: 'dag.trade_dwd · 交易明细日批',
    status: 'failed',
    icon: '✕',
    tags: [
      { text: '阻断', cls: 'tag-red' },
      { text: '重试 2', cls: 'tag-orange' },
    ],
    meta: [
      { text: '失败环节：dwd_order_detail 质量门禁 PK_UNIQUE' },
      { text: 'dt=2026-09-02' },
    ],
    progressLabel: '进度',
    progressText: '62% 阻断',
    progress: 62,
    barColor: 'var(--danger)',
    route: '/quality',
  },
  {
    id: 'dag.user_daily',
    name: 'dag.user_daily · 用户主题日批',
    status: 'success',
    icon: '✓',
    tags: [{ text: '黄金', cls: 'tag-green' }],
    meta: [
      { text: 'ODS→DWD→DWS 全通过 · dt=2026-09-02' },
      { text: '耗时 48m' },
    ],
    progressLabel: '完成',
    progressText: '100%',
    progress: 100,
    barColor: 'var(--success)',
  },
  {
    id: 'dag.lifecycle_iceberg',
    name: 'dag.lifecycle_iceberg · 小文件治理',
    status: 'success',
    icon: '✓',
    tags: [],
    meta: [{ text: 'expire→rewrite→orphan' }, { text: '合并 2,847 小文件' }],
    progressLabel: '完成',
    progressText: '100% SLA内',
    progress: 100,
    barColor: 'var(--success)',
  },
  {
    id: 'dag.product_dws',
    name: 'dag.product_dws · 商品汇总',
    status: 'running',
    icon: '⚙️',
    tags: [],
    meta: [{ text: '当前 DWS 宽表 JOIN 74%' }, { text: '已运行 32m' }],
    progressLabel: '进度',
    progressText: '74%',
    progress: 74,
    barColor: 'linear-gradient(90deg,#1e6fff,#5cdbd3)',
  },
]

/** 湖/CK 对账 · RECONCILE_DATA */
export const OPS_RECONCILE = [
  {
    table: 'ads.ads_gmv_board',
    dt: '2026-09-02',
    ice: { rows: '18,427,891', amt: '¥ 32,846,572,118' },
    ck: { rows: '18,426,643', amt: '¥ 32,842,350,926' },
    diff: { rows: '-1,248', amt: '-¥ 4,221,192' },
    pass: false,
    reason: '疑似 DS 导入 CK 断点续传漏批次',
  },
  {
    table: 'ads.ads_user_profile',
    dt: '2026-09-02',
    ice: { rows: '4,280,192', amt: '—' },
    ck: { rows: '4,280,192', amt: '—' },
    diff: { rows: '0', amt: '合规' },
    pass: true,
  },
  {
    table: 'ads.ads_order_stat_daily',
    dt: '2026-09-02',
    ice: { rows: '8,723,149', amt: '¥ 128,573,290' },
    ck: { rows: '8,723,149', amt: '¥ 128,573,290' },
    diff: { rows: '0', amt: '0' },
    pass: true,
  },
  {
    table: 'ads.ads_user_tags',
    dt: '2026-09-02',
    ice: { rows: '42,818,921', amt: '—' },
    ck: { rows: '42,818,921', amt: '—' },
    diff: { rows: '0', amt: '合规' },
    pass: true,
  },
  {
    table: 'rt.dws_pv_1min (T-10min窗口)',
    dt: '2026-09-03 14:20',
    ice: { rows: '482,193', amt: 'PV 4,823,721' },
    ck: { rows: '482,193', amt: 'PV 4,823,721' },
    diff: { rows: '0', amt: '0' },
    pass: true,
    note: '实时分钟表',
  },
]

const STATUS_ICON_CLASS = {
  running: 'ts-running',
  success: 'ts-success',
  failed: 'ts-failed',
  warning: 'ts-warning',
  pending: 'ts-pending',
}

export function opsStatusIconClass(status) {
  return STATUS_ICON_CLASS[status] || 'ts-pending'
}
