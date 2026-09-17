/** 申请中心 · 对齐演示 HTML */

export const APPLY_KPIS = [
  {
    icon: '⏳',
    color: 'orange',
    label: '待我审批',
    value: '5',
    unit: '单',
    trend: '1 单机密需加签',
    trendUp: false,
    trendWarn: true,
  },
  {
    icon: '📝',
    color: 'blue',
    label: '我申请的',
    value: '12',
    unit: '单',
    trend: '↑ 2 处理中',
    trendUp: true,
  },
  {
    icon: '✅',
    color: 'green',
    label: '本月已通过',
    value: '48',
    unit: '单',
    trend: '↑ 平均耗时 4.2h',
    trendUp: true,
  },
  {
    icon: '❌',
    color: 'red',
    label: '本月驳回',
    value: '6',
    unit: '单',
    trend: '用途不规范为主',
    trendUp: false,
  },
]

export const APPLY_TABS = [
  { id: 'all', label: '📋 全部' },
  { id: 'perm', label: '🔐 权限申请' },
  { id: 'table', label: '📚 表申请' },
  { id: 'publish', label: '🚀 发布审批' },
  { id: 'api', label: '🔌 API申请' },
  { id: 'metric', label: '📊 指标申请' },
]

export const APPLY_TYPE_OPTIONS = [
  { value: 'perm', label: '🔐 数据权限申请' },
  { value: 'table', label: '📚 表申请' },
  { value: 'publish', label: '🚀 发布审批' },
  { value: 'api', label: '🔌 API 申请' },
  { value: 'metric', label: '📊 指标申请' },
]

export const APPLY_EXPIRE_OPTIONS = ['14天', '30天', '90天', '长期']

/** 数据权限申请 */
export const APPLY_PERM_MODES = [
  { value: 'read', label: '表只读', tip: '全表或指定列只读 · Owner 审批' },
  { value: 'column', label: '列级权限', tip: '仅开放指定列 · Owner 审批' },
  { value: 'plain', label: '敏感列明文', tip: '含 PII 明文 · Owner + 安全加签' },
]

export const APPLY_PERM_LEVELS = [
  { value: '内部', label: '内部', cls: 'tag-blue' },
  { value: '敏感', label: '敏感', cls: 'tag-orange' },
  { value: '机密', label: '机密', cls: 'tag-red' },
]

/** 表申请 */
export const APPLY_TABLE_KINDS = [
  { value: 'read', label: '表只读', tip: '对已有表申请查询权限' },
  { value: 'register', label: '登记上架', tip: '新表登记进资产目录 / Gravitino' },
  { value: 'alter', label: '结构变更', tip: '加列、改分区等元数据变更' },
]

/** 发布审批 */
export const APPLY_PUBLISH_ENVS = [
  { value: 'stg', label: 'stg（预发）' },
  { value: 'prod', label: 'prod（生产）' },
]

export function buildApplyAssetOptions(assets = []) {
  return assets.map((a) => ({
    value: a.key,
    label: `${a.key} · ${a.name}`,
    sub: `${a.layerLabel || a.layer} · ${a.level || '内部'} · Owner ${a.owner || '—'}`,
    name: a.name,
    level: a.level || '内部',
    owner: a.owner,
    domain: a.domainLabel || a.domain,
    layer: a.layerLabel || a.layer,
  }))
}

export function buildApplyReleaseOptions(history = []) {
  return history.map((h) => ({
    value: h.pkg,
    label: `${h.pkg} · ${h.tag}`,
    sub: `最近 ${h.env} · ${h.result} · ${h.time}`,
    tag: h.tag,
    env: h.env,
    result: h.result,
  }))
}

export function permModeLabel(mode) {
  return APPLY_PERM_MODES.find((m) => m.value === mode)?.label || mode || '权限'
}

export function tableKindLabel(kind) {
  return APPLY_TABLE_KINDS.find((k) => k.value === kind)?.label || kind || '表申请'
}

