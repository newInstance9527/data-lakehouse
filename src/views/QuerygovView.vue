<script setup>
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
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

function newQueryRule() {
  showToast('＋ 查询规则（演示）· 选队列 → 设阈值 → 告警/阻断', 'info')
}

function exportCostReport() {
  showToast('📊 成本报表导出中 · CSV（日期,计算成本,存储成本,总成本,环比）', 'success')
}

function goQuery() {
  router.push('/query')
}
</script>

<template>
  <div class="qg-page">
    <PageHeader
      title="查询治理与成本"
      subtitle="Trino 队列管理 · 扫描限额 · 查询审计 · FinOps 成本分摊 · 无主资产归档"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="newQueryRule">＋ 查询规则</button>
      <button type="button" class="btn btn-sm" @click="exportCostReport">📊 成本报表</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goQuery">🔗 即席查询</button>
    </PageHeader>

    <div class="kpi-grid qg-kpi">
      <div v-for="(k, i) in QG_KPIS" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div
          class="kpi-trend"
          :class="
            k.trendDanger ? 'danger' : k.trendWarn ? 'warn' : k.trendUp ? 'up' : 'down'
          "
        >
          {{ k.trend }}
        </div>
      </div>
    </div>

    <div class="card qg-section">
      <div class="card-header">
        <div class="card-title">
          🎚️ Trino 查询队列
          <span class="tip">· 按组分队列 · dashboard 优先 · adhoc 限并发限扫描</span>
        </div>
      </div>
      <div class="card-body qg-queue-body">
        <div class="grid grid-3 qg-queue-grid">
          <div v-for="q in TRINO_QUEUES" :key="q.name" class="queue-card">
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
                <div class="qcs-label">日 QPS</div>
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
          <div class="card-title">📋 查询审计 Top 10 <span class="tip">· 按扫描字节</span></div>
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
              <tr v-for="(a, i) in QUERY_AUDITS" :key="i">
                <td style="font-size: 11px">{{ a.user }}</td>
                <td>
                  <code style="font-size: 10px">{{ truncateQuery(a.query) }}</code>
                </td>
                <td>
                  <b :class="{ 'scan-blocked': a.status === 'blocked' }">{{ a.scan }}</b>
                </td>
                <td style="font-size: 11px">{{ a.time }}</td>
                <td>
                  <span class="tag tag-blue" style="font-size: 10px">{{ a.queue }}</span>
                </td>
                <td>
                  <span class="tag" :class="auditStatusMeta(a.status).tag" style="font-size: 10px">
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
          <div class="card-title">💰 FinOps 成本分摊 <span class="tip">· 按域/环境汇总 · 月度</span></div>
        </div>
        <div class="card-body" style="padding: 14px">
          <table class="table">
            <thead>
              <tr>
                <th>域</th>
                <th>MinIO</th>
                <th>CK</th>
                <th>Trino</th>
                <th>总计</th>
                <th>趋势</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in COST_DOMAINS" :key="d.domain">
                <td><b>{{ d.domain }}</b></td>
                <td style="font-size: 11px">{{ d.minio }}</td>
                <td style="font-size: 11px">{{ d.ck }}</td>
                <td style="font-size: 11px">{{ d.trino }}</td>
                <td><b>{{ d.total }}</b></td>
                <td class="cost-trend" :class="costTrendClass(d.trend)">{{ d.trend }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card qg-section">
      <div class="card-header">
        <div class="card-title">📏 查询治理规则</div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>规则</th>
              <th>阈值</th>
              <th>动作</th>
              <th>通知</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in QG_RULES" :key="i">
              <td>{{ r.rule }}</td>
              <td style="font-size: 11px">{{ r.threshold }}</td>
              <td>
                <span class="tag" :class="r.actionTag" style="font-size: 10px">{{ r.action }}</span>
              </td>
              <td style="font-size: 11px">{{ r.notify }}</td>
              <td>
                <span class="tag tag-green" style="font-size: 10px">{{ r.status }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qg-kpi {
  grid-template-columns: repeat(5, 1fr);
}
@media (max-width: 1200px) {
  .qg-kpi {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 700px) {
  .qg-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}

.kpi-trend.warn {
  color: var(--warning);
}
.kpi-trend.danger {
  color: var(--danger);
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.qg-section {
  margin-top: 16px;
}

.qg-queue-body {
  padding: 14px;
}

.qg-queue-grid {
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 900px) {
  .qg-queue-grid {
    grid-template-columns: 1fr;
  }
}

.queue-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--bg-1);
}
.qc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.qc-name {
  font-size: 13px;
  font-weight: 600;
}
.qc-desc {
  font-size: 11px;
  color: var(--text-3);
}
.qc-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 10px;
}
.qc-stat {
  text-align: center;
}
.qcs-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
}
.qcs-limit {
  font-size: 14px;
}
.qcs-label {
  font-size: 10px;
  color: var(--text-3);
}

.scan-blocked {
  color: var(--danger);
}

.cost-trend {
  font-size: 11px;
}
.cost-trend.trend-warn {
  color: var(--warning);
}
.cost-trend.trend-danger {
  color: var(--danger);
}
.cost-trend.trend-ok {
  color: var(--success);
}
</style>
