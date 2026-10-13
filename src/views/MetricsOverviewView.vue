<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { useMetrics } from '@/composables/useMetrics'
import { usePager } from '@/composables/usePager'
import { pageGuideOf } from '@/data/pageGuides'
import { METRIC_LIFECYCLE_STAGES } from '@/data/metrics'
import {
  METRIC_LAKE_LANDING_HINT,
  METRIC_LAKE_PREP_LINKS,
  ensureMetricBindTables,
  metricBindTableOptions,
  metricBindRev,
} from '@/data/metricBindAssets'
import { useSession } from '@/composables/useSession'
import { pageMyTickets } from '@/api/apply'
import { fetchDatasourcePage } from '@/api/datasource'
import { fetchEtlDags } from '@/api/etl'
import { queryMetricBoard } from '@/api/metric'
import { ensureGlossaryTerm, ensureGlossaryTermsBatch } from '@/api/ai'
import MetricDimFilterBar from '@/components/metrics/MetricDimFilterBar.vue'
import '@/styles/metrics-page.css'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { currentWs } = useSession()
const guide = pageGuideOf('metrics')

const { catalog, liveKpis, overview, loading, lastError, loadAll } = useMetrics()
const ensuringCode = ref('')
const batchEnsuring = ref(false)
const publishTickets = ref({})
const prepOpen = ref(true)
const prep = ref({
  dsOk: false,
  etlOk: false,
  lakeOk: false,
  loading: false,
})

const prepSteps = computed(() => {
  void metricBindRev.value
  const lakeN = metricBindTableOptions().length
  return [
    {
      id: 'ds',
      label: '登记入湖数据源',
      ok: prep.value.dsOk,
      to: '/datasource',
      tip: '用途选「数据入湖」，并同步表清单',
    },
    {
      id: 'etl',
      label: '配置 Iceberg 入湖作业',
      ok: prep.value.etlOk,
      to: '/integration',
      tip: 'sink_iceberg → iceberg.<schema>.<table>',
    },
    {
      id: 'lake',
      label: '资产目录有可绑湖表',
      ok: prep.value.lakeOk || lakeN > 0,
      to: '/catalog',
      tip: lakeN ? `当前可绑 ${lakeN} 张` : '登记 Iceberg/Hive 湖表',
    },
    {
      id: 'metric',
      label: '新建原子指标',
      ok: catalog.value.some((r) => r.type === '原子' || r.kind === '原子'),
      to: '/metrics/catalog?create=1',
      tip: '绑定湖表字段并保存草稿',
    },
  ]
})

const prepReady = computed(() => prepSteps.value.every((s) => s.ok))

async function refreshPrep() {
  prep.value.loading = true
  const ws = currentWs.value || 'default'
  try {
    const [dsPage, etlPage] = await Promise.all([
      fetchDatasourcePage({ ws }, { current: 1, size: 50 }).catch(() => null),
      fetchEtlDags({ ws }, { current: 1, size: 50 }).catch(() => null),
    ])
    const dsRows = dsPage?.records || dsPage?.rows || []
    prep.value.dsOk = dsRows.length > 0
    const etlRows = etlPage?.records || etlPage?.rows || []
    prep.value.etlOk = etlRows.some((d) => {
      const nodes = d.nodes || d.nodeList || []
      if (Array.isArray(nodes) && nodes.some((n) => String(n.nodeType || n.type || '').includes('iceberg'))) {
        return true
      }
      // 弱探测：有已发布/生产任务也算一步
      return ['prod', 'published', 'online'].includes(String(d.status || '').toLowerCase())
    }) || etlRows.length > 0
    await ensureMetricBindTables({ force: true }).catch(() => {})
    prep.value.lakeOk = metricBindTableOptions().length > 0
  } finally {
    prep.value.loading = false
  }
}

const pendingPublish = computed(() =>
  catalog.value.filter((r) => {
    if (r.status === 'review' || r.status === 'version_review') return true
    const hit = publishTickets.value[r.id]
    return r.status === 'draft' && hit?.status === 'rejected'
  }),
)

