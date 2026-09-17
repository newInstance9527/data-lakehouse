/** 链路调用监控 · §29 · 对齐演示 HTML */

export const LT_KPIS = [
  {
    icon: '🧵',
    color: 'blue',
    value: '2.41',
    unit: 'M',
    label: '今日 span',
    trend: '批+查询全量 · 流采样',
    trendUp: true,
  },
  {
    icon: '🐢',
    color: 'orange',
    value: '37',
    unit: '条',
    label: '慢 span(超p99×2)',
    trend: 'Flink.parse 占 21',
    trendWarn: true,
  },
  {
    icon: '🚨',
    color: 'red',
    value: '5',
    unit: '条',
    label: '失败 span',
    trend: '链路 I/C 各含 1',
    trendDanger: true,
  },
  {
    icon: '📡',
    color: 'green',
    value: '98.4',
    unit: '%',
    label: '采样覆盖',
    trend: 'A/C/D/I 已全量',
    trendUp: true,
  },
]

export const LT_LINKS = [
  { id: 'A', name: 'CDC 入湖', sample: true },
  { id: 'B', name: '埋点实时', sample: false },
  { id: 'C', name: '离线日批', sample: true },
  { id: 'D', name: '即席查询', sample: false },
  { id: 'E', name: '申请授权', sample: false },
  { id: 'F', name: '质量校验', sample: false },
  { id: 'G', name: '血缘变更', sample: false },
  { id: 'H', name: '根因(消费)', sample: false },
  { id: 'I', name: '湖/CK对账', sample: true },
  { id: 'J', name: '出湖回流', sample: false },
  { id: 'K', name: '合规删除', sample: false },
  { id: 'L', name: '作业发布', sample: false },
]

