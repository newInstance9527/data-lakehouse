<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import NavIcon from '@/components/common/NavIcon.vue'
import { useToast } from '@/composables/useToast'
import { useOverview } from '@/composables/useOverview'
import { OVERVIEW_MODULES, OV_PALETTE as P, OV_PIPELINE } from '@/data/overview'
import { pageGuideOf } from '@/data/pageGuides'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('overview')

const {
  loading,
  loaded,
  lastError,
  range,
  dsStats,
  assetStats,
  etlStats,
  qualityStats,
  qualityTrend,
  stdStats,
  lineageStats,
  applyStats,
  metricStats,
  serviceStats,
  availability,
  refresh: reloadOverview,
} = useOverview()

onMounted(async () => {
  try {
    await reloadOverview()
  } catch (e) {
    showToast(`总览加载失败：${e?.message || e}`, 'error')
  }
})

function sparkPath(values = [], w = 120, h = 36) {
  if (!values.length) return { line: '', area: '', pts: [] }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = w / Math.max(values.length - 1, 1)
  const pts = values.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / span) * (h - 6) - 3
    return [x, y]
  })
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  return { line, area, pts }
}

function segments(parts) {
  const total = parts.reduce((s, p) => s + (Number(p.value) || 0), 0) || 1
  return parts.map((p) => ({
    ...p,
    pct: Math.round(((Number(p.value) || 0) / total) * 1000) / 10,
  }))
}

