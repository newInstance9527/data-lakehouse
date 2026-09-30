<script setup>
import { computed, ref, watch, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import AppDrawer from '@/components/common/AppDrawer.vue'
import { NODE_TYPES } from '@/data/etl'
import { fetchEtlRunDetail, fetchEtlRunNodeLog, fetchEtlRunResultPreview, stopEtlRun } from '@/api/etl'
import { RUN_STATUS_META, buildRunDetail } from '@/utils/etlRuns'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  task: { type: Object, default: null },
})
const emit = defineEmits(['close', 'rerun', 'select-node', 'refresh-runs'])

const router = useRouter()
const { showToast } = useToast()
const kw = ref('')
const statusFilter = ref('ALL')
const triggerFilter = ref('ALL')
const activeRun = ref('')
const detailTab = ref('overview') // overview | nodes | logs
const activeNodeId = ref('')
const detailCache = ref({})

/** 单节点实时日志（DS） */
const nodeLogText = ref('')
const nodeLogMeta = ref(null)
const nodeLogLoading = ref(false)
const nodeLogError = ref('')
const nodeLogLineNum = ref(0)
/** 是否定时续拉 DS 日志；默认关闭，避免一直刷 */
const nodeLogAutoRefresh = ref(false)
/** 新日志到达时是否滚到底 */
const nodeLogAutoFollow = ref(true)
const nodeLogPreRef = ref(null)
let nodeLogPollTimer = null
/** 执行记录 / 运行详情自动刷新（有 RUNNING 才轮询） */
let runStatusPollTimer = null
const RUN_POLL_MS = 4000
const LOG_POLL_MS = 3000
const stopBusy = ref(false)

function isRunStatusActive(st) {
  const s = String(st || '').toUpperCase()
  return s === 'RUNNING' || s === 'SUBMITTED' || s === 'PENDING'
}

function isNodeStatusActive(st) {
  const s = String(st || '').toLowerCase()
  return s === 'running' || s === 'submitted' || s === 'pending'
}

function mapApiRunStatus(st) {
  const s = String(st || '').toLowerCase()
  if (s === 'success' || s === 'done') return 'SUCCESS'
  if (s === 'cancelled' || s === 'canceled' || s === 'killed') return 'CANCELLED'
  if (s === 'failed' || s === 'error' || s === 'blocked') return 'ERROR'
  if (s === 'running' || s === 'submitted' || s === 'pending') return 'RUNNING'
  return String(st || 'PENDING').toUpperCase()
}

function applyRunDetailToCache(runId, d) {
  if (!runId || !d) return
  detailCache.value = {
    ...detailCache.value,
    [runId]: {
      ...(detailCache.value[runId] || {}),
      note: d.message || detailCache.value[runId]?.note || '',
      status: mapApiRunStatus(d.status),
      env: d.env || detailCache.value[runId]?.env,
      trigger: d.trigger || d.triggerType || detailCache.value[runId]?.trigger,
      runNodes: d.nodes || detailCache.value[runId]?.runNodes || [],
      opsPath: d.opsPath || d.alert?.opsPath || detailCache.value[runId]?.opsPath,
      alert: d.alert || detailCache.value[runId]?.alert,
      start: d.startedAt
        ? String(d.startedAt).replace('T', ' ').slice(0, 19)
        : detailCache.value[runId]?.start,
      end: d.finishedAt
        ? String(d.finishedAt).replace('T', ' ').slice(0, 19)
        : detailCache.value[runId]?.end,
      duration:
        detailCache.value[runId]?.duration ||
        (mapApiRunStatus(d.status) === 'RUNNING' ? '进行中' : detailCache.value[runId]?.duration),
    },
  }
  // 同步列表行状态（props.task.logs 可变引用）
  const row = props.task?.logs?.find((l) => l.run === runId)
  if (row) {
    row.status = mapApiRunStatus(d.status)
    if (d.message) row.note = d.message
    if (d.finishedAt) row.end = String(d.finishedAt).replace('T', ' ').slice(0, 19)
    if (d.nodes) row.runNodes = d.nodes
  }
}

/** 目标表结果预览（试跑成功核对） */
const RESULT_PREVIEW_TYPES = new Set(['sink_iceberg', 'sink_ck', 'sink_rdb'])
const previewOpen = ref(false)
const previewLoading = ref(false)
const previewError = ref('')
const previewData = ref(null)
const previewNodeKey = ref('')

const logs = computed(() => props.task?.logs || [])

