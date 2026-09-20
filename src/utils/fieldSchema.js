/**
 * 资产字段 Schema：按数据源类型生成展示列与类型语义
 * 字段：中文名称 / 英文名称 / 描述 / 字段类型 / 字段长度 / 小数位 / 是否可空 / 是否主键
 */

/** 通用业务字段模板（英文名 + 中文 + 语义角色） */
const FIELD_TEMPLATES = [
  { en: 'id', cn: '主键ID', role: 'pk_id', desc: '业务主键' },
  { en: 'order_id', cn: '订单号', role: 'pk_biz', desc: '订单业务主键' },
  { en: 'user_id', cn: '用户ID', role: 'fk', desc: '关联用户' },
  { en: 'sku_id', cn: '商品SKU', role: 'fk', desc: '关联商品' },
  { en: 'buyer_mobile', cn: '买家手机号', role: 'pii_phone', desc: '联系手机号' },
  { en: 'buyer_name', cn: '买家姓名', role: 'pii_name', desc: '真实姓名' },
  { en: 'status', cn: '状态', role: 'code', desc: '业务状态码' },
  { en: 'channel', cn: '渠道', role: 'str_sm', desc: '来源渠道' },
  { en: 'amount', cn: '金额', role: 'money', desc: '金额（元）' },
  { en: 'qty', cn: '数量', role: 'int', desc: '数量' },
  { en: 'remark', cn: '备注', role: 'str_lg', desc: '备注说明' },
  { en: 'create_time', cn: '创建时间', role: 'ts', desc: '记录创建时间' },
  { en: 'update_time', cn: '更新时间', role: 'ts', desc: '记录更新时间' },
  { en: 'is_deleted', cn: '删除标记', role: 'bool', desc: '逻辑删除' },
  { en: 'tenant_id', cn: '租户ID', role: 'str_sm', desc: '多租户隔离键' },
]

/** 订单域扩充字段（对齐原 SCHEMA_COLS） */
const ORDER_TEMPLATES = [
  { en: 'dt', cn: '统计分区日', role: 'date', desc: '统计分区日' },
  { en: 'order_id', cn: '订单号', role: 'pk_biz', desc: '订单号业务主键' },
  { en: 'parent_order_id', cn: '父订单号', role: 'fk', desc: '父订单号(拆单)' },
  { en: 'user_id', cn: '用户ID', role: 'fk', desc: '买家用户ID' },
  { en: 'buyer_mobile', cn: '买家手机号', role: 'pii_phone', desc: '买家手机号' },
  { en: 'buyer_real_name', cn: '买家姓名', role: 'pii_name', desc: '买家真实姓名' },
  { en: 'sku_id', cn: '商品SKU', role: 'fk', desc: '商品SKU ID' },
  { en: 'order_status', cn: '订单状态', role: 'code', desc: '订单状态码' },
  { en: 'order_channel', cn: '下单渠道', role: 'str_sm', desc: '下单渠道' },
  { en: 'pay_type', cn: '支付类型', role: 'code', desc: '支付类型' },
  { en: 'original_amt', cn: '订单原价', role: 'money', desc: '订单原价' },
  { en: 'discount_amt', cn: '优惠金额', role: 'money', desc: '优惠金额合计' },
  { en: 'pay_amt', cn: '实付金额', role: 'money', desc: '实付金额' },
  { en: 'freight_amt', cn: '运费', role: 'money', desc: '运费' },
  { en: 'refund_amt', cn: '退款金额', role: 'money', desc: '退款金额' },
  { en: 'create_time', cn: '下单时间', role: 'ts', desc: '下单时间' },
  { en: 'pay_time', cn: '支付时间', role: 'ts', desc: '支付成功时间' },
  { en: 'seller_shop_id', cn: '店铺ID', role: 'int', desc: '卖家店铺ID' },
  { en: 'tenant_id', cn: '租户ID', role: 'str_sm', desc: '租户ID(行级过滤键)' },
  { en: 'gmt_create', cn: '入库时间', role: 'ts', desc: '入库时间' },
  { en: 'gmt_modified', cn: '修改时间', role: 'ts', desc: '修改时间' },
  { en: '__deleted', cn: '删除标记', role: 'bool', desc: 'CDC删除标记' },
]

/**
 * 各数据源类型的类型方言
 * role -> { dataType, length, scale }
 */
