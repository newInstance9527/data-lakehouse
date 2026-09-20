/**
 * 数据源类型 → 官方风格 SVG（Simple Icons CC0 / 自绘兜底）
 * 用 <img> 展示，避免 CSS mask 引用外部 SVG 在浏览器中不渲染。
 */
import mysql from '@/assets/ds-icons/mysql.svg'
import mariadb from '@/assets/ds-icons/mariadb.svg'
import postgresql from '@/assets/ds-icons/postgresql.svg'
import oracle from '@/assets/ds-icons/oracle.svg'
import sqlserver from '@/assets/ds-icons/microsoftsqlserver.svg'
import clickhouse from '@/assets/ds-icons/clickhouse.svg'
import doris from '@/assets/ds-icons/doris.svg'
import starrocks from '@/assets/ds-icons/starrocks.svg'
import hive from '@/assets/ds-icons/apachehive.svg'
import iceberg from '@/assets/ds-icons/iceberg.svg'
import hbase from '@/assets/ds-icons/hbase.svg'
import hdfs from '@/assets/ds-icons/hdfs.svg'
import hadoop from '@/assets/ds-icons/apachehadoop.svg'
import kafka from '@/assets/ds-icons/apachekafka.svg'
import rabbitmq from '@/assets/ds-icons/rabbitmq.svg'
import pulsar from '@/assets/ds-icons/apachepulsar.svg'
import mongodb from '@/assets/ds-icons/mongodb.svg'
import redis from '@/assets/ds-icons/redis.svg'
import elasticsearch from '@/assets/ds-icons/elasticsearch.svg'
import opensearch from '@/assets/ds-icons/opensearch.svg'
import cassandra from '@/assets/ds-icons/apachecassandra.svg'
import minio from '@/assets/ds-icons/minio.svg'
import s3 from '@/assets/ds-icons/amazons3.svg'
import gcs from '@/assets/ds-icons/googlecloudstorage.svg'
import gcloud from '@/assets/ds-icons/googlecloud.svg'
import aws from '@/assets/ds-icons/amazonwebservices.svg'
import ftp from '@/assets/ds-icons/ftp.svg'
import gdrive from '@/assets/ds-icons/googledrive.svg'
import http from '@/assets/ds-icons/http.svg'
import trino from '@/assets/ds-icons/trino.svg'
import snowflake from '@/assets/ds-icons/snowflake.svg'
import databricks from '@/assets/ds-icons/databricks.svg'
import druid from '@/assets/ds-icons/apachedruid.svg'
import sqlite from '@/assets/ds-icons/sqlite.svg'
import tableau from '@/assets/ds-icons/tableau.svg'
import superset from '@/assets/ds-icons/superset.svg'
import powerbi from '@/assets/ds-icons/powerbi.svg'
import grafana from '@/assets/ds-icons/grafana.svg'
import metabase from '@/assets/ds-icons/metabase.svg'
import looker from '@/assets/ds-icons/looker.svg'
import airflow from '@/assets/ds-icons/apacheairflow.svg'
import flink from '@/assets/ds-icons/apacheflink.svg'
import spark from '@/assets/ds-icons/apachespark.svg'
import dbt from '@/assets/ds-icons/dbt.svg'
import nifi from '@/assets/ds-icons/nifi.svg'
import apache from '@/assets/ds-icons/apache.svg'
import fallback from '@/assets/ds-icons/fallback.svg'

/** 展示名 → SVG（含常见别名） */
const BY_LABEL = {
  MySQL: mysql,
  MariaDB: mariadb,
  PostgreSQL: postgresql,
  Oracle: oracle,
  'SQL Server': sqlserver,
  AzureSQL: sqlserver,
  ClickHouse: clickhouse,
  Doris: doris,
  StarRocks: starrocks,
  Hive: hive,
  Iceberg: iceberg,
  'Delta Lake': iceberg,
  HBase: hbase,
  HDFS: hdfs,
  Hadoop: hadoop,
  Kafka: kafka,
  Redpanda: kafka,
  Kinesis: aws,
  'Pub/Sub': gcloud,
  RabbitMQ: rabbitmq,
  Pulsar: pulsar,
  MongoDB: mongodb,
  Cassandra: cassandra,
  DynamoDB: aws,
  Redis: redis,
  Elasticsearch: elasticsearch,
  OpenSearch: opensearch,
  'S3 / MinIO': minio,
  'S3/MinIO': minio,
  S3: s3,
  MinIO: minio,
  GCS: gcs,
  ADLS: s3,
  'FTP/SFTP': ftp,
  'Google Drive': gdrive,
  'HTTP API': http,
  REST: http,
  OpenAPI: http,
  Trino: trino,
  Presto: trino,
  Snowflake: snowflake,
  Databricks: databricks,
  BigQuery: gcloud,
  Druid: druid,
  PinotDB: apache,
  SQLite: sqlite,
  'SAP HANA': oracle,
  DB2: apache,
  Teradata: apache,
  Greenplum: postgresql,
  Redshift: aws,
  Tableau: tableau,
  Superset: superset,
  PowerBI: powerbi,
  Grafana: grafana,
  Metabase: metabase,
  Looker: looker,
  Airflow: airflow,
  Flink: flink,
  Spark: spark,
  dbt: dbt,
  NiFi: nifi,
  KafkaConnect: kafka,
  MLflow: http,
  Sagemaker: aws,
}