const kpis = computed(() => {
  const list = logs.value
  const total = list.length
  const ok = list.filter((l) => l.status === 'SUCCESS').length
  const err = list.filter((l) => l.status === 'ERROR').length
  const run = list.filter((l) => l.status === 'RUNNING').length
  const rate = total ? `${Math.round((ok / total) * 100)}%` : '—'
  return { total, ok, err, run, rate, latest: list[0] || null }
})

const filtered = computed(() => {
  const q = kw.value.trim().toLowerCase()
  return logs.value.filter((l) => {
    if (statusFilter.value !== 'ALL' && l.status !== statusFilter.value) return false
    if (triggerFilter.value !== 'ALL' && (l.trigger || 'cron') !== triggerFilter.value) return false
    if (!q) return true
    return `${l.run} ${l.status} ${l.note} ${l.trigger || ''} ${l.env || ''}`.toLowerCase().includes(q)
  })
})

const activeLogRow = computed(() => {
  const base = logs.value.find((l) => l.run === activeRun.value) || filtered.value[0]
  if (!base) return null
  const enriched = detailCache.value[base.run]
  return enriched ? { ...base, ...enriched, runNodes: enriched.runNodes || base.runNodes } : base
})

const detail = computed(() => {
  const row = activeLogRow.value
  if (!row || !props.task) return null
  return buildRunDetail(props.task, row)
})

const activeNode = computed(() => detail.value?.nodes?.find((n) => n.nodeId === activeNodeId.value) || null)

const activeNodeKey = computed(() => {
  const n = activeNode.value
  if (!n) return ''
  const api = activeLogRow.value?.runNodes?.find(
    (x) => (x.nodeKey || x.nodeId) === n.nodeId || x.nodeKey === n.name,
  )
  return api?.nodeKey || n.nodeId || ''
})

const runSucceeded = computed(() => {
  const st = String(activeLogRow.value?.status || '').toUpperCase()
  return st === 'SUCCESS'
})

const previewableSinks = computed(() => {
  if (!runSucceeded.value || !detail.value?.nodes) return []
  return detail.value.nodes.filter((n) => RESULT_PREVIEW_TYPES.has(n.type))
})

const canPreviewActiveNode = computed(() => {
  const n = activeNode.value
  if (!n || !runSucceeded.value) return false
  return RESULT_PREVIEW_TYPES.has(n.type) && (n.status === 'done' || n.status === 'warn')
})

const previewCols = computed(() => {
  const cols = previewData.value?.columns
  if (!Array.isArray(cols)) return []
  return cols.map((c) => (typeof c === 'string' ? c : c?.name || c?.enName || String(c)))
})

const previewRows = computed(() => (Array.isArray(previewData.value?.rows) ? previewData.value.rows : []))

function stopNodeLogPoll() {
  if (nodeLogPollTimer) {
    clearInterval(nodeLogPollTimer)
    nodeLogPollTimer = null
  }
}

function stopRunStatusPoll() {
  if (runStatusPollTimer) {
    clearInterval(runStatusPollTimer)
    runStatusPollTimer = null
  }
}

function hasActiveRuns() {
  const list = props.task?.logs || []
  if (list.some((l) => isRunStatusActive(l.status))) return true
  const active = activeLogRow.value
  if (active && isRunStatusActive(active.status)) return true
  return false
}

async function refreshActiveRunDetail() {
  const runId = activeRun.value || activeLogRow.value?.run
  if (!runId) return null
  try {
    const d = await fetchEtlRunDetail(runId)
    applyRunDetailToCache(runId, d)
    return d
  } catch {
    return null
  }
}

async function tickRunStatusRefresh() {
  if (!props.open) {
    stopRunStatusPoll()
    return
  }
  try {
    emit('refresh-runs')
    // 父级 refresh 异步；本抽屉再拉一次当前 run 详情保证节点时间线更新
    await refreshActiveRunDetail()
  } catch {
    /* soft-fail */
  }
  if (!hasActiveRuns()) {
    stopRunStatusPoll()
    // 节点已终态则停日志轮询
    if (!isNodeStatusActive(activeNode.value?.status || nodeLogMeta.value?.status)) {
      stopNodeLogPoll()
      if (nodeLogAutoRefresh.value) nodeLogAutoRefresh.value = false
    }
  }
}

function startRunStatusPollIfNeeded() {
  if (!props.open || !hasActiveRuns()) {
    stopRunStatusPoll()
    return
  }
  if (runStatusPollTimer) return
  runStatusPollTimer = setInterval(() => {
    tickRunStatusRefresh()
  }, RUN_POLL_MS)
}

function resetNodeLog() {
  stopNodeLogPoll()
  nodeLogText.value = ''
  nodeLogMeta.value = null
  nodeLogError.value = ''
  nodeLogLineNum.value = 0
  nodeLogLoading.value = false
}

