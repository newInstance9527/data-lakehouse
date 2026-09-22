<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useMetrics } from '@/composables/useMetrics'
import { enrichMetricBindPayload, warmMetricBindAssets } from '@/data/metricBindAssets'
import { METRIC_CREATE_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  METRIC_DOMAIN_TABS,
  METRIC_LIFECYCLE_STAGES,
  METRIC_STATUS_TABS,
  formatMetricCalcDisplay,
  metricActions,
  metricToFormPayload,
} from '@/data/metrics'
import { createApplyTicket, pageMyTickets } from '@/api/apply'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('metrics')

const {
  catalog,
  liveKpis,
  loading,
  lastError,
  loadAll,
  reloadDetail,
  addMetric,
  saveMetric,
  runTransition,
  runTrial,
} = useMetrics()

const domainTab = ref('all')
const typeTab = ref('all')
const statusTab = ref('all')
const createOpen = ref(false)
const editOpen = ref(false)
const detailOpen = ref(false)
const editingId = ref('')
const activeId = ref('')
const saving = ref(false)
const trialBusy = ref(false)
const trialResult = ref(null)
const trialDt = ref('')
/** metricCode → 最近发布单 { ticketNo, status, remark } */
const publishTickets = ref({})

const TYPE_TABS = [
  { id: 'all', label: '全部类型' },
  { id: '原子', label: '原子' },
  { id: '衍生', label: '衍生' },
  { id: '复合', label: '复合' },
]

/** 待发布：review / version_review；含驳回后退回草稿待重改 */
const pendingPublish = computed(() =>
  catalog.value.filter((r) => {
    if (r.status === 'review' || r.status === 'version_review') return true
    const hit = publishTickets.value[r.id]
    return r.status === 'draft' && hit?.status === 'rejected'
  }),
)

const filteredCatalog = computed(() => {
  let rows = catalog.value
  if (domainTab.value !== 'all') rows = rows.filter((r) => r.domain === domainTab.value)
  if (typeTab.value !== 'all') rows = rows.filter((r) => r.type === typeTab.value)
  if (statusTab.value !== 'all') rows = rows.filter((r) => r.status === statusTab.value)
  return rows
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredCatalog)

watch([domainTab, typeTab, statusTab], () => resetPage())

watch(
  () => route.query.q,
  (q) => {
    const id = typeof q === 'string' ? q.trim() : ''
    if (!id) return
    const hit = catalog.value.find((r) => r.id === id || r.name?.includes(id))
    if (hit) openDetail(hit.id)
  },
  { immediate: true },
)

const active = computed(() => catalog.value.find((r) => r.id === activeId.value) || null)
const editing = computed(() => catalog.value.find((r) => r.id === editingId.value) || null)

const editForm = computed(() => ({
  ...METRIC_CREATE_FORM,
  title: editing.value ? `✎ 编辑指标 · ${editing.value.id}` : '✎ 编辑指标',
  intro: '仅草稿/待发布可改口径；已启用请走「申请变更」进入待发布·变更',
  submitLabel: '保存修改',
}))

const editInitial = computed(() => (editing.value ? metricToFormPayload(editing.value) : null))

async function refreshPublishTickets() {
  try {
    const page = await pageMyTickets({ current: 1, size: 100, ticketType: 'metric' })
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
    /* 无工单不影响目录 */
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadAll(), warmMetricBindAssets().catch(() => {}), refreshPublishTickets()])
    const q = typeof route.query.q === 'string' ? route.query.q.trim() : ''
    if (q) {
      const hit = catalog.value.find((r) => r.id === q || r.name?.includes(q))
      if (hit) openDetail(hit.id)
    }
  } catch (e) {
    showToast(e?.message || '加载指标目录失败', 'error')
  }
})

function newMetric() {
  createOpen.value = true
  warmMetricBindAssets().catch(() => {})
}

async function onCreateMetric(payload) {
  saving.value = true
  try {
    const row = await addMetric(enrichMetricBindPayload(payload))
    resetPage()
    showToast(`✅ 已保存草稿 ${row.id} ${row.name} · 可「申请发布」`, 'success')
    createOpen.value = false
    openDetail(row.id)
  } catch (e) {
    showToast(e?.message || '保存失败', 'warning')
  } finally {
    saving.value = false
  }
}

