<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  OPS_DS_DAGS,
  OPS_FLINK_JOBS,
  OPS_KPIS,
  OPS_RECONCILE,
  opsStatusIconClass,
} from '@/data/ops'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('ops')

const env = ref('prod')

function startSupplement() {
  showToast('🔧 发起补数（演示）· 选择分区 / DAG / 下游联动', 'info')
}

function reimportDiff() {
  showToast('🔧 重导差异分区 · ads_gmv_board · 以 Iceberg 为准校正 CK', 'success')
}

function onTaskClick(task) {
  if (task.route) router.push(task.route)
}

function goRootcause() {
  router.push('/rootcause')
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
      title="任务运维中心"
      subtitle="Flink 流作业 · DolphinScheduler 批 DAG · 湖仓对账 · 补数工单"
      :guide="guide"
    >
      <select v-model="env" class="select input-sm">
        <option value="prod">生产 prod</option>
        <option value="stg">预发 stg</option>
      </select>
      <button type="button" class="btn btn-sm btn-primary" @click="startSupplement">🔧 发起补数</button>
    </PageHeader>

    <div class="kpi-grid ops-kpi">
      <div v-for="(k, i) in OPS_KPIS" :key="i" class="kpi-card" :class="k.color">
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
          <div class="card-title">🌊 Flink 流作业</div>
          <div class="ops-header-tags">
            <span class="tag tag-green">35 RUNNING</span>
            <span class="tag tag-red">1 FAIL</span>
          </div>
        </div>
        <div class="card-body">
          <div
            v-for="t in OPS_FLINK_JOBS"
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
          <div class="card-title">🐬 DS 批 DAG 今日运行</div>
          <div class="ops-ds-rate">
            成功率 <b>96.4%</b>
          </div>
        </div>
        <div class="card-body">
          <div
            v-for="t in OPS_DS_DAGS"
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
          🔁 湖/CK 对账 · 链路 I（v1.1 审查补丁）
          <span class="tip">· 未通过自动摘牌黄金数据集</span>
        </div>
        <div class="flex gap-8 ops-reconcile-actions">
          <span class="tag tag-green">20 通过</span>
          <span class="tag tag-red">1 失败</span>
          <button type="button" class="btn btn-sm btn-primary" @click="reimportDiff">
            🔧 重导差异分区
          </button>
        </div>
      </div>
      <div class="card-body">
        <div v-for="r in OPS_RECONCILE" :key="r.table" class="reconcile-block">
          <div class="reconcile-table-name">{{ r.table }}</div>
          <div class="reconcile-card" :class="{ 'is-fail': !r.pass }">
            <div class="rc-side">
              <div class="rc-side-label">🧊 Iceberg 事实源 · dt={{ r.dt }}</div>
              <div class="rc-side-value ice">{{ r.ice.rows }}</div>
              <div class="rc-side-sub">{{ r.ice.amt }}</div>
            </div>
            <div class="rc-compare" :class="r.pass ? 'ok' : 'bad'">
              <div class="rc-compare-icon">{{ r.pass ? '✓' : '✕' }}</div>
              <div>{{ r.pass ? '一致' : '差异' }}</div>
              <div v-if="r.note" class="rc-compare-note">{{ r.note }}</div>
            </div>
            <div class="rc-side">
              <div class="rc-side-label">⚡ ClickHouse 热查询 · dt={{ r.dt }}</div>
              <div class="rc-side-value" :class="r.pass ? 'ok' : 'bad'">{{ r.ck.rows }}</div>
              <div class="rc-side-sub">{{ r.ck.amt }}</div>
            </div>
          </div>
          <div v-if="!r.pass" class="reconcile-fail">
            ⚠ 差异：行 <b>{{ r.diff.rows }}</b> · 金额 <b>{{ r.diff.amt }}</b><br />
            🔍 原因：{{ r.reason }} ·
            <button type="button" class="btn-link" @click="goRootcause">根因分析台 →</button>
            （默认以 Iceberg 为准重导 CK）
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
