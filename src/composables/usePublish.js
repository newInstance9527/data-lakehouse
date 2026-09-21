import { ref } from 'vue'
import {
  createRelease,
  fetchReleases,
  publishRelease,
  rollbackRelease,
} from '@/api/compute'

const items = ref([])
const focusId = ref('')
const loaded = ref(false)

export function usePublish() {
  const gateList = ref([])
  const focus = ref('')

  function applyFocus(row) {
    if (!row) {
      focus.value = ''
      focusId.value = ''
      gateList.value = []
      return
    }
    focus.value = row.pkg
    focusId.value = row.id
    gateList.value = Array.isArray(row.gates) ? row.gates : []
  }

  async function refresh(ws) {
    const list = await fetchReleases(ws)
    items.value = Array.isArray(list) ? list : []
    loaded.value = true
    const current = items.value.find((r) => r.id === focusId.value) || items.value[0]
    applyFocus(current)
    return items.value
  }

  async function addRelease(body) {
    const row = await createRelease(body)
    items.value = [row, ...items.value.filter((r) => r.id !== row.id)]
    applyFocus(row)
    return row
  }

  async function publish(id) {
    const row = await publishRelease(id || focusId.value)
    items.value = items.value.map((r) => (r.id === row.id ? row : r))
    applyFocus(row)
    return row
  }

  async function rollback(id) {
    const row = await rollbackRelease(id || focusId.value)
    items.value = items.value.map((r) => (r.id === row.id ? row : r))
    applyFocus(row)
    return row
  }

  function select(row) {
    applyFocus(row)
  }

  return {
    items,
    gateList,
    focus,
    focusId,
    loaded,
    refresh,
    addRelease,
    publish,
    rollback,
    select,
  }
}
