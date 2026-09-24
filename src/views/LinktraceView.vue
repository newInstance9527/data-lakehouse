<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useWsListScope } from '@/composables/useWsListScope'
import { pageGuideOf } from '@/data/pageGuides'
import { LT_LINKS, spanStatusTag, spanBarClass } from '@/data/linktrace'
import {
  fetchObsLinksOverview,
  fetchObsSpans,
  fetchObsTrace,
  fetchObsSpanError,
} from '@/api/observability'

const router = useRouter()
const { showToast } = useToast()
const { currentWs, showAll, listWsParams, watchListScope } = useWsListScope()
const guide = pageGuideOf('linktrace')

const activeLink = ref('A')
const searchInput = ref('')
const loading = ref(false)
const overview = ref(null)
const spans = ref([])
const drill = ref(null)
const waterfall = ref([])

const kpis = computed(() => {
  const o = overview.value || {}
  const dash = (v) => (v == null ? '—' : String(v))
  return [
    { icon: '🧵', color: 'blue', value: dash(o.todaySpans), unit: '', label: '今日 span', trend: o.source || '—' },
    { icon: '🐢', color: 'orange', value: dash(o.slowSpans), unit: '', label: '慢 span', trend: '≥3s' },
    { icon: '🚨', color: 'red', value: dash(o.failedSpans), unit: '', label: '失败 span', trend: 'status=error' },
    {
      icon: '📡',
      color: 'green',
      value: o.sampleCoverage == null ? '—' : `${o.sampleCoverage}%`,
      unit: '',
      label: '采样覆盖',
      trend: o.todaySpans ? '有采样' : '暂无',
    },
  ]
})

const activeLinkMeta = computed(() => LT_LINKS.find((l) => l.id === activeLink.value))

async function loadOverview() {
  overview.value = (await fetchObsLinksOverview(listWsParams())) || {}
}

async function loadSpans() {
  const page = await fetchObsSpans({
    ...listWsParams(),
    linkId: activeLink.value,
    current: 1,
    size: 50,
  })
  spans.value = Array.isArray(page?.records) ? page.records : []
  waterfall.value = spans.value
  drill.value = null
}

async function loadBoard() {
  loading.value = true
  try {
    await loadOverview()
    await loadSpans()
  } catch (e) {
    showToast(e?.message || '观测 API 加载失败', 'warning')
    overview.value = null
    spans.value = []
    waterfall.value = []
  } finally {
    loading.value = false
  }
}

