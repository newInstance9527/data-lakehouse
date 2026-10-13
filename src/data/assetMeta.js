/** 资产分层 / 业务域等枚举 */

export const ASSET_LAYERS = [
  { value: 'src', label: 'SRC', full: '原始业务库' },
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

/** 数据源 type → 清单 objectKind（与后端 LhInventoryObjectKinds.ofType 对齐） */
export function objectKindFromDsType(typeCode) {
  const t = String(typeCode || '').toLowerCase().trim()
  if (!t) return ''
  if (/kafka|pulsar/.test(t)) return 'topic'
  if (/rabbit/.test(t)) return 'queue'
  if (/elastic|opensearch/.test(t)) return 'index'
  if (/redis/.test(t)) return 'key_prefix'
  if (/^(s3|minio|s3_minio)$/.test(t) || t.includes('minio')) return 'bucket'
  if (/hdfs|ftp|sftp|^file$/.test(t)) return 'path'
  if (/mongo/.test(t)) return 'collection'
  if (/http|rest|openapi|tableau|superset|airflow/.test(t)) return 'endpoint'
  if (/hive|iceberg|hbase|mysql|mariadb|postgres|pg|oracle|sqlserver|clickhouse|doris|starrocks|trino|presto/.test(t)) {
    return 'table'
  }
  return 'object'
}

/**
 * 资产名称字段 UI 文案（`name`=技术侧标识，`cnName`=业务侧名称）。
 * - 卡片/详情：按 assetKind（缺省再按数据源 type 推断）用专名，如表名 / Topic 名
 * - 列表表头混排：统一「技术名称 / 业务名称」
 */
export function assetNameLabels(assetOrKind) {
  let kind = ''
  if (typeof assetOrKind === 'string') {
    kind = assetOrKind
  } else if (assetOrKind && typeof assetOrKind === 'object') {
    kind =
      assetOrKind.assetKind ||
      assetOrKind.kind ||
      assetOrKind.objectKind ||
      objectKindFromDsType(assetOrKind.sourceType || assetOrKind.type) ||
      'table'
  } else {
    kind = 'table'
  }
  kind = String(kind).toLowerCase().trim()
  const map = {
    table: { tech: '表名', biz: '表中文名' },
    topic: { tech: 'Topic 名', biz: 'Topic 中文名' },
    index: { tech: '索引名', biz: '索引中文名' },
    searchindex: { tech: '索引名', biz: '索引中文名' },
    container: { tech: '容器名', biz: '容器中文名' },
    bucket: { tech: '桶名', biz: '桶中文名' },
    queue: { tech: '队列名', biz: '队列中文名' },
    path: { tech: '路径名', biz: '路径中文名' },
    fileset: { tech: '文件集名', biz: '文件集中文名' },
    collection: { tech: '集合名', biz: '集合中文名' },
    key: { tech: '键名', biz: '键中文名' },
    key_prefix: { tech: '键前缀', biz: '业务名称' },
    endpoint: { tech: '接口名', biz: '接口中文名' },
    object: { tech: '对象名', biz: '业务名称' },
  }
  const hit = map[kind] || map.object
  return {
    ...hit,
    kind,
    /** 列表表头（混类型）：治理口径 */
    techCol: '技术名称',
    bizCol: '业务名称',
  }
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
