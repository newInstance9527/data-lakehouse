<script setup>
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  ST_ADVICE,
  ST_ANOMALIES,
  ST_CAPACITY,
  ST_DAILY,
  ST_KPIS,
  ST_LAYERS,
  ST_TOP_GROWTH,
  stBarHeight,
  stGrowthCls,
} from '@/data/storageTrend'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('storage-trend')

function exportReport() {
  showToast('📄 存储日报导出中 · CSV（日期,分层容量,增速,异常表,扩容建议）', 'success')
}

function goLifecycle() {
  router.push('/lifecycle')
}

function refreshMetrics() {
  showToast('🔄 已拉取 Categraf MinIO 最新 15min 采集点', 'info')
}

function runAction(kind, table) {
  if (kind === 'compact') {
    showToast(`⚡ 小文件合并作业已提交 · ${table || 'dwd_log_action'}`, 'success')
    return
  }
  if (kind === 'expire') {
    showToast(`快照过期任务已触发 · ${table || 'ods_trade.s_order'}`, 'success')
    return
  }
  if (kind === 'lifecycle') {
    goLifecycle()
    return
  }
  if (kind === 'catalog' && table) {
    router.push({ path: '/catalog', query: { q: table } })
    return
  }
  showToast('已记录治理动作（演示）', 'info')
}
</script>

