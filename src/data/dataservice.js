/** 数据服务中心 · SQLREST 治理壳
 * Manager / Gateway 默认地址对齐《部署台账》dev3（后端 /lh/dataapi/embedUrl 可覆盖）
 */

/** @see lakehouse-design/部署台账.md · SQLREST Manager / Gateway */
export const SQLREST_MANAGER_URL = 'http://dev3.datagoo.cn:18090'
export const SQLREST_GATEWAY_URL = 'http://dev3.datagoo.cn:18091'

export function defaultSqlrestEmbed(root = SQLREST_MANAGER_URL, gateway = SQLREST_GATEWAY_URL) {
  const base = String(root || SQLREST_MANAGER_URL).replace(/\/$/, '')
  const gw = String(gateway || SQLREST_GATEWAY_URL).replace(/\/$/, '')
  return {
    sqlrest: base,
    interfaceList: `${base}/#/interface/list`,
    interfaceCreate: `${base}/#/interface/create`,
    datasource: `${base}/#/datasource`,
    client: `${base}/#/setting/client`,
    online: `${base}/#/service/search`,
    gateway: gw,
    edgeMode: 'gateway',
  }
}

export const DS_KPIS = [
  {
    label: '门户已发布',
    value: '—',
    unit: '个',
    delta: '加载中…',
    deltaCls: '',
  },
  {
    label: '近 24h 调用',
    value: '—',
    unit: '次',
    delta: '',
    deltaCls: '',
  },
  {
    label: 'SQLREST 接口',
    value: '—',
    unit: '个',
    delta: '',
    deltaCls: '',
  },
  {
    label: '活动订阅方',
    value: '—',
    unit: '个',
    delta: '',
    deltaCls: '',
  },
]

