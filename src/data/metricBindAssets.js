/**
 * 指标原子绑定 · 资产目录表/字段选项（gov_asset + Grav/OM schema）
 */
import { ref, shallowRef } from 'vue'
import { fetchAssetPage, fetchAssetSchema } from '@/api/catalog'
import { resolveWs } from '@/utils/ws'
import { fetchAllPages, BACKEND_PAGE_SIZE_MAX } from '@/utils/pageFetch'

/** 供 CreateFormModal 追踪异步刷新 */
export const metricBindRev = ref(0)

const tableOptions = shallowRef([])
/** bindTable → field options */
const fieldsByTable = shallowRef({})
/** bindTable → { assetId, gravAssetId, assetCode, omFqn, objectName } */
const metaByTable = shallowRef({})

const loadingTables = ref(false)
const loadingFields = shallowRef({})
let tablesPromise = null
/** 当前缓存对应的工作空间；切空间或登记新资产后需失效 */
let cachedWs = ''
const fieldsPromises = new Map()

const TABLE_KINDS = new Set(['table', 'iceberg', 'hive', 'view', ''])
/** 指标试跑走 Trino，仅允许湖上可查引擎/FQN */
const LAKE_ENGINE_RE = /iceberg|hive|trino|doris|starrocks/i
const SOURCE_ENGINE_RE =
  /mysql|mariadb|postgres|oracle|sql\s*server|azuresql|mongodb|kafka|redis|elastic|clickhouse|ftp|s3|minio|http|api/i

/**
 * 是否可作为原子指标绑定表（湖表，非源端 RDB）
 * @param {object} vo 资产 VO / 选项
 */
export function isMetricQueryableLakeAsset(vo) {
  if (!vo) return false
  const engine = String(vo.engine || '').trim()
  const dsType = String(vo.primaryDsType || vo.sourceType || vo.dsType || '').trim()
  const om = String(vo.omFqn || '').trim().toLowerCase()
  const kind = String(vo.assetKind || vo.kind || 'table').toLowerCase()

  if (om.startsWith('iceberg.') || om.startsWith('hive.') || om.startsWith('trino.')) {
    return true
  }
  if (LAKE_ENGINE_RE.test(engine) || LAKE_ENGINE_RE.test(dsType) || LAKE_ENGINE_RE.test(kind)) {
    return true
  }
  // 明确源端引擎 → 不可绑
  if (SOURCE_ENGINE_RE.test(engine) || SOURCE_ENGINE_RE.test(dsType)) {
    return false
  }
  // 无引擎信息时：有三节 catalog.schema.table 的 omFqn 仍可尝试
  if (om && om.split('.').filter(Boolean).length >= 3) {
    return true
  }
  return false
}

export const METRIC_BIND_LAKE_HINT =
  '指标经 Trino 查湖表，只能选 Iceberg/Hive 等湖上资产；源端 MySQL/PG 等不可直连。请先入湖并在资产目录登记湖表。'

function bump() {
  metricBindRev.value += 1
}

/** 清空绑定表/字段缓存（登记资产、切空间、强制刷新前调用） */
export function invalidateMetricBindTables() {
  tableOptions.value = []
  fieldsByTable.value = {}
  metaByTable.value = {}
  cachedWs = ''
  tablesPromise = null
  fieldsPromises.clear()
  bump()
}

/** 编译用绑定表名：优先 objectName / omFqn 末两段 / assetCode */
export function bindTableKeyOf(vo) {
  if (!vo) return ''
  const objectName = String(vo.objectName || vo.tableName || '').trim()
  if (objectName) return objectName
  const om = String(vo.omFqn || '').trim()
  if (om) {
    const parts = om.split('.').filter(Boolean)
    if (parts.length >= 2) return parts.slice(-2).join('.')
    return om
  }
  return String(vo.assetCode || vo.key || vo.name || '').trim()
}

function layerLabelOf(vo) {
  return vo.layerLabel || vo.layer || ''
}

function domainLabelOf(vo) {
  return vo.domainLabel || vo.domainCode || vo.domain || ''
}

/** 展示用可查询 FQN：优先 omFqn，否则由绑定键推断 */
function displayFqnOf(vo, bindKey) {
  const om = String(vo.omFqn || '').trim()
  if (om) return om
  const key = String(bindKey || '').trim()
  if (!key) return ''
  if (key.split('.').filter(Boolean).length >= 3) return key
  if (key.includes('.')) return `iceberg.${key}`
  return key
}