async function loadNodeLog({ append = false } = {}) {
  const runId = activeRun.value
  const nodeKey = activeNodeKey.value
  if (!runId || !nodeKey || !props.open) return
  if (nodeLogLoading.value && append) return
  nodeLogLoading.value = true
  nodeLogError.value = ''
  try {
    const skip = append ? nodeLogLineNum.value : 0
    const d = await fetchEtlRunNodeLog(runId, nodeKey, { skipLineNum: skip, limit: 1000 })
    const chunk = String(d?.content ?? '')
    const nextLine = Number(d?.lineNum ?? skip)
    if (append && skip > 0) {
      if (chunk) {
        nodeLogText.value = nodeLogText.value
          ? `${nodeLogText.value}${nodeLogText.value.endsWith('\n') ? '' : '\n'}${chunk}`
          : chunk
      }
    } else {
      nodeLogText.value = chunk || (d?.message ? String(d.message) : '')
    }
    nodeLogLineNum.value = Number.isFinite(nextLine) ? nextLine : skip
    nodeLogMeta.value = {
      ok: d?.ok !== false,
      source: d?.source || 'ds',
      taskInstanceId: d?.taskInstanceId || '',
      degraded: Boolean(d?.degraded),
      status: d?.status || activeNode.value?.status,
      message: d?.message || '',
    }
    if (d?.ok === false && (d?.message || d?.code)) {
      const code = String(d.code || '')
      nodeLogError.value =
        code === 'no_ds_task_instance'
          ? String(d.content || d.message || '暂无 DS 任务实例，无法拉实时日志')
          : String(d.message || d.content || '拉取节点日志失败')
    }
    if (nodeLogAutoFollow.value) {
      await nextTick()
      const el = nodeLogPreRef.value
      if (el) el.scrollTop = el.scrollHeight
    }
    // 节点已结束：关掉自动刷新
    if (!isNodeStatusActive(nodeLogMeta.value?.status || activeNode.value?.status)) {
      stopNodeLogPoll()
      if (nodeLogAutoRefresh.value) nodeLogAutoRefresh.value = false
    }
  } catch (e) {
    nodeLogError.value = e?.message || '拉取节点日志失败'
  } finally {
    nodeLogLoading.value = false
  }
}

function startNodeLogPollIfNeeded() {
  if (!nodeLogAutoRefresh.value) {
    stopNodeLogPoll()
    return
  }
  const st = activeNode.value?.status || nodeLogMeta.value?.status
  if (!isNodeStatusActive(st) || detailTab.value !== 'nodes' || !props.open) {
    stopNodeLogPoll()
    return
  }
  if (nodeLogPollTimer) return
  nodeLogPollTimer = setInterval(async () => {
    await loadNodeLog({ append: true })
    const now = activeNode.value?.status || nodeLogMeta.value?.status
    // 节点结束后不再持续刷新
    if (!isNodeStatusActive(now)) {
      stopNodeLogPoll()
      nodeLogAutoRefresh.value = false
    }
  }, LOG_POLL_MS)
}

watch(nodeLogAutoRefresh, (on) => {
  if (on) startNodeLogPollIfNeeded()
  else stopNodeLogPoll()
})

watch(
  () => [props.open, props.task?.id],
  async () => {
    if (!props.open) {
      resetNodeLog()
      stopRunStatusPoll()
      return
    }
    activeRun.value = props.task?.logs?.[0]?.run || ''
    detailTab.value = 'overview'
    activeNodeId.value = ''
    kw.value = ''
    statusFilter.value = 'ALL'
    triggerFilter.value = 'ALL'
    resetNodeLog()
    closeResultPreview()
    emit('refresh-runs')
    await refreshActiveRunDetail()
    startRunStatusPollIfNeeded()
  },
)

watch(detail, (d) => {
  if (d && !d.nodes?.some((n) => n.nodeId === activeNodeId.value)) {
    activeNodeId.value = d.nodes?.[0]?.nodeId || ''
  }
})

watch(activeRun, async (runId) => {
  if (!runId || !props.open) return
  resetNodeLog()
  try {
    const d = await fetchEtlRunDetail(runId)
    if (d) applyRunDetailToCache(runId, d)
  } catch {
    /* soft-fail：抽屉仍用列表摘要 */
  }
  startRunStatusPollIfNeeded()
})

