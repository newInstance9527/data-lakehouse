/** 指标中心 · 口径与目录 · 生命周期状态机 */

import { metricBindFieldOptions } from '@/data/metricBindAssets'

/** 表单选项默认读此提供者（useMetrics 接入后指向远端目录） */
let metricCatalogProvider = null

export function setMetricCatalogProvider(fn) {
  metricCatalogProvider = typeof fn === 'function' ? fn : null
}

export function getMetricCatalogForForms() {
  const live = metricCatalogProvider?.()
  return Array.isArray(live) ? live : []
}

/** @deprecated KPI 走 useMetrics.liveKpis（/lh/metric/overview）；保留空骨架防旧引用 */
export const METRIC_KPIS = []

/**
 * 状态机（与数据服务 API 发布同口径）：
 * 草稿 → 待发布（申请）→ 已启用 →（变更）待发布·变更 → 已启用
 * 已启用 → 已废弃
 * 审批在申请中心；通过后自动启用，驳回退回重改并带意见。
 */
export const METRIC_STATUS = {
  draft: { key: 'draft', label: '草稿', cls: 'tag-gray' },
  review: { key: 'review', label: '待发布', cls: 'tag-orange' },
  active: { key: 'active', label: '已启用', cls: 'tag-green' },
  version_review: { key: 'version_review', label: '待发布·变更', cls: 'tag-blue' },
  deprecated: { key: 'deprecated', label: '已废弃', cls: 'tag-red' },
}

export const METRIC_STATUS_TABS = [
  { id: 'all', label: '全部状态' },
  { id: 'draft', label: '草稿' },
  { id: 'review', label: '待发布' },
  { id: 'active', label: '已启用' },
  { id: 'version_review', label: '待发布·变更' },
  { id: 'deprecated', label: '已废弃' },
]

export const METRIC_LIFECYCLE_STAGES = [
  { id: 'draft', label: '草稿' },
  { id: 'review', label: '待发布' },
  { id: 'active', label: '已启用' },
  { id: 'version_review', label: '待发布·变更' },
  { id: 'deprecated', label: '已废弃' },
]

export function metricStatusMeta(key) {
  return METRIC_STATUS[key] || METRIC_STATUS.draft
}

/** 当前状态允许的操作（启用/驳回走申请中心，不在本页直批）
 * 删除仅 draft / review / deprecated；active 须先废弃 */
export function metricActions(status) {
  return (
    {
      draft: ['edit', 'applyPublish', 'delete', 'detail'],
      review: ['edit', 'goTicket', 'delete', 'detail'],
      active: ['applyQuery', 'applyChange', 'deprecate', 'detail'],
      version_review: ['goTicket', 'detail'],
      deprecated: ['delete', 'detail'],
    }[status] || ['detail']
  )
}

export const METRIC_DOMAIN_TABS = [
  { id: 'all', label: '全部域' },
  { id: 'trade', label: '交易域' },
  { id: 'user', label: '用户域' },
  { id: 'goods', label: '商品域' },
  { id: 'marketing', label: '营销域' },
  { id: 'finance', label: '财务域' },
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

export const METRIC_CATALOG = []

const DOMAIN_MAP = {
  交易: 'trade',
  交易域: 'trade',
  用户: 'user',
  用户域: 'user',
  商品: 'goods',
  商品域: 'goods',
  product: 'goods',
  流量: 'user',
  财务: 'finance',
  财务域: 'finance',
  营销: 'marketing',
  营销域: 'marketing',
  通用: 'common',
}

export function metricDomainKey(label) {
  if (!label) return 'common'
  const d = String(label).trim()
  return DOMAIN_MAP[d] || d.toLowerCase()
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

/** 表字段：优先 metricBindAssets 缓存（gov_asset schema）；禁止演示 SCHEMA_COLS 回落 */
const METRIC_TABLE_FIELDS = {}

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
  const live = metricBindFieldOptions({ table: key }) || metricBindFieldOptions({ table: tableKey }) || []
  if (live.length) {
    return dimOptionsFromFields(
      live.map((o) => ({
        name: o.value || o.name,
        type: o.type || '',
        desc: o.comment || o.label || '',
      })),
    )
  }
  return []
}

/** 衍生：依赖原子指标 → 其绑定表可作统计粒度的字段 */
export function metricDimOptionsForAtom(atomId, list = getMetricCatalogForForms()) {
  const row = list.find((r) => r.id === atomId && (r.type === '原子' || r.kind === '原子'))
    || list.find((r) => r.id === atomId)
  if (!row) return []
  return dimOptionsFromTable(resolveMetricTableKey(row))
}

/** 表字段常见业务限定预设（空：禁止演示 WHERE；用户可手写或后续按码值集扩展） */
const QUALIFIER_PRESETS_BY_TABLE = {}

/** 衍生：业务限定选项（随原子绑定表） */
export function metricQualifierOptionsForAtom(atomId, list = getMetricCatalogForForms()) {
  const row = list.find((r) => r.id === atomId) || null
  const tableKey = resolveMetricTableKey(row)
  const key = TABLE_KEY_ALIASES[tableKey] || tableKey
  return QUALIFIER_PRESETS_BY_TABLE[key] || QUALIFIER_PRESETS_BY_TABLE[tableKey] || []
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

/** @deprecated 空列表；粒度校验改为字段名启发式，不绑演示表 */
export const METRIC_DIM_OPTIONS = []

export function isStandardMetricDim(dim) {
  const keys = refsToArray(typeof dim === 'string' && dim.includes('+') ? dim.split('+') : dim)
  if (!keys.length || keys[0] === '全表' || keys[0] === '无（全站汇总）') return true
  // 无演示白名单：允许常见字段名 / 时间列；自定义走 isValidCustomMetricDim
  return keys.every((k) => {
    const t = String(k).trim()
    return TIME_NAME_RE.test(t) || /^[a-zA-Z_][\w]*$/.test(t)
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
      owner: payload.owner || '',
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
  const domainCode = (() => {
    const raw = String(row.domain || row.domainCode || '').trim()
    if (raw && !/[\u4e00-\u9fff]/.test(raw)) {
      return raw === 'product' ? 'goods' : raw
    }
    const label = String(row.domainLabel || raw).trim()
    const byLabel = {
      交易: 'trade',
      交易域: 'trade',
      用户: 'user',
      用户域: 'user',
      商品: 'goods',
      商品域: 'goods',
      营销: 'marketing',
      营销域: 'marketing',
      财务: 'finance',
      财务域: 'finance',
      通用: 'common',
    }
    return byLabel[label] || 'trade'
  })()
  return {
    kind: row.kind || row.type || '原子',
    name: row.name,
    domain: domainCode,
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
