/**
 * 数据源 typeCode ↔ ETL 能力（与后端 LhEtlDsCapability / 待办 §F 对齐）。
 * ready | partial | planned | excluded
 */
const CAPS = {
  mysql: { ingest: 'ready', export: 'partial', sourceNodes: ['source'], sinkNodes: ['sink_rdb'] },
  mariadb: { ingest: 'ready', export: 'partial', sourceNodes: ['source'], sinkNodes: ['sink_rdb'] },
  postgresql: { ingest: 'ready', export: 'partial', sourceNodes: ['source'], sinkNodes: ['sink_rdb'] },
  pg: { ingest: 'ready', export: 'partial', sourceNodes: ['source'], sinkNodes: ['sink_rdb'] },
  oracle: { ingest: 'ready', export: 'partial', sourceNodes: ['source'], sinkNodes: ['sink_rdb'] },
  sqlserver: { ingest: 'ready', export: 'partial', sourceNodes: ['source'], sinkNodes: ['sink_rdb'] },
  azuresql: { ingest: 'ready', export: 'partial', sourceNodes: ['source'], sinkNodes: ['sink_rdb'] },
  clickhouse: { ingest: 'ready', export: 'ready', sourceNodes: ['source'], sinkNodes: ['sink_ck', 'sink_rdb'] },
  doris: { ingest: 'ready', export: 'ready', sourceNodes: ['source'], sinkNodes: ['sink_rdb'] },
  starrocks: { ingest: 'ready', export: 'ready', sourceNodes: ['source'], sinkNodes: ['sink_rdb'] },
  hive: { ingest: 'partial', export: 'planned', sourceNodes: ['source'], sinkNodes: [] },
  iceberg: { ingest: 'planned', export: 'ready', sourceNodes: ['source'], sinkNodes: ['sink_iceberg'] },
  hbase: { ingest: 'partial', export: 'planned', sourceNodes: ['source_hbase'], sinkNodes: [] },
  trino: { ingest: 'excluded', export: 'excluded', sourceNodes: [], sinkNodes: [] },
  kafka: { ingest: 'ready', export: 'ready', sourceNodes: ['source_kafka'], sinkNodes: ['sink_kafka'] },
  pulsar: { ingest: 'ready', export: 'planned', sourceNodes: ['source_pulsar'], sinkNodes: ['sink_kafka'] },
  rabbitmq: { ingest: 'partial', export: 'planned', sourceNodes: ['source_rabbitmq'], sinkNodes: [] },
  mongodb: { ingest: 'partial', export: 'planned', sourceNodes: ['source_mongo'], sinkNodes: [] },
  redis: { ingest: 'excluded', export: 'excluded', sourceNodes: [], sinkNodes: [] },
  elasticsearch: { ingest: 'planned', export: 'partial', sourceNodes: [], sinkNodes: ['sink_search'] },
  hdfs: { ingest: 'partial', export: 'partial', sourceNodes: ['source_file'], sinkNodes: ['sink_object'] },
  s3: { ingest: 'partial', export: 'partial', sourceNodes: ['source_file'], sinkNodes: ['sink_object'] },
  minio: { ingest: 'partial', export: 'partial', sourceNodes: ['source_file'], sinkNodes: ['sink_object'] },
  ftp: { ingest: 'partial', export: 'partial', sourceNodes: ['source_file'], sinkNodes: ['sink_ftp'] },
  sftp: { ingest: 'partial', export: 'partial', sourceNodes: ['source_file'], sinkNodes: ['sink_ftp'] },
  file: { ingest: 'partial', export: 'partial', sourceNodes: ['source_file'], sinkNodes: ['sink_ftp'] },
  http_api: { ingest: 'partial', export: 'excluded', sourceNodes: ['source_api'], sinkNodes: [] },
  tableau: { ingest: 'excluded', export: 'partial', sourceNodes: [], sinkNodes: ['sink_bi'] },
  superset: { ingest: 'excluded', export: 'partial', sourceNodes: [], sinkNodes: ['sink_bi'] },
  airflow: { ingest: 'excluded', export: 'excluded', sourceNodes: [], sinkNodes: [] },
}

function normalizeType(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/\//g, '_')
}

export function getEtlDsCap(typeCode) {
  const t = normalizeType(typeCode)
  if (!t) return null
  if (CAPS[t]) return { typeCode: t, ...CAPS[t] }
  const hit = Object.keys(CAPS).find((k) => t.includes(k) || k.includes(t))
  if (hit) return { typeCode: hit, ...CAPS[hit] }
  return {
    typeCode: t,
    ingest: 'planned',
    export: 'planned',
    sourceNodes: ['source'],
    sinkNodes: ['sink_rdb'],
  }
}

/** 节点下拉是否展示该数据源 */
export function allowsEtlDsBind(typeCode, nodeType) {
  const c = getEtlDsCap(typeCode)
  if (!c || !nodeType) return true
  const isSource = String(nodeType).startsWith('source')
  const isSink = String(nodeType).startsWith('sink_')
  if (isSource) {
    if (c.ingest === 'excluded' || !c.sourceNodes?.length) return false
    return c.sourceNodes.includes(nodeType)
  }
  if (isSink) {
    if (c.export === 'excluded' || !c.sinkNodes?.length) return false
    return c.sinkNodes.includes(nodeType)
  }
  return true
}

export function etlDsBindHint(typeCode, nodeType) {
  const c = getEtlDsCap(typeCode)
  if (!c || !nodeType) return ''
  const isSource = String(nodeType).startsWith('source')
  const lv = isSource ? c.ingest : c.export
  if (lv === 'excluded') return `${c.typeCode} 不用于 ETL ${isSource ? '入湖' : '出湖'}`
  if (!allowsEtlDsBind(typeCode, nodeType)) {
    const prefer = isSource ? c.sourceNodes : c.sinkNodes
    return `${c.typeCode} 建议挂 ${prefer?.join('/') || '其它节点'}`
  }
  if (lv === 'planned') return `${c.typeCode} 能力 planned（待加深）`
  if (lv === 'partial') return `${c.typeCode} 能力 partial`
  return ''
}
