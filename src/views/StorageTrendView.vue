<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useStorageTrend } from '@/composables/useStorageTrend'
import { pageGuideOf } from '@/data/pageGuides'

const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const guide = pageGuideOf('storage-trend')

const {
  loading,
  lastError,
  range,
  tableFilter,
  kpis,
  daily,
  layers,
  capacityRows,
  topGrowth,
  adviceCards,
  tableRows,
  collectBanner,
  chartFoot,
  loadAll,
  setRange,
  setTableFilter,
  lifecycleQuery,
  stBarHeight,
  stGrowthCls,
} = useStorageTrend()

const subtitle = computed(() => {
  const b = collectBanner.value
  const src = b?.source ? ' · ' + String(b.source).split(';')[0] : ''
  return `三口径度量 · ${range.value} 窗口 · 建议只深链生命周期${src}`
})

onMounted(async () => {
  if (route.query.range) {
    range.value = String(route.query.range)
  }
  try {
    await loadAll()
  } catch (e) {
    showToast(`存储趋势接口暂不可用，已用本地演示数据：${e.message || e}`, 'warning')
  }
})

async function onRange(next) {
  try {
    await setRange(next)
    router.replace({ query: { ...route.query, range: next } })
  } catch (e) {
    showToast(`切换窗口失败：${e.message || e}`, 'error')
  }
}

async function onFilter(next) {
  try {
    await setTableFilter(next)
  } catch (e) {
    showToast(`筛选失败：${e.message || e}`, 'error')
  }
}

async function refreshMetrics() {
  try {
    await loadAll()
    showToast('🔄 已刷新存储趋势', 'success')
  } catch (e) {
    showToast(`刷新失败：${e.message || e}`, 'error')
  }
}

function exportReport() {
  showToast('📄 存储日报导出 · P1 接 /storage/report/export', 'info')
}

function goLifecycle(extra = {}) {
  router.push({ path: '/lifecycle', query: extra })
}

/** 本页只读：合并/过期一律深链主台 */
function runAction(kind, table, adviceId) {
  if (kind === 'catalog' && table) {
    router.push({ path: '/catalog', query: { q: table } })
    return
  }
  goLifecycle(lifecycleQuery(kind, table, adviceId))
}

const dailyMax = () => {
  const vals = daily.value.map((d) => Number(d.total) || 0)
  return Math.max(3.5, ...vals, 1)
}

const FILTERS = [
  { id: 'anomaly', label: '异常' },
  { id: 'reclaimable', label: '可回收高' },
  { id: 'smallfile', label: '小文件多' },
  { id: 'all', label: '全部' },
]

const RANGES = ['7d', '30d', '90d']
</script>

