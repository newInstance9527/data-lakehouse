/** 数据契约 · 流程约定与展示助手（列表/KPI 走 Registry API，禁止假行） */

export const CONTRACT_CDC_FLOW = [
  { icon: '🗄️', title: '源库 DELETE', sub: 'binlog op=D' },
  { icon: '📡', title: 'Kafka', sub: '__deleted=true' },
  { icon: '🧊', title: 'ODS', sub: 'equality delete' },
  { icon: '📊', title: 'DWD', sub: '日批剔除/拉链闭链' },
  { icon: '📈', title: 'ADS → 加速层', sub: '重算+重导' },
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
    action: '湖表用列 ID 不靠名字；SQL/报表按 ID 映射后改展示名',
    ck: '—',
  },
  {
    change: '改类型（int→long）',
    allow: 'warn',
    action: '仅湖表支持的提升；加速层同步表单独 ALTER',
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
  { q: '有主键', a: '湖表等式 upsert；op=D 必须 delete，不能吞掉' },
  { q: '无主键表', a: '只允许 append-only ODS，或源端补业务键；禁止盲 upsert' },
  { q: '乱序 / 迟到', a: '事件时间 + watermark；迟到写入侧输出或修数 topic，不默默丢' },
  { q: '更新覆盖', a: 'ODS 保留 __op, __ts_ms, __deleted；DWD 再做成当前快照或拉链' },
  { q: '时区', a: '统一 UTC 存储，展示层转本地' },
  { q: '源库 DDL', a: '先契约，流作业新版本兼容，再放行 binlog' },
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
