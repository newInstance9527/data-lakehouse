/**
 * 数据源表字段缓存（previewSchema），供 ETL 上游字段推导使用
 */
import { computed, ref } from 'vue'
import { fetchPreviewSchema } from '@/api/datasource'

/** @type {import('vue').Ref<Record<string, { status: 'idle'|'loading'|'ok'|'err', columns: Array<{table:string,column:string,type:string}> }>>} */
const cache = ref({})
const rev = ref(0)
/** @type {Record<string, Promise<any[]>>} */
const inflight = {}

function tableBase(name) {
  const s = String(name || '').trim()
  if (!s) return ''
  const parts = s.split('.')
  return parts[parts.length - 1].toLowerCase()
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
   * 同步读取缓存中的表字段（未加载则返回 []）
   * @returns {{ name: string, type: string, cn: string, pk: boolean }[]}
   */
  function getTableFields(dsId, tableName) {
    if (!dsId) return []
    const cols = cache.value[dsId]?.columns || []
    if (!cols.length) return []
    const base = tableBase(tableName)
    const out = []
    const seen = new Set()
    cols.forEach((c) => {
      const col = c.column
      if (!col || col === '_preview_failed') return
      const tb = tableBase(c.table)
      // 有表名过滤时：匹配则收；表名缺失（探测未带 table）也收
      if (base && tb && tb !== base) return
      const key = String(col).toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      out.push({
        name: col,
        type: c.type || 'STRING',
        cn: '',
        pk: false,
      })
    })
    // 过滤后为空但源有列：放宽为全量（避免 schema.table 与 TABLE_NAME 不一致导致映射无字段）
    if (!out.length && base) {
      cols.forEach((c) => {
        const col = c.column
        if (!col || col === '_preview_failed') return
        const key = String(col).toLowerCase()
        if (seen.has(key)) return
        seen.add(key)
        out.push({ name: col, type: c.type || 'STRING', cn: '', pk: false })
      })
    }
    return out
  }

  function getDsFields(dsId, tableNames = []) {
    const tables = (tableNames || []).filter(Boolean)
    if (!tables.length) {
      const cols = cache.value[dsId]?.columns || []
      const seen = new Set()
      const out = []
      cols.forEach((c) => {
        const col = c.column
        if (!col) return
        const key = String(col).toLowerCase()
        if (seen.has(key)) return
        seen.add(key)
        out.push({ name: col, type: c.type || 'STRING', cn: '', pk: false })
      })
      return out
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
    getTableFields,
    getDsFields,
    schemaStatus,
  }
}
