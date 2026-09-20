<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppDrawer from '@/components/common/AppDrawer.vue'
import { NODE_TYPES } from '@/data/etl'
import { fetchEtlRunDetail } from '@/api/etl'
import { RUN_STATUS_META, buildRunDetail } from '@/utils/etlRuns'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  task: { type: Object, default: null },
})
const emit = defineEmits(['close', 'rerun', 'select-node'])

const router = useRouter()
const { showToast } = useToast()
const kw = ref('')
const statusFilter = ref('ALL')
const triggerFilter = ref('ALL')
const activeRun = ref('')
const detailTab = ref('overview') // overview | nodes | logs
const activeNodeId = ref('')
const detailCache = ref({})

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

watch(
  () => [props.open, props.task?.id],
  () => {
    if (!props.open) return
    activeRun.value = props.task?.logs?.[0]?.run || ''
    detailTab.value = 'overview'
    activeNodeId.value = ''
    kw.value = ''
    statusFilter.value = 'ALL'
    triggerFilter.value = 'ALL'
  },
)

watch(detail, (d) => {
  if (d && !d.nodes?.some((n) => n.nodeId === activeNodeId.value)) {
    activeNodeId.value = d.nodes?.[0]?.nodeId || ''
  }
})

watch(activeRun, async (runId) => {
  if (!runId || !props.open) return
  if (detailCache.value[runId]?.runNodes) return
  try {
    const d = await fetchEtlRunDetail(runId)
    if (!d) return
    detailCache.value = {
      ...detailCache.value,
      [runId]: {
        note: d.message || '',
        status:
          d.status === 'success'
            ? 'SUCCESS'
            : d.status === 'failed'
              ? 'ERROR'
              : d.status === 'running' || d.status === 'submitted'
                ? 'RUNNING'
                : String(d.status || '').toUpperCase(),
        env: d.env,
        trigger: d.trigger || d.triggerType,
        runNodes: d.nodes || [],
        opsPath: d.opsPath || d.alert?.opsPath,
        alert: d.alert,
      },
    }
  } catch {
    /* soft-fail：抽屉仍用列表摘要 */
  }
})

function openRun(run) {
  activeRun.value = run
  detailTab.value = 'overview'
}

function statusMeta(st) {
  return RUN_STATUS_META[st] || RUN_STATUS_META.PENDING
}

function nodeStatusMeta(st) {
  if (st === 'blocked') return RUN_STATUS_META.ERROR
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
                <button type="button" class="btn btn-sm" @click="goNodeOnCanvas(activeNode.nodeId)">定位画布</button>
              </div>
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
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
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

@media (max-width: 900px) {
  .trd-layout {
    grid-template-columns: 1fr;
  }
  .trd-kpis {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
