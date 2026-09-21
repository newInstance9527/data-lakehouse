/** 指标中心 · 口径与目录 · 生命周期状态机 */

import { SCHEMA_COLS } from '@/data/assets'

/** 表单选项默认读此提供者（useMetrics 接入后指向远端目录） */
let metricCatalogProvider = null

export function setMetricCatalogProvider(fn) {
  metricCatalogProvider = typeof fn === 'function' ? fn : null
}

export function getMetricCatalogForForms() {
  const live = metricCatalogProvider?.()
  if (Array.isArray(live) && live.length) return live
  return METRIC_CATALOG
}

export const METRIC_KPIS = [
  {
    icon: '📊',
    color: 'blue',
    value: '342',
    unit: '个',
    label: '总指标数',
    trend: '28 本月新增',
    trendUp: true,
  },
  {
    icon: '⚛️',
    color: 'green',
    value: '86',
    unit: '个',
    label: '原子指标',
    trend: '',
    trendUp: true,
  },
  {
    icon: '🎯',
    color: 'purple',
    value: '198',
    unit: '个',
    label: '衍生指标',
    trend: '23 新业务口径',
    trendUp: true,
  },
  {
    icon: '🧩',
    color: 'cyan',
    value: '58',
    unit: '个',
    label: '复合指标',
    trend: '比率 / AOV 等',
    trendUp: true,
  },
  {
    icon: '✅',
    color: 'green',
    value: '0',
    unit: '个',
    label: '已启用',
    trend: '可被报表 / API 引用',
    trendUp: true,
  },
]

/**
 * 状态机：
 * 草稿 → 评审中 → 已启用 →（变更）新版本评审 → 已启用
 * 已启用 → 已废弃
 */
export const METRIC_STATUS = {
  draft: { key: 'draft', label: '草稿', cls: 'tag-gray' },
  review: { key: 'review', label: '评审中', cls: 'tag-orange' },
  active: { key: 'active', label: '已启用', cls: 'tag-green' },
  version_review: { key: 'version_review', label: '新版本评审', cls: 'tag-blue' },
  deprecated: { key: 'deprecated', label: '已废弃', cls: 'tag-red' },
}

export const METRIC_STATUS_TABS = [
  { id: 'all', label: '全部状态' },
  { id: 'draft', label: '草稿' },
  { id: 'review', label: '评审中' },
  { id: 'active', label: '已启用' },
  { id: 'version_review', label: '新版本评审' },
  { id: 'deprecated', label: '已废弃' },
]

export const METRIC_LIFECYCLE_STAGES = [
  { id: 'draft', label: '草稿' },
  { id: 'review', label: '评审中' },
  { id: 'active', label: '已启用' },
  { id: 'version_review', label: '新版本评审' },
  { id: 'deprecated', label: '已废弃' },
]

export function metricStatusMeta(key) {
  return METRIC_STATUS[key] || METRIC_STATUS.draft
}

/** 当前状态允许的操作 */
export function metricActions(status) {
  return (
    {
      draft: ['edit', 'submit', 'detail'],
      review: ['approve', 'reject', 'detail'],
      active: ['applyQuery', 'applyChange', 'change', 'deprecate', 'detail'],
      version_review: ['approveVersion', 'cancelChange', 'detail'],
      deprecated: ['detail'],
    }[status] || ['detail']
  )
}

export const METRIC_DOMAIN_TABS = [
  { id: 'all', label: '全部域' },
  { id: 'trade', label: '交易域' },
  { id: 'user', label: '用户域' },
  { id: 'goods', label: '商品域' },
]

function withStatus(row, status, extras = {}) {
  const st = metricStatusMeta(status)
  return {
    ...row,
    status,
    statusLabel: st.label,
    statusCls: st.cls,
    rowWarn: status === 'review' || status === 'version_review' || row.rowWarn,
    history: extras.history || row.history || [
      { status, label: st.label, time: extras.time || '—', note: extras.note || '' },
    ],
    pendingCaliber: extras.pendingCaliber || row.pendingCaliber || '',
    ...extras,
  }
}

