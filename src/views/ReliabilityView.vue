<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import { fetchMetricBoard, fetchReconDiff, fetchReconPartition, fetchReconRules, postReconGolden, rewriteCk, runReconPartition } from '@/api/metric'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('reliability')

const reconRows = ref([])
const reconSummary = ref({ passCount: 0, failCount: 0 })
const boardCards = ref([])
const boardReady = ref(0)
const boardBlocked = ref(0)
const reconLoading = ref(false)
const loadError = ref('')
const ruleApiRows = ref([])
const diffRows = ref([])

const kpis = computed(() => {
  const total = reconRows.value.length
  const pass = reconSummary.value.passCount ?? 0
  const fail = reconSummary.value.failCount ?? 0
  return [
    {
      icon: '🔁',
      color: 'green',
      value: total ? String(pass) : '—',
      unit: total ? `/${total}` : '',
      label: '对账通过',
      trend: total ? `${fail} 失败` : '暂无',
      trendUp: fail === 0,
      trendWarn: fail > 0,
    },
    {
      icon: '📊',
      color: 'blue',
      value: boardReady.value || boardCards.value.length ? String(boardReady.value) : '—',
      unit: '',
      label: '看板就绪',
      trend: boardBlocked.value ? `${boardBlocked.value} 阻断` : total ? '全部就绪' : '暂无',
      trendUp: boardBlocked.value === 0,
    },
    {
      icon: '⚠️',
      color: 'orange',
      value: fail ? String(fail) : '—',
      unit: '条',
      label: '对账失败',
      trend: loadError.value || (total ? '近窗分区对账' : '暂无'),
      trendWarn: fail > 0,
    },
    {
      icon: '🚦',
      color: 'purple',
      value: boardBlocked.value ? String(boardBlocked.value) : '0',
      unit: '个',
      label: '摘牌指标',
      trend: boardCards.value.length ? `共 ${boardCards.value.length} 卡` : '暂无',
      trendUp: boardBlocked.value === 0,
    },
    {
      icon: '📋',
      color: 'red',
      value: total ? String(total) : '—',
      unit: '条',
      label: '对账历史',
      trend: reconLoading.value ? '加载中' : '来自 recon API',
      trendUp: true,
    },
  ]
})

