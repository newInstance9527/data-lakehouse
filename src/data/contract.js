/** 数据契约 · Schema Registry · CDC · Iceberg 演进 */

export const CONTRACT_KPIS = [
  {
    icon: '📜',
    color: 'blue',
    value: '8',
    unit: '个',
    label: '注册 Schema',
    trend: '演示清单 8 条',
    trendUp: true,
  },
  {
    icon: '✅',
    color: 'green',
    value: '6',
    unit: '个',
    label: '兼容通过',
    trend: 'BACKWARD 默认',
    trendUp: true,
  },
  {
    icon: '⚠️',
    color: 'orange',
    value: '1',
    unit: '个',
    label: '破坏性变更',
    trend: '走变更单',
    trendUp: false,
  },
  {
    icon: '🔄',
    color: 'purple',
    value: '1',
    unit: '条',
    label: 'CDC 删除传播',
    trend: '全链路覆盖',
    trendUp: true,
  },
  {
    icon: '🚫',
    color: 'red',
    value: '1',
    unit: '个',
    label: '阻断中',
    trend: 's_order 改列',
    trendUp: false,
  },
]

export const CONTRACT_SCHEMAS = [
  {
    name: 'ods_trade.s_order',
    type: 'Avro',
    version: 'v3',
    compat: 'BACKWARD',
    fields: 24,
    change: '2026-08-15 加列 pay_method',
    status: 'ok',
  },
  {
    name: 'ods_trade.s_user',
    type: 'Avro',
    version: 'v2',
    compat: 'BACKWARD',
    fields: 18,
    change: '2026-07-20 加列 user_status',
    status: 'ok',
  },
  {
    name: 'ods_trade.s_refund',
    type: 'Avro',
    version: 'v2',
    compat: 'BACKWARD',
    fields: 12,
    change: '2026-08-01 加列 refund_reason',
    status: 'ok',
  },
  {
    name: 'topic_trade_order',
    type: 'Avro',
    version: 'v4',
    compat: 'BACKWARD',
    fields: 24,
    change: '2026-08-28 字段类型提升',
    status: 'ok',
  },
  {
    name: 'topic_user_action',
    type: 'JSON',
    version: 'v5',
    compat: 'FORWARD',
    fields: 32,
    change: '2026-08-25 加可选字段',
    status: 'ok',
  },
  {
    name: 'ods_trade.s_order',
    type: 'Avro',
    version: 'v4(草案)',
    compat: 'BREAKING',
    fields: 22,
    change: '删列 amount → 改 pay_amt · 阻断中',
    status: 'fail',
  },
  {
    name: 'dim.dim_sku',
    type: 'Avro',
    version: 'v1',
    compat: 'FULL',
    fields: 16,
    change: '2026-06-10 初始注册',
    status: 'ok',
  },
  {
    name: 'topic_log_click',
    type: 'JSON',
    version: 'v3',
    compat: 'BACKWARD',
    fields: 28,
    change: '2026-08-10 加列 device_id',
    status: 'ok',
  },
]

export const CONTRACT_VERSIONS = [
  {
    ver: 'v1',
    date: '2026-06-01',
    change: '初始注册',
    compat: '—',
    fields: [
      'order_id BIGINT',
      'user_id BIGINT',
      'amount BIGINT(分)',
      'stat INT',
      'channel VARCHAR',
      'gmt_create TIMESTAMP',
    ],
  },
  {
    ver: 'v2',
    date: '2026-07-10',
    change: '加列 pay_type INT（可选）',
    compat: 'BACKWARD ✓',
    fields: ['... + pay_type INT'],
  },
  {
    ver: 'v3',
    date: '2026-08-15',
    change: '加列 pay_method INT（码值 STD-P0001）',
    compat: 'BACKWARD ✓',
    fields: ['... + pay_method INT'],
  },
  {
    ver: 'v4(草案)',
    date: '2026-09-01',
    change: '删列 amount → 改 pay_amt DECIMAL(18,2)；改主键',
    compat: 'BREAKING ✗',
    fields: ['删 amount · 加 pay_amt · 改主键 → 需新表+双跑'],
    status: 'fail',
  },
]

export const CONTRACT_CDC_FLOW = [
  { icon: '🗄️', title: '源库 DELETE', sub: 'binlog op=D' },
  { icon: '📡', title: 'Kafka', sub: '__deleted=true' },
  { icon: '🧊', title: 'ODS', sub: 'equality delete' },
  { icon: '📊', title: 'DWD', sub: '日批剔除/拉链闭链' },
  { icon: '📈', title: 'ADS → CK', sub: '重算+重导' },
]

