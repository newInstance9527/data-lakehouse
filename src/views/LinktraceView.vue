<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  LT_KPIS,
  LT_LINKS,
  LT_TRACES,
  findTraceByLink,
  spanBarClass,
  spanStatusTag,
} from '@/data/linktrace'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('linktrace')

const activeLink = ref('I')
const searchInput = ref(findTraceByLink('I')?.trace_id || '')
const logFilter = ref(findTraceByLink('I')?.trace_id || '')
const selectedSpan = ref(null)
const selectedTraceId = ref(null)

const currentTrace = computed(() => findTraceByLink(activeLink.value))

const waterfall = computed(() => {
  const trace = currentTrace.value
  if (!trace) return null
  const maxEnd = trace.spans.reduce((m, s) => Math.max(m, s.start + s.dur), 0) || 1
  const ticks = [0, Math.round(maxEnd * 0.25), Math.round(maxEnd * 0.5), Math.round(maxEnd * 0.75), maxEnd]
  const rows = trace.spans.map((s) => ({
    ...s,
    left: ((s.start / maxEnd) * 100).toFixed(2),
    width: Math.max(2, (s.dur / maxEnd) * 100).toFixed(2),
    barClass: spanBarClass(s.status),
  }))
  return { trace, ticks, rows, maxEnd }
})

const logRows = computed(() => {
  const f = (logFilter.value || '').trim().toLowerCase()
  const rows = []
  LT_TRACES.forEach((tr) => {
    tr.spans.forEach((s) => {
      const blob = (
        tr.trace_id +
        ' ' +
        tr.run_id +
        ' ' +
        tr.link_id +
        ' ' +
        (s.event_id || '') +
        ' ' +
        s.svc +
        ' ' +
        s.op +
        ' ' +
        s.msg
      ).toLowerCase()
      rows.push({ tr, s, blob })
    })
  })
  if (!f) return rows
  return rows.filter((r) => r.blob.includes(f))
})

const logTitle = computed(() => {
  if (currentTrace.value) return currentTrace.value.trace_id
  if (logFilter.value) return logFilter.value
  return '全部 span'
})

const failDetailTitle = computed(() => {
  const s = selectedSpan.value
  if (!s) return ''
  if (s.status === 'error') return '失败 span'
  if (s.status === 'warn') return '告警 span'
  return 'span 详情'
})

function exportSpans() {
  showToast('📄 导出 span · JSON · span 序列 · 含调用链耗时', 'success')
}

function goRootcause() {
  router.push('/rootcause')
}

function selectLink(id) {
  activeLink.value = id
  const t = findTraceByLink(id)
  searchInput.value = t ? t.trace_id : ''
  logFilter.value = t ? t.trace_id : id
  selectedSpan.value = null
  selectedTraceId.value = null
}

function doSearch() {
  logFilter.value = searchInput.value.trim()
}

function doReset() {
  searchInput.value = ''
  selectLink(activeLink.value)
}

function selectSpan(traceId, span) {
  selectedSpan.value = span
  selectedTraceId.value = traceId
}

function openRawLog(offset) {
  showToast(
    `📄 原始日志 · ${offset}\n[2026-09-03 03:15:32] INFO  cdc.trade.order - checkpoint #47 completed\n[2026-09-03 03:15:33] INFO  cdc.trade.order - record count: 1,824\n[2026-09-03 03:15:34] WARN  cdc.trade.order - lag: 125,000 (threshold 100,000)\n[2026-09-03 03:16:00] ERROR cdc.trade.order - checkpoint #48 failed\n…\n偏移: ${offset}`,
    'info',
  )
}

function kpiTrendClass(k) {
  if (k.trendDanger) return 'danger'
  if (k.trendWarn) return 'warn'
  return k.trendUp ? 'up' : 'down'
}
</script>

