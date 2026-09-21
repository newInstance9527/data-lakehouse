<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import { fetchQueryGovOverview, formatScanBytes } from '@/api/query'
import {
  COST_DOMAINS,
  QG_KPIS,
  QG_RULES,
  QUERY_AUDITS,
  TRINO_QUEUES,
  auditStatusMeta,
  costTrendClass,
  truncateQuery,
} from '@/data/querygov'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('querygov')

const loading = ref(false)
const live = ref(false)
const overview = ref(null)

const kpis = computed(() => {
  const list = overview.value?.kpis
  if (!Array.isArray(list) || !list.length) return QG_KPIS
  const colors = ['blue', 'green', 'orange', 'purple', 'red']
  const icons = ['🎚️', '✅', '⚠️', '💰', '📦']
  return list.map((k, i) => ({
    icon: icons[i % icons.length],
    color: colors[i % colors.length],
    value: k.value,
    unit: k.unit || '',
    label: k.label,
    trend: k.trend || '',
    trendUp: true,
    trendWarn: k.key === 'blocked',
    trendDanger: k.key === 'failed',
  }))
})

const queues = computed(() => {
  const list = overview.value?.queues
  if (!Array.isArray(list) || !list.length) return TRINO_QUEUES
  return list.map((q) => ({
    name: q.name,
    icon: q.icon || '💻',
    priority: q.priority || '中',
    concurrent: q.concurrentLive != null ? `${q.concurrentLive}/${q.concurrent}` : q.concurrent,
    qps: q.name === 'adhoc' ? '即席' : '—',
    scanLimit: q.scanLimit,
    desc: q.desc,
  }))
})

const rules = computed(() => {
  const list = overview.value?.rules
  if (!Array.isArray(list) || !list.length) {
    return QG_RULES.map((r, i) => ({
      id: `D${i + 1}`,
      name: r.rule,
      action: r.action,
      desc: `${r.threshold} · ${r.notify}`,
      source: 'demo',
    }))
  }
  return list.map((r) => ({
    id: r.id,
    name: r.name,
    action: r.action,
    desc: r.desc,
    source: r.source,
  }))
})

const costRows = computed(() =>
  COST_DOMAINS.map((d) => ({
    name: d.domain,
    cost: d.total,
    trend: d.trend,
    pct: Math.min(100, Math.round((Number(String(d.total).replace(/[^\d]/g, '')) || 0) / 200)),
  })),
)

const audits = computed(() => {
  const list = overview.value?.audits
  if (!Array.isArray(list) || !list.length) return QUERY_AUDITS
  return list.map((a) => ({
    user: a.user || '—',
    query: a.summary || a.sql || '—',
    scan: a.scan || formatScanBytes(a.scanBytes),
    time: a.duration || '—',
    queue: 'adhoc',
    status: a.status || 'ok',
    sql: a.sql,
  }))
})

async function loadOverview() {
  loading.value = true
  try {
    const data = await fetchQueryGovOverview()
    overview.value = data || null
    live.value = !!data
  } catch (e) {
    overview.value = null
    live.value = false
    showToast(e?.message || '治理总览拉取失败，展示演示数据', 'warning')
  } finally {
    loading.value = false
  }
}

function newQueryRule() {
  showToast('规则 SoT = CpQueryScanGuard（与即席 exec 同源）；外置配置表 P1', 'info')
}

function exportCostReport() {
  showToast('成本报表（FinOps）P1：当前可导出审计 CSV 从即席历史', 'info')
}

function goQuery() {
  router.push('/query')
}

function openAudit(a) {
  if (a?.sql) {
    router.push({ path: '/query', query: { sql: a.sql } })
  } else {
    goQuery()
  }
}

onMounted(loadOverview)
</script>

