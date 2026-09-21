/**
 * SQLREST 按数据源原样执行 SQL，不翻译方言。
 * 这里只决定标识符引号、示例语句，以及编辑器要额外认识的关键字。
 */

const MYSQL = {
  id: 'mysql',
  label: 'MySQL',
  quote: 'backtick',
  quoteHint: '标识符用反引号 `name`',
  keywords: ['REGEXP', 'RLIKE', 'STRAIGHT_JOIN', 'DUAL', 'FORCE', 'USE', 'INDEX', 'IGNORE', 'REPLACE'],
  functions: ['IFNULL', 'GROUP_CONCAT', 'DATE_FORMAT', 'DATE_ADD', 'DATE_SUB', 'UNIX_TIMESTAMP', 'FROM_UNIXTIME'],
  types: ['MEDIUMINT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 'DATETIME', 'JSON', 'ENUM', 'SET'],
  completes: [{ caption: 'LIMIT', insert: 'LIMIT 100' }],
  sample: 'SELECT * FROM `table` LIMIT 100;',
}

const POSTGRESQL = {
  id: 'postgresql',
  label: 'PostgreSQL',
  quote: 'double',
  quoteHint: '标识符用双引号 "name"',
  keywords: ['ILIKE', 'RETURNING', 'LATERAL', 'EXCEPT', 'INTERSECT', 'SIMILAR', 'WINDOW', 'FILTER'],
  functions: ['COALESCE', 'NULLIF', 'STRING_AGG', 'NOW', 'DATE_TRUNC', 'AGE', 'GREATEST', 'LEAST'],
  types: ['INT2', 'INT4', 'INT8', 'SERIAL', 'BIGSERIAL', 'JSONB', 'UUID', 'TIMESTAMPTZ', 'TEXT', 'BOOLEAN', 'NUMERIC'],
  completes: [{ caption: 'LIMIT', insert: 'LIMIT 100' }, { caption: 'ILIKE', insert: 'ILIKE' }],
  sample: 'SELECT * FROM "table" LIMIT 100;',
}

const ORACLE = {
  id: 'oracle',
  label: 'Oracle',
  quote: 'double',
  quoteHint: '标识符用双引号 "name"',
  keywords: ['ROWNUM', 'ROWID', 'CONNECT', 'START', 'PRIOR', 'MINUS', 'SYSDATE', 'LEVEL', 'NOCYCLE', 'DUAL'],
  functions: ['NVL', 'NVL2', 'TO_CHAR', 'TO_DATE', 'TO_NUMBER', 'DECODE', 'SYSDATE', 'TRUNC'],
  types: ['VARCHAR2', 'NVARCHAR2', 'NUMBER', 'CLOB', 'BLOB', 'RAW', 'DATE'],
  completes: [{ caption: 'FETCH FIRST', insert: 'FETCH FIRST 100 ROWS ONLY' }],
  sample: 'SELECT * FROM "table" FETCH FIRST 100 ROWS ONLY;',
}

const SQLSERVER = {
  id: 'sqlserver',
  label: 'SQL Server',
  quote: 'bracket',
  quoteHint: '标识符用方括号 [name]',
  keywords: ['TOP', 'PERCENT', 'TIES', 'APPLY', 'NOLOCK', 'OFFSET', 'GETDATE'],
  functions: ['ISNULL', 'GETDATE', 'DATEADD', 'DATEDIFF', 'LEN', 'CHARINDEX', 'CONVERT'],
  types: ['NVARCHAR', 'NCHAR', 'DATETIME2', 'DATETIMEOFFSET', 'BIT', 'UNIQUEIDENTIFIER', 'MONEY', 'SMALLMONEY'],
  completes: [{ caption: 'TOP', insert: 'TOP 100' }, { caption: 'OFFSET', insert: 'OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY' }],
  sample: 'SELECT TOP 100 * FROM [table];',
}

const CLICKHOUSE = {
  id: 'clickhouse',
  label: 'ClickHouse',
  quote: 'backtick',
  quoteHint: '标识符用反引号 `name`',
  keywords: ['PREWHERE', 'FINAL', 'FORMAT', 'GLOBAL', 'SAMPLE', 'SETTINGS', 'ARRAY'],
  functions: ['toDate', 'toDateTime', 'toString', 'ifNull', 'arrayJoin', 'uniq', 'countIf'],
  types: ['INT8', 'INT16', 'INT32', 'INT64', 'UINT8', 'UINT16', 'UINT32', 'UINT64', 'FLOAT32', 'FLOAT64', 'STRING', 'DATETIME64', 'ARRAY', 'NULLABLE'],
  completes: [{ caption: 'LIMIT', insert: 'LIMIT 100' }, { caption: 'PREWHERE', insert: 'PREWHERE' }],
  sample: 'SELECT * FROM `table` LIMIT 100;',
}

const HIVE = {
  id: 'hive',
  label: 'Hive',
  quote: 'backtick',
  quoteHint: '标识符用反引号 `name`',
  keywords: ['LATERAL', 'CLUSTER', 'DISTRIBUTE', 'SORT', 'MSCK', 'PARTITION'],
  functions: ['NVL', 'COALESCE', 'FROM_UNIXTIME', 'UNIX_TIMESTAMP', 'GET_JSON_OBJECT'],
  types: ['STRING', 'BIGINT', 'ARRAY', 'MAP', 'STRUCT', 'TIMESTAMP'],
  completes: [{ caption: 'LIMIT', insert: 'LIMIT 100' }],
  sample: 'SELECT * FROM `table` LIMIT 100;',
}

const TRINO = {
  id: 'trino',
  label: 'Trino',
  quote: 'double',
  quoteHint: '标识符用双引号 "name"',
  keywords: ['UNNEST', 'FETCH', 'ONLY'],
  functions: ['DATE_TRUNC', 'FROM_UNIXTIME', 'JSON_EXTRACT'],
  types: ['VARCHAR', 'BIGINT', 'DOUBLE', 'TIMESTAMP', 'ARRAY', 'MAP', 'ROW'],
  completes: [{ caption: 'LIMIT', insert: 'LIMIT 100' }],
  sample: 'SELECT * FROM "table" LIMIT 100;',
}

const ANSI = {
  id: 'ansi',
  label: 'ANSI',
  sql: true,
  quote: 'double',
  quoteHint: '标识符用双引号 "name"',
  keywords: [],
  functions: [],
  types: [],
  completes: [{ caption: 'FETCH FIRST', insert: 'FETCH FIRST 100 ROWS ONLY' }],
  sample: 'SELECT * FROM "table" FETCH FIRST 100 ROWS ONLY;',
}

const SQLITE = {
  id: 'sqlite',
  label: 'SQLite',
  sql: true,
  quote: 'double',
  quoteHint: '标识符用双引号 "name"',
  keywords: [],
  functions: [],
  types: [],
  completes: [{ caption: 'LIMIT', insert: 'LIMIT 100' }],
  sample: 'SELECT * FROM "table" LIMIT 100;',
}

const TDENGINE = {
  id: 'tdengine',
  label: 'TDengine',
  sql: true,
  quote: 'backtick',
  quoteHint: '标识符用反引号 `name`',
  keywords: [],
  functions: [],
  types: [],
  completes: [{ caption: 'LIMIT', insert: 'LIMIT 100' }],
  sample: 'SELECT * FROM `table` LIMIT 100;',
}

const NON_SQL = {
  id: 'http',
  label: 'HTTP',
  sql: false,
  quote: 'none',
  quoteHint: '不是 SQL，不套用方言，也不插入示例语句',
  keywords: [],
  functions: [],
  types: [],
  completes: [],
  sample: '',
}

const UNKNOWN = {
  id: 'unknown',
  label: '未识别',
  sql: true,
  quote: 'none',
  fallback: true,
  quoteHint: '未识别方言，标识符不加引号，请按该库自己的语法编写',
  keywords: [],
  functions: [],
  types: [],
  completes: [{ caption: 'LIMIT', insert: 'LIMIT 100' }],
  sample: 'SELECT * FROM table LIMIT 100;',
}
const PROFILES = [MYSQL, POSTGRESQL, ORACLE, SQLSERVER, CLICKHOUSE, HIVE, TRINO, ANSI, SQLITE, TDENGINE, NON_SQL, UNKNOWN]

function normalizeType(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '')
}