const TYPE_DIALECTS = {
  MySQL: {
    pk_id: { dataType: 'BIGINT', length: 20, scale: null },
    pk_biz: { dataType: 'BIGINT', length: 20, scale: null },
    fk: { dataType: 'BIGINT', length: 20, scale: null },
    int: { dataType: 'INT', length: 11, scale: null },
    code: { dataType: 'TINYINT', length: 4, scale: null },
    money: { dataType: 'DECIMAL', length: 18, scale: 2 },
    str_sm: { dataType: 'VARCHAR', length: 32, scale: null },
    str_lg: { dataType: 'VARCHAR', length: 512, scale: null },
    pii_phone: { dataType: 'VARCHAR', length: 32, scale: null },
    pii_name: { dataType: 'VARCHAR', length: 64, scale: null },
    ts: { dataType: 'DATETIME', length: null, scale: null },
    date: { dataType: 'DATE', length: null, scale: null },
    bool: { dataType: 'TINYINT', length: 1, scale: null },
  },
  PostgreSQL: {
    pk_id: { dataType: 'int8', length: null, scale: null },
    pk_biz: { dataType: 'int8', length: null, scale: null },
    fk: { dataType: 'int8', length: null, scale: null },
    int: { dataType: 'int4', length: null, scale: null },
    code: { dataType: 'int2', length: null, scale: null },
    money: { dataType: 'numeric', length: 18, scale: 2 },
    str_sm: { dataType: 'varchar', length: 32, scale: null },
    str_lg: { dataType: 'varchar', length: 512, scale: null },
    pii_phone: { dataType: 'varchar', length: 32, scale: null },
    pii_name: { dataType: 'varchar', length: 64, scale: null },
    ts: { dataType: 'timestamp', length: null, scale: 6 },
    date: { dataType: 'date', length: null, scale: null },
    bool: { dataType: 'boolean', length: null, scale: null },
  },
  Oracle: {
    pk_id: { dataType: 'NUMBER', length: 20, scale: 0 },
    pk_biz: { dataType: 'NUMBER', length: 20, scale: 0 },
    fk: { dataType: 'NUMBER', length: 20, scale: 0 },
    int: { dataType: 'NUMBER', length: 10, scale: 0 },
    code: { dataType: 'NUMBER', length: 3, scale: 0 },
    money: { dataType: 'NUMBER', length: 18, scale: 2 },
    str_sm: { dataType: 'VARCHAR2', length: 32, scale: null },
    str_lg: { dataType: 'VARCHAR2', length: 512, scale: null },
    pii_phone: { dataType: 'VARCHAR2', length: 32, scale: null },
    pii_name: { dataType: 'VARCHAR2', length: 64, scale: null },
    ts: { dataType: 'TIMESTAMP', length: null, scale: 6 },
    date: { dataType: 'DATE', length: null, scale: null },
    bool: { dataType: 'NUMBER', length: 1, scale: 0 },
  },
  'SQL Server': {
    pk_id: { dataType: 'bigint', length: null, scale: null },
    pk_biz: { dataType: 'bigint', length: null, scale: null },
    fk: { dataType: 'bigint', length: null, scale: null },
    int: { dataType: 'int', length: null, scale: null },
    code: { dataType: 'tinyint', length: null, scale: null },
    money: { dataType: 'decimal', length: 18, scale: 2 },
    str_sm: { dataType: 'nvarchar', length: 32, scale: null },
    str_lg: { dataType: 'nvarchar', length: 512, scale: null },
    pii_phone: { dataType: 'nvarchar', length: 32, scale: null },
    pii_name: { dataType: 'nvarchar', length: 64, scale: null },
    ts: { dataType: 'datetime2', length: null, scale: 6 },
    date: { dataType: 'date', length: null, scale: null },
    bool: { dataType: 'bit', length: null, scale: null },
  },
  ClickHouse: {
    pk_id: { dataType: 'Int64', length: null, scale: null },
    pk_biz: { dataType: 'Int64', length: null, scale: null },
    fk: { dataType: 'Int64', length: null, scale: null },
    int: { dataType: 'Int32', length: null, scale: null },
    code: { dataType: 'Int8', length: null, scale: null },
    money: { dataType: 'Decimal', length: 18, scale: 2 },
    str_sm: { dataType: 'String', length: null, scale: null },
    str_lg: { dataType: 'String', length: null, scale: null },
    pii_phone: { dataType: 'String', length: null, scale: null },
    pii_name: { dataType: 'String', length: null, scale: null },
    ts: { dataType: 'DateTime64', length: null, scale: 3 },
    date: { dataType: 'Date', length: null, scale: null },
    bool: { dataType: 'UInt8', length: null, scale: null },
  },
  Hive: {
    pk_id: { dataType: 'bigint', length: null, scale: null },
    pk_biz: { dataType: 'bigint', length: null, scale: null },
    fk: { dataType: 'bigint', length: null, scale: null },
    int: { dataType: 'int', length: null, scale: null },
    code: { dataType: 'tinyint', length: null, scale: null },
    money: { dataType: 'decimal', length: 18, scale: 2 },
    str_sm: { dataType: 'string', length: null, scale: null },
    str_lg: { dataType: 'string', length: null, scale: null },
    pii_phone: { dataType: 'string', length: null, scale: null },
    pii_name: { dataType: 'string', length: null, scale: null },
    ts: { dataType: 'timestamp', length: null, scale: null },
    date: { dataType: 'date', length: null, scale: null },
    bool: { dataType: 'boolean', length: null, scale: null },
  },
  Iceberg: null, // alias Hive
  Kafka: {
    pk_id: { dataType: 'long', length: null, scale: null },
    pk_biz: { dataType: 'long', length: null, scale: null },
    fk: { dataType: 'long', length: null, scale: null },
    int: { dataType: 'int', length: null, scale: null },
    code: { dataType: 'int', length: null, scale: null },
    money: { dataType: 'double', length: null, scale: null },
    str_sm: { dataType: 'string', length: null, scale: null },
    str_lg: { dataType: 'string', length: null, scale: null },
    pii_phone: { dataType: 'string', length: null, scale: null },
    pii_name: { dataType: 'string', length: null, scale: null },
    ts: { dataType: 'long', length: null, scale: null },
    date: { dataType: 'int', length: null, scale: null },
    bool: { dataType: 'boolean', length: null, scale: null },
  },
  MongoDB: {
    pk_id: { dataType: 'ObjectId', length: null, scale: null },
    pk_biz: { dataType: 'Long', length: null, scale: null },
    fk: { dataType: 'Long', length: null, scale: null },
    int: { dataType: 'Int32', length: null, scale: null },
    code: { dataType: 'Int32', length: null, scale: null },
    money: { dataType: 'Decimal128', length: null, scale: null },
    str_sm: { dataType: 'String', length: null, scale: null },
    str_lg: { dataType: 'String', length: null, scale: null },
    pii_phone: { dataType: 'String', length: null, scale: null },
    pii_name: { dataType: 'String', length: null, scale: null },
    ts: { dataType: 'Date', length: null, scale: null },
    date: { dataType: 'Date', length: null, scale: null },
    bool: { dataType: 'Boolean', length: null, scale: null },
  },
  Elasticsearch: {
    pk_id: { dataType: 'long', length: null, scale: null },
    pk_biz: { dataType: 'long', length: null, scale: null },
    fk: { dataType: 'long', length: null, scale: null },
    int: { dataType: 'integer', length: null, scale: null },
    code: { dataType: 'byte', length: null, scale: null },
    money: { dataType: 'scaled_float', length: null, scale: 2 },
    str_sm: { dataType: 'keyword', length: null, scale: null },
    str_lg: { dataType: 'text', length: null, scale: null },
    pii_phone: { dataType: 'keyword', length: null, scale: null },
    pii_name: { dataType: 'text', length: null, scale: null },
    ts: { dataType: 'date', length: null, scale: null },
    date: { dataType: 'date', length: null, scale: null },
    bool: { dataType: 'boolean', length: null, scale: null },
  },
  REST: {
    pk_id: { dataType: 'integer', length: null, scale: null },
    pk_biz: { dataType: 'integer', length: null, scale: null },
    fk: { dataType: 'integer', length: null, scale: null },
    int: { dataType: 'integer', length: null, scale: null },
    code: { dataType: 'integer', length: null, scale: null },
    money: { dataType: 'number', length: null, scale: 2 },
    str_sm: { dataType: 'string', length: null, scale: null },
    str_lg: { dataType: 'string', length: null, scale: null },
    pii_phone: { dataType: 'string', length: null, scale: null },
    pii_name: { dataType: 'string', length: null, scale: null },
    ts: { dataType: 'string', length: null, scale: null },
    date: { dataType: 'string', length: null, scale: null },
    bool: { dataType: 'boolean', length: null, scale: null },
  },
}

