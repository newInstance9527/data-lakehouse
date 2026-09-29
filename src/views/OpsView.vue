<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import { opsStatusIconClass } from '@/data/ops'
import {
  backfillEtlDag,
  fetchEtlDags,
  fetchEtlRunDetail,
  fetchEtlRuns,
} from '@/api/etl'
import { fetchReconPartition } from '@/api/metric'
import {
  fetchObsSlaSummary,
  fetchObsTasks,
  postObsTaskAction,
} from '@/api/observability'
import { useSession } from '@/composables/useSession'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('ops')
const { currentWs } = useSession()

const env = ref('prod')
const focusRunId = ref('')
const focusDagId = ref('')
const focusRun = ref(null)
const bfMarkKey = ref('dt')
const bfMarkValue = ref('')
const bfDagId = ref('')
const loading = ref(false)
const loadError = ref('')
const showKpis = ref(false)
const dags = ref([])
const runs = ref([])
const reconRows = ref([])
const facadeTasks = ref([])
const slaSummary = ref(null)
const useFacade = ref(true)

function mapRunStatus(st) {
  const s = String(st || '').toLowerCase()
  if (['success', 'successed', 'succeeded', 'ok', 'done'].includes(s)) return 'success'
  if (['failed', 'fail', 'error'].includes(s)) return 'failed'
  if (['running', 'executing'].includes(s)) return 'running'
  if (['blocked', 'warn', 'warning'].includes(s)) return 'warning'
  return s || 'running'
}

function statusIcon(st) {
  const m = mapRunStatus(st)
  if (m === 'success') return '✓'
  if (m === 'failed') return '✕'
  if (m === 'warning') return '⚠️'
  return '⚙️'
}

function progressOf(st) {
  const m = mapRunStatus(st)
  if (m === 'success') return { pct: 100, label: '完成', text: '100%', color: 'var(--success)' }
  if (m === 'failed') return { pct: 0, label: '失败', text: '0%', color: 'var(--danger)' }
  if (m === 'warning') return { pct: 50, label: '告警', text: '—', color: 'var(--warning)' }
  return { pct: 60, label: '进度', text: '运行中', color: 'linear-gradient(90deg,#1e6fff,#5cdbd3)' }
}

const flinkJobs = computed(() => {
  const fromDags = dags.value.filter((d) => {
    const eng = String(d.defaultEngine || d.engine || '').toLowerCase()
    return eng.includes('flink') || eng.includes('stream')
  })
  const list = fromDags.length
    ? fromDags
    : runs.value.filter((r) => String(r.engine || r.trigger || '').toLowerCase().includes('flink'))
  return list.map((t) => {
    const st = mapRunStatus(t.lastStatus || t.status)
    const prog = progressOf(st)
    return {
      id: t.id || t.dagCode || t.runId,
      name: t.name || t.dagCode || t.runId || '—',
      status: st,
      icon: statusIcon(st),
      tags: t.status ? [{ text: String(t.status), cls: st === 'failed' ? 'tag-red' : 'tag-green' }] : [],
      meta: [
        t.cron ? { text: `cron ${t.cron}` } : null,
        t.env ? { text: `env ${t.env}` } : null,
        t.message ? { text: t.message, tone: st === 'failed' ? 'danger' : undefined } : null,
      ].filter(Boolean),
      progressLabel: prog.label,
      progressText: prog.text,
      progress: prog.pct,
      barColor: prog.color,
      route: t.id ? { path: '/integration', query: { dagId: t.id } } : null,
    }
  })
})

const dsDags = computed(() => {
  const batch = dags.value.filter((d) => {
    const eng = String(d.defaultEngine || d.engine || '').toLowerCase()
    return !eng.includes('flink') && !eng.includes('stream')
  })
  const list = batch.length ? batch : dags.value
  return list.map((t) => {
    const st = mapRunStatus(t.lastStatus || t.status)
    const prog = progressOf(st)
    return {
      id: t.id || t.dagCode,
      name: `${t.dagCode || t.name || '—'} · ${t.name || ''}`.trim(),
      status: st,
      icon: statusIcon(st),
      tags: [],
      meta: [
        t.cron ? { text: t.cron } : null,
        t.owner ? { text: `owner ${t.owner}` } : null,
        t.description || t.desc ? { text: t.description || t.desc } : null,
      ].filter(Boolean),
      progressLabel: prog.label,
      progressText: prog.text,
      progress: prog.pct,
      barColor: prog.color,
      route: t.id ? { path: '/integration', query: { dagId: t.id } } : null,
    }
  })
})

