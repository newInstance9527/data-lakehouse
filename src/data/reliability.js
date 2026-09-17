/** 可靠性中心 · 对齐演示 HTML page-reliability */

export const REL_KPIS = [
  {
    icon: '✅',
    color: 'green',
    value: '99.95',
    unit: '%',
    label: '平台 SLA',
    trend: '30 天可用率',
    trendUp: true,
  },
  {
    icon: '🛡️',
    color: 'blue',
    value: '8',
    unit: '/8',
    label: '组件 HA',
    trend: '全部达标',
    trendUp: true,
  },
  {
    icon: '⚡',
    color: 'orange',
    value: '15',
    unit: 'min',
    label: 'compaction SLA',
    trend: '高频表达标',
    trendUp: true,
  },
  {
    icon: '💾',
    color: 'purple',
    value: '24',
    unit: 'h',
    label: '备份 RPO',
    trend: '元数据每日备份',
    trendUp: true,
  },
  {
    icon: '⚠️',
    color: 'red',
    value: '1',
    unit: '次',
    label: '本月降级',
    trend: 'Gravitino 已恢复',
    trendUp: false,
    trendWarn: true,
  },
]

export const HA_COMPONENTS = [
  {
    name: 'Kafka',
    icon: '📡',
    ha: '3 副本, ISR',
    degrade: '入湖暂停；binlog 保留覆盖故障窗口',
    status: 'ok',
  },
  {
    name: 'Flink',
    icon: '⚡',
    ha: 'JM HA (K8s), checkpoint→MinIO',
    degrade: '从 checkpoint 恢复；超 RTO 只积压 Kafka',
    status: 'ok',
  },
  {
    name: 'Iceberg/MinIO',
    icon: '🧊',
    ha: '纠删码 + 3 AZ',
    degrade: '切只读；禁止先写本地盘当湖',
    status: 'ok',
  },
  {
    name: 'Gravitino',
    icon: '🗂️',
    ha: '2 副本 + DB HA',
    degrade: '只读缓存 + 禁止新表注册',
    status: 'warn',
  },
  {
    name: 'ClickHouse',
    icon: '📊',
    ha: '2 副本',
    degrade: '看板切 Trino 扫湖（慢但正确）',
    status: 'ok',
  },
  {
    name: 'Trino',
    icon: '🔍',
    ha: 'Coordinator 快速拉起 + Worker 弹性',
    degrade: '查询降级；入湖不受影响',
    status: 'ok',
  },
  {
    name: 'OpenMetadata',
    icon: '📚',
    ha: '可降级',
    degrade: '不影响生产',
    status: 'ok',
  },
  {
    name: 'DolphinScheduler',
    icon: '🐬',
    ha: 'Master HA',
    degrade: '批任务延迟，流不受影响',
    status: 'ok',
  },
]

export const COMPACTION_TABLES = [
  { table: 'ods_trade.s_order', rate: '8k ops/s', interval: '15 min', files: 42, sla: '达标' },
  { table: 'dwd_order_detail', rate: '3k ops/s', interval: '30 min', files: 28, sla: '达标' },
  { table: 'ods_trade.s_user', rate: '1.2k ops/s', interval: '60 min', files: 16, sla: '达标' },
  { table: 'dwd_user_info', rate: '800 ops/s', interval: '60 min', files: 12, sla: '达标' },
  { table: 'topic_log_click', rate: '15k ops/s', interval: '15 min', files: 86, sla: '告警' },
]

export const REL_BACKUP_ROWS = [
  {
    object: 'Gravitino 元数据',
    strategy: '每日全量 + 增量',
    rpo: '≤ 24h',
    last: '02:00 完成',
    lastTag: 'tag-green',
  },
  {
    object: 'OM 元数据',
    strategy: '每日全量',
    rpo: '≤ 24h',
    last: '02:15 完成',
    lastTag: 'tag-green',
  },
  {
    object: 'DS 元数据',
    strategy: '每日全量',
    rpo: '≤ 24h',
    last: '02:30 完成',
    lastTag: 'tag-green',
  },
  {
    object: 'Iceberg 元数据',
    strategy: 'snapshot JSON 随仓备份',
    rpo: '随写入',
    last: '实时',
    lastTag: 'tag-green',
  },
  {
    object: 'Iceberg 数据',
    strategy: 'MinIO 纠删码 + 桶版本',
    rpo: '—',
    last: '3 AZ',
    lastTag: 'tag-green',
  },
  {
    object: 'Kafka',
    strategy: '不备份（可重放 binlog）',
    rpo: '—',
    last: 'N/A',
    lastTag: 'tag-gray',
  },
  {
    object: 'ClickHouse',
    strategy: '可重建则不备份全量',
    rpo: '—',
    last: '仅实验表',
    lastTag: 'tag-gray',
  },
]

