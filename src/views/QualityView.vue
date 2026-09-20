<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useQuality } from '@/composables/useQuality'
import { QUALITY_RULE_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import { catalogAsset, catalogSearch, lineageField } from '@/utils/moduleLinks'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('quality')

const range = ref('30')
const layerFilter = ref('')
const ruleKw = ref(String(route.query.q || ''))
const createOpen = ref(false)
const busy = ref(false)

const {
  metrics,
  trendPoints,
  typeDistView,
  goldTables,
  ruleList,
  ruleTotal,
  loading,
  reloadByRange,
  createRule,
  openTicket,
} = useQuality()

const filteredRules = computed(() => {
  let list = ruleList.value
  const layer = layerFilter.value
  if (layer) list = list.filter((r) => r.layer === layer)
  const kw = ruleKw.value.trim().toLowerCase()
  if (kw) {
    list = list.filter((r) => {
      const blob = `${r.table || ''} ${r.field || ''} ${r.ruleCode || ''} ${r.displayId || ''}`.toLowerCase()
      return blob.includes(kw)
    })
  }
  return list
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredRules)

watch(layerFilter, () => resetPage())
watch(ruleKw, () => resetPage())

watch(
  () => route.query.q,
  (v) => {
    if (v != null) ruleKw.value = String(v)
  },
)

watch(range, async (v) => {
  busy.value = true
  try {
    await reloadByRange(v)
    resetPage()
  } catch (e) {
    showToast(`加载失败：${e.message || e}`, 'error')
  } finally {
    busy.value = false
  }
})

onMounted(async () => {
  if (route.query.q != null) ruleKw.value = String(route.query.q)
  busy.value = true
  try {
    await reloadByRange(range.value)
  } catch (e) {
    showToast(`质量数据加载失败：${e.message || e}`, 'error')
  } finally {
    busy.value = false
  }
})

function newRule() {
  createOpen.value = true
}

async function onCreateRule(payload) {
  try {
    const row = await createRule(payload)
    createOpen.value = false
    resetPage()
    const bindTip = row.field ? `${row.table}.${row.field}` : `${row.table}（整表）`
    showToast(`质量规则已创建：${row.ruleCode || row.displayId} · 绑定 ${bindTip}`, 'success')
  } catch (e) {
    showToast(`创建失败：${e.message || e}`, 'error')
  }
}

async function onOpenTicket() {
  const firstFail = filteredRules.value.find((r) => !r.pass)
  try {
    const ticket = await openTicket(firstFail?.id, firstFail ? `失败规则 ${firstFail.displayId}` : '质量巡检')
    showToast(`质量工单已登记 · ${ticket.ticketId || ''}`, 'success')
  } catch (e) {
    showToast(`开工单失败：${e.message || e}`, 'error')
  }
}

function viewTable(rule) {
  if (rule.assetId) {
    router.push(catalogAsset(rule.assetId))
    return
  }
  const key = rule.table?.split('.').pop() || rule.table
  router.push(catalogSearch(key))
}

function viewGold(row) {
  router.push(catalogSearch(row.assetKey || row.table))
}

function goLineage(rule) {
  const focus = rule.table || ''
  router.push(lineageField(focus, rule.field || undefined))
}

function ringDash(pct) {
  const n = Math.min(100, Math.max(0, pct))
  return `${(n * 0.942).toFixed(1)} 100`
}

const trendTitle = computed(() => {
  if (range.value === '7') return '7 日'
  if (range.value === '1') return '今日'
  return '30 日'
})

const trendAxisLabels = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return []
  const step = Math.max(1, Math.floor(pts.length / 8))
  return pts.map((p, i) => (i % step === 0 || i === pts.length - 1 ? (p.day || '').slice(5) : ''))
})
</script>