/** SVG 环形扇区路径 */
function donutArc(cx, cy, r, startPct, endPct) {
  const toRad = (p) => ((p / 100) * 360 - 90) * (Math.PI / 180)
  const large = endPct - startPct > 50 ? 1 : 0
  const x1 = cx + r * Math.cos(toRad(startPct))
  const y1 = cy + r * Math.sin(toRad(startPct))
  const x2 = cx + r * Math.cos(toRad(endPct))
  const y2 = cy + r * Math.sin(toRad(endPct))
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

function donutSlices(parts, cx = 54, cy = 54, r = 40) {
  const segs = segments(parts)
  let acc = 0
  return segs.map((s) => {
    const start = acc
    const end = Math.min(100, acc + s.pct)
    acc = end
    const mid = (start + end) / 2
    return {
      ...s,
      d: s.pct <= 0 ? '' : donutArc(cx, cy, r, start, end === 100 && start === 0 ? 99.99 : end),
      mid,
    }
  })
}

const kpiCards = computed(() => {
  const ds = dsStats.value
  const as = assetStats.value
  const etl = etlStats.value
  const q = qualityStats.value
  const meta = Object.fromEntries(OVERVIEW_MODULES.map((m) => [m.id, m]))
  const qSpark = qualityTrend.value.values || []

  const items = [
    {
      ...meta.datasource,
      value: String(ds.total),
      unit: '个',
      sub: `在线 ${ds.online} · 告警 ${ds.warn}`,
      meter: ds.healthPct,
      meterLabel: '健康率',
      tone: ds.warn ? 'warn' : 'ok',
      spark: [],
    },
    {
      ...meta.assets,
      value: String(as.total),
      unit: '张',
      sub: `${as.domains} 域 · 黄金 ${as.gold}`,
      meter: as.total ? Math.round((as.gold / as.total) * 1000) / 10 : 0,
      meterLabel: '黄金占比',
      tone: 'primary',
      spark: [],
    },
    {
      ...meta.etl,
      value: String(etl.total),
      unit: '个',
      sub: `生产 ${etl.prod} · 近窗失败 ${etl.runFailed}`,
      meter: etl.total ? Math.round((etl.prod / etl.total) * 1000) / 10 : 0,
      meterLabel: '生产占比',
      tone: etl.runFailed || etl.runBlocked ? 'danger' : 'ok',
      spark: [],
    },
    {
      ...meta.quality,
      value: q.runCount > 0 ? String(q.avg) : '—',
      unit: q.runCount > 0 ? '分' : '',
      sub: q.runCount > 0 ? `通过率 ${q.passRate}% · 阻断 ${q.blocked}` : '暂无质量运行',
      meter: q.runCount > 0 ? q.avg : 0,
      meterLabel: q.runCount > 0 ? '均分' : '暂无',
      tone: q.runCount > 0 && (q.blocked || q.low) ? 'warn' : 'ok',
      spark: qSpark,
    },
  ]

  return items.map((k) => {
    const path = sparkPath(k.spark, 140, 32)
    const color =
      k.tone === 'warn' ? P.warning : k.tone === 'danger' ? P.danger : k.tone === 'primary' ? P.primary : P.success
    return {
      ...k,
      color,
      sparkLine: path.line,
      sparkArea: path.area,
      hasSpark: !!(k.spark && k.spark.length > 1),
    }
  })
})

const qualityTrendChart = computed(() => {
  const t = qualityTrend.value
  const vals = t.values || []
  const path = sparkPath(vals, 320, 120)
  const labels = t.labels || []
  const axisLabels =
    labels.length <= 8
      ? labels
      : labels.filter((_, i) => i === 0 || i === labels.length - 1 || i % Math.ceil(labels.length / 6) === 0)
  return {
    labels: axisLabels,
    values: vals,
    line: path.line,
    area: path.area,
    pts: path.pts,
    min: t.min ?? 0,
    max: t.max ?? 0,
    empty: vals.length < 2,
  }
})

const dsDonut = computed(() => {
  const ds = dsStats.value
  return donutSlices([
    { label: '在线', value: ds.online, color: P.success },
    { label: '告警', value: ds.warn, color: P.warning },
    { label: '暂停', value: ds.paused, color: P.mute },
  ])
})

const layerBars = computed(() => {
  const entries = Object.entries(assetStats.value.byLayer || {})
  if (!entries.length) return []
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return entries.map(([label, value], i) => ({
    label,
    value,
    pct: Math.round((value / max) * 100),
    color: P.series[i % P.series.length],
  }))
})

const etlBars = computed(() => {
  const e = etlStats.value
  return segments([
    { label: '生产', value: e.prod, color: P.success },
    { label: '草稿', value: e.draft, color: P.mute },
    { label: '暂停', value: e.paused, color: P.warning },
    { label: '其他', value: e.other, color: P.primary },
  ]).filter((s) => s.value > 0 || e.total === 0)
})

const etlRunBars = computed(() => {
  const e = etlStats.value
  return segments([
    { label: '成功', value: e.runSuccess, color: P.success },
    { label: '失败', value: e.runFailed, color: P.danger },
    { label: '阻断', value: e.runBlocked, color: P.warning },
    { label: '运行中', value: e.runRunning, color: P.primary },
  ]).filter((s) => s.value > 0)
})

const qualityDist = computed(() => {
  const q = qualityStats.value
  const max = Math.max(q.high, q.mid, q.low, 1)
  return [
    { label: '≥95', value: q.high, color: P.success, h: Math.round((q.high / max) * 100) },
    { label: '80–94', value: q.mid, color: P.primary, h: Math.round((q.mid / max) * 100) },
    { label: '<80', value: q.low, color: P.warning, h: Math.round((q.low / max) * 100) },
  ]
})

const lineageCompare = computed(() => {
  const l = lineageStats.value
  const max = Math.max(l.explicit, l.inferred, 1)
  return [
    { label: '显式边', value: l.explicit, pct: Math.round((l.explicit / max) * 100), color: P.primary },
    { label: '推断边', value: l.inferred, pct: Math.round((l.inferred / max) * 100), color: P.mute },
  ]
})

const stdGauge = computed(() => {
  const pct = stdStats.value.okPct
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, pct) / 100)
  return { pct, r, c: c.toFixed(1), offset: offset.toFixed(1), dash: `${(c - offset).toFixed(1)} ${c.toFixed(1)}` }
})

function go(to) {
  if (to) router.push(to)
}

async function refresh() {
  try {
    await reloadOverview()
    showToast('已刷新总览统计', 'success')
  } catch (e) {
    showToast(`刷新失败：${e?.message || e}`, 'error')
  }
}

