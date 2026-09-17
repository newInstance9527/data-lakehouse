import { computed, ref } from 'vue'
import { useEtl } from '@/composables/useEtl'
import { useDatasources } from '@/composables/useDatasources'
import { useAssets } from '@/composables/useAssets'
import { fieldsFromAsset } from '@/utils/etlFields'
import { parseEtlLineage } from '@/utils/etlLineage'

const lastParsedAt = ref('')
const snapshot = ref(null)

const EMPTY = {
  tables: [],
  tableEdges: [],
  fieldEdges: [],
  records: [],
  stats: { tables: 0, tableEdges: 0, fieldEdges: 0, tasks: 0, explicit: 0, inferred: 0 },
}

export function useLineage() {
  const { taskList } = useEtl()
  const { getSource } = useDatasources()
  const { findAsset } = useAssets()

  function rebuild() {
    const graph = parseEtlLineage(taskList.value || [], {
      getSource,
      findAsset,
      fieldsFromAsset,
    })
    snapshot.value = graph
    lastParsedAt.value = new Date().toLocaleString()
    return graph
  }

  if (!snapshot.value) rebuild()

  const graph = computed(() => snapshot.value || EMPTY)

  const tables = computed(() => graph.value.tables || [])
  const tableEdges = computed(() => graph.value.tableEdges || [])
  const fieldEdges = computed(() => graph.value.fieldEdges || [])
  const records = computed(() => graph.value.records || [])
  const stats = computed(() => graph.value.stats || {})

  function findTable(key) {
    const q = String(key || '').trim()
    if (!q) return null
    return (
      tables.value.find((t) => t.id === q || t.key === q || t.assetId === q) ||
      tables.value.find((t) => t.key.endsWith('.' + q) || t.fullName === q) ||
      null
    )
  }

  return {
    graph,
    tables,
    tableEdges,
    fieldEdges,
    records,
    stats,
    lastParsedAt,
    rebuild,
    findTable,
  }
}
