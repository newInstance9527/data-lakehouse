/**
 * ETL 编排：对接 /lh/etl（门户图 SoT；本地编辑，保存/校验/试跑/发布走后端）
 */
import { computed, ref } from 'vue'
import {
  backfillEtlDag,
  createEtlDag,
  deleteEtlDag,
  deployEtlDag,
  editEtlDag,
  fetchEtlDags,
  fetchEtlGraph,
  fetchEtlRunDetail,
  fetchEtlRuns,
  saveEtlGraph,
  trialEtlDag,
  validateEtlDag,
} from '@/api/etl'
import {
  NODE_TYPES,
  defaultConfFor,
  mergeConfDefaults,
  uid,
} from '@/data/etl'
import { formatNow } from '@/utils/etlRuns'
import { useSession } from '@/composables/useSession'

const tasks = ref([])
const currentId = ref('')
const selNodeId = ref(null)
const selEdgeIdx = ref(null)
const connectFrom = ref(null)
const forceCfgTab = ref(null)
const loading = ref(false)
const loaded = ref(false)
const lastError = ref(null)
const saving = ref(false)
let loadPromise = null

function mapRunStatus(st) {
  const s = String(st || '').toLowerCase()
  if (s === 'success' || s === 'done') return 'SUCCESS'
  if (s === 'failed' || s === 'error' || s === 'blocked') return 'ERROR'
  if (s === 'running') return 'RUNNING'
  if (s === 'submitted' || s === 'pending') return 'RUNNING'
  return String(st || 'PENDING').toUpperCase()
}

function fmtTs(v) {
  if (!v) return '—'
  if (typeof v === 'string') return v.replace('T', ' ').slice(0, 19)
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  } catch {
    return String(v)
  }
}

function normalizeRun(row) {
  if (!row) return null
  const status = mapRunStatus(row.status)
  const runId = row.runId || row.run
  return {
    run: runId,
    status,
    start: fmtTs(row.startedAt || row.start),
    end: row.finishedAt || row.end ? fmtTs(row.finishedAt || row.end) : status === 'RUNNING' ? '—' : '—',
    duration: row.duration || (status === 'RUNNING' ? '进行中' : '—'),
    note: row.message || row.note || '',
    trigger: row.trigger || row.triggerType || 'manual',
    env: row.env || 'stg',
    dsRunId: row.dsRunId,
    opsPath:
      row.opsPath ||
      (runId ? `/ops?runId=${runId}${row.dagId ? `&dagId=${row.dagId}` : ''}` : ''),
    alert: row.alert,
    raw: row,
    runNodes: row.nodes || row.runNodes,
  }
}

function normalizeDag(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name || row.dagCode,
    dagCode: row.dagCode,
    desc: row.description || row.desc || '',
    cron: row.cron || '0 2 * * *',
    owner: row.owner || '',
    ownerName: row.ownerName || '',
    createUser: row.createUser || '',
    createUserName: row.createUserName || '',
    status: row.status || 'draft',
    ver: row.ver || 'v0.1',
    env: row.env || 'dev',
    engine: row.defaultEngine || row.engine || 'flink',
    sla: row.sla || '',
    dsWorkflowCode: row.dsWorkflowCode,
    nodes: Array.isArray(row.nodes) ? row.nodes : [],
    edges: Array.isArray(row.edges) ? row.edges : [],
    logs: Array.isArray(row.logs) ? row.logs : [],
    dirty: false,
  }
}

function normalizeNode(n) {
  if (!n) return null
  const type = n.type || n.nodeType
  const id = n.id || n.nodeKey
  let conf = n.conf
  if (typeof conf === 'string') {
    try {
      conf = JSON.parse(conf)
    } catch {
      conf = {}
    }
  }
  if (!conf || typeof conf !== 'object' || Array.isArray(conf)) conf = {}
  const x = Number(n.x ?? n.posX ?? 0)
  const y = Number(n.y ?? n.posY ?? 0)
  return {
    id,
    type,
    name: n.name || NODE_TYPES[type]?.label || id,
    meta: n.meta || '',
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    status: n.status || 'pending',
    conf: mergeConfDefaults(type, conf),
    resolvedEngine: n.resolvedEngine,
  }
}