/** 后端 typeCode → SVG（对齐 LhDatasourceTypeEnum） */
const BY_CODE = {
  mysql: mysql,
  mariadb: mariadb,
  pg: postgresql,
  postgresql: postgresql,
  oracle: oracle,
  sqlserver: sqlserver,
  azuresql: sqlserver,
  clickhouse: clickhouse,
  doris: doris,
  starrocks: starrocks,
  hive: hive,
  iceberg: iceberg,
  deltalake: iceberg,
  hbase: hbase,
  trino: trino,
  presto: trino,
  kafka: kafka,
  rabbitmq: rabbitmq,
  pulsar: pulsar,
  mongodb: mongodb,
  redis: redis,
  elasticsearch: elasticsearch,
  opensearch: opensearch,
  hdfs: hdfs,
  hadoop: hadoop,
  s3: minio,
  minio: minio,
  gcs: gcs,
  file: ftp,
  ftp: ftp,
  sftp: ftp,
  http_api: http,
  http: http,
  rest: http,
  openapi: http,
  tableau: tableau,
  superset: superset,
  powerbi: powerbi,
  grafana: grafana,
  metabase: metabase,
  looker: looker,
  airflow: airflow,
  flink: flink,
  spark: spark,
  dbt: dbt,
  nifi: nifi,
  snowflake: snowflake,
  databricks: databricks,
  bigquery: gcloud,
  redshift: aws,
  cassandra: cassandra,
  druid: druid,
  sqlite: sqlite,
  kinesis: aws,
  dynamodb: aws,
}

/** 规范化键：小写、去空格与常见分隔符 */
function normKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_/.-]+/g, '')
}

/** 由展示名表生成规范化索引，便于 S3/MinIO、s3 minio 等变体命中 */
const BY_NORM = (() => {
  const m = Object.create(null)
  for (const [k, url] of Object.entries(BY_LABEL)) {
    m[normKey(k)] = url
  }
  for (const [k, url] of Object.entries(BY_CODE)) {
    if (!m[k]) m[k] = url
    m[normKey(k)] = url
  }
  // 额外变体
  m[normKey('S3/MinIO')] = minio
  m[normKey('S3 / MinIO')] = minio
  m.s3minio = minio
  m.ftpsftp = ftp
  m.httpapi = http
  m.sqlserver = sqlserver
  m.microsoftsqlserver = sqlserver
  return m
})()

function normalizeLabel(type) {
  const raw = String(type || '').trim()
  if (!raw) return ''
  if (BY_LABEL[raw]) return raw
  const lower = raw.toLowerCase()
  const hit = Object.keys(BY_LABEL).find((k) => k.toLowerCase() === lower)
  return hit || raw
}

/**
 * 解析类型对应的图标 URL
 * @param {string} [type] 展示名或编码
 * @param {string} [typeCode] 后端 typeCode（优先）
 * @returns {string} SVG URL
 */
export function resolveDsTypeIconUrl(type, typeCode) {
  const code = String(typeCode || '').trim().toLowerCase()
  if (code && BY_CODE[code]) return BY_CODE[code]

  const nkCode = normKey(typeCode)
  if (nkCode && BY_NORM[nkCode]) return BY_NORM[nkCode]

  const label = normalizeLabel(type)
  if (label && BY_LABEL[label]) return BY_LABEL[label]

  const nkType = normKey(type)
  if (nkType && BY_NORM[nkType]) return BY_NORM[nkType]

  // 编码写在 type 字段上（如 mysql）
  if (nkType && BY_CODE[nkType]) return BY_CODE[nkType]

  if (/s3|minio/i.test(String(type || '') + String(typeCode || ''))) return minio
  if (/http|rest|openapi/i.test(String(type || '') + String(typeCode || ''))) return http
  if (/ftp|sftp|file/i.test(String(type || '') + String(typeCode || ''))) return ftp

  return fallback
}

export function dsTypeIconLabel(type) {
  return normalizeLabel(type) || String(type || '数据源')
}

/** 展示名 → 后端 typeCode（供资产列表无 typeCode 时推断） */
const LABEL_TO_CODE = {
  MySQL: 'mysql',
  MariaDB: 'mariadb',
  PostgreSQL: 'postgresql',
  Oracle: 'oracle',
  'SQL Server': 'sqlserver',
  AzureSQL: 'sqlserver',
  ClickHouse: 'clickhouse',
  Doris: 'doris',
  StarRocks: 'starrocks',
  Hive: 'hive',
  Iceberg: 'iceberg',
  HBase: 'hbase',
  HDFS: 'hdfs',
  Kafka: 'kafka',
  RabbitMQ: 'rabbitmq',
  Pulsar: 'pulsar',
  MongoDB: 'mongodb',
  Redis: 'redis',
  Elasticsearch: 'elasticsearch',
  OpenSearch: 'opensearch',
  'S3 / MinIO': 's3',
  'S3/MinIO': 's3',
  S3: 's3',
  MinIO: 'minio',
  'FTP/SFTP': 'ftp',
  'HTTP API': 'http_api',
  Trino: 'trino',
  Tableau: 'tableau',
  Superset: 'superset',
  Airflow: 'airflow',
  Snowflake: 'snowflake',
  Databricks: 'databricks',
}

export function inferDsTypeCode(type, typeCode) {
  const code = String(typeCode || '').trim().toLowerCase()
  if (code && BY_CODE[code]) return code
  const label = normalizeLabel(type)
  if (label && LABEL_TO_CODE[label]) return LABEL_TO_CODE[label]
  const nk = normKey(type)
  if (nk && BY_CODE[nk]) return nk
  if (/s3|minio/i.test(String(type || ''))) return 's3'
  if (/http|rest|openapi/i.test(String(type || ''))) return 'http_api'
  return code || ''
}
