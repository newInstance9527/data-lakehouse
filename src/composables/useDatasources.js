import { computed, ref } from 'vue'
import { DATA_SOURCES } from '@/data/datasources'
import {
  joinSchemaList,
  mockSyncTables,
  resolveTables,
  tablesToSchema,
} from '@/utils/schemaList'

const sources = ref(DATA_SOURCES.map((s) => ({ ...s })))

export function useDatasources() {
  const list = computed(() => sources.value)

  function getSource(id) {
    return sources.value.find((s) => s.id === id) || null
  }

  function updateSource(id, patch) {
    const idx = sources.value.findIndex((s) => s.id === id)
    if (idx < 0) return null
    const next = { ...sources.value[idx], ...patch }
    if (patch.tables) {
      next.schema = tablesToSchema(patch.tables)
    } else if (patch.schema != null && !patch.tables) {
      next.tables = resolveTables({ ...next, tables: undefined })
    }
    sources.value[idx] = next
    return sources.value[idx]
  }

  function upsertSource(payload) {
    const idx = sources.value.findIndex((s) => s.id === payload.id)
    const tables =
      payload.tables ||
      resolveTables({
        schema: payload.schema || payload.topics || payload.queues || '',
        type: payload.type,
      })
    const row = {
      ...payload,
      tables,
      schema: tablesToSchema(tables) || payload.schema || '',
    }
    if (idx >= 0) {
      sources.value[idx] = { ...sources.value[idx], ...row }
      return sources.value[idx]
    }
    sources.value.unshift(row)
    return row
  }

  function ensureTables(id) {
    const s = getSource(id)
    if (!s) return []
    if (Array.isArray(s.tables) && s.tables.length) return s.tables
    const tables = resolveTables(s)
    updateSource(id, { tables, schema: tablesToSchema(tables) || s.schema })
    return getSource(id)?.tables || tables
  }

  function setTables(id, tables) {
    return updateSource(id, {
      tables,
      schema: tablesToSchema(tables),
    })
  }

  function syncTables(id, fieldName = 'schema') {
    const s = getSource(id)
    if (!s) return null
    const existing = ensureTables(id)
    const mocked = mockSyncTables(s.type, fieldName, s.database || s.name)
    const byName = new Map(existing.map((t) => [t.name, t]))
    mocked.forEach((t) => {
      if (!byName.has(t.name)) byName.set(t.name, t)
    })
    const tables = [...byName.values()]
    return setTables(id, tables)
  }

  function addTable(id, item) {
    const tables = [...ensureTables(id)]
    if (tables.some((t) => t.name === item.name)) return { ok: false, reason: 'exists' }
    tables.push(item)
    setTables(id, tables)
    return { ok: true, tables }
  }

  function removeTable(id, name) {
    const tables = ensureTables(id).filter((t) => t.name !== name)
    setTables(id, tables)
    return tables
  }

  function patchTable(id, name, patch) {
    const tables = ensureTables(id).map((t) => (t.name === name ? { ...t, ...patch } : t))
    setTables(id, tables)
    return tables
  }

  return {
    sources,
    list,
    getSource,
    updateSource,
    upsertSource,
    ensureTables,
    setTables,
    syncTables,
    addTable,
    removeTable,
    patchTable,
    joinSchemaList,
  }
}