async function openDetail(id) {
  activeId.value = id
  detailOpen.value = true
  trialResult.value = null
  try {
    await reloadDetail(id)
  } catch {
    /* 列表数据仍可用 */
  }
}

function closeDetail() {
  detailOpen.value = false
  trialResult.value = null
}

async function doTrial() {
  const row = active.value
  if (!row) return
  trialBusy.value = true
  trialResult.value = null
  try {
    const params = {}
    if (trialDt.value?.trim()) params.dt = trialDt.value.trim()
    const res = await runTrial(row.id, { params, maxRows: 200 })
    trialResult.value = res
    if (res?.executed) {
      showToast(`试跑完成 · ${res.rowCount ?? 0} 行 · ${res.durMs ?? 0}ms`, 'success')
    } else if (res?.blocked || res?.status === 'blocked') {
      showToast(res.message || res.statusLabel || '试跑被阻断', 'warning')
    } else {
      showToast(res?.message || '试跑未执行（检查 Trino）', 'warning')
    }
  } catch (e) {
    trialResult.value = { executed: false, message: e?.message || String(e), rows: [], columns: [] }
    showToast(e?.message || '试跑失败', 'warning')
  } finally {
    trialBusy.value = false
  }
}

function openEdit(row) {
  if (row.status !== 'draft' && row.status !== 'review') {
    showToast('仅草稿/待发布可直接编辑；已启用请使用「申请变更」', 'warning')
    return
  }
  editingId.value = row.id
  editOpen.value = true
  warmMetricBindAssets(row.table).catch(() => {})
}

async function onEditMetric(payload) {
  const row = editing.value
  if (!row) return
  saving.value = true
  try {
    await saveMetric(row.id, enrichMetricBindPayload(payload))
    editOpen.value = false
    showToast(`💾 已更新 ${row.id}`, 'success')
  } catch (e) {
    showToast(e?.message || '保存失败', 'warning')
  } finally {
    saving.value = false
  }
}

function goApplyMetric(row, kind = 'query') {
  const query = { type: 'metric', kind }
  if (row?.id && kind !== 'create') query.metricId = row.id
  router.push({ path: '/apply', query })
}

function goApplyTicket(row) {
  const hit = publishTickets.value[row.id]
  router.push({
    path: '/apply',
    query: hit?.ticketNo
      ? { tab: 'metric', ticket: hit.ticketNo }
      : { tab: 'metric' },
  })
}

function pendingStatusLabel(row) {
  const hit = publishTickets.value[row.id]
  if (!hit) return row.statusLabel
  if (hit.status === 'pending') return '待审·待发布'
  if (hit.status === 'rejected') return '已驳回·待重改'
  return row.statusLabel
}

function pendingRejectRemark(row) {
  const hit = publishTickets.value[row.id]
  if (hit?.status === 'rejected' && hit.remark) return hit.remark
  const last = [...(row.history || [])].reverse().find((h) => /驳回|退回/.test(h.note || h.label || ''))
  return last?.note || ''
}

/** 草稿 → 申请首次发布；已启用 → 申请口径变更发布 */
async function submitPublishApply(row, kind = 'create') {
  if (!row?.id) return
  saving.value = true
  try {
    let caliberDiff = ''
    if (kind === 'change') {
      const input = window.prompt('变更说明（新口径摘要）', row.caliber || '')
      if (input === null) return
      caliberDiff = input.trim() || row.caliber || ''
    }
    const t = await createApplyTicket({
      ticketType: 'metric',
      title:
        kind === 'change'
          ? `口径变更发布 · ${row.id} · ${row.name || ''}`
          : `指标发布 · ${row.id} · ${row.name || ''}`,
      reason:
        kind === 'change'
          ? caliberDiff || '口径变更发布审批'
          : `申请发布指标 ${row.id} ${row.name || ''}`,
      metricCode: row.id,
      metricKind: kind,
      caliberDiff: caliberDiff || undefined,
      expireLabel: '长期',
    })
    const ticketNo = t?.ticketNo || t?.data?.ticketNo || ''
    await Promise.all([loadAll(), refreshPublishTickets()])
    showToast(
      ticketNo
        ? `已申请发布 ${ticketNo}（待审核）。通过后将自动启用，驳回则按意见重改`
        : '已提交发布申请，待审核通过后自动启用',
      'success',
    )
    if (detailOpen.value) openDetail(row.id)
  } catch (e) {
    showToast(e?.message || '提交发布申请失败', 'warning')
  } finally {
    saving.value = false
  }
}

