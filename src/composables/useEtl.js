import { computed, ref } from 'vue'
import {
  NODE_TYPES,
  cloneTasks,
  defaultConfFor,
  mergeConfDefaults,
  uid,
} from '@/data/etl'
import { createTrialRun, seedTaskLogs } from '@/utils/etlRuns'

const tasks = ref(cloneTasks().map(ensureLogs))
const currentId = ref(tasks.value[0]?.id || '')
const selNodeId = ref(null)
const selEdgeIdx = ref(null)
const connectFrom = ref(null) // node id waiting for target
const forceCfgTab = ref(null) // 'runs' | null

function ensureLogs(task) {
  if (!task.logs || !task.logs.length) {
    task.logs = seedTaskLogs(task)
  }
  return task
}

export function useEtl() {
  const taskList = computed(() => tasks.value)
  const current = computed(() => tasks.value.find((t) => t.id === currentId.value) || null)
  const selectedNode = computed(() => {
    const t = current.value
    if (!t || !selNodeId.value) return null
    return t.nodes.find((n) => n.id === selNodeId.value) || null
  })

  function selectTask(id) {
    currentId.value = id
    selNodeId.value = null
    selEdgeIdx.value = null
    connectFrom.value = null
  }

  function selectNode(id) {
    selNodeId.value = id
    selEdgeIdx.value = null
    const t = current.value
    const n = t?.nodes?.find((x) => x.id === id)
    if (n) n.conf = mergeConfDefaults(n.type, n.conf)
  }

  function selectEdge(idx) {
    selEdgeIdx.value = idx
    selNodeId.value = null
  }

  function clearSelection() {
    selNodeId.value = null
    selEdgeIdx.value = null
    connectFrom.value = null
  }

  function createTask(payload = {}) {
    const id = uid('dag')
    const row = {
      id,
      name: payload.name || `dag.new_${id.slice(-4)}`,
      desc: payload.desc || '新建 ETL 任务',
      cron: payload.cron || '0 2 * * *',
      owner: payload.owner || '当前用户',
      status: 'draft',
      ver: 'v0.1',
      env: payload.env || 'dev',
      engine: payload.engine || 'flink',
      sla: payload.sla || '06:00',
      nodes: [],
      edges: [],
      logs: [],
    }
    tasks.value.unshift(row)
    selectTask(id)
    return row
  }

  function trialRun(note) {
    const t = current.value
    if (!t) return null
    if (!t.logs) t.logs = []
    const row = createTrialRun(t, { status: 'RUNNING', note: note || 'TEST 环境试跑提交' })
    t.logs.unshift(row)
    // 节点状态：前几个 running/done，其余 pending
    t.nodes.forEach((n, i) => {
      if (i === 0) n.status = 'running'
      else n.status = 'pending'
    })
    forceCfgTab.value = 'runs'
    clearSelection()
    return row
  }

  function openRunsTab() {
    forceCfgTab.value = 'runs'
    clearSelection()
  }

  function clearForceCfgTab() {
    forceCfgTab.value = null
  }

  function updateTaskMeta(patch) {
    const t = current.value
    if (!t) return
    Object.assign(t, patch)
  }

  function addNode(type, pos = {}) {
    const t = current.value
    if (!t) return null
    const def = NODE_TYPES[type]
    if (!def) return null
    const node = {
      id: uid('n'),
      type,
      name: def.label,
      meta: '',
      x: pos.x ?? 80 + (t.nodes.length % 4) * 40,
      y: pos.y ?? 80 + (t.nodes.length % 5) * 36,
      status: 'pending',
      conf: mergeConfDefaults(type, defaultConfFor(type)),
    }
    t.nodes.push(node)
    selectNode(node.id)
    return node
  }

  function moveNode(id, x, y) {
    const t = current.value
    if (!t) return
    const n = t.nodes.find((x0) => x0.id === id)
    if (!n) return
    n.x = Math.max(0, x)
    n.y = Math.max(0, y)
  }

  function patchNode(id, patch) {
    const t = current.value
    if (!t) return
    const n = t.nodes.find((x) => x.id === id)
    if (!n) return
    if (patch.conf) {
      const next = { ...(n.conf || {}) }
      Object.entries(patch.conf).forEach(([k, v]) => {
        if (
          v &&
          typeof v === 'object' &&
          !Array.isArray(v) &&
          next[k] &&
          typeof next[k] === 'object' &&
          !Array.isArray(next[k])
        ) {
          next[k] = { ...next[k], ...v }
        } else {
          next[k] = v
        }
      })
      n.conf = next
      const { conf, ...rest } = patch
      Object.assign(n, rest)
    } else {
      Object.assign(n, patch)
    }
  }

  function removeNode(id) {
    const t = current.value
    if (!t) return
    t.nodes = t.nodes.filter((n) => n.id !== id)
    t.edges = t.edges.filter((e) => e.from !== id && e.to !== id)
    if (selNodeId.value === id) selNodeId.value = null
    if (connectFrom.value === id) connectFrom.value = null
  }

  function beginConnect(fromId) {
    connectFrom.value = fromId
  }

  function completeConnect(toId) {
    const t = current.value
    const fromId = connectFrom.value
    connectFrom.value = null
    if (!t || !fromId || !toId || fromId === toId) return false
    const exists = t.edges.some((e) => e.from === fromId && e.to === toId)
    if (exists) return false
    t.edges.push({ from: fromId, to: toId })
    return true
  }

  function cancelConnect() {
    connectFrom.value = null
  }

  function removeEdge(idx) {
    const t = current.value
    if (!t || idx < 0 || idx >= t.edges.length) return
    t.edges.splice(idx, 1)
    if (selEdgeIdx.value === idx) selEdgeIdx.value = null
  }

  function validateCurrent() {
    const t = current.value
    if (!t) return { ok: false, messages: ['未选择任务'] }
    const messages = []
    if (!t.nodes.length) messages.push('画布尚无节点')
    const ids = new Set(t.nodes.map((n) => n.id))
    t.edges.forEach((e, i) => {
      if (!ids.has(e.from) || !ids.has(e.to)) messages.push(`连线 #${i + 1} 指向不存在的节点`)
    })
    const sources = t.nodes.filter((n) => (NODE_TYPES[n.type]?.group || '') === 'source')
    const sinks = t.nodes.filter((n) => (NODE_TYPES[n.type]?.group || '') === 'sink')
    if (!sources.length) messages.push('至少需要 1 个数据源节点')
    if (!sinks.length) messages.push('至少需要 1 个目标节点')
    return { ok: messages.length === 0, messages: messages.length ? messages : ['校验通过：节点与连线完整'] }
  }

  return {
    tasks,
    taskList,
    currentId,
    current,
    selNodeId,
    selEdgeIdx,
    connectFrom,
    selectedNode,
    forceCfgTab,
    selectTask,
    selectNode,
    selectEdge,
    clearSelection,
    createTask,
    updateTaskMeta,
    addNode,
    moveNode,
    patchNode,
    removeNode,
    beginConnect,
    completeConnect,
    cancelConnect,
    removeEdge,
    validateCurrent,
    trialRun,
    openRunsTab,
    clearForceCfgTab,
  }
}