function mapTableOption(vo) {
  const value = bindTableKeyOf(vo)
  if (!value) return null
  const cn = String(vo.cnName || '').trim()
  const bizName = String(vo.name || '').trim()
  // 业务名优先中文，避免与表名重复
  let title = ''
  if (cn && cn !== value && !cn.includes(value)) title = cn
  else if (bizName && bizName !== value && bizName !== cn) title = bizName
  const layer = layerLabelOf(vo)
  const domain = domainLabelOf(vo)
  const engine = String(vo.engine || vo.primaryDsType || 'Iceberg').trim() || 'Iceberg'
  const fqn = displayFqnOf(vo, value)

  // 主行：业务名 + 表名，一眼能认
  const label = title ? `${title}  ·  ${value}` : value
  // 副行：引擎 / 分层 / 域 / Trino FQN，便于区分同源同名表
  const subBits = []
  if (engine) subBits.push(engine)
  if (layer) subBits.push(layer)
  if (domain) subBits.push(domain)
  if (fqn && fqn !== value) subBits.push(fqn)
  else if (vo.assetCode) subBits.push(vo.assetCode)
  const sub = subBits.join('  ·  ')

  return {
    value,
    label,
    sub,
    name: title || value,
    layer: String(vo.layer || '').toLowerCase(),
    layerLabel: layer || '—',
    domain: domain || '—',
    engine,
    fqn,
    primaryDsType: vo.primaryDsType || vo.sourceType || '',
    assetKind: vo.assetKind || '',
    assetCode: vo.assetCode || vo.key || '',
    assetId: vo.id,
    gravAssetId: vo.gravAssetId || '',
    omFqn: vo.omFqn || '',
    objectName: vo.objectName || vo.tableName || '',
    search: [value, title, cn, bizName, vo.assetCode, layer, domain, fqn, engine, vo.omFqn]
      .filter(Boolean)
      .join(' '),
  }
}

function mapFieldOption(col) {
  const name = col?.name || col?.enName || ''
  if (!name) return null
  const type = col.type || col.dataType || ''
  const comment = col.comment || col.cnName || col.desc || ''
  const bits = [name]
  if (type) bits.push(type)
  if (col.pk) bits.push('PK')
  if (comment) bits.push(comment)
  return {
    value: name,
    label: bits.join(' · '),
    name,
    type,
    comment,
  }
}

function isBindableAsset(vo) {
  const kind = String(vo.assetKind || 'table').toLowerCase()
  if (!TABLE_KINDS.has(kind) && !(vo.objectName || vo.omFqn || vo.assetCode)) {
    return false
  }
  return isMetricQueryableLakeAsset(vo)
}

export function metricBindTableOptions() {
  // 依赖 rev，打开表单后异步灌入可触发重渲染
  void metricBindRev.value
  return tableOptions.value
}

export function metricBindFieldOptions(form = {}) {
  void metricBindRev.value
  const table = form?.table
  if (!table) return []
  return fieldsByTable.value[table] || []
}

export function metricBindMetaOf(table) {
  if (!table) return null
  return metaByTable.value[table] || null
}

export function enrichMetricBindPayload(payload = {}) {
  if ((payload.kind || payload.type) !== '原子') return payload
  const meta = metricBindMetaOf(payload.table)
  if (!meta) return payload
  return {
    ...payload,
    gravAssetId: payload.gravAssetId || meta.gravAssetId || meta.assetId || undefined,
    assetId: payload.assetId || meta.assetId || undefined,
  }
}

async function fetchAllAssetRecords(filters) {
  const q = {
    ...filters,
    ws: resolveWs(filters.ws),
    scope: filters.scope || 'workspace',
    status: filters.status,
  }
  return fetchAllPages(({ current, size }) => fetchAssetPage(q, { current, size }), {
    pageSize: BACKEND_PAGE_SIZE_MAX,
    maxPages: 5,
  })
}

/**
 * @param {object} [filters]
 * @param {boolean} [filters.force] 打开表单/登记后强制重拉，避免模块级缓存挡住新资产
 */