const {
  page: pendingPage,
  pageSize: pendingPageSize,
  total: pendingTotal,
  totalPages: pendingTotalPages,
  paged: pendingPaged,
  pageNums: pendingPageNums,
  goPage: goPendingPage,
} = usePager(pendingPublish)

async function refreshPublishTickets() {
  try {
    const page = await pageMyTickets({
      current: 1,
      size: 100,
      ticketType: 'metric',
      ws: currentWs.value || 'default',
    })
    const rows = page?.records || page?.rows || []
    const map = {}
    for (const t of rows) {
      let payload = t.payload
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          payload = {}
        }
      }
      const code = payload?.metricCode
      const kind = payload?.metricKind
      if (!code || kind === 'query') continue
      const prev = map[code]
      if (!prev || String(t.createTime || '') >= String(prev.createTime || '')) {
        map[code] = {
          ticketNo: t.ticketNo,
          status: t.status,
          remark: t.remark || '',
          createTime: t.createTime,
          metricKind: kind,
        }
      }
    }
    publishTickets.value = map
  } catch {
    /* ignore */
  }
}

async function reload() {
  await Promise.all([
    loadAll({ ws: currentWs.value || 'default', scope: 'workspace' }),
    refreshPrep(),
    refreshPublishTickets(),
  ])
}

onMounted(async () => {
  const q = typeof route.query.q === 'string' ? route.query.q.trim() : ''
  if (q) {
    router.replace({ path: '/metrics/catalog', query: { q } })
    return
  }
  try {
    await reload()
  } catch (e) {
    showToast(e?.message || '加载指标失败', 'error')
  }
})

watch(currentWs, () => {
  reload().catch(() => {})
})

function goCatalog(query = {}) {
  router.push({ path: '/metrics/catalog', query })
}

function goCreate(id) {
  router.push({
    path: '/metrics/catalog',
    query: id ? { edit: id } : { create: '1' },
  })
}

const uncoveredCodes = computed(() => {
  const list = overview.value?.uncoveredMetricCodes
  return Array.isArray(list) ? list : []
})

const termCoverageBelowWarn = computed(() => {
  if (overview.value?.termCoverageBelowWarn === true) return true
  const cov = overview.value?.metricTermCoveragePct
  if (cov == null) return false
  const warn = Number(overview.value?.termCoverageWarnPct ?? 80)
  return Number(cov) < warn
})

function goEnsureTermManual(code) {
  router.push({
    path: '/knowledge',
    query: { create: '1', cat: '业务术语', metricCode: code },
  })
}

async function onEnsureTerm(code) {
  if (!code || ensuringCode.value) return
  ensuringCode.value = code
  try {
    const r = await ensureGlossaryTerm(code)
    showToast(
      r?.created ? `已创建术语：${r.title || code}` : `术语已存在：${r?.title || code}`,
      'success',
    )
    await loadAll({ ws: currentWs.value || 'default', scope: 'workspace' })
  } catch (e) {
    showToast(e?.message || '补术语失败', 'error')
  } finally {
    ensuringCode.value = ''
  }
}

async function onEnsureTermsBatch() {
  if (batchEnsuring.value) return
  batchEnsuring.value = true
  try {
    const r = await ensureGlossaryTermsBatch()
    const created = r?.created ?? 0
    const existed = r?.existed ?? 0
    const failed = r?.failed ?? 0
    showToast(
      `批量补术语：新建 ${created} · 已有 ${existed}${failed ? ` · 失败 ${failed}` : ''}`,
      failed ? 'warning' : 'success',
    )
    await loadAll({ ws: currentWs.value || 'default', scope: 'workspace' })
  } catch (e) {
    showToast(e?.message || '批量补术语失败', 'error')
  } finally {
    batchEnsuring.value = false
  }
}

function pendingStatusLabel(row) {
  const hit = publishTickets.value[row.id]
  if (!hit) return row.statusLabel
  if (hit.status === 'pending') return '待审·待发布'
  if (hit.status === 'rejected') return '已驳回·待重改'
  return row.statusLabel
}