const API_SEED = [
  {
    method: 'GET',
    path: '/api/gmv/daily',
    name: '日 GMV 查询',
    desc: '按天/渠道返回 GMV·口径锁定 M-0001',
    metric: 'M-0001',
    asset: 'ads_gmv',
    domain: '交易域',
    qps: '1200',
    rt: '8ms',
    sub: '12',
    level: 'L2 降级中',
    levelCls: 'tag-orange',
    auth: 'Token',
    owner: '张涛',
    publishEnv: 'prod',
    srcType: '指标',
    responseFormat: 'wrapped',
    responseShape: 'list',
    breaker: '5xx>20% 熔断 30s',
    publishedAt: '2026-07-12 14:20:00',
    sql: `SELECT dt, channel, total_gmv
FROM metric_query('M-0001')
WHERE dt = {{dt}}
LIMIT {{limit}}`,
    params: [
      { name: 'dt', type: 'date', required: true, example: '2026-09-16', desc: '统计日' },
      { name: 'channel', type: 'string', required: false, example: 'App', desc: '渠道' },
      { name: 'limit', type: 'int', required: false, example: '100', desc: '返回行数' },
    ],
    responses: [
      { source: 'dt', name: 'dt', type: 'date', nullable: false, transform: 'none', example: '2026-09-16', desc: '统计日' },
      { source: 'channel', name: 'channel', type: 'string', nullable: true, transform: 'none', example: 'App', desc: '渠道' },
      {
        source: 'total_gmv',
        name: 'totalGmv',
        type: 'number',
        nullable: false,
        transform: 'cents_to_yuan',
        example: '32846000',
        desc: 'GMV（分→元）',
      },
    ],
  },
  {
    method: 'GET',
    path: '/api/gmv/trend',
    name: 'GMV 趋势',
    desc: '近 N 天 GMV 趋势·供 Superset',
    metric: 'M-0001',
    asset: 'ads_gmv',
    domain: '交易域',
    qps: '860',
    rt: '12ms',
    sub: '8',
    level: 'L2',
    levelCls: 'tag-orange',
    auth: 'Token',
    owner: '张涛',
    sql: `SELECT dt, SUM(total_gmv) AS total_gmv
FROM ads.ads_gmv_board
WHERE dt BETWEEN {{start}} AND {{end}}
GROUP BY dt
ORDER BY dt`,
    params: [
      { name: 'start', type: 'date', required: true, example: '2026-09-01', desc: '开始日' },
      { name: 'end', type: 'date', required: true, example: '2026-09-16', desc: '结束日' },
    ],
    responses: [
      { source: 'dt', name: 'dt', type: 'date', nullable: false, transform: 'none', example: '2026-09-16', desc: '' },
      { source: 'total_gmv', name: 'totalGmv', type: 'number', nullable: false, transform: 'cents_to_yuan', example: '32846000', desc: '' },
    ],
  },
  {
    method: 'POST',
    path: '/api/user/profile',
    name: '用户画像查询',
    desc: '按 user_id 返回 200+ 标签·脱敏',
    metric: '-',
    asset: 'dws_user_profile',
    domain: '用户域',
    qps: '640',
    rt: '35ms',
    sub: '15',
    level: 'L1',
    levelCls: 'tag-green',
    auth: 'OAuth2',
    owner: '王芳',
    responseShape: 'object',
    sql: `SELECT user_id, gender, city_level, rfm_score
FROM dws.dws_user_profile
WHERE user_id = {{user_id}}
LIMIT 1`,
    params: [{ name: 'user_id', type: 'string', required: true, example: 'U10086', desc: '用户 ID' }],
    responses: [
      { source: 'user_id', name: 'userId', type: 'string', nullable: false, transform: 'none', example: 'U10086', desc: '' },
      { source: 'gender', name: 'gender', type: 'string', nullable: true, transform: 'none', example: 'M', desc: '' },
      { source: 'city_level', name: 'cityLevel', type: 'string', nullable: true, transform: 'none', example: 'T1', desc: '' },
      { source: 'rfm_score', name: 'rfmScore', type: 'number', nullable: true, transform: 'to_number', example: '82', desc: '' },
    ],
  },
  {
    method: 'GET',
    path: '/api/user/tags',
    name: '用户标签批量取',
    desc: '营销域批量取标签·限流 500/q',
    metric: '-',
    asset: 'ads_user_tags',
    domain: '用户域',
    qps: '320',
    rt: '28ms',
    sub: '6',
    level: 'L1',
    levelCls: 'tag-green',
    auth: 'Token',
    owner: '王芳',
  },
  {
    method: 'GET',
    path: '/api/sku/stock',
    name: '商品库存查询',
    desc: '实时库存·读 CK',
    metric: '-',
    asset: 'dim_sku',
    domain: '商品域',
    qps: '2100',
    rt: '6ms',
    sub: '22',
    level: 'L1',
    levelCls: 'tag-green',
    auth: 'Token',
    owner: '李强',
  },
  {
    method: 'GET',
    path: '/api/order/list',
    name: '订单明细查询',
    desc: '分页查订单·行级过滤 tenant',
    metric: '-',
    asset: 'dwd_order_detail',
    domain: '交易域',
    qps: '480',
    rt: '120ms',
    sub: '9',
    level: 'L2',
    levelCls: 'tag-orange',
    auth: 'Token',
    owner: '张涛',
    responseShape: 'page',
    sql: `SELECT order_id, pay_amt, order_status, dt
FROM dwd_trade.dwd_order_detail
WHERE dt = {{dt}}
ORDER BY order_id
LIMIT {{limit}} OFFSET {{offset}}`,
    params: [
      { name: 'dt', type: 'date', required: true, example: '2026-09-16', desc: '分区日' },
      { name: 'offset', type: 'int', required: false, example: '0', desc: '偏移' },
      { name: 'limit', type: 'int', required: false, example: '50', desc: '页大小' },
    ],
    responses: [
      { source: 'order_id', name: 'orderId', type: 'string', nullable: false, transform: 'none', example: 'O20260916001', desc: '' },
      { source: 'pay_amt', name: 'payAmt', type: 'number', nullable: false, transform: 'cents_to_yuan', example: '19900', desc: '' },
      { source: 'order_status', name: 'orderStatus', type: 'string', nullable: false, transform: 'none', example: 'PAID', desc: '' },
      { source: 'dt', name: 'dt', type: 'date', nullable: false, transform: 'none', example: '2026-09-16', desc: '' },
    ],
  },
  {
    method: 'POST',
    path: '/api/metric/biz',
    name: '业务指标批量取',
    desc: '按指标 ID 批量返回·计量',
    metric: 'M-*',
    asset: '-',
    domain: '通用',
    qps: '1800',
    rt: '18ms',
    sub: '31',
    level: 'L1',
    levelCls: 'tag-green',
    auth: 'Token',
    owner: '指标平台',
  },
  {
    method: 'GET',
    path: '/api/reconcile/status',
    name: '对账状态查询',
    desc: '湖/CK 对账结果·运维用',
    metric: '-',
    asset: 'ads_gmv',
    domain: '运维',
    qps: '60',
    rt: '15ms',
    sub: '4',
    level: 'L3',
    levelCls: 'tag-gray',
    auth: 'Token',
    owner: '运维值班',
  },
]

function normalizeApi(a) {
  return {
    auth: 'Token',
    owner: '—',
    publishEnv: 'prod',
    srcType: a.metric && a.metric !== '-' ? '指标' : '表',
    responseFormat: 'wrapped',
    responseShape: 'list',
    breaker: '5xx>20% 熔断 30s',
    publishedAt: '2026-08-01 10:00:00',
    sql: a.sql || '',
    params: a.params || [],
    responses: a.responses || [],
    burst: a.burst || String(Math.round(Number(String(a.qps).replace(/[^\d.]/g, '')) * 2) || 200),
    ...a,
  }
}