<template>
  <div class="qual-page">
    <PageHeader
      title="数据质量中心"
      subtitle="流批双模校验 · 质量门禁阻断 DAG · 结果回写资产目录"
      :guide="guide"
    >
      <select v-model="range" class="select input-sm" :disabled="busy || loading">
        <option value="30">近30天</option>
        <option value="7">近7天</option>
        <option value="1">今日</option>
      </select>
      <button type="button" class="btn btn-sm btn-primary" @click="newRule">+ 新建规则</button>
    </PageHeader>

    <CreateFormModal
      :open="createOpen"
      v-bind="QUALITY_RULE_FORM"
      @close="createOpen = false"
      @submit="onCreateRule"
    />

    <div v-if="loading && !metrics.length" class="qual-empty">加载中…</div>

    <div class="quality-metrics-row">
      <div v-for="(m, i) in metrics" :key="i" class="quality-metric-card">
        <div class="qmc-chart">
          <svg viewBox="0 0 36 36" width="70" height="70">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#f0f3f8" stroke-width="4" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              :stroke="m.ringColor"
              stroke-width="4"
              :stroke-dasharray="ringDash(m.ringPct)"
              transform="rotate(-90 18 18)"
              stroke-linecap="round"
            />
            <text x="18" y="21" text-anchor="middle" font-size="11" font-weight="700" :fill="m.ringColor">
              {{ m.ringText }}
            </text>
          </svg>
        </div>
        <div class="qmc-info">
          <div class="qmc-title">{{ m.title }}</div>
          <div class="qmc-value">
            {{ m.value }} <span class="qmc-unit">{{ m.unit }}</span>
          </div>
          <div class="qmc-sub" :class="{ danger: m.subDanger, success: m.subSuccess }">{{ m.sub }}</div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 qual-charts">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📈 质量分 {{ trendTitle }}趋势 <span class="tip">（按平均质量分 + 每日阻断次数）</span></div>
          <div class="qual-tags">
            <span class="tag tag-green">质量分</span>
            <span class="tag tag-red">阻断次数</span>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!trendPoints.length" class="qual-empty" style="padding: 24px 0">暂无趋势数据</div>
          <div v-else class="quality-trend-chart">
            <div
              v-for="(d, i) in trendPoints"
              :key="i"
              class="qtc-col"
              :title="`${d.day || ''} ${d.v}分 · 阻断 ${d.blockCount ?? 0}`"
            >
              <div class="qtc-bar-wrap">
                <div class="qtc-bar" :class="d.cls" :style="{ height: `${d.h}%` }" />
              </div>
              <div class="qtc-label">{{ d.v }}</div>
            </div>
          </div>
          <div v-if="trendAxisLabels.length" class="qual-trend-axis">
            <span v-for="(lb, li) in trendAxisLabels" :key="li">{{ lb }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🏷️ 规则类型分布</div>
          <span class="tag">共 {{ ruleTotal }} 条规则</span>
        </div>
        <div class="card-body">
          <div v-if="!typeDistView.length" class="qual-empty" style="padding: 12px 0">暂无分布</div>
          <div v-else class="qual-dist">
            <div v-for="t in typeDistView" :key="t.label">
              <div class="qual-dist-head">
                <span>{{ t.label }}</span>
                <span><b>{{ t.count }}</b> 条 · {{ t.pct }}%</span>
              </div>
              <div class="progress">
                <div class="progress-bar" :style="{ width: `${t.pct}%`, background: t.gradient }" />
              </div>
            </div>
          </div>

          <div class="qual-gold">
            <div class="qual-gold-title">🏆 Top 质量最优表</div>
            <div v-if="!goldTables.length" class="qual-empty" style="padding: 8px 0">暂无黄金表</div>
            <div v-else class="qual-gold-list">
              <div v-for="g in goldTables" :key="g.table" class="qual-gold-row" @click="viewGold(g)">
                <span class="qual-gold-score">{{ g.score }}</span>
                <span class="qual-gold-name">{{ g.table }}</span>
                <span class="tag tag-green">黄金</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">⚠️ 活跃异常规则<span class="tip"> · 数据来自门户 /lh/quality</span></div>
        <div class="qual-tags">
          <input v-model="ruleKw" class="input input-sm" placeholder="表 / 字段 / 规则…" style="width: 160px" />
          <select v-model="layerFilter" class="select input-sm">
            <option value="">全部层级</option>
            <option value="ODS">ODS</option>
            <option value="DWD">DWD</option>
            <option value="DWS">DWS</option>
            <option value="ADS">ADS</option>
          </select>
          <button type="button" class="btn btn-sm" @click="onOpenTicket">📋 开工单</button>
        </div>
      </div>
      <div class="card-body qual-rules">
        <div v-if="!paged.length" class="qual-empty">当前筛选无规则</div>
        <div
          v-for="r in paged"
          :key="r.id"
          class="rule-card"
          :class="{ fail: !r.pass }"
        >
          <div class="rule-header">
            <div class="rule-name">
              <span class="tag" :class="r.pass ? 'tag-green' : 'tag-red'">{{ r.pass ? '✓ 通过' : '✗ 失败' }}</span>
              <span class="rule-id">{{ r.displayId || r.id }}</span>
              <span class="tag tag-blue">{{ r.level }}</span>
              <span class="tag tag-purple">{{ r.type }}</span>
              <span v-if="r.alert" class="tag tag-red">· 已阻断 DAG</span>
            </div>
            <div class="rule-status">{{ r.status }}</div>
          </div>
          <div class="rule-body">{{ r.expr }}</div>
          <div class="rule-meta">
            <span>📊 表：<code>{{ r.table }}</code></span>
            <span v-if="r.field"> · 字段：<code>{{ r.field }}</code></span>
            <span v-else> · <span class="tag tag-gray" style="font-size: 10px">表级</span></span>
          </div>
          <div class="rule-result-bar">
            <div class="progress rule-progress">
              <div class="progress-bar" :style="{ width: `${r.ok}%`, background: 'linear-gradient(90deg,var(--success) 0%, #5cdbd3 100%)' }" />
            </div>
            <span class="rule-pass-count">✓ {{ r.okRows }}</span>
            <span class="rule-fail-count">✗ {{ r.failRows }}</span>
            <button type="button" class="btn btn-sm" @click="viewTable(r)">查看表 →</button>
            <button
              v-if="!r.pass"
              type="button"
              class="btn btn-sm btn-primary"
              @click="goLineage(r)"
            >上溯血缘</button>
          </div>
        </div>
        <ListPager
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="total"
          :total-pages="totalPages"
          :page-nums="pageNums"
          :page-count="paged.length"
          @go="goPage"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.qual-empty {
  color: var(--text-3);
  text-align: center;
  padding: 24px;
}
.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.quality-metrics-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
@media (max-width: 1100px) {
  .quality-metrics-row { grid-template-columns: repeat(2, 1fr); }
}

.quality-metric-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.qmc-title { font-size: 12px; color: var(--text-3); }
.qmc-value { font-size: 22px; font-weight: 700; margin-top: 2px; }
.qmc-unit { font-size: 13px; color: var(--text-3); font-weight: 400; }
.qmc-sub { font-size: 11px; color: var(--text-3); margin-top: 4px; }
.qmc-sub.success { color: var(--success); }
.qmc-sub.danger { color: var(--danger); }

.qual-charts {
  grid-template-columns: 1.3fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 960px) {
  .qual-charts { grid-template-columns: 1fr; }
}

.qual-tags { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.quality-trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 120px;
  padding-top: 8px;
}
.qtc-col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
.qtc-bar-wrap {
  width: 100%;
  height: 90px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.qtc-bar {
  width: 70%;
  min-height: 4px;
  border-radius: 3px 3px 0 0;
  background: var(--success);
}
.qtc-bar.warn { background: var(--warning); }
.qtc-bar.bad { background: var(--danger); }
.qtc-label { font-size: 9px; color: var(--text-4); margin-top: 2px; }

.qual-trend-axis {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-top: 10px;
  font-size: 10px;
  color: var(--text-3);
  text-align: center;
}
.qual-trend-axis span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

.qual-dist { display: flex; flex-direction: column; gap: 12px; }
.qual-dist-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}

.qual-gold {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--border);
}
.qual-gold-title { font-size: 12px; font-weight: 600; margin-bottom: 10px; }
.qual-gold-list { display: flex; flex-direction: column; gap: 8px; }
.qual-gold-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--success-light);
  border-radius: 6px;
  cursor: pointer;
}
.qual-gold-score { font-size: 11px; color: #00a676; font-weight: 700; }
.qual-gold-name { font-size: 12px; font-weight: 500; flex: 1; }

.qual-rules { display: flex; flex-direction: column; gap: 12px; }
.rule-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  background: #fff;
}
.rule-card.fail {
  border-color: #ffa39e;
  background: var(--danger-light);
}
.rule-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.rule-name { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.rule-id { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
.rule-status { font-size: 11px; color: var(--text-3); }
.rule-body { font-size: 12px; color: var(--text-2); margin-bottom: 6px; }
.rule-meta { font-size: 11px; color: var(--text-3); margin-bottom: 8px; }
.rule-result-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rule-progress { flex: 1; min-width: 120px; }
.rule-pass-count { font-size: 11px; color: var(--success); }
.rule-fail-count { font-size: 11px; color: var(--danger); }
</style>