<template>
  <div class="lt-page">
    <PageHeader
      title="链路调用监控 · §29"
      subtitle="按 A–L 链路采跨组件 span · span 瀑布 + 按 trace_id/run_id 回放 · 失败 span 直接定位 hop（指标层与根因台之间的中间层）"
      :guide="guide"
    >
      <span class="tag tag-blue lt-ver">v1.2 新增</span>
      <button type="button" class="btn btn-sm" @click="exportSpans">📄 导出 span</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goRootcause">🔍 进根因台</button>
    </PageHeader>

    <div class="kpi-grid lt-kpi">
      <div v-for="(k, i) in LT_KPIS" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="kpiTrendClass(k)">{{ k.trend }}</div>
      </div>
    </div>

    <div class="card lt-filter-card">
      <div class="card-body">
        <div class="lt-toolbar">
          <div class="lt-link-pills">
            <button
              v-for="l in LT_LINKS"
              :key="l.id"
              type="button"
              class="lt-pill"
              :class="{ active: l.id === activeLink }"
              @click="selectLink(l.id)"
            >
              {{ l.id }} · {{ l.name }}
              <span v-if="!l.sample" class="lt-unsamp">未采</span>
            </button>
          </div>
          <div class="lt-search">
            <input
              v-model="searchInput"
              type="text"
              placeholder="按 trace_id / run_id / event_id 检索调用日志…"
              @keyup.enter="doSearch"
            />
            <button type="button" class="btn btn-sm btn-primary" @click="doSearch">检索</button>
            <button type="button" class="btn btn-sm" @click="doReset">重置</button>
          </div>
        </div>
        <div class="lt-hint">
          选链路看该链路最新一次调用的 span 瀑布；输入 ID 调出该次调用全量 span。失败/慢 span 点击可下钻。所有 span 由 OTel Collector 旁路采集，不反压生产链路。
        </div>
      </div>
    </div>

    <div class="grid grid-2 lt-main">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            📊 span 瀑布 ·
            <span v-if="waterfall">{{ waterfall.trace.link_id }} · {{ waterfall.trace.link_name }}</span>
            <span v-else>—</span>
          </div>
          <span v-if="waterfall" class="tip">
            {{ waterfall.trace.started_at }} · {{ waterfall.trace.run_id || waterfall.trace.trace_id }}
          </span>
        </div>
        <div class="card-body">
          <div v-if="!waterfall" class="lt-empty">
            该链路尚未采集 span（见说明书 §29.7 落地路线，A/C/D/I 二期，其余三期）。
          </div>
          <template v-else>
            <div class="span-waterfall">
              <div class="span-wf-ruler">
                <span v-for="(t, ti) in waterfall.ticks" :key="ti">{{ t }}ms</span>
              </div>
              <div v-for="s in waterfall.rows" :key="s.span_id" class="span-row">
                <div class="sr-label">
                  <div class="sr-svc">{{ s.svc }}</div>
                  <div class="sr-op">{{ s.op }}</div>
                </div>
                <div class="sr-track">
                  <div
                    class="sr-bar"
                    :class="s.barClass"
                    :style="{ left: s.left + '%', width: s.width + '%' }"
                    :title="`${s.svc} · ${s.op} · ${s.status} · ${s.dur}ms`"
                    @click="selectSpan(waterfall.trace.trace_id, s)"
                  >
                    {{ s.dur }}ms
                  </div>
                </div>
              </div>
            </div>
            <div class="span-wf-legend">
              <span><span class="lg-dot ok" />OK</span>
              <span><span class="lg-dot warn" />WARN</span>
              <span><span class="lg-dot error" />ERROR</span>
              <span><span class="lg-dot ghost" />异步/旁路</span>
              <span class="lg-axis">横轴 = 一次调用的相对时间</span>
            </div>
          </template>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🧯 失败 / 慢 span 下钻</div>
          <span class="tip">点瀑布条定位 hop</span>
        </div>
        <div class="card-body">
          <div v-if="!selectedSpan" class="lt-empty">
            在左侧瀑布点击任一 span 查看详情；失败 span 会显示错误码、原始日志偏移与上下游。
          </div>
          <div
            v-else
            class="span-fail"
            :class="{ soft: selectedSpan.status !== 'error' && selectedSpan.status !== 'warn' }"
          >
            <div class="sf-title">{{ failDetailTitle }} · {{ selectedSpan.svc }} · {{ selectedSpan.op }}</div>
            <div class="sf-body">
              <div>
                <b>trace_id</b> <code>{{ selectedTraceId }}</code> · <b>span_id</b>
                <code>{{ selectedSpan.span_id }}</code>
              </div>
              <div>
                <b>耗时</b> {{ selectedSpan.dur }}ms · <b>状态</b>
                {{ selectedSpan.status.toUpperCase() }}
              </div>
              <div v-if="selectedSpan.event_id">
                <b>event_id</b> <code>{{ selectedSpan.event_id }}</code>
              </div>
              <div><b>消息</b> {{ selectedSpan.msg }}</div>
              <div v-if="selectedSpan.error" class="sf-err">
                <b>错误码</b> <code>{{ selectedSpan.error }}</code>
              </div>
              <div v-if="selectedSpan.log_offset">
                <b>原始日志偏移</b> <code>{{ selectedSpan.log_offset }}</code>
                <button type="button" class="btn-link btn-sm" @click="openRawLog(selectedSpan.log_offset)">
                  查看原始日志 →
                </button>
              </div>
            </div>
            <button
              v-if="selectedSpan.status === 'error'"
              type="button"
              class="btn btn-sm btn-primary sf-rca"
              @click="goRootcause"
            >
              🔍 进根因台做五维叠加 →
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card lt-log-card">
      <div class="card-header">
        <div class="card-title">📜 调用日志 · {{ logTitle }}</div>
        <span class="tip">按 trace_id·run_id·event_id 检索 · 来自日志库（保留 14 天明细 + 90 天失败 span）</span>
      </div>
      <div class="card-body lt-log-body">
        <table class="table">
          <thead>
            <tr>
              <th>时间</th>
              <th>链路</th>
              <th>组件</th>
              <th>op</th>
              <th>span_id</th>
              <th>状态</th>
              <th>耗时</th>
              <th>event_id / run_id</th>
              <th>消息</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!logRows.length">
              <td colspan="9" class="lt-empty-cell">
                没有匹配的 span。试 trc-recon-I-09-03-0318 / recon-20260902 / ord-8827341
              </td>
            </tr>
            <tr
              v-for="r in logRows"
              :key="r.tr.trace_id + r.s.span_id"
              class="lt-log-row"
              @click="selectSpan(r.tr.trace_id, r.s)"
            >
              <td class="nowrap">{{ r.tr.started_at }}</td>
              <td>
                <b>{{ r.tr.link_id }}</b> {{ r.tr.link_name }}
              </td>
              <td>{{ r.s.svc }}</td>
              <td><code>{{ r.s.op }}</code></td>
              <td><code class="span-id">{{ r.s.span_id }}</code></td>
              <td>
                <span class="tag" :class="spanStatusTag(r.s.status).tag" style="font-size: 10px">
                  {{ spanStatusTag(r.s.status).label }}
                </span>
              </td>
              <td>{{ r.s.dur }}ms</td>
              <td class="evt-cell">{{ r.s.event_id || r.tr.run_id || r.tr.trace_id }}</td>
              <td class="msg-cell">{{ r.s.msg }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="lt-callout">
      <div class="lt-callout-title">🧭 排障路径（补 §6.8 第 0 步）</div>
      <div class="lt-callout-body">
        夜莺告警（指标层）→ <b>本台按告警带的 run_id/trace_id 调出 span 瀑布</b> → 定位失败/慢 hop（service+op），点开看
        error 与原始日志偏移 → 再进根因台做 血缘×任务×质量×组件×span 五维叠加。
        <button type="button" class="btn-link btn-sm" @click="goRootcause">
          演示：ads_gmv_board 对账失败 → 进根因台 →
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lt-ver {
  font-size: 12px;
  align-self: center;
}
.lt-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}
.kpi-trend.warn {
  color: var(--warning);
}
.kpi-trend.danger {
  color: var(--danger);
}

