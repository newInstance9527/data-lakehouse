/** 表/Topic 等清单：字符串 <-> 列表 / 表元数据 */

const CN_HINTS = {
  order: '订单',
  order_item: '订单明细',
  payment: '支付',
  refund: '退款',
  user: '用户',
  sku: '商品SKU',
  goods: '商品',
  member: '会员',
  bill: '账单',
  stock: '库存',
  warehouse: '仓库',
  invoice: '发票',
  customer: '客户',
  leads: '线索',
  gmv: 'GMV',
  profile: '画像',
  log: '日志',
  event: '事件',
  cdc: 'CDC',
  dlq: '死信',
  metrics: '指标',
  notify: '通知',
  session: '会话',
  tag: '标签',
  dim: '维度',
  ads: '应用层',
  dwd: '明细层',
  dws: '汇总层',
  ods: '贴源层',
}

function guessCnName(name) {
  const raw = String(name || '')
  const base = raw.split(/[./:]/).pop() || raw
  const key = base.toLowerCase().replace(/^s_/, '').replace(/^public\./, '')
  for (const [k, v] of Object.entries(CN_HINTS)) {
    if (key.includes(k)) return v + (key === k ? '' : '表')
  }
  if (/^get\s/i.test(raw)) return '查询接口'
  if (/^post\s/i.test(raw)) return '写入接口'
  if (/^put\s/i.test(raw)) return '更新接口'
  return base || '未命名'
}

function defaultEncoding(type) {
  const t = String(type || '')
  if (/Oracle|SQL Server|AzureSQL/i.test(t)) return 'GBK'
  if (/Elastic|OpenSearch|Mongo|Kafka|Pulsar|Redis/i.test(t)) return 'UTF-8'
  if (/S3|MinIO|HDFS|FTP|GCS|ADLS/i.test(t)) return 'UTF-8'
  return 'utf8mb4'
}

function defaultEngine(type) {
  const t = String(type || '')
  if (/MySQL|MariaDB/i.test(t)) return 'InnoDB'
  if (/PostgreSQL/i.test(t)) return 'heap'
  if (/ClickHouse/i.test(t)) return 'MergeTree'
  if (/Doris|StarRocks/i.test(t)) return 'OLAP'
  if (/Hive|Iceberg|Delta/i.test(t)) return 'Iceberg'
  if (/Oracle/i.test(t)) return 'Oracle'
  if (/SQL Server|AzureSQL/i.test(t)) return 'InnoDB-like'
  if (/Mongo/i.test(t)) return 'WiredTiger'
  if (/Kafka|Pulsar|Redpanda/i.test(t)) return 'Log'
  if (/Elastic|OpenSearch/i.test(t)) return 'Lucene'
  if (/Redis/i.test(t)) return 'Redis'
  if (/S3|MinIO|HDFS|FTP/i.test(t)) return 'Object'
  return '—'
}

export function parseSchemaList(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === 'string' ? x.trim() : String(x?.name || '').trim()))
      .filter(Boolean)
  }
  return String(value)
    .split(/[/|,，\n\r]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

export function joinSchemaList(items) {
  if (Array.isArray(items) && items.length && typeof items[0] === 'object') {
    return items.map((t) => t.name).filter(Boolean).join('/')
  }
  return parseSchemaList(items).join('/')
}

export function isInventoryField(field) {
  if (!field) return false
  if (['schema', 'topics', 'queues'].includes(field.n)) return true
  return String(field.l || '').includes('清单')
}

export function enrichTableMeta(name, type = 'MySQL', extras = {}) {
  const n = String(name || '').trim()
  const now = extras.syncedAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
  return {
    name: n,
    cnName: extras.cnName || guessCnName(n),
    comment: extras.comment || `${guessCnName(n)} · 来自 ${type} 元数据同步`,
    encoding: extras.encoding || defaultEncoding(type),
    engine: extras.engine || defaultEngine(type),
    rowCount: extras.rowCount ?? Math.floor(Math.random() * 900000) + 1000,
    syncedAt: now,
  }
}

/** 从 schema 字符串或 tables 数组得到完整表项列表 */
export function resolveTables(source) {
  if (!source) return []
  if (Array.isArray(source.tables) && source.tables.length) {
    return source.tables.map((t) =>
      typeof t === 'string' ? enrichTableMeta(t, source.type) : { ...enrichTableMeta(t.name, source.type, t), ...t },
    )
  }
  return parseSchemaList(source.schema).map((name) => enrichTableMeta(name, source.type))
}

/** 静态演示：仅样例页可用；注册弹窗禁止再调用（会生成 {seed}_user 等假表） */
export function mockSyncItems(type = 'MySQL', fieldName = 'schema', seed = '') {
  return mockSyncTables(type, fieldName, seed).map((t) => t.name)
}

/** 生成完整表元数据列表 */
export function mockSyncTables(type = 'MySQL', fieldName = 'schema', seed = '') {
  const t = String(type || 'MySQL')
  const base = String(seed || '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 12)
  const p = base || t.toLowerCase().replace(/\s+/g, '_')
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')

  let names = []
  if (fieldName === 'topics' || /Topic/i.test(fieldName)) {
    names = [`${p}.events`, `${p}.cdc`, `${p}.dlq`, `${p}.metrics`]
  } else if (fieldName === 'queues' || /Queue/i.test(fieldName)) {
    names = [`${p}.notify`, `${p}.refund`, `${p}.retry`, `${p}.dead`]
  } else if (/Index|索引/i.test(fieldName) || /Elastic|OpenSearch/i.test(t)) {
    names = [`logs-${p}-*`, `${p}-trace-*`, `${p}-metrics`]
  } else if (/Bucket|路径|文件|Key/i.test(fieldName) || /S3|MinIO|HDFS|FTP|GCS|ADLS/i.test(t)) {
    names = [`${p}/raw/`, `${p}/archive/`, `${p}/tmp/`, `${p}/export/`]
  } else if (/接口|OpenAPI|REST|HTTP/i.test(fieldName + t)) {
    names = [`GET /${p}`, `POST /${p}`, `GET /${p}/{id}`, `PUT /${p}/{id}`]
  } else if (/集合|Mongo/i.test(fieldName + t)) {
    names = [`${p}_docs`, `${p}_meta`, `${p}_audit`]
  } else if (/表族|HBase/i.test(fieldName + t)) {
    names = [`${p}:cf_info`, `${p}:cf_metric`, `${p}:cf_log`]
  } else if (/命名空间|Cassandra/i.test(fieldName + t)) {
    names = [`${p}.orders`, `${p}.users`, `${p}.events`]
  } else {
    names = [
      `${p}_order`,
      `${p}_order_item`,
      `${p}_payment`,
      `${p}_user`,
      `${p}_refund`,
      `${p}_sku`,
      `${p}_inventory`,
      `${p}_shipment`,
      `${p}_coupon`,
      `${p}_audit_log`,
      `${p}_config`,
      `${p}_dict`,
    ]
  }

  return names.map((name) => enrichTableMeta(name, t, { syncedAt: now }))
}

export function schemaSummary(value, limit = 3) {
  const items = parseSchemaList(value)
  if (!items.length) return { text: '(未同步 Schema)', count: 0, preview: [] }
  const preview = items.slice(0, limit)
  const more =
    items.length > limit
      ? ` · 共 ${items.length} 项`
      : items.length > 1
        ? ` · 共 ${items.length} 项`
        : ''
  return {
    text: preview.join(' / ') + more,
    count: items.length,
    preview,
  }
}

export function tablesToSchema(tables) {
  return joinSchemaList(tables || [])
}
