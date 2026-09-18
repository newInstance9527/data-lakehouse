/**
 * 数据源 API（后端已按前端字段返回，此处仅组分页/提交载荷）
 */
import { http } from './http.js'

const DS = '/lh/datasource'

/** 列表分页：kw/type/status/cat + current/size */
export function fetchDatasourcePage(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${DS}/page`, {
    current,
    size,
    kw: filters.kw,
    type: filters.type,
    status: filters.status,
    cat: filters.cat,
    category: filters.cat,
  })
}

export function fetchDatasourceDetail(id) {
  return http.get(`${DS}/detail`, { id })
}

export function fetchDatasourceKpi() {
  return http.get(`${DS}/kpi`)
}

export function fetchTypeOptions() {
  return http.get(`${DS}/typeOptions`)
}

export function fetchFormSchema(type) {
  return http.get(`${DS}/formSchema`, type ? { type } : undefined)
}

/** 注册：直接传前端 RegisterSourceModal payload */
export function addDatasource(payload) {
  return http.post(`${DS}/add`, toSubmitBody(payload))
}

export function editDatasource(payload) {
  return http.post(`${DS}/edit`, { ...toSubmitBody(payload), id: payload.id })
}

export function deleteDatasources(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).map((id) => ({ id }))
  return http.post(`${DS}/delete`, list)
}

export function testDatasource(payload) {
  return http.post(`${DS}/test`, toSubmitBody(payload))
}

export function toggleDatasourceStatus(id) {
  return http.post(`${DS}/toggleStatus`, { id })
}

export function fetchTablePage(dsId, { keyword, current = 1, size = 200 } = {}) {
  return http.get(`${DS}/table/page`, { dsId, keyword, current, size })
}

export function addTable(dsId, item) {
  return http.post(`${DS}/table/add`, {
    dsId,
    name: item.name,
    cnName: item.cnName,
    comment: item.comment,
    encoding: item.encoding,
    engine: item.engine,
  })
}

export function editTable(row) {
  return http.post(`${DS}/table/edit`, {
    id: row.id,
    cnName: row.cnName,
    comment: row.comment,
    encoding: row.encoding,
    engine: row.engine,
  })
}

export function deleteTables(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).map((id) => ({ id }))
  return http.post(`${DS}/table/delete`, list)
}

export function syncTables(dsId) {
  return http.post(`${DS}/table/sync`, { id: dsId })
}

export function batchSyncTables(ids) {
  return http.post(
    `${DS}/table/batchSync`,
    (ids || []).map((id) => ({ id })),
  )
}

/**
 * 前端表单 → 后端提交体（字段已对齐，补 conn 便于类型专属字段落库）
 */
export function toSubmitBody(form) {
  const typeFields = [
    'host',
    'port',
    'database',
    'user',
    'password',
    'extra',
    'schema',
    'access',
    'bootstrap',
    'bootstrapServers',
    'topics',
    'queues',
    'endpoint',
    'nameNode',
    'serviceUrl',
    'zkQuorum',
    'baseURL',
    'bucket',
    'accessKey',
    'secretKey',
    'path',
    'token',
    'sid',
    'namespace',
    'vhost',
    'tenant',
    'db',
    'warehouse',
    'feNodes',
    'pollCycle',
    'jdbcUrl',
  ]
  const conn = { ...(form.conn || {}) }
  typeFields.forEach((k) => {
    if (form[k] != null && form[k] !== '') conn[k] = form[k]
  })
  return {
    id: form.id,
    name: form.name,
    type: form.type,
    purpose: form.purpose,
    owner: form.owner,
    desc: form.desc,
    host: form.host,
    port: form.port != null ? String(form.port) : undefined,
    database: form.database,
    user: form.user,
    password: form.password === '******' ? undefined : form.password,
    extra: form.extra,
    schema: form.schema,
    lag: form.lag,
    access: form.access,
    asset: form.asset,
    conn,
  }
}
