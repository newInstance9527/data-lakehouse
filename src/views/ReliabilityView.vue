<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import { fetchMetricBoard, fetchReconPartition, runReconPartition } from '@/api/metric'
import {
  COMPACTION_TABLES,
  HA_COMPONENTS,
  REL_BACKUP_LOG,
  REL_BACKUP_ROWS,
  REL_DELIST_FLOW,
  REL_KPIS,
  REL_RECONCILE_HISTORY,
  REL_RECONCILE_RULES,
  compactionSlaMeta,
  haStatusMeta,
} from '@/data/reliability'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('reliability')

const reconRows = ref([])
const reconSummary = ref({ passCount: 0, failCount: 0 })
const boardCards = ref([])
const boardReady = ref(0)
const boardBlocked = ref(0)
const reconLoading = ref(false)

const liveHistory = computed(() => {
  if (!reconRows.value.length) return REL_RECONCILE_HISTORY
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
        `Iceberg rows=${lake}`,
        `ClickHouse rows=${ck}`,
        `status=${r.status}`,
        r.traceId ? `trace=${r.traceId}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    }
  })
})

const delistHint = computed(() => {
  const fails = boardCards.value.filter((c) => !c.ready)
  if (!fails.length) {
    return { title: '当前无摘牌指标', desc: '核心看板分区对账均通过', tone: 'ok' }
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
  try {
    const [recon, board] = await Promise.all([
      fetchReconPartition({ limit: 30 }).catch(() => null),
      fetchMetricBoard().catch(() => null),
    ])
    if (recon) {
      reconRows.value = recon.records || []
      reconSummary.value = {
        passCount: recon.passCount ?? 0,
        failCount: recon.failCount ?? 0,
      }
    }
    if (board) {
      boardCards.value = board.cards || []
      boardReady.value = board.readyCount ?? 0
      boardBlocked.value = board.blockedCount ?? 0
    }
  } finally {
    reconLoading.value = false
  }
}

onMounted(() => {
  loadReconBoard()
})

function degradeDrill() {
  showToast('🎭 Gravitino 降级演练 · 模拟 Catalog 挂 → 只读缓存 → 验证查询不中断', 'info')
}

function backupLog() {
  showToast(`📊 备份记录\n${REL_BACKUP_LOG}`, 'info')
}

function goOps() {
  router.push('/ops')
}

function goCatalog(table) {
  router.push({ path: '/catalog', query: { q: table } })
}

function newReconcileRule() {
  showToast('＋ 新建对账规则（演示）· 选表 → 规则类型 → 阈值 → 绑 DS 作业', 'info')
}

async function rerunReconcile() {
  try {
    const code = boardCards.value.find((c) => c.metricCode)?.metricCode || 'M-0001'
    await runReconPartition({ metricCode: code })
    showToast(`↻ 已登记分区对账 · ${code}`, 'success')
    await loadReconBoard()
  } catch (e) {
    showToast(e?.message || '对账登记失败', 'warning')
  }
}

function drillDiff(row) {
  if (!row.drillDetail) return
  showToast(`🔍 差异下钻 · ${row.table}\n${row.drillDetail}`, 'info')
}

function forceReimport() {
  showToast('🔧 强制重导 CK · 以 Iceberg 为准 → 重导后自动对账 → 通过则恢复黄金', 'success')
}
</script>

<template>
  <div class="rel-page">
    <PageHeader
      title="可靠性中心"
      subtitle="组件 HA · 降级预案 · 备份恢复 · 流式 compaction SLA · Gravitino 只读缓存"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="degradeDrill">🎭 降级演练</button>
      <button type="button" class="btn btn-sm" @click="backupLog">📊 备份记录</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goOps">🔗 任务运维</button>
    </PageHeader>

    <div class="kpi-grid rel-kpi">
      <div v-for="(k, i) in REL_KPIS" :key="i" class="kpi-card" :class="k.color">
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
        <div class="card-title">🛡️ 组件可用性与降级预案 <span class="tip">· 8 个核心组件</span></div>
      </div>
      <div class="card-body rel-ha-body">
        <div class="grid grid-3 rel-ha-grid">
          <div v-for="c in HA_COMPONENTS" :key="c.name" class="ha-card">
            <div class="ha-head">
              <div class="ha-name">{{ c.icon }} {{ c.name }}</div>
              <span class="tag" :class="haStatusMeta(c.status).tag" style="font-size: 10px">
                {{ haStatusMeta(c.status).label }}
              </span>
            </div>
            <div class="ha-rows">
              <div><b>HA：</b>{{ c.ha }}</div>
              <div><b>降级：</b>{{ c.degrade }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 rel-section">
      <div class="card">
        <div class="card-header">
          <div class="card-title">💾 备份策略</div>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>对象</th>
                <th>策略</th>
                <th>RPO</th>
                <th>最近备份</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in REL_BACKUP_ROWS" :key="r.object">
                <td>{{ r.object }}</td>
                <td style="font-size: 11px">{{ r.strategy }}</td>
                <td style="font-size: 11px">{{ r.rpo }}</td>
                <td>
                  <span class="tag" :class="r.lastTag" style="font-size: 10px">{{ r.last }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">⚡ 流式 compaction SLA</div>
        </div>
        <div class="card-body" style="padding: 14px">
          <div class="rel-compact-hint">
            Flink equality delete 制造小文件，必须按表定义 compaction 间隔。
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>表</th>
                <th>ingest 速率</th>
                <th>compaction 间隔</th>
                <th>文件数</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in COMPACTION_TABLES" :key="t.table">
                <td>
                  <button type="button" class="btn-link" @click="goCatalog(t.table)">
                    {{ t.table }}
                  </button>
                </td>
                <td style="font-size: 11px">{{ t.rate }}</td>
                <td style="font-size: 11px"><b>{{ t.interval }}</b></td>
                <td style="text-align: center">{{ t.files }}</td>
                <td>
                  <span class="tag" :class="compactionSlaMeta(t.sla).tag" style="font-size: 10px">
                    {{ compactionSlaMeta(t.sla).label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card rel-section">
      <div class="card-header">
        <div class="card-title">
          🔍 湖/CK 对账规则 · §33.1 <span class="tip">· 按表配置 · 导入后 30min 执行</span>
        </div>
        <button type="button" class="btn btn-sm" @click="newReconcileRule">＋ 新建对账规则</button>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>表</th>
              <th>规则</th>
              <th>比对内容</th>
              <th>阈值</th>
              <th>DS 作业</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in REL_RECONCILE_RULES" :key="i">
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
          <div class="card-title">📋 对账执行历史 · §33.2 <span class="tip">· 差异根因下钻</span></div>
          <button type="button" class="btn btn-sm" @click="rerunReconcile">↻ 重跑对账</button>
        </div>
        <div class="card-body rel-history-body">
          <table class="table">
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
                    🔍 下钻
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
          <div class="card-title">🚦 摘牌与恢复闭环 · §33.3 <span class="tip">· 以 Iceberg 为准</span></div>
          <span class="tag" :class="boardBlocked > 0 ? 'tag-red' : 'tag-green'">
            {{ reconLoading ? '…' : boardBlocked > 0 ? `${boardBlocked} 未就绪` : '全部就绪' }}
          </span>
        </div>
        <div class="card-body rel-delist-body">
          <div class="flow-chain rel-flow">
            <template v-for="(node, ni) in REL_DELIST_FLOW" :key="ni">
              <div v-if="ni > 0" class="flow-arrow">→</div>
              <div class="flow-node" :class="node.tone">
                <div class="fn-icon">{{ node.icon }}</div>
                <div class="fn-title">{{ node.title }}</div>
                <div v-if="node.sub" class="fn-sub" :class="{ warn: node.tone === 'warning' }">
                  {{ node.sub }}
                </div>
              </div>
            </template>
          </div>
          <div class="rel-delist-alert">
            <div class="rel-delist-title">{{ delistHint.title }}</div>
            <div class="rel-delist-desc">{{ delistHint.desc }}</div>
            <div class="rel-delist-hint">
              看板就绪 {{ boardReady }} · 阻断 {{ boardBlocked }} · 近窗对账 pass
              {{ reconSummary.passCount }} / fail {{ reconSummary.failCount }}
            </div>
          </div>
          <div style="margin-top: 8px">
            <button type="button" class="btn btn-sm btn-primary" @click="forceReimport">
              🔧 强制重导 CK
            </button>
            <button type="button" class="btn btn-sm" style="margin-left: 6px" @click="rerunReconcile">
              ↻ 重跑对账
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
