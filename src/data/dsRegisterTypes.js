/**
 * 注册数据源可选类型（与后端 LhDatasourceTypeEnum / ds-type-fields.typeCode 对齐）。
 * 全量 DS_CAT_MAP 仅用于列表筛选历史数据，禁止把未接入别名放进注册下拉。
 */
import { sortTypesByCategory } from '@/data/datasources'

/** 有独立 typeCode、可登记的展示名（顺序即分类内优先级参考） */
export const DS_REGISTERABLE_LABELS = [
  'MySQL',
  'MariaDB', // → mysql（协议兼容）
  'PostgreSQL',
  'Oracle',
  'SQL Server',
  'AzureSQL', // → sqlserver（协议兼容）
  'ClickHouse',
  'Doris',
  'StarRocks',
  'Hive',
  'Iceberg',
  'HBase',
  'Trino',
  'Kafka',
  'RabbitMQ',
  'Pulsar',
  'MongoDB',
  'Redis',
  'Elasticsearch',
  'HDFS',
  'S3 / MinIO',
  'FTP/SFTP',
  'HTTP API',
  'Tableau',
  'Superset',
  'Airflow',
]

/** 注册表单 select 用 */
export const DS_REGISTER_TYPE_OPTIONS = sortTypesByCategory(DS_REGISTERABLE_LABELS)

/**
 * 未接入、禁止新注册的展示名（曾用别名套壳，易错存为错误 typeCode）
 */
export const DS_BLOCKED_REGISTER_LABELS = [
  'Snowflake',
  'Redshift',
  'BigQuery',
  'Presto',
  'Databricks',
  'Delta Lake',
  'SAP HANA',
  'DB2',
  'Teradata',
  'Greenplum',
  'SQLite',
  'Cassandra',
  'DynamoDB',
  'PinotDB',
  'Druid',
  'Redpanda',
  'Kinesis',
  'Pub/Sub',
  'OpenSearch',
  'GCS',
  'ADLS',
  'Google Drive',
  'REST',
  'OpenAPI',
  'PowerBI',
  'Grafana',
  'Metabase',
  'Looker',
  'Flink',
  'Spark',
  'dbt',
  'NiFi',
  'KafkaConnect',
  'MLflow',
  'Sagemaker',
]

export function isRegisterableDsType(label) {
  return DS_REGISTERABLE_LABELS.includes(String(label || '').trim())
}
