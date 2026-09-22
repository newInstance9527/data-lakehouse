<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  fetchCatalogMaps,
  fetchQueryGovCosts,
  fetchQueryGovOverview,
  fetchQuerySurface,
  formatScanBytes,
  upsertCatalogMap,
} from '@/api/query'
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
const route = useRoute()
const { showToast } = useToast()
const guide = pageGuideOf('querygov')

const loading = ref(false)
const costsLoading = ref(false)
const live = ref(false)
const costsLive = ref(false)
const overview = ref(null)
const costsPayload = ref(null)

const costRange = ref(typeof route.query.range === 'string' ? route.query.range : '30d')
const costWs = ref(typeof route.query.ws === 'string' ? route.query.ws : '')

const surface = ref(null)
const catalogMaps = ref([])
const surfaceLoading = ref(false)
const mapSaving = ref(false)
const mapForm = ref({
  ws: 'default',
  gravCatalog: 'clickhouse',
  trinoCatalog: 'clickhouse',
  kind: 'federated',
  enabled: true,
  remark: '',
})
const lastChecklist = ref([])
const lastMapMessage = ref('')

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

const costRows = computed(() => {
  const items = costsPayload.value?.items
  if (Array.isArray(items) && items.length) {
    return items.map((d) => ({
      name: d.name || d.ws || d.key,
      ws: d.ws,
      cost: d.totalLabel || formatCny(d.totalCost),
      detail: [
        d.storageCost != null ? `存 ¥${Number(d.storageCost).toFixed(0)}` : null,
        d.computeCost != null ? `算 ¥${Number(d.computeCost).toFixed(0)}` : null,
        d.aiCost != null ? `AI ¥${Number(d.aiCost).toFixed(0)}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      trend: d.trend || '',
      pct: Math.min(100, Number(d.pct) || 0),
    }))
  }
  return COST_DOMAINS.map((d) => ({
    name: d.domain,
    cost: d.total,
    detail: '',
    trend: d.trend,
    pct: Math.min(100, Math.round((Number(String(d.total).replace(/[^\d]/g, '')) || 0) / 200)),
  }))
})

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

const surfaceChips = computed(() => {
  const s = surface.value
  if (!s) return null
  return {
    whitelist: Array.isArray(s.whitelist) ? s.whitelist : [],
    live: Array.isArray(s.liveCatalogs) ? s.liveCatalogs : [],
    queryable: Array.isArray(s.queryable) ? s.queryable : [],
    liveError: s.liveError || '',
  }
})

function formatCny(v) {
  if (v == null || Number.isNaN(Number(v))) return '¥0'
  return `¥${Number(v).toFixed(2)}`
}

async function loadOverview() {
  loading.value = true
  try {
    const data = await fetchQueryGovOverview()
    overview.value = data || null
    live.value = !!data
    if (data?.querySurface) {
      surface.value = data.querySurface
    }
  } catch (e) {
    overview.value = null
    live.value = false
    showToast(e?.message || '治理总览拉取失败，展示演示数据', 'warning')
  } finally {
    loading.value = false
  }
}

async function loadCosts() {
  costsLoading.value = true
  try {
    const data = await fetchQueryGovCosts({
      range: costRange.value || '30d',
      group: 'ws',
      ws: costWs.value || undefined,
    })
    costsPayload.value = data || null
    costsLive.value = !!(data && Array.isArray(data.items))
  } catch (e) {
    costsPayload.value = null
    costsLive.value = false
    showToast(e?.message || '成本卡拉取失败，展示演示分摊', 'warning')
  } finally {
    costsLoading.value = false
  }
}

async function loadFederation() {
  surfaceLoading.value = true
  try {
    const [surf, maps] = await Promise.all([
      fetchQuerySurface().catch(() => null),
      fetchCatalogMaps({ ws: mapForm.value.ws }).catch(() => []),
    ])
    if (surf) surface.value = surf
    catalogMaps.value = Array.isArray(maps) ? maps : []
  } catch (e) {
    showToast(e?.message || '查询面/映射拉取失败', 'warning')
  } finally {
    surfaceLoading.value = false
  }
}

async function saveCatalogMap() {
  const f = mapForm.value
  if (!f.gravCatalog?.trim() || !f.trinoCatalog?.trim()) {
    showToast('gravCatalog / trinoCatalog 不能为空', 'warning')
    return
  }
  mapSaving.value = true
  lastChecklist.value = []
  lastMapMessage.value = ''
  try {
    const res = await upsertCatalogMap({
      ws: f.ws || 'default',
      gravCatalog: f.gravCatalog.trim(),
      trinoCatalog: f.trinoCatalog.trim(),
      kind: f.kind || 'federated',
      enabled: !!f.enabled,
      remark: f.remark || undefined,
    })
    lastChecklist.value = Array.isArray(res?.checklist) ? res.checklist : []
    lastMapMessage.value = res?.message || (res?.queryable ? '已开通' : '已保存')
    showToast(lastMapMessage.value, res?.queryable ? 'success' : 'info')
    await loadFederation()
  } catch (e) {
    showToast(e?.message || '联邦开通失败（须先在 Trino 挂载 catalog）', 'error')
  } finally {
    mapSaving.value = false
  }
}

function fillMapFromRow(row) {
  if (!row) return
  mapForm.value = {
    ws: row.ws || 'default',
    gravCatalog: row.gravCatalog || '',
    trinoCatalog: row.trinoCatalog || '',
    kind: row.kind || 'federated',
    enabled: row.enabled !== false,
    remark: row.remark || '',
  }
}

function newQueryRule() {
  showToast('规则 SoT = CpQueryScanGuard（与即席 exec 同源）；外置配置表 P1', 'info')
}

function exportCostReport() {
  const items = costsPayload.value?.items
  if (!Array.isArray(items) || !items.length) {
    showToast('暂无成本数据可导出；请先刷新成本卡', 'warning')
    return
  }
  const header = ['ws', 'name', 'storageCost', 'computeCost', 'aiCost', 'totalCost', 'scanBytes', 'queryCount']
  const lines = [header.join(',')]
  for (const r of items) {
    lines.push(
      [
        r.ws,
        JSON.stringify(r.name || ''),
        r.storageCost,
        r.computeCost,
        r.aiCost,
        r.totalCost,
        r.scanBytes,
        r.queryCount,
      ].join(','),
    )
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `querygov-costs-ws-${costRange.value || '30d'}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
  showToast('已导出成本分摊 CSV（group=ws）', 'success')
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

function applyCostFilters() {
  const q = { ...route.query, range: costRange.value || '30d' }
  if (costWs.value) q.ws = costWs.value
  else delete q.ws
  router.replace({ query: q })
  loadCosts()
}

watch(
  () => [route.query.ws, route.query.range],
  ([ws, range]) => {
    if (typeof ws === 'string') costWs.value = ws
    if (typeof range === 'string') costRange.value = range
  },
)

onMounted(() => {
  loadOverview()
  loadFederation()
  loadCosts()
})
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

    <div class="card qg-section">
      <div class="card-header">
        <div class="card-title">
          🔗 查询面与联邦源
          <span class="tip">· whitelist ∩ SHOW CATALOGS · POST catalog-map</span>
        </div>
        <button type="button" class="btn btn-sm" :disabled="surfaceLoading" @click="loadFederation">
          {{ surfaceLoading ? '…' : '刷新查询面' }}
        </button>
      </div>
      <div class="card-body">
        <div v-if="surfaceChips" class="fed-chips">
          <div class="fed-chip-row">
            <span class="fed-label">白名单</span>
            <code v-for="c in surfaceChips.whitelist" :key="'w-' + c" class="fed-tag">{{ c }}</code>
            <span v-if="!surfaceChips.whitelist.length" class="tip">（空）</span>
          </div>
          <div class="fed-chip-row">
            <span class="fed-label">实况</span>
            <code v-for="c in surfaceChips.live" :key="'l-' + c" class="fed-tag live">{{ c }}</code>
            <span v-if="!surfaceChips.live.length" class="tip">（不可达或空）</span>
          </div>
          <div class="fed-chip-row">
            <span class="fed-label">可查</span>
            <code v-for="c in surfaceChips.queryable" :key="'q-' + c" class="fed-tag ok">{{ c }}</code>
            <span v-if="!surfaceChips.queryable.length" class="tip">（无交集）</span>
          </div>
          <div v-if="surfaceChips.liveError" class="fed-err">{{ surfaceChips.liveError }}</div>
        </div>
        <div v-else class="tip">尚未拉到 query-surface；后端连通后刷新。</div>

        <div class="fed-grid">
          <div class="fed-form">
            <div class="fed-form-title">联邦开通</div>
            <label class="fed-field">
              <span>ws</span>
              <input v-model="mapForm.ws" type="text" />
            </label>
            <label class="fed-field">
              <span>gravCatalog</span>
              <input v-model="mapForm.gravCatalog" type="text" placeholder="clickhouse 或 ds_*" />
            </label>
            <label class="fed-field">
              <span>trinoCatalog</span>
              <input v-model="mapForm.trinoCatalog" type="text" placeholder="真实 Trino 名，如 clickhouse" />
            </label>
            <label class="fed-field">
              <span>kind</span>
              <input v-model="mapForm.kind" type="text" />
            </label>
            <label class="fed-check">
              <input v-model="mapForm.enabled" type="checkbox" />
              enabled
            </label>
            <label class="fed-field">
              <span>remark</span>
              <input v-model="mapForm.remark" type="text" />
            </label>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="mapSaving"
              @click="saveCatalogMap"
            >
              {{ mapSaving ? '保存中…' : '开通 / 更新映射' }}
            </button>
            <p v-if="lastMapMessage" class="fed-msg">{{ lastMapMessage }}</p>
            <ul v-if="lastChecklist.length" class="fed-check-list">
              <li v-for="(line, i) in lastChecklist" :key="i">{{ line }}</li>
            </ul>
          </div>
          <div class="fed-maps">
            <div class="fed-form-title">已登记映射</div>
            <table v-if="catalogMaps.length" class="table">
              <thead>
                <tr>
                  <th>Grav</th>
                  <th>Trino</th>
                  <th>kind</th>
                  <th>启用</th>
                  <th>可查</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="m in catalogMaps"
                  :key="m.id || m.gravCatalog"
                  class="audit-row"
                  @click="fillMapFromRow(m)"
                >
                  <td><code>{{ m.gravCatalog }}</code></td>
                  <td><code>{{ m.trinoCatalog }}</code></td>
                  <td>{{ m.kind || '—' }}</td>
                  <td>{{ m.enabled ? '是' : '否' }}</td>
                  <td>{{ m.inQueryable ? '✓' : '○' }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="tip">暂无映射（或未连通）。一期目标：clickhouse 自映射。</div>
          </div>
        </div>
      </div>
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
        <div class="card-title">
          💰 成本分摊
          <span class="tip">· group=ws · 存储+扫描+AI</span>
        </div>
        <div class="cost-filters">
          <select v-model="costRange" class="cost-select" @change="applyCostFilters">
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
          </select>
          <input
            v-model="costWs"
            class="cost-ws"
            type="text"
            placeholder="ws（空=全部）"
            @keyup.enter="applyCostFilters"
          />
          <button type="button" class="btn btn-sm" :disabled="costsLoading" @click="applyCostFilters">
            {{ costsLoading ? '…' : '刷新成本' }}
          </button>
        </div>
      </div>
      <div class="card-body">
        <div v-if="costsLive" class="tip cost-live">
          已接真 /lh/observability/costs?group=ws · range={{ costsPayload?.range || costRange }}
          <template v-if="costsPayload?.totals?.totalCost != null">
            · 合计 {{ formatCny(costsPayload.totals.totalCost) }}
          </template>
        </div>
        <div v-else class="tip cost-live">未连通时展示按域演示；连通后按空间聚合</div>
        <div class="cost-grid">
          <div v-for="d in costRows" :key="d.ws || d.name" class="cost-item">
            <div class="cost-name">{{ d.name }}<code v-if="d.ws" class="cost-ws-tag">{{ d.ws }}</code></div>
            <div class="cost-bar">
              <div class="cost-fill" :style="{ width: d.pct + '%' }" />
            </div>
            <div class="cost-meta">
              <span>{{ d.cost }}<span v-if="d.detail" class="cost-detail"> · {{ d.detail }}</span></span>
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
.cost-name { font-weight: 600; margin-bottom: 4px; display: flex; gap: 8px; align-items: center; }
.cost-ws-tag {
  font-weight: 400;
  font-size: 10px;
  padding: 0 4px;
  background: var(--bg-2);
  border-radius: 3px;
}
.cost-filters { display: flex; gap: 8px; align-items: center; }
.cost-select, .cost-ws {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-1);
  font-size: 12px;
}
.cost-ws { width: 120px; }
.cost-live { margin-bottom: 10px; }
.cost-detail { color: var(--text-3); font-weight: 400; }
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
.fed-chips { margin-bottom: 14px; }
.fed-chip-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
}
.fed-label {
  min-width: 48px;
  color: var(--text-3);
  font-weight: 600;
}
.fed-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-2);
  font-size: 11px;
}
.fed-tag.live { background: #e6f4ff; }
.fed-tag.ok { background: #f6ffed; }
.fed-err {
  margin-top: 6px;
  font-size: 12px;
  color: var(--danger, #cf1322);
}
.fed-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 16px;
}
@media (max-width: 900px) {
  .fed-grid { grid-template-columns: 1fr; }
}
.fed-form-title {
  font-weight: 600;
  margin-bottom: 10px;
  font-size: 13px;
}
.fed-field {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}
.fed-field input {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-1);
}
.fed-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin: 8px 0;
}
.fed-msg { font-size: 12px; margin-top: 8px; color: var(--text-2); }
.fed-check-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--text-3);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
</style>
