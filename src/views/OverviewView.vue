<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useDatasources } from '@/composables/useDatasources'
import { useAssets } from '@/composables/useAssets'
import { useEtl } from '@/composables/useEtl'
import { useStandards } from '@/composables/useStandards'
import { useLineage } from '@/composables/useLineage'
import {
  DEMO_METRIC_STATS,
  DEMO_SERVICE_STATS,
  OVERVIEW_MODULES,
  OV_PALETTE as P,
  OV_PIPELINE,
  OV_TRENDS,
} from '@/data/overview'
import { pageGuideOf } from '@/data/pageGuides'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('overview')
const range = ref('30d')

const { list: sources } = useDatasources()
const { list: assets } = useAssets()
const { taskList } = useEtl()
const { fieldList, codeList, namingList } = useStandards()
const { stats: lineageRaw } = useLineage()

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

const dsStats = computed(() => {
  const list = sources.value || []
  const online = list.filter((s) => s.status === 'online').length
  const warn = list.filter((s) => s.status === 'warn').length
  const paused = list.filter((s) => s.status === 'paused').length
  const types = new Set(list.map((s) => s.type)).size
  return {
    total: list.length,
    online,
    warn,
    paused,
    types,
    healthPct: list.length ? Math.round((online / list.length) * 1000) / 10 : 0,
  }
})

const assetStats = computed(() => {
  const list = assets.value || []
  const byLayer = {}
  list.forEach((a) => {
    const k = a.layerLabel || a.layer || '其他'
    byLayer[k] = (byLayer[k] || 0) + 1
  })
  const gold = list.filter((a) => a.isGold).length
  const sensitive = list.filter((a) => a.level === '敏感' || a.level === '机密').length
  return {
    total: list.length,
    byLayer,
    gold,
    sensitive,
    domains: new Set(list.map((a) => a.domain)).size,
  }
})

const etlStats = computed(() => {
  const list = taskList.value || []
  const prod = list.filter((t) => t.status === 'prod').length
  const draft = list.filter((t) => t.status === 'draft').length
  const blocked = list.filter((t) => (t.nodes || []).some((n) => n.status === 'blocked')).length
  const nodes = list.reduce((n, t) => n + (t.nodes?.length || 0), 0)
  return {
    total: list.length,
    prod,
    draft,
    blocked,
    nodes,
    other: Math.max(0, list.length - prod - draft),
  }
})

const stdStats = computed(() => {
  const fields = fieldList.value || []
  const codes = codeList.value || []
  const namings = namingList.value || []
  const ok = fields.filter((f) => f.status === 'ok').length
  const warn = fields.filter((f) => f.status === 'warn' || f.status === 'fail').length
  return {
    fields: fields.length,
    codes: codes.length,
    namings: namings.length,
    ok,
    warn,
    mapped: fields.reduce((n, f) => n + (Number(f.mapped) || 0), 0),
    okPct: fields.length ? Math.round((ok / fields.length) * 1000) / 10 : 0,
  }
})

const svcStats = computed(() => ({ ...DEMO_SERVICE_STATS }))
const metricStats = computed(() => ({ ...DEMO_METRIC_STATS }))

const lineageStats = computed(() => {
  const s = lineageRaw.value || {}
  const tables = Number(s.tables) || 0
  const tableEdges = Number(s.tableEdges) || 0
  const fieldEdges = Number(s.fieldEdges) || 0
  const explicit = Number(s.explicit) || 0
  const inferred = Number(s.inferred) || 0
  const tasks = Number(s.tasks) || 0
  return { tables, tableEdges, fieldEdges, explicit, inferred, tasks }
})

const qualityStats = computed(() => {
  const list = assets.value || []
  if (!list.length) return { avg: 0, high: 0, mid: 0, low: 0, blocked: 0 }
  const avg = Math.round((list.reduce((s, a) => s + (Number(a.quality) || 0), 0) / list.length) * 10) / 10
  const high = list.filter((a) => (a.quality || 0) >= 95).length
  const mid = list.filter((a) => (a.quality || 0) >= 80 && (a.quality || 0) < 95).length
  const low = list.filter((a) => (a.quality || 0) < 80).length
  return { avg, high, mid, low, blocked: low }
})

const trend = computed(() => OV_TRENDS[range.value] || OV_TRENDS['30d'])