export async function ensureMetricBindTables(filters = {}) {
  const ws = resolveWs(filters.ws)
  const force = filters.force === true
  if (!force && tableOptions.value.length && cachedWs === ws) {
    return tableOptions.value
  }
  if (tablesPromise && !force) return tablesPromise
  if (force && tablesPromise) {
    // 等在途请求结束再强制重拉，避免并发写坏缓存
    try {
      await tablesPromise
    } catch {
      /* ignore */
    }
  }

  loadingTables.value = true
  tablesPromise = (async () => {
    try {
      const listFilters = {
        ...filters,
        ws,
        scope: filters.scope || 'workspace',
      }
      delete listFilters.force
      let records = (await fetchAllAssetRecords(listFilters)).filter((r) => {
        const st = String(r.status || 'active').toLowerCase()
        return st !== 'archived' && st !== 'deleted'
      })
      if (filters.kind) {
        const kindFiltered = records.filter((r) => {
          const k = String(r.assetKind || r.kind || 'table').toLowerCase()
          return k === String(filters.kind).toLowerCase() || !k
        })
        if (kindFiltered.length) records = kindFiltered
      }
      const opts = []
      const meta = {}
      let skippedSource = 0
      for (const raw of records) {
        if (!isBindableAsset(raw)) {
          const kind = String(raw.assetKind || 'table').toLowerCase()
          if (TABLE_KINDS.has(kind) || raw.objectName || raw.omFqn || raw.assetCode) {
            skippedSource += 1
          }
          continue
        }
        const opt = mapTableOption(raw)
        if (!opt) continue
        // 同名保留第一条；重复 value 时优先有 grav 指针的
        if (meta[opt.value] && meta[opt.value].gravAssetId && !opt.gravAssetId) continue
        opts.push(opt)
        meta[opt.value] = {
          assetId: opt.assetId,
          gravAssetId: opt.gravAssetId,
          assetCode: opt.assetCode,
          omFqn: opt.omFqn,
          objectName: opt.objectName,
          engine: opt.engine,
        }
      }
      // 去重 value，并按分层 → 表名排序便于浏览
      const seen = new Set()
      const LAYER_ORDER = { ods: 1, dwd: 2, dws: 3, ads: 4, dim: 5 }
      tableOptions.value = opts
        .filter((o) => {
          if (seen.has(o.value)) return false
          seen.add(o.value)
          return true
        })
        .sort((a, b) => {
          const la = LAYER_ORDER[a.layer] ?? 50
          const lb = LAYER_ORDER[b.layer] ?? 50
          if (la !== lb) return la - lb
          return String(a.label).localeCompare(String(b.label), 'zh')
        })
      metaByTable.value = meta
      cachedWs = ws
      if (!tableOptions.value.length && skippedSource > 0) {
        console.info(
          `[metricBind] 空间 ${ws} 有 ${skippedSource} 个源端表资产，已过滤；指标仅可选湖表`,
        )
      }
      bump()
      return tableOptions.value
    } finally {
      loadingTables.value = false
      tablesPromise = null
    }
  })()
  return tablesPromise
}

export async function ensureMetricBindFields(table) {
  const key = String(table || '').trim()
  if (!key) return []
  if (fieldsByTable.value[key]?.length) return fieldsByTable.value[key]
  if (fieldsPromises.has(key)) return fieldsPromises.get(key)

  const p = (async () => {
    loadingFields.value = { ...loadingFields.value, [key]: true }
    try {
      let meta = metaByTable.value[key]
      if (!meta?.assetId) {
        await ensureMetricBindTables()
        meta = metaByTable.value[key]
      }
      if (!meta?.assetId) {
        fieldsByTable.value = { ...fieldsByTable.value, [key]: [] }
        bump()
        return []
      }
      const schema = await fetchAssetSchema(meta.assetId)
      const cols = Array.isArray(schema?.columns) ? schema.columns : []
      const opts = cols.map(mapFieldOption).filter(Boolean)
      fieldsByTable.value = { ...fieldsByTable.value, [key]: opts }
      bump()
      return opts
    } catch (e) {
      console.warn('[metricBind] schema failed', key, e)
      fieldsByTable.value = { ...fieldsByTable.value, [key]: [] }
      bump()
      return []
    } finally {
      const next = { ...loadingFields.value }
      delete next[key]
      loadingFields.value = next
      fieldsPromises.delete(key)
    }
  })()
  fieldsPromises.set(key, p)
  return p
}

/** 打开新建/编辑表单时预热（默认强制刷新，保证刚登记的资产可见） */
export async function warmMetricBindAssets(initialTable, filters = {}) {
  await ensureMetricBindTables({ force: true, ...filters })
  if (initialTable) await ensureMetricBindFields(initialTable)
}

export function metricBindLoadingTables() {
  return loadingTables.value
}
