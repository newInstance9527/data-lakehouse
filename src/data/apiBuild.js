/** 数据服务 · 分步构建 API（选源 → 配参 → 鉴权 → 限流 → 测试 → 发布） */

import { getMetricCatalogForForms } from '@/data/metrics'

export const API_BUILD_STEPS = [
  { id: 'source', title: '选指标/表', desc: '选定取数来源与路径' },
  { id: 'params', title: '配参', desc: '入参、出参与响应转换' },
  { id: 'auth', title: '鉴权', desc: 'Token / OAuth2 / 免鉴权' },
  { id: 'limit', title: '全局限流', desc: '接口总 QPS / 熔断' },
  { id: 'test', title: '测试', desc: '调用接口调试' },
  { id: 'publish', title: '发布', desc: '发布部署到接口服务' },
]

/**
 * @deprecated 勿回落静态 DATA_SOURCES；向导只用 listForSqlrest。
 * 保留空数组以免旧 import 炸裂。
 */
export const API_DATASOURCE_OPTIONS = []

/** 由门户资产目录行生成表选项（空列表合法） */
export function apiTableOptionsFromAssets(assets = []) {
  const ok = new Set(['ads', 'dwd', 'dws', 'dim'])
  return (assets || [])
    .filter((a) => ok.has(String(a.layer || a.layerCode || '').toLowerCase()))
    .map((a) => {
      const key = a.key || a.objectName || a.assetCode || a.id
      return {
        value: key,
        label: `${key} · ${a.name || a.title || key}`,
        sub: `${a.layerLabel || a.layer || ''} · ${a.domainLabel || a.domain || ''}`,
        name: a.name,
        layer: a.layerLabel || a.layer,
        domain: a.domainLabel || a.domain,
      }
    })
}

/** @deprecated 使用 apiTableOptionsFromAssets(liveAssets) */
export const API_TABLE_OPTIONS = []

export function apiDatasourceLabel(dsId, liveOptions = []) {
  const list = liveOptions?.length ? liveOptions : API_DATASOURCE_OPTIONS
  const d = list.find((o) => o.value === dsId)
  return d ? d.label : dsId || '—'
}

/** 已启用指标选项（读 useMetrics 注入的真目录；空列表合法） */
export function apiMetricOptions() {
  return getMetricCatalogForForms()
    .filter((m) => m.status === 'active' || m.status === 'version_review')
    .map((m) => ({
      value: m.id,
      label: `${m.id} · ${m.name}`,
      sub: `${m.type} · ${m.caliber || ''}`,
      name: m.name,
      type: m.type,
      domain: m.domainLabel || m.domain,
    }))
}

/** @deprecated 使用 apiMetricOptions()；保留 getter 兼容旧模板 */
export const API_METRIC_OPTIONS = new Proxy([], {
  get(_t, prop) {
    const live = apiMetricOptions()
    if (prop === 'length') return live.length
    if (prop === Symbol.iterator) return live[Symbol.iterator].bind(live)
    if (typeof prop === 'string' && /^\d+$/.test(prop)) return live[Number(prop)]
    const v = live[prop]
    return typeof v === 'function' ? v.bind(live) : v
  },
})

export const RESPONSE_FORMAT_OPTIONS = [
  { value: 'wrapped', label: '统一封装', tip: '{ code, message, data }（接口服务默认）' },
  { value: 'origin', label: '原样返回', tip: 'format=origin，直接返回查询结果' },
  { value: 'nil', label: '仅状态头', tip: 'format=nil，只返回 code/message' },
]

export const RESPONSE_SHAPE_OPTIONS = [
  { value: 'list', label: '列表', tip: 'data 为行数组' },
  { value: 'object', label: '单对象', tip: 'result=object，取首行' },
  { value: 'page', label: '分页', tip: 'data: { offset, total, data }' },
]