const rangeLabel = computed(() => {
  if (range.value === '1d') return '今日'
  if (range.value === '7d') return '近 7 天'
  if (range.value === 'q') return '近 30 天（季度暂按月窗）'
  return '近 30 天'
})
</script>

<template>
  <div class="ov">
    <PageHeader
      page-id="overview"
      title="总览仪表盘"
      subtitle="平台健康度一览 · 接入 → 入湖 → 治理 → 服务"
      :guide-title="guide.title"
      :guide="guide"
    >
      <select v-model="range" class="select" :disabled="loading">
        <option value="1d">今日</option>
        <option value="7d">近7天</option>
        <option value="30d">近30天</option>
        <option value="q">本季度</option>
      </select>
      <button class="btn btn-sm" type="button" :disabled="loading" @click="refresh">
        {{ loading ? '…' : '↻' }} 刷新
      </button>
      <button class="btn btn-sm btn-primary" type="button" @click="go('/catalog')">探索资产</button>
    </PageHeader>

    <p v-if="lastError && loaded" class="ov-banner warn">
      部分指标加载失败，已展示可用数据。可点刷新重试。
    </p>
    <p v-else-if="loading && !loaded" class="ov-banner">正在拉取各模块统计…</p>

    <!-- 主链路 -->
    <nav class="ov-pipe" aria-label="数据主链路">
      <button
        v-for="(p, i) in OV_PIPELINE"
        :key="p.id"
        type="button"
        class="ov-pipe-step"
        @click="go(p.to)"
      >
        <span class="ov-pipe-idx">{{ i + 1 }}</span>
        <span class="ov-pipe-txt">
          <b>{{ p.label }}</b>
          <small>{{ p.sub }}</small>
        </span>
        <span v-if="i < OV_PIPELINE.length - 1" class="ov-pipe-arrow" aria-hidden="true">→</span>
      </button>
    </nav>

    <!-- 核心 KPI -->
    <div class="ov-kpis">
      <button
        v-for="k in kpiCards"
        :key="k.id"
        type="button"
        class="ov-kpi"
        @click="go(k.to)"
      >
        <div class="ov-kpi-top">
          <span class="ov-kpi-lab">
            <NavIcon :name="k.icon" :size="14" />
            {{ k.title }}
          </span>
          <span class="ov-kpi-meter-lab">{{ k.meterLabel }} {{ Math.round(k.meter) }}%</span>
        </div>
        <div class="ov-kpi-mid">
          <div>
            <div class="ov-kpi-num">
              {{ k.value }}<small>{{ k.unit }}</small>
            </div>
            <div class="ov-kpi-sub">{{ k.sub }}</div>
          </div>
          <svg
            v-if="k.hasSpark"
            class="ov-spark"
            viewBox="0 0 140 32"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient :id="'ovsg-' + k.id" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="k.color" stop-opacity="0.22" />
                <stop offset="100%" :stop-color="k.color" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="k.sparkArea" :fill="`url(#ovsg-${k.id})`" />
            <path
              :d="k.sparkLine"
              fill="none"
              :stroke="k.color"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="ov-kpi-track">
          <div class="ov-kpi-fill" :style="{ width: Math.min(100, k.meter) + '%', background: k.color }" />
        </div>
      </button>
    </div>

    <!-- 主图区：质量趋势 + 申请单 -->
    <div class="ov-row ov-row-main">
      <section class="ov-card ov-card-lg">
        <header class="ov-hd">
          <div>
            <h3>质量分趋势</h3>
            <p>规则运行均分 · {{ rangeLabel }}</p>
          </div>
          <button type="button" class="ov-link" @click="go('/quality')">详情</button>
        </header>
        <div v-if="qualityTrendChart.empty" class="ov-empty">
          <span>暂无质量运行趋势</span>
          <small>有规则运行记录后将按日展示均分</small>
        </div>
        <template v-else>
          <div class="ov-line-wrap">
            <svg viewBox="0 0 320 120" class="ov-line" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ov-q-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#1e6fff" stop-opacity="0.18" />
                  <stop offset="100%" stop-color="#1e6fff" stop-opacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="30" x2="320" y2="30" class="ov-grid" />
              <line x1="0" y1="60" x2="320" y2="60" class="ov-grid" />
              <line x1="0" y1="90" x2="320" y2="90" class="ov-grid" />
              <path :d="qualityTrendChart.area" fill="url(#ov-q-area)" />
              <path
                :d="qualityTrendChart.line"
                fill="none"
                stroke="#1e6fff"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle
                v-for="(pt, i) in qualityTrendChart.pts"
                :key="i"
                :cx="pt[0]"
                :cy="pt[1]"
                r="3.2"
                fill="#fff"
                stroke="#1e6fff"
                stroke-width="1.5"
              />
            </svg>
            <div class="ov-axis">
              <span v-for="(lb, i) in qualityTrendChart.labels" :key="i">{{ lb }}</span>
            </div>
          </div>
          <div class="ov-foot-stats">
            <div>
              <span>当前均分</span>
              <b>{{ qualityStats.avg }}</b>
            </div>
            <div>
              <span>区间最低</span>
              <b>{{ qualityTrendChart.min }}</b>
            </div>
            <div>
              <span>区间最高</span>
              <b class="ok">{{ qualityTrendChart.max }}</b>
            </div>
            <div>
              <span>门禁阻断</span>
              <b :class="{ warn: qualityStats.blocked }">{{ qualityStats.blocked }}</b>
            </div>
          </div>
        </template>
      </section>

      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>申请单</h3>
            <p>权限 / 出湖待办</p>
          </div>
          <button type="button" class="ov-link" @click="go('/apply')">详情</button>
        </header>
        <div class="ov-apply">
          <button type="button" class="ov-apply-tile" @click="go('/apply')">
            <span>待审批</span>
            <b :class="{ warn: applyStats.pending }">{{ applyStats.pending }}</b>
          </button>
          <button type="button" class="ov-apply-tile" @click="go('/apply')">
            <span>我的申请</span>
            <b>{{ applyStats.mine }}</b>
          </button>
        </div>
        <div class="ov-foot-stats compact">
          <div>
            <span>质量规则</span>
            <b>{{ qualityStats.ruleCount }}</b>
          </div>
          <div>
            <span>近窗运行</span>
            <b>{{ qualityStats.runCount }}</b>
          </div>
        </div>
      </section>
    </div>

    <!-- 分布区 -->
    <div class="ov-row ov-row-3">
      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>数据源状态</h3>
            <p>连通健康分布</p>
          </div>
          <button type="button" class="ov-link" @click="go('/datasource')">详情</button>
        </header>
        <div class="ov-donut-row">
          <svg viewBox="0 0 108 108" class="ov-donut" aria-hidden="true">
            <circle cx="54" cy="54" r="40" fill="none" stroke="#eef2f7" stroke-width="12" />
            <path
              v-for="(s, i) in dsDonut"
              :key="i"
              :d="s.d"
              fill="none"
              :stroke="s.color"
              stroke-width="12"
              stroke-linecap="butt"
            />
            <text x="54" y="52" text-anchor="middle" class="ov-donut-num">{{ dsStats.healthPct }}%</text>
            <text x="54" y="66" text-anchor="middle" class="ov-donut-cap">健康率</text>
          </svg>
          <ul class="ov-legend">
            <li v-for="s in dsDonut" :key="s.label">
              <i :style="{ background: s.color }" />
              <span>{{ s.label }}</span>
              <b>{{ s.value }}</b>
            </li>
          </ul>
        </div>
      </section>

      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>资产分层</h3>
            <p>
              当前页抽样 {{ assetStats.sampleSize || 0 }} 张
              <template v-if="assetStats.total"> · 总量 {{ assetStats.total }}</template>
            </p>
          </div>
          <button type="button" class="ov-link" @click="go('/catalog')">详情</button>
        </header>
        <div v-if="!layerBars.length" class="ov-empty sm">
          <span>暂无资产</span>
        </div>
        <template v-else>
          <div class="ov-hbars">
            <div v-for="b in layerBars" :key="b.label" class="ov-hbar">
              <div class="ov-hbar-lab">
                <span>{{ b.label }}</span>
                <b>{{ b.value }}</b>
              </div>
              <div class="ov-hbar-track">
                <div class="ov-hbar-fill" :style="{ width: b.pct + '%', background: b.color }" />
              </div>
            </div>
          </div>
          <div class="ov-foot-stats compact">
            <div>
              <span>敏感/机密</span>
              <b class="warn">{{ assetStats.sensitive }}</b>
            </div>
            <div>
              <span>黄金表</span>
              <b class="ok">{{ assetStats.gold }}</b>
            </div>
          </div>
        </template>
      </section>

      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>质量分桶</h3>
            <p>客户端分桶（资产页质量分 / 黄金榜）</p>
          </div>
          <button type="button" class="ov-link" @click="go('/quality')">详情</button>
        </header>
        <div v-if="!qualityStats.hasBucket" class="ov-empty sm">
          <span>暂无分桶数据</span>
          <small>资产质量分或黄金榜有数据后展示</small>
        </div>
        <div v-else class="ov-hist">
          <div v-for="b in qualityDist" :key="b.label" class="ov-hist-col">
            <div class="ov-hist-val">{{ b.value }}</div>
            <div class="ov-hist-bar-wrap">
              <div class="ov-hist-bar" :style="{ height: Math.max(8, b.h) + '%', background: b.color }" />
            </div>
            <div class="ov-hist-lab">{{ b.label }}</div>
          </div>
        </div>
      </section>
    </div>

    <!-- 下层：ETL、血缘、标准 -->
    <div class="ov-row ov-row-3">
      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>ETL 任务状态</h3>
            <p>生产 / 草稿 / 暂停</p>
          </div>
          <button type="button" class="ov-link" @click="go('/integration')">详情</button>
        </header>
        <div class="ov-stack">
          <div
            v-for="s in etlBars"
            :key="s.label"
            class="ov-stack-seg"
            :style="{ width: Math.max(s.pct, s.value ? 2 : 0) + '%', background: s.color }"
            :title="`${s.label} ${s.value}`"
          />
        </div>
        <ul class="ov-legend flat">
          <li v-for="s in etlBars" :key="s.label">
            <i :style="{ background: s.color }" />
            <span>{{ s.label }}</span>
            <b>{{ s.value }} · {{ s.pct }}%</b>
          </li>
        </ul>
        <div class="ov-foot-stats compact">
          <div>
            <span>近窗运行</span>
            <b>{{ etlStats.runTotal }}</b>
          </div>
          <div>
            <span>失败 / 阻断</span>
            <b :class="{ warn: etlStats.runFailed || etlStats.runBlocked }">
              {{ etlStats.runFailed }} / {{ etlStats.runBlocked }}
            </b>
          </div>
        </div>
      </section>

      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>血缘边对比</h3>
            <p>显式 vs 推断</p>
          </div>
          <button type="button" class="ov-link" @click="go('/lineage')">详情</button>
        </header>
        <div v-if="!lineageStats.fieldEdges" class="ov-empty sm">
          <span>暂无字段血缘</span>
          <small>同步血缘后展示边统计</small>
        </div>
        <template v-else>
          <div class="ov-compare">
            <div v-for="b in lineageCompare" :key="b.label" class="ov-compare-row">
              <span>{{ b.label }}</span>
              <div class="ov-compare-track">
                <div class="ov-compare-fill" :style="{ width: b.pct + '%', background: b.color }" />
              </div>
              <b>{{ b.value }}</b>
            </div>
          </div>
          <div class="ov-foot-stats compact">
            <div>
              <span>参与表</span>
              <b>{{ lineageStats.tables }}</b>
            </div>
            <div>
              <span>字段边</span>
              <b>{{ lineageStats.fieldEdges }}</b>
            </div>
          </div>
        </template>
      </section>

      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>标准合规</h3>
            <p>检测合规率</p>
          </div>
          <button type="button" class="ov-link" @click="go('/standard')">详情</button>
        </header>
        <div class="ov-gauge-row">
          <svg viewBox="0 0 96 96" class="ov-gauge" aria-hidden="true">
            <circle cx="48" cy="48" :r="stdGauge.r" fill="none" stroke="#eef2f7" stroke-width="8" />
            <circle
              cx="48"
              cy="48"
              :r="stdGauge.r"
              fill="none"
              stroke="#00a676"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="stdGauge.dash"
              transform="rotate(-90 48 48)"
            />
            <text x="48" y="46" text-anchor="middle" class="ov-donut-num">{{ stdGauge.pct }}%</text>
            <text x="48" y="60" text-anchor="middle" class="ov-donut-cap">合规</text>
          </svg>
          <ul class="ov-legend">
            <li><span>标准字段</span><b>{{ stdStats.fields }}</b></li>
            <li><span>码值</span><b>{{ stdStats.codes }}</b></li>
            <li><span>命名规范</span><b>{{ stdStats.namings }}</b></li>
            <li><span>待修</span><b class="warn">{{ stdStats.warn }}</b></li>
          </ul>
        </div>
      </section>
    </div>

    <!-- 有真实数据的补充 + 暂无模块占位 -->
    <div class="ov-row ov-row-2">
      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>ETL 近窗运行</h3>
            <p>最近运行结果分布</p>
          </div>
          <button type="button" class="ov-link" @click="go('/integration')">详情</button>
        </header>
        <div v-if="!etlRunBars.length" class="ov-empty sm">
          <span>暂无运行记录</span>
        </div>
        <template v-else>
          <div class="ov-stack">
            <div
              v-for="s in etlRunBars"
              :key="s.label"
              class="ov-stack-seg"
              :style="{ width: Math.max(s.pct, 2) + '%', background: s.color }"
              :title="`${s.label} ${s.value}`"
            />
          </div>
          <ul class="ov-legend flat">
            <li v-for="s in etlRunBars" :key="s.label">
              <i :style="{ background: s.color }" />
              <span>{{ s.label }}</span>
              <b>{{ s.value }} · {{ s.pct }}%</b>
            </li>
          </ul>
        </template>
      </section>

      <section class="ov-card" :class="{ 'ov-card-muted': !availability.metrics && !availability.serviceCalls }">
        <header class="ov-hd">
          <div>
            <h3>数据服务 / 指标</h3>
            <p>
              {{
                availability.serviceCalls
                  ? '服务来自数据服务概览 · 指标来自指标目录'
                  : availability.metrics
                    ? '指标来自指标目录'
                    : '尚未接入治理统计'
              }}
            </p>
          </div>
          <button v-if="availability.serviceCalls" type="button" class="ov-link" @click="go('/dataservice')">详情</button>
        </header>
        <div class="ov-na-grid">
          <div class="ov-na" :class="{ clickable: availability.serviceCalls }" @click="availability.serviceCalls && go('/dataservice')">
            <b>服务调用量</b>
            <template v-if="availability.serviceCalls">
              <span>{{ serviceStats.calls24h != null ? serviceStats.calls24h : '—' }}</span>
              <small>
                近窗调用
                <template v-if="serviceStats.avgLatencyMs != null"> · 均延迟 {{ Math.round(serviceStats.avgLatencyMs) }} ms</template>
              </small>
            </template>
            <template v-else>
              <span>暂无</span>
              <small>数据服务 overview 未返回</small>
            </template>
          </div>
          <div class="ov-na" :class="{ clickable: availability.apiPublish }" @click="availability.apiPublish && go('/dataservice')">
            <b>API 发布状态</b>
            <template v-if="availability.apiPublish">
              <span>{{ serviceStats.published }}</span>
              <small>
                已发布
                <template v-if="serviceStats.draft"> · 草稿 {{ serviceStats.draft }}</template>
                <template v-if="serviceStats.sqlrestOnline != null"> · 接口服务上线 {{ serviceStats.sqlrestOnline }}</template>
              </small>
            </template>
            <template v-else>
              <span>暂无</span>
              <small>无后端 API 生命周期统计</small>
            </template>
          </div>
          <div class="ov-na" :class="{ clickable: availability.metrics }" @click="availability.metrics && go('/metrics')">
            <b>指标构成</b>
            <template v-if="availability.metrics">
              <span>{{ metricStats.total }}</span>
              <small>
                原子 {{ metricStats.atom }} · 衍生 {{ metricStats.derive }} · 复合 {{ metricStats.composite }} ·
                已启用 {{ metricStats.active }}
              </small>
            </template>
            <template v-else>
              <span>暂无</span>
              <small>指标中心未接入</small>
            </template>
          </div>
        </div>
        <p v-if="!availability.serviceCalls" class="ov-na-hint">
          数据服务调用量待 overview 可用；指标目录已可在「指标中心」查看与维护。
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ov {
  --ov-gap: 14px;
  --ov-r: 10px;
}

