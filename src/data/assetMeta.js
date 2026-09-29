/** 资产分层 / 业务域等枚举 */

export const ASSET_LAYERS = [
  { value: 'ods', label: 'ODS', full: 'ODS 原始层' },
  { value: 'dwd', label: 'DWD', full: 'DWD 明细层' },
  { value: 'dim', label: 'DIM', full: 'DIM 维度' },
  { value: 'dws', label: 'DWS', full: 'DWS 汇总层' },
  { value: 'ads', label: 'ADS', full: 'ADS 应用层' },
]

export const ASSET_DOMAINS = [
  { value: 'common', label: '通用' },
  { value: 'trade', label: '交易域' },
  { value: 'user', label: '用户域' },
  { value: 'goods', label: '商品域' },
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
  const code = domain === 'product' ? 'goods' : domain
  return ASSET_DOMAINS.find((d) => d.value === code) || ASSET_DOMAINS[0]
}

export function levelClass(level) {
  return ASSET_LEVELS.find((l) => l.value === level)?.class || 'tag-gray'
}

function compactSeg(raw, max = 24) {
  const s = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  if (!s) return ''
  return s.length > max ? s.slice(0, max).replace(/_+$/g, '') : s
}

/**
 * 从表名 + 数据源生成资产 id / 物理名。
 * 同表名跨数据源时用 dsCode / 源名 / 源 id 段区分，避免资产编码冲突。
 * 第 4 参兼容旧调用：传 database 字符串，或传 { database, dsCode, dsId, dsName }。
 */
export function buildAssetIdentity(layer, domain, tableName, opts = '') {
  const o = typeof opts === 'string' || opts == null ? { database: opts || '' } : opts
  const raw = String(tableName || '')
    .replace(/^GET\s+|^POST\s+|^PUT\s+/i, '')
    .replace(/[^\w.]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const short = raw.split(/[./]/).pop() || raw || 'table'
  const dsSeg =
    compactSeg(o.dsCode) ||
    compactSeg(o.dsName) ||
    compactSeg(o.dsId, 10) ||
    compactSeg(o.database) ||
    compactSeg(domain) ||
    'src'
  const id = `${layer}_${dsSeg}_${short}`.toLowerCase().replace(/_+/g, '_')
  const key = `${layer}_${dsSeg}.${short}`
  return { id, key, name: short, dsSeg }
}