function exportSpans() {
  if (!spans.value.length) {
    showToast('暂无 span 可导出', 'info')
    return
  }
  const lines = ['spanId,traceId,service,op,status,durationMs']
  for (const s of spans.value) {
    lines.push([s.spanId, s.traceId, s.service, s.op, s.status, s.durationMs].join(','))
  }
  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `spans-${activeLink.value}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
  showToast(`已导出 ${spans.value.length} 条 span`, 'success')
}

function goRootcause() {
  router.push('/rootcause')
}

async function selectLink(id) {
  activeLink.value = id
  loading.value = true
  try {
    await loadSpans()
  } catch (e) {
    showToast(e?.message || '加载 span 失败', 'warning')
  } finally {
    loading.value = false
  }
}

async function doSearch() {
  const raw = searchInput.value.trim()
  if (!raw) {
    showToast('请输入 trace_id / run_id', 'info')
    return
  }
  loading.value = true
  try {
    if (/^[0-9a-fA-F-]{8,}$/.test(raw) || raw.length >= 16) {
      const tr = await fetchObsTrace(raw, listWsParams())
      const list = Array.isArray(tr?.spans) ? tr.spans : []
      if (list.length) {
        waterfall.value = list
        spans.value = list
        showToast(`trace ${raw} · ${list.length} spans`, 'success')
        return
      }
    }
    const page = await fetchObsSpans({
      ...listWsParams(),
      runId: raw,
      current: 1,
      size: 50,
    })
    const list = Array.isArray(page?.records) ? page.records : []
    waterfall.value = list
    spans.value = list
    showToast(list.length ? `命中 ${list.length} spans` : '无匹配 span', list.length ? 'success' : 'info')
  } catch (e) {
    showToast(e?.message || '检索失败', 'warning')
  } finally {
    loading.value = false
  }
}

function doReset() {
  searchInput.value = ''
  loadSpans()
}

async function openDrill(span) {
  if (!span?.spanId && !span?.id) return
  try {
    drill.value = await fetchObsSpanError(span.spanId || span.id, listWsParams())
  } catch (e) {
    showToast(e?.message || '下钻失败', 'warning')
  }
}

function barWidth(ms) {
  const n = Number(ms) || 0
  return `${Math.min(100, Math.max(4, n / 30))}%`
}

watch(activeLink, () => {
  /* selectLink already reloads */
})

onMounted(loadBoard)
watchListScope(() => loadBoard())
</script>

<template>
  <div class="lt-page">
    <PageHeader
      title="链路调用监控 · §29"
      subtitle="按 A–L 链路采跨组件 span · K=合规删除 · L=作业发布"
      :guide="guide"
    >
      <label class="ws-mine-chk" title="默认跟随顶栏当前空间；勾选后查看全部归属">
        <input v-model="showAll" type="checkbox" />
        查看全部
      </label>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="loadBoard">
        {{ loading ? '刷新中…' : '↻ 刷新' }}
      </button>
      <button type="button" class="btn btn-sm" @click="exportSpans">📄 导出 span</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goRootcause">🔍 进根因台</button>
    </PageHeader>

    <p class="tip lt-banner">无演示瀑布；空表合法。有 `gov_obs_span` 行时展示真实采样。</p>

    <div class="kpi-grid lt-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend">{{ k.trend }}</div>
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
            </button>
          </div>
          <div class="lt-search">
            <input
              v-model="searchInput"
              type="text"
              placeholder="按 trace_id / run_id / event_id 检索…"
              @keyup.enter="doSearch"
            />
            <button type="button" class="btn btn-sm btn-primary" @click="doSearch">检索</button>
            <button type="button" class="btn btn-sm" @click="doReset">重置</button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 lt-main">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            📊 span 瀑布 · {{ activeLink }} · {{ activeLinkMeta?.name || '' }}
          </div>
        </div>
        <div class="card-body">
          <div v-if="!waterfall.length" class="lt-empty">暂无 span（观测 API 未采样或该链路无数据）</div>
          <div v-else class="lt-waterfall">
            <button
              v-for="s in waterfall"
              :key="s.id || s.spanId"
              type="button"
              class="lt-span-row"
              @click="openDrill(s)"
            >
              <span class="lt-span-meta">
                <code>{{ s.service || 'svc' }}</code>
                · {{ s.op || '—' }}
                <span class="tag" :class="spanStatusTag(s.status).tag" style="font-size: 10px; margin-left: 6px">
                  {{ spanStatusTag(s.status).label }}
                </span>
              </span>
              <span class="lt-bar-track">
                <span
                  class="lt-bar"
                  :class="spanBarClass(s.status)"
                  :style="{ width: barWidth(s.durationMs) }"
                />
              </span>
              <span class="lt-dur">{{ s.durationMs != null ? `${s.durationMs}ms` : '—' }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🧯 失败 / 慢 span 下钻</div>
        </div>
        <div class="card-body">
          <div v-if="!drill?.found" class="lt-empty">点击左侧 span 下钻；或暂无错误详情</div>
          <div v-else class="lt-drill">
            <div class="tip">error：{{ drill.error || '—' }}</div>
            <div class="tip" style="margin-top: 8px">邻居 span {{ (drill.neighbors || []).length }}</div>
            <ul>
              <li v-for="n in drill.neighbors || []" :key="n.id || n.spanId">
                {{ n.service }} · {{ n.op }} · {{ n.status }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lt-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1000px) {
  .lt-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}
.tip {
  font-size: 12px;
  color: var(--text-3);
}
.lt-banner {
  margin: -4px 0 12px;
}
.lt-page .card {
  margin-top: 16px;
}
.lt-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lt-link-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.lt-pill {
  border: 1px solid var(--border);
  background: var(--bg-2);
  border-radius: 16px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.lt-pill.active {
  border-color: var(--primary);
  color: var(--primary);
  font-weight: 600;
}
.lt-search {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.lt-search input {
  flex: 1;
  min-width: 200px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.lt-empty {
  text-align: center;
  color: var(--text-3);
  padding: 28px 12px;
}
.lt-waterfall {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lt-span-row {
  display: grid;
  grid-template-columns: 1fr 120px 56px;
  gap: 8px;
  align-items: center;
  width: 100%;
  text-align: left;
  border: 1px solid var(--border);
  background: var(--bg-2);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}
.lt-span-meta {
  font-size: 12px;
}
.lt-bar-track {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.lt-bar {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: var(--success);
}
.lt-bar.warn {
  background: var(--warning);
}
.lt-bar.error {
  background: var(--danger);
}
.lt-bar.ghost {
  background: var(--text-3);
}
.lt-dur {
  font-size: 11px;
  color: var(--text-3);
  text-align: right;
}
.lt-drill ul {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--text-2);
}
</style>