export const ICEBERG_EVOLUTION_RULES = [
  {
    change: '加可选列',
    allow: 'ok',
    action: '作业先发，表再加；旧文件无该列视为 null',
    ck: 'ALTER TABLE ADD',
  },
  {
    change: '列改名',
    allow: 'warn',
    action: 'Iceberg 用列 ID 不靠名字；SQL/报表按 ID 映射后改展示名',
    ck: '—',
  },
  {
    change: '改类型（int→long）',
    allow: 'warn',
    action: '仅 Iceberg 支持的提升；CK 同步表单独 ALTER',
    ck: 'ALTER MODIFY',
  },
  {
    change: '删列 / 改主键 / 改分区',
    allow: 'fail',
    action: '新表 + 双跑 + 切读 + 下线旧表',
    ck: '新表重建',
  },
]

export const CONTRACT_CDC_SEMANTICS = [
  { q: '首次接入', a: '先全量快照（有界）再切增量；同一主键幂等写入 ODS' },
  { q: '有主键', a: 'Iceberg equality upsert；op=D 必须 delete，不能吞掉' },
  { q: '无主键表', a: '只允许 append-only ODS，或源端补业务键；禁止盲 upsert' },
  { q: '乱序 / 迟到', a: '事件时间 + watermark；迟到写入侧输出或修数 topic，不默默丢' },
  { q: '更新覆盖', a: 'ODS 保留 __op, __ts_ms, __deleted；DWD 再做成当前快照或拉链' },
  { q: '时区', a: '统一 UTC 存储，展示层转本地' },
  { q: '源库 DDL', a: '先契约，Flink 新版本兼容，再放行 binlog' },
]

export const CONTRACT_APPROVAL_TICKETS = [
  {
    id: 'CHG-2026-008',
    target: 'ods_trade.s_order',
    type: '删列',
    typeCls: 'tag-red',
    compat: '✗ BACKWARD',
    compatCls: 'tag-red',
    impact: '3 作业 · 2 报表',
    status: '阻断中',
    statusCls: 'tag-red',
  },
  {
    id: 'CHG-2026-007',
    target: 'dwd_user.user_info',
    type: '加列',
    typeCls: 'tag-green',
    compat: '✓ BACKWARD',
    compatCls: 'tag-green',
    impact: '1 作业',
    status: '已执行',
    statusCls: 'tag-green',
  },
  {
    id: 'CHG-2026-006',
    target: 'cdc.trade.order',
    type: '改类型',
    typeCls: 'tag-orange',
    compat: '⚠ 有限',
    compatCls: 'tag-orange',
    impact: '2 作业',
    status: '评审中',
    statusCls: 'tag-blue',
  },
  {
    id: 'CHG-2026-005',
    target: 'cdc.user.info',
    type: '加列',
    typeCls: 'tag-green',
    compat: '✓',
    compatCls: 'tag-green',
    impact: '0 作业',
    status: '已执行',
    statusCls: 'tag-green',
  },
]

export const CONTRACT_COMPAT_CHECK = [
  { field: 'order_id', old: 'BIGINT', neu: 'BIGINT', ok: true },
  { field: 'pay_amt', old: 'DECIMAL(18,2)', neu: '—', ok: false, label: '✗ 删列' },
  { field: 'buyer_mobile', old: 'STRING', neu: 'STRING', ok: true },
  { field: 'refund_amt', old: '—', neu: 'DECIMAL(18,2)', ok: true, label: '✓ 新增' },
]

const SCHEMA_STATUS = {
  ok: { tag: 'tag-green', label: '✓ 兼容' },
  warn: { tag: 'tag-orange', label: '⚠ 告警' },
  fail: { tag: 'tag-red', label: '✗ 阻断' },
}

const COMPAT_CLS = {
  BACKWARD: 'backward',
  FORWARD: 'forward',
  FULL: 'full',
  BREAKING: 'breaking',
}

export function contractSchemaStatusMeta(status) {
  return SCHEMA_STATUS[status] || SCHEMA_STATUS.ok
}

export function contractCompatClass(compat) {
  return COMPAT_CLS[compat] || 'backward'
}

export function icebergAllowMeta(allow) {
  if (allow === 'ok') return { tag: 'tag-green', label: '✓ 是' }
  if (allow === 'warn') return { tag: 'tag-orange', label: '⚠ 慎' }
  return { tag: 'tag-red', label: '✗ 否（直接）' }
}
