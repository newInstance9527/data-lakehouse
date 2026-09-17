/** 总览仪表盘 · 演示常量与模块入口 */

export const DEMO_SERVICE_STATS = {
  apis: 28,
  published: 22,
  draft: 4,
  deprecated: 2,
  callsToday: '32.4万',
  sla: '99.95%',
}

export const DEMO_METRIC_STATS = {
  total: 342,
  atomic: 86,
  derived: 198,
  composite: 58,
  certified: 210,
  pending: 12,
}

/** 简洁配色：主色 + 语义色 + 中性灰阶，避免彩虹色 */
export const OV_PALETTE = {
  primary: '#1e6fff',
  primarySoft: '#e8f0ff',
  success: '#00a676',
  successSoft: '#e6faf3',
  warning: '#fa8c16',
  warningSoft: '#fff7e6',
  danger: '#f5222d',
  dangerSoft: '#fff1f0',
  mute: '#94a3b8',
  muteSoft: '#f1f5f9',
  ink: '#1a2233',
  series: ['#1e6fff', '#00a676', '#64748b', '#fa8c16', '#94a3b8'],
}

export const OVERVIEW_MODULES = [
  { id: 'datasource', icon: '🗄️', title: '数据源', to: '/datasource' },
  { id: 'assets', icon: '📚', title: '资产表', to: '/catalog' },
  { id: 'etl', icon: '⚙️', title: 'ETL 任务', to: '/integration' },
  { id: 'lineage', icon: '🔗', title: '字段血缘', to: '/lineage' },
  { id: 'standard', icon: '📐', title: '数据标准', to: '/standard' },
  { id: 'service', icon: '🔌', title: '数据服务', to: '/dataservice' },
  { id: 'metrics', icon: '📊', title: '指标', to: '/metrics' },
  { id: 'quality', icon: '✅', title: '数据质量', to: '/quality' },
]

/** 按时间范围的演示趋势（不改 live mock 口径，只改走势观感） */
export const OV_TRENDS = {
  '1d': {
    labels: ['00', '04', '08', '12', '16', '20', '24'],
    quality: [91, 90, 92, 91, 93, 92, 93],
    apiCalls: [2.1, 1.4, 3.8, 5.2, 4.6, 6.1, 4.2],
    etlOk: [18, 12, 28, 35, 30, 22, 16],
  },
  '7d': {
    labels: ['一', '二', '三', '四', '五', '六', '日'],
    quality: [88, 89, 90, 91, 90, 92, 93],
    apiCalls: [28, 32, 30, 35, 38, 29, 32],
    etlOk: [142, 150, 138, 162, 155, 120, 148],
  },
  '30d': {
    labels: ['W1', 'W2', 'W3', 'W4'],
    quality: [86, 89, 91, 93],
    apiCalls: [110, 118, 125, 132],
    etlOk: [520, 540, 560, 580],
  },
  q: {
    labels: ['M1', 'M2', 'M3'],
    quality: [84, 89, 93],
    apiCalls: [320, 360, 390],
    etlOk: [1600, 1750, 1820],
  },
}

export const OV_PIPELINE = [
  { id: 'in', label: '接入', sub: '源 / CDC', to: '/datasource' },
  { id: 'lake', label: '入湖加工', sub: 'Flink · Spark', to: '/integration' },
  { id: 'asset', label: '资产治理', sub: '目录 · 标准 · 血缘', to: '/catalog' },
  { id: 'govern', label: '质量安全', sub: '规则 · 脱敏', to: '/quality' },
  { id: 'serve', label: '服务消费', sub: 'API · 指标 · 查询', to: '/dataservice' },
]
