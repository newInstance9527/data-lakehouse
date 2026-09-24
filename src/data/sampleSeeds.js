/**
 * 空列表时写入后端的示例模板（仅 create 入参，禁止当页面假列表渲染）。
 * 工作空间禁止 ensureOnce / SAMPLE_WS：空列表即为空态。
 */

export const SAMPLE_DATASOURCE = {
  name: '示例 MySQL 源',
  type: 'MySQL',
  typeCode: 'mysql',
  purpose: '数据入湖',
  desc: '平台空库自动创建的连通性示例（请改真实连接）',
  host: '127.0.0.1',
  port: '3306',
  database: 'demo',
  user: 'demo',
  password: 'demo',
}

export const SAMPLE_ETL_DAG = {
  name: '示例入湖任务',
  code: 'etl_sample_demo',
  engine: 'Flink',
  desc: '空库自动创建；请替换为真实源汇',
}

export const SAMPLE_METRIC = {
  name: '示例成交额',
  metricCode: 'm_sample_gmv',
  kind: '原子',
  domainCode: 'trade',
  unit: '元',
  caliber: '空库自动创建的指标头示例',
  status: 'draft',
}

export const SAMPLE_AI_MODEL = {
  id: 'aim_datagoo_dsflash',
  name: 'DeepSeek-V4-Flash正式版',
  provider: 'DeepSeek',
  modelId: 'DeepSeek-V4-Flash正式版',
  baseUrl: 'https://ai.datagoo.cn:3030/v1',
  /** 空库 bootstrap 不写 Key（避免覆盖用户 Vault）；请在模型编辑中填写 */
  apiKey: '',
  enabled: true,
  egressApproved: true,
  remark: 'DataGoo OpenAI 兼容对话',
}

export const SAMPLE_QUERY_SCRIPT = {
  name: '示例查询',
  engine: 'trino',
  sql: 'SELECT 1 AS ok',
  remark: '空库自动创建的脚本示例',
}

export const SAMPLE_LC_POLICY = {
  name: '示例快照保留',
  tableFqn: 'iceberg.demo.sample_table',
  keepCount: 10,
  keepDays: 7,
  status: 'active',
  remark: '空库自动创建；请改真实表名',
}

export const SAMPLE_DEL_REQUEST = {
  subjectId: 'sample-demo-001',
  subjectType: 'user',
  reqType: 'forget',
  legalBasis: '示例 · 空库自动创建',
  scopeLabel: '指定行',
  sourceSystem: '人工',
  remark: '示例被遗忘权工单（空库自动创建）',
  autoAssess: false,
  status: 'draft',
}

/** 需已有数据源；dsId 由调用方注入 */
export const SAMPLE_ASSET = {
  objectName: 'sample_demo_table',
  assetCode: 'ods_demo.sample_demo_table',
  name: 'sample_demo_table',
  cnName: '示例演示表',
  layer: 'ods',
  domain: 'demo',
  description: '空库自动登记的资产示例；请改真实对象',
  sensitivity: 'internal',
  engine: 'Iceberg',
}

/** 需已有开发脚本；scriptId / ws 由调用方注入 */
export const SAMPLE_RELEASE = {
  engine: 'trino',
  env: 'dev',
}

/** 需已有资产或可执行 SQL；调用方补 sourceRef / portalDsId */
export const SAMPLE_DATAAPI = {
  name: '示例日汇总 API',
  publicPath: '/api/sample/demo_daily',
  method: 'GET',
  sourceKind: 'sql',
  authMode: 'token',
  qpsLimit: 50,
  burstLimit: 100,
  domainCode: 'demo',
  sql: 'SELECT 1 AS ok',
  engine: 'SQL',
  description: '空库自动创建的数据服务示例',
}
