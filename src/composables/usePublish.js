import { ref } from 'vue'
import {
  createRelease,
  fetchReleaseGates,
  fetchReleases,
  fetchScriptTree,
  publishRelease,
  rollbackRelease,
} from '@/api/compute'
import { ensureOnce } from '@/composables/useEnsureSamples'
import { SAMPLE_RELEASE } from '@/data/sampleSeeds'

const items = ref([])
const focusId = ref('')
const loaded = ref(false)

function firstScriptId(nodes, depth = 0) {
  if (!Array.isArray(nodes) || depth > 8) return null
  for (const n of nodes) {
    if (n?.id && (n.type === 'file' || n.kind === 'file' || n.scriptId || n.leaf)) {
      return n.scriptId || n.id
    }
    const kids = n?.children || n?.nodes || n?.files
    const hit = firstScriptId(kids, depth + 1)
    if (hit) return hit
  }
  return null
}

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

    await ensureOnce(
      'publish_sample_release',
      async () => {
        if (items.value.length > 0) return false
        const tree = await fetchScriptTree(ws).catch(() => null)
        const nodes = Array.isArray(tree) ? tree : tree?.children || tree?.nodes || []
        return !!firstScriptId(nodes)
      },
      async () => {
        const tree = await fetchScriptTree(ws)
        const nodes = Array.isArray(tree) ? tree : tree?.children || tree?.nodes || []
        const scriptId = firstScriptId(nodes)
        if (!scriptId) throw new Error('无开发脚本，跳过发布示例')
        await createRelease({
          ...SAMPLE_RELEASE,
          scriptId,
          ws: ws || 'default',
        })
      },
      async () => {
        const again = await fetchReleases(ws)
        items.value = Array.isArray(again) ? again : []
      },
    )

    const current = items.value.find((r) => r.id === focusId.value) || items.value[0]
    applyFocus(current)
    if (current?.id) {
      try {
        const fresh = await fetchReleaseGates(current.id)
        if (fresh) {
          items.value = items.value.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r))
          applyFocus(items.value.find((r) => r.id === fresh.id) || fresh)
        }
      } catch {
        /* keep list gates */
      }
    }
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

  async function select(row) {
    applyFocus(row)
    if (!row?.id) return
    try {
      const fresh = await fetchReleaseGates(row.id)
      if (fresh) {
        items.value = items.value.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r))
        applyFocus(items.value.find((r) => r.id === fresh.id) || fresh)
      }
    } catch {
      /* keep */
    }
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
