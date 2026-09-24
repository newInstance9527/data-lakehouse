<script setup>
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  INFRA_ALERTS,
  INFRA_CAPACITY_TIPS,
  INFRA_KPIS,
  INFRA_LAYER_ROWS,
  INFRA_NODES,
  INFRA_PROCS,
  infraBarColor,
  infraNodeStatusTag,
  infraProcStatusTag,
  infraSevTag,
} from '@/data/infra'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('infra')

function exportDaily() {
  showToast('📄 基础设施日报导出中 · CSV · 节点水位+告警+扩容建议', 'success')
}

function silenceWindow() {
  showToast('功能待接后端', 'info')
}

function silenceAlerts() {
  showToast('🔇 一键静默 · node-07 · 60min 维护窗口', 'warning')
}

function goLinktrace() {
  router.push('/linktrace')
}

function onProcAct(p) {
  if (p.act === '链路→') {
    goLinktrace()
    return
  }
  if (p.act === '重试') {
    showToast(`↻ 组件重启重试 · ${p.comp}`, 'info')
    return
  }
  if (p.act === '扩容') {
    showToast(`📈 生成扩容建议 · ${p.comp}`, 'info')
    return
  }
  showToast(`📋 ${p.comp} 详情 · ${p.inst} · ${p.metric} · ${p.st}`, 'info')
}

function nodeTrend(n) {
  showToast(`📊 节点趋势 · ${n.node} · CPU ${n.cpu}% / 内存 ${n.mem}% / 磁盘 ${n.disk}%`, 'info')
}

function kpiTrendClass(k) {
  if (k.trendDanger) return 'danger'
  if (k.trendWarn) return 'warn'
  return k.trendUp ? 'up' : 'down'
}
</script>

<template>
  <div class="infra-page">
    <PageHeader
      title="基础设施监控 · §30"
      subtitle="四层模型：节点资源 / 容器 / 集群对象 / 平台组件进程 · 复用 Categraf + VictoriaMetrics + 夜莺 · 承载任务运维与链路监控的底座"
      :guide="guide"
    >
      <span class="tag tag-blue infra-ver">v1.2 新增</span>
      <button type="button" class="btn btn-sm" @click="exportDaily">📄 日报</button>
      <button type="button" class="btn btn-sm" @click="silenceWindow">🔇 维护静默</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goLinktrace">🧵 看链路影响</button>
    </PageHeader>

    <div class="kpi-grid infra-kpi">
      <div v-for="(k, i) in INFRA_KPIS" :key="i" class="kpi-card" :class="k.color">
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
          <span class="tip">· Categraf node 模块 · 点击节点看趋势</span>
        </div>
        <div class="infra-header-tags">
          <span class="tag tag-red">node-07 NotReady</span>
          <span class="tag tag-orange">3 磁盘将满</span>
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
            <tr
              v-for="n in INFRA_NODES"
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
          <span class="tag tag-orange">1 端口不通</span>
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
              <tr v-for="p in INFRA_PROCS" :key="p.inst">
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
                    {{ p.act }}
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
            🚨 基础设施告警事件流 <span class="tip">· 夜莺分级路由 · 已去重/抑制</span>
          </div>
          <button type="button" class="btn btn-sm" @click="silenceAlerts">🔇 静默</button>
        </div>
        <div class="card-body infra-scroll infra-alerts">
          <div v-for="(a, i) in INFRA_ALERTS" :key="i" class="infra-alert-row">
            <span class="tag" :class="infraSevTag(a.sev)" style="flex-shrink: 0">{{ a.sev }}</span>
            <div class="infra-alert-main">
              <div class="infra-alert-title">{{ a.live ? '🔴 ' : '' }}{{ a.t }}</div>
              <div class="infra-alert-meta">{{ a.time }} · {{ a.host }} · {{ a.act }}</div>
            </div>
            <button type="button" class="btn-link btn-sm" @click="goLinktrace">链路影响→</button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 infra-bottom">
      <article class="card">
        <div class="card-header">
          <div class="card-title">
            📈 容量趋势与扩容建议 <span class="tip">· VM downsample 7/30 天</span>
          </div>
        </div>
        <div class="card-body infra-tips">
          <div v-for="(tip, i) in INFRA_CAPACITY_TIPS" :key="i" class="infra-tip">
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
.infra-ver {
  font-size: 12px;
  align-self: center;
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
