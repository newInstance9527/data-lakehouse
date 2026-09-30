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
import { useSession } from '@/composables/useSession'
import { pageMyTickets } from '@/api/apply'
import '@/styles/metrics-page.css'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { currentWs } = useSession()
const guide = pageGuideOf('metrics')

const { catalog, liveKpis, loading, lastError, loadAll } = useMetrics()
const publishTickets = ref({})

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
  await loadAll({ ws: currentWs.value || 'default', scope: 'workspace' })
  await refreshPublishTickets()
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

    <p class="tip met-banner">
      原子指标绑定<strong>湖表</strong>（Iceberg/Hive），试跑/查询经 <strong>Trino</strong> 执行。请先入湖并在资产目录登记湖表后再建指标。
    </p>
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
          暂无待发布项。在「指标定义」保存草稿后，于目录中点「申请发布」。
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
