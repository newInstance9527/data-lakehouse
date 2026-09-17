/** 资产分层 / 业务域等枚举 */

export const ASSET_LAYERS = [
  { value: 'ods', label: 'ODS', full: 'ODS 原始层' },
  { value: 'dwd', label: 'DWD', full: 'DWD 明细层' },
  { value: 'dim', label: 'DIM', full: 'DIM 维度' },
  { value: 'dws', label: 'DWS', full: 'DWS 汇总层' },
  { value: 'ads', label: 'ADS', full: 'ADS 应用层' },
]

export const ASSET_DOMAINS = [
  { value: 'trade', label: '交易域' },
  { value: 'user', label: '用户域' },
  { value: 'product', label: '商品域' },
  { value: 'marketing', label: '营销域' },
  { value: 'finance', label: '财务域' },
]

export const ASSET_LEVELS = [
  { value: '公开', class: 'tag-gray' },
  { value: '内部', class: 'tag-blue' },
  { value: '敏感', class: 'tag-orange' },
  { value: '机密', class: 'tag-red' },
]

export function layerMeta(layer) {
  return ASSET_LAYERS.find((l) => l.value === layer) || ASSET_LAYERS[0]
}

export function domainMeta(domain) {
  return ASSET_DOMAINS.find((d) => d.value === domain) || ASSET_DOMAINS[0]
}

export function levelClass(level) {
  return ASSET_LEVELS.find((l) => l.value === level)?.class || 'tag-gray'
}

/** 从表名生成资产 id / 物理名 */
export function buildAssetIdentity(layer, domain, tableName, database = '') {
  const raw = String(tableName || '')
    .replace(/^GET\s+|^POST\s+|^PUT\s+/i, '')
    .replace(/[^\w.]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const short = raw.split(/[./]/).pop() || raw || 'table'
  const id = `${layer}_${short}`.toLowerCase().replace(/_+/g, '_')
  const db = database ? String(database).replace(/[^\w]/g, '_') : domain
  const key = `${layer}_${db}.${short}`
  return { id, key, name: short }
}