const kpiCards = computed(() => {
  const ds = dsStats.value
  const as = assetStats.value
  const etl = etlStats.value
  const q = qualityStats.value
  const t = trend.value
  const meta = Object.fromEntries(OVERVIEW_MODULES.map((m) => [m.id, m]))

  const items = [
    {
      ...meta.datasource,
      value: String(ds.total),
      unit: '个',
      sub: `在线 ${ds.online} · 告警 ${ds.warn}`,
      meter: ds.healthPct,
      meterLabel: '健康率',
      tone: ds.warn ? 'warn' : 'ok',
      spark: t.etlOk.map((v, i) => 40 + (v % 40) + i),
    },
    {
      ...meta.assets,
      value: String(as.total),
      unit: '张',
      sub: `${as.domains} 域 · 黄金 ${as.gold}`,
      meter: as.total ? Math.round((as.gold / as.total) * 1000) / 10 : 0,
      meterLabel: '黄金占比',
      tone: 'primary',
      spark: t.apiCalls.map((v) => v),
    },
    {
      ...meta.etl,
      value: String(etl.total),
      unit: '个',
      sub: `生产 ${etl.prod} · 阻断 ${etl.blocked}`,
      meter: etl.total ? Math.round((etl.prod / etl.total) * 1000) / 10 : 0,
      meterLabel: '生产占比',
      tone: etl.blocked ? 'danger' : 'ok',
      spark: t.etlOk,
    },
    {
      ...meta.quality,
      value: String(q.avg),
      unit: '分',
      sub: `优 ${q.high} · 差 ${q.low}`,
      meter: q.avg,
      meterLabel: '均分',
      tone: q.low ? 'warn' : 'ok',
      spark: t.quality,
    },
  ]

  return items.map((k) => {
    const path = sparkPath(k.spark, 140, 32)
    const color =
      k.tone === 'warn' ? P.warning : k.tone === 'danger' ? P.danger : k.tone === 'primary' ? P.primary : P.success
    return { ...k, color, sparkLine: path.line, sparkArea: path.area }
  })
})

const qualityTrendChart = computed(() => {
  const t = trend.value
  const path = sparkPath(t.quality, 320, 120)
  const max = Math.max(...t.quality)
  const min = Math.min(...t.quality)
  return {
    labels: t.labels,
    values: t.quality,
    line: path.line,
    area: path.area,
    pts: path.pts,
    min,
    max,
  }
})

