/**
 * 源清单文案（按数据源类型 / objectKind）。
 * 覆盖 LhDatasourceTypeEnum 全部 26 编码 + 常见别名；与 BE LhInventoryObjectKinds 对齐。
 */

/** @typedef {'table'|'topic'|'queue'|'index'|'collection'|'key_prefix'|'bucket'|'path'|'endpoint'|'object'} InventoryKind */

const KIND_ZH = {
  table: '表',
  topic: 'Topic',
  queue: 'Queue',
  index: 'Index',
  collection: '集合',
  key_prefix: 'Key 前缀',
  key: 'Key',
  bucket: 'Bucket',
  path: '路径',
  endpoint: '接口',
  object: '对象',
}

/** typeCode → kind（26 枚举 + 别名） */
const TYPE_KIND = {
  mysql: 'table',
  mariadb: 'table',
  pg: 'table',
  postgresql: 'table',
  oracle: 'table',
  sqlserver: 'table',
  azuresql: 'table',
  clickhouse: 'table',
  doris: 'table',
  starrocks: 'table',
  hive: 'table',
  iceberg: 'table',
  hbase: 'table',
  trino: 'table',
  kafka: 'topic',
  pulsar: 'topic',
  rabbitmq: 'queue',
  mongodb: 'collection',
  redis: 'key_prefix',
  elasticsearch: 'index',
  opensearch: 'index',
  hdfs: 'path',
  file: 'path',
  ftp: 'path',
  sftp: 'path',
  s3: 'bucket',
  minio: 'bucket',
  s3_minio: 'bucket',
  http_api: 'endpoint',
  http: 'endpoint',
  rest: 'endpoint',
  openapi: 'endpoint',
  tableau: 'endpoint',
  superset: 'endpoint',
  airflow: 'endpoint',
}

/** 展示名 / 表单标签 → typeCode */
const LABEL_TO_CODE = {
  mysql: 'mysql',
  mariadb: 'mysql',
  postgresql: 'postgresql',
  pg: 'pg',
  oracle: 'oracle',
  'sql server': 'sqlserver',
  sqlserver: 'sqlserver',
  azuresql: 'sqlserver',
  clickhouse: 'clickhouse',
  doris: 'doris',
  starrocks: 'starrocks',
  hive: 'hive',
  iceberg: 'iceberg',
  hbase: 'hbase',
  trino: 'trino',
  kafka: 'kafka',
  rabbitmq: 'rabbitmq',
  pulsar: 'pulsar',
  mongodb: 'mongodb',
  redis: 'redis',
  elasticsearch: 'elasticsearch',
  opensearch: 'elasticsearch',
  hdfs: 'hdfs',
  's3/minio': 's3',
  's3 / minio': 's3',
  s3: 's3',
  minio: 's3',
  'ftp/sftp': 'ftp',
  ftp: 'ftp',
  sftp: 'ftp',
  file: 'file',
  'http api': 'http_api',
  http: 'http_api',
  rest: 'http_api',
  openapi: 'http_api',
  tableau: 'tableau',
  superset: 'superset',
  airflow: 'airflow',
}

/**
 * @param {string} [typeCode]
 * @param {string} [typeLabel] 展示名如 MySQL
 */
export function resolveTypeCode(typeCode, typeLabel) {
  const c = String(typeCode || '').trim().toLowerCase()
  if (c && (TYPE_KIND[c] || LABEL_TO_CODE[c])) return TYPE_KIND[c] ? c : LABEL_TO_CODE[c]
  const lab = String(typeLabel || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  if (LABEL_TO_CODE[lab]) return LABEL_TO_CODE[lab]
  if (TYPE_KIND[lab]) return lab
  return c || lab || ''
}

/** @returns {InventoryKind} */
export function inventoryKindOf(typeCode, typeLabel, objectKind) {
  const fromApi = String(objectKind || '').trim().toLowerCase()
  if (fromApi && KIND_ZH[fromApi]) return /** @type {InventoryKind} */ (fromApi)
  const code = resolveTypeCode(typeCode, typeLabel)
  return TYPE_KIND[code] || 'object'
}

export function inventoryKindLabelZh(kind) {
  return KIND_ZH[kind] || KIND_ZH.object
}

/**
 * @param {{ typeCode?: string, type?: string, objectKind?: string }} source
 */
export function inventoryCopy(source = {}) {
  const kind = inventoryKindOf(source.typeCode, source.type, source.objectKind)
  const unit = inventoryKindLabelZh(kind)
  const listTitle = `${unit}清单`
  return {
    kind,
    unit,
    listTitle,
    /** 卡片/抽屉入口 */
    entryLabel: listTitle,
    entryShort: unit,
    manageLabel: `管理${listTitle}`,
    syncLabel: `同步${listTitle}`,
    syncShort: '同步清单',
    nameColumn: unit === 'Topic' || unit === 'Queue' || unit === 'Index' || unit === 'Bucket' ? unit : `${unit}名`,
    emptyText: `暂无${listTitle}，可同步或手动添加`,
    searchPlaceholder: `搜索${unit}名 / 中文名 / 注释…`,
    addLabel: `手动添加${unit}`,
    removeConfirm: (name) => `将从「${name || '该数据源'}」的${listTitle}中移除该登记。`,
    loadingFail: (msg) => `加载${listTitle}失败：${msg || ''}`,
    syncToast: (name) => `正在同步 ${name || ''} ${listTitle}…`,
    pageTitle: (name) => `${listTitle} · ${name || ''}`.trim(),
  }
}

/** 枚举 26 编码（供单测/文档） */
export const ALL_DS_TYPE_CODES = [
  'mysql',
  'pg',
  'postgresql',
  'oracle',
  'sqlserver',
  'clickhouse',
  'doris',
  'starrocks',
  'hive',
  'iceberg',
  'hbase',
  'trino',
  'kafka',
  'rabbitmq',
  'pulsar',
  'mongodb',
  'redis',
  'elasticsearch',
  'hdfs',
  's3',
  'file',
  'ftp',
  'http_api',
  'tableau',
  'superset',
  'airflow',
]