watch(
  () => [activeNodeKey.value, detailTab.value, props.open],
  async ([key, tab, open]) => {
    if (!open || tab !== 'nodes' || !key) {
      stopNodeLogPoll()
      return
    }
    await loadNodeLog({ append: false })
    const st = activeNode.value?.status || nodeLogMeta.value?.status
    if (isNodeStatusActive(st) && nodeLogAutoRefresh.value) {
      startNodeLogPollIfNeeded()
    } else {
      stopNodeLogPoll()
    }
  },
)

/** 列表里出现 RUNNING 时自动开状态轮询；全终态则停 */
watch(
  () => (props.task?.logs || []).map((l) => `${l.run}:${l.status}`).join('|'),
  () => {
    if (!props.open) return
    if (hasActiveRuns()) startRunStatusPollIfNeeded()
    else stopRunStatusPoll()
  },
)

onUnmounted(() => {
  stopNodeLogPoll()
  stopRunStatusPoll()
})

function openRun(run) {
  activeRun.value = run
  detailTab.value = 'overview'
  resetNodeLog()
}

function statusMeta(st) {
  return RUN_STATUS_META[st] || RUN_STATUS_META.PENDING
}

function nodeStatusMeta(st) {
  if (st === 'blocked') return RUN_STATUS_META.ERROR
  if (st === 'cancelled' || st === 'canceled') return RUN_STATUS_META.CANCELLED
  if (st === 'running') return RUN_STATUS_META.RUNNING
  if (st === 'pending') return RUN_STATUS_META.PENDING
  if (st === 'warn') return { label: '告警', tag: 'tag-orange', color: '#fa8c16' }
  return RUN_STATUS_META.SUCCESS
}

function typeLabel(type) {
  return NODE_TYPES[type]?.label || type
}

function levelClass(level) {
  if (level === 'ERROR') return 'err'
  if (level === 'WARN') return 'warn'
  return ''
}

async function copyRunId() {
  const id = detail.value?.run
  if (!id) return
  try {
    await navigator.clipboard.writeText(id)
    showToast('已复制 run_id', 'success')
  } catch {
    showToast(id, 'info')
  }
}

async function onStopRun() {
  const runId = detail.value?.run
  if (!runId || stopBusy.value) return
  const st = String(detail.value?.status || '').toUpperCase()
  if (st !== 'RUNNING' && st !== 'PENDING' && st !== 'SUBMITTED') {
    showToast('当前运行已终态', 'info')
    return
  }
  stopBusy.value = true
  try {
    const resp = await stopEtlRun(runId)
    applyRunDetailToCache(runId, {
      ...(detailCache.value[runId] || {}),
      status: resp?.status || 'cancelled',
      message: resp?.message,
      finishedAt: resp?.finishedAt || new Date().toISOString(),
    })
    const deg = resp?.dsStop?.degraded
    showToast(deg ? '已终止（DS 调度降级，门户已收口）' : '已终止运行', deg ? 'warning' : 'success')
    emit('refresh-runs')
    await refreshActiveRunDetail()
  } catch (e) {
    showToast(e?.message || '终止失败', 'error')
  } finally {
    stopBusy.value = false
  }
}

function goOps() {
  const path = detail.value?.opsPath || detail.value?.alert?.opsPath
  if (!path) return
  const q = path.includes('?') ? path.slice(path.indexOf('?')) : `?runId=${detail.value?.run || ''}`
  router.push(`/ops${q}`)
  emit('close')
}

function goNodeOnCanvas(nodeId) {
  emit('select-node', nodeId)
  emit('close')
}

async function openResultPreview(node) {
  const runId = activeRun.value
  const nodeKey = node?.nodeId || activeNodeKey.value
  if (!runId || !nodeKey) {
    showToast('缺少 runId / 节点', 'error')
    return
  }
  previewOpen.value = true
  previewLoading.value = true
  previewError.value = ''
  previewData.value = null
  previewNodeKey.value = nodeKey
  try {
    const d = await fetchEtlRunResultPreview(runId, nodeKey, { limit: 20 })
    previewData.value = d || null
    if (d && d.ok === false) {
      previewError.value = d.message || '预览失败'
    }
  } catch (e) {
    previewError.value = e?.message || String(e)
  } finally {
    previewLoading.value = false
  }
}

function closeResultPreview() {
  previewOpen.value = false
  previewLoading.value = false
  previewError.value = ''
  previewData.value = null
  previewNodeKey.value = ''
}

function cellText(row, col) {
  const v = row?.[col]
  if (v == null) return '—'
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}
</script>

