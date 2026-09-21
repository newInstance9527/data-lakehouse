/** 即席查询 · Trino / Gravitino 演示数据 */

export const DEFAULT_SQL = `-- 交易域：近7天按渠道分组的 GMV 趋势
SELECT
  dt,
  order_channel,
  COUNT(DISTINCT order_id) AS order_cnt,
  SUM(pay_amt) AS gmv,
  buyer_mobile -- 敏感列：会被 Trino 动态脱敏
FROM iceberg.dwd_trade.dwd_order_detail
WHERE dt BETWEEN '2026-08-27' AND '2026-09-02'
GROUP BY dt, order_channel, buyer_mobile
ORDER BY dt DESC, gmv DESC;
`

export const QUERY_TABS_SEED = [
  {
    id: 'tab_unsaved',
    name: 'unsaved_20260903_1435.sql',
    closable: true,
    sql: DEFAULT_SQL,
  },
  {
    id: 'tab_gmv30',
    name: 'gmv_by_channel_30d.sql',
    closable: true,
    sql: `SELECT
  dt,
  order_channel,
  SUM(pay_amt) AS gmv
FROM iceberg.dwd_trade.dwd_order_detail
WHERE dt BETWEEN date_sub(current_date, 30) AND current_date
  AND is_paid = 1
GROUP BY dt, order_channel
ORDER BY dt DESC, gmv DESC
LIMIT 500;
`,
  },
]

