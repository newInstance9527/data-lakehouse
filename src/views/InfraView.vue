<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useWsListScope } from '@/composables/useWsListScope'
import { pageGuideOf } from '@/data/pageGuides'
import {
  INFRA_LAYER_ROWS,
  emptyInfraKpis,
  infraBarColor,
  infraNodeStatusTag,
  infraProcStatusTag,
  infraSevTag,
} from '@/data/infra'
import {
  fetchObsInfraAlerts,
  fetchObsInfraCluster,
  fetchObsInfraContainers,
  fetchObsInfraNodes,
  fetchObsInfraProcs,
  fetchObsInfraSummary,
} from '@/api/observability'

const router = useRouter()
const { showToast } = useToast()
const { listWsParams, watchListScope } = useWsListScope()
const guide = pageGuideOf('infra')

const loading = ref(false)
const loadError = ref('')
const showKpis = ref(false)
const source = ref('empty')
const hint = ref('')
const kpis = ref(emptyInfraKpis())
const nodes = ref([])
const procs = ref([])
const alerts = ref([])
const containers = ref([])
const cluster = ref([])
const capacityTips = ref([])

const headerTags = computed(() => {
  const tags = []
  const down = nodes.value.filter((n) => n.st === 'down')
  const diskWarn = nodes.value.filter((n) => Number(n.disk) >= 85)
  if (down.length) tags.push({ tag: 'tag-red', text: `${down.length} NotReady` })
  if (diskWarn.length) tags.push({ tag: 'tag-orange', text: `${diskWarn.length} 磁盘将满` })
  return tags
})

async function loadBoard() {
  loading.value = true
  loadError.value = ''
  try {
    const params = listWsParams()
    const [sum, nodePage, procPage, alertPage, containerPage, clusterPage] = await Promise.all([
      fetchObsInfraSummary(params),
      fetchObsInfraNodes(params),
      fetchObsInfraProcs(params),
      fetchObsInfraAlerts(params),
      fetchObsInfraContainers(params),
      fetchObsInfraCluster(params),
    ])
    source.value = sum?.source || 'empty'
    hint.value = sum?.hint || ''
    kpis.value = Array.isArray(sum?.kpis) && sum.kpis.length ? sum.kpis : emptyInfraKpis()
    capacityTips.value = Array.isArray(sum?.capacityTips) ? sum.capacityTips : []
    nodes.value = Array.isArray(nodePage?.records) ? nodePage.records : []
    procs.value = Array.isArray(procPage?.records) ? procPage.records : []
    alerts.value = Array.isArray(alertPage?.records) ? alertPage.records : []
    containers.value = Array.isArray(containerPage?.records) ? containerPage.records : []
    cluster.value = Array.isArray(clusterPage?.records) ? clusterPage.records : []
  } catch (e) {
    loadError.value = e?.message || '基础设施 API 加载失败'
    source.value = 'empty'
    hint.value = ''
    kpis.value = emptyInfraKpis()
    nodes.value = []
    procs.value = []
    alerts.value = []
    containers.value = []
    cluster.value = []
    capacityTips.value = []
    showToast(loadError.value, 'warning')
  } finally {
    loading.value = false
  }
}

function exportDaily() {
  showToast('功能待接后端 · 无采集数据可导出', 'info')
}

function silenceWindow() {
  showToast('功能待接后端', 'info')
}

function silenceAlerts() {
  showToast('功能待接后端', 'info')
}

function goLinktrace() {
  router.push('/linktrace')
}

function goStorageTrend(bucket) {
  const q = {}
  if (bucket) q.bucket = bucket
  router.push({ path: '/lifecycle/storage', query: q })
}

function onAlertAct(a) {
  if (a.sev === '容量' || (a.t && String(a.t).includes('磁盘'))) {
    goStorageTrend()
    return
  }
  goLinktrace()
}

