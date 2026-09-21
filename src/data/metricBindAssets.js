/**
 * 指标原子绑定 · 资产目录表/字段选项（gov_asset + Grav/OM schema）
 */
import { ref, shallowRef } from 'vue'
import { fetchAssetPage, fetchAssetSchema } from '@/api/catalog'

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
const fieldsPromises = new Map()

const TABLE_KINDS = new Set(['table', 'iceberg', 'hive', 'view', ''])

function bump() {
  metricBindRev.value += 1
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
  return vo.layerLabel || vo.layer || '—'
}

function domainLabelOf(vo) {
  return vo.domainLabel || vo.domainCode || vo.domain || '—'
}

function mapTableOption(vo) {
  const value = bindTableKeyOf(vo)
  if (!value) return null
  const name = vo.cnName || vo.name || vo.assetCode || value
  const layer = layerLabelOf(vo)
  const domain = domainLabelOf(vo)
  return {
    value,
    label: `${value} · ${layer}/${domain} · ${name}`,
    sub: `${vo.assetCode || ''} · ${vo.engine || vo.assetKind || 'table'}`.trim(),
    name,
    assetCode: vo.assetCode || vo.key || '',
    assetId: vo.id,
    gravAssetId: vo.gravAssetId || '',
    omFqn: vo.omFqn || '',
    objectName: vo.objectName || vo.tableName || '',
    search: [value, name, vo.assetCode, layer, domain, vo.omFqn].filter(Boolean).join(' '),
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
  if (TABLE_KINDS.has(kind)) return true
  // 未标 kind 但有对象名的也允许
  return !!(vo.objectName || vo.omFqn || vo.assetCode)
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

export async function ensureMetricBindTables(filters = {}) {
  if (tableOptions.value.length) return tableOptions.value
  if (tablesPromise) return tablesPromise
  loadingTables.value = true
  tablesPromise = (async () => {
    try {
      const page = await fetchAssetPage(
        { ...filters, status: filters.status },
        { current: 1, size: 500 },
      )
      let records = (page?.records || []).filter((r) => {
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
      for (const raw of records) {
        if (!isBindableAsset(raw)) continue
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
        }
      }
      // 去重 value
      const seen = new Set()
      tableOptions.value = opts.filter((o) => {
        if (seen.has(o.value)) return false
        seen.add(o.value)
        return true
      })
      metaByTable.value = meta
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

/** 打开新建/编辑表单时预热 */
export async function warmMetricBindAssets(initialTable) {
  await ensureMetricBindTables()
  if (initialTable) await ensureMetricBindFields(initialTable)
}

export function metricBindLoadingTables() {
  return loadingTables.value
}