<template>
  <AppDrawer
    :open="open"
    :default-width="920"
    :min-width="640"
    storage-key="etl-runs-drawer-w"
    @close="emit('close')"
  >
    <div class="drawer-header">
      <div>
        <div class="drawer-title">执行记录 · {{ task?.name || '—' }}</div>
        <div class="drawer-subtitle">
          {{ task?.desc || '' }} · 引擎 {{ task?.engine }} · cron {{ task?.cron }} · SLA {{ task?.sla }}
        </div>
      </div>
      <div class="trd-actions">
        <button type="button" class="btn btn-sm btn-primary" @click="emit('rerun')">▶ 试跑</button>
        <button type="button" class="btn btn-sm" @click="emit('close')">关闭</button>
      </div>
    </div>

    <div class="drawer-body trd-body">
      <!-- KPI -->
      <div class="trd-kpis">
        <div class="trd-kpi">
          <div class="trd-kpi-label">总次数</div>
          <div class="trd-kpi-value">{{ kpis.total }}</div>
        </div>
        <div class="trd-kpi ok">
          <div class="trd-kpi-label">成功</div>
          <div class="trd-kpi-value">{{ kpis.ok }}</div>
        </div>
        <div class="trd-kpi err">
          <div class="trd-kpi-label">失败</div>
          <div class="trd-kpi-value">{{ kpis.err }}</div>
        </div>
        <div class="trd-kpi run">
          <div class="trd-kpi-label">运行中</div>
          <div class="trd-kpi-value">{{ kpis.run }}</div>
        </div>
        <div class="trd-kpi">
          <div class="trd-kpi-label">成功率</div>
          <div class="trd-kpi-value">{{ kpis.rate }}</div>
        </div>
      </div>

      <div class="trd-layout">
        <!-- 列表 -->
        <section class="trd-list-pane">
          <div class="trd-filters">
            <input v-model="kw" class="input input-sm" placeholder="run_id / 状态 / 说明…" />
            <select v-model="statusFilter" class="select input-sm">
              <option value="ALL">全部状态</option>
              <option value="SUCCESS">成功</option>
              <option value="ERROR">失败</option>
              <option value="RUNNING">运行中</option>
              <option value="PENDING">排队</option>
              <option value="CANCELLED">已终止</option>
            </select>
            <select v-model="triggerFilter" class="select input-sm">
              <option value="ALL">全部触发</option>
              <option value="cron">调度</option>
              <option value="manual">手动/试跑</option>
              <option value="backfill">补数</option>
            </select>
          </div>

          <div class="trd-table-wrap">
            <table class="trd-table">
              <thead>
                <tr>
                  <th>run_id</th>
                  <th>状态</th>
                  <th>开始</th>
                  <th>结束</th>
                  <th>耗时</th>
                  <th>触发</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="l in filtered"
                  :key="l.run"
                  :class="{ active: (activeRun || filtered[0]?.run) === l.run }"
                  @click="openRun(l.run)"
                >
                  <td><code>{{ l.run }}</code></td>
                  <td><span class="tag" :class="statusMeta(l.status).tag">{{ statusMeta(l.status).label }}</span></td>
                  <td class="muted">{{ l.start }}</td>
                  <td class="muted">{{ l.end }}</td>
                  <td>{{ l.duration }}</td>
                  <td class="muted">{{ l.trigger || 'cron' }} / {{ l.env }}</td>
                  <td class="note">{{ l.note }}</td>
                </tr>
                <tr v-if="!filtered.length">
                  <td colspan="7" class="empty">暂无执行记录</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 详情 -->
        <section v-if="detail" class="trd-detail-pane">
          <div class="trd-detail-head">
            <div>
              <div class="trd-detail-title">
                <code>{{ detail.run }}</code>
                <span class="tag" :class="statusMeta(detail.status).tag">{{ statusMeta(detail.status).label }}</span>
              </div>
              <div class="muted">{{ detail.start }} → {{ detail.end }} · {{ detail.duration }}</div>
            </div>
            <div class="trd-actions">
              <button type="button" class="btn btn-sm" @click="copyRunId">复制 run_id</button>
              <button
                v-if="detail.status === 'RUNNING' || detail.status === 'PENDING' || detail.status === 'SUBMITTED'"
                type="button"
                class="btn btn-sm"
                style="color: var(--danger)"
                :disabled="stopBusy"
                @click="onStopRun"
              >{{ stopBusy ? '终止中…' : '终止' }}</button>
              <button
                v-if="detail.status === 'ERROR' || detail.opsPath"
                type="button"
                class="btn btn-sm btn-primary"
                @click="goOps"
              >打开运维</button>
              <button type="button" class="btn btn-sm" @click="emit('rerun')">重跑</button>
            </div>
          </div>

          <div class="trd-tabs">
            <button type="button" class="std-tab" :class="{ active: detailTab === 'overview' }" @click="detailTab = 'overview'">概览</button>
            <button type="button" class="std-tab" :class="{ active: detailTab === 'nodes' }" @click="detailTab = 'nodes'">节点时间线</button>
            <button type="button" class="std-tab" :class="{ active: detailTab === 'logs' }" @click="detailTab = 'logs'">三态日志</button>
          </div>

          <!-- 概览 -->
          <div v-show="detailTab === 'overview'" class="trd-tab-body">
            <div class="trd-grid">
              <div class="trd-card">
                <div class="trd-card-label">触发 / 环境</div>
                <div class="trd-card-val">{{ detail.trigger || 'cron' }} · {{ detail.env }}</div>
              </div>
              <div class="trd-card">
                <div class="trd-card-label">输入 / 输出行</div>
                <div class="trd-card-val">{{ detail.metrics?.rowsIn }} → {{ detail.metrics?.rowsOut }}</div>
              </div>
              <div class="trd-card">
                <div class="trd-card-label">节点进度</div>
                <div class="trd-card-val">{{ detail.metrics?.doneNodes }} / {{ detail.metrics?.totalNodes }}</div>
              </div>
              <div class="trd-card">
                <div class="trd-card-label">失败节点</div>
                <div class="trd-card-val" :class="{ 'err-text': detail.status === 'ERROR' }">{{ detail.metrics?.failNode }}</div>
              </div>
            </div>
            <div class="trd-card block">
              <div class="trd-card-label">说明</div>
              <div class="trd-card-val">{{ detail.note || '—' }}</div>
            </div>
            <div class="trd-card block">
              <div class="trd-card-label">Application</div>
              <pre class="log-pre compact">application_id: {{ detail.app.applicationId }}
