/**
 * 操作权限资源类型注册表（与后端 LhOpsResourceTypeEnum 对齐）
 * enabled=true 可申请；其余 reserved 不进下拉。
 */
export const OPS_RESOURCE_TYPES = [
  { value: 'datasource', label: '数据源', enabled: true },
  { value: 'asset', label: '资产', enabled: true },
  { value: 'etl', label: 'ETL 任务', enabled: true },
  { value: 'quality', label: '质量', enabled: false },
  { value: 'standard', label: '数据标准', enabled: false },
  { value: 'metric', label: '指标', enabled: false },
  { value: 'dataservice', label: '数据服务', enabled: false },
  { value: 'export', label: '出湖作业', enabled: false },
]

export const OPS_RESOURCE_ENABLED = OPS_RESOURCE_TYPES.filter((t) => t.enabled)

export function opsResourceLabel(type) {
  const hit = OPS_RESOURCE_TYPES.find((t) => t.value === type)
  return hit?.label || type || '资源'
}

export function isOpsResourceEnabled(type) {
  return OPS_RESOURCE_ENABLED.some((t) => t.value === type)
}