/** 指标申请子类型 */
export const APPLY_METRIC_KINDS = [
  { value: 'query', label: '查询权限', tip: '看板 / 即席 / API 引用已启用指标' },
  { value: 'change', label: '口径变更', tip: '提交新版本口径，经指标委员会评审' },
  { value: 'create', label: '新建指标', tip: '申请立项新建原子/衍生/复合指标' },
]

export const APPLY_METRIC_SCOPES = [
  { value: 'dashboard', label: '看板引用' },
  { value: 'adhoc', label: '即席查询' },
  { value: 'api', label: 'API / 数据服务' },
  { value: 'export', label: '出湖 / 导出' },
]

export const APPLY_METRIC_DOMAINS = ['交易域', '用户域', '商品域', '营销域', '通用']

export const APPLY_METRIC_TYPES = [
  { value: '原子', label: '原子' },
  { value: '衍生', label: '衍生' },
  { value: '复合', label: '复合' },
]

/** API 申请可选接口（来自已发布清单） */
export const APPLY_API_OPTIONS = [
  { value: '/api/gmv/daily', label: '/api/gmv/daily · 日 GMV' },
  { value: '/api/gmv/trend', label: '/api/gmv/trend · GMV 趋势' },
  { value: '/api/user/profile', label: '/api/user/profile · 用户画像' },
  { value: '/api/user/tags', label: '/api/user/tags · 用户标签' },
  { value: '/api/sku/stock', label: '/api/sku/stock · 商品库存' },
  { value: '/api/order/list', label: '/api/order/list · 订单明细' },
  { value: '/api/order/summary', label: '/api/order/summary · 订单汇总' },
  { value: '/api/metric/biz', label: '/api/metric/biz · 业务指标批量' },
]

/** 从指标目录生成申请可选列表 */
export function buildApplyMetricOptions(catalog = []) {
  return catalog
    .filter((m) => m.status === 'active' || m.status === 'version_review')
    .map((m) => ({
      value: m.id,
      label: `${m.id} · ${m.name}`,
      sub: `${m.type || m.kind || ''} · ${m.statusLabel || m.status} · ${m.owner || ''}`,
      name: m.name,
      type: m.type || m.kind,
      caliber: m.caliber,
      domain: m.domainLabel || m.domain,
      owner: m.owner,
      ver: m.ver,
    }))
}

export function metricKindLabel(kind) {
  return APPLY_METRIC_KINDS.find((k) => k.value === kind)?.label || kind || '指标申请'
}

/** 签发 API 调用令牌（演示） */
export function issueApiCallToken({ apiPath, app, expire = '30天', qps = 100 } = {}) {
  const rand = Math.random().toString(36).slice(2, 10)
  const raw = `dlh_${Date.now().toString(36)}_${rand}`
  return {
    token: raw,
    tokenMasked: `${raw.slice(0, 8)}••••••••${raw.slice(-4)}`,
    apiPath: apiPath || '/api/*',
    app: app || '未命名应用',
    expire,
    qps: Number(qps) || 100,
    issuedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    header: 'Authorization: Bearer <token>',
    curl: `curl -H "Authorization: Bearer ${raw}" "https://api.lakehouse.local${apiPath || '/api/gmv/daily'}?dt=2026-09-16"`,
  }
}

export function parseApiPathFromTicket(ticket) {
  const fromField = ticket?.apiPath
  if (fromField) return fromField
  const m = String(ticket?.titleHtml || ticket?.desc || '').match(/\/api\/[\w./-]+/)
  return m ? m[0] : '/api/gmv/daily'
}