engine: {{ detail.app.engine }}
executor: {{ detail.app.executors }}
shuffle: {{ detail.app.shuffle }}
checkpoint: {{ detail.app.checkpoint }}</pre>
            </div>
            <div v-if="previewableSinks.length" class="trd-card block">
              <div class="trd-card-label">核对目标数据</div>
              <div class="form-hint" style="margin-bottom: 8px">
                试跑已成功 · 从目标库抽样预览，核对写出结果（LIMIT 20）
              </div>
              <div class="trd-preview-sinks">
                <button
                  v-for="n in previewableSinks"
                  :key="n.nodeId"
                  type="button"
                  class="btn btn-sm"
                  @click="openResultPreview(n)"
                >
                  预览 · {{ n.name }}
                </button>
              </div>
            </div>
          </div>

          <!-- 节点 -->
          <div v-show="detailTab === 'nodes'" class="trd-tab-body">
            <div class="trd-nodes">
              <button
                v-for="n in detail.nodes"
                :key="n.nodeId"
                type="button"
                class="ntl"
                :class="[n.status, { active: activeNodeId === n.nodeId }]"
                @click="activeNodeId = n.nodeId"
              >
                <div class="ntl-top">
                  <span class="ntl-name">{{ n.name }}</span>
                  <span class="tag" :class="nodeStatusMeta(n.status).tag">{{ nodeStatusMeta(n.status).label }}</span>
                </div>
                <div class="muted">{{ typeLabel(n.type) }} · {{ n.start }} → {{ n.end }} · {{ n.duration }}</div>
              </button>
            </div>
            <div v-if="activeNode" class="trd-node-log">
              <div class="trd-node-log-head">
                <span>节点日志 · {{ activeNode.name }}</span>
                <div class="trd-node-log-actions">
                  <label class="trd-follow" title="仅在节点运行中每 3 秒续拉">
                    <input v-model="nodeLogAutoRefresh" type="checkbox" />
                    自动刷新
                  </label>
                  <label class="trd-follow" title="新日志追加后滚到底部">
                    <input v-model="nodeLogAutoFollow" type="checkbox" />
                    跟随滚动
                  </label>
                  <button
                    v-if="canPreviewActiveNode"
                    type="button"
                    class="btn btn-sm btn-primary"
                    @click="openResultPreview(activeNode)"
                  >预览目标数据</button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :disabled="nodeLogLoading"
                    @click="loadNodeLog({ append: false })"
                  >{{ nodeLogLoading ? '拉取中…' : '刷新' }}</button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :disabled="nodeLogLoading"
                    @click="loadNodeLog({ append: true })"
                  >续拉</button>
                  <button type="button" class="btn btn-sm" @click="goNodeOnCanvas(activeNode.nodeId)">定位画布</button>
                </div>
              </div>
              <div v-if="nodeLogMeta" class="form-hint trd-log-meta">
                来源 {{ nodeLogMeta.source === 'ds' ? '调度器' : '门户' }}
                <template v-if="nodeLogMeta.taskInstanceId"> · taskInstanceId={{ nodeLogMeta.taskInstanceId }}</template>
                · 已读 {{ nodeLogLineNum }} 行
                <template v-if="nodeLogMeta.degraded"> · 降级</template>
              </div>
              <div v-if="nodeLogError" class="form-hint err-text">{{ nodeLogError }}</div>
              <pre ref="nodeLogPreRef" class="log-pre trd-live-log">{{ nodeLogText || '暂无日志' }}</pre>
              <details v-if="activeNode.lines?.length" class="trd-fallback-lines">
                <summary class="form-hint">摘要时间线（本地）</summary>
                <div class="nel-lines">
                  <div
                    v-for="(line, i) in activeNode.lines"
                    :key="i"
                    class="nel-line"
                    :class="levelClass(line.level)"
                  >
                    <span class="nel-t">{{ line.t }}</span>
                    <span class="nel-lv">{{ line.level }}</span>
                    <span>{{ line.msg }}</span>
                  </div>
                </div>
              </details>
            </div>
          </div>

          <!-- 三态日志 -->
          <div v-show="detailTab === 'logs'" class="trd-tab-body">
            <div class="log-block">
              <div class="log-label ok">stdout</div>
              <pre class="log-pre">{{ detail.stdout.join('\n') }}</pre>
            </div>
            <div class="log-block">
              <div class="log-label warn">stderr</div>
              <pre class="log-pre" :class="{ err: detail.status === 'ERROR' }">{{ detail.stderr.join('\n') }}</pre>
            </div>
            <div class="log-block">
              <div class="log-label app">application</div>
              <pre class="log-pre">application_id: {{ detail.app.applicationId }}