/** 归到已有方言，但标签保留数据源自己的名字 */
function adopt(profile, label) {
  if (!label || label === profile.label) return { ...profile, sql: true }
  return { ...profile, sql: true, label, family: profile.label }
}

/** @param {string} [type] 门户 type 或 SQLREST sqlrestType */
export function resolveSqlDialect(type) {
  const raw = String(type || '').trim()
  const t = normalizeType(raw)
  if (!t) return { ...MYSQL, sql: true, fallback: true }
  if (['http', 'httpapi', 'rest', 'openapi'].includes(t)) return { ...NON_SQL }
  if (['postgresql', 'postgres', 'pg'].includes(t)) return { ...POSTGRESQL, sql: true }
  if (['opengauss', 'gaussdb'].includes(t)) return adopt(POSTGRESQL, 'openGauss')
  if (['kingbase', 'kingbasees'].includes(t)) return adopt(POSTGRESQL, 'Kingbase')
  if (['greenplum'].includes(t)) return adopt(POSTGRESQL, 'Greenplum')
  if (['redshift'].includes(t)) return adopt(POSTGRESQL, 'Redshift')
  if (t === 'oracle') return { ...ORACLE, sql: true }
  if (['dm', 'dameng'].includes(t)) return adopt(ORACLE, '达梦')
  if (['oscar', 'shentong'].includes(t)) return adopt(ORACLE, '神通')
  if (['sqlserver', 'mssql', 'azuresql'].includes(t)) return { ...SQLSERVER, sql: true }
  if (t === 'sybase') return adopt(SQLSERVER, 'Sybase')
  if (['clickhouse', 'ck'].includes(t)) return { ...CLICKHOUSE, sql: true }
  if (t === 'hive') return { ...HIVE, sql: true }
  if (t === 'impala') return adopt(HIVE, 'Impala')
  if (t === 'inceptor') return adopt(HIVE, 'Inceptor')
  if (t === 'spark') return adopt(HIVE, 'Spark')
  if (['trino', 'presto'].includes(t)) return { ...TRINO, sql: true }
  if (t === 'mysql') return { ...MYSQL, sql: true }
  if (t === 'mariadb') return adopt(MYSQL, 'MariaDB')
  if (t === 'doris') return adopt(MYSQL, 'Doris')
  if (t === 'starrocks') return adopt(MYSQL, 'StarRocks')
  if (t === 'oceanbase') return adopt(MYSQL, 'OceanBase')
  if (['gbase', 'gbase8a'].includes(t)) return adopt(MYSQL, 'GBase 8a')
  if (t === 'tidb') return adopt(MYSQL, 'TiDB')
  if (t === 'db2') return { ...ANSI, label: 'DB2', family: 'ANSI' }
  if (['sqlite', 'sqlite3'].includes(t)) return SQLITE
  if (['tdengine', 'taos'].includes(t)) return TDENGINE
  if (t === 'mongodb') return { ...TRINO, sql: true, id: 'mongodb', label: 'MongoDB' }
  if (t === 'elasticsearch') return { ...TRINO, sql: true, id: 'elasticsearch', label: 'Elasticsearch' }
  return { ...UNKNOWN, raw }
}

export function isDialectSample(sql) {
  const cur = String(sql || '').trim()
  if (!cur) return false
  return PROFILES.some((p) => p.sample && p.sample.trim() === cur)
}

export function quoteIdent(name, dialect) {
  const n = String(name ?? '')
  const q = dialect?.quote || 'none'
  if (q === 'none') return n
  if (q === 'bracket') return `[${n.replace(/]/g, ']]')}]`
  if (q === 'double') return `"${n.replace(/"/g, '""')}"`
  return `\`${n.replace(/`/g, '``')}\``
}

export function quoteQualified(schema, name, dialect) {
  const id = quoteIdent(name, dialect)
  const s = String(schema || '').trim()
  if (!s) return id
  return `${quoteIdent(s, dialect)}.${id}`
}