export const FIELD_TRANSFORM_OPTIONS = [
  { value: 'none', label: '原样' },
  { value: 'alias', label: '仅改名' },
  { value: 'to_number', label: '转数字' },
  { value: 'to_string', label: '转字符串' },
  { value: 'to_bool', label: '转布尔' },
  { value: 'cents_to_yuan', label: '分→元' },
  { value: 'round_2', label: '保留2位' },
  { value: 'camel', label: '转驼峰' },
  { value: 'snake', label: '转下划线' },
  { value: 'date_ymd', label: '日期 yyyy-MM-dd' },
  { value: 'drop', label: '丢弃' },
]

function toCamel(s) {
  return String(s).replace(/[_-](\w)/g, (_, c) => c.toUpperCase())
}
function toSnake(s) {
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}

/** 对单字段应用 SQLREST 出参转换 */
export function applyFieldTransform(value, transform) {
  const t = transform || 'none'
  if (t === 'drop') return undefined
  if (value == null) return value
  switch (t) {
    case 'to_number': {
      const n = Number(value)
      return Number.isFinite(n) ? n : value
    }
    case 'to_string':
      return String(value)
    case 'to_bool':
      return value === true || value === 1 || String(value).toLowerCase() === 'true'
    case 'cents_to_yuan': {
      const n = Number(value)
      return Number.isFinite(n) ? Math.round(n) / 100 : value
    }
    case 'round_2': {
      const n = Number(value)
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : value
    }
    case 'camel':
      return typeof value === 'string' ? toCamel(value) : value
    case 'snake':
      return typeof value === 'string' ? toSnake(value) : value
    case 'date_ymd': {
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return value
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${d.getFullYear()}-${m}-${day}`
    }
    case 'alias':
    case 'none':
    default:
      return value
  }
}

/** 将原始行按出参映射转换为响应行 */
export function mapResponseRow(rawRow, fields) {
  const list = (fields || []).filter((f) => f.name?.trim() && f.transform !== 'drop')
  if (!list.length) return { ...rawRow }
  const out = {}
  for (const f of list) {
    const src = (f.source || f.name).trim()
    const key = f.name.trim()
    let val = Object.prototype.hasOwnProperty.call(rawRow, src)
      ? rawRow[src]
      : Object.prototype.hasOwnProperty.call(rawRow, key)
        ? rawRow[key]
        : f.example !== '' && f.example != null
          ? f.example
          : f.nullable
            ? null
            : undefined
    if (val === '' && f.example !== '' && f.example != null && !(src in rawRow) && !(key in rawRow)) {
      val = f.example
    }
    if ((f.type === 'int' || f.type === 'number') && val != null && val !== '' && f.transform === 'none') {
      const n = Number(val)
      if (Number.isFinite(n)) val = n
    }
    const mapped = applyFieldTransform(val, f.transform)
    if (mapped !== undefined) out[key] = mapped
  }
  return out
}

export function wrapSqlrestResponse(form, rows) {
  const format = form.responseFormat || 'wrapped'
  const shape = form.responseShape || form.responseWrap || 'list'
  if (format === 'nil') {
    return { code: 0, message: '操作成功' }
  }

  let data
  if (shape === 'object') {
    data = rows[0] ?? null
  } else if (shape === 'page') {
    data = {
      offset: Number(form.params?.find((p) => p.name === 'offset')?.example) || 0,
      total: Number(form.pageTotalExample) || rows.length * 12 || 24,
      data: rows,
    }
  } else {
    data = rows
  }

  if (format === 'origin') return data
  return { code: 0, message: '操作成功', data }
}

export function defaultApiBuildForm() {
  return {
    srcType: '指标',
    metricId: apiMetricOptions()[0]?.value || '',
    tableKey: '',
    datasourceId: '',
    engine: 'SQL',
    sql: '',
    path: '',
    name: '',
    method: 'GET',
    params: [],
    /** SQLREST 出参：列映射 + 转换 + 封装形态 */
    responses: [],
    responseFormat: 'wrapped', // wrapped | origin | nil
    responseShape: 'list', // list | object | page
    pageTotalExample: 24,
    auth: 'Token',
    tokenTtl: '30天',
    oauthScopes: 'api.read',
    qps: 200,
    burst: 400,
    breaker: '5xx>20% 熔断 30s',
    owner: '',
    domain: '',
    publishEnv: 'stg',
    tested: false,
    testResult: null,
  }
}

export function apiSourceLabel(form, tableOptions = []) {
  if (form.srcType === '指标') {
    const m = API_METRIC_OPTIONS.find((o) => o.value === form.metricId)
    return m ? m.label : form.metricId
  }
  if (form.srcType === '表') {
    const list = tableOptions?.length ? tableOptions : API_TABLE_OPTIONS
    const t = list.find((o) => o.value === form.tableKey)
    return t ? t.label : form.tableKey || '—'
  }
  return '自定义 SQL'
}

export function syncSqlTemplate(form) {
  if (form.srcType === '指标') {
    const id = form.metricId || '<metric_code>'
    return `SELECT *\nFROM metric_query('${id}')\nWHERE dt = {{dt}}\nLIMIT {{limit}}`
  }
  if (form.srcType === '表') {
    const table = form.tableKey || '<schema.table>'
    return `SELECT *\nFROM ${table}\nWHERE dt = {{dt}}\nLIMIT {{limit}}`
  }
  return form.sql || 'SELECT 1'
}

export function runApiBuildTest(form) {
  const src = apiSourceLabel(form)
  const dsLabel = form.srcType === 'SQL' ? apiDatasourceLabel(form.datasourceId) : '接口服务 → 查询引擎（默认湖仓）'
  // 静态结构校验；禁止注入演示行，正式试跑走已发布 SQLREST
  const fields = form.responses || []
  const mapped = []
  const shape = form.responseShape || form.responseWrap || 'list'
  const body = wrapSqlrestResponse(form, mapped)

  return {
    ok: true,
    latencyMs: 0,
    engine: form.srcType === 'SQL' ? `接口服务 → ${dsLabel}` : '接口服务 → 查询引擎',
    source: src,
    datasource: form.srcType === 'SQL' ? form.datasourceId : '',
    rowCount: 0,
    format: form.responseFormat || 'wrapped',
    shape,
    sample: body,
    note: fields.length
      ? `已配置 ${fields.length} 个出参映射；未注入演示行`
      : '未配置出参映射；未注入演示行',
    checkedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  }
}

export function buildApiFromWizard(form) {
  const path = form.path?.startsWith('/') ? form.path : `/api/${form.path || 'custom'}`
  const metric = form.srcType === '指标' ? form.metricId || '待绑定' : '-'
  const asset =
    form.srcType === '表'
      ? String(form.tableKey || '').split('.').pop() || form.tableKey
      : form.srcType === '指标'
        ? 'metric'
        : '-'
  return {
    method: form.method || 'GET',
    path,
    name: form.name || path.split('/').filter(Boolean).slice(-1)[0] || path,
    desc: `${form.srcType} · ${apiSourceLabel(form)} · ${form.auth} · 全局 ${form.qps} QPS`,
    metric,
    asset,
    domain: form.domain || '自定义',
    qps: String(form.qps || 100),
    rt: form.testResult?.latencyMs ? `${form.testResult.latencyMs}ms` : '—',
    sub: '0',
    level: form.publishEnv === 'prod' ? 'L2' : '草稿',
    levelCls: form.publishEnv === 'prod' ? 'tag-orange' : 'tag-gray',
    auth: form.auth,
    owner: form.owner,
    publishEnv: form.publishEnv,
    sql: form.sql,
    params: form.params,
    responses: form.responses,
    responseFormat: form.responseFormat,
    responseShape: form.responseShape || form.responseWrap,
    burst: form.burst,
    breaker: form.breaker,
    srcType: form.srcType,
    datasourceId: form.srcType === 'SQL' ? form.datasourceId : '',
    datasourceLabel: form.srcType === 'SQL' ? apiDatasourceLabel(form.datasourceId) : '',
    publishedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  }
}