.ov-banner {
  margin: -4px 0 12px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-2);
  background: var(--bg-2);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.ov-banner.warn {
  color: #ad6800;
  background: #fff7e6;
  border-color: #ffd591;
}

.ov-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 140px;
  color: var(--text-3);
  font-size: 13px;
  text-align: center;
}
.ov-empty.sm { min-height: 100px; }
.ov-empty small {
  font-size: 11px;
  color: var(--text-4, #94a3b8);
}

.ov-apply {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 4px;
}
.ov-apply-tile {
  border: 1px solid var(--border);
  background: var(--bg-2);
  border-radius: 8px;
  padding: 16px 12px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ov-apply-tile:hover { border-color: var(--primary); }
.ov-apply-tile span {
  font-size: 11px;
  color: var(--text-3);
}
.ov-apply-tile b {
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.ov-apply-tile b.warn { color: var(--warning); }

.ov-na-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
.ov-na {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 2px 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--bg-2);
  border: 1px dashed var(--border);
}
.ov-na b {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.ov-na > span {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-3);
  justify-self: end;
}
.ov-na small {
  grid-column: 1 / -1;
  font-size: 11px;
  color: var(--text-4, #94a3b8);
}
.ov-na-hint {
  margin: 12px 0 0;
  font-size: 11px;
  color: var(--text-3);
}
.ov-card-muted {
  background: linear-gradient(180deg, var(--bg-1) 0%, var(--bg-2) 100%);
}

/* 主链路 */
.ov-pipe {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-bottom: 16px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--ov-r);
  padding: 10px 8px;
  overflow-x: auto;
}
.ov-pipe-step {
  flex: 1;
  min-width: 120px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: left;
  padding: 6px 10px;
  border-radius: 8px;
  position: relative;
}
.ov-pipe-step:hover {
  background: var(--bg-2);
}
.ov-pipe-idx {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary);
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.ov-pipe-txt {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.ov-pipe-txt b {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-1);
}
.ov-pipe-txt small {
  font-size: 10px;
  color: var(--text-3);
}
.ov-pipe-arrow {
  margin-left: auto;
  color: var(--text-4);
  font-size: 14px;
  padding-left: 4px;
}

/* KPI */
.ov-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ov-gap);
  margin-bottom: var(--ov-gap);
}
@media (max-width: 1100px) {
  .ov-kpis { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .ov-kpis { grid-template-columns: 1fr; }
}

.ov-kpi {
  border: 1px solid var(--border);
  border-radius: var(--ov-r);
  background: var(--bg-1);
  padding: 14px 14px 12px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ov-kpi:hover {
  border-color: #c9d6ef;
  box-shadow: var(--shadow-sm);
}
.ov-kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.ov-kpi-lab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.ov-kpi-meter-lab {
  font-size: 10px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.ov-kpi-mid {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}
.ov-kpi-num {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.ov-kpi-num small {
  margin-left: 3px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.ov-kpi-sub {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-3);
}
.ov-spark {
  width: 88px;
  height: 32px;
  flex-shrink: 0;
}
.ov-kpi-track {
  margin-top: 10px;
  height: 3px;
  border-radius: 99px;
  background: var(--bg-2);
  overflow: hidden;
}
.ov-kpi-fill {
  height: 100%;
  border-radius: 99px;
  min-width: 2px;
}

/* cards */
.ov-row {
  display: grid;
  gap: var(--ov-gap);
  margin-bottom: var(--ov-gap);
}
.ov-row-main {
  grid-template-columns: 1.6fr 1fr;
}
.ov-row-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.ov-row-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 1100px) {
  .ov-row-main,
  .ov-row-3,
  .ov-row-2 { grid-template-columns: 1fr; }
}

.ov-card {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--ov-r);
  padding: 14px 16px 12px;
  min-width: 0;
}
.ov-hd {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
}
.ov-hd h3 {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-1);
  margin: 0;
}
.ov-hd p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--text-3);
}
.ov-link {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--text-2);
  cursor: pointer;
  flex-shrink: 0;
}
.ov-link:hover {
  border-color: var(--primary);
  color: var(--primary);
}

