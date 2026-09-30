/** 申请中心 · 对齐演示 HTML */

/** 申请中心 KPI 骨架（无演示数字；页面用真实工单统计覆盖） */
export const APPLY_KPIS = [
  {
    icon: '⏳',
    color: 'orange',
    label: '待我审批',
    value: '—',
    unit: '单',
    trend: '加载中…',
    trendUp: false,
    trendWarn: true,
  },
  {
    icon: '📝',
    color: 'blue',
    label: '我申请的',
    value: '—',
    unit: '单',
    trend: '',
    trendUp: true,
  },
  {
    icon: '✅',
    color: 'green',
    label: '本页已通过',
    value: '—',
    unit: '单',
    trend: '来自「我的申请」列表',
    trendUp: true,
  },
  {
    icon: '❌',
    color: 'red',
    label: '本页驳回',
    value: '—',
    unit: '单',
    trend: '来自「我的申请」列表',
    trendUp: false,
  },
]

export const APPLY_TABS = [
  { id: 'all', label: '📋 全部' },
  { id: 'perm', label: '🔐 数据权限' },
  { id: 'ops', label: '🛡 操作权限' },
  { id: 'table', label: '📚 表申请' },
  { id: 'export', label: '📤 出湖申请' },
  { id: 'scan_elevate', label: '📈 扫描抬额' },
  { id: 'api_publish', label: '🚀 API 发布' },
  { id: 'api', label: '🔑 API 调用' },
  { id: 'publish', label: '📦 发布包' },
  { id: 'metric', label: '📊 指标申请' },
  { id: 'compliance', label: '🗑️ 合规删除' },
]

export const APPLY_TYPE_OPTIONS = [
  { value: 'perm', label: '🔐 数据权限申请' },
  { value: 'manage', label: '🛡 操作权限申请' },
  { value: 'table', label: '📚 表申请' },
  { value: 'export', label: '📤 出湖申请' },
  { value: 'scan_elevate', label: '📈 扫描抬额申请' },
  { value: 'api_publish', label: '🚀 API 发布申请' },
  { value: 'api', label: '🔑 API 调用申请' },
  { value: 'publish', label: '📦 发布包审批' },
  { value: 'metric', label: '📊 指标申请' },
]

export const APPLY_EXPIRE_OPTIONS = ['14天', '30天', '90天', '长期']

/** 操作权限 privilege（与 sec_auth_grant / resource_manage 对齐） */
export const APPLY_OPS_PRIVILEGES = [
  { value: 'EDIT', label: '编辑', tip: '改配置/启停/元数据写/发布等，不含删除' },
  { value: 'DELETE', label: '删除', tip: '仅删除资源' },
  { value: 'MANAGE', label: '改删全权', tip: '等同 EDIT + DELETE' },
]

export function opsPrivilegeLabel(priv) {
  const up = String(priv || 'MANAGE').toUpperCase()
  return APPLY_OPS_PRIVILEGES.find((m) => m.value === up)?.label || up
}

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
  { value: 'register', label: '登记上架', tip: '新表登记进资产目录 / 元数据' },
  { value: 'alter', label: '结构变更', tip: '加列、改分区等元数据变更' },
]

/** 发布审批 */
export const APPLY_PUBLISH_ENVS = [
  { value: 'stg', label: 'stg（预发）' },
  { value: 'prod', label: 'prod（生产）' },
]

export function buildApplyAssetOptions(assets = []) {
  return assets
    .filter((a) => a && (a.id || a.assetCode || a.key))
    .map((a) => {
      const ownerLabel = a.ownerName || a.techOwnerName || a.owner || '—'
      const code = a.assetCode || a.key || a.name || a.id
      const title = a.cnName || a.name || code
      return {
        /** 后端 table_read / resource_manage 认 gov_asset.id */
        value: a.id || code,
        label: `${code} · ${title}`,
        sub: `${a.layerLabel || a.layer || '—'} · ${a.level || '内部'} · Owner ${ownerLabel}`,
        name: title,
        level: a.level || '内部',
        owner: ownerLabel,
        domain: a.domainLabel || a.domain || '',
        layer: a.layerLabel || a.layer || '',
        assetCode: code,
      }
    })
}

/** 出湖申请可选源表（优先 ADS/DWD/DWS；无分层时退回全部已登记表） */
export function buildApplyExportOptions(assets = []) {
  const rows = assets.filter((a) => a && (a.assetCode || a.key || a.name))
  const layered = rows.filter((a) =>
    ['ads', 'dwd', 'dws'].includes(String(a.layer || '').toLowerCase()),
  )
  const list = layered.length ? layered : rows
  return list.map((a) => {
    const code = a.assetCode || a.key || a.name
    const title = a.cnName || a.name || code
    return {
      value: code,
      label: `${code} · ${title}`,
      sub: `${a.layerLabel || a.layer || '—'} · ${a.domainLabel || a.domain || '—'} · ${a.ownerName || a.owner || '—'}`,
      name: title,
      layer: a.layerLabel || a.layer,
      domain: a.domainLabel || a.domain,
      assetId: a.id,
    }
  })
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

/** 指标申请子类型（create/change = 发布流，对齐 API；query = 权限） */
export const APPLY_METRIC_KINDS = [
  { value: 'query', label: '查询权限', tip: '看板 / 即席 / API 引用已启用指标' },
  { value: 'change', label: '口径变更发布', tip: '从指标中心发起；通过后自动启用新版本' },
  { value: 'create', label: '指标发布', tip: '从指标中心保存草稿后申请；通过后自动启用' },
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

/**
 * 申请中心指标下拉按场景分流
 * - query：仅已启用
 * - create：本人草稿/待发布（特权可见全部）
 * - change：可变更的已启用/待发布·变更
 */
export function buildApplyMetricOptions(catalog = [], opts = {}) {
  const kind = opts.kind || 'query'
  const user = opts.user
  const privileged = Boolean(opts.privileged || opts.canScopeAll || opts.isSuperAdmin)
  const uid = String(user?.id || '')
  const account = String(user?.account || '').toLowerCase()
  const mine = (m) => {
    if (privileged) return true
    if (!user) return false
    const createUser = String(m.createUser || '')
    const owner = String(m.owner || '').toLowerCase()
    return (
      (uid && createUser === uid) ||
      (account && (owner === account || String(m.owner || '') === uid))
    )
  }
  return catalog
    .filter((m) => {
      const st = m.status
      if (kind === 'query') return st === 'active'
      if (kind === 'create') return (st === 'draft' || st === 'review') && mine(m)
      if (kind === 'change') {
        return (st === 'active' || st === 'version_review') && mine(m)
      }
      return st === 'active'
    })
    .map((m) => ({
      value: m.id,
      label: `${m.id} · ${m.name}`,
      sub: `${m.type || m.kind || ''} · ${m.statusLabel || m.status} · ${m.owner || ''}`,
      name: m.name,
      type: m.type || m.kind,
      caliber: m.caliber,
      domain: m.domainLabel || m.domain,
      owner: m.owner,
      createUser: m.createUser,
      ver: m.ver,
      status: m.status,
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

/** 待审批 / 我的申请：运行时看板为空，由 /lh/apply hydrate；不再预置演示种子 */
export const APPLY_PENDING = []

export const APPLY_MINE = []

export function applyTabMatches(cardType, tabId) {
  if (tabId === 'all') return true
  if (tabId === 'ops') return cardType === 'ops' || cardType === 'manage'
  if (tabId === 'compliance') {
    return cardType === 'compliance' || cardType === 'compliance_delete'
  }
  return cardType === tabId
}