// span 样本：每条 trace = 一次端到端调用，含若干 hop span（相对 start_ms / dur_ms）
// 与现有「ads_gmv_board 对账失败 / CDC lag 12.5万」故事线对齐，便于跨页串联
export const LT_TRACES = [
  {
    trace_id: 'trc-cdc-A-09-03-0015',
    link_id: 'A',
    link_name: 'CDC 入湖',
    run_id: 'flink-cdc-trade-order',
    started_at: '2026-09-03 00:15:02',
    summary: 'cdc.trade.order · Flink CDC 入湖',
    spans: [
      {
        svc: 'Flink CDC',
        op: 'cdc.read',
        status: 'ok',
        start: 0,
        dur: 320,
        span_id: 's-a1',
        event_id: 'ord-8827341',
        msg: 'binlog 位点 mysql-bin.009872:412 → 读取 8.4万行',
      },
      {
        svc: 'Kafka',
        op: 'kafka.append',
        status: 'ok',
        start: 330,
        dur: 90,
        span_id: 's-a2',
        event_id: 'ord-8827341',
        msg: 'topic cdc.trade.order 追加 8.4万条',
      },
      {
        svc: 'Flink',
        op: 'flink.parse',
        status: 'warn',
        start: 425,
        dur: 510,
        span_id: 's-a3',
        event_id: 'ord-8827341',
        msg: '反压告警 · consumer lag 12.5万条 ≈ 12min',
        log_offset: 'flink-tm-trade.log:8841',
      },
      {
        svc: 'Iceberg',
        op: 'sink.iceberg',
        status: 'ok',
        start: 940,
        dur: 420,
        span_id: 's-a4',
        event_id: 'ord-8827341',
        msg: 'upsert ods_trade.s_order dt=2026-09-02',
      },
      {
        svc: 'Iceberg',
        op: 'commit',
        status: 'ok',
        start: 1365,
        dur: 180,
        span_id: 's-a5',
        event_id: 'ord-8827341',
        msg: 'snapshot 8821043 · 1,084,232 行',
      },
    ],
  },
  {
    trace_id: 'trc-batch-C-09-03-0200',
    link_id: 'C',
    link_name: '离线日批',
    run_id: 'ds-dag-trade-dwd-20260902',
    started_at: '2026-09-03 02:00:11',
    summary: 'dag.trade_dwd · 交易主题日批',
    spans: [
      {
        svc: 'DolphinScheduler',
        op: 'dag.run',
        status: 'ok',
        start: 0,
        dur: 220,
        span_id: 's-c1',
        event_id: '',
        msg: 'dag.trade_dwd dt=2026-09-02 启动 · 7 个 task',
      },
      {
        svc: 'OpenMetadata',
        op: 'dq.gate',
        status: 'error',
        start: 225,
        dur: 150,
        span_id: 's-c2',
        event_id: 'PK_UNIQUE',
        error: 'QUALITY_GATE_BLOCKED',
        log_offset: 'om-quality.log:2293',
        msg: 'dwd_order_detail 主键重复 1.2% · PK_UNIQUE fail 12,842 行 → 阻断 DWS/ADS',
      },
      {
        svc: 'Iceberg',
        op: 'dwd.task',
        status: 'ghost',
        start: 380,
        dur: 300,
        span_id: 's-c3',
        event_id: '',
        msg: '（被门禁阻断，未执行）',
      },
      {
        svc: 'Iceberg',
        op: 'dws.task',
        status: 'ghost',
        start: 690,
        dur: 300,
        span_id: 's-c4',
        event_id: '',
        msg: '（被门禁阻断，未执行）',
      },
      {
        svc: 'ClickHouse',
        op: 'ck.import',
        status: 'ghost',
        start: 1000,
        dur: 120,
        span_id: 's-c5',
        event_id: '',
        msg: '（被门禁阻断，未执行）',
      },
    ],
  },
  {
    trace_id: 'trc-recon-I-09-03-0318',
    link_id: 'I',
    link_name: '湖/CK对账',
    run_id: 'recon-ads-gmv-board-20260902',
    started_at: '2026-09-03 03:18:40',
    summary: 'ads_gmv_board · 湖/CK 对账（失败）',
    spans: [
      {
        svc: '对账作业',
        op: 'recon.run',
        status: 'ok',
        start: 0,
        dur: 240,
        span_id: 's-i1',
        event_id: 'recon-20260902',
        msg: 'ads_gmv_board dt=2026-09-02 比对启动',
      },
      {
        svc: '对账作业',
        op: 'recon.diff',
        status: 'error',
        start: 245,
        dur: 380,
        span_id: 's-i2',
        event_id: 'recon-20260902',
        error: 'RECON_THRESHOLD_EXCEEDED',
        log_offset: 'recon-audit.log:2841',
        msg: '行数差 1,248 · 金额差 ¥4.2万（Iceberg 1,084,232 vs ClickHouse 1,082,984）',
      },
      {
        svc: 'OpenMetadata',
        op: 'golden.revoke',
        status: 'warn',
        start: 630,
        dur: 60,
        span_id: 's-i3',
        event_id: 'recon-20260902',
        msg: '摘牌黄金标签 · Superset 看板红底「数据未就绪」',
      },
    ],
  },
]

export function spanStatusTag(status) {
  if (status === 'error') return { tag: 'tag-red', label: 'ERROR' }
  if (status === 'warn') return { tag: 'tag-orange', label: 'WARN' }
  if (status === 'ghost') return { tag: 'tag-gray', label: 'SKIP' }
  return { tag: 'tag-green', label: 'OK' }
}

export function spanBarClass(status) {
  if (status === 'ok') return 'ok'
  if (status === 'warn') return 'warn'
  if (status === 'error') return 'error'
  return 'ghost'
}

export function findTraceByLink(linkId) {
  return LT_TRACES.find((t) => t.link_id === linkId) || null
}

export function findSpan(traceId, spanId) {
  const tr = LT_TRACES.find((t) => t.trace_id === traceId)
  if (!tr) return null
  const span = tr.spans.find((s) => s.span_id === spanId)
  return span ? { trace: tr, span } : null
}
