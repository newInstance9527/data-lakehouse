/**
 * 数据源表字段缓存：按表精确拉 meta/columns，避免 previewSchema 全库并集污染映射
 */
import { computed, ref } from 'vue'
import { fetchMetaColumns, fetchPreviewSchema } from '@/api/datasource'

/** @type {import('vue').Ref<Record<string, { status: 'idle'|'loading'|'ok'|'err', columns: Array<{table:string,column:string,type:string}> }>>} */
const cache = ref({})
/** dsId::schema::table → columns */
const tableCache = ref({})
const rev = ref(0)
/** @type {Record<string, Promise<any[]>>} */
const inflight = {}
/** @type {Record<string, Promise<any[]>>} */
const tableInflight = {}

function tableBase(name) {
  const s = String(name || '').trim()
  if (!s) return ''
  const parts = s.split('.')
  return parts[parts.length - 1].toLowerCase()
}

/**
 * 解析 JDBC/元数据用的 schema + table。
 * 只做「schema.table」拆分，禁止用 ods_ds_* 等门户编码猜物理表——易误伤含下划线的真表名。
 * ETL conf.table 必须是绑定数据源清单中的物理名（ig_ds_table / Grav 表名）。
 */
export function resolvePhysicalTable(tableName) {
  const raw = String(tableName || '').trim()
  if (!raw) return { schema: '', table: '', base: '' }
  const parts = raw.split('.').filter(Boolean)
  const table = parts[parts.length - 1] || ''
  const schema = parts.length >= 2 ? parts[parts.length - 2] : ''
  const base = table.toLowerCase()
  return { schema, table, base }
}

function tableKey(dsId, schema, table) {
  return `${dsId}::${schema || ''}::${table || ''}`
}

function colsToFields(cols, tableHint = '') {
  const out = []
  const seen = new Set()
  ;(cols || []).forEach((c) => {
    const col = c.column || c.name
    if (!col || col === '_preview_failed') return
    const key = String(col).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      name: col,
      type: c.type || 'STRING',
      cn: c.remarks || c.cn || '',
      pk: false,
      table: c.table || tableHint || '',
    })
  })
  return out
}

export function useDsSchema() {
  const schemaRev = computed(() => rev.value)

  async function ensureSchema(dsId) {
    if (!dsId) return []
    const hit = cache.value[dsId]
    if (hit?.status === 'ok') return hit.columns || []
    if (inflight[dsId]) return inflight[dsId]

    cache.value = {
      ...cache.value,
      [dsId]: { status: 'loading', columns: hit?.columns || [] },
    }

    inflight[dsId] = (async () => {
      try {
        const res = await fetchPreviewSchema(dsId)
        const cols = (Array.isArray(res?.columns) ? res.columns : [])
          .filter((c) => c?.column || c?.name)
          .map((c) => ({
            table: c.table || '',
            column: c.column || c.name,
            type: c.type || 'STRING',
          }))
        cache.value = {
          ...cache.value,
          [dsId]: { status: 'ok', columns: cols },
        }
        rev.value += 1
        return cols
      } catch (e) {
        console.warn('[etl] ensureSchema failed', dsId, e)
        cache.value = {
          ...cache.value,
          [dsId]: { status: 'err', columns: [] },
        }
        rev.value += 1
        return []
      } finally {
        delete inflight[dsId]
      }
    })()

    return inflight[dsId]
  }

  /**
   * 按选中表精确拉取列（meta/columns），写入 tableCache
   */
  async function ensureTableFields(dsId, tableName) {
    if (!dsId || !tableName) return []
    const { schema, table, base } = resolvePhysicalTable(tableName)
    if (!table && !base) return []
    const key = tableKey(dsId, schema, table || base)
    const hit = tableCache.value[key]
    if (hit?.status === 'ok') return hit.columns || []
    if (tableInflight[key]) return tableInflight[key]

    tableCache.value = {
      ...tableCache.value,
      [key]: { status: 'loading', columns: hit?.columns || [] },
    }

    tableInflight[key] = (async () => {
      try {
        const raw = await fetchMetaColumns(dsId, schema || undefined, table || base)
        const list = Array.isArray(raw) ? raw : raw?.records || raw?.columns || []
        const cols = list
          .filter((c) => c?.name || c?.column)
          .map((c) => ({
            table: tableName,
            column: c.name || c.column,
            type: c.type || 'STRING',
            remarks: c.remarks || '',
          }))
        tableCache.value = {
          ...tableCache.value,
          [key]: { status: 'ok', columns: cols },
        }
        rev.value += 1
        return cols
      } catch (e) {
        console.warn('[etl] ensureTableFields failed', dsId, tableName, e)
        // 回落：从 previewSchema 严格按表过滤（禁止全库并集）
        await ensureSchema(dsId)
        const filtered = filterPreviewColumns(dsId, tableName)
        tableCache.value = {
          ...tableCache.value,
          [key]: { status: filtered.length ? 'ok' : 'err', columns: filtered },
        }
        rev.value += 1
        return filtered
      } finally {
        delete tableInflight[key]
      }
    })()

    return tableInflight[key]
  }

  function filterPreviewColumns(dsId, tableName) {
    const cols = cache.value[dsId]?.columns || []
    if (!cols.length) return []
    const { base } = resolvePhysicalTable(tableName)
    if (!base) return []
    const matched = []
    const seen = new Set()
    cols.forEach((c) => {
      const col = c.column
      if (!col || col === '_preview_failed') return
      const tb = tableBase(c.table)
      // 仅精确匹配末段表名；禁止无 table / 别名猜测
      if (!tb || tb !== base) return
      const key = String(col).toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      matched.push({
        table: c.table || tableName,
        column: col,
        type: c.type || 'STRING',
      })
    })
    return matched
  }

  /**
   * 同步读取：优先按表缓存，否则严格过滤 preview；绝不回退全库列
   */
  function getTableFields(dsId, tableName) {
    if (!dsId || !tableName) return []
    const { schema, table, base } = resolvePhysicalTable(tableName)
    const key = tableKey(dsId, schema, table || base)
    const precise = tableCache.value[key]
    if (precise?.status === 'ok' && precise.columns?.length) {
      return colsToFields(precise.columns, tableName)
    }
    const filtered = filterPreviewColumns(dsId, tableName)
    if (filtered.length) return colsToFields(filtered, tableName)
    return []
  }

  function getDsFields(dsId, tableNames = []) {
    const tables = (tableNames || []).filter(Boolean)
    if (!tables.length) {
      // 未选表：不再返回全库并集，避免映射出现数百幽灵字段
      return []
    }
    const list = []
    tables.forEach((t) => list.push(...getTableFields(dsId, t)))
    const map = new Map()
    list.forEach((f) => {
      if (f?.name && !map.has(f.name)) map.set(f.name, f)
    })
    return [...map.values()]
  }

  function schemaStatus(dsId) {
    return cache.value[dsId]?.status || 'idle'
  }

  return {
    schemaRev,
    ensureSchema,
    ensureTableFields,
    getTableFields,
    getDsFields,
    schemaStatus,
    resolvePhysicalTable,
  }
}