/* line chart */
.ov-line-wrap { min-height: 140px; }
.ov-line {
  width: 100%;
  height: 120px;
  display: block;
}
.ov-grid {
  stroke: #eef2f7;
  stroke-width: 1;
}
.ov-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-3);
}

/* donut */
.ov-donut-row,
.ov-gauge-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ov-donut,
.ov-gauge {
  width: 108px;
  height: 108px;
  flex-shrink: 0;
}
.ov-donut-num {
  font-size: 14px;
  font-weight: 700;
  fill: var(--text-1);
}
.ov-donut-cap {
  font-size: 9px;
  fill: var(--text-3);
}

.ov-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.ov-legend.flat { margin-top: 10px; }
.ov-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-2);
}
.ov-legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ov-legend span { flex: 1; min-width: 0; }
.ov-legend b {
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  color: var(--text-1);
}
.ov-legend b.warn { color: var(--warning); }
.ov-legend b.ok { color: var(--success); }

/* horizontal bars */
.ov-hbars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ov-hbar-lab {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 4px;
}
.ov-hbar-lab span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ov-hbar-lab b {
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
}
.ov-hbar-track {
  height: 8px;
  border-radius: 99px;
  background: var(--bg-2);
  overflow: hidden;
}
.ov-hbar-fill {
  height: 100%;
  border-radius: 99px;
  min-width: 2px;
  transition: width 0.3s ease;
}