engine: {{ detail.app.engine }}
executor: {{ detail.app.executors }}
shuffle: {{ detail.app.shuffle }}
checkpoint: {{ detail.app.checkpoint }}</pre>
            </div>
          </div>
        </section>

        <div v-else class="trd-detail-pane empty-pane">选择左侧一条执行记录查看详情</div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="previewOpen" class="modal-mask trd-preview-mask" @click.self="closeResultPreview">
        <div class="modal trd-preview-modal" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">目标数据预览</div>
              <div class="modal-sub">
                {{ previewData?.target || previewData?.qualifiedName || previewNodeKey || '—' }}
                <template v-if="previewData?.source"> · {{ previewData.source }}</template>
                <template v-if="previewData?.rowCount != null"> · {{ previewData.rowCount }} 行</template>
              </div>
            </div>
            <button type="button" class="btn btn-sm" @click="closeResultPreview">关闭</button>
          </div>
          <div class="modal-body">
            <div v-if="previewLoading" class="form-hint">正在拉取目标表样本…</div>
            <div v-else-if="previewError" class="form-hint err-text">{{ previewError }}</div>
            <template v-else>
              <div v-if="previewData?.message" class="form-hint" style="margin-bottom: 8px">{{ previewData.message }}</div>
              <div v-if="previewData?.sql" class="form-hint trd-preview-sql"><code>{{ previewData.sql }}</code></div>
              <div v-if="!previewCols.length" class="form-hint">无列数据</div>
              <div v-else class="trd-preview-table-wrap">
                <table class="trd-preview-table">
                  <thead>
                    <tr>
                      <th v-for="c in previewCols" :key="c">{{ c }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, i) in previewRows" :key="i">
                      <td v-for="c in previewCols" :key="c">{{ cellText(row, c) }}</td>
                    </tr>
                    <tr v-if="!previewRows.length">
                      <td :colspan="previewCols.length" class="muted">表为空或无样本行</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </AppDrawer>
</template>