async function runAction(row, action) {
  if (action === 'detail') {
    openDetail(row.id)
    return
  }
  if (action === 'edit') {
    openEdit(row)
    return
  }
  if (action === 'applyQuery') {
    goApplyMetric(row, 'query')
    return
  }
  if (action === 'applyPublish') {
    await submitPublishApply(row, 'create')
    return
  }
  if (action === 'applyChange') {
    await submitPublishApply(row, 'change')
    return
  }
  if (action === 'goTicket') {
    goApplyTicket(row)
    return
  }
  if (action === 'deprecate') {
    if (!window.confirm(`确认废弃 ${row.id}？废弃后禁止新引用。`)) return
  }
  saving.value = true
  try {
    const next = await runTransition(row.id, action, '')
    const tips = {
      deprecate: `已废弃 ${row.id} · 禁止新引用`,
    }
    showToast(tips[action] || `状态已更新 ${row.id}${next?.ver ? ' · ' + next.ver : ''}`, action === 'deprecate' ? 'warning' : 'success')
    if (detailOpen.value) openDetail(row.id)
  } catch (e) {
    showToast(e?.message || '操作失败', 'warning')
  } finally {
    saving.value = false
  }
}

function actionLabel(a) {
  return (
    {
      detail: '详情',
      edit: '编辑',
      applyPublish: '申请发布',
      goTicket: '查看工单',
      applyQuery: '申请权限',
      applyChange: '申请变更',
      deprecate: '废弃',
    }[a] || a
  )
}

function actionClass(a) {
  if (a === 'deprecate') return 'danger'
  if (a === 'applyPublish' || a === 'applyChange') return 'ok'
  return ''
}

function volStyle(cls) {
  if (cls === 'up') return { color: 'var(--success)', fontWeight: 600 }
  if (cls === 'down') return { color: 'var(--danger)', fontWeight: 600 }
  return { color: 'var(--warning)', fontWeight: 600 }
}

function stageState(row, stageId) {
  const order = METRIC_LIFECYCLE_STAGES.map((s) => s.id)
  const cur = order.indexOf(row.status)
  const i = order.indexOf(stageId)
  if (row.status === 'deprecated') {
    if (stageId === 'deprecated') return 'current'
    if (['draft', 'review', 'active'].includes(stageId)) return 'done'
    return ''
  }
  if (i < cur) return 'done'
  if (i === cur) return 'current'
  return ''
}

async function refresh() {
  try {
    await Promise.all([loadAll(), refreshPublishTickets()])
    showToast('已刷新指标目录', 'success')
  } catch (e) {
    showToast(e?.message || '刷新失败', 'warning')
  }
}
</script>

