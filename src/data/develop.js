/** 数据开发 / SQL 工作台 · 引擎与状态标签 */

export const DEV_KPIS = [
  { label: '工作空间脚本数', value: '286', unit: '个', delta: '↑ 12 本月新增', tone: '' },
  { label: '本周提交试跑', value: '1,482', unit: '次', delta: '成功率 94.2%', tone: 'ok' },
  { label: '通过上版审批', value: '37', unit: '单', delta: '待审 8 单', tone: '' },
  { label: '自定义 UDF', value: '42', unit: '个', delta: 'Python 26 · Java 16', tone: 'ok' },
]

/** 试跑 / 上版引擎：Flink + Spark 为主，Trino 仅校验；同步类走 ETL/DataX */
export const DEV_ENGINES = [
  { value: 'spark', label: 'Spark SQL', role: 'main' },
  { value: 'flink', label: 'Flink SQL', role: 'main' },
  { value: 'trino', label: '即席校验', role: 'check' },
]

export const DEV_UDFS = [
  {
    name: 'udf_mask_phone',
    desc: '手机号动态脱敏·保留前3后4',
    engines: ['trino', 'flink', 'spark'],
    engine: 'Spark+Flink+Trino',
    ver: 'v3',
    uses: '安全模块·dwd_user_info',
    snippet: 'udf_mask_phone(buyer_mobile)',
  },
  {
    name: 'udf_mask_id_card',
    desc: '身份证号脱敏·保留前6后4',
    engines: ['trino', 'spark'],
    engine: 'Spark+Trino',
    ver: 'v2',
    uses: 'dwd_user_info',
    snippet: 'udf_mask_id_card(id_card)',
  },
  {
    name: 'map_status_code',
    desc: '交易状态码值标准化映射',
    engines: ['spark', 'flink', 'trino'],
    engine: 'Spark+Flink+Trino',
    ver: 'v5',
    uses: 'dwd_order_detail',
    snippet: 'map_status_code(order_status)',
  },
  {
    name: 'udf_parse_json',
    desc: 'JSON 字段解析提取',
    engines: ['flink', 'spark', 'trino'],
    engine: 'Spark+Flink+Trino',
    ver: 'v1',
    uses: '埋点 dws_pv',
    snippet: "udf_parse_json(payload, '$.event')",
  },
  {
    name: 'udf_geo_hash',
    desc: '经纬度 Geohash 编码',
    engines: ['spark', 'trino'],
    engine: 'Spark+Trino',
    ver: 'v2',
    uses: '用户画像',
    snippet: 'udf_geo_hash(lat, lng, 6)',
  },
  {
    name: 'udf_date_key',
    desc: '日期转数字键 yyyyMMdd',
    engines: ['spark', 'flink', 'trino'],
    engine: 'Spark+Flink+Trino',
    ver: 'v1',
    uses: '通用',
    snippet: 'udf_date_key(dt)',
  },
]

/** 按当前试跑引擎过滤可用 UDF */
export function udfsForEngine(engine) {
  const key = String(engine || '').toLowerCase()
  return DEV_UDFS.filter((u) => !u.engines?.length || u.engines.includes(key))
}

export const DEV_RELEASES = [
  {
    version: 'v23',
    name: 'gmv_by_channel_7d.sql',
    env: 'PROD',
    status: 'published',
    statusLabel: '已发布',
    approver: '李明',
    at: '2026-09-02 18:20',
  },
  {
    version: 'v22',
    name: 'user_dup_fix.sql',
    env: 'TEST',
    status: 'running',
    statusLabel: '试跑中',
    approver: '—',
    at: '2026-09-03 10:12',
  },
  {
    version: 'v21',
    name: 'dim_item_snapshot.sql',
    env: 'PROD',
    status: 'published',
    statusLabel: '已发布',
    approver: '张涛',
    at: '2026-09-01 09:48',
  },
]

