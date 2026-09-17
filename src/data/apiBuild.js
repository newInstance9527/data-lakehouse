/** 数据服务 · 分步构建 API（选源 → 配参 → 鉴权 → 限流 → 测试 → 发布） */

import { ASSET_DATA } from '@/data/assets'
import { METRIC_CATALOG } from '@/data/metrics'
import { DATA_SOURCES, endpointOf } from '@/data/datasources'

export const API_BUILD_STEPS = [
  { id: 'source', title: '选指标/表', desc: '选定取数来源与路径' },
  { id: 'params', title: '配参', desc: '入参、出参与响应转换' },
  { id: 'auth', title: '鉴权', desc: 'Token / OAuth2 / 免鉴权' },
  { id: 'limit', title: '全局限流', desc: '接口总 QPS / 熔断' },
  { id: 'test', title: '测试', desc: 'SQLREST 试跑校验' },
  { id: 'publish', title: '发布', desc: '推送到 APISIX' },
]

/** 自定义 SQL 可选数据源（在线 · 可查询类） */
const SQL_DS_TYPES = new Set([
  'Trino',
  'ClickHouse',
  'Iceberg',
  'MySQL',
  'PostgreSQL',
  'Doris',
  'StarRocks',
  'Hive',
  'Presto',
])

export const API_DATASOURCE_OPTIONS = DATA_SOURCES.filter(
  (d) => d.status === 'online' && SQL_DS_TYPES.has(d.type),
).map((d) => ({
  value: d.id,
  label: `${d.name} · ${d.type}`,
  sub: `${endpointOf(d)} · ${d.desc || d.database || ''}`,
  name: d.name,
  type: d.type,
  endpoint: endpointOf(d),
  owner: d.owner,
}))

export function apiDatasourceLabel(dsId) {
  const d = API_DATASOURCE_OPTIONS.find((o) => o.value === dsId)
  return d ? d.label : dsId || '—'
}

export const API_METRIC_OPTIONS = METRIC_CATALOG.filter(
  (m) => m.status === 'active' || m.status === 'version_review',
).map((m) => ({
  value: m.id,
  label: `${m.id} · ${m.name}`,
  sub: `${m.type} · ${m.caliber || ''}`,
  name: m.name,
  type: m.type,
  domain: m.domainLabel || m.domain,
}))

export const API_TABLE_OPTIONS = ASSET_DATA.filter((a) =>
  ['ads', 'dwd', 'dws', 'dim'].includes(a.layer),
).map((a) => ({
  value: a.key,
  label: `${a.key} · ${a.name}`,
  sub: `${a.layerLabel} · ${a.domainLabel}`,
  name: a.name,
  layer: a.layerLabel,
  domain: a.domainLabel,
}))

export const RESPONSE_FORMAT_OPTIONS = [
  { value: 'wrapped', label: '统一封装', tip: '{ code, message, data }（SQLREST 默认）' },
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
  const defaultDs =
    API_DATASOURCE_OPTIONS.find((d) => d.type === 'Trino')?.value ||
    API_DATASOURCE_OPTIONS[0]?.value ||
    ''
  return {
    srcType: '指标',
    metricId: API_METRIC_OPTIONS[0]?.value || 'M-0001',
    tableKey: API_TABLE_OPTIONS[0]?.value || 'ads.ads_gmv_board',
    datasourceId: defaultDs,
    sql: 'SELECT dt, channel, total_gmv\nFROM ads.ads_gmv_board\nWHERE dt = {{dt}}\nLIMIT {{limit}}',
    path: '/api/gmv/daily',
    name: '日 GMV 查询',
    method: 'GET',
    params: [
      { name: 'dt', type: 'date', required: true, example: '2026-09-16', desc: '统计日' },
      { name: 'channel', type: 'string', required: false, example: 'App', desc: '渠道，可空' },
      { name: 'limit', type: 'int', required: false, example: '100', desc: '返回行数' },
    ],
    /** SQLREST 出参：列映射 + 转换 + 封装形态 */
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
    responseFormat: 'wrapped', // wrapped | origin | nil
    responseShape: 'list', // list | object | page
    pageTotalExample: 24,
    auth: 'Token',
    tokenTtl: '30天',
    oauthScopes: 'api.read',
    qps: 200,
    burst: 400,
    breaker: '5xx>20% 熔断 30s',
    owner: '张涛',
    domain: '交易域',
    publishEnv: 'stg',
    tested: false,
    testResult: null,
  }
}

export function apiSourceLabel(form) {
  if (form.srcType === '指标') {
    const m = API_METRIC_OPTIONS.find((o) => o.value === form.metricId)
    return m ? m.label : form.metricId
  }
  if (form.srcType === '表') {
    const t = API_TABLE_OPTIONS.find((o) => o.value === form.tableKey)
    return t ? t.label : form.tableKey
  }
  return '自定义 SQL'
}

export function syncSqlTemplate(form) {
  if (form.srcType === '指标') {
    const id = form.metricId || 'M-0001'
    return `SELECT *\nFROM metric_query('${id}')\nWHERE dt = {{dt}}\nLIMIT {{limit}}`
  }
  if (form.srcType === '表') {
    const table = form.tableKey || 'ads.ads_gmv_board'
    return `SELECT *\nFROM ${table}\nWHERE dt = {{dt}}\nLIMIT {{limit}}`
  }
  return form.sql || 'SELECT 1'
}

export function runApiBuildTest(form) {
  const src = apiSourceLabel(form)
  const dsLabel = form.srcType === 'SQL' ? apiDatasourceLabel(form.datasourceId) : 'SQLREST → Trino（默认湖仓）'
  const dt = form.params?.find((p) => p.name === 'dt')?.example || '2026-09-16'
  const rawRows =
    form.srcType === '指标'
      ? [
          { dt, metric: form.metricId, value: 32846000, channel: 'App', total_gmv: 32846000 },
          { dt, metric: form.metricId, value: 12048000, channel: 'H5', total_gmv: 12048000 },
        ]
      : [
          { dt: '2026-09-16', channel: 'App', total_gmv: 32846000 },
          { dt: '2026-09-16', channel: 'H5', total_gmv: 12048000 },
        ]

  const fields = form.responses || []
  const mapped = rawRows.map((row) => mapResponseRow(row, fields))
  const shape = form.responseShape || form.responseWrap || 'list'
  const body = wrapSqlrestResponse(form, mapped)

  return {
    ok: true,
    latencyMs: 42 + Math.floor(Math.random() * 30),
    engine: form.srcType === 'SQL' ? `SQLREST → ${dsLabel}` : 'SQLREST → Trino',
    source: src,
    datasource: form.srcType === 'SQL' ? form.datasourceId : '',
    rowCount: shape === 'object' ? Math.min(1, mapped.length) : mapped.length,
    format: form.responseFormat || 'wrapped',
    shape,
    sample: body,
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
