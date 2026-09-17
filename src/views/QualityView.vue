<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { QUALITY_RULE_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  QUALITY_GOLD_TABLES,
  QUALITY_METRICS,
  QUALITY_RULES,
  QUALITY_TREND_LABELS,
  QUALITY_TYPE_DIST,
  buildQualityTrendPoints,
} from '@/data/quality'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('quality')

const range = ref('30')
const layerFilter = ref('')
const createOpen = ref(false)
const rules = ref(QUALITY_RULES.map((r) => ({ ...r })))

const trendPoints = buildQualityTrendPoints()

const filteredRules = computed(() => {
  const layer = layerFilter.value
  if (!layer) return rules.value
  return rules.value.filter((r) => r.layer === layer)
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredRules)

watch(layerFilter, () => resetPage())

const typeToLevel = {
  主键唯一: '技术',
  非空: '技术',
  枚举: '标准',
  范围: '技术',
  行数阈值: '业务',
  自定义SQL: '业务',
}

function newRule() {
  createOpen.value = true
}

function onCreateRule(payload) {
  const name = payload.name.replace(/\s+/g, '_').toUpperCase()
  const table = payload.table
  const field = payload.scope === 'field' ? payload.field : ''
  const short = table.split('.').pop() || table
  const block = payload.sev === '阻断'
  const idSuffix = field ? `${field}.${name}` : name
  rules.value.unshift({
    id: `${short}.${idSuffix}`,
    table,
    field: field || '',
    scope: payload.scope || (field ? 'field' : 'table'),
    layer: table.toLowerCase().includes('ods')
      ? 'ODS'
      : table.toLowerCase().includes('ads')
        ? 'ADS'
        : table.toLowerCase().includes('dws')
          ? 'DWS'
          : 'DWD',
    level: typeToLevel[payload.rtype] || '技术',
    type: payload.rtype,
    expr: payload.expr || `${payload.rtype} · 待配置`,
    pass: true,
    ok: 100,
    fail: 0,
    okRows: '—',
    failRows: '0',
    status: block ? '启用·门禁阻断' : '启用·告警',
    alert: false,
  })
  resetPage()
  const bindTip = field ? `${table}.${field}` : `${table}（整表）`
  showToast(`✅ 质量规则已创建：${name} · 绑定 ${bindTip}`, 'success')
}

function openTicket() {
  showToast('📋 质量工单已创建 · 指派 dwd_order_detail Owner', 'success')
}

function viewTable(rule) {
  const key = rule.table.includes('user_info') ? 'dwd_user_info' : 'dwd_order_detail'
  router.push({ path: '/catalog', query: { q: key } })
}

function viewGold(row) {
  router.push({ path: '/catalog', query: { q: row.assetKey } })
}

function ringDash(pct) {
  const n = Math.min(100, Math.max(0, pct))
  return `${(n * 0.942).toFixed(1)} 100`
}
</script>

<template>
  <div class="qual-page">
    <PageHeader
      title="数据质量中心"
      subtitle="流批双模校验 · 质量门禁阻断 DAG · 结果回写资产目录"
      :guide="guide"
    >
      <select v-model="range" class="select input-sm">
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

    <div class="quality-metrics-row">
      <div v-for="(m, i) in QUALITY_METRICS" :key="i" class="quality-metric-card">
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
          <div class="card-title">📈 质量分 30 日趋势 <span class="tip">（按平均质量分 + 每日阻断次数）</span></div>
          <div class="qual-tags">
            <span class="tag tag-green">质量分</span>
            <span class="tag tag-red">阻断次数</span>
          </div>
        </div>
        <div class="card-body">
          <div class="quality-trend-chart">
            <div v-for="(d, i) in trendPoints" :key="i" class="qtc-col" :title="`第${30 - i}天前 ${d.v}分`">
              <div class="qtc-bar-wrap">
                <div class="qtc-bar" :class="d.cls" :style="{ height: `${d.h}%` }" />
              </div>
              <div class="qtc-label">{{ d.v }}</div>
            </div>
          </div>
          <div class="qual-trend-axis">
            <span v-for="(lb, li) in QUALITY_TREND_LABELS" :key="li">{{ lb }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🏷️ 规则类型分布</div>
          <span class="tag">共 326 条规则</span>
        </div>
        <div class="card-body">
          <div class="qual-dist">
            <div v-for="t in QUALITY_TYPE_DIST" :key="t.label">
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
            <div class="qual-gold-title">🏆 Top 5 质量最优表</div>
            <div class="qual-gold-list">
              <div v-for="g in QUALITY_GOLD_TABLES" :key="g.table" class="qual-gold-row" @click="viewGold(g)">
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
        <div class="card-title">⚠️ 活跃异常规则（近24h）<span class="tip">· 点击可查看失败样本</span></div>
        <div class="qual-tags">
          <select v-model="layerFilter" class="select input-sm">
            <option value="">全部层级</option>
            <option value="ODS">ODS</option>
            <option value="DWD">DWD</option>
            <option value="DWS">DWS</option>
            <option value="ADS">ADS</option>
          </select>
          <button type="button" class="btn btn-sm" @click="openTicket">📋 开工单</button>
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
              <span class="rule-id">{{ r.id }}</span>
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
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  gap: 6px;
  margin-top: 10px;
  font-size: 10px;
  color: var(--text-3);
  text-align: center;
}

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