<template>
  <div class="qg-page">
    <PageHeader
      title="查询治理与成本"
      subtitle="规则/队列与即席同源 · Trino 扫描限额 · cp_query_exec 审计"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" :disabled="loading" @click="loadOverview">
        {{ loading ? '…' : '刷新' }}
      </button>
      <button type="button" class="btn btn-sm" @click="newQueryRule">＋ 查询规则</button>
      <button type="button" class="btn btn-sm" @click="exportCostReport">📊 成本报表</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goQuery">🔗 即席查询</button>
    </PageHeader>

    <div v-if="!live" class="banner-soft">后端未连通时展示演示数据；连通后 KPI/审计来自 /lh/compute/query/gov/overview</div>
    <div v-else class="banner-ok">
      已接真：默认扫描
      {{ formatScanBytes(overview?.scanDefaultBytes) }} / 硬顶
      {{ formatScanBytes(overview?.scanHardBytes) }} · adhoc 在途
      {{ overview?.adhocConcurrent }}/{{ overview?.adhocMaxConcurrent }}
    </div>

    <div class="kpi-grid qg-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div
          class="kpi-trend"
          :class="k.trendDanger ? 'danger' : k.trendWarn ? 'warn' : k.trendUp ? 'up' : 'down'"
        >
          {{ k.trend }}
        </div>
      </div>
    </div>

    <div class="card qg-section">
      <div class="card-header">
        <div class="card-title">
          🎚️ Trino 查询队列
          <span class="tip">· adhoc 并发与扫描与即席 exec 同源</span>
        </div>
      </div>
      <div class="card-body qg-queue-body">
        <div class="grid grid-3 qg-queue-grid">
          <div v-for="q in queues" :key="q.name" class="queue-card">
            <div class="qc-head">
              <div class="qc-name">{{ q.icon }} {{ q.name }} 队列</div>
              <span class="tag tag-blue" style="font-size: 10px">优先级 {{ q.priority }}</span>
            </div>
            <div class="qc-desc">{{ q.desc }}</div>
            <div class="qc-stats">
              <div class="qc-stat">
                <div class="qcs-val">{{ q.concurrent }}</div>
                <div class="qcs-label">并发</div>
              </div>
              <div class="qc-stat">
                <div class="qcs-val">{{ q.qps }}</div>
                <div class="qcs-label">说明</div>
              </div>
              <div class="qc-stat">
                <div class="qcs-val qcs-limit">{{ q.scanLimit }}</div>
                <div class="qcs-label">扫描限额</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 qg-section">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 查询审计 Top <span class="tip">· 按扫描字节</span></div>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>用户</th>
                <th>查询</th>
                <th>扫描字节</th>
                <th>耗时</th>
                <th>队列</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(a, i) in audits"
                :key="i"
                class="audit-row"
                @click="openAudit(a)"
              >
                <td style="font-size: 11px">{{ a.user }}</td>
                <td>
                  <code style="font-size: 10px">{{ truncateQuery(a.query) }}</code>
                </td>
                <td>{{ a.scan }}</td>
                <td>{{ a.time }}</td>
                <td>{{ a.queue }}</td>
                <td>
                  <span class="tag" :class="auditStatusMeta(a.status).tag">
                    {{ auditStatusMeta(a.status).label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">📜 治理规则（与即席同源）</div>
        </div>
        <div class="card-body">
          <div v-for="r in rules" :key="r.id" class="rule-row">
            <div class="rule-id">{{ r.id }}</div>
            <div class="rule-body">
              <div class="rule-name">
                {{ r.name }}
                <span class="tag" :class="r.action === 'BLOCK' || r.action === 'REJECT' ? 'tag-red' : 'tag-blue'">
                  {{ r.action }}
                </span>
              </div>
              <div class="rule-desc">{{ r.desc }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card qg-section">
      <div class="card-header">
        <div class="card-title">💰 成本分摊（演示）</div>
      </div>
      <div class="card-body">
        <div class="cost-grid">
          <div v-for="d in costRows" :key="d.name" class="cost-item">
            <div class="cost-name">{{ d.name }}</div>
            <div class="cost-bar">
              <div class="cost-fill" :style="{ width: d.pct + '%' }" />
            </div>
            <div class="cost-meta">
              <span>{{ d.cost }}</span>
              <span :class="costTrendClass(d.trend)">{{ d.trend }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banner-soft,
.banner-ok {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}
.banner-soft {
  background: var(--warning-light, #fff7e6);
  color: var(--text-2);
}
.banner-ok {
  background: var(--success-light, #f6ffed);
  color: var(--text-2);
}
.qg-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .qg-kpi { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 720px) {
  .qg-kpi { grid-template-columns: repeat(2, 1fr); }
}
.qg-section { margin-bottom: 16px; }
.tip { font-weight: 400; color: var(--text-3); font-size: 12px; }
.qg-queue-grid { gap: 12px; }
.queue-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-1);
}
.qc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.qc-name { font-weight: 600; }
.qc-desc { font-size: 12px; color: var(--text-3); margin-bottom: 10px; }
.qc-stats { display: flex; gap: 12px; }
.qc-stat { flex: 1; text-align: center; }
.qcs-val { font-weight: 700; font-size: 16px; }
.qcs-limit { font-size: 12px; }
.qcs-label { font-size: 11px; color: var(--text-3); }
.audit-row { cursor: pointer; }
.audit-row:hover { background: var(--bg-2); }
.rule-row {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.rule-row:last-child { border-bottom: none; }
.rule-id {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--primary);
  min-width: 28px;
}
.rule-name { font-weight: 600; font-size: 13px; display: flex; gap: 8px; align-items: center; }
.rule-desc { font-size: 12px; color: var(--text-3); margin-top: 4px; }
.cost-grid { display: flex; flex-direction: column; gap: 10px; }
.cost-item { font-size: 12px; }
.cost-name { font-weight: 600; margin-bottom: 4px; }
.cost-bar {
  height: 6px;
  background: var(--bg-2);
  border-radius: 3px;
  overflow: hidden;
}
.cost-fill {
  height: 100%;
  background: var(--primary);
}
.cost-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  color: var(--text-3);
}
</style>