const liveHistory = computed(() => {
  if (!reconRows.value.length) return []
  return reconRows.value.map((r) => {
    const lake = r.lakeMetric?.rows ?? '—'
    const ck = r.ckMetric?.rows ?? '—'
    const ok = r.pass || r.status === 'pass'
    return {
      time: formatCheckedAt(r.checkedAt),
      table: r.ckTable || r.lakeTable || r.metricCode || '—',
      rule: '分区对账',
      diff: ok ? '0' : String(r.diffRatio ?? 'fail'),
      ok,
      drillDetail: [
        `metric=${r.metricCode || '—'}`,
        `partition=${r.partitionKey}`,
        `湖表行数=${lake}`,
        `加速层行数=${ck}`,
        `status=${r.status}`,
        r.traceId ? `trace=${r.traceId}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    }
  })
})

const ruleRows = computed(() => {
  if (ruleApiRows.value.length) {
    return ruleApiRows.value.map((r) => ({
      id: r.id,
      table: r.lakeTable || r.ckTable || r.ruleCode,
      rule: r.ruleType || 'rule',
      content: r.ruleName || r.ruleCode,
      threshold: r.threshold != null ? String(r.threshold) : '—',
      job: r.cron || '—',
      ok: r.lastStatus === 'pass' || r.enabled === 1 || r.enabled === true,
      statusLabel: r.lastStatus || (r.enabled ? '启用' : '停用'),
    }))
  }
  const byMetric = new Map()
  for (const r of reconRows.value) {
    const key = r.metricCode || r.ckTable || r.lakeTable
    if (!key || byMetric.has(key)) continue
    const ok = r.pass || r.status === 'pass'
    byMetric.set(key, {
      table: r.ckTable || r.lakeTable || key,
      rule: '分区对账',
      content: `partition=${r.partitionKey || '—'}`,
      threshold: '近窗',
      job: r.job || '—',
      ok,
      statusLabel: ok ? '通过' : '失败',
    })
  }
  return [...byMetric.values()]
})

const delistHint = computed(() => {
  const fails = boardCards.value.filter((c) => !c.ready)
  if (!fails.length) {
    return {
      title: '当前无摘牌指标',
      desc: boardCards.value.length ? '核心看板分区对账均通过' : '暂无看板数据',
      tone: 'ok',
    }
  }
  const first = fails[0]
  return {
    title: `数据未就绪：${first.metricCode}`,
    desc: first.reason || '分区对账未通过，禁止进核心看板热路径',
    tone: 'warn',
  }
})

function formatCheckedAt(t) {
  if (!t) return '—'
  if (typeof t === 'string') return t.length > 16 ? t.slice(0, 16).replace('T', ' ') : t
  try {
    return new Date(t).toISOString().slice(0, 16).replace('T', ' ')
  } catch {
    return String(t)
  }
}

async function loadReconBoard() {
  reconLoading.value = true
  loadError.value = ''
  try {
    const [recon, board, rules, diffs] = await Promise.all([
      fetchReconPartition({ limit: 30 }),
      fetchMetricBoard().catch(() => null),
      fetchReconRules().catch(() => null),
      fetchReconDiff({ limit: 30 }).catch(() => null),
    ])
    if (recon) {
      reconRows.value = recon.records || []
      reconSummary.value = {
        passCount: recon.passCount ?? 0,
        failCount: recon.failCount ?? 0,
      }
    } else {
      reconRows.value = []
    }
    ruleApiRows.value = rules?.records || []
    diffRows.value = diffs?.records || []
    if (board) {
      boardCards.value = board.cards || []
      boardReady.value = board.readyCount ?? 0
      boardBlocked.value = board.blockedCount ?? 0
    } else {
      boardCards.value = []
      boardReady.value = 0
      boardBlocked.value = 0
    }
  } catch (e) {
    reconRows.value = []
    boardCards.value = []
    ruleApiRows.value = []
    diffRows.value = []
    loadError.value = e?.message || '对账数据拉取失败'
    showToast(loadError.value, 'warning')
  } finally {
    reconLoading.value = false
  }
}

onMounted(() => {
  loadReconBoard()
})

function degradeDrill() {
  showToast('元数据服务降级演练 · 需后端预案接口', 'info')
}

function backupLog() {
  showToast('暂无备份记录', 'info')
}

function goOps() {
  router.push('/ops')
}

function newReconcileRule() {
  showToast('请在对账规则中新建（支持五类规则类型）', 'info')
}

async function rerunReconcile() {
  try {
    const code = boardCards.value.find((c) => c.metricCode)?.metricCode || reconRows.value[0]?.metricCode
    if (!code) {
      showToast('暂无可重跑的指标', 'warning')
      return
    }
    await runReconPartition({ metricCode: code })
    showToast(`已登记分区对账 · ${code}`, 'success')
    await loadReconBoard()
  } catch (e) {
    showToast(e?.message || '对账登记失败', 'warning')
  }
}

function drillDiff(row) {
  if (diffRows.value.length) {
    const hit = diffRows.value.find(
      (d) =>
        (d.lakeTable && String(d.lakeTable).includes(String(row.table || ''))) ||
        (row.table && String(row.table).includes(String(d.lakeTable || ''))),
    )
    if (hit) {
      showToast(
        `差异 ${hit.diffType} · pk=${hit.pkValue || '—'} · ${hit.partitionKey || ''}`,
        'info',
      )
      return
    }
  }
  if (!row.drillDetail) return
  showToast(`差异下钻 · ${row.table}\n${row.drillDetail}`, 'info')
}

async function forceReimport() {
  const table =
    reconRows.value.find((r) => r.status !== 'pass')?.ckTable ||
    reconRows.value[0]?.ckTable ||
    reconRows.value[0]?.lakeTable
  if (!table) {
    showToast('暂无可重导表', 'warning')
    return
  }
  try {
    await rewriteCk(table, { note: 'portal rewrite-ck' })
    showToast(`已提交 rewrite-ck · ${table}`, 'success')
    await loadReconBoard()
  } catch (e) {
    showToast(e?.message || '重导失败', 'warning')
  }
}

async function goldenDelist() {
  const table =
    boardCards.value.find((c) => !c.ready)?.metricCode ||
    reconRows.value.find((r) => r.status !== 'pass')?.ckTable ||
    reconRows.value[0]?.ckTable
  if (!table) {
    showToast('暂无可摘牌对象', 'warning')
    return
  }
  try {
    await postReconGolden('delist', { lakeTable: table, note: 'portal delist' })
    showToast(`已摘牌 · ${table}`, 'success')
    await loadReconBoard()
  } catch (e) {
    showToast(e?.message || '摘牌失败', 'warning')
  }
}
</script>

<template>
  <div class="rel-page">
    <PageHeader
      page-id="reliability"
      title="可靠性中心"
      subtitle="高可用 · 降级预案 · 备份恢复 · 对账摘牌与恢复"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="degradeDrill">降级演练</button>
      <button type="button" class="btn btn-sm" @click="backupLog">备份记录</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goOps">任务运维</button>
    </PageHeader>

    <div v-if="loadError" class="tip" style="margin-bottom: 12px">{{ loadError }}</div>

    <div class="kpi-grid rel-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div
          class="kpi-trend"
          :class="k.trendWarn ? 'warn' : k.trendUp ? 'up' : 'down'"
        >
          {{ k.trend }}
        </div>
      </div>
    </div>

    <div class="card rel-section">
      <div class="card-header">
        <div class="card-title">组件可用性与降级预案</div>
      </div>
      <div class="card-body">
        <div class="tip">暂无组件 HA 实时数据（待观测 API）</div>
      </div>
    </div>

    <div class="grid grid-2 rel-section">
      <div class="card">
        <div class="card-header">
          <div class="card-title">备份策略</div>
        </div>
        <div class="card-body">
          <div class="tip">暂无备份策略数据</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">流式合并 SLA</div>
        </div>
        <div class="card-body" style="padding: 14px">
          <div class="tip">暂无合并 SLA 数据（可至生命周期中心查看）</div>
        </div>
      </div>
    </div>

    <div class="card rel-section">
      <div class="card-header">
        <div class="card-title">
          湖仓对账规则 <span class="tip">· 按指标近窗对账聚合</span>
        </div>
        <button type="button" class="btn btn-sm" @click="newReconcileRule">新建对账规则</button>
      </div>
      <div class="card-body" style="padding: 0">
        <div v-if="!ruleRows.length" class="tip" style="padding: 12px">暂无</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>表</th>
              <th>规则</th>
              <th>比对内容</th>
              <th>频率</th>
              <th>调度作业</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in ruleRows" :key="i">
              <td><code>{{ r.table }}</code></td>
              <td>{{ r.rule }}</td>
              <td style="font-size: 11px">{{ r.content }}</td>
              <td style="font-size: 11px">{{ r.threshold }}</td>
              <td><code style="font-size: 11px">{{ r.job }}</code></td>
              <td>
                <span class="tag" :class="r.ok ? 'tag-green' : 'tag-red'" style="font-size: 10px">
                  {{ r.statusLabel }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2 rel-section">
      <div class="card">
        <div class="card-header">
          <div class="card-title">对账执行历史 <span class="tip">· 差异根因下钻</span></div>
          <button type="button" class="btn btn-sm" @click="rerunReconcile">重跑对账</button>
        </div>
        <div class="card-body rel-history-body">
          <div v-if="!liveHistory.length" class="tip" style="padding: 12px">暂无</div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>表</th>
                <th>规则</th>
                <th>差异</th>
                <th>下钻</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(h, i) in liveHistory" :key="i">
                <td style="font-size: 11px">{{ h.time }}</td>
                <td><code>{{ h.table }}</code></td>
                <td>{{ h.rule }}</td>
                <td>
                  <b v-if="!h.ok" class="text-danger">{{ h.diff }}</b>
                  <span v-else class="text-success">{{ h.diff }}</span>
                </td>
                <td>
                  <button
                    v-if="h.drillDetail"
                    type="button"
                    class="btn-link btn-sm"
                    @click="drillDiff(h)"
                  >
                    下钻
                  </button>
                  <span v-else class="tag tag-green" style="font-size: 10px">✓</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card rel-delist-card">
        <div class="card-header">
          <div class="card-title">摘牌与恢复闭环 <span class="tip">· 以湖表为准</span></div>
          <span class="tag" :class="boardBlocked > 0 ? 'tag-red' : 'tag-green'">
            {{ reconLoading ? '…' : boardBlocked > 0 ? `${boardBlocked} 未就绪` : '全部就绪' }}
          </span>
        </div>
        <div class="card-body rel-delist-body">
          <div class="rel-delist-alert">
            <div class="rel-delist-title">{{ delistHint.title }}</div>
            <div class="rel-delist-desc">{{ delistHint.desc }}</div>
            <div class="rel-delist-hint">
              看板就绪 {{ boardReady }} · 阻断 {{ boardBlocked }} · 近窗对账 pass
              {{ reconSummary.passCount }} / fail {{ reconSummary.failCount }}
            </div>
          </div>
          <div style="margin-top: 8px">
            <button type="button" class="btn btn-sm" @click="goldenDelist">黄金摘牌</button>
            <button type="button" class="btn btn-sm btn-primary" style="margin-left: 6px" @click="forceReimport">
              强制重导加速层
            </button>
            <button type="button" class="btn btn-sm" style="margin-left: 6px" @click="rerunReconcile">
              重跑对账
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<style scoped>
.rel-kpi {
  grid-template-columns: repeat(5, 1fr);
}
@media (max-width: 1200px) {
  .rel-kpi {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 700px) {
  .rel-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}

.kpi-trend.warn {
  color: var(--warning);
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.rel-section {
  margin-top: 16px;
}

.rel-ha-body {
  padding: 14px;
}

.rel-ha-grid {
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 900px) {
  .rel-ha-grid {
    grid-template-columns: 1fr;
  }
}

.ha-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--bg-1);
  transition: all 0.15s;
}
.ha-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.ha-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ha-name {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ha-rows {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.8;
}
.ha-rows b {
  color: var(--text-1);
}

.rel-compact-hint {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 10px;
}

.rel-history-body {
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
}

.text-danger {
  color: var(--danger);
}
.text-success {
  color: var(--success);
}

.rel-delist-card {
  border-color: var(--danger);
}
.rel-delist-body {
  font-size: 12px;
  line-height: 1.8;
}

.flow-chain {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 4px;
  overflow-x: auto;
}
.flow-node {
  flex: 1;
  min-width: 88px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
  font-size: 12px;
}
.flow-node.danger {
  border-color: var(--danger);
  background: var(--danger-light);
}
.flow-node.warning {
  border-color: var(--warning);
  background: var(--warning-light);
}
.flow-arrow {
  align-self: center;
  color: var(--primary);
  font-size: 18px;
  padding: 0 6px;
  flex-shrink: 0;
}
.fn-icon {
  font-size: 22px;
}
.fn-title {
  font-weight: 600;
  margin-top: 4px;
}
.fn-sub {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 2px;
}
.fn-sub.warn {
  color: var(--warning);
}

.rel-delist-alert {
  margin-top: 10px;
  padding: 10px;
  background: var(--danger-light);
  border-radius: 6px;
}
.rel-delist-title {
  font-weight: 600;
  color: var(--danger);
  margin-bottom: 4px;
}
.rel-delist-desc {
  color: var(--text-2);
  font-size: 11px;
}
.rel-delist-hint {
  color: var(--text-3);
  font-size: 11px;
  margin-top: 4px;
}
</style>