export const METRIC_CATALOG = [
  withStatus(
    {
      id: 'M-0001',
      name: '日GMV',
      type: '衍生',
      typeCls: 'tag-purple',
      domain: 'trade',
      caliber: '订单支付成功金额合计，不含退款',
      bind: '原子·支付金额',
      formula: '',
      qualifier: '无限定',
      qualifierKeys: [],
      dim: 'dt',
      dimKeys: ['dt'],
      time: '近1天',
      unit: '元',
      latest: '¥3,284.6万',
      vol: '↓ 12.4%',
      volCls: 'down',
      owner: '李明',
      ver: 'v3',
      kind: '衍生',
    },
    'active',
    {
      history: [
        { status: 'draft', label: '草稿', time: '2026-07-01', note: '初建' },
        { status: 'review', label: '评审中', time: '2026-07-02', note: '口径评审' },
        { status: 'active', label: '已启用', time: '2026-07-05', note: 'v1 发布' },
        { status: 'version_review', label: '新版本评审', time: '2026-08-20', note: '剔除退款' },
        { status: 'active', label: '已启用', time: '2026-08-22', note: 'v3 启用' },
      ],
    },
  ),
  withStatus(
    {
      id: 'A-0012',
      name: '支付成功订单数',
      type: '原子',
      typeCls: 'tag-blue',
      domain: 'trade',
      caliber: 'pay_status=SUCCESS 去重计数',
      bind: 'dwd_order_detail.order_id',
      table: 'dwd_trade.dwd_order_detail',
      field: 'order_id',
      agg: 'COUNT DISTINCT',
      unit: '个',
      latest: '182,473 单',
      vol: '↑ 4.8%',
      volCls: 'up',
      owner: '李明',
      ver: 'v1',
      kind: '原子',
    },
    'active',
  ),
  withStatus(
    {
      id: 'M-0024',
      name: '支付转化率',
      type: '复合',
      typeCls: 'tag-cyan',
      domain: 'trade',
      caliber: '下单支付成功用户 / 浏览商品用户',
      bind: 'A-0012 / A-0201',
      formula: 'A-0012 / A-0201',
      dim: '',
      dimKeys: [],
      time: '',
      unit: '%',
      latest: '3.82%',
      vol: '↑ 0.3pp',
      volCls: 'up',
      owner: '周健',
      ver: 'v2',
      kind: '复合',
    },
    'active',
  ),
  withStatus(
    {
      id: 'C-0035',
      name: '客单价 AOV',
      type: '复合',
      typeCls: 'tag-cyan',
      domain: 'trade',
      caliber: '客单价 = 日GMV / 支付成功订单数',
      bind: 'M-0001 / A-0012',
      formula: 'M-0001 / A-0012',
      dim: '',
      dimKeys: [],
      time: '',
      unit: '元/单',
      latest: '¥ 179.9',
      vol: '↓ 3.1%',
      volCls: 'down',
      owner: '李明',
      ver: 'v1',
      kind: '复合',
    },
    'active',
  ),
  withStatus(
    {
      id: 'M-0102',
      name: '7日活跃用户',
      type: '衍生',
      typeCls: 'tag-purple',
      domain: 'user',
      caliber: '近7天有行为事件用户去重',
      bind: 'A-0201',
      atomRef: 'A-0201',
      formula: '',
      qualifier: '无限定',
      qualifierKeys: [],
      dim: 'dt',
      dimKeys: ['dt'],
      time: '近7天',
      unit: '人',
      latest: '428,193',
      vol: '↑ 2.2%',
      volCls: 'up',
      owner: '王欢',
      ver: 'v2',
      kind: '衍生',
    },
    'version_review',
    {
      pendingCaliber: '近7天有行为事件用户去重 · 排除爬虫 UA',
      history: [
        { status: 'active', label: '已启用', time: '2026-08-01', note: 'v2' },
        { status: 'version_review', label: '新版本评审', time: '2026-09-10', note: '排除爬虫' },
      ],
    },
  ),
  withStatus(
    {
      id: 'M-0178',
      name: '退货率',
      type: '衍生',
      typeCls: 'tag-purple',
      domain: 'trade',
      caliber: '⚠️ 口径争议：财务 vs 运营不一致',
      bind: '待确认',
      formula: '',
      qualifier: '无限定',
      dim: 'dt',
      dimKeys: ['dt'],
      time: '近1天',
      unit: '%',
      latest: '2.34%',
      vol: '待对齐',
      volCls: 'warn',
      owner: '孙悦',
      ver: 'v1',
      kind: '衍生',
      rowWarn: true,
    },
    'review',
  ),
  withStatus(
    {
      id: 'A-0201',
      name: '浏览商品 UV',
      type: '原子',
      typeCls: 'tag-blue',
      domain: 'trade',
      caliber: '商品详情页曝光 UV',
      bind: 'dwd_log_action.user_id',
      table: 'dwd_log.dwd_log_action',
      field: 'user_id',
      agg: 'COUNT DISTINCT',
      unit: '人',
      latest: '待计算',
      vol: '—',
      volCls: 'warn',
      owner: '周健',
      ver: 'v1',
      kind: '原子',
    },
    'draft',
  ),
  withStatus(
    {
      id: 'M-0090',
      name: '旧版 GMV（含退款）',
      type: '衍生',
      typeCls: 'tag-purple',
      domain: 'trade',
      caliber: '已废弃 · 被 M-0001 替代',
      bind: 'ads_gmv_board.gmv_raw',
      unit: '元',
      latest: '—',
      vol: '—',
      volCls: 'warn',
      owner: '李明',
      ver: 'v2',
      kind: '衍生',
    },
    'deprecated',
    {
      history: [
        { status: 'active', label: '已启用', time: '2025-12-01', note: 'v2' },
        { status: 'deprecated', label: '已废弃', time: '2026-08-22', note: '迁移至 M-0001' },
      ],
    },
  ),
]

