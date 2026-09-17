/** 基础设施监控 · §30 · 对齐演示 HTML */

export const INFRA_KPIS = [
  {
    icon: '🖥️',
    color: 'blue',
    value: '14',
    unit: '台',
    label: '节点',
    trend: '13 在线 · 1 NotReady',
    trendUp: true,
  },
  {
    icon: '✅',
    color: 'green',
    value: '98.2',
    unit: '%',
    label: '组件进程存活',
    trend: '22/22 进程 · 1 端口不通',
    trendUp: true,
  },
  {
    icon: '🚨',
    color: 'red',
    value: '7',
    unit: '条',
    label: '活跃告警',
    trend: 'P0×1 · P1×2 · P2×4',
    trendDanger: true,
  },
  {
    icon: '💽',
    color: 'orange',
    value: '78',
    unit: '%',
    label: '平均磁盘水位',
    trend: '3 节点 7 日内将满',
    trendWarn: true,
  },
]

export const INFRA_NODES = [
  { node: 'node-01', role: 'K8s Master', comps: 'etcd/apiserver', cpu: 34, mem: 41, disk: 52, net: '480MB/s', st: 'ok' },
  { node: 'node-02', role: 'K8s Master', comps: 'etcd/apiserver', cpu: 31, mem: 39, disk: 50, net: '410MB/s', st: 'ok' },
  { node: 'node-03', role: '存储', comps: 'MinIO', cpu: 28, mem: 33, disk: 91, net: '1.2GB/s', st: 'warn' },
  { node: 'node-04', role: '计算', comps: 'Flink TM', cpu: 88, mem: 76, disk: 60, net: '780MB/s', st: 'warn' },
  { node: 'node-05', role: '计算', comps: 'Flink TM', cpu: 62, mem: 58, disk: 48, net: '650MB/s', st: 'ok' },
  { node: 'node-06', role: '计算', comps: 'Spark/Trino', cpu: 71, mem: 64, disk: 55, net: '900MB/s', st: 'ok' },
  { node: 'node-07', role: '计算', comps: 'DS Worker', cpu: 0, mem: 0, disk: 73, net: '—', st: 'down' },
  { node: 'node-08', role: '计算', comps: 'CK', cpu: 54, mem: 61, disk: 67, net: '540MB/s', st: 'ok' },
  { node: 'node-09', role: '存储', comps: 'MinIO', cpu: 26, mem: 30, disk: 89, net: '1.1GB/s', st: 'warn' },
  { node: 'node-12', role: '计算', comps: 'Trino', cpu: 49, mem: 52, disk: 88, net: '430MB/s', st: 'warn' },
]

export const INFRA_PROCS = [
  { comp: 'Flink JM', inst: 'flink-jm-0', st: 'ok', metric: '堆 4.1/8G · 2 作业运行', act: '详情' },
  { comp: 'Flink TM', inst: 'flink-tm-0@node-04', st: 'warn', metric: '堆 6.2/8G · 反压 12.5万 lag', act: '链路→' },
  { comp: 'DS Master', inst: 'ds-master-0', st: 'ok', metric: '调度中 1 · 队列 3', act: '详情' },
  { comp: 'DS Worker', inst: 'ds-worker@node-07', st: 'down', metric: '端口不通 · 进程 down', act: '重试' },
  { comp: 'Trino', inst: 'trino-coord', st: 'ok', metric: '运行 4 · 队列 12', act: '详情' },
  { comp: 'MinIO', inst: 'minio@node-03', st: 'warn', metric: '单盘 /data3 91%', act: '扩容' },
  { comp: 'ClickHouse', inst: 'ck@node-08', st: 'ok', metric: '副本同步 OK · 18 表', act: '详情' },
  { comp: 'OpenMetadata', inst: 'om-server', st: 'ok', metric: '健康 · 元数据 1.2万', act: '详情' },
  { comp: 'Gravitino', inst: 'gravitino-0', st: 'ok', metric: 'Catalog 9 · 凭证 Vault', act: '详情' },
  { comp: 'Iceberg REST', inst: 'iceberg-rest-0', st: 'ok', metric: 'commit 正常', act: '详情' },
]

export const INFRA_ALERTS = [
  { sev: 'P0', t: 'node-07 NotReady', time: '03:21', host: 'node-07', act: '电话+加急+工单 · 平台组', live: true },
  { sev: 'P1', t: 'node-03 磁盘可用水 9%', time: '03:08', host: 'node-03', act: 'IM+工单 · 存储 owner', live: true },
  { sev: 'P1', t: 'DS Worker 端口不通', time: '03:21', host: 'node-07', act: 'IM+工单 · 平台组', live: true },
  { sev: 'P2', t: 'node-04 CPU 88% 持续10min', time: '02:55', host: 'node-04', act: 'IM群 · 交易域', live: true },
  { sev: 'P2', t: 'Flink TM 堆 6.2/8G', time: '02:40', host: 'node-04', act: 'IM群 · Flink owner', live: true },
  { sev: 'P2', t: 'CK 副本 lag 3min', time: '02:18', host: 'node-08', act: 'IM群 · CK owner', live: false },
  { sev: '容量', t: 'node-09/12 7日内磁盘将满', time: '00:00', host: '多节点', act: '日报+扩容建议', live: false },
]

export const INFRA_CAPACITY_TIPS = [
  {
    icon: '💽',
    bold: 'node-03 / node-09 / node-12',
    text: '：磁盘按 7 日增速预测 6/5/7 日内将满 → 建议清日志 + 扩容 MinIO 卷。',
  },
  {
    icon: '🧮',
    bold: 'flink-tm 队列',
    text: '：CPU 均值 73%，高峰 92%，7 日趋势上行 → 建议交易域补 2 台 TM。',
  },
  {
    icon: '💾',
    bold: 'Trino 队列',
    text: '：内存均值 64%，平稳，无需扩容。',
  },
  {
    icon: '💵',
    bold: '',
    text: '与 §24.3 成本同源：扩容建议自动生成预算影响。',
  },
]

export const INFRA_LAYER_ROWS = [
  { page: '任务运维', view: 'DS/Flink 任务、CDC lag、对账、质量（业务层）', highlight: false },
  { page: '链路调用监控', view: 'A–L 链路 span 瀑布与回放（调用层）', highlight: false },
  { page: '基础设施监控（本页）', view: '节点/容器/集群/进程 + 容量 + 告警（底座层）', highlight: true },
]

export function infraBarColor(v) {
  if (v > 85) return 'var(--danger)'
  if (v > 70) return 'var(--warning)'
  return '#52c41a'
}

export function infraNodeStatusTag(st) {
  if (st === 'ok') return { tag: 'tag-green', label: '在线' }
  if (st === 'warn') return { tag: 'tag-orange', label: '告警' }
  return { tag: 'tag-red', label: 'NotReady' }
}

export function infraProcStatusTag(st) {
  if (st === 'ok') return { tag: 'tag-green', label: '存活' }
  if (st === 'warn') return { tag: 'tag-orange', label: '告警' }
  return { tag: 'tag-red', label: 'DOWN' }
}

export function infraSevTag(sev) {
  if (sev === 'P0') return 'tag-red'
  if (sev === 'P1') return 'tag-orange'
  return 'tag-gray'
}