const kpis = computed(() => {
  const flinkN = flinkJobs.value.length
  const flinkFail = flinkJobs.value.filter((j) => j.status === 'failed').length
  const flinkRun = flinkJobs.value.filter((j) => j.status === 'running').length
  const dagN = dags.value.length
  const runOk = runs.value.filter((r) => mapRunStatus(r.status) === 'success').length
  const runFail = runs.value.filter((r) => mapRunStatus(r.status) === 'failed').length
  const reconPass = reconRows.value.filter((r) => r.pass || r.status === 'pass').length
  const reconFail = reconRows.value.filter((r) => !(r.pass || r.status === 'pass')).length
  return [
    {
      icon: '🌊',
      color: 'blue',
      value: String(flinkN || '—'),
      unit: '个',
      label: '流作业',
      trend: flinkN ? `${flinkRun} 运行 · ${flinkFail} 异常` : '暂无',
      trendDanger: flinkFail > 0,
    },
    {
      icon: '🐬',
      color: 'green',
      value: String(dagN || '—'),
      unit: '个',
      label: '批任务',
      trend: runs.value.length ? `✓ ${runOk} · ✕ ${runFail}` : '暂无运行',
      trendUp: runFail === 0,
    },
    {
      icon: '🔁',
      color: 'orange',
      value: String(reconRows.value.length || '—'),
      unit: '条',
      label: '湖仓对账',
      trend: reconRows.value.length ? `${reconPass} 通过 · ${reconFail} 失败` : '暂无',
      trendDanger: reconFail > 0,
    },
    {
      icon: '📦',
      color: 'purple',
      value: String(runs.value.length || '—'),
      unit: '次',
      label: '近期运行',
      trend: loadError.value || '来自近期运行记录',
      trendUp: true,
    },
  ]
})

const reconcileBlocks = computed(() =>
  reconRows.value.map((r) => {
    const ok = r.pass || r.status === 'pass'
    const lake = r.lakeMetric?.rows ?? r.lakeRows ?? '—'
    const ck = r.ckMetric?.rows ?? r.ckRows ?? '—'
    return {
      table: r.ckTable || r.lakeTable || r.metricCode || '—',
      dt: r.partitionKey || r.dt || '—',
      ice: { rows: String(lake), amt: r.lakeMetric?.amt || '' },
      ck: { rows: String(ck), amt: r.ckMetric?.amt || '' },
      diff: {
        rows: r.diffRows != null ? String(r.diffRows) : String(r.diffRatio ?? '—'),
        amt: r.diffAmt != null ? String(r.diffAmt) : '',
      },
      pass: ok,
      reason: r.reason || r.message || '',
    }
  }),
)

const flinkTagSummary = computed(() => {
  const run = flinkJobs.value.filter((j) => j.status === 'running').length
  const fail = flinkJobs.value.filter((j) => j.status === 'failed').length
  return { run, fail }
})

const dsSuccessRate = computed(() => {
  if (!runs.value.length) return null
  const ok = runs.value.filter((r) => mapRunStatus(r.status) === 'success').length
  return Math.round((ok / runs.value.length) * 1000) / 10
})

const reconPassCount = computed(() => reconcileBlocks.value.filter((r) => r.pass).length)
const reconFailCount = computed(() => reconcileBlocks.value.filter((r) => !r.pass).length)