<template>
  <div class="st-page">
    <PageHeader
      title="存储趋势"
      subtitle="近 7 天增长 · 分层水位 · 异常表告警 · 治理建议 · Categraf MinIO 15min 采集"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="refreshMetrics">🔄 刷新水位</button>
      <button type="button" class="btn btn-sm" @click="exportReport">📄 导出日报</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goLifecycle">⏳ 生命周期</button>
    </PageHeader>

    <div class="kpi-grid st-kpi">
      <div v-for="(k, i) in ST_KPIS" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="k.trendDown ? 'down' : 'up'">{{ k.trend }}</div>
      </div>
    </div>

    <div class="grid grid-2 st-section">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            📈 近 7 日总存储趋势
            <span class="tip">· 单位 TB · 日终水位</span>
          </div>
          <span class="tag tag-blue">+2.3% WoW</span>
        </div>
        <div class="card-body">
          <div class="st-chart">
            <div
              v-for="d in ST_DAILY"
              :key="d.day"
              class="st-col"
              :title="`${d.day} · ${d.total} TB · ${d.growth}`"
            >
              <div class="st-bar-wrap">
                <div
                  class="st-bar"
                  :class="{ hot: d.total >= 3.35 }"
                  :style="{ height: `${stBarHeight(d.total)}%` }"
                />
              </div>
              <div class="st-val">{{ d.total }}</div>
              <div class="st-day">{{ d.day.slice(3) }}</div>
            </div>
          </div>
          <div class="st-chart-foot">
            <span>起始 3.22 TB</span>
            <span>今日 3.40 TB</span>
            <span class="st-delta">Δ +180 GB / 7d</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            🧱 分层存量分布
            <span class="tip">· 对齐近 7 日统计口径 3.4 TB</span>
          </div>
        </div>
        <div class="card-body">
          <div class="st-stack" aria-hidden="true">
            <div
              v-for="l in ST_LAYERS"
              :key="l.layer"
              class="st-stack-seg"
              :style="{ width: `${l.pct}%`, background: l.color }"
              :title="`${l.layer} ${l.size}`"
            />
          </div>
          <div class="st-layer-list">
            <div v-for="l in ST_LAYERS" :key="l.layer" class="st-layer-row">
              <div class="st-layer-lab">
                <i class="st-dot" :style="{ background: l.color }" />
                <b>{{ l.layer }}</b>
                <span class="st-layer-note">{{ l.note }}</span>
              </div>
              <div class="st-layer-meta">
                <span>{{ l.size }}</span>
                <span class="st-growth" :class="{ warn: l.growth.startsWith('+5') || l.growth.startsWith('+1.8') }">
                  {{ l.growth }}
                </span>
              </div>
              <div class="progress st-layer-bar">
                <div class="progress-bar" :style="{ width: `${l.pct}%`, background: l.color }" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 st-section">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            💧 存储水位 · §32.4
            <span class="tip">· Categraf MinIO 15min</span>
          </div>
        </div>
        <div class="card-body">
          <div v-for="(b, i) in ST_CAPACITY" :key="i" class="st-cap-row">
            <div class="st-cap-label">{{ b.label }}</div>
            <div class="progress st-cap-bar">
              <div class="progress-bar" :style="{ width: `${b.pct}%`, background: b.gradient }" />
            </div>
            <div class="st-cap-cap"><b>{{ b.used }}</b>/{{ b.cap }}</div>
          </div>
          <div class="st-top-title">7 日增速 Top 3</div>
          <div class="st-top-list">
            <div v-for="g in ST_TOP_GROWTH" :key="g.table">
              📊 <code>{{ g.table }}</code> · {{ g.growth }}
              <span :style="{ color: g.danger ? 'var(--danger)' : 'var(--text-3)' }"> · {{ g.tip }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">💡 治理建议</div>
          <button type="button" class="btn btn-sm" @click="goLifecycle">去执行 →</button>
        </div>
        <div class="card-body st-advice-body">
          <div v-for="(a, i) in ST_ADVICE" :key="i" class="st-advice">
            <div class="st-advice-hd">
              <span class="tag" :class="a.priCls">{{ a.pri }}</span>
              <b>{{ a.title }}</b>
            </div>
            <div class="st-advice-detail">{{ a.detail }}</div>
            <button type="button" class="btn btn-sm" @click="runAction(a.act)">
              {{ a.actLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card st-section">
      <div class="card-header">
        <div class="card-title">
          ⚠️ 异常增长表
          <span class="tip">· 近 7 日增速异常 / 建议动作</span>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>表</th>
              <th>分层</th>
              <th>当前存储</th>
              <th>7 日增速</th>
              <th>原因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in ST_ANOMALIES" :key="row.table">
              <td><code>{{ row.table }}</code></td>
              <td><span class="tag tag-blue">{{ row.layer }}</span></td>
              <td>{{ row.size }}</td>
              <td>
                <span class="st-growth" :class="stGrowthCls(row.status)">{{ row.growth }}</span>
              </td>
              <td style="font-size: 12px; color: var(--text-2)">{{ row.reason }}</td>
              <td>
                <button type="button" class="btn-link" @click="runAction(row.action, row.table)">
                  {{ row.actionLabel }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.st-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .st-kpi { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .st-kpi { grid-template-columns: repeat(2, 1fr); }
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.st-section { margin-top: 16px; }
.st-page .card { margin-top: 0; }
.st-page .grid-2 { gap: 16px; }

.st-chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 160px;
  padding: 8px 4px 0;
}
.st-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.st-bar-wrap {
  width: 100%;
  height: 120px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.st-bar {
  width: 56%;
  min-height: 6px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #4d8dff 0%, #3dd68c 100%);
  transition: height 0.2s ease;
}
.st-bar.hot {
  background: linear-gradient(180deg, #e6b450 0%, #f97316 100%);
}
.st-val {
  font-size: 11px;
  font-weight: 600;
  margin-top: 6px;
}
.st-day {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 2px;
}
.st-chart-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  color: var(--text-3);
}
.st-delta { color: var(--warning); font-weight: 600; }

.st-stack {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 14px;
  background: var(--bg-2);
}
.st-stack-seg { height: 100%; min-width: 2px; }

.st-layer-list { display: flex; flex-direction: column; gap: 12px; }
.st-layer-row { display: flex; flex-direction: column; gap: 4px; }
.st-layer-lab {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.st-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.st-layer-note { color: var(--text-3); font-size: 11px; }
.st-layer-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding-left: 16px;
}
.st-layer-bar { height: 8px; border-radius: 4px; }

.st-growth { font-weight: 600; color: var(--text-2); }
.st-growth.warn,
.st-growth.danger { color: var(--danger); }
.st-growth.ok { color: var(--success); }

.st-cap-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.st-cap-label {
  width: 88px;
  font-size: 12px;
  color: var(--text-2);
  flex-shrink: 0;
}
.st-cap-bar {
  flex: 1;
  height: 20px;
  border-radius: 10px;
  overflow: hidden;
}
.st-cap-cap { font-size: 12px; white-space: nowrap; }

.st-top-title {
  font-size: 12px;
  font-weight: 600;
  margin-top: 8px;
  margin-bottom: 6px;
}
.st-top-list {
  font-size: 11px;
  line-height: 1.9;
  color: var(--text-2);
}

.st-advice-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.st-advice {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-1, #fff);
}
.st-advice-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 6px;
}
.st-advice-detail {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.6;
  margin-bottom: 8px;
}

.btn-link {
  border: none;
  background: none;
  color: var(--primary, #4d8dff);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}
.btn-link:hover { text-decoration: underline; }
</style>
