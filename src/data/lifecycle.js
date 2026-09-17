/** 生命周期与小文件治理 · 对齐演示 HTML */

export const LC_KPIS = [
  {
    icon: '💾',
    color: 'blue',
    value: '4.2',
    unit: 'TB',
    label: '总存储',
    trend: '热 1.1 / 温 2.8 / 冷 0.3',
  },
  {
    icon: '🧹',
    color: 'green',
    value: '186',
    unit: 'GB',
    label: '本月清理',
    trend: '快照 92 + 孤儿 64 + 归档 30',
  },
  {
    icon: '📦',
    color: 'purple',
    value: '2.1',
    unit: 'k',
    label: '小文件合并',
    trend: '→ 412 个大文件',
  },
  {
    icon: '🗄️',
    color: 'orange',
    value: '38',
    unit: '分区',
    label: '归档候选',
    trend: '90 天前 ODS',
  },
  {
    icon: '⚠️',
    color: 'red',
    value: '1',
    unit: '项',
    label: '合规删除待审',
    trend: 'user_88241 被遗忘权',
    trendDown: true,
  },
]

export const LC_STAGES = [
  {
    id: 'hot',
    icon: '🔥',
    title: '热数据',
    engine: 'ClickHouse',
    retention: '≤ 90 天',
    size: '1.1 TB',
    pct: '26% · 秒级查询',
  },
  {
    id: 'warm',
    icon: '💧',
    title: '温数据',
    engine: 'Iceberg on MinIO',
    retention: '全量保留',
    size: '2.8 TB',
    pct: '67% · Trino 湖上查询',
  },
  {
    id: 'cold',
    icon: '❄️',
    title: '冷数据',
    engine: 'MinIO 归档桶',
    retention: '合规保留期',
    size: '0.3 TB',
    pct: '7% · 可恢复',
  },
  {
    id: 'archive',
    icon: '📦',
    title: '物理销毁',
    engine: '备份到期后',
    retention: '不可逆',
    size: '—',
    pct: '合规删除触发',
  },
]

export const LC_JOBS = [
  {
    step: 1,
    name: 'expire_snapshots',
    desc: '快照过期',
    detail: 'ods/dwd 按保留策略逻辑删除',
    duration: '8 min',
    status: 'success',
  },
  {
    step: 2,
    name: 'rewrite_data_files',
    desc: '小文件合并（目标 256MB）',
    detail: 'L1/L2 表 compaction',
    duration: '42 min',
    status: 'success',
  },
  {
    step: 3,
    name: 'remove_orphan_files',
    desc: '孤儿文件清理',
    detail: '快照过期 +72h 后物理删',
    duration: '15 min',
    status: 'success',
  },
  {
    step: 4,
    name: 'expire_partitions',
    desc: '分区过期',
    detail: 'ODS 90 天前归档候选',
    duration: '6 min',
    status: 'success',
  },
]

export const LC_STORAGE = [
  {
    table: 'dwd_order_detail',
    layer: 'DWD',
    size: '842 GB',
    files: 412,
    growth: '+2.1%',
    policy: '温·7天快照',
    status: 'ok',
  },
  {
    table: 'ods_trade.s_order',
    layer: 'ODS',
    size: '1.2 TB',
    files: 1280,
    growth: '+3.8%',
    policy: '热→温 90天',
    status: 'warn',
  },
  {
    table: 'dwd_log_action',
    layer: 'DWD',
    size: '620 GB',
    files: 890,
    growth: '+8.5%',
    policy: '需小文件合并',
    status: 'warn',
  },
  {
    table: 'dws_order_1d',
    layer: 'DWS',
    size: '128 GB',
    files: 48,
    growth: '+0.3%',
    policy: '冷归档候选',
    status: 'ok',
  },
  {
    table: 'ads_gmv_board',
    layer: 'ADS',
    size: '12 GB',
    files: 16,
    growth: '+5.2%',
    policy: '热·CK',
    status: 'ok',
  },
]

export const LC_SNAPSHOT_POLICIES = [
  { table: 'ods_trade.s_order', keepCount: 20, keepDays: 3, minSnapshots: 5, daysTag: 'tag-red' },
  { table: 'dwd_trade.dwd_order_detail', keepCount: 20, keepDays: 7, minSnapshots: 5, daysTag: '' },
  { table: 'dws_trade.dws_order_1d', keepCount: 15, keepDays: 7, minSnapshots: 5, daysTag: '' },
  { table: 'ads.ads_gmv_board', keepCount: 10, keepDays: 14, minSnapshots: 3, daysTag: '' },
]

export const LC_COMPACTION = [
  { table: 'ods_trade.s_order', level: 'L1', levelCls: 'tag-red', files: 128, avgSize: '12MB', sla: '15min', ok: false },
  { table: 'dwd_order_detail', level: 'L2', levelCls: 'tag-orange', files: 62, avgSize: '28MB', sla: '1h', ok: false },
  { table: 'dws_order_1d', level: 'L3', levelCls: 'tag-blue', files: 8, avgSize: '256MB', sla: '日批', ok: true },
  { table: 'ads_gmv_board', level: 'L3', levelCls: 'tag-blue', files: 3, avgSize: '512MB', sla: '日批', ok: true },
]

export const LC_ORPHAN = [
  { bucket: 'iceberg-ods', files: '412 个', space: '38GB', window: '+72h ✓', status: '已清理', statusCls: 'tag-green' },
  { bucket: 'iceberg-dwd', files: '186 个', space: '18GB', window: '+72h ✓', status: '已清理', statusCls: 'tag-green' },
  { bucket: 'iceberg-dws', files: '52 个', space: '8GB', window: '等待中', status: '+48h', statusCls: 'tag-orange' },
]

export function lcJobStatusMeta(status) {
  return (
    {
      success: { cls: 'success', tag: 'tag-green', label: '成功' },
      warn: { cls: 'warn', tag: 'tag-orange', label: '告警' },
      failed: { cls: 'failed', tag: 'tag-red', label: '失败' },
    }[status] || { cls: 'success', tag: 'tag-green', label: '成功' }
  )
}