function goApplyTicket(row) {
  const hit = publishTickets.value[row.id]
  router.push({
    path: '/apply',
    query: hit?.ticketNo ? { tab: 'metric', ticket: hit.ticketNo } : { tab: 'metric' },
  })
}

const boardFilters = ref({ dims: {} })

function goBiWithDims(metricCode) {
  const dims = boardFilters.value?.dims || {}
  const code =
    metricCode ||
    (boardCards.value || []).find((c) => c.ready && c.metricCode)?.metricCode ||
    (boardCards.value || [])[0]?.metricCode ||
    ''
  if (!code && !(dims && typeof dims === 'object' && Object.keys(dims).length)) {
    router.push({ path: '/bi' })
    return
  }
  const q = { openDataset: '1' }
  if (code) q.metricCode = code
  if (dims && typeof dims === 'object' && Object.keys(dims).length) {
    q.dims = JSON.stringify(dims)
  }
  router.push({ path: '/bi/studio', query: q })
}
const boardPrefer = ref('trino')
const boardBusy = ref(false)
const boardCards = ref([])
const boardMeta = ref({ readyCount: 0, blockedCount: 0, okCount: 0, queriedCount: 0 })

async function refreshBoardValues() {
  boardBusy.value = true
  try {
    const res = await queryMetricBoard({
      ws: currentWs.value || 'default',
      prefer: boardPrefer.value || 'trino',
      filters: boardFilters.value || { dims: {} },
      maxRows: 20,
    })
    boardCards.value = Array.isArray(res?.cards) ? res.cards : []
    boardMeta.value = {
      readyCount: res?.readyCount ?? 0,
      blockedCount: res?.blockedCount ?? 0,
      okCount: res?.okCount ?? 0,
      queriedCount: res?.queriedCount ?? 0,
    }
  } catch (e) {
    boardCards.value = []
    showToast(e?.message || '看板查询失败', 'warning')
  } finally {
    boardBusy.value = false
  }
}

function formatBoardValue(v) {
  if (v == null || v === '') return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4)
  return String(v)
}
</script>