const DOMAIN_MAP = {
  交易: 'trade',
  用户: 'user',
  商品: 'goods',
  流量: 'user',
  财务: 'trade',
}

export function metricDomainKey(label) {
  return DOMAIN_MAP[label] || 'trade'
}

/** 供表单下拉：已启用的原子指标 */
export function metricAtomOptions(list = getMetricCatalogForForms()) {
  return list
    .filter((r) => (r.type === '原子' || r.kind === '原子') && r.status !== 'deprecated')
    .map((r) => ({
      value: r.id,
      label: `${r.id} · ${r.name}`,
      sub: `${r.statusLabel || r.status} · ${r.caliber}`,
      name: r.name,
      caliber: r.caliber,
    }))
}

/** 供表单多选：衍生 + 原子（排除废弃） */
export function metricDeriveAtomOptions(list = getMetricCatalogForForms()) {
  return list
    .filter(
      (r) =>
        (r.type === '衍生' || r.type === '原子' || r.kind === '衍生' || r.kind === '原子') &&
        r.status !== 'deprecated',
    )
    .map((r) => ({
      value: r.id,
      label: `${r.id} · ${r.name}`,
      sub: `${r.type || r.kind} · ${r.statusLabel || r.status} · ${r.caliber}`,
      name: r.name,
      type: r.type || r.kind,
      caliber: r.caliber,
    }))
}

