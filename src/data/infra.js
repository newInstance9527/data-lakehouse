/** 基础设施监控 · §30 · helpers + 分层 taxonomy（禁止假 KPI / 假节点） */

/** 三页分工说明（taxonomy，非采集数据） */
export const INFRA_LAYER_ROWS = [
  { page: '任务运维', view: '批/流任务、CDC 延迟、对账、质量（业务层）', highlight: false },
  { page: '链路调用监控', view: 'A–L 链路 span 瀑布与回放（调用层）', highlight: false },
  { page: '基础设施监控（本页）', view: '节点/容器/集群/进程 + 容量 + 告警（底座层）', highlight: true },
]

/** 无采集时 KPI 空壳（value 一律 —，禁止演示数字） */
export function emptyInfraKpis() {
  return [
    { icon: '🖥️', color: 'blue', value: '—', unit: '台', label: '节点', trend: '无采集', trendUp: true },
    { icon: '✅', color: 'green', value: '—', unit: '%', label: '组件进程存活', trend: '无采集', trendUp: true },
    { icon: '🚨', color: 'red', value: '—', unit: '条', label: '活跃告警', trend: '无采集', trendDanger: true },
    { icon: '💽', color: 'orange', value: '—', unit: '%', label: '平均磁盘水位', trend: '无采集', trendWarn: true },
  ]
}

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