/** 待审批工单 */
export const APPLY_PENDING = [
  {
    id: 'WF20260903-00142',
    type: 'perm',
    side: 'pending',
    titleHtml:
      '<span class="tag tag-red">机密</span> 王芳 申请 dwd_user_info 表手机号列 <b>明文</b> 权限',
    statusTag: '待安全加签',
    statusCls: 'tag-orange',
    desc: '用途：客户流失预测模型训练 · 范围：5 列含敏感 · 时效：90天 · 已通过 Owner 李明审批',
    asset: 'dwd_user.dwd_user_info',
    permMode: 'plain',
    permLevel: '机密',
    columns: 'user_id,mobile,gender,city,last_login_dt',
    expire: '90天',
    purpose: '客户流失预测模型训练',
    applicant: '王芳',
    assetOwner: '李明',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '✓ Owner 李明', cls: 'done' },
      { label: '● 安全岗加签', cls: 'current' },
      { label: '写入 Gravitino', cls: '' },
    ],
  },
  {
    id: 'WF20260903-00138',
    type: 'perm',
    side: 'pending',
    titleHtml:
      '<span class="tag tag-orange">敏感</span> 周强 申请 dws_trade.dws_order_1d 只读权限',
    statusTag: '待 Owner 审批',
    statusCls: 'tag-orange',
    desc: '用途：月度经营分析报表 · 范围：全列只读 · 时效：30天',
    asset: 'dws_trade.dws_order_1d',
    permMode: 'read',
    permLevel: '敏感',
    columns: '',
    expire: '30天',
    purpose: '月度经营分析报表',
    applicant: '周强',
    assetOwner: '你',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● Owner 你', cls: 'current' },
      { label: '写入 Gravitino', cls: '' },
    ],
  },
  {
    id: 'WF20260903-00135',
    type: 'perm',
    side: 'pending',
    titleHtml:
      '<span class="tag tag-blue">内部</span> 陈晓 申请 ads.ads_gmv_board 表查询权限',
    statusTag: '待 Owner 审批',
    statusCls: 'tag-orange',
    desc: '用途：运营活动效果分析 · 范围：不含 user_id 列 · 时效：14天',
    asset: 'ads.ads_gmv_board',
    permMode: 'column',
    permLevel: '内部',
    columns: 'dt,channel,total_gmv,order_cnt',
    expire: '14天',
    purpose: '运营活动效果分析',
    applicant: '陈晓',
    assetOwner: '你',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● Owner 你', cls: 'current' },
      { label: '写入 Gravitino', cls: '' },
    ],
  },
  {
    id: 'WF20260903-00130',
    type: 'export',
    side: 'pending',
    titleHtml: '<span class="tag tag-purple">出湖</span> 营销系统 申请 ADS 用户标签回流 MySQL',
    statusTag: '待安全+平台',
    statusCls: 'tag-orange',
    desc: '链路 J：从 ads_user_tags 出湖 → 目标库 marketing_prod.t_user_tags · 每日 02:00 DS 作业 · 静态脱敏 + 审计',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 平台+安全联审', cls: 'current' },
      { label: '作业上线', cls: '' },
    ],
  },
  {
    id: 'WF20260903-00127',
    type: 'compliance',
    side: 'pending',
    titleHtml:
      '<span class="tag tag-red">合规</span> 链路 K：被遗忘权删除工单（主体 UID-8827341）',
    statusTag: '待执行',
    statusCls: 'tag-orange',
    desc: '法律依据 GDPR · 血缘展开 8 张表 + 2 个 CK 表 + 1 个回流副本 · 已由法务确认 · 截止 09-05',
    timeline: [
      { label: '✓ 法务确认', cls: 'done' },
      { label: '● 平台执行', cls: 'current' },
      { label: 'Iceberg equality delete + CK ALTER DELETE', cls: '' },
    ],
  },
  {
    id: 'WF20260902-00120',
    type: 'table',
    side: 'pending',
    titleHtml: '<span class="tag tag-blue">表</span> 刘洋 申请 ods_trade.s_order 只读',
    statusTag: '待 Owner 审批',
    statusCls: 'tag-orange',
    desc: '用途：ODS 对账抽样 · 字段 order_id,pay_amt,dt · 时效 30天',
    asset: 'ods_trade.s_order',
    tableKind: 'read',
    columns: 'order_id,pay_amt,dt',
    expire: '30天',
    purpose: 'ODS 对账抽样',
    applicant: '刘洋',
    assetOwner: '你',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● Owner 你', cls: 'current' },
      { label: '写入 Gravitino', cls: '' },
    ],
  },
  {
    id: 'WF20260902-00118',
    type: 'publish',
    side: 'pending',
    titleHtml: '<span class="tag tag-purple">发布</span> release-trade-v1.4 → prod',
    statusTag: '门禁检查中',
    statusCls: 'tag-orange',
    desc: '发布包 v1.4 · 含 dwd_order_detail 修复 · 回滚预案已填 · 目标 prod',
    releasePkg: 'v23-dwd-order-clean',
    releaseTag: 'v23.0',
    publishEnv: 'prod',
    rollbackPlan: '回滚至 v22 tag · DS 作业切回上一版本',
    purpose: 'dwd_order_detail 修复上线',
    applicant: '平台发布',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 门禁检查', cls: 'current' },
      { label: '上线 prod', cls: '' },
    ],
  },
  {
    id: 'WF20260901-00110',
    type: 'api',
    side: 'pending',
    titleHtml: '<span class="tag tag-green">API</span> 合作伙伴申请 /api/gmv/daily 调用权限',
    statusTag: '待 API Owner',
    statusCls: 'tag-orange',
    desc: '应用：合作伙伴日报 · 来源指标 M-0001 · Token 鉴权 · 申请方 200 QPS · 时效 30天',
    apiPath: '/api/gmv/daily',
    app: '合作伙伴日报',
    qps: 200,
    expire: '30天',
    applicant: '外部对接-李华',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● API Owner', cls: 'current' },
      { label: '签发令牌', cls: '' },
      { label: 'APISIX 生效', cls: '' },
    ],
  },
  {
    id: 'WF20260830-00105',
    type: 'metric',
    side: 'pending',
    titleHtml: '<span class="tag tag-blue">指标</span> 申请 M-0042 复购率 · 查询权限',
    statusTag: '待指标 Owner',
    statusCls: 'tag-orange',
    desc: '场景：看板引用 · 业务域：用户 · 用途：周报看板 · 时效 90天',
    metricId: 'M-0042',
    metricName: '复购率',
    metricKind: 'query',
    metricScope: 'dashboard',
    metricDomain: '用户域',
    expire: '90天',
    purpose: '周报看板引用复购率',
    applicant: '产品-周敏',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 指标 Owner', cls: 'current' },
      { label: '写入 Gravitino', cls: '' },
    ],
  },
  {
    id: 'WF20260910-00128',
    type: 'metric',
    side: 'pending',
    titleHtml: '<span class="tag tag-purple">口径</span> M-0001 日GMV · 口径变更 v3 → v4',
    statusTag: '待指标委员会',
    statusCls: 'tag-orange',
    desc: '调整：剔除跨境订单 · 影响下游 18 张报表',
    metricId: 'M-0001',
    metricName: '日GMV',
    metricKind: 'change',
    metricFromVer: 'v3',
    metricToVer: 'v4',
    caliberDiff: '剔除跨境订单（order_channel ≠ CrossBorder）',
    purpose: '口径与财务对账一致',
    applicant: '指标-李明',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 指标委员会', cls: 'current' },
      { label: '版本发布', cls: '' },
      { label: '通知下游', cls: '' },
    ],
  },
]