async function loadOpsBoard() {
  loading.value = true
  loadError.value = ''
  const ws = currentWs.value || 'default'
  try {
    if (useFacade.value) {
      try {
        const [tasksPage, sla, recon] = await Promise.all([
          fetchObsTasks({ group: 'all', ws }),
          fetchObsSlaSummary({ ws }).catch(() => null),
          fetchReconPartition({ limit: 20 }).catch(() => null),
        ])
        facadeTasks.value = tasksPage?.records || []
        slaSummary.value = sla
        reconRows.value = recon?.records || []
        const etlTasks = facadeTasks.value.filter((t) => t.kind === 'etl_dag')
        dags.value = etlTasks.map((t) => ({
          id: t.id,
          name: t.name,
          dagCode: t.dagCode,
          status: t.status,
          lastStatus: t.lastStatus,
          cron: t.cron,
          owner: t.owner,
          sla: t.sla,
          env: t.env,
          defaultEngine: t.engine,
          description: t.group,
        }))
        runs.value = etlTasks.flatMap((t) =>
          (t.recentRuns || []).map((r) => ({
            ...r,
            dagId: t.id,
            dagCode: t.dagCode,
          })),
        )
        return
      } catch (fe) {
        useFacade.value = false
        showToast('tasks 门面不可用，回落 ETL 旁路', 'warning')
      }
    }
    const [dagPage, runPage, recon] = await Promise.all([
      fetchEtlDags({ ws }, { current: 1, size: 100 }),
      fetchEtlRuns({ ws, current: 1, size: 50 }),
      fetchReconPartition({ limit: 20 }).catch(() => null),
    ])
    dags.value = dagPage?.records || []
    runs.value = runPage?.records || []
    reconRows.value = recon?.records || []
    facadeTasks.value = []
  } catch (e) {
    dags.value = []
    runs.value = []
    reconRows.value = []
    loadError.value = e?.message || '运维数据拉取失败'
    showToast(loadError.value, 'warning')
  } finally {
    loading.value = false
  }
}

async function loadFocusRun() {
  const rid = String(route.query.runId || '')
  const did = String(route.query.dagId || '')
  focusRunId.value = rid
  focusDagId.value = did
  bfDagId.value = did
  focusRun.value = null
  if (!rid) return
  try {
    focusRun.value = await fetchEtlRunDetail(rid)
  } catch (e) {
    showToast(e.message || '加载 run 失败', 'warning')
  }
}

watch(
  () => [route.query.runId, route.query.dagId],
  () => {
    loadFocusRun()
  },
)

watch(currentWs, () => {
  loadOpsBoard()
})

onMounted(() => {
  loadFocusRun()
  loadOpsBoard()
})

async function startSupplement() {
  if (bfDagId.value && bfMarkKey.value && bfMarkValue.value) {
    try {
      const resp = await runOpsBackfill(
        bfDagId.value,
        bfMarkKey.value.trim(),
        bfMarkValue.value.trim(),
      )
      showToast(`🔧 补数已提交 · ${resp?.runId || ''}`, resp?.ds?.degraded ? 'warning' : 'success')
      if (resp?.complianceGate?.acknowledged) {
        showToast('已确认合规补数门禁（命中已删分区）', 'warning')
      }
      if (resp?.runId) {
        router.replace({ query: { ...route.query, runId: resp.runId, dagId: bfDagId.value } })
      }
      return
    } catch (e) {
      showToast(e.message || '补数失败', 'error')
      return
    }
  }
  showToast('🔧 发起补数 · 请填写 DAG id 与 mark_key / mark_value', 'info')
}

async function runOpsBackfill(dagId, markKey, markValue, confirmReqNo) {
  try {
    if (useFacade.value) {
      const resp = await postObsTaskAction(dagId, {
        action: 'backfill',
        markKey,
        markValue,
        env: env.value,
        confirmReqNo,
      })
      return resp?.result || resp
    }
    return await backfillEtlDag(dagId, {
      markKey,
      markValue,
      env: env.value,
      confirmReqNo,
    })
  } catch (e) {
    if (!/须二次确认|confirmReqNo|已删分区/.test(e?.message || '') || confirmReqNo) throw e
    const m = /(DEL-\d{4}-\d+)/.exec(e.message || '')
    const typed = window.prompt(
      `${e.message}\n\n请回填合规请求号以二次确认补数：`,
      m ? m[1] : '',
    )
    if (!typed?.trim()) throw e
    if (useFacade.value) {
      const resp = await postObsTaskAction(dagId, {
        action: 'backfill',
        markKey,
        markValue,
        env: env.value,
        confirmReqNo: typed.trim(),
      })
      return resp?.result || resp
    }
    return backfillEtlDag(dagId, {
      markKey,
      markValue,
      env: env.value,
      confirmReqNo: typed.trim(),
    })
  }
}