function normalizeEdge(e) {
  return {
    from: e.from || e.fromNodeKey,
    to: e.to || e.toNodeKey,
    label: e.label || '',
  }
}

function applyGraph(task, graph) {
  if (!task || !graph) return task
  if (graph.dag) {
    const head = normalizeDag(graph.dag)
    Object.assign(task, {
      name: head.name,
      dagCode: head.dagCode,
      desc: head.desc,
      cron: head.cron,
      owner: head.owner,
      status: head.status,
      ver: head.ver,
      env: head.env,
      engine: head.engine,
      sla: head.sla,
      dsWorkflowCode: head.dsWorkflowCode,
    })
  }
  task.nodes = (graph.nodes || []).map(normalizeNode).filter(Boolean)
  task.edges = (graph.edges || []).map(normalizeEdge).filter((e) => e.from && e.to)
  task.dirty = false
  return task
}

function markDirty() {
  const t = tasks.value.find((x) => x.id === currentId.value)
  if (t) t.dirty = true
}

export function useEtl() {
  const { user } = useSession()
  const taskList = computed(() => tasks.value)
  const current = computed(() => tasks.value.find((t) => t.id === currentId.value) || null)
  const selectedNode = computed(() => {
    const t = current.value
    if (!t || !selNodeId.value) return null
    return t.nodes.find((n) => n.id === selNodeId.value) || null
  })

  async function loadList(filters = {}) {
    loading.value = true
    lastError.value = null
    try {
      const page = await fetchEtlDags(filters, { current: 1, size: 100 })
      const records = (page?.records || []).map(normalizeDag).filter(Boolean)
      const prevId = currentId.value
      const byId = new Map(tasks.value.map((t) => [t.id, t]))
      tasks.value = records.map((r) => {
        const old = byId.get(r.id)
        if (old && old.dirty) {
          return { ...r, nodes: old.nodes, edges: old.edges, logs: old.logs, dirty: true }
        }
        return {
          ...r,
          nodes: old?.nodes || [],
          edges: old?.edges || [],
          logs: old?.logs || [],
        }
      })
      loaded.value = true
      const prefer = tasks.value.find((t) => t.id === prevId) || tasks.value[0]
      if (prefer) {
        await selectTask(prefer.id, { force: !prefer.nodes?.length })
      } else {
        currentId.value = ''
      }
      return tasks.value
    } catch (e) {
      lastError.value = e
      console.error('[etl] loadList failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function ensureLoaded() {
    if (loaded.value || loading.value || loadPromise) return loadPromise
    loadPromise = loadList()
      .catch(() => {})
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  async function loadGraph(id) {
    if (!id) return null
    const graph = await fetchEtlGraph(id)
    const t = tasks.value.find((x) => x.id === id)
    if (t) applyGraph(t, graph)
    return graph
  }

  async function selectTask(id, { force = false } = {}) {
    currentId.value = id
    selNodeId.value = null
    selEdgeIdx.value = null
    connectFrom.value = null
    const t = tasks.value.find((x) => x.id === id)
    if (!t) return
    if (force || !t.nodes?.length) {
      try {
        await loadGraph(id)
      } catch (e) {
        lastError.value = e
        console.error('[etl] loadGraph failed', e)
      }
    }
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
    // 不在此处清 connectFrom：空白取消走 cancelConnect，避免误清
  }

  async function createTask(payload = {}) {
    const code = payload.dagCode || `dag.new_${uid('x').slice(-4)}`
    const saved = await createEtlDag({
      dagCode: code,
      name: payload.name || payload.title || '新建 ETL 任务',
      description: payload.desc || '新建 ETL 任务',
      cron: payload.cron || '0 2 * * *',
      owner: payload.owner || user.value?.id || '',
      defaultEngine: payload.engine || 'flink',
      sla: payload.sla || '06:00',
      env: payload.env || 'dev',
      ws: payload.ws || undefined,
    })
    const row = normalizeDag(saved)
    row.nodes = []
    row.edges = []
    row.logs = []
    tasks.value.unshift(row)
    await selectTask(row.id, { force: true })
    return row
  }

  /** 软删当前任务；运行中由后端拦截 */
  async function deleteCurrent() {
    const t = current.value
    if (!t) return null
    const running = (t.logs || []).some((l) => {
      const s = String(l.status || '').toUpperCase()
      return s === 'RUNNING' || s === 'SUBMITTED' || s === 'PENDING'
    })
    if (running) {
      throw new Error('任务运行中，请等待完成后再删除')
    }
    saving.value = true
    lastError.value = null
    try {
      const resp = await deleteEtlDag(t.id)
      const idx = tasks.value.findIndex((x) => x.id === t.id)
      if (idx >= 0) tasks.value.splice(idx, 1)
      selNodeId.value = null
      selEdgeIdx.value = null
      connectFrom.value = null
      const next = tasks.value[Math.min(idx, tasks.value.length - 1)] || tasks.value[0]
      if (next) {
        await selectTask(next.id, { force: !next.nodes?.length })
      } else {
        currentId.value = ''
      }
      return resp
    } catch (e) {
      lastError.value = e
      throw e
    } finally {
      saving.value = false
    }
  }

  async function persistMeta(patch = {}) {
    const t = current.value
    if (!t) return null
    Object.assign(t, patch)
    const saved = await editEtlDag({
      id: t.id,
      description: t.desc,
      cron: t.cron,
      owner: t.owner,
      defaultEngine: t.engine,
      sla: t.sla,
      env: t.env,
      status: patch.status ?? t.status,
    })
    if (saved) {
      t.status = saved.status || t.status
      t.ver = saved.ver || t.ver
      t.engine = saved.defaultEngine || saved.engine || t.engine
      t.dsWorkflowCode = saved.dsWorkflowCode
    }
    return { task: t, dsSchedule: saved?.dsSchedule }
  }

  /** D1：暂停 / 恢复调度（立即写门户 status + DS release） */
  async function setScheduleStatus(status) {
    if (!['draft', 'prod', 'paused'].includes(status)) {
      throw new Error('非法 status')
    }
    return persistMeta({ status })
  }

  /** D3：按水位补数；E7 命中已删分区时可传 confirmReqNo */
  async function backfillCurrent({ markKey, markValue, env, confirmReqNo } = {}) {
    const t = current.value
    if (!t) return null
    if (!markKey || !markValue) {
      throw new Error('请填写 mark_key 与 mark_value')
    }
    const resp = await backfillEtlDag(t.id, {
      markKey,
      markValue,
      env: env || t.env || 'prod',
      confirmReqNo,
    })
    await refreshRuns()
    if (resp?.runId) {
      const detail = await fetchEtlRunDetail(resp.runId).catch(() => null)
      const row = normalizeRun(
        detail || {
          runId: resp.runId,
          status: resp.status,
          message: `补数 ${markKey}=${markValue}`,
          env: resp.env,
          trigger: 'backfill',
          startedAt: formatNow(),
        },
      )
      t.logs = [row, ...(t.logs || []).filter((l) => l.run !== row.run)]
    }
    return resp
  }

  function updateTaskMeta(patch) {
    const t = current.value
    if (!t) return
    Object.assign(t, patch)
    markDirty()
  }

  async function saveCurrent() {
    const t = current.value
    if (!t) return null
    saving.value = true
    lastError.value = null
    try {
      await editEtlDag({
        id: t.id,
        name: t.name,
        description: t.desc,
        cron: t.cron,
        owner: t.owner,
        defaultEngine: t.engine,
        sla: t.sla,
        env: t.env,
        status: t.status,
      })
      const graph = await saveEtlGraph(t.id, {
        nodes: (t.nodes || []).map((n) => ({
          id: n.id,
          type: n.type,
          name: n.name,
          meta: n.meta,
          x: n.x,
          y: n.y,
          conf: n.conf || {},
        })),
        edges: (t.edges || []).map((e) => ({
          from: e.from,
          to: e.to,
          label: e.label || '',
        })),
      })
      applyGraph(t, graph)
      return t
    } catch (e) {
      lastError.value = e
      throw e
    } finally {
      saving.value = false
    }
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
    t.nodes = [...(t.nodes || []), node]
    markDirty()
    selectNode(node.id)
    return node
  }

  function moveNode(id, x, y) {
    const t = current.value
    if (!t) return
    const n = t.nodes.find((x0) => x0.id === id)
    if (!n) return
    const nx = Number(x)
    const ny = Number(y)
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return
    n.x = Math.max(0, Math.round(nx))
    n.y = Math.max(0, Math.round(ny))
    markDirty()
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
    markDirty()
  }

  function removeNode(id) {
    const t = current.value
    if (!t) return
    t.nodes = t.nodes.filter((n) => n.id !== id)
    t.edges = t.edges.filter((e) => e.from !== id && e.to !== id)
    if (selNodeId.value === id) selNodeId.value = null
    if (connectFrom.value === id) connectFrom.value = null
    markDirty()
  }

  function beginConnect(fromId) {
    connectFrom.value = fromId
  }

  function completeConnect(toId) {
    const t = current.value
    const fromId = connectFrom.value
    connectFrom.value = null
    if (!t || !fromId || !toId || fromId === toId) return false
    const from = String(fromId)
    const to = String(toId)
    const exists = (t.edges || []).some((e) => String(e.from) === from && String(e.to) === to)
    if (exists) return false
    // 换新数组，保证画布立刻画出连线（不必等保存回写）
    t.edges = [...(t.edges || []), { from, to, label: '' }]
    markDirty()
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
    markDirty()
  }

  async function validateCurrent() {
    const t = current.value
    if (!t) return { ok: false, messages: ['未选择任务'], issues: [] }
    try {
      await saveCurrent()
      const r = await validateEtlDag(t.id)
      const issues = Array.isArray(r?.issues) ? r.issues : []
      // 失败面板只展示 error/warn；通过类 info 不展示
      const visible = issues.filter((i) => i.level === 'error' || i.level === 'warn')
      const messages = visible.map((i) => {
        const level = i.level === 'error' ? '✗' : '!'
        const ref = i.ref ? `[${i.ref}] ` : ''
        return `${level} ${ref}${i.message || i.msg || '未知问题'}`
      })
      const ok = !!r?.ok
      if (!messages.length) {
        messages.push(ok ? '校验通过：结构与节点参数完整' : (r?.message || '校验未通过（无明细）'))
      }
      const errCount = issues.filter((i) => i.level === 'error').length
      const summary = ok
        ? null
        : `校验未通过（${errCount || visible.length} 项）`
      t.lastValidate = { ok, at: Date.now(), issues, messages, summary }
      return { ok, messages, issues, summary, message: r?.message }
    } catch (e) {
      const msg = e.message || '校验失败'
      t.lastValidate = { ok: false, at: Date.now(), issues: [], messages: [msg], summary: '校验失败' }
      return { ok: false, messages: [msg], issues: [], summary: '校验失败' }
    }
  }

  async function refreshRuns(dagId) {
    const id = dagId || currentId.value
    const t = tasks.value.find((x) => x.id === id)
    if (!t) return []
    try {
      const page = await fetchEtlRuns({ dagId: id, current: 1, size: 50 })
      const list = (page?.records || []).map(normalizeRun).filter(Boolean)
      t.logs = list
      return list
    } catch (e) {
      console.error('[etl] refreshRuns failed', e)
      return t.logs || []
    }
  }

  async function trialRun(note) {
    const t = current.value
    if (!t) return null
    await saveCurrent()
    const resp = await trialEtlDag(t.id, 'stg')
    await refreshRuns(t.id)
    let detail = null
    try {
      if (resp?.runId) {
        detail = await fetchEtlRunDetail(resp.runId)
        // DS 真跑：短轮询回写状态（后端 syncRunFromDs）
        const terminal = new Set(['success', 'failed', 'blocked'])
        for (let i = 0; i < 8 && detail && !terminal.has(String(detail.status || '').toLowerCase()); i++) {
          await new Promise((r) => setTimeout(r, 1500))
          detail = await fetchEtlRunDetail(resp.runId)
        }
        await refreshRuns(t.id)
      }
    } catch {
      /* ignore */
    }
    const row = normalizeRun(detail || { runId: resp?.runId, status: resp?.status, message: note || resp?.message, env: 'stg', trigger: 'manual', startedAt: formatNow() })
    if (row && !t.logs.some((l) => l.run === row.run)) {
      t.logs.unshift(row)
    } else if (row) {
      const idx = t.logs.findIndex((l) => l.run === row.run)
      if (idx >= 0) t.logs[idx] = { ...t.logs[idx], ...row }
    }
    const plan = resp?.plan || []
    const qNodes = resp?.quality?.qualityNodes || []
    const qByKey = Object.fromEntries(qNodes.map((x) => [x.nodeKey, x]))
    const detailNodes = detail?.nodes || []
    const dnByKey = Object.fromEntries(detailNodes.map((x) => [x.nodeKey, x]))
    t.nodes.forEach((n, i) => {
      const p = plan.find((x) => x.nodeKey === n.id)
      if (p?.engine) n.resolvedEngine = p.engine
      const dn = dnByKey[n.id]
      if (dn?.status) {
        const s = String(dn.status).toLowerCase()
        if (s === 'success') n.status = 'done'
        else if (s === 'failed' || s === 'blocked') n.status = s === 'blocked' ? 'blocked' : 'failed'
        else if (s === 'running') n.status = 'running'
        else n.status = 'pending'
        return
      }
      const q = qByKey[n.id]
      if (q) {
        if (q.blocked) n.status = 'blocked'
        else if (q.fail > 0) n.status = 'failed'
        else if (!q.skipped) n.status = 'done'
        else n.status = 'pending'
      } else if (resp?.status === 'failed') {
        n.status = 'pending'
      } else if (resp?.localTrial?.success) {
        n.status = 'done'
      } else {
        n.status = i === 0 ? 'running' : 'pending'
      }
    })
    forceCfgTab.value = 'runs'
    clearSelection()
    return {
      ...row,
      quality: resp?.quality,
      rawStatus: detail?.status || resp?.status,
      rawMessage: detail?.message || resp?.message || row?.message,
      message: detail?.message || resp?.message || row?.message,
      openLineage: resp?.openLineage,
      localTrial: resp?.localTrial,
      ds: resp?.ds,
      dsStart: resp?.dsStart,
      alert: resp?.alert || detail?.alert,
      opsPath: resp?.alert?.opsPath || detail?.opsPath || row?.opsPath,
    }
  }

  async function publishCurrent() {
    const t = current.value
    if (!t) return null
    await saveCurrent()
    const v = await validateEtlDag(t.id)
    if (!v?.ok) {
      const issues = Array.isArray(v?.issues) ? v.issues : []
      const detail =
        v?.message ||
        issues
          .filter((i) => i.level === 'error')
          .map((i) => `${i.ref ? `[${i.ref}] ` : ''}${i.message || ''}`)
          .filter(Boolean)
          .join('；') ||
        '校验未通过'
      t.lastValidate = {
        ok: false,
        at: Date.now(),
        issues,
        messages: issues
          .filter((i) => i.level === 'error' || i.level === 'warn')
          .map((i) => {
            const level = i.level === 'error' ? '✗' : '!'
            const ref = i.ref ? `[${i.ref}] ` : ''
            return `${level} ${ref}${i.message || i.msg || ''}`
          })
          .filter(Boolean)
          .slice(0, 12),
        summary: `校验未通过（${issues.filter((i) => i.level === 'error').length} 项）`,
      }
      throw new Error(`发布失败：${detail}`)
    }
    const resp = await deployEtlDag(t.id)
    t.status = resp?.status || 'prod'
    t.ver = resp?.ver || t.ver
    t.env = 'prod'
    t.dsWorkflowCode = resp?.dsWorkflowCode
    t.dirty = false
    const plan = resp?.plan || []
    t.nodes.forEach((n) => {
      const p = plan.find((x) => x.nodeKey === n.id)
      if (p?.engine) n.resolvedEngine = p.engine
    })
    return resp
  }

  function openRunsTab() {
    forceCfgTab.value = 'runs'
    clearSelection()
  }

  function clearForceCfgTab() {
    forceCfgTab.value = null
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
    loading,
    loaded,
    lastError,
    saving,
    ensureLoaded,
    loadList,
    loadGraph,
    selectTask,
    selectNode,
    selectEdge,
    clearSelection,
    createTask,
    deleteCurrent,
    updateTaskMeta,
    persistMeta,
    setScheduleStatus,
    backfillCurrent,
    saveCurrent,
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
    publishCurrent,
    refreshRuns,
    openRunsTab,
    clearForceCfgTab,
  }
}