/** 资源树：文件夹 + 脚本 */
export const DEV_TREE = [
  {
    id: 'folder_trade',
    type: 'folder',
    name: '交易域 / dwd_trade',
    open: true,
  },
  {
    id: 'gmv_by_channel_7d',
    type: 'file',
    folder: 'folder_trade',
    name: 'gmv_by_channel_7d.sql',
    lang: 'SQL',
    status: 'DRAFT',
    badge: '',
    version: 'v23',
    author: '张明',
    editedAt: '3 分钟前',
    links: 'dwd_order_detail · 指标 M-0001 · 质量规则 PK_UNIQUE',
    env: 'TEST',
    engine: 'spark',
    lint: [
      { label: '分区裁剪 已启用', tone: 'ok' },
      { label: 'SELECT * 未使用', tone: 'ok' },
      { label: '缺少 LIMIT 提示', tone: 'warn' },
      { label: '脱敏列 buyer_mobile 已策略绑定', tone: 'ok' },
      { label: '预计扫描 3.2 GB', tone: '' },
    ],
    sql: `-- GMV 近 7 天按渠道（脱敏版）
SELECT
  dt,
  order_channel,
  COUNT(DISTINCT order_id) AS order_cnt,
  SUM(pay_amt) AS gmv,
  COUNT(DISTINCT buyer_id) AS buyer_cnt
FROM iceberg.dwd_trade.dwd_order_detail
WHERE dt BETWEEN date '2026-08-27' AND date '2026-09-02'
  AND is_paid = 1
GROUP BY dt, order_channel
ORDER BY dt DESC, gmv DESC;
`,
  },
  {
    id: 'dwd_order_detail_clean',
    type: 'file',
    folder: 'folder_trade',
    name: 'dwd_order_detail_clean.sql',
    lang: 'SQL',
    status: 'DRAFT',
    badge: '阻断',
    version: 'v18',
    author: '王芳',
    editedAt: '昨天',
    links: 'ods_trade.s_order · 标准 STD-C0021 · 质量门禁',
    env: 'TEST',
    engine: 'flink',
    lint: [
      { label: '码值映射 STD-C0021', tone: 'ok' },
      { label: '质量门禁：refund_reason 未映射码', tone: 'warn' },
      { label: '分区字段 dt 已过滤', tone: 'ok' },
    ],
    sql: `-- DWD 订单明细清洗（含标准码值映射）
INSERT INTO iceberg.dwd_trade.dwd_order_detail
SELECT
  order_id,
  order_no,
  buyer_id,
  udf_mask_phone(buyer_mobile) AS buyer_mobile,
  map_status_code(stat) AS order_status,
  amount / 100.0 AS pay_amt,
  channel AS order_channel,
  dt
FROM iceberg.ods_trade.s_order
WHERE dt = current_date - INTERVAL '1' DAY
  AND is_deleted = 0;
`,
  },
  {
    id: 'dws_order_1d_build',
    type: 'file',
    folder: 'folder_trade',
    name: 'dws_order_1d_build.sql',
    lang: 'SQL',
    status: 'TESTED',
    badge: '',
    version: 'v9',
    author: '刘强',
    editedAt: '2 天前',
    links: 'dwd_order_detail · dws_order_1d',
    env: 'PRE',
    lint: [
      { label: '聚合键完整', tone: 'ok' },
      { label: '预计扫描 1.1 GB', tone: '' },
    ],
    sql: `-- DWS 订单日汇总
INSERT INTO iceberg.dws_trade.dws_order_1d
SELECT
  dt,
  order_channel,
  COUNT(DISTINCT order_id) AS order_cnt,
  SUM(pay_amt) AS gmv,
  COUNT(DISTINCT buyer_id) AS buyer_cnt
FROM iceberg.dwd_trade.dwd_order_detail
WHERE dt = current_date - INTERVAL '1' DAY
  AND is_paid = 1
GROUP BY dt, order_channel;
`,
  },
  {
    id: 'ads_gmv_board_dualwrite',
    type: 'file',
    folder: 'folder_trade',
    name: 'ads_gmv_board_dualwrite.sql',
    lang: 'SQL',
    status: 'PROD',
    badge: '',
    version: 'v12',
    author: '张明',
    editedAt: '上周',
    links: 'dws_order_1d · ads_gmv_board · 指标 M-0001',
    env: 'PROD',
    lint: [
      { label: '双写对账钩子已挂', tone: 'ok' },
      { label: '口径锁定 M-0001', tone: 'ok' },
    ],
    sql: `-- ADS GMV 看板双写（Iceberg + ClickHouse via SA）
INSERT INTO iceberg.ads.ads_gmv_board
SELECT
  dt,
  order_channel,
  SUM(gmv) AS gmv,
  SUM(order_cnt) AS order_cnt
FROM iceberg.dws_trade.dws_order_1d
WHERE dt >= current_date - INTERVAL '30' DAY
GROUP BY dt, order_channel;
`,
  },
  {
    id: 'ads_gmv_board_reconcile',
    type: 'file',
    folder: 'folder_trade',
    name: 'ads_gmv_board_reconcile.sql',
    lang: 'SQL',
    status: 'PROD',
    badge: '',
    version: 'v4',
    author: '陈晓',
    editedAt: '上周',
    links: 'ads_gmv_board · 对账任务',
    env: 'PROD',
    lint: [{ label: '对账阈值阈值 < 0.1%', tone: 'ok' }],
    sql: `-- 湖 / CK 对账抽样
SELECT
  'iceberg' AS side,
  SUM(gmv) AS gmv
FROM iceberg.ads.ads_gmv_board
WHERE dt = current_date - INTERVAL '1' DAY
UNION ALL
SELECT
  'clickhouse' AS side,
  SUM(gmv) AS gmv
FROM clickhouse.ads.ads_gmv_board
WHERE dt = current_date - INTERVAL '1' DAY;
`,
  },
  {
    id: 'folder_user',
    type: 'folder',
    name: '用户域 / dwd_user',
    open: false,
  },
  {
    id: 'user_dup_fix',
    type: 'file',
    folder: 'folder_user',
    name: 'user_dup_fix.sql',
    lang: 'SQL',
    status: 'DRAFT',
    badge: '',
    version: 'v22',
    author: '王芳',
    editedAt: '今天',
    links: 'dwd_user_info · 质量规则 USER_UNIQUE',
    env: 'TEST',
    lint: [
      { label: '唯一性检查草稿', tone: 'warn' },
      { label: 'LIMIT 100 已加', tone: 'ok' },
    ],
    sql: `-- 用户重复键排查
SELECT
  user_id,
  COUNT(*) AS cnt
FROM iceberg.dwd_user.dwd_user_info
WHERE dt = current_date
GROUP BY user_id
HAVING COUNT(*) > 1
LIMIT 100;
`,
  },
  {
    id: 'folder_dim',
    type: 'folder',
    name: '商品域 / dim',
    open: false,
  },
  {
    id: 'dim_item_snapshot',
    type: 'file',
    folder: 'folder_dim',
    name: 'dim_item_snapshot.sql',
    lang: 'SQL',
    status: 'PROD',
    badge: '',
    version: 'v21',
    author: '张涛',
    editedAt: '09-01',
    links: 'dim_sku · 商品主数据',
    env: 'PROD',
    lint: [{ label: '快照分区 dt 就绪', tone: 'ok' }],
    sql: `-- 商品维度日快照
INSERT INTO iceberg.dim.dim_sku
SELECT
  sku_id,
  sku_name,
  category_id,
  status,
  current_date AS dt
FROM iceberg.ods_goods.s_sku
WHERE dt = current_date;
`,
  },
  {
    id: 'folder_udf',
    type: 'folder',
    name: 'UDF / functions',
    open: false,
  },
]

export const DEV_ENVS = [
  { value: 'TEST', label: 'TEST' },
  { value: 'PRE', label: 'PRE' },
  { value: 'PROD', label: 'PROD (需审批)', disabled: true },
]

export function statusTagClass(status) {
  if (status === 'PROD') return 'tag-green'
  if (status === 'TESTED') return 'tag-blue'
  if (status === 'DRAFT') return 'tag-orange'
  return 'tag-gray'
}

export function releaseTagClass(status) {
  if (status === 'published') return 'tag-green'
  if (status === 'running') return 'tag-orange'
  return 'tag-gray'
}

export function lintTagClass(tone) {
  if (tone === 'ok') return 'tag-green'
  if (tone === 'warn') return 'tag-orange'
  return 'tag-gray'
}