export const API_LIST = API_SEED.map(normalizeApi)

export const SUB_LIST = [
  { app: '营销中台-前端', api: '/api/user/tags', user: '王芳', status: '待审', cls: 'tag-orange' },
  { app: 'BI 报表系统', api: '/api/gmv/trend', user: '刘强', status: '待审', cls: 'tag-orange' },
  { app: '风控引擎', api: '/api/user/profile', user: '陈晓', status: '已批准', cls: 'tag-green' },
  { app: '小程序 BFF', api: '/api/sku/stock', user: '张明', status: '待审', cls: 'tag-orange' },
  { app: '数据看板', api: '/api/reconcile/status', user: '李明', status: '已批准', cls: 'tag-green' },
  { app: '经营看板 BFF', api: '/api/gmv/daily', user: '张涛', status: '已批准', cls: 'tag-green' },
  { app: 'Superset', api: '/api/gmv/daily', user: '刘强', status: '已批准', cls: 'tag-green' },
  { app: '订单中心', api: '/api/order/list', user: '陈晓', status: '已批准', cls: 'tag-green' },
]

export function subscribersOf(apiPath) {
  return SUB_LIST.filter((s) => s.api === apiPath)
}

export const API_CALL_RANK = [
  { name: '/api/sku/stock · 商品库存', calls: '42.6万', pct: 100 },
  { name: '/api/metric/biz · 业务指标批量', calls: '36.2万', pct: 85 },
  { name: '/api/gmv/daily · 日GMV', calls: '24.1万', pct: 57 },
  { name: '/api/gmv/trend · GMV趋势', calls: '17.2万', pct: 40 },
  { name: '/api/user/profile · 用户画像', calls: '12.8万', pct: 30 },
  { name: '/api/user/tags · 用户标签', calls: '6.4万', pct: 15 },
  { name: '/api/order/list · 订单明细', calls: '9.6万', pct: 23 },
  { name: '/api/reconcile/status · 对账', calls: '1.2万', pct: 3 },
]

export const APISIX_ROUTES = [
  {
    path: '/api/gmv/*',
    upstream: 'SQLREST Executor → Trino',
    auth: 'JWT+OIDC',
    rate: '按空间 QPS',
    breaker: '✓',
    meter: '✓',
    status: 'degraded',
    note: '对账失败·SQLREST 走 Iceberg+Trino 降级',
  },
  {
    path: '/api/user/*',
    upstream: 'SQLREST Executor → Trino（动态脱敏）',
    auth: 'JWT+OIDC+列权限',
    rate: '按空间 QPS',
    breaker: '✓',
    meter: '✓',
    status: 'ok',
    note: 'PII 列经 Gravitino 脱敏',
  },
  {
    path: '/api/sku/*',
    upstream: 'SQLREST Executor → Trino（热表联邦 CK）',
    auth: 'JWT+OIDC',
    rate: '按空间 QPS',
    breaker: '✓',
    meter: '✓',
    status: 'ok',
    note: '人禁止直连 CK',
  },
  {
    path: '/api/metric/biz',
    upstream: 'SQLREST Executor → 指标 SQL',
    auth: 'JWT+OIDC',
    rate: '按空间 QPS',
    breaker: '✓',
    meter: '✓',
    status: 'ok',
    note: '按指标 ID 批量返回',
  },
  {
    path: '/api/query/adhoc',
    upstream: 'SQLREST Executor → Trino 即席',
    auth: 'JWT+OIDC+扫描限额',
    rate: '并发 5/人',
    breaker: '✓',
    meter: '✓',
    status: 'ok',
    note: '强制扫描限额·防全表扫',
  },
  {
    path: '/api/export/*',
    upstream: 'SQLREST Executor → MinIO 签名 URL',
    auth: 'JWT+OIDC+审批',
    rate: '1 次/分钟',
    breaker: '—',
    meter: '✓',
    status: 'ok',
    note: '导出需审批通过',
  },
]

const APISIX_STATUS = {
  ok: { tag: 'tag-green', label: '正常' },
  degraded: { tag: 'tag-orange', label: '降级中' },
  warn: { tag: 'tag-orange', label: '告警' },
  off: { tag: 'tag-gray', label: '停用' },
}

export function apisixStatusMeta(status) {
  return APISIX_STATUS[status] || APISIX_STATUS.ok
}

/** 匹配 API 所属 APISIX 路由前缀 */
export function routeOfApi(apiPath) {
  const exact = APISIX_ROUTES.find((r) => r.path === apiPath)
  if (exact) return exact
  return (
    APISIX_ROUTES.find((r) => {
      if (!r.path.includes('*')) return false
      const prefix = r.path.replace(/\*$/, '')
      return String(apiPath || '').startsWith(prefix)
    }) || null
  )
}