const apiTrendChart = computed(() => {
  const t = trend.value
  const vals = t.apiCalls
  const max = Math.max(...vals) || 1
  return {
    labels: t.labels,
    bars: vals.map((v, i) => ({
      label: t.labels[i],
      value: v,
      h: Math.round((v / max) * 100),
    })),
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

const svcDonut = computed(() => {
  const s = svcStats.value
  return donutSlices([
    { label: '已发布', value: s.published, color: P.primary },
    { label: '草稿', value: s.draft, color: P.mute },
    { label: '废弃', value: s.deprecated, color: P.warning },
  ])
})

const layerBars = computed(() => {
  const entries = Object.entries(assetStats.value.byLayer)
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
  const parts = segments([
    { label: '生产', value: e.prod, color: P.success },
    { label: '草稿', value: e.draft, color: P.mute },
    { label: '其他', value: e.other, color: P.primary },
  ])
  return parts
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

const metricBars = computed(() => {
  const m = metricStats.value
  const max = Math.max(m.atomic, m.derived, m.composite, 1)
  return [
    { label: '原子', value: m.atomic, pct: Math.round((m.atomic / max) * 100), color: P.primary },
    { label: '衍生', value: m.derived, pct: Math.round((m.derived / max) * 100), color: P.success },
    { label: '复合', value: m.composite, pct: Math.round((m.composite / max) * 100), color: P.mute },
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

function refresh() {
  showToast('✅ 已刷新总览统计', 'success')
}

const rangeLabel = computed(() => ({
  '1d': '今日',
  '7d': '近 7 天',
  '30d': '近 30 天',
  q: '本季度',
}[range.value] || '近 30 天'))
</script>

<template>
  <div class="ov">
    <PageHeader
      title="总览仪表盘"
      subtitle="平台健康度一览 · 接入 → 入湖 → 治理 → 服务"
      :guide-title="guide.title"
      :guide="guide"
    >
      <select v-model="range" class="select">
        <option value="1d">今日</option>
        <option value="7d">近7天</option>
        <option value="30d">近30天</option>
        <option value="q">本季度</option>
      </select>
      <button class="btn btn-sm" type="button" @click="refresh">↻ 刷新</button>
      <button class="btn btn-sm btn-primary" type="button" @click="go('/catalog')">探索资产</button>
    </PageHeader>

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

    <!-- 核心 KPI · 折线微趋势 -->
    <div class="ov-kpis">
      <button
        v-for="k in kpiCards"
        :key="k.id"
        type="button"
        class="ov-kpi"
        @click="go(k.to)"
      >
        <div class="ov-kpi-top">
          <span class="ov-kpi-lab">{{ k.icon }} {{ k.title }}</span>
          <span class="ov-kpi-meter-lab">{{ k.meterLabel }} {{ Math.round(k.meter) }}%</span>
        </div>
        <div class="ov-kpi-mid">
          <div>
            <div class="ov-kpi-num">
              {{ k.value }}<small>{{ k.unit }}</small>
            </div>
            <div class="ov-kpi-sub">{{ k.sub }}</div>
          </div>
          <svg class="ov-spark" viewBox="0 0 140 32" preserveAspectRatio="none" aria-hidden="true">
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

    <!-- 主图区：质量趋势 + API 柱状 -->
    <div class="ov-row ov-row-main">
      <section class="ov-card ov-card-lg">
        <header class="ov-hd">
          <div>
            <h3>质量分趋势</h3>
            <p>资产均分走势 · {{ rangeLabel }}</p>
          </div>
          <button type="button" class="ov-link" @click="go('/quality')">详情</button>
        </header>
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
            <span v-for="lb in qualityTrendChart.labels" :key="lb">{{ lb }}</span>
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
            <span>门禁风险表</span>
            <b :class="{ warn: qualityStats.blocked }">{{ qualityStats.blocked }}</b>
          </div>
        </div>
      </section>

      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>服务调用量</h3>
            <p>API 调用 · {{ rangeLabel }}</p>
          </div>
          <button type="button" class="ov-link" @click="go('/dataservice')">详情</button>
        </header>
        <div class="ov-vbars">
          <div v-for="b in apiTrendChart.bars" :key="b.label" class="ov-vbar">
            <div class="ov-vbar-col">
              <div class="ov-vbar-fill" :style="{ height: b.h + '%' }" :title="`${b.value}`" />
            </div>
            <span>{{ b.label }}</span>
          </div>
        </div>
        <div class="ov-foot-stats compact">
          <div>
            <span>今日调用</span>
            <b>{{ svcStats.callsToday }}</b>
          </div>
          <div>
            <span>SLA</span>
            <b class="ok">{{ svcStats.sla }}</b>
          </div>
        </div>
      </section>
    </div>

    <!-- 分布区：环形 + 横向条 + 柱状 -->
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
            <p>表数量对比</p>
          </div>
          <button type="button" class="ov-link" @click="go('/catalog')">详情</button>
        </header>
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
      </section>

      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>质量分桶</h3>
            <p>表质量分布</p>
          </div>
          <button type="button" class="ov-link" @click="go('/quality')">详情</button>
        </header>
        <div class="ov-hist">
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

    <!-- 下层：ETL 堆叠、血缘对比、标准环、指标条、服务环 -->
    <div class="ov-row ov-row-3">
      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>ETL 任务状态</h3>
            <p>生产 / 草稿占比</p>
          </div>
          <button type="button" class="ov-link" @click="go('/integration')">详情</button>
        </header>
        <div class="ov-stack">
          <div
            v-for="s in etlBars"
            :key="s.label"
            class="ov-stack-seg"
            :style="{ width: s.pct + '%', background: s.color }"
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
            <span>含阻断节点</span>
            <b :class="{ warn: etlStats.blocked }">{{ etlStats.blocked }}</b>
          </div>
          <div>
            <span>DAG 节点</span>
            <b>{{ etlStats.nodes }}</b>
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
      </section>

      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>标准合规</h3>
            <p>字段合规率</p>
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

    <div class="ov-row ov-row-2">
      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>指标构成</h3>
            <p>原子 / 衍生 / 复合</p>
          </div>
          <button type="button" class="ov-link" @click="go('/metrics')">详情</button>
        </header>
        <div class="ov-hbars">
          <div v-for="b in metricBars" :key="b.label" class="ov-hbar">
            <div class="ov-hbar-lab">
              <span><i class="ov-dot" :style="{ background: b.color }" />{{ b.label }}</span>
              <b>{{ b.value }}</b>
            </div>
            <div class="ov-hbar-track">
              <div class="ov-hbar-fill" :style="{ width: b.pct + '%', background: b.color }" />
            </div>
          </div>
        </div>
        <div class="ov-foot-stats compact">
          <div>
            <span>已认证</span>
            <b class="ok">{{ metricStats.certified }}</b>
          </div>
          <div>
            <span>待评审</span>
            <b class="warn">{{ metricStats.pending }}</b>
          </div>
        </div>
      </section>

      <section class="ov-card">
        <header class="ov-hd">
          <div>
            <h3>API 发布状态</h3>
            <p>服务生命周期</p>
          </div>
          <button type="button" class="ov-link" @click="go('/dataservice')">详情</button>
        </header>
        <div class="ov-donut-row">
          <svg viewBox="0 0 108 108" class="ov-donut" aria-hidden="true">
            <circle cx="54" cy="54" r="40" fill="none" stroke="#eef2f7" stroke-width="12" />
            <path
              v-for="(s, i) in svcDonut"
              :key="i"
              :d="s.d"
              fill="none"
              :stroke="s.color"
              stroke-width="12"
            />
            <text x="54" y="52" text-anchor="middle" class="ov-donut-num">{{ svcStats.apis }}</text>
            <text x="54" y="66" text-anchor="middle" class="ov-donut-cap">API</text>
          </svg>
          <ul class="ov-legend">
            <li v-for="s in svcDonut" :key="s.label">
              <i :style="{ background: s.color }" />
              <span>{{ s.label }}</span>
              <b>{{ s.value }} · {{ s.pct }}%</b>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ov {
  --ov-gap: 14px;
  --ov-r: 10px;
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

/* vertical bars */
.ov-vbars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 140px;
  padding-top: 8px;
}
.ov-vbar {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
}
.ov-vbar-col {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.ov-vbar-fill {
  width: 58%;
  min-height: 4px;
  border-radius: 4px 4px 0 0;
  background: var(--primary);
  opacity: 0.85;
  transition: height 0.3s ease;
}
.ov-vbar span {
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
.ov-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
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