/** Catalog 树：catalog → schema → table；columns 仅演示降级，线上走 columns 接口 */
export const QUERY_CATALOG = [
  {
    id: 'iceberg',
    type: 'catalog',
    name: 'iceberg',
    engine: 'Iceberg',
    open: true,
    children: [
      {
        id: 'ods_trade',
        type: 'schema',
        name: 'ods_trade',
        layer: 'ODS',
        open: true,
        children: [
          {
            id: 's_order',
            type: 'table',
            name: 's_order',
            layer: 'ODS',
            rows: '2.3亿',
            fqn: 'iceberg.ods_trade.s_order',
            sampleSql:
              "SELECT *\nFROM iceberg.ods_trade.s_order\nWHERE dt >= date_sub(current_date, 7)\nLIMIT 100;",
            columns: [
              { name: 'dt', type: 'date', partition: true, comment: '分区' },
              { name: 'order_id', type: 'bigint' },
              { name: 'buyer_mobile', type: 'varchar', masked: true, comment: '动态脱敏' },
              { name: 'pay_amt', type: 'decimal(18,2)' },
            ],
          },
          {
            id: 's_order_item',
            type: 'table',
            name: 's_order_item',
            layer: 'ODS',
            fqn: 'iceberg.ods_trade.s_order_item',
            columns: [
              { name: 'dt', type: 'date', partition: true },
              { name: 'order_id', type: 'bigint' },
              { name: 'sku_id', type: 'bigint' },
            ],
          },
          {
            id: 's_payment',
            type: 'table',
            name: 's_payment',
            layer: 'ODS',
            fqn: 'iceberg.ods_trade.s_payment',
            columns: [
              { name: 'dt', type: 'date', partition: true },
              { name: 'pay_id', type: 'bigint' },
              { name: 'pay_amt', type: 'decimal(18,2)' },
            ],
          },
        ],
      },
      {
        id: 'dwd_trade',
        type: 'schema',
        name: 'dwd_trade',
        layer: 'DWD',
        open: true,
        children: [
          {
            id: 'dwd_order_detail',
            type: 'table',
            name: 'dwd_order_detail',
            layer: 'DWD',
            fqn: 'iceberg.dwd_trade.dwd_order_detail',
            active: true,
            sampleSql: DEFAULT_SQL,
            columns: [
              { name: 'dt', type: 'date', partition: true },
              { name: 'order_channel', type: 'varchar' },
              { name: 'order_id', type: 'bigint' },
              { name: 'pay_amt', type: 'decimal(18,2)' },
              { name: 'buyer_mobile', type: 'varchar', masked: true },
            ],
          },
          {
            id: 'dwd_payment_detail',
            type: 'table',
            name: 'dwd_payment_detail',
            layer: 'DWD',
            fqn: 'iceberg.dwd_trade.dwd_payment_detail',
            columns: [
              { name: 'dt', type: 'date', partition: true },
              { name: 'pay_id', type: 'bigint' },
              { name: 'channel', type: 'varchar' },
            ],
          },
        ],
      },
      {
        id: 'dws_trade',
        type: 'schema',
        name: 'dws_trade',
        layer: 'DWS',
        open: false,
        children: [
          {
            id: 'dws_order_1d',
            type: 'table',
            name: 'dws_order_1d',
            layer: 'DWS',
            fqn: 'iceberg.dws_trade.dws_order_1d',
            columns: [
              { name: 'dt', type: 'date', partition: true },
              { name: 'order_channel', type: 'varchar' },
              { name: 'gmv', type: 'decimal(18,2)' },
            ],
          },
        ],
      },
      {
        id: 'ads',
        type: 'schema',
        name: 'ads',
        layer: 'ADS',
        open: false,
        children: [
          {
            id: 'ads_gmv_board',
            type: 'table',
            name: 'ads_gmv_board',
            layer: 'ADS',
            star: true,
            fqn: 'iceberg.ads.ads_gmv_board',
            columns: [
              { name: 'dt', type: 'date', partition: true },
              { name: 'gmv', type: 'decimal(18,2)' },
              { name: 'buyer_id', type: 'bigint' },
            ],
          },
          {
            id: 'ads_user_profile',
            type: 'table',
            name: 'ads_user_profile',
            layer: 'ADS',
            fqn: 'iceberg.ads.ads_user_profile',
            columns: [
              { name: 'user_id', type: 'bigint' },
              { name: 'mobile', type: 'varchar', masked: true },
            ],
          },
        ],
      },
      {
        id: 'dim',
        type: 'schema',
        name: 'dim',
        layer: 'DIM',
        open: false,
        children: [
          {
            id: 'dim_user',
            type: 'table',
            name: 'dim_user',
            layer: 'DIM',
            fqn: 'iceberg.dim.dim_user',
            columns: [
              { name: 'user_id', type: 'bigint' },
              { name: 'mobile', type: 'varchar', masked: true },
            ],
          },
          {
            id: 'dim_sku',
            type: 'table',
            name: 'dim_sku',
            layer: 'DIM',
            star: true,
            fqn: 'iceberg.dim.dim_sku',
            columns: [
              { name: 'sku_id', type: 'bigint' },
              { name: 'sku_name', type: 'varchar' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'clickhouse',
    type: 'catalog',
    name: 'clickhouse',
    engine: 'ClickHouse',
    hint: '作业写入 · 人只读',
    open: true,
    children: [
      {
        id: 'ck_ads',
        type: 'schema',
        name: 'ads',
        layer: 'ADS',
        open: true,
        children: [
          {
            id: 'ck_ads_gmv',
            type: 'table',
            name: 'ads_gmv_board',
            layer: 'ADS',
            hint: '经脱敏',
            fqn: 'clickhouse.ads.ads_gmv_board',
            columns: [
              { name: 'dt', type: 'date' },
              { name: 'gmv', type: 'decimal(18,2)' },
            ],
          },
          {
            id: 'ck_dws_pv',
            type: 'table',
            name: 'dws_pv_1min',
            layer: 'DWS',
            hint: '实时',
            fqn: 'clickhouse.ads.dws_pv_1min',
            columns: [
              { name: 'minute_ts', type: 'timestamp' },
              { name: 'pv', type: 'bigint' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mysql_poste_prod',
    type: 'catalog',
    name: 'mysql_poste_prod',
    engine: 'MySQL',
    hint: '未授权',
    locked: true,
    open: false,
    children: [],
  },
]

export const QUERY_HISTORY = [
  {
    id: 'h1',
    time: '09-03 14:28',
    user: '我 (张明)',
    summary: 'SELECT ... FROM dwd_order_detail WHERE dt BETWEEN... (11行)',
    duration: '—',
    scan: '—',
    rows: '—',
    status: 'editing',
    statusLabel: '编辑中',
    tagClass: 'tag-blue',
    sql: `SELECT dt, order_channel, SUM(pay_amt) AS gmv
FROM iceberg.dwd_trade.dwd_order_detail
WHERE dt BETWEEN date_sub(current_date, 7) AND current_date
  AND is_paid = 1
GROUP BY dt, order_channel
ORDER BY dt DESC, gmv DESC;`,
  },
  {
    id: 'h2',
    time: '09-03 13:51',
    user: '王芳',
    summary: 'SELECT count(*) FROM ods_trade.s_order',
    duration: '3.2s',
    scan: '128GB',
    scanDanger: true,
    rows: '1',
    status: 'blocked',
    statusLabel: '⚠ 无分区过滤·阻断',
    tagClass: 'tag-red',
    sql: 'SELECT count(*) FROM iceberg.ods_trade.s_order;',
  },
  {
    id: 'h3',
    time: '09-03 12:40',
    user: '我 (张明)',
    summary: 'SELECT ... FROM ads_gmv_board JOIN dim_user',
    duration: '1.8s',
    scan: '680MB',
    rows: '342',
    status: 'ok',
    statusLabel: '✓ · 脱敏 2列',
    tagClass: 'tag-green',
    sql: `SELECT a.dt, a.gmv, u.user_id
FROM iceberg.ads.ads_gmv_board a
JOIN iceberg.dim.dim_user u ON a.buyer_id = u.user_id
WHERE a.dt >= date_sub(current_date, 7)
LIMIT 500;`,
  },
  {
    id: 'h4',
    time: '09-03 11:08',
    user: '刘强',
    summary: 'SELECT * FROM dwd_user_info',
    duration: '8.4s',
    scan: '3.2GB',
    rows: '120,000',
    status: 'export',
    statusLabel: '导出 CSV · 静态脱敏',
    tagClass: 'tag-orange',
    sql: 'SELECT * FROM iceberg.dwd_user.dwd_user_info WHERE dt = current_date LIMIT 1000;',
  },
  {
    id: 'h5',
    time: '09-03 10:19',
    user: '陈晓',
    summary: 'SELECT ... FROM dws_order_1d',
    duration: '980ms',
    scan: '86MB',
    rows: '217',
    status: 'ok',
    statusLabel: '✓',
    tagClass: 'tag-green',
    sql: `SELECT dt, order_channel, gmv
FROM iceberg.dws_trade.dws_order_1d
WHERE dt >= date_sub(current_date, 14)
ORDER BY dt DESC;`,
  },
]

const CHANNELS = [
  { name: 'App', tag: 'tag-blue' },
  { name: 'Web', tag: 'tag-green' },
  { name: 'Mini', tag: 'tag-purple' },
  { name: 'H5', tag: 'tag-orange' },
  { name: '第三方', tag: 'tag-cyan' },
]

/** 演示查询结果行 */
export function buildDemoResultRows() {
  const rows = []
  for (let i = 0; i < 6; i++) {
    const d = `2026-09-${String(2 - i).padStart(2, '0')}`
    CHANNELS.forEach((ch) => {
      const gmv = Math.round((Math.random() * 200 + 120) * 100) / 100
      const cnt = Math.floor(Math.random() * 8000 + 1500)
      rows.push({
        dt: d,
        order_channel: ch.name,
        channelTag: ch.tag,
        order_cnt: cnt,
        gmv,
        buyer_mobile: `138****${Math.floor(Math.random() * 9000) + 1000}`,
      })
    })
  }
  return rows
}

export const RESULT_COLUMNS = [
  { key: 'dt', label: 'dt' },
  { key: 'order_channel', label: 'order_channel' },
  { key: 'order_cnt', label: 'order_cnt', align: 'right' },
  { key: 'gmv', label: 'gmv', align: 'right', success: true },
  { key: 'buyer_mobile', label: 'buyer_mobile', masked: true },
]