<template>
  <div class="met-page">
    <PageHeader
      page-id="metrics"
      title="指标概览"
      subtitle="KPI · 生命周期 · 待发布入口"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" :disabled="loading" @click="reload">↻ 刷新</button>
      <button type="button" class="btn btn-sm" @click="goCatalog()">指标目录</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goCreate()">＋ 新建指标</button>
    </PageHeader>

    <div class="met-banner-cta">
      <span>
        原子指标绑定<strong>湖表</strong>（Iceberg/Hive），试跑/查询经 <strong>Trino</strong> 执行。
        {{ METRIC_LAKE_LANDING_HINT }}
        源端 MySQL 等不可直连；请先入湖并登记湖表后再建指标。
      </span>
      <span class="met-cta-links">
        <router-link v-for="l in METRIC_LAKE_PREP_LINKS" :key="l.to" :to="l.to">{{ l.label }}</router-link>
      </span>
    </div>

    <div class="card met-flow" style="margin-bottom: 16px">
      <div class="card-header">
        <div class="card-title">
          入湖建指标准备
          <span class="tip">· {{ prepReady ? '已就绪，可新建原子指标' : '按步骤完成前置' }}</span>
        </div>
        <button type="button" class="btn btn-sm" style="margin-left: auto" @click="prepOpen = !prepOpen">
          {{ prepOpen ? '收起' : '展开' }}
        </button>
        <button type="button" class="btn btn-sm" :disabled="prep.loading" @click="refreshPrep">
          {{ prep.loading ? '检测中…' : '重新检测' }}
        </button>
      </div>
      <div v-if="prepOpen" class="card-body">
        <div class="met-stages" style="flex-direction: column; align-items: stretch; gap: 10px">
          <div
            v-for="(s, i) in prepSteps"
            :key="s.id"
            style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px"
          >
            <span class="met-stage-idx" :style="s.ok ? { background: 'var(--success-light)', color: 'var(--success)' } : undefined">
              {{ s.ok ? '✓' : i + 1 }}
            </span>
            <strong>{{ s.label }}</strong>
            <span class="tip">{{ s.tip }}</span>
            <router-link class="btn-link" style="margin-left: auto" :to="s.to">去完成 →</router-link>
          </div>
        </div>
        <div v-if="prepReady" style="margin-top: 12px">
          <button type="button" class="btn btn-sm btn-primary" @click="goCreate()">＋ 新建原子指标</button>
        </div>
      </div>
    </div>

    <p v-if="lastError && !catalog.length" class="met-banner warn">
      加载失败：{{ lastError.message || lastError }}
    </p>
    <p v-else-if="loading && !catalog.length" class="met-banner">正在加载指标目录…</p>

    <div class="kpi-grid met-kpi">
      <div v-for="(k, i) in liveKpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div v-if="k.trend" class="kpi-trend" :class="k.trendUp ? 'up' : 'down'">{{ k.trend }}</div>
      </div>
    </div>

    <p
      v-if="termCoverageBelowWarn"
      class="met-banner warn"
      style="margin-bottom: 12px"
    >
      指标术语覆盖 {{ overview?.metricTermCoveragePct ?? '—' }}% 低于预警线
      {{ overview?.termCoverageWarnPct ?? 80 }}%（闸门 {{ overview?.termGateMode || 'soft' }}）。
      建议批量补术语或前往知识库维护。
    </p>

    <div v-if="uncoveredCodes.length" class="card" style="margin-bottom: 16px">
      <div class="card-header">
        <div class="card-title">
          未挂业务术语的已启用指标
          <span class="tip">· 闸门 {{ overview?.termGateMode || 'soft' }} · 最多列 50</span>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="batchEnsuring"
          @click="onEnsureTermsBatch"
        >
          {{ batchEnsuring ? '批量补齐中…' : '批量补术语' }}
        </button>
        <button type="button" class="btn btn-sm" @click="router.push('/knowledge?view=glossary')">
          术语图谱
        </button>
      </div>
      <div class="card-body">
        <div
          v-for="code in uncoveredCodes"
          :key="code"
          style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border)"
        >
          <button type="button" class="btn-link" @click="goCatalog({ q: code })">{{ code }}</button>
          <span style="flex: 1" />
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="ensuringCode === code || batchEnsuring"
            @click="onEnsureTerm(code)"
          >
            {{ ensuringCode === code ? '补齐中…' : '一键补术语' }}
          </button>
          <button type="button" class="btn btn-sm" @click="goEnsureTermManual(code)">手动填写</button>
        </div>
      </div>
    </div>

    <div class="card met-flow" style="margin-bottom: 16px">
      <div class="card-header">
        <div class="card-title">
          就绪指标
          <span class="tip">
            · filters.dims ≡ params.dims · 就绪 {{ boardMeta.readyCount }} · 阻断
            {{ boardMeta.blockedCount }}
            <template v-if="boardMeta.queriedCount">
              · 已查 {{ boardMeta.okCount }}/{{ boardMeta.queriedCount }}
            </template>
          </span>
        </div>
        <label class="tip" style="margin-left: auto; display: flex; align-items: center; gap: 6px">
          路由
          <select v-model="boardPrefer" class="input input-sm">
            <option value="trino">trino</option>
            <option value="hot">hot</option>
          </select>
        </label>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="boardBusy"
          @click="refreshBoardValues"
        >
          {{ boardBusy ? '查询中…' : '按维刷新数值' }}
        </button>
      </div>
      <div class="card-body">
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start">
          <div style="flex: 1; min-width: 240px">
            <MetricDimFilterBar v-model="boardFilters" :ws="currentWs || 'default'" />
          </div>
          <button type="button" class="btn btn-sm" title="携带当前维筛选打开 BI" @click="goBiWithDims">
            在 BI 打开
          </button>
        </div>
        <p class="tip" style="margin: 0 0 10px">
          仅对账就绪（ready）的已启用指标会执行查询；未选成员 = 不切片（全量）。
        </p>
        <div v-if="!boardCards.length" class="tip">
          点击「按维刷新数值」加载看板卡片。无就绪卡时请先物化并对账（见可靠性中心）。
        </div>
        <div v-else class="kpi-grid met-kpi" style="margin: 0">
          <div
            v-for="c in boardCards"
            :key="c.metricCode"
            class="kpi-card"
            :class="c.ready ? 'blue' : 'orange'"
          >
            <div class="kpi-label">
              <button type="button" class="btn-link" @click="goCatalog({ q: c.metricCode })">
                {{ c.metricCode }}
              </button>
              · {{ c.name || '' }}
            </div>
            <div class="kpi-value">
              {{ c.ready ? formatBoardValue(c.value) : '—' }}
            </div>
            <div class="kpi-trend" :class="c.ready && c.executed ? 'up' : 'warn'">
              <template v-if="!c.ready">{{ c.statusLabel || '未就绪' }} · {{ c.reason || '' }}</template>
              <template v-else-if="c.blocked">阻断 · {{ c.message || '' }}</template>
              <template v-else-if="c.executed">
                {{ c.rowCount ?? 0 }} 行 · {{ c.durMs ?? '—' }} ms
              </template>
              <template v-else>{{ c.message || c.statusLabel || '未执行' }}</template>
            </div>
            <button
              v-if="c.ready"
              type="button"
              class="btn btn-sm"
              style="margin-top: 8px"
              title="携带当前维筛选打开 BI"
              @click="goBiWithDims(c.metricCode)"
            >
              在 BI 打开
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card met-flow">
      <div class="card-header">
        <div class="card-title">
          生命周期
          <span class="tip">· 草稿 → 待发布 → 已启用 → 变更 → 废弃</span>
        </div>
      </div>
      <div class="card-body met-stages">
        <div v-for="(s, i) in METRIC_LIFECYCLE_STAGES" :key="s.id" class="met-stage">
          <span class="met-stage-idx">{{ i + 1 }}</span>
          <span>{{ s.label }}</span>
          <span v-if="i < METRIC_LIFECYCLE_STAGES.length - 1" class="met-stage-arrow">→</span>
        </div>
      </div>
    </div>

    <div class="card met-pending">
      <div class="card-header">
        <div class="card-title">
          待发布
          <span class="tip">· {{ pendingTotal }} 项</span>
        </div>
        <button type="button" class="btn btn-sm" style="margin-left: auto" @click="goCatalog({ status: 'review' })">
          全部 →
        </button>
      </div>
      <div class="card-body" style="padding: 0">
        <table v-if="pendingPaged.length" class="table met-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>指标名</th>
              <th>状态</th>
              <th>发布单</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pendingPaged" :key="'p-' + row.id" class="met-row warn">
              <td class="met-id">
                <button type="button" class="btn-link" @click="goCatalog({ q: row.id })">{{ row.id }}</button>
              </td>
              <td class="met-name">{{ row.name }}</td>
              <td><span class="tag" :class="row.statusCls">{{ pendingStatusLabel(row) }}</span></td>
              <td><code>{{ publishTickets[row.id]?.ticketNo || '—' }}</code></td>
              <td class="met-acts">
                <button
                  v-if="row.status === 'review' || row.status === 'draft'"
                  type="button"
                  class="btn-link"
                  @click="goCreate(row.id)"
                >
                  编辑
                </button>
                <button
                  v-if="publishTickets[row.id]"
                  type="button"
                  class="btn-link"
                  @click="goApplyTicket(row)"
                >
                  查看工单
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="met-pending-empty tip">
          暂无待发布项。在「指标目录」保存草稿后，于目录中点「申请发布」。
        </p>
        <ListPager
          v-model:page="pendingPage"
          v-model:page-size="pendingPageSize"
          :total="pendingTotal"
          :total-pages="pendingTotalPages"
          :page-nums="pendingPageNums"
          :page-count="pendingPaged.length"
          @go="goPendingPage"
        />
      </div>
    </div>
  </div>
</template>