.lt-filter-card {
  margin-bottom: 16px;
}

.lt-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 14px;
}
.lt-link-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.lt-pill {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--bg-1);
  color: var(--text-2);
  border-radius: 6px;
  padding: 5px 11px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 16px;
}
.lt-pill:hover {
  border-color: var(--primary);
  color: var(--text-1);
}
.lt-pill.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
  font-weight: 600;
}
.lt-unsamp {
  opacity: 0.5;
}
.lt-search {
  flex: 1;
  min-width: 200px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.lt-search input {
  flex: 1;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-1);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
}
.lt-search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}
.lt-hint {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}

.lt-main {
  margin-bottom: 0;
}
.lt-empty {
  color: var(--text-3);
  font-size: 13px;
  padding: 8px 0;
}

.span-waterfall {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-1);
  padding: 14px 16px 18px;
}
.span-wf-ruler {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-3);
  padding: 0 4px 6px;
  border-bottom: 1px dashed var(--border);
  margin-bottom: 8px;
}
.span-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
}
.sr-label {
  width: 188px;
  flex-shrink: 0;
  font-size: 12px;
}
.sr-svc {
  font-weight: 600;
  color: var(--text-1);
}
.sr-op {
  color: var(--text-3);
  font-size: 11px;
}
.sr-track {
  flex: 1;
  position: relative;
  height: 22px;
  background: var(--bg-2);
  border-radius: 4px;
}
.sr-bar {
  position: absolute;
  top: 3px;
  height: 16px;
  border-radius: 3px;
  min-width: 3px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 6px;
  font-size: 10px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  transition: filter 0.15s;
}
.sr-bar:hover {
  filter: brightness(1.08);
}
.sr-bar.ok {
  background: linear-gradient(90deg, #36cfcb, #5cdbd3);
}
.sr-bar.warn {
  background: linear-gradient(90deg, #ffa940, #ffc53d);
}
.sr-bar.error {
  background: linear-gradient(90deg, #f5222d, #ff7875);
}
.sr-bar.ghost {
  background: repeating-linear-gradient(45deg, #bfbfbf, #bfbfbf 4px, #d9d9d9 4px, #d9d9d9 8px);
  color: var(--text-2);
}

.span-wf-legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--text-3);
  margin-top: 10px;
  align-items: center;
}
.lg-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 5px;
  vertical-align: middle;
}
.lg-dot.ok {
  background: #5cdbd3;
}
.lg-dot.warn {
  background: #ffc53d;
}
.lg-dot.error {
  background: #ff7875;
}
.lg-dot.ghost {
  background: repeating-linear-gradient(45deg, #bfbfbf, #bfbfbf 3px, #d9d9d9 3px, #d9d9d9 6px);
}
.lg-axis {
  margin-left: auto;
}

.span-fail {
  border: 1px solid var(--danger);
  background: var(--danger-light);
  border-radius: 8px;
  padding: 12px 14px;
}
.span-fail.soft {
  border-color: var(--border);
  background: var(--bg-1);
}
.sf-title {
  font-weight: 600;
  color: var(--danger);
  margin-bottom: 6px;
}
.span-fail.soft .sf-title {
  color: var(--text-1);
}
.sf-body {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.7;
}
.sf-body code {
  background: var(--bg-2);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
}
.sf-err {
  color: var(--danger);
}
.sf-rca {
  margin-top: 10px;
}

.lt-log-card {
  margin-top: 16px;
}
.lt-log-body {
  padding: 0;
}
.lt-log-row {
  cursor: pointer;
}
.lt-log-row:hover {
  background: var(--bg-2);
}
.nowrap {
  white-space: nowrap;
}
.span-id {
  font-size: 11px;
}
.evt-cell {
  font-size: 11px;
}
.msg-cell {
  color: var(--text-2);
}
.lt-empty-cell {
  color: var(--text-3);
  padding: 14px;
}

.lt-callout {
  margin-top: 16px;
  border-left: 3px solid var(--primary);
  background: var(--primary-light);
  border-radius: 8px;
  padding: 12px 14px;
}
.lt-callout-title {
  font-weight: 600;
  color: var(--primary-dark);
  margin-bottom: 4px;
}
.lt-callout-body {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.7;
}
</style>