function reimportDiff() {
  showToast('🔧 重导差异分区 · 以湖表为准校正加速层', 'info')
}

function onTaskClick(task) {
  if (task.route) router.push(task.route)
}

function goRootcause() {
  router.push('/rootcause')
}

function goEtl() {
  router.push('/integration')
}

function metaToneStyle(tone) {
  if (tone === 'warning') return { color: 'var(--warning)' }
  if (tone === 'success') return { color: 'var(--success)' }
  if (tone === 'danger') return { color: 'var(--danger)' }
  return undefined
}
</script>

<template>
  <div class="ops-page">
    <PageHeader
      page-id="ops"
      title="任务运维中心"
      subtitle="流作业 · 批任务 · 湖仓对账 · 补数工单"
      :guide="guide"
    >
      <select v-model="env" class="select input-sm">
        <option value="prod">生产 prod</option>
        <option value="stg">预发 stg</option>
      </select>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="loadOpsBoard">
        {{ loading ? '…' : '刷新' }}
      </button>
      <button type="button" class="btn btn-sm btn-primary" @click="startSupplement">🔧 发起补数</button>
    </PageHeader>

    <p class="tip ops-banner">作业列表来自 ETL / 对账 API；无作业时为空。</p>
    <div v-if="loadError" class="banner-soft">{{ loadError }}</div>

    <div v-if="focusRunId" class="ops-focus card">
      <div class="card-header">
        <div class="card-title">告警定位 · run_id</div>
        <button type="button" class="btn btn-sm" @click="goEtl">回 ETL 编排</button>
      </div>
      <div class="card-body ops-focus-body">
        <div><span class="muted">run_id</span> <code>{{ focusRunId }}</code></div>
        <div v-if="focusDagId"><span class="muted">dag_id</span> <code>{{ focusDagId }}</code></div>
        <div v-if="focusRun">
          <span class="muted">状态</span> {{ focusRun.status }} ·
          <span class="muted">触发</span> {{ focusRun.trigger || focusRun.triggerType }} ·
          <span class="muted">环境</span> {{ focusRun.env }}
        </div>
        <div v-if="focusRun?.message" class="ops-focus-msg">{{ focusRun.message }}</div>
        <div v-if="focusRun?.alert" class="ops-focus-msg">
          告警 {{ focusRun.alert.severity }} · {{ focusRun.alert.title }}
        </div>
      </div>
    </div>

    <div class="card ops-backfill">
      <div class="card-header">
        <div class="card-title">补数（水位 mark_key / mark_value）</div>
      </div>
      <div class="card-body ops-bf-row">
        <input v-model="bfDagId" class="input input-sm" placeholder="dag id" />
        <input v-model="bfMarkKey" class="input input-sm" placeholder="mark_key · dt" />
        <input v-model="bfMarkValue" class="input input-sm" placeholder="mark_value · 2026-09-18" />
        <button type="button" class="btn btn-sm btn-primary" @click="startSupplement">提交补数</button>
      </div>
    </div>

    <div class="ops-kpi-toggle">
      <button type="button" class="btn btn-sm" @click="showKpis = !showKpis">
        {{ showKpis ? '收起概览' : '展开概览 KPI' }}
      </button>
    </div>
    <div v-if="showKpis" class="kpi-grid ops-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div
          class="kpi-trend"
          :class="{ up: k.trendUp, down: k.trendDanger || k.trendDown }"
          :style="k.trendDanger ? { color: 'var(--danger)' } : undefined"
        >
          {{ k.trend }}
        </div>
      </div>
    </div>

    <div class="grid grid-2 ops-tasks">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🌊 流作业</div>
          <div class="ops-header-tags">
            <span v-if="flinkJobs.length" class="tag tag-green">{{ flinkTagSummary.run }} RUNNING</span>
            <span v-if="flinkTagSummary.fail" class="tag tag-red">{{ flinkTagSummary.fail }} FAIL</span>
            <span v-else-if="!flinkJobs.length" class="tip">暂无</span>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!flinkJobs.length" class="tip" style="padding: 12px">暂无流作业</div>
          <div
            v-for="t in flinkJobs"
            :key="t.id"
            class="task-card"
            :class="{ clickable: !!t.route }"
            @click="onTaskClick(t)"
          >
            <div class="task-status-icon" :class="opsStatusIconClass(t.status)">{{ t.icon }}</div>
            <div class="task-info">
              <div class="task-name">
                {{ t.name }}
                <span v-for="(tg, ti) in t.tags" :key="ti" class="tag" :class="tg.cls">{{ tg.text }}</span>
              </div>
              <div class="task-meta">
                <span v-for="(m, mi) in t.meta" :key="mi" :style="metaToneStyle(m.tone)">{{ m.text }}</span>
              </div>
            </div>
            <div class="task-progress">
              <div class="task-progress-text">
                <span>{{ t.progressLabel }}</span>
                <span>{{ t.progressText }}</span>
              </div>
              <div class="progress">
                <div
                  class="progress-bar"
                  :style="{ width: `${t.progress}%`, background: t.barColor }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🐬 批任务今日运行</div>
          <div class="ops-ds-rate">
            <template v-if="dsSuccessRate != null">成功率 <b>{{ dsSuccessRate }}%</b></template>
            <template v-else>暂无</template>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!dsDags.length" class="tip" style="padding: 12px">暂无批 DAG</div>
          <div
            v-for="t in dsDags"
            :key="t.id"
            class="task-card"
            :class="{ clickable: !!t.route }"
            @click="onTaskClick(t)"
          >
            <div class="task-status-icon" :class="opsStatusIconClass(t.status)">{{ t.icon }}</div>
            <div class="task-info">
              <div class="task-name">
                {{ t.name }}
                <span v-for="(tg, ti) in t.tags" :key="ti" class="tag" :class="tg.cls">{{ tg.text }}</span>
              </div>
              <div class="task-meta">
                <span v-for="(m, mi) in t.meta" :key="mi" :style="metaToneStyle(m.tone)">{{ m.text }}</span>
              </div>
            </div>
            <div class="task-progress">
              <div class="task-progress-text">
                <span>{{ t.progressLabel }}</span>
                <span>{{ t.progressText }}</span>
              </div>
              <div class="progress">
                <div
                  class="progress-bar"
                  :style="{ width: `${t.progress}%`, background: t.barColor }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card ops-reconcile">
      <div class="card-header">
        <div class="card-title">
          🔁 湖仓对账
          <span class="tip">· 未通过自动摘牌黄金数据集</span>
        </div>
        <div class="flex gap-8 ops-reconcile-actions">
          <span v-if="reconcileBlocks.length" class="tag tag-green">
            {{ reconPassCount }} 通过
          </span>
          <span v-if="reconFailCount" class="tag tag-red">
            {{ reconFailCount }} 失败
          </span>
          <button type="button" class="btn btn-sm btn-primary" @click="reimportDiff">
            🔧 重导差异分区
          </button>
        </div>
      </div>
      <div class="card-body">
        <div v-if="!reconcileBlocks.length" class="tip" style="padding: 12px">暂无对账记录</div>
        <div v-for="r in reconcileBlocks" :key="r.table" class="reconcile-block">
          <div class="reconcile-table-name">{{ r.table }}</div>
          <div class="reconcile-card" :class="{ 'is-fail': !r.pass }">
            <div class="rc-side">
              <div class="rc-side-label">🧊 湖表事实源 · dt={{ r.dt }}</div>
              <div class="rc-side-value ice">{{ r.ice.rows }}</div>
              <div class="rc-side-sub">{{ r.ice.amt }}</div>
            </div>
            <div class="rc-compare" :class="r.pass ? 'ok' : 'bad'">
              <div class="rc-compare-icon">{{ r.pass ? '✓' : '✕' }}</div>
              <div>{{ r.pass ? '一致' : '差异' }}</div>
              <div v-if="r.note" class="rc-compare-note">{{ r.note }}</div>
            </div>
            <div class="rc-side">
              <div class="rc-side-label">⚡ 加速查询层 · dt={{ r.dt }}</div>
              <div class="rc-side-value" :class="r.pass ? 'ok' : 'bad'">{{ r.ck.rows }}</div>
              <div class="rc-side-sub">{{ r.ck.amt }}</div>
            </div>
          </div>
          <div v-if="!r.pass" class="reconcile-fail">
            ⚠ 差异：行 <b>{{ r.diff.rows }}</b> · 金额 <b>{{ r.diff.amt }}</b><br />
            🔍 原因：{{ r.reason || '—' }} ·
            <button type="button" class="btn-link" @click="goRootcause">根因分析台 →</button>
            （默认以湖表为准重导加速层）
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ops-focus {
  margin-bottom: 12px;
  border-color: var(--warning);
}
.ops-focus-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.ops-focus-msg {
  color: var(--text-2);
  font-size: 12px;
}
.ops-backfill {
  margin-bottom: 12px;
}
.ops-bf-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.ops-bf-row .input {
  min-width: 140px;
  flex: 1;
}
.ops-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}
.ops-tasks {
  margin-bottom: 0;
}
.ops-header-tags {
  display: flex;
  gap: 2px;
  align-items: center;
}
.ops-ds-rate {
  font-size: 11px;
  color: var(--text-3);
}
.ops-ds-rate b {
  color: var(--success);
}
.ops-reconcile {
  margin-top: 16px;
}
.ops-reconcile-actions {
  align-items: center;
}

