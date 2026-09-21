/**
 * 数据开发编辑器的三套引擎方言。
 * 与 sqlDialect.js 的数据源方言分开：这里只服务 Spark / Flink / Trino，不服务 SQLREST。
 */

const CORE_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'FULL', 'OUTER', 'CROSS',
  'ON', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'INSERT',
  'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'WITH', 'AS', 'AND', 'OR', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT', 'ASC', 'DESC', 'NOT', 'IN', 'IS',
  'NULL', 'TRUE', 'FALSE', 'BETWEEN', 'LIKE', 'EXISTS', 'OVER', 'PARTITION', 'USING',
  'RECURSIVE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'VIEW',
]

const CORE_FUNCTIONS = [
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CAST', 'CONCAT',
  'SUBSTRING', 'SUBSTR', 'LENGTH', 'TRIM', 'ROUND', 'FLOOR', 'CEIL', 'ABS',
  'UPPER', 'LOWER', 'REPLACE',
]

const CORE_TYPES = [
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DOUBLE', 'FLOAT', 'DECIMAL',
  'BOOLEAN', 'DATE', 'TIMESTAMP',
]

const SPARK = {
  id: 'spark',
  label: 'Spark SQL',
  quote: 'backtick',
  quoteHint: '标识符用反引号 `name`',
  keywords: [
    'OVERWRITE', 'LATERAL VIEW', 'LATERAL', 'CLUSTER', 'DISTRIBUTE', 'SORT',
    'PARTITION', 'PARTITIONS', 'MSCK', 'REPAIR', 'CACHE', 'UNCACHE', 'TEMPORARY',
    'STORED', 'LOCATION', 'COMMENT', 'TRANSFORM', 'RLIKE', 'REGEXP', 'MACRO',
    'ANALYZE', 'STATISTICS', 'PIVOT', 'UNPIVOT', 'QUALIFY', 'EXCEPT', 'INTERSECT',
    'TABLESAMPLE', 'BUCKET', 'TBLPROPERTIES',
  ],
  functions: [
    'EXPLODE', 'POSEXPLODE', 'INLINE', 'COLLECT_LIST', 'COLLECT_SET', 'SIZE',
    'ARRAY_CONTAINS', 'MAP_KEYS', 'MAP_VALUES', 'GET_JSON_OBJECT', 'FROM_JSON',
    'TO_JSON', 'NVL', 'IFNULL', 'IF', 'DATE_FORMAT', 'UNIX_TIMESTAMP', 'FROM_UNIXTIME',
    'DATEDIFF', 'DATE_ADD', 'DATE_SUB', 'REGEXP_EXTRACT', 'REGEXP_REPLACE', 'SPLIT',
  ],
  types: ['STRING', 'BINARY', 'ARRAY', 'MAP', 'STRUCT', 'VOID'],
  formatClauses: [
    'INSERT OVERWRITE',
    'LATERAL VIEW',
    'CLUSTER BY',
    'DISTRIBUTE BY',
    'SORT BY',
    'PARTITION BY',
  ],
  completes: [
    { caption: 'LATERAL VIEW', insert: 'LATERAL VIEW explode() t AS c' },
    { caption: 'INSERT OVERWRITE', insert: 'INSERT OVERWRITE TABLE ' },
  ],
  sample: 'SELECT explode(`arr`) FROM `t`',
}

const FLINK = {
  id: 'flink',
  label: 'Flink SQL',
  quote: 'backtick',
  quoteHint: '标识符用反引号 `name`',
  keywords: [
    'WATERMARK FOR', 'WATERMARK', 'PROCTIME', 'PROC', 'TEMPORARY', 'SYSTEM_TIME', 'ENFORCED',
    'PRIMARY KEY', 'PRIMARY', 'KEY', 'CONNECTOR', 'METADATA', 'VIRTUAL', 'COMPUTED',
    'MATCH_RECOGNIZE', 'MEASURES', 'PATTERN', 'DEFINE', 'AFTER', 'PARTITIONED BY', 'PARTITIONED',
    'DESCRIPTOR', 'EXPLAIN', 'PLAN',
  ],
  functions: [
    'TUMBLE', 'HOP', 'CUMULATE', 'SESSION', 'TUMBLE_START', 'TUMBLE_END',
    'HOP_START', 'HOP_END', 'PROCTIME', 'CURRENT_TIMESTAMP', 'CURRENT_DATE',
    'CURRENT_ROW_TIMESTAMP', 'DATE_FORMAT', 'TIMESTAMPADD', 'TIMESTAMPDIFF',
    'JSON_VALUE', 'JSON_QUERY', 'TRY_CAST', 'IF', 'IFNULL', 'CHAR_LENGTH',
    'EXTRACT',
  ],
  types: ['STRING', 'BYTES', 'TIMESTAMP_LTZ', 'ROW', 'ARRAY', 'MAP', 'MULTISET', 'RAW', 'TIME'],
  formatClauses: ['WATERMARK FOR', 'MATCH_RECOGNIZE', 'PRIMARY KEY', 'PARTITIONED BY'],
  completes: [
    { caption: 'WATERMARK FOR', insert: 'WATERMARK FOR ts AS ts - INTERVAL \'5\' SECOND' },
    { caption: 'TUMBLE', insert: 'TUMBLE(TABLE src, DESCRIPTOR(ts), INTERVAL \'10\' SECOND)' },
  ],
  sample: 'SELECT * FROM `t`',
}

