/** 总览仪表盘 · 配色、模块入口与主链路（统计由 useOverview 拉真实接口） */

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
  { id: 'datasource', icon: 'datasource', title: '数据源', to: '/datasource' },
  { id: 'assets', icon: 'catalog', title: '资产表', to: '/catalog' },
  { id: 'etl', icon: 'integration', title: 'ETL 任务', to: '/integration' },
  { id: 'lineage', icon: 'lineage', title: '字段血缘', to: '/lineage' },
  { id: 'standard', icon: 'standard', title: '数据标准', to: '/standard' },
  { id: 'service', icon: 'dataservice', title: '数据服务', to: '/dataservice' },
  { id: 'metrics', icon: 'metrics', title: '指标', to: '/metrics' },
  { id: 'quality', icon: 'quality', title: '数据质量', to: '/quality' },
  { id: 'apply', icon: 'apply', title: '申请单', to: '/apply' },
]

export const OV_PIPELINE = [
  { id: 'in', label: '接入', sub: '源 / CDC', to: '/datasource' },
  { id: 'lake', label: '入湖加工', sub: '流 · 批', to: '/integration' },
  { id: 'asset', label: '资产治理', sub: '目录 · 标准 · 血缘', to: '/catalog' },
  { id: 'govern', label: '质量安全', sub: '规则 · 脱敏', to: '/quality' },
  { id: 'serve', label: '服务消费', sub: 'API · 指标 · 查询', to: '/dataservice' },
]