.task-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: var(--bg-1);
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 0.15s;
}
.task-card:last-child {
  margin-bottom: 0;
}
.task-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.task-card.clickable {
  cursor: pointer;
}
.task-status-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}
.ts-running {
  background: var(--primary-light);
  color: var(--primary);
  animation: ops-spin 2s linear infinite;
}
.ts-success {
  background: var(--success-light);
  color: var(--success);
}
.ts-failed {
  background: var(--danger-light);
  color: var(--danger);
}
.ts-pending,
.ts-warning {
  background: var(--warning-light);
  color: var(--warning);
}
@keyframes ops-spin {
  to {
    transform: rotate(360deg);
  }
}

.task-info {
  flex: 1;
  min-width: 0;
}
.task-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.task-meta {
  font-size: 11px;
  color: var(--text-3);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.task-progress {
  width: 180px;
  flex-shrink: 0;
}
.task-progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-3);
  margin-bottom: 4px;
}

.reconcile-block {
  margin-bottom: 12px;
}
.reconcile-block:last-child {
  margin-bottom: 0;
}
.reconcile-table-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 6px;
}
.reconcile-card {
  display: grid;
  grid-template-columns: 1fr 80px 1fr;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-1);
}
.reconcile-card.is-fail {
  border-radius: 8px 8px 0 0;
  border-bottom-color: #ffa39e;
}
.rc-side-label {
  font-size: 10px;
  color: var(--text-3);
  margin-bottom: 4px;
  font-weight: 600;
}
.rc-side-value {
  font-size: 13px;
  font-weight: 700;
  font-family: monospace;
}
.rc-side-value.ice {
  color: var(--primary);
}
.rc-side-value.ok {
  color: var(--success);
}
.rc-side-value.bad {
  color: var(--danger);
}
.rc-side-sub {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 2px;
}
.rc-compare {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  padding: 6px;
  border-radius: 6px;
}
.rc-compare.ok {
  background: var(--success-light);
  color: var(--success);
}
.rc-compare.bad {
  background: var(--danger-light);
  color: var(--danger);
}
.rc-compare-icon {
  font-size: 18px;
}
.rc-compare-note {
  font-size: 9px;
  opacity: 0.8;
  font-weight: 500;
}
.reconcile-fail {
  padding: 8px 12px;
  background: var(--danger-light);
  border-radius: 0 0 8px 8px;
  border: 1px solid #ffa39e;
  border-top: none;
  font-size: 12px;
  color: var(--danger);
  line-height: 1.7;
}

@media (max-width: 1100px) {
  .ops-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
  .task-progress {
    width: 120px;
  }
  .reconcile-card {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
.banner-soft {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-2);
}
.ops-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-2);
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.5;
}
</style>