<template>
  <div class="st-page">
    <PageHeader title="存储趋势" :subtitle="subtitle" :guide="guide">
      <div class="st-range">
        <button
          v-for="r in RANGES"
          :key="r"
          type="button"
          class="btn btn-sm"
          :class="{ 'btn-primary': range === r }"
          :disabled="loading"
          @click="onRange(r)"
        >
          {{ r }}
        </button>
      </div>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="refreshMetrics">
        🔄 刷新水位
      </button>
      <button type="button" class="btn btn-sm" @click="exportReport">📄 导出日报</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goLifecycle()">⏳ 去生命周期执行</button>
    </PageHeader>

    <p v-if="lastError && !loading" class="st-banner warn">
      接口异常时已回退本地演示数据；接通后端后刷新即可。
    </p>
    <p v-else-if="collectBanner" class="st-banner" :class="collectBanner.status === 'FRESH' ? 'ok' : 'warn'">
      采集 {{ collectBanner.status }}
      <template v-if="collectBanner.collectedAt"> · 截至 {{ collectBanner.collectedAt }}</template>
      <template v-if="collectBanner.caliberNote"> · {{ collectBanner.caliberNote }}</template>
    </p>

    <div class="kpi-grid st-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
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
            📈 存储趋势（{{ range }}）
            <span class="tip">· 单位 TB · 物理日终水位</span>
          </div>
          <span class="tag tag-blue">物理</span>
        </div>
        <div class="card-body">
          <div class="st-chart">
            <div
              v-for="d in daily"
              :key="d.day"
              class="st-col"
              :title="`${d.day} · 物理 ${d.total} TB · 活跃 ${d.active ?? '—'} TB`"
            >
              <div class="st-bar-wrap">
                <div
                  class="st-bar"
                  :class="{ hot: d.total >= dailyMax() * 0.95 }"
                  :style="{ height: `${stBarHeight(d.total, dailyMax())}%` }"
                />
              </div>
              <div class="st-val">{{ d.total }}</div>
              <div class="st-day">{{ String(d.day).slice(-2) }}</div>
            </div>
          </div>
          <div class="st-chart-foot">
            <span>起始 {{ chartFoot.start }}</span>
            <span>今日 {{ chartFoot.end }}</span>
            <span class="st-delta">{{ chartFoot.delta }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            🧱 分层存量（活跃口径）
            <span class="tip">· {{ range }}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="st-stack" aria-hidden="true">
            <div
              v-for="l in layers"
              :key="l.layer"
              class="st-stack-seg"
              :style="{ width: `${l.pct}%`, background: l.color }"
              :title="`${l.layer} ${l.size}`"
            />
          </div>
          <div class="st-layer-list">
            <div v-for="l in layers" :key="l.layer" class="st-layer-row">
              <div class="st-layer-lab">
                <i class="st-dot" :style="{ background: l.color }" />
                <b>{{ l.layer }}</b>
                <span class="st-layer-note">{{ l.note }}</span>
              </div>
              <div class="st-layer-meta">
                <span>{{ l.size }}</span>
                <span class="st-growth">{{ l.growth }}</span>
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
            💧 桶水位 · days-to-full
            <span class="tip">· 按桶分列 · CK 单列</span>
          </div>
        </div>
        <div class="card-body">
          <div v-for="(b, i) in capacityRows" :key="i" class="st-cap-row">
            <div class="st-cap-label">{{ b.label }}</div>
            <div class="progress st-cap-bar">
              <div class="progress-bar" :style="{ width: `${b.pct}%`, background: b.gradient }" />
            </div>
            <div class="st-cap-cap">
              <b>{{ b.used }}</b>/{{ b.cap }}
            </div>
          </div>
          <div class="st-top-title">{{ range }} 增速 Top</div>
          <div class="st-top-list">
            <div v-for="g in topGrowth" :key="g.table">
              📊 <code>{{ g.table }}</code> · {{ g.growth }}
              <span :style="{ color: g.danger ? 'var(--danger)' : 'var(--text-3)' }"> · {{ g.tip }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">💡 治理建议（按预计可回收）</div>
          <button type="button" class="btn btn-sm" @click="goLifecycle()">去执行 →</button>
        </div>
        <div class="card-body st-advice-body">
          <div v-for="(a, i) in adviceCards" :key="a.id || i" class="st-advice">
            <div class="st-advice-hd">
              <span class="tag" :class="a.priCls">{{ a.pri }}</span>
              <b>{{ a.title }}</b>
            </div>
            <div class="st-advice-detail">{{ a.detail }}</div>
            <button type="button" class="btn btn-sm" @click="runAction(a.act, a.table, a.adviceId)">
              {{ a.actLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card st-section">
      <div class="card-header st-table-hd">
        <div class="card-title">
          ⚠️ 表级画像
          <span class="tip">· 三口径 · {{ range }} · 动作只深链</span>
        </div>
        <div class="st-filters">
          <button
            v-for="f in FILTERS"
            :key="f.id"
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-primary': tableFilter === f.id }"
            :disabled="loading"
            @click="onFilter(f.id)"
          >
            {{ f.label }}
          </button>
        </div>
      </div>
      <div class="card-body" style="padding: 0; overflow-x: auto">
        <table class="table">
          <thead>
            <tr>
              <th>表</th>
              <th>分层</th>
              <th>活跃</th>
              <th>物理</th>
              <th>可回收</th>
              <th>增速</th>
              <th>归因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableRows" :key="row.table">
              <td><code>{{ row.table }}</code></td>
              <td><span class="tag tag-blue">{{ row.layer }}</span></td>
              <td>{{ row.active || row.size }}</td>
              <td>{{ row.total || '—' }}</td>
              <td>{{ row.reclaimable || '—' }}</td>
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
            <tr v-if="!tableRows.length">
              <td colspan="8" style="text-align: center; color: var(--text-3); padding: 24px">
                当前筛选无数据
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
  .st-kpi {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 700px) {
  .st-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}

.st-range,
.st-filters {
  display: inline-flex;
  gap: 4px;
  margin-right: 8px;
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.st-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 6px;
}
.st-banner.warn {
  color: var(--warning);
  background: var(--warning-light, #fff7e6);
}
.st-banner.ok {
  color: var(--success, #389e0d);
  background: #f6ffed;
}

.st-section {
  margin-top: 16px;
}

.st-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 160px;
  padding: 8px 4px 0;
}
.st-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}
.st-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.st-bar {
  width: 70%;
  max-width: 36px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #4d8dff, #82aaff);
  min-height: 8px;
}
.st-bar.hot {
  background: linear-gradient(180deg, #ff7875, #ffa39e);
}
.st-val {
  font-size: 11px;
  font-weight: 600;
  margin-top: 4px;
}
.st-day {
  font-size: 10px;
  color: var(--text-3);
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
.st-delta {
  color: var(--warning);
  font-weight: 600;
}

.st-stack {
  display: flex;
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
  margin-bottom: 12px;
}
.st-stack-seg {
  height: 100%;
  min-width: 2px;
}

.st-layer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.st-layer-row {
  display: grid;
  gap: 4px;
}
.st-layer-lab {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.st-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.st-layer-note {
  color: var(--text-3);
  font-size: 11px;
}
.st-layer-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.st-layer-bar {
  height: 6px;
}

.st-growth.warn {
  color: var(--warning);
  font-weight: 600;
}
.st-growth.danger {
  color: var(--danger);
  font-weight: 600;
}
.st-growth.ok {
  color: var(--success);
}

.st-cap-row {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 12px;
}
.st-cap-bar {
  height: 8px;
}
.st-cap-cap {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.st-top-title {
  margin-top: 12px;
  font-size: 12px;
  font-weight: 600;
}
.st-top-list {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-2);
}

.st-advice-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.st-advice {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.st-advice-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.st-advice-detail {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}

.st-table-hd {
  flex-wrap: wrap;
  gap: 8px;
}

.btn-link {
  border: none;
  background: none;
  color: var(--primary, #4d8dff);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}
.btn-link:hover {
  text-decoration: underline;
}
</style>