const TYPE_ALIAS = {
  MariaDB: 'MySQL',
  AzureSQL: 'SQL Server',
  Doris: 'MySQL',
  StarRocks: 'MySQL',
  Iceberg: 'Hive',
  'Delta Lake': 'Hive',
  Trino: 'Hive',
  Presto: 'Hive',
  Redpanda: 'Kafka',
  Pulsar: 'Kafka',
  Kinesis: 'Kafka',
  OpenSearch: 'Elasticsearch',
  OpenAPI: 'REST',
  'HTTP API': 'REST',
  Snowflake: 'PostgreSQL',
  BigQuery: 'PostgreSQL',
  Redshift: 'PostgreSQL',
  Greenplum: 'PostgreSQL',
  HBase: 'Hive',
  Redis: 'REST',
  Cassandra: 'MongoDB',
}

export function resolveDialectKey(sourceType) {
  const t = String(sourceType || 'MySQL')
  if (TYPE_DIALECTS[t]) return t
  if (TYPE_ALIAS[t]) return TYPE_ALIAS[t]
  if (/SQL Server|Azure/i.test(t)) return 'SQL Server'
  if (/Oracle/i.test(t)) return 'Oracle'
  if (/Postgres|Greenplum|Snowflake/i.test(t)) return 'PostgreSQL'
  if (/ClickHouse|Doris|StarRocks/i.test(t)) return 'ClickHouse'
  if (/Kafka|Pulsar|Redpanda/i.test(t)) return 'Kafka'
  if (/Mongo|Cassandra|Dynamo/i.test(t)) return 'MongoDB'
  if (/Elastic|OpenSearch/i.test(t)) return 'Elasticsearch'
  if (/API|REST|HTTP|OpenAPI/i.test(t)) return 'REST'
  if (/Hive|Iceberg|Delta|Trino|Spark/i.test(t)) return 'Hive'
  return 'MySQL'
}

