/**
 * 数据源 API（后端已按前端字段返回，此处仅组分页/提交载荷）
 */
import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

const DS = '/lh/datasource'

/** 列表分页：kw/type/status/cat/ws + current/size */
export function fetchDatasourcePage(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${DS}/page`, {
    current,
    size,
    kw: filters.kw,
    type: filters.type,
    status: filters.status,
    cat: filters.cat,
    category: filters.cat,
    purpose: filters.purpose,
    usableInDag: filters.usableInDag,
    ws: resolveWs(filters.ws),
  })
}

export function fetchDatasourceDetail(id) {
  return http.get(`${DS}/detail`, { id })
}

/** 探测源端列清单（JDBC：table/column/type；非 JDBC 为表级占位） */
export function fetchPreviewSchema(id) {
  return http.get(`${DS}/previewSchema`, { id })
}

/** 分层元数据：Schema 列表（JDBC；非 JDBC 返回空数组） */
export function fetchMetaSchemas(id) {
  return http.get(`${DS}/meta/schemas`, { id })
}

/** 分层元数据：表列表 */
export function fetchMetaTables(id, schema) {
  return http.get(`${DS}/meta/tables`, { id, schema })
}

/** 分层元数据：视图列表 */
export function fetchMetaViews(id, schema) {
  return http.get(`${DS}/meta/views`, { id, schema })
}

/** 分层元数据：列列表（name / type / remarks） */
export function fetchMetaColumns(id, schema, table) {
  return http.get(`${DS}/meta/columns`, { id, schema, table })
}

export function fetchDatasourceKpi(ws) {
  return http.get(`${DS}/kpi`, { ws: resolveWs(ws) })
}

/** 投影门户数据源到 SQLREST（可按 id 列表；空=全部可投影） */
export function projectToSqlrest(ids = []) {
  const body = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map((id) => ({ id }))
  return http.post(`${DS}/projectToSqlrest`, body)
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
  // 已登记源：只传 id（及可选 type），由后端读 Vault 真实探测
  if (payload?.id && !payload.host && !payload.password && !payload.user && !payload.database) {
    return http.post(`${DS}/test`, { id: payload.id, type: payload.type })
  }
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

/** 按连通参数 / 已登记 id 发现源端真实表（不落库） */
export function discoverTables(payload) {
  if (payload?.id && !payload.host && !payload.password && !payload.user && !payload.database) {
    return http.post(`${DS}/table/discover`, { id: payload.id, type: payload.type })
  }
  return http.post(`${DS}/table/discover`, toSubmitBody(payload))
}

export function batchSyncTables(ids) {
  return http.post(
    `${DS}/table/batchSync`,
    (ids || []).map((id) => ({ id })),
  )
}

/** 顶层元数据：不进 Vault conn */
const SUBMIT_META_KEYS = new Set([
  'id',
  'name',
  'type',
  'typeCode',
  'purpose',
  'owner',
  'ownerName',
  'desc',
  'lag',
  'asset',
  'ws',
  'conn',
  'status',
  'health',
  'ver',
  'created',
  'tables',
  'syncState',
  'lastError',
  'icon',
  'bg',
  'color',
])

/**
 * 前端表单 → 后端提交体。
 * 类型专属字段全部写入 conn（不再白名单遗漏 security/ssl/authSource 等）。
 */
export function toSubmitBody(form) {
  const src = form && typeof form === 'object' ? form : {}
  const conn = {
    ...(src.conn && typeof src.conn === 'object' ? src.conn : {}),
  }
  for (const [k, v] of Object.entries(src)) {
    if (SUBMIT_META_KEYS.has(k)) continue
    if (v == null || v === '') continue
    if (typeof v === 'object' && !Array.isArray(v)) continue
    conn[k] = v
  }
  if (conn.password === '******') delete conn.password
  return {
    id: src.id,
    name: src.name,
    type: src.type,
    purpose: src.purpose,
    owner: src.owner,
    desc: src.desc,
    host: src.host ?? conn.host,
    port: src.port != null && src.port !== '' ? String(src.port) : conn.port != null ? String(conn.port) : undefined,
    database: src.database ?? conn.database,
    user: src.user ?? conn.user,
    password: src.password === '******' ? undefined : src.password,
    extra: src.extra ?? conn.extra,
    schema: src.schema ?? conn.schema,
    lag: src.lag,
    access: src.access ?? conn.access,
    asset: src.asset,
    conn,
    ws: resolveWs(src.ws),
  }
}