<template>
  <div class="met-page">
    <PageHeader
      title="指标中心"
      subtitle="原子 / 衍生 / 复合 · 草稿→待发布→启用→变更→废弃 · 发布审批对齐申请中心"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" :disabled="loading || saving" @click="refresh">
        ↻ 刷新
      </button>
      <button type="button" class="btn btn-sm" @click="goApplyMetric(null, 'query')">
        🔑 申请权限
      </button>
      <button type="button" class="btn btn-sm btn-primary" :disabled="saving" @click="newMetric">
        ＋ 新建指标
      </button>
    </PageHeader>

    <p v-if="lastError && !catalog.length" class="met-banner warn">
      加载失败：{{ lastError.message || lastError }} · 请确认后端已迁移 V16 且已登录
    </p>
    <p v-else-if="loading && !catalog.length" class="met-banner">正在加载指标目录…</p>

    <CreateFormModal
      :open="createOpen"
      v-bind="METRIC_CREATE_FORM"
      @close="createOpen = false"
      @submit="onCreateMetric"
    />

    <CreateFormModal
      :open="editOpen"
      v-bind="editForm"
      :initial-values="editInitial"
      @close="editOpen = false"
      @submit="onEditMetric"
    />

    <div class="met-domain-tabs">
      <button
        v-for="t in METRIC_DOMAIN_TABS"
        :key="t.id"
        type="button"
        class="met-domain-tab"
        :class="{ active: domainTab === t.id }"
        @click="domainTab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

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
          <span class="tip">· 草稿 → 待发布（申请）→ 已启用 → 待发布·变更 → 已启用 · 已启用 → 已废弃</span>
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
          <span class="tip">· {{ pendingPublish.length }} 项 · 审核通过后自动启用</span>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table v-if="pendingPublish.length" class="table met-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>指标名</th>
              <th>状态</th>
              <th>发布单</th>
              <th>驳回意见</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pendingPublish" :key="'p-' + row.id" class="met-row warn">
              <td class="met-id">
                <button type="button" class="btn-link" @click="openDetail(row.id)">{{ row.id }}</button>
              </td>
              <td class="met-name">{{ row.name }}</td>
              <td>
                <span class="tag" :class="row.statusCls">{{ pendingStatusLabel(row) }}</span>
              </td>
              <td>
                <code>{{ publishTickets[row.id]?.ticketNo || '—' }}</code>
              </td>
              <td class="met-caliber">{{ pendingRejectRemark(row) || '—' }}</td>
              <td class="met-acts">
                <button
                  v-if="row.status === 'review' || row.status === 'draft'"
                  type="button"
                  class="btn-link"
                  :disabled="saving"
                  @click="openEdit(row)"
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
                <button
                  v-if="publishTickets[row.id]?.status === 'rejected' && row.status === 'draft'"
                  type="button"
                  class="btn-link ok"
                  :disabled="saving"
                  @click="submitPublishApply(row, 'create')"
                >
                  重新申请
                </button>
                <button
                  v-if="row.status === 'review' && !publishTickets[row.id]"
                  type="button"
                  class="btn-link ok"
                  :disabled="saving"
                  @click="submitPublishApply(row, 'create')"
                >
                  申请发布
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="met-pending-empty tip">
          暂无待发布项。新建/编辑保存为草稿后点「申请发布」；工单待审或驳回重改时会出现在此。
        </p>
      </div>
    </div>

    <div class="card met-catalog">
      <div class="card-header met-catalog-hd">
        <div class="card-title">📋 指标目录 <span class="tip">· 已废弃禁止新引用</span></div>
        <div class="met-filters">
          <div class="met-type-tabs">
            <button
              v-for="t in TYPE_TABS"
              :key="t.id"
              type="button"
              class="met-type-tab"
              :class="{ active: typeTab === t.id }"
              @click="typeTab = t.id"
            >
              {{ t.label }}
            </button>
          </div>
          <div class="met-type-tabs">
            <button
              v-for="t in METRIC_STATUS_TABS"
              :key="t.id"
              type="button"
              class="met-type-tab"
              :class="{ active: statusTab === t.id }"
              @click="statusTab = t.id"
            >
              {{ t.label }}
            </button>
          </div>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table met-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>指标名</th>
              <th>类型</th>
              <th>状态</th>
              <th>业务口径</th>
              <th>绑定 / 依赖</th>
              <th>最新值</th>
              <th>Owner</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in paged"
              :key="row.id"
              class="met-row"
              :class="{ warn: row.rowWarn, deprecated: row.status === 'deprecated' }"
            >
              <td class="met-id">
                <button type="button" class="btn-link" @click="openDetail(row.id)">{{ row.id }}</button>
              </td>
              <td class="met-name">{{ row.name }}</td>
              <td><span class="tag" :class="row.typeCls">{{ row.type }}</span></td>
              <td><span class="tag" :class="row.statusCls">{{ row.statusLabel }}</span></td>
              <td class="met-caliber">{{ row.caliber }}</td>
              <td><code>{{ row.bind }}</code></td>
              <td class="met-latest" :style="volStyle(row.volCls)">{{ row.latest }}</td>
              <td>{{ row.owner }}</td>
              <td><span class="tag tag-gray">{{ row.ver }}</span></td>
              <td class="met-acts" @click.stop>
                <button
                  v-for="a in metricActions(row.status)"
                  :key="a"
                  type="button"
                  class="btn-link"
                  :class="actionClass(a)"
                  :disabled="saving"
                  @click="runAction(row, a)"
                >
                  {{ actionLabel(a) }}
                </button>
              </td>
            </tr>
            <tr v-if="!paged.length">
              <td colspan="10" class="met-empty">{{ loading ? '加载中…' : '暂无指标' }}</td>
            </tr>
          </tbody>
        </table>
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

    <AppDrawer
      :open="detailOpen"
      storage-key="metric-drawer"
      :default-width="560"
      @close="closeDetail"
    >
      <div v-if="active" class="drawer-body">
        <div class="met-drawer-hd">
          <div>
            <div class="met-drawer-title">
              {{ active.id }}
              <span class="tag" :class="active.statusCls">{{ active.statusLabel }}</span>
              <span class="tag" :class="active.typeCls">{{ active.type }}</span>
            </div>
            <div class="met-drawer-sub">{{ active.name }} · {{ active.ver }} · Owner {{ active.owner }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeDetail">关闭</button>
        </div>

        <div class="met-stage-bar">
          <div
            v-for="s in METRIC_LIFECYCLE_STAGES"
            :key="s.id"
            class="met-stage-chip"
            :class="stageState(active, s.id)"
          >
            {{ s.label }}
          </div>
        </div>

        <div class="met-kv">
          <div class="met-kv-row"><span>业务口径</span><div>{{ active.caliber }}</div></div>
          <div v-if="active.pendingCaliber" class="met-kv-row">
            <span>待审新口径</span>
            <div class="pending">{{ active.pendingCaliber }}</div>
          </div>
          <div class="met-kv-row"><span>绑定 / 依赖</span><div><code>{{ active.bind }}</code></div></div>
          <div v-if="active.formula" class="met-kv-row"><span>计算公式</span><div><code>{{ active.formula }}</code></div></div>
          <div
            v-if="active.type === '衍生' || active.kind === '衍生' || active.formula || active.dim || active.time"
            class="met-kv-row"
          >
            <span>{{ active.type === '衍生' || active.kind === '衍生' ? '派生组合' : '计算视图' }}</span>
            <div class="tip">{{ formatMetricCalcDisplay(active) }}</div>
          </div>
          <div v-if="active.formulaAst?.refs?.length" class="met-kv-row">
            <span>解析引用</span>
            <div><code>{{ active.formulaAst.refs.join(', ') }}</code></div>
          </div>
          <div v-if="active.agg" class="met-kv-row"><span>聚合</span><div>{{ active.agg }}</div></div>
          <div v-if="(active.type === '衍生' || active.kind === '衍生') && active.qualifier" class="met-kv-row">
            <span>业务限定</span>
            <div><code>{{ active.qualifier }}</code></div>
          </div>
          <div v-if="active.dim" class="met-kv-row">
            <span>统计粒度</span>
            <div>{{ active.dim }}</div>
          </div>
          <div v-if="active.time" class="met-kv-row"><span>统计周期</span><div>{{ active.time }}</div></div>
          <div class="met-kv-row"><span>单位</span><div>{{ active.unit || '—' }}</div></div>
          <div class="met-kv-row"><span>最新值</span><div>{{ active.latest }} · {{ active.vol }}</div></div>
          <div v-if="active.compiledSql" class="met-kv-row">
            <span>编译 SQL</span>
            <div><pre class="met-sql">{{ active.compiledSql }}</pre></div>
          </div>
        </div>

        <div class="met-sec-title">状态流转记录</div>
        <div class="met-timeline">
          <div
            v-for="(h, i) in active.history"
            :key="i"
            class="met-tl-item"
            :class="{ current: i === active.history.length - 1 }"
          >
            <div class="met-tl-dot" />
            <div>
              <div class="met-tl-name">
                {{ h.label }}
                <span class="met-tl-time">{{ h.time }}</span>
              </div>
              <div v-if="h.note" class="met-tl-note">{{ h.note }}</div>
            </div>
          </div>
          <div v-if="!active.history?.length" class="tip" style="padding: 8px 0">暂无流转记录</div>
        </div>

        <div class="met-drawer-acts">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="trialBusy || saving"
            @click="doTrial"
          >
            {{ trialBusy ? '试跑中…' : '▶ 试跑 Trino' }}
          </button>
          <label class="met-trial-dt tip">
            dt
            <input v-model="trialDt" type="date" class="met-dt-input" />
          </label>
          <button
            v-if="active.status === 'active'"
            type="button"
            class="btn btn-sm"
            @click="goApplyMetric(active, 'query')"
          >
            🔑 申请查询权限
          </button>
          <button
            v-for="a in metricActions(active.status).filter(
              (x) => x !== 'detail' && x !== 'applyQuery',
            )"
            :key="a"
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-primary': actionClass(a) === 'ok' }"
            :disabled="saving"
            :style="
              actionClass(a) === 'danger'
                ? { color: 'var(--danger)', borderColor: 'var(--danger)' }
                : undefined
            "
            @click="runAction(active, a)"
          >
            {{ actionLabel(a) }}
          </button>
        </div>
        <p class="met-apply-hint tip">
          流程：① 保存草稿 → ② 申请发布 → ③ 待审核 → ④ 通过后<strong>自动启用</strong> / 驳回按意见重改。查询权限另走申请中心。
        </p>

        <div v-if="trialResult" class="met-trial-box">
          <div class="met-sec-title">试跑结果</div>
          <div class="met-trial-meta tip">
            <span :class="trialResult.executed ? 'ok' : 'warn'">
              {{ trialResult.statusLabel || (trialResult.executed ? '已执行' : '未执行') }}
            </span>
            · {{ trialResult.rowCount ?? 0 }} 行
            · {{ trialResult.durMs ?? '—' }} ms
            <template v-if="trialResult.queryId"> · {{ trialResult.queryId }}</template>
          </div>
          <p v-if="trialResult.message" class="met-trial-msg">{{ trialResult.message }}</p>
          <pre v-if="trialResult.sqlText" class="met-sql">{{ trialResult.sqlText }}</pre>
          <div v-if="trialResult.columns?.length" class="met-trial-table-wrap">
            <table class="table met-trial-table">
              <thead>
                <tr>
                  <th v-for="c in trialResult.columns" :key="c">{{ c }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in trialResult.rows || []" :key="i">
                  <td v-for="c in trialResult.columns" :key="c">{{ r[c] ?? '—' }}</td>
                </tr>
                <tr v-if="!(trialResult.rows || []).length">
                  <td :colspan="trialResult.columns.length" class="met-empty">无行</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<style scoped>
.met-domain-tabs{flex-wrap:wrap;gap:6px;margin-bottom:12px;display:flex}
.met-domain-tab{border:1px solid var(--border);cursor:pointer;color:var(--text-2);font-size:12px;font:inherit;background:#fff;border-radius:6px;padding:6px 14px}
.met-domain-tab.active{border-color:var(--primary);background:var(--primary-light);color:var(--primary);font-weight:600}
.met-kpi{grid-template-columns:repeat(5,1fr);margin-bottom:16px}
@media (width<=1100px){.met-kpi{grid-template-columns:repeat(3,1fr)}
}
.met-flow{margin-bottom:16px}
.met-stages{flex-wrap:wrap;align-items:center;gap:8px;display:flex}
.met-stage{color:var(--text-2);align-items:center;gap:6px;font-size:12px;display:inline-flex}
.met-stage-idx{background:var(--primary-light);width:18px;height:18px;color:var(--primary);border-radius:50%;place-items:center;font-size:10px;font-weight:700;display:grid}
.met-stage-arrow{color:var(--text-4)}
.met-catalog{margin-top:0}
.met-catalog-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.met-filters{flex-wrap:wrap;gap:8px;margin-left:auto;display:flex}
.met-type-tabs{background:var(--bg-2);border-radius:8px;flex-wrap:wrap;gap:4px;padding:3px;display:flex}
.met-type-tab{cursor:pointer;color:var(--text-2);font-size:12px;font:inherit;background:0 0;border:none;border-radius:6px;padding:4px 10px}
.met-type-tab.active{color:var(--text-1);box-shadow:var(--shadow-sm);background:#fff;font-weight:600}
.met-table{font-size:12px}
.met-row.warn{background:var(--warning-light)}
.met-row.deprecated{opacity:.72}
.met-row:hover{background:var(--bg-2)}
.met-id{font-family:monospace;font-size:11px}
.met-name{font-weight:600}
.met-caliber{color:var(--text-2);max-width:200px;font-size:12px}
.met-latest{font-weight:700}
.met-acts{white-space:nowrap;flex-wrap:wrap;gap:6px;display:flex}
.met-empty{text-align:center;color:var(--text-3);padding:24px!important}
.tip{color:var(--text-3);font-size:12px;font-weight:400}
.btn-link{color:var(--primary);cursor:pointer;font-size:12px;font:inherit;background:0 0;border:none;padding:0}
.btn-link:hover{text-decoration:underline}
.btn-link.ok{color:var(--success)}
.btn-link.danger{color:var(--danger)}
.met-drawer-hd{justify-content:space-between;gap:12px;margin-bottom:14px;display:flex}
.met-drawer-title{flex-wrap:wrap;align-items:center;gap:6px;font-size:16px;font-weight:700;display:flex}
.met-drawer-sub{color:var(--text-3);margin-top:4px;font-size:12px}
.met-stage-bar{flex-wrap:wrap;gap:6px;margin-bottom:14px;display:flex}
.met-stage-chip{background:var(--bg-2);color:var(--text-3);border-radius:99px;padding:3px 8px;font-size:11px}
.met-stage-chip.done{background:var(--success-light);color:var(--success)}
.met-stage-chip.current{background:var(--primary-light);color:var(--primary);font-weight:650}
.met-kv{margin-bottom:12px}
.met-kv-row{border-bottom:1px solid var(--border);grid-template-columns:88px 1fr;gap:8px;padding:8px 0;font-size:12px;display:grid}
.met-kv-row span{color:var(--text-3)}
.met-kv-row .pending{color:var(--warning);font-weight:600}
.met-sec-title{margin:12px 0 8px;font-size:12px;font-weight:650}
.met-timeline{padding-left:4px}
.met-tl-item{gap:10px;padding-bottom:12px;display:flex;position:relative}
.met-tl-item:not(:last-child):before{content:"";background:var(--border);width:1px;position:absolute;top:14px;bottom:0;left:5px}
.met-tl-dot{border:2px solid var(--border-dark);z-index:1;background:#fff;border-radius:50%;flex-shrink:0;width:11px;height:11px;margin-top:2px}
.met-tl-item.current .met-tl-dot{background:var(--primary);border-color:var(--primary)}
.met-tl-name{font-size:12px;font-weight:600}
.met-tl-time{color:var(--text-3);margin-left:6px;font-size:11px;font-weight:400}
.met-tl-note{color:var(--text-3);margin-top:2px;font-size:11px}
.met-drawer-acts{border-top:1px solid var(--border);flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:12px;display:flex}
.met-apply-hint{color:var(--text-3);margin-top:10px;font-size:11px;line-height:1.5}


.met-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-2);
  background: var(--bg-2);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.met-banner.warn {
  color: #ad6800;
  background: #fff7e6;
  border-color: #ffd591;
}
.met-pending-empty {
  margin: 0;
  padding: 16px 18px;
  font-size: 12px;
  color: var(--text-3);
}
.met-acts .ok {
  color: var(--success);
  font-weight: 600;
}
.met-sql {
  margin: 0;
  padding: 8px;
  max-height: 180px;
  overflow: auto;
  font-size: 11px;
  line-height: 1.45;
  background: var(--bg-2);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