/* histogram */
.ov-hist {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  height: 140px;
  padding: 0 8px;
}
.ov-hist-col {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ov-hist-val {
  font-size: 12px;
  font-weight: 650;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}
.ov-hist-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.ov-hist-bar {
  width: 48%;
  min-height: 4px;
  border-radius: 4px 4px 0 0;
}
.ov-hist-lab {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-3);
}

/* stacked */
.ov-stack {
  display: flex;
  height: 12px;
  border-radius: 99px;
  overflow: hidden;
  background: var(--bg-2);
}
.ov-stack-seg {
  height: 100%;
  min-width: 2px;
}

/* compare */
.ov-compare {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 8px;
}
.ov-compare-row {
  display: grid;
  grid-template-columns: 56px 1fr 48px;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-2);
}
.ov-compare-track {
  height: 10px;
  border-radius: 99px;
  background: var(--bg-2);
  overflow: hidden;
}
.ov-compare-fill {
  height: 100%;
  border-radius: 99px;
  min-width: 2px;
}
.ov-compare-row b {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
}

/* footer stats */
.ov-foot-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.ov-foot-stats.compact {
  grid-template-columns: repeat(2, 1fr);
}
.ov-foot-stats div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ov-foot-stats span {
  font-size: 10px;
  color: var(--text-3);
}
.ov-foot-stats b {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
}
.ov-foot-stats b.ok { color: var(--success); }
.ov-foot-stats b.warn { color: var(--warning); }
</style>