<style scoped>
.trd-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.trd-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  height: calc(100% - 0px);
}
.trd-kpis {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.trd-kpi {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--bg-2, #fafafa);
}
.trd-kpi-label {
  font-size: 11px;
  color: var(--text-3);
}
.trd-kpi-value {
  font-size: 20px;
  font-weight: 700;
  margin-top: 2px;
}
.trd-kpi.ok .trd-kpi-value { color: #52c41a; }
.trd-kpi.err .trd-kpi-value { color: #f5222d; }
.trd-kpi.run .trd-kpi-value { color: #1890ff; }

.trd-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 12px;
}
.trd-list-pane,
.trd-detail-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}
.trd-filters {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 0.8fr;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--border);
}
.trd-table-wrap {
  overflow: auto;
  flex: 1;
}
.trd-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.trd-table th {
  position: sticky;
  top: 0;
  background: var(--bg-2, #f5f5f5);
  text-align: left;
  padding: 8px 10px;
  font-weight: 600;
  color: var(--text-2);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.trd-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.trd-table tbody tr {
  cursor: pointer;
}
.trd-table tbody tr:hover {
  background: rgba(24, 144, 255, 0.04);
}
.trd-table tbody tr.active {
  background: rgba(24, 144, 255, 0.08);
}
.trd-table code {
  font-size: 11px;
}
.trd-table .muted,
.muted {
  color: var(--text-3);
  font-size: 11px;
}
.trd-table .note {
  color: var(--text-2);
  max-width: 180px;
}
.trd-table .empty,
.empty-pane {
  text-align: center;
  color: var(--text-3);
  padding: 40px 12px;
}

.trd-detail-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  align-items: flex-start;
}
.trd-detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 2px;
}
.trd-tabs {
  display: flex;
  gap: 4px;
  padding: 6px 10px 0;
  border-bottom: 1px solid var(--border);
}
.trd-tabs .std-tab {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-2);
  border-bottom: 2px solid transparent;
}
.trd-tabs .std-tab.active {
  color: var(--primary, #1890ff);
  border-bottom-color: var(--primary, #1890ff);
  font-weight: 600;
}
.trd-tab-body {
  flex: 1;
  overflow: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.trd-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.trd-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--bg-2, #fafafa);
}
.trd-card.block {
  width: 100%;
}
.trd-card-label {
  font-size: 11px;
  color: var(--text-3);
  margin-bottom: 2px;
}
.trd-card-val {
  font-size: 13px;
  font-weight: 600;
}
.err-text {
  color: #cf1322;
}
.trd-nodes {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ntl {
  text-align: left;
  border: 1px solid var(--border);
  border-left-width: 3px;
  border-radius: 6px;
  padding: 6px 8px;
  background: #fff;
  cursor: pointer;
}
.ntl.done { border-left-color: #52c41a; }
.ntl.running { border-left-color: #1890ff; }
.ntl.blocked { border-left-color: #f5222d; }
.ntl.pending { border-left-color: #d9d9d9; }
.ntl.active {
  background: rgba(24, 144, 255, 0.06);
  border-color: var(--primary, #1890ff);
}
.ntl-top {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: center;
}
.ntl-name {
  font-size: 12px;
  font-weight: 600;
}
.trd-node-log-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}
.trd-node-log-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.trd-follow {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-2);
  font-weight: 400;
}
.trd-log-meta {
  margin-bottom: 6px;
}
.trd-live-log {
  max-height: 360px;
  min-height: 160px;
  white-space: pre-wrap;
  word-break: break-all;
}
.trd-fallback-lines {
  margin-top: 10px;
}
.nel-lines {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  background: #0f172a0a;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  max-height: 200px;
  overflow: auto;
}
.nel-line {
  display: grid;
  grid-template-columns: 72px 48px 1fr;
  gap: 6px;
}
.nel-line.err { color: #cf1322; }
.nel-line.warn { color: #d48806; }
.nel-t { color: var(--text-3); }
.nel-lv { font-weight: 700; }
.log-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.log-label {
  font-size: 12px;
  font-weight: 700;
}
.log-label.ok { color: #52c41a; }
.log-label.warn { color: #d48806; }
.log-label.app { color: #722ed1; }
.log-pre {
  margin: 0;
  padding: 8px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.55;
  background: #0f172a0a;
  border: 1px solid var(--border);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow: auto;
}
.log-pre.compact {
  max-height: none;
  font-weight: 400;
}
.log-pre.err {
  color: #cf1322;
  background: rgba(245, 34, 45, 0.04);
}

.trd-preview-sinks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.trd-preview-mask {
  z-index: 1200;
}
.trd-preview-modal {
  width: min(920px, 94vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}
.trd-preview-modal .modal-body {
  overflow: auto;
  min-height: 120px;
}
.trd-preview-sql {
  margin-bottom: 8px;
  word-break: break-all;
}
.trd-preview-table-wrap {
  overflow: auto;
  max-height: 56vh;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.trd-preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.trd-preview-table th,
.trd-preview-table td {
  border-bottom: 1px solid var(--border);
  padding: 6px 8px;
  text-align: left;
  white-space: nowrap;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trd-preview-table th {
  position: sticky;
  top: 0;
  background: var(--bg-2, #fafafa);
  font-weight: 600;
}

@media (max-width: 900px) {
  .trd-layout {
    grid-template-columns: 1fr;
  }
  .trd-kpis {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