export function refsToArray(val) {
  if (Array.isArray(val)) return val.map(String).filter(Boolean)
  if (val == null || val === '') return []
  return String(val)
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function refsToString(val) {
  return refsToArray(val).join(',')
}

/** 表 → 字段清单（供衍生统计粒度从原子绑定表派生） */
const METRIC_TABLE_FIELDS = {
  'dwd_trade.dwd_order_detail': SCHEMA_COLS,
  dwd_order_detail: SCHEMA_COLS,
  'ods_trade.s_order': SCHEMA_COLS,
  'dws_trade.dws_order_1d': [
    { name: 'dt', type: 'DATE', desc: '统计日' },
    { name: 'user_id', type: 'BIGINT', desc: '用户' },
    { name: 'order_cnt', type: 'BIGINT', desc: '订单数' },
    { name: 'pay_amt', type: 'DECIMAL', desc: '支付金额' },
  ],
  'ads.ads_gmv_board': [
    { name: 'dt', type: 'DATE', desc: '统计日' },
    { name: 'channel', type: 'VARCHAR', desc: '渠道' },
    { name: 'total_gmv', type: 'DECIMAL', desc: 'GMV' },
    { name: 'order_cnt', type: 'BIGINT', desc: '订单数' },
  ],
  ads_gmv_board: [
    { name: 'dt', type: 'DATE', desc: '统计日' },
    { name: 'channel', type: 'VARCHAR', desc: '渠道' },
    { name: 'total_gmv', type: 'DECIMAL', desc: 'GMV' },
    { name: 'order_cnt', type: 'BIGINT', desc: '订单数' },
  ],
  'dws_user.dws_user_profile_1d': [
    { name: 'dt', type: 'DATE', desc: '统计日' },
    { name: 'user_id', type: 'BIGINT', desc: '用户' },
    { name: 'register_time', type: 'DATETIME', desc: '注册时间' },
  ],
  'dwd_user.dwd_user_info': [
    { name: 'user_id', type: 'BIGINT', desc: '用户' },
    { name: 'gender', type: 'VARCHAR', desc: '性别' },
    { name: 'register_time', type: 'DATETIME', desc: '注册时间' },
    { name: 'dt', type: 'DATE', desc: '统计日' },
  ],
  'dim.dim_sku': [
    { name: 'sku_id', type: 'BIGINT', desc: 'SKU' },
    { name: 'sku_name', type: 'VARCHAR', desc: '商品名' },
    { name: 'category_id', type: 'INT', desc: '类目' },
    { name: 'dt', type: 'DATE', desc: '统计日' },
  ],
  'ads.ads_user_tags': [
    { name: 'user_id', type: 'BIGINT', desc: '用户' },
    { name: 'tag_code', type: 'VARCHAR', desc: '标签码' },
    { name: 'tag_value', type: 'VARCHAR', desc: '标签值' },
    { name: 'dt', type: 'DATE', desc: '统计日' },
  ],
  'dwd_log.dwd_log_action': [
    { name: 'dt', type: 'DATE', desc: '统计日' },
    { name: 'user_id', type: 'BIGINT', desc: '用户' },
    { name: 'sku_id', type: 'BIGINT', desc: '商品' },
    { name: 'channel', type: 'VARCHAR', desc: '渠道' },
    { name: 'platform', type: 'VARCHAR', desc: '终端' },
    { name: 'event_type', type: 'VARCHAR', desc: '事件类型' },
    { name: 'page_id', type: 'VARCHAR', desc: '页面' },
  ],
  dwd_log_action: [
    { name: 'dt', type: 'DATE', desc: '统计日' },
    { name: 'user_id', type: 'BIGINT', desc: '用户' },
    { name: 'sku_id', type: 'BIGINT', desc: '商品' },
    { name: 'channel', type: 'VARCHAR', desc: '渠道' },
    { name: 'platform', type: 'VARCHAR', desc: '终端' },
    { name: 'event_type', type: 'VARCHAR', desc: '事件类型' },
  ],
}

const TABLE_KEY_ALIASES = {
  dwd_order_detail: 'dwd_trade.dwd_order_detail',
  ads_gmv_board: 'ads.ads_gmv_board',
  dim_sku: 'dim.dim_sku',
  dwd_user_info: 'dwd_user.dwd_user_info',
  dws_user_profile_1d: 'dws_user.dws_user_profile_1d',
  ads_user_tags: 'ads.ads_user_tags',
  dwd_log_action: 'dwd_log.dwd_log_action',
}

const MEASURE_NAME_RE = /(_amt|_amount|_cnt|_count|_gmv|_qty|_price|_score|_num)$/i
const TECH_NAME_RE = /^(gmt_|__)/i
const PII_NAME_RE = /(mobile|phone|real_name|id_card|password|email)/i
const TIME_NAME_RE = /^(dt|stat_date|biz_date)$/i

function isDimCandidateField(col) {
  const name = col?.name || col?.value || ''
  if (!name) return false
  if (TECH_NAME_RE.test(name) || PII_NAME_RE.test(name)) return false
  if (MEASURE_NAME_RE.test(name)) return false
  // 事实主键过细，不作汇总粒度
  if (/^(order_id|parent_order_id)$/i.test(name)) return false
  // 原始时间戳一般不作粒度；统计日 dt 可以
  if (/_time$|time$/i.test(name) && !TIME_NAME_RE.test(name)) return false
  return true
}

function dimGroupOf(name) {
  if (TIME_NAME_RE.test(name)) return '时间'
  if (/channel|platform|terminal|app/i.test(name)) return '渠道'
  if (/province|city|region|district|country/i.test(name)) return '地域'
  if (/sku|spu|category|shop|seller|goods|item/i.test(name)) return '商品'
  if (/user|buyer|member|uid/i.test(name)) return '用户'
  if (/status|type|method|gender|tag_/i.test(name)) return '枚举'
  return '属性'
}

/** 从字段列表生成统计粒度选项 */
export function dimOptionsFromFields(fields = []) {
  return fields.filter(isDimCandidateField).map((col) => {
    const name = col.name || col.value
    const group = dimGroupOf(name)
    const desc = col.desc || ''
    return {
      value: name,
      label: `${name}${desc ? ` · ${desc}` : ''}`,
      sub: `${group} · ${col.type || '字段'} · GROUP BY`,
      name,
      group,
      type: col.type || '',
    }
  })
}

export function resolveMetricTableKey(row) {
  if (!row) return ''
  if (row.table && (METRIC_TABLE_FIELDS[row.table] || TABLE_KEY_ALIASES[row.table])) {
    return TABLE_KEY_ALIASES[row.table] || row.table
  }
  const bind = String(row.bind || '')
  if (!bind) return ''
  const parts = bind.split('.')
  if (parts.length < 2) return TABLE_KEY_ALIASES[bind] || bind
  // table.field 或 schema.table.field
  const tablePart = parts.length === 2 ? parts[0] : parts.slice(0, -1).join('.')
  if (METRIC_TABLE_FIELDS[tablePart]) return tablePart
  if (TABLE_KEY_ALIASES[tablePart]) return TABLE_KEY_ALIASES[tablePart]
  const hit = Object.keys(METRIC_TABLE_FIELDS).find(
    (k) => k === tablePart || k.endsWith('.' + tablePart) || k.endsWith(tablePart),
  )
  return hit || tablePart
}

export function dimOptionsFromTable(tableKey) {
  const key = TABLE_KEY_ALIASES[tableKey] || tableKey
  const fields = METRIC_TABLE_FIELDS[key] || METRIC_TABLE_FIELDS[tableKey] || []
  return dimOptionsFromFields(fields)
}

/** 衍生：依赖原子指标 → 其绑定表可作统计粒度的字段 */
export function metricDimOptionsForAtom(atomId, list = getMetricCatalogForForms()) {
  const row = list.find((r) => r.id === atomId && (r.type === '原子' || r.kind === '原子'))
    || list.find((r) => r.id === atomId)
  if (!row) return []
  return dimOptionsFromTable(resolveMetricTableKey(row))
}

/** 表字段常见业务限定预设（非时间 WHERE） */
const QUALIFIER_PRESETS_BY_TABLE = {
  'dwd_trade.dwd_order_detail': [
    { value: 'pay_status=SUCCESS', label: 'pay_status=SUCCESS · 支付成功', sub: '业务限定', name: 'pay_status', group: '交易' },
    { value: 'order_channel=App', label: 'order_channel=App · App 渠道', sub: '业务限定', name: 'order_channel', group: '渠道' },
    { value: 'order_channel=H5', label: 'order_channel=H5 · H5 渠道', sub: '业务限定', name: 'order_channel', group: '渠道' },
    { value: 'pay_type=1', label: 'pay_type=1 · 微信', sub: '业务限定', name: 'pay_type', group: '支付' },
    { value: 'order_status=3', label: 'order_status=3 · 支付成功态', sub: '业务限定', name: 'order_status', group: '交易' },
  ],
  'ads.ads_gmv_board': [
    { value: 'channel=App', label: 'channel=App · App', sub: '业务限定', name: 'channel', group: '渠道' },
    { value: 'channel=H5', label: 'channel=H5 · H5', sub: '业务限定', name: 'channel', group: '渠道' },
  ],
  'dwd_log.dwd_log_action': [
    { value: "event_type='page_view'", label: "event_type=page_view · 浏览", sub: '业务限定', name: 'event_type', group: '行为' },
    { value: 'channel=App', label: 'channel=App · App', sub: '业务限定', name: 'channel', group: '渠道' },
    { value: 'platform=iOS', label: 'platform=iOS', sub: '业务限定', name: 'platform', group: '终端' },
  ],
}

/** 衍生：业务限定选项（随原子绑定表） */
export function metricQualifierOptionsForAtom(atomId, list = getMetricCatalogForForms()) {
  const row = list.find((r) => r.id === atomId) || null
  const tableKey = resolveMetricTableKey(row)
  const key = TABLE_KEY_ALIASES[tableKey] || tableKey
  return (
    QUALIFIER_PRESETS_BY_TABLE[key] ||
    QUALIFIER_PRESETS_BY_TABLE[tableKey] ||
    QUALIFIER_PRESETS_BY_TABLE['dwd_trade.dwd_order_detail'] ||
    []
  )
}

export function formatMetricQualifier(keys) {
  const arr = refsToArray(keys)
  return arr.length ? arr.join(' AND ') : '无限定'
}

/** 复合：多依赖指标可选粒度的交集 */
export function metricDimOptionsForRefs(refs, list = getMetricCatalogForForms()) {
  const ids = refsToArray(refs)
  if (!ids.length) return []
  const optionSets = ids.map((id) => metricDimOptionsForAtom(id, list))
  if (optionSets.some((s) => !s.length)) {
    const map = new Map()
    optionSets.flat().forEach((o) => map.set(o.value, o))
    return [...map.values()]
  }
  let inter = new Set(optionSets[0].map((o) => o.value))
  for (let i = 1; i < optionSets.length; i++) {
    const s = new Set(optionSets[i].map((o) => o.value))
    inter = new Set([...inter].filter((v) => s.has(v)))
  }
  return optionSets[0].filter((o) => inter.has(o.value))
}

export function formatMetricDimKeys(keys) {
  const arr = refsToArray(keys)
  return arr.length ? arr.join(' + ') : '全表'
}

export function defaultMetricDimKeys(options = []) {
  if (options.some((o) => o.value === 'dt')) return ['dt']
  return options[0] ? [options[0].value] : []
}

/** @deprecated 全局预设已改为按原子表字段派生；保留兼容旧数据校验 */
export const METRIC_DIM_OPTIONS = dimOptionsFromTable('dwd_trade.dwd_order_detail')

export function isStandardMetricDim(dim) {
  const keys = refsToArray(typeof dim === 'string' && dim.includes('+') ? dim.split('+') : dim)
  if (!keys.length || keys[0] === '全表' || keys[0] === '无（全站汇总）') return true
  const allow = new Set(METRIC_DIM_OPTIONS.map((o) => o.value))
  // 旧文案兼容
  const legacy = {
    'dt 按天': 'dt',
    'dt 按周': 'dt',
    'dt 按月': 'dt',
    channel: 'channel',
    region: 'region',
    sku_id: 'sku_id',
    user_id: 'user_id',
    category_id: 'category_id',
  }
  return keys.every((k) => {
    const t = String(k).trim()
    return allow.has(t) || allow.has(legacy[t]) || TIME_NAME_RE.test(t)
  })
}

/** 自定义维度命名：字段感 + 说明，禁 SQL 符号 */
export function isValidCustomMetricDim(dim) {
  const s = String(dim || '').trim()
  if (!s || s.length < 2 || s.length > 64) return false
  if (/[;'"\\]|--|\/\*/.test(s)) return false
  if (!/[a-zA-Z_\u4e00-\u9fa5]/.test(s)) return false
  return true
}

/**
 * 解析可执行公式（不含维度/时间窗）。
 * 支持：A-0012 | A-0012 WHERE x=1 | M-0001 / A-0012 | (M-0001 - A-0012) / A-0012
 */
export function parseMetricFormula(formula) {
  const raw = String(formula || '').trim()
  if (!raw) return { ok: false, error: '公式为空' }
  if (/[·•]/.test(raw) || /按[天周月]/.test(raw)) {
    return { ok: false, error: '维度/时间窗请用独立字段，勿写入公式' }
  }
  let expr = raw
  let filter = ''
  const whereHit = raw.match(/\s+WHERE\s+(.+)$/i)
  if (whereHit) {
    filter = whereHit[1].trim()
    expr = raw.slice(0, whereHit.index).trim()
  }
  // 只允许指标 ID、运算符、括号、空白
  if (!/^[\sACM0-9+\-*/()]+$/i.test(expr)) {
    return { ok: false, error: '公式仅允许指标 ID 与 + - * / ( )' }
  }
  const refs = [...expr.matchAll(/\b([ACM]-\d{4})\b/gi)].map((m) => m[1].toUpperCase())
  if (!refs.length) return { ok: false, error: '公式中未找到指标 ID（如 A-0012）' }
  return {
    ok: true,
    expr: expr.replace(/\s+/g, ' '),
    filter,
    refs: [...new Set(refs)],
  }
}

/** 展示用：派生组合或复合公式（衍生不落公式） */
export function formatMetricCalcDisplay({
  kind,
  type,
  formula,
  atomRef,
  qualifier,
  dim,
  time,
} = {}) {
  const k = kind || type
  if (k === '衍生') {
    const parts = [
      atomRef || '',
      formatMetricQualifier(qualifier),
      dim || '全表',
      time || '',
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
    return parts.join(' · ')
  }
  const parts = [formula, dim, time].map((x) => String(x || '').trim()).filter(Boolean)
  return parts.join(' · ')
}

export function metricTypeMeta(kind) {
  if (kind === '原子') return { type: '原子', typeCls: 'tag-blue', prefix: 'A' }
  if (kind === '复合') return { type: '复合', typeCls: 'tag-cyan', prefix: 'C' }
  return { type: '衍生', typeCls: 'tag-purple', prefix: 'M' }
}

export function nextMetricId(kind, existing = []) {
  const { prefix } = metricTypeMeta(kind)
  const nums = existing
    .map((r) => r.id)
    .filter((id) => String(id).startsWith(`${prefix}-`))
    .map((id) => Number(String(id).split('-')[1]) || 0)
  const next = (nums.length ? Math.max(...nums) : prefix === 'A' ? 12 : prefix === 'C' ? 100 : 200) + 1
  return `${prefix}-${String(next).padStart(4, '0')}`
}

function bumpVer(ver) {
  const m = String(ver || 'v0').match(/v?(\d+)/i)
  const n = m ? Number(m[1]) + 1 : 1
  return `v${n}`
}

export function appendHistory(row, status, note = '') {
  const st = metricStatusMeta(status)
  const item = {
    status,
    label: st.label,
    time: new Date().toISOString().slice(0, 16).replace('T', ' '),
    note,
  }
  return [...(row.history || []), item]
}

/** 由创建表单 payload 生成目录行 · 默认草稿 */
export function buildMetricFromForm(payload, existing = []) {
  const kind = payload.kind || '原子'
  const meta = metricTypeMeta(kind)
  const id = nextMetricId(kind, existing)
  let bind = '—'
  let caliber = payload.caliber || ''
  let formulaAst = null
  if (kind === '原子') {
    bind = `${payload.table || 'T'}.${payload.field || 'col'}`
    if (payload.agg) caliber = caliber || `${payload.agg}(${payload.field})`
  } else if (kind === '衍生') {
    bind = refsToString(payload.atomRef) || '—'
    // 衍生无计算公式；口径可由业务描述，缺省用组合语义
    if (!caliber) {
      caliber = formatMetricCalcDisplay({
        kind: '衍生',
        atomRef: refsToString(payload.atomRef),
        qualifier: payload.qualifier,
        dim: formatMetricDimKeys(refsToArray(payload.dim)),
        time: payload.time,
      })
    }
  } else {
    bind = refsToString(payload.deriveRef) || '—'
    if (payload.formula) caliber = caliber || payload.formula
    formulaAst = parseMetricFormula(payload.formula)
  }
  if (formulaAst && !formulaAst.ok) {
    throw new Error(formulaAst.error)
  }
  const dimKeys = kind === '衍生' ? refsToArray(payload.dim) : []
  const dimLabel = kind === '衍生' ? formatMetricDimKeys(dimKeys) : ''
  const qualifierKeys = kind === '衍生' ? refsToArray(payload.qualifier) : []
  return withStatus(
    {
      id,
      name: payload.name,
      type: meta.type,
      typeCls: meta.typeCls,
      domain: metricDomainKey(payload.domain),
      domainLabel: payload.domain || '交易',
      caliber,
      bind,
      latest: '待计算',
      vol: '—',
      volCls: 'warn',
      owner: payload.owner || '李明',
      ver: 'v1',
      unit: payload.unit || '',
      formula: kind === '复合' ? payload.formula || '' : '',
      formulaAst: formulaAst?.ok
        ? { expr: formulaAst.expr, filter: formulaAst.filter, refs: formulaAst.refs }
        : null,
      qualifier: formatMetricQualifier(qualifierKeys),
      qualifierKeys,
      dim: dimLabel,
      dimKeys,
      dimCustom: false,
      time: kind === '衍生' ? payload.time || '' : '',
      agg: payload.agg || '',
      kind,
      atomRef: refsToString(payload.atomRef),
      deriveRef: refsToString(payload.deriveRef),
      table: payload.table || '',
      field: payload.field || '',
    },
    'draft',
    { note: '新建保存为草稿' },
  )
}

/** 应用编辑到草稿 / 评审中 */
export function applyMetricEdit(row, payload) {
  const kind = payload.kind || row.kind || row.type
  const meta = metricTypeMeta(kind)
  let bind = row.bind
  if (kind === '原子') bind = `${payload.table || row.table || 'T'}.${payload.field || row.field || 'col'}`
  else if (kind === '衍生') bind = refsToString(payload.atomRef) || row.atomRef || row.bind
  else bind = refsToString(payload.deriveRef) || row.deriveRef || row.bind

  let formulaAst = row.formulaAst || null
  let formula = payload.formula ?? row.formula
  if (kind === '复合' && formula) {
    const parsed = parseMetricFormula(formula)
    if (!parsed.ok) throw new Error(parsed.error)
    formulaAst = { expr: parsed.expr, filter: parsed.filter, refs: parsed.refs }
  } else if (kind !== '复合') {
    formula = ''
    formulaAst = null
  }

  const dimKeys =
    kind === '衍生'
      ? payload.dim !== undefined
        ? refsToArray(payload.dim)
        : refsToArray(row.dimKeys || row.dim)
      : []
  const dimLabel = kind === '衍生' ? formatMetricDimKeys(dimKeys) : ''
  const qualifierKeys =
    kind === '衍生'
      ? payload.qualifier !== undefined
        ? refsToArray(payload.qualifier)
        : refsToArray(row.qualifierKeys || row.qualifier)
      : []

  return {
    ...row,
    name: payload.name || row.name,
    kind,
    type: meta.type,
    typeCls: meta.typeCls,
    domain: metricDomainKey(payload.domain || row.domainLabel),
    domainLabel: payload.domain || row.domainLabel,
    caliber: payload.caliber || row.caliber,
    bind,
    unit: payload.unit ?? row.unit,
    formula,
    formulaAst,
    qualifier: kind === '衍生' ? formatMetricQualifier(qualifierKeys) : '',
    qualifierKeys,
    dim: dimLabel,
    dimKeys,
    dimCustom: false,
    time: kind === '衍生' ? (payload.time ?? row.time) : '',
    agg: payload.agg ?? row.agg,
    atomRef: refsToString(payload.atomRef ?? row.atomRef),
    deriveRef: refsToString(payload.deriveRef ?? row.deriveRef),
    table: payload.table ?? row.table,
    field: payload.field ?? row.field,
    owner: payload.owner || row.owner,
    history: appendHistory(row, row.status, '编辑口径'),
  }
}

/** 状态迁移 */
export function transitionMetric(row, action) {
  const next = { ...row }
  if (action === 'submit' && row.status === 'draft') {
    next.status = 'review'
    next.history = appendHistory(row, 'review', '提交评审')
  } else if (action === 'approve' && row.status === 'review') {
    next.status = 'active'
    next.history = appendHistory(row, 'active', `${row.ver || 'v1'} 启用`)
  } else if (action === 'reject' && row.status === 'review') {
    next.status = 'draft'
    next.history = appendHistory(row, 'draft', '评审退回')
  } else if (action === 'change' && row.status === 'active') {
    next.status = 'version_review'
    next.pendingCaliber = row.caliber
    next.history = appendHistory(row, 'version_review', '发起口径变更')
  } else if (action === 'approveVersion' && row.status === 'version_review') {
    next.status = 'active'
    next.ver = bumpVer(row.ver)
    if (row.pendingCaliber) next.caliber = row.pendingCaliber
    next.pendingCaliber = ''
    next.history = appendHistory(row, 'active', `${next.ver} 启用`)
  } else if (action === 'cancelChange' && row.status === 'version_review') {
    next.status = 'active'
    next.pendingCaliber = ''
    next.history = appendHistory(row, 'active', '取消变更，保持当前版本')
  } else if (action === 'deprecate' && row.status === 'active') {
    next.status = 'deprecated'
    next.history = appendHistory(row, 'deprecated', '废弃，禁止新引用')
  } else {
    return null
  }
  const st = metricStatusMeta(next.status)
  next.statusLabel = st.label
  next.statusCls = st.cls
  next.rowWarn = next.status === 'review' || next.status === 'version_review'
  return next
}

export function metricToFormPayload(row) {
  return {
    kind: row.kind || row.type || '原子',
    name: row.name,
    domain: row.domainLabel || ({ trade: '交易', user: '用户', goods: '商品' }[row.domain] || '交易'),
    unit: row.unit || '个',
    table: row.table || '',
    field: row.field || '',
    agg: row.agg || 'COUNT',
    gravAssetId: row.gravAssetId || '',
    atomRef: refsToArray(row.atomRef || (row.type === '衍生' ? row.bind : '')).slice(0, 1)[0] || '',
    deriveRef: refsToArray(row.deriveRef || (row.type === '复合' ? row.bind : '')),
    formula: row.formula || '',
    qualifier: row.qualifierKeys?.length
      ? [...row.qualifierKeys]
      : refsToArray(row.qualifier).filter((x) => x && x !== '无限定'),
    dim: row.dimKeys?.length
      ? [...row.dimKeys]
      : defaultMetricDimKeys(metricDimOptionsForAtom(row.atomRef || (row.type === '衍生' ? row.bind : ''))),
    time: row.time || '近1天',
    caliber: row.caliber || '',
    owner: row.owner || '',
  }
}