function onProcAct(p) {
  if (p.act === '链路→') {
    goLinktrace()
    return
  }
  if (p.act === '扩容' || (p.comp && String(p.comp).includes('MinIO'))) {
    goStorageTrend()
    return
  }
  if (p.act === '重试') {
    showToast('功能待接后端', 'info')
    return
  }
  showToast('功能待接后端', 'info')
}

function nodeTrend(n) {
  if (n.disk >= 85 || (n.comps && String(n.comps).includes('MinIO'))) {
    goStorageTrend()
    return
  }
  showToast('节点趋势待接监控时序', 'info')
}

function kpiTrendClass(k) {
  if (k.trendDanger) return 'danger'
  if (k.trendWarn) return 'warn'
  return k.trendUp ? 'up' : 'down'
}

onMounted(loadBoard)
watchListScope(loadBoard)
</script>

<template>
  <div class="infra-page">
    <PageHeader
      page-id="infra"
      title="基础设施监控"
      subtitle="节点资源 / 容器 / 集群 / 平台进程 · 任务与链路监控的底座"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" :disabled="loading" @click="loadBoard">
        {{ loading ? '刷新中…' : '↻ 刷新' }}
      </button>
      <button type="button" class="btn btn-sm" @click="exportDaily">📄 日报</button>
      <button type="button" class="btn btn-sm" @click="silenceWindow">🔇 维护静默</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goLinktrace">🧵 看链路影响</button>
    </PageHeader>

    <p class="tip infra-banner">
      指标来自真采集；未接入时列表为空。
      <span v-if="source && source !== 'empty'"> · 数据源 {{ source }}</span>
      <span v-if="hint"> · {{ hint }}</span>
    </p>
    <p v-if="loadError" class="tip infra-banner warn">加载失败：{{ loadError }}</p>

    <div class="ops-kpi-toggle">
      <button type="button" class="btn btn-sm" @click="showKpis = !showKpis">
        {{ showKpis ? '收起概览' : '展开概览 KPI' }}
      </button>
    </div>
    <div v-if="showKpis" class="kpi-grid infra-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="kpiTrendClass(k)">{{ k.trend }}</div>
      </div>
    </div>

    <div class="card infra-nodes-card">
      <div class="card-header">
        <div class="card-title">
          📊 节点资源四象限 · CPU / 内存 / 磁盘 / 网络
          <span class="tip">· 节点探针 · 点击节点看趋势</span>
        </div>
        <div class="infra-header-tags">
          <span v-for="(t, i) in headerTags" :key="i" class="tag" :class="t.tag">{{ t.text }}</span>
          <span v-if="!headerTags.length" class="tip">暂无节点告警标签</span>
        </div>
      </div>
      <div class="card-body infra-table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>节点</th>
              <th>角色</th>
              <th>承载组件</th>
              <th>CPU</th>
              <th>内存</th>
              <th>磁盘</th>
              <th>网络</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !nodes.length">
              <td colspan="8" class="empty-cell">加载中…</td>
            </tr>
            <tr v-else-if="!nodes.length">
              <td colspan="8" class="empty-cell">
                暂无节点。请接入 node_exporter / Categraf 后刷新
              </td>
            </tr>
            <tr
              v-for="n in nodes"
              :key="n.node"
              class="infra-node-row"
              @click="nodeTrend(n)"
            >
              <td><b>{{ n.node }}</b></td>
              <td>{{ n.role }}</td>
              <td class="comps-cell">{{ n.comps }}</td>
              <td>
                <span v-if="n.st === 'down'" class="muted">—</span>
                <div v-else class="infra-bar">
                  <div class="infra-bar-track">
                    <div
                      class="infra-bar-fill"
                      :style="{ width: n.cpu + '%', background: infraBarColor(n.cpu) }"
                    />
                  </div>
                  <span class="infra-bar-pct">{{ n.cpu }}%</span>
                </div>
              </td>
              <td>
                <span v-if="n.st === 'down'" class="muted">—</span>
                <div v-else class="infra-bar">
                  <div class="infra-bar-track">
                    <div
                      class="infra-bar-fill"
                      :style="{ width: n.mem + '%', background: infraBarColor(n.mem) }"
                    />
                  </div>
                  <span class="infra-bar-pct">{{ n.mem }}%</span>
                </div>
              </td>
              <td>
                <span v-if="n.st === 'down'" class="muted">—</span>
                <div v-else class="infra-bar">
                  <div class="infra-bar-track">
                    <div
                      class="infra-bar-fill"
                      :style="{ width: n.disk + '%', background: infraBarColor(n.disk) }"
                    />
                  </div>
                  <span class="infra-bar-pct">{{ n.disk }}%</span>
                </div>
              </td>
              <td class="net-cell">{{ n.net }}</td>
              <td>
                <span class="tag" :class="infraNodeStatusTag(n.st).tag" style="font-size: 10px">
                  {{ infraNodeStatusTag(n.st).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2 infra-mid">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ⚙️ 平台组件进程健康 <span class="tip">· L3 进程探针 + JMX/HTTP</span>
          </div>
        </div>
        <div class="card-body infra-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>组件</th>
                <th>实例</th>
                <th>状态</th>
                <th>关键指标</th>
                <th>动作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!procs.length">
                <td colspan="5" class="empty-cell">暂无进程探针。配置组件探针后刷新</td>
              </tr>
              <tr v-for="p in procs" :key="p.inst">
                <td><b>{{ p.comp }}</b></td>
                <td class="inst-cell">{{ p.inst }}</td>
                <td>
                  <span class="tag" :class="infraProcStatusTag(p.st).tag" style="font-size: 10px">
                    {{ infraProcStatusTag(p.st).label }}
                  </span>
                </td>
                <td class="metric-cell">{{ p.metric }}</td>
                <td>
                  <button type="button" class="btn-link btn-sm" @click.stop="onProcAct(p)">
                    {{ p.act || '详情' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            🚨 基础设施告警事件流 <span class="tip">· 按优先级路由</span>
          </div>
          <button type="button" class="btn btn-sm" @click="silenceAlerts">🔇 静默</button>
        </div>
        <div class="card-body infra-scroll infra-alerts">
          <div v-if="!alerts.length" class="empty-cell">暂无告警。接入夜莺或 VM 告警规则后显示</div>
          <div v-for="(a, i) in alerts" :key="i" class="infra-alert-row">
            <span class="tag" :class="infraSevTag(a.sev)" style="flex-shrink: 0">{{ a.sev }}</span>
            <div class="infra-alert-main">
              <div class="infra-alert-title">{{ a.live ? '🔴 ' : '' }}{{ a.t }}</div>
              <div class="infra-alert-meta">{{ a.time }} · {{ a.host }} · {{ a.act }}</div>
            </div>
            <button type="button" class="btn-link btn-sm" @click="onAlertAct(a)">
              {{ a.sev === '容量' || (a.t && String(a.t).includes('磁盘')) ? '存储趋势→' : '链路影响→' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 infra-mid">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            📦 L1 容器 <span class="tip">· cadvisor</span>
          </div>
        </div>
        <div class="card-body infra-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>容器</th>
                <th>实例</th>
                <th>CPU</th>
                <th>内存</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!containers.length">
                <td colspan="5" class="empty-cell">暂无容器指标。部署 cAdvisor 后刷新</td>
              </tr>
              <tr v-for="(c, i) in containers" :key="i">
                <td><b>{{ c.name }}</b></td>
                <td class="inst-cell">{{ c.instance }}</td>
                <td>{{ c.cpu }}%</td>
                <td>{{ c.mem }}</td>
                <td>
                  <span class="tag" :class="infraProcStatusTag(c.st).tag" style="font-size: 10px">
                    {{ infraProcStatusTag(c.st).label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ☸️ L2 集群对象 <span class="tip">· kube-state</span>
          </div>
        </div>
        <div class="card-body infra-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>类型</th>
                <th>名称</th>
                <th>就绪</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!cluster.length">
                <td colspan="4" class="empty-cell">暂无集群对象。接入 kube-state-metrics 后刷新</td>
              </tr>
              <tr v-for="(c, i) in cluster" :key="i">
                <td>{{ c.kind }}</td>
                <td><b>{{ c.name }}</b></td>
                <td>{{ c.ready }}</td>
                <td>
                  <span class="tag" :class="infraProcStatusTag(c.st).tag" style="font-size: 10px">
                    {{ infraProcStatusTag(c.st).label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="grid grid-2 infra-bottom">
      <article class="card">
        <div class="card-header">
          <div class="card-title">
            📈 容量趋势与扩容建议 <span class="tip">· 近 7/30 天</span>
          </div>
          <button type="button" class="btn btn-sm" @click="goStorageTrend()">去存储趋势 →</button>
        </div>
        <div class="card-body infra-tips">
          <div v-if="!capacityTips.length" class="empty-cell">
            暂无容量建议 · 无采集时空态合法
          </div>
          <div v-for="(tip, i) in capacityTips" :key="i" class="infra-tip">
            {{ tip.icon }}
            <b v-if="tip.bold">{{ tip.bold }}</b>{{ tip.text }}
          </div>
        </div>
      </article>
      <article class="card">
        <div class="card-header">
          <div class="card-title">🧭 运维监控三页分工</div>
        </div>
        <div class="card-body">
          <table class="table">
            <thead>
              <tr>
                <th>页</th>
                <th>看什么</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in INFRA_LAYER_ROWS" :key="i" :class="{ highlight: r.highlight }">
                <td><b>{{ r.page }}</b></td>
                <td>{{ r.view }}</td>
              </tr>
            </tbody>
          </table>
          <div class="infra-layer-note">
            底座故障告警带的 service 可一键跳链路调用监控看是否同时有调用失败。
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.infra-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-2);
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.5;
}
.infra-banner.warn {
  background: var(--warning-light);
  color: var(--text-1);
}
.infra-banner code {
  font-size: 11px;
}
.empty-cell {
  text-align: center;
  color: var(--text-3);
  padding: 24px !important;
  font-size: 12px;
}
.infra-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}
.kpi-trend.warn {
  color: var(--warning);
}
.kpi-trend.danger {
  color: var(--danger);
}

.infra-nodes-card {
  margin-bottom: 16px;
}
.infra-header-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.infra-table-wrap {
  padding: 0;
}
.infra-node-row {
  cursor: pointer;
}
.infra-node-row:hover {
  background: var(--bg-2);
}
.comps-cell,
.net-cell,
.inst-cell {
  font-size: 11px;
  color: var(--text-3);
}
.metric-cell {
  font-size: 11px;
  color: var(--text-2);
}
.muted {
  color: var(--text-3);
}

.infra-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.infra-bar-track {
  width: 54px;
  height: 6px;
  background: var(--bg-2);
  border-radius: 3px;
  overflow: hidden;
}
.infra-bar-fill {
  height: 100%;
}
.infra-bar-pct {
  font-size: 11px;
}

.infra-mid {
  margin-top: 0;
}
.infra-scroll {
  padding: 0;
  max-height: 340px;
  overflow-y: auto;
}

.infra-alerts {
  padding: 0;
}
.infra-alert-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border);
}
.infra-alert-main {
  flex: 1;
  min-width: 0;
}
.infra-alert-title {
  font-size: 12px;
  color: var(--text-1);
}
.infra-alert-meta {
  font-size: 11px;
  color: var(--text-3);
}

.infra-bottom {
  margin-top: 16px;
}
.infra-tips {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.8;
}
.infra-tip + .infra-tip {
  margin-top: 2px;
}
.infra-layer-note {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 6px;
}
tr.highlight {
  background: var(--primary-light);
}
</style>