export const REL_RECONCILE_RULES = [
  {
    table: 'ads_gmv_board',
    rule: '行数对账',
    content: 'COUNT(*) Iceberg vs CK',
    threshold: '≤ 0',
    job: 'job.reconcile.gmv.row',
    ok: true,
    statusLabel: '✓ 通过',
  },
  {
    table: 'ads_gmv_board',
    rule: '金额对账',
    content: 'SUM(total_gmv)',
    threshold: '≤ 0.01 元',
    job: 'job.reconcile.gmv.amt',
    ok: false,
    statusLabel: '✗ 差 1,248',
  },
  {
    table: 'ads_user_summary',
    rule: '主键 hash',
    content: 'PK 集合差',
    threshold: '≤ 0.01%',
    job: 'job.reconcile.user.pk',
    ok: true,
    statusLabel: '✓ 通过',
  },
  {
    table: 'dws_order_1d',
    rule: '分区对账',
    content: '逐分区 checksum',
    threshold: '≤ 0',
    job: 'job.reconcile.dws.part',
    ok: true,
    statusLabel: '✓ 通过',
  },
]

export const REL_RECONCILE_HISTORY = [
  {
    time: '09-03 03:32',
    table: 'ads_gmv_board',
    rule: '金额',
    diff: '1,248',
    ok: false,
    drillDetail:
      '分区: dt=2026-09-02\n规则: 金额对账 SUM(total_gmv)\nIceberg: ¥32,846,000\nClickHouse: ¥32,844,752\n差异: 1,248 元\n下钻:\n① PK 集合差 12 条 → CK 少 12 行\n② 值不一致 1,236 行 → CK 旧值\n③ 关联 Flink CDC lag 12.5万 → 入湖延迟\n根因: CDC lag 导致 CK 双写漏数据\n修复: 强制重导 CK → 重跑对账',
  },
  {
    time: '09-03 03:31',
    table: 'ads_gmv_board',
    rule: '行数',
    diff: '0',
    ok: true,
  },
  {
    time: '09-02 03:30',
    table: 'ads_gmv_board',
    rule: '金额',
    diff: '0',
    ok: true,
  },
  {
    time: '09-01 03:31',
    table: 'ads_user_summary',
    rule: 'PK hash',
    diff: '0%',
    ok: true,
  },
]

export const REL_DELIST_FLOW = [
  { icon: '🚨', title: '对账失败', sub: '', tone: 'danger' },
  { icon: '⬇️', title: '摘牌', sub: '黄金标签移除', tone: 'danger' },
  { icon: '🔧', title: '重导 CK', sub: '执行中', tone: 'warning' },
  { icon: '🔄', title: '对账重跑', sub: '', tone: '' },
  { icon: '✅', title: '恢复黄金', sub: '', tone: '' },
]

export const REL_BACKUP_LOG =
  '近期备份：\n• 09-03 02:00 — 全量备份（成功 · 1.2TB）\n• 09-02 02:00 — 增量备份（成功 · 12GB）\n• 09-01 02:00 — 增量备份（成功 · 8GB）\n• 08-31 02:00 — 全量备份（成功 · 1.1TB）'

export function haStatusMeta(status) {
  return (
    {
      ok: { tag: 'tag-green', label: '正常' },
      warn: { tag: 'tag-orange', label: '降级中' },
      fail: { tag: 'tag-red', label: '故障' },
    }[status] || { tag: 'tag-green', label: '正常' }
  )
}

export function compactionSlaMeta(sla) {
  return (
    {
      达标: { tag: 'tag-green', label: '达标' },
      告警: { tag: 'tag-orange', label: '告警' },
    }[sla] || { tag: 'tag-green', label: sla || '达标' }
  )
}