function dialectOf(sourceType) {
  const key = resolveDialectKey(sourceType)
  return TYPE_DIALECTS[key] || TYPE_DIALECTS.MySQL
}

function buildField(tpl, sourceType) {
  const dial = dialectOf(sourceType)
  const ty = dial[tpl.role] || dial.str_sm
  const pk = tpl.role === 'pk_id' || tpl.role === 'pk_biz'
  const nullable = !(pk || tpl.role === 'date')
  return {
    cnName: tpl.cn,
    enName: tpl.en,
    desc: tpl.desc,
    dataType: ty.dataType,
    length: ty.length,
    scale: ty.scale,
    nullable,
    pk,
    sensitive: /^pii_/.test(tpl.role),
    sample: sampleOf(tpl.role, tpl.en),
  }
}

function sampleOf(role, en) {
  const map = {
    pk_id: '10001',
    pk_biz: '98237145',
    fk: '10038472',
    int: '3',
    code: '1',
    money: '359.00',
    str_sm: 'App',
    str_lg: '—',
    pii_phone: '138****5678',
    pii_name: '张**',
    ts: '2026-09-02 23:48:12',
    date: '2026-09-02',
    bool: '0',
  }
  return map[role] || en
}

/** 根据资产与数据源类型取字段列表。默认不编造演示列；ETL 等可传 { synthesize: true }。 */
export function getAssetFields(asset, sourceType, opts = {}) {
  const synthesize = opts === true || opts?.synthesize === true
  if (Array.isArray(asset?.fields) && asset.fields.length) {
    return asset.fields.map((f) => normalizeField(f, sourceType))
  }
  if (!synthesize) return []
  const type = sourceType || asset?.engine || 'MySQL'
  const hint = `${asset?.id || ''} ${asset?.key || ''} ${asset?.name || ''} ${asset?.tableName || ''}`.toLowerCase()
  const templates =
    /order|trade|gmv|pay|refund/.test(hint) ? ORDER_TEMPLATES : FIELD_TEMPLATES
  return templates.map((tpl) => buildField(tpl, type))
}

function normalizeField(f, sourceType) {
  if (f.cnName && f.enName && f.dataType) {
    return {
      cnName: f.cnName,
      enName: f.enName,
      desc: f.desc || '',
      dataType: f.dataType,
      length: f.length ?? null,
      scale: f.scale ?? null,
      nullable: f.nullable !== false,
      pk: !!f.pk,
      sensitive: !!f.sensitive,
      sample: f.sample,
    }
  }
  // 兼容旧 SCHEMA_COLS: { name, type, desc, pk }
  const en = f.enName || f.name || ''
  const parsed = parseLegacyType(f.type || f.dataType || 'VARCHAR')
  return {
    cnName: f.cnName || f.desc || en,
    enName: en,
    desc: f.desc || '',
    dataType: parsed.dataType,
    length: f.length ?? parsed.length,
    scale: f.scale ?? parsed.scale,
    nullable: f.nullable != null ? f.nullable : !f.pk,
    pk: !!f.pk,
    sensitive: !!f.sensitive,
    sample: f.sample,
  }
}

function parseLegacyType(typeStr) {
  const s = String(typeStr || '')
  const m = s.match(/^([A-Za-z0-9_]+)\s*(?:\((\d+)\s*(?:,\s*(\d+))?\))?/)
  if (!m) return { dataType: s || 'VARCHAR', length: null, scale: null }
  return {
    dataType: m[1],
    length: m[2] != null ? Number(m[2]) : null,
    scale: m[3] != null ? Number(m[3]) : null,
  }
}

/** 格式化类型展示：DECIMAL(18,2) */
export function formatDataType(field) {
  if (!field?.dataType) return '—'
  if (field.length != null && field.scale != null) {
    return `${field.dataType}(${field.length},${field.scale})`
  }
  if (field.length != null) return `${field.dataType}(${field.length})`
  return field.dataType
}

export function yesNo(v) {
  return v ? '是' : '否'
}