const TRINO = {
  id: 'trino',
  label: 'Trino SQL',
  quote: 'double',
  quoteHint: '标识符用双引号 "name"',
  keywords: [
    'UNNEST', 'FETCH FIRST', 'FETCH NEXT', 'FETCH', 'ONLY', 'FIRST', 'NEXT', 'ROWS', 'EXCEPT', 'INTERSECT',
    'FILTER', 'WINDOW', 'TABLESAMPLE BERNOULLI', 'TABLESAMPLE SYSTEM', 'TABLESAMPLE', 'BERNOULLI', 'SYSTEM', 'AT', 'ZONE', 'TRY',
  ],
  functions: [
    'DATE_TRUNC', 'FROM_UNIXTIME', 'TO_UNIXTIME', 'JSON_EXTRACT', 'JSON_EXTRACT_SCALAR',
    'JSON_PARSE', 'APPROX_DISTINCT', 'ARBITRARY', 'APPROX_PERCENTILE', 'TRY', 'TRY_CAST',
    'GREATEST', 'LEAST', 'REGEXP_EXTRACT', 'REGEXP_LIKE', 'CARDINALITY', 'ELEMENT_AT',
    'ARRAY_AGG', 'ARRAY_DISTINCT', 'CONTAINS', 'TRANSFORM', 'REDUCE', 'ZIP',
  ],
  types: ['VARCHAR', 'CHAR', 'VARBINARY', 'REAL', 'ROW', 'ARRAY', 'MAP', 'JSON', 'UUID', 'IPADDRESS'],
  formatClauses: ['FETCH FIRST', 'FETCH NEXT', 'TABLESAMPLE BERNOULLI', 'TABLESAMPLE SYSTEM'],
  completes: [
    { caption: 'FETCH FIRST', insert: 'FETCH FIRST 100 ROWS ONLY' },
    { caption: 'UNNEST', insert: 'UNNEST()' },
  ],
  sample: 'SELECT * FROM "t" FETCH FIRST 100 ROWS ONLY',
}

const PROFILES = { spark: SPARK, flink: FLINK, trino: TRINO }

export function resolveEngineDialect(engine) {
  const key = String(engine || '').trim().toLowerCase()
  return PROFILES[key] || SPARK
}

export function engineKeywordList(dialect) {
  return uniqueUpper([...CORE_KEYWORDS, ...(dialect?.keywords || [])])
}

export function engineFunctionList(dialect) {
  return uniqueUpper([...CORE_FUNCTIONS, ...(dialect?.functions || [])])
}

export function engineTypeList(dialect) {
  return uniqueUpper([...CORE_TYPES, ...(dialect?.types || [])])
}

/** 关键字、内置函数、登记 UDF。不含库表列。 */
export function engineCompletions(dialect, udfs = []) {
  const items = []
  const seen = new Set()
  const add = (caption, insert, kind) => {
    const key = `${kind}:${String(caption || '').toUpperCase()}`
    if (!caption || seen.has(key)) return
    seen.add(key)
    items.push({ caption, insert: insert || caption, kind })
  }
  for (const kw of engineKeywordList(dialect)) add(kw, kw, 'kw')
  for (const fn of engineFunctionList(dialect)) add(fn, `${fn}(`, 'fn')
  for (const snip of dialect?.completes || []) add(snip.caption, snip.insert, 'snip')
  for (const udf of udfs || []) {
    const name = udf?.name
    if (!name) continue
    add(name, udf.snippet || name, 'udf')
  }
  return items
}

function uniqueUpper(list) {
  const out = []
  const seen = new Set()
  for (const raw of list) {
    const word = String(raw || '').trim().toUpperCase()
    if (!word || seen.has(word)) continue
    seen.add(word)
    out.push(word)
  }
  return out
}
