/**
 * Sink 受控自动建表：模式常量 + DDL 预览（门户侧预览，执行仍由引擎/发布链路落地）
 */

export const AUTO_CREATE_MODES = [
  {
    value: 'off',
    label: '关闭（表须已存在）',
    hint: '默认。目标不存在时校验/发布应阻断（fail_if_missing 语义）。',
  },
  {
    value: 'if_not_exists',
    label: '不存在则创建',
    hint: '只建 schema/表，不建 catalog。Iceberg Catalog 须已是 Grav/Trino 存在的湖 catalog（默认 iceberg；勿填 prod_catalog）。',
  },
  {
    value: 'fail_if_missing',
    label: '不存在则失败',
    hint: '显式禁止自动建表；目标缺失直接失败（与 off 接近，语义更硬）。',
  },
]

export const SCHEMA_FROM_OPTIONS = [
  { value: 'upstream', label: '上游输出字段' },
  { value: 'mapping', label: '字段映射结果' },
  { value: 'explicit', label: '仅用节点显式列（高级）' },
]

function sqlType(t) {
  const x = String(t || 'STRING').toUpperCase()
  if (/INT|BIGINT|SMALLINT|TINYINT|LONG/.test(x)) return x.includes('BIG') || x === 'LONG' ? 'BIGINT' : 'INT'
  if (/DEC|NUM|DOUBLE|FLOAT|REAL/.test(x)) return /DEC|NUM/.test(x) ? 'DECIMAL(18,2)' : 'DOUBLE'
  if (/BOOL|BIT/.test(x)) return 'BOOLEAN'
  if (/DATE/.test(x) && !/TIME|TIMESTAMP|DATETIME/.test(x)) return 'DATE'
  if (/TIME|TIMESTAMP|DATETIME/.test(x)) return 'TIMESTAMP'
  if (/BINARY|BYTES|BLOB/.test(x)) return 'BINARY'
  return 'STRING'
}

function ckType(t) {
  const x = String(t || 'String')
  const u = x.toUpperCase()
  if (/BIGINT|LONG/.test(u)) return 'Int64'
  if (/INT|SMALLINT/.test(u)) return 'Int32'
  if (/DEC|NUM/.test(u)) return 'Decimal(18,2)'
  if (/DOUBLE|FLOAT/.test(u)) return 'Float64'
  if (/BOOL/.test(u)) return 'UInt8'
  if (/DATE/.test(u) && !/TIME|TIMESTAMP|DATETIME/.test(u)) return 'Date'
  if (/TIME|TIMESTAMP|DATETIME/.test(u)) return 'DateTime64(3)'
  return 'String'
}

function quoteId(name) {
  return String(name || '').replace(/[^a-zA-Z0-9_.]/g, '_')
}

/**
 * @param {'sink_iceberg'|'sink_ck'|'sink_rdb'} sinkType
 * @param {object} conf
 * @param {Array<{name:string,type?:string,cn?:string}>} fields
 */
export function buildCreateDdlPreview(sinkType, conf = {}, fields = []) {
  const cols = (fields || []).filter((f) => f?.name)
  if (!cols.length && sinkType !== 'sink_kafka') {
    return '-- 暂无上游字段：请先连线上游节点，或改 schemaFrom\n'
  }

  if (sinkType === 'sink_iceberg') {
    const catalog = conf.catalog || 'iceberg'
    const db = conf.database || 'ods'
    const table = conf.table || 'new_table'
    const fqn = `${quoteId(catalog)}.${quoteId(db)}.${quoteId(table)}`
    const lines = cols.map((f) => `  ${quoteId(f.name)} ${sqlType(f.type)} COMMENT '${(f.cn || '').replace(/'/g, '')}'`)
    const pk = String(conf.pk || '')
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const part = conf.partition ? quoteId(conf.partition) : ''
    const transform = conf.partitionTransform || 'identity'
    let ddl = `CREATE TABLE IF NOT EXISTS ${fqn} (\n${lines.join(',\n')}\n)`
    if (conf.writeMode === 'upsert' || conf.writeMode === 'cdc') {
      ddl += `\nUSING iceberg`
    }
    if (part) {
      const pexpr = transform === 'identity' ? part : `${transform}(${part})`
      ddl += `\nPARTITIONED BY (${pexpr})`
    }
    if (pk.length) {
      ddl += `\n-- equality upsert identifier fields: (${pk.join(', ')})`
    }
    ddl += `\nTBLPROPERTIES ('format-version'='${conf.formatVersion || 2}', 'write.format.default'='parquet');`
    return ddl
  }

  if (sinkType === 'sink_ck') {
    const db = conf.database || 'ads'
    const table = conf.table || 'new_table'
    const engine = conf.tableEngine || conf.engine || 'ReplacingMergeTree'
    const ver = conf.engineVerCol ? `(${quoteId(conf.engineVerCol)})` : ''
    const orderBy = conf.orderBy || conf.pk || 'tuple()'
    const partitionBy = conf.partitionBy || ''
    const lines = cols.map((f) => `  ${quoteId(f.name)} ${ckType(f.type)}`)
    let ddl = `CREATE TABLE IF NOT EXISTS ${quoteId(db)}.${quoteId(table)}\n(\n${lines.join(',\n')}\n)\nENGINE = ${engine}${ver}`
    if (partitionBy) ddl += `\nPARTITION BY ${partitionBy}`
    ddl += `\nORDER BY ${orderBy}`
    if (conf.ttlExpression) ddl += `\nTTL ${conf.ttlExpression}`
    ddl += ';'
    return ddl
  }

  if (sinkType === 'sink_rdb') {
    const table = conf.table || 'new_table'
    const lines = cols.map((f) => `  \`${quoteId(f.name)}\` ${sqlType(f.type)} NULL`)
    const pk = String(conf.pk || '')
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    let ddl = `CREATE TABLE IF NOT EXISTS ${table} (\n${lines.join(',\n')}`
    if (pk.length) ddl += `,\n  PRIMARY KEY (${pk.map((p) => `\`${quoteId(p)}\``).join(', ')})`
    ddl += `\n);`
    return ddl
  }

  return '-- 当前 sink 类型暂不提供 DDL 预览\n'
}

export function normalizeAutoCreate(conf = {}) {
  const mode = conf.autoCreate || 'off'
  const allowed = new Set(AUTO_CREATE_MODES.map((m) => m.value))
  return {
    autoCreate: allowed.has(mode) ? mode : 'off',
    schemaFrom: conf.schemaFrom || 'upstream',
    registerAfterCreate: conf.registerAfterCreate !== false,
  }
}