/** 我的申请 */
export const APPLY_MINE = [
  {
    type: 'perm',
    side: 'approved',
    titleHtml: '<span class="tag tag-green">已通过</span> 我申请 dim.dim_sku 只读权限',
    time: '09-01 15:42',
    desc: '用途：商品分析 · 时效到 2026-12-01 · Owner 赵静审批耗时 48 分钟',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '✓ Owner 审批', cls: 'done' },
      { label: '✓ Gravitino 已授权', cls: 'done' },
    ],
  },
  {
    type: 'export',
    side: 'pending',
    titleHtml: '<span class="tag tag-orange">处理中</span> 我申请 ads_gmv_board 导出 CSV 脱敏集',
    time: '09-02 10:18',
    desc: '用途：季度经营分析会 PPT 素材 · 范围：近30天聚合数据 · 大小预估 < 5MB',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● Owner 李明审批中', cls: 'current' },
    ],
  },
  {
    type: 'perm',
    side: 'rejected',
    titleHtml: '<span class="tag tag-red">已驳回</span> 我申请 dwd_user_info 全列明文权限',
    time: '08-28 09:11',
    desc: '驳回原因：申请范围过宽，请明确列明必要字段并补充合规说明（用途"随便看看"不规范）',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '✗ 安全岗驳回', cls: 'rejected' },
    ],
  },
  {
    type: 'metric',
    side: 'approved',
    id: 'WF20260825-00076',
    titleHtml: '<span class="tag tag-green">已通过</span> 指标口径变更：M-0001 日GMV 口径 v2 → v3',
    time: '08-25 14:32',
    desc: '口径调整：优惠券抵扣从「按原价分摊」改为「订单实付级直接抵扣」· 已通知下游 24 张报表 owner',
    metricId: 'M-0001',
    metricName: '日GMV',
    metricKind: 'change',
    metricFromVer: 'v2',
    metricToVer: 'v3',
    caliberDiff: '优惠券抵扣从「按原价分摊」改为「订单实付级直接抵扣」',
    purpose: '口径与财务对账一致',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '✓ 指标委员会评审', cls: 'done' },
      { label: '✓ 版本发布 v3', cls: 'done' },
    ],
  },
  {
    type: 'metric',
    side: 'approved',
    id: 'WF20260818-00061',
    titleHtml: '<span class="tag tag-green">已通过</span> 我申请 M-0001 日GMV · 查询权限',
    time: '08-18 11:05',
    desc: '场景：API / 数据服务 · 时效 30天 · 已写入 Gravitino 指标 ACL',
    metricId: 'M-0001',
    metricName: '日GMV',
    metricKind: 'query',
    metricScope: 'api',
    expire: '30天',
    purpose: '经营看板 BFF 聚合',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '✓ 指标 Owner', cls: 'done' },
      { label: '✓ Gravitino 已授权', cls: 'done' },
    ],
  },
  {
    type: 'table',
    side: 'approved',
    titleHtml: '<span class="tag tag-green">已通过</span> 我申请 dwd_trade.dwd_order_detail 只读',
    time: '08-20 11:05',
    desc: '用途：即席分析 · 时效 30天 · Owner 已通过',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '✓ Gravitino 已授权', cls: 'done' },
    ],
  },
  {
    type: 'publish',
    side: 'pending',
    titleHtml: '<span class="tag tag-orange">处理中</span> 我申请 release-analytics-v2.1 → stg',
    time: '09-03 08:30',
    desc: '门禁：质量分 ≥ 90 · 含 3 个 SQL 变更',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 平台 Owner 审批', cls: 'current' },
    ],
  },
  {
    type: 'api',
    side: 'approved',
    id: 'WF20260815-00088',
    titleHtml: '<span class="tag tag-green">已通过</span> 我申请 /api/order/summary 读权限',
    time: '08-15 16:20',
    desc: 'Token 已签发 · 申请方 100 QPS · 时效 30天',
    apiPath: '/api/order/summary',
    app: '经营看板 BFF',
    qps: 100,
    expire: '30天',
    tokenMasked: 'dlh_m8k2••••••••x9f1',
    token: 'dlh_m8k2abcd1234x9f1',
    tokenIssued: true,
    tokenIssuedAt: '2026-08-15 16:20:08',
    purpose: '经营看板 BFF 聚合查询',
    header: 'Authorization: Bearer <token>',
    curl: 'curl -H "Authorization: Bearer dlh_m8k2abcd1234x9f1" "https://api.lakehouse.local/api/order/summary"',
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '✓ API Owner', cls: 'done' },
      { label: '✓ 令牌已签发', cls: 'done' },
      { label: '✓ APISIX 已生效', cls: 'done' },
    ],
  },
]

export function applyTabMatches(cardType, tabId) {
  if (tabId === 'all') return true
  return cardType === tabId
}
