<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import ListPager from '@/components/common/ListPager.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useMetrics, sortMetricCatalog } from '@/composables/useMetrics'
import {
  enrichMetricBindPayload,
  invalidateMetricBindTables,
  warmMetricBindAssets,
} from '@/data/metricBindAssets'
import { METRIC_CREATE_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import '@/styles/metrics-page.css'
import {
  METRIC_LIFECYCLE_STAGES,
  METRIC_STATUS_TABS,
  formatMetricCalcDisplay,
  metricActions,
  metricToFormPayload,
} from '@/data/metrics'
import { useDomains } from '@/composables/useDomains'
import { createApplyTicket, pageMyTickets } from '@/api/apply'
import { fetchMetricLineage } from '@/api/metric'
import { useSession } from '@/composables/useSession'
import { useActionLock } from '@/composables/useActionLock'
import {
  ensureWorkspaceUserOptions,
  resolveWorkspaceUserId,
  workspaceUserLabel,
} from '@/data/workspaceUsers'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { user, currentWs } = useSession()
const { busy, run: runLocked } = useActionLock()
const guide = pageGuideOf('metrics-catalog')

const {
  catalog,
  loading,
  lastError,
  loadAll,
  reloadDetail,
  runTransition,
  runTrial,
  runMaterialize,
  addMetric,
  saveMetric,
} = useMetrics()

const { domainTabs, ensureDomains } = useDomains()

const domainTab = ref('all')
const typeTab = ref('all')
const statusTab = ref(
  typeof route.query.status === 'string' && route.query.status
    ? route.query.status
    : 'all',
)
const detailOpen = ref(false)
const activeId = ref('')
const saving = computed(() => busy('save') || busy('publish') || busy('transition'))
const trialBusy = computed(() => busy('trial'))
const trialResult = ref(null)
const trialDt = ref('')
/** 详情抽屉：下游指标 + API 绑定 */
const detailLineage = ref(null)
/** metricCode → 最近发布单 { ticketNo, status, remark } */
const publishTickets = ref({})
const createOpen = ref(false)
const editingId = ref('')
const formKey = ref(0)

const editing = computed(() => catalog.value.find((r) => r.id === editingId.value) || null)

const formBind = computed(() => {
  if (editingId.value) {
    return {
      ...METRIC_CREATE_FORM,
      title: editing.value ? `✎ 编辑指标 · ${editing.value.id}` : '✎ 编辑指标',
      intro:
        '仅草稿/待发布可改口径；已启用请走「申请变更」。原子绑定须为湖表（Iceberg/Hive），试跑走 Trino。',
      submitLabel: '保存修改',
    }
  }
  return {
    ...METRIC_CREATE_FORM,
    title: '＋ 新建指标',
    submitLabel: '保存草稿',
  }
})

const initialValues = computed(() => {
  if (!editingId.value) {
    return { owner: String(user.value?.id || '') }
  }
  if (!editing.value) return { owner: String(user.value?.id || '') }
  const payload = metricToFormPayload(editing.value)
  payload.owner = resolveWorkspaceUserId(payload.owner, user.value?.id || '')
  return payload
})


async function reloadMetrics() {
  await loadAll({ ws: currentWs.value || 'default', scope: 'workspace' })
}

const TYPE_TABS = [
  { id: 'all', label: '全部类型' },
  { id: '原子', label: '原子' },
  { id: '衍生', label: '衍生' },
  { id: '复合', label: '复合' },
]

const filteredCatalog = computed(() => {
  let rows = catalog.value
  if (domainTab.value !== 'all') rows = rows.filter((r) => r.domain === domainTab.value)
  if (typeTab.value !== 'all') rows = rows.filter((r) => r.type === typeTab.value)
  if (statusTab.value !== 'all') rows = rows.filter((r) => r.status === statusTab.value)
  return sortMetricCatalog(rows)
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredCatalog)

watch([domainTab, typeTab, statusTab], () => resetPage())

watch(
  () => route.query.status,
  (s) => {
    if (typeof s === 'string' && s) statusTab.value = s
  },
)

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

function metricOwnerDisplay(raw) {
  return workspaceUserLabel(raw) || '—'
}

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
    /* 无工单不影响目录 */
  }
}


watch(
  () => [route.query.create, route.query.edit, catalog.value.length],
  ([create, edit]) => {
    if (edit && typeof edit === 'string' && edit.trim()) {
      const id = edit.trim()
      if (createOpen.value && editingId.value === id) return
      const row = catalog.value.find((r) => r.id === id)
      if (row) {
        openEdit(row)
        return
      }
      if (catalog.value.length) {
        showToast(`未找到指标 ${id}`, 'warning')
        clearCreateQuery()
      }
      return
    }
    if (create === '1' || create === 'true') {
      if (!createOpen.value || editingId.value) newMetric()
    }
  },
)

onMounted(async () => {
  try {
    await Promise.all([
      reloadMetrics(),
      warmMetricBindAssets().catch(() => {}),
      refreshPublishTickets(),
      ensureWorkspaceUserOptions().catch(() => {}),
      ensureDomains().catch(() => {}),
    ])
    const q = typeof route.query.q === 'string' ? route.query.q.trim() : ''
    if (q) {
      const hit = catalog.value.find((r) => r.id === q || r.name?.includes(q))
      if (hit) openDetail(hit.id)
    }
  } catch (e) {
    showToast(e?.message || '加载指标目录失败', 'error')
  }
})

watch(currentWs, () => {
  invalidateMetricBindTables()
  Promise.all([
    reloadMetrics(),
    refreshPublishTickets(),
    warmMetricBindAssets().catch(() => {}),
  ]).catch(() => {})
})

function clearCreateQuery() {
  const q = { ...route.query }
  delete q.create
  delete q.edit
  router.replace({ path: '/metrics/catalog', query: q })
}

function newMetric() {
  editingId.value = ''
  formKey.value += 1
  createOpen.value = true
}

function closeCreate() {
  createOpen.value = false
  editingId.value = ''
  if (route.query.create || route.query.edit) clearCreateQuery()
}

async function onSubmitCreate(payload) {
  await runLocked('save', async () => {
    try {
      const ws = currentWs.value || 'default'
      if (editingId.value) {
        const id = editingId.value
        await saveMetric(id, enrichMetricBindPayload({ ...payload, ws }))
        showToast(`已更新 ${id}`, 'success')
        closeCreate()
        openDetail(id)
        return
      }
      const row = await addMetric(enrichMetricBindPayload({ ...payload, ws }))
      if (!row?.id) {
        showToast('已保存，但列表未刷出该指标，请刷新', 'warning')
        closeCreate()
        return
      }
      showToast(`已保存草稿 ${row.id} ${row.name} · 可「申请发布」`, 'success')
      closeCreate()
      openDetail(row.id)
    } catch (e) {
      showToast(e?.message || '保存失败', 'warning')
    }
  })
}

async function openDetail(id) {
  activeId.value = id
  detailOpen.value = true
  trialResult.value = null
  detailLineage.value = null
  const ws = currentWs.value || 'default'
  try {
    await reloadDetail(id, ws)
  } catch {
    /* 列表数据仍可用 */
  }
  try {
    detailLineage.value = await fetchMetricLineage(id, ws)
  } catch {
    detailLineage.value = null
  }
}

function closeDetail() {
  detailOpen.value = false
  trialResult.value = null
  detailLineage.value = null
}

async function confirmDeprecate(row) {
  let impactHint = ''
  try {
    const lin = await fetchMetricLineage(row.id, currentWs.value || 'default')
    const nDown = lin?.downstream?.length || lin?.downstreamCount || 0
    const nApi = lin?.apiCount || lin?.apiBindings?.length || 0
    if (nDown || nApi) {
      impactHint = `\n下游影响：衍生/复合 ${nDown} · 数据服务 API ${nApi}`
    }
  } catch {
    /* soft */
  }
  return window.confirm(`确认废弃 ${row.id}？废弃后禁止新引用。${impactHint}`)
}

async function doTrial() {
  const row = active.value
  if (!row) return
  await runLocked('trial', async () => {
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
        showToast(res?.message || '试跑未执行（请检查查询引擎）', 'warning')
      }
    } catch (e) {
      trialResult.value = { executed: false, message: e?.message || String(e), rows: [], columns: [] }
      showToast(e?.message || '试跑失败', 'warning')
    }
  })
}

async function doMaterialize() {
  const row = active.value
  if (!row) return
  if (row.status !== 'active' && row.status !== 'review') {
    showToast('仅待发布/已启用可登记物化', 'warning')
    return
  }
  try {
    const res = await runMaterialize(row.id, { engine: 'clickhouse', launch: true })
    showToast(
      `物化已登记 · job_ref=${res?.jobRef || '—'} · recon_ok=${res?.reconOk ? 1 : 0}`,
      res?.launch?.degraded ? 'warning' : 'success',
    )
  } catch (e) {
    showToast(e?.message || '物化登记失败', 'warning')
  }
}

function openEdit(row) {
  if (row.status !== 'draft' && row.status !== 'review') {
    showToast('仅草稿/待发布可直接编辑；已启用请使用「申请变更」', 'warning')
    return
  }
  editingId.value = row.id
  formKey.value += 1
  createOpen.value = true
  if (row.table) warmMetricBindAssets(row.table).catch(() => {})
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

/** 草稿 → 申请首次发布；已启用 → 申请口径变更发布 */
async function submitPublishApply(row, kind = 'create') {
  if (!row?.id) return
  await runLocked('publish', async () => {
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
      await Promise.all([reloadMetrics(), refreshPublishTickets()])
      showToast(
        ticketNo
          ? `已申请发布 ${ticketNo}（待审核）。通过后将自动启用，驳回则按意见重改`
          : '已提交发布申请，待审核通过后自动启用',
        'success',
      )
      if (detailOpen.value) openDetail(row.id)
    } catch (e) {
      showToast(e?.message || '提交发布申请失败', 'warning')
    }
  })
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
    if (!(await confirmDeprecate(row))) return
  }
  await runLocked('transition', async () => {
    try {
      const next = await runTransition(row.id, action, '')
      const tips = {
        deprecate: `已废弃 ${row.id} · 禁止新引用`,
      }
      showToast(tips[action] || `状态已更新 ${row.id}${next?.ver ? ' · ' + next.ver : ''}`, action === 'deprecate' ? 'warning' : 'success')
      if (detailOpen.value) openDetail(row.id)
    } catch (e) {
      showToast(e?.message || '操作失败', 'warning')
    }
  })
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
    await Promise.all([reloadMetrics(), refreshPublishTickets()])
    showToast('已刷新指标目录', 'success')
  } catch (e) {
    showToast(e?.message || '刷新失败', 'warning')
  }
}
</script>

<template>
  <div class="met-page">
    <PageHeader
      page-id="metrics-catalog"
      title="指标目录"
      subtitle="筛选 · 详情 · 申请发布 / 权限 / 变更"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" :disabled="loading || saving" @click="refresh">
        ↻ 刷新
      </button>
      <button type="button" class="btn btn-sm" @click="goApplyMetric(null, 'query')">
        申请权限
      </button>
      <button type="button" class="btn btn-sm btn-primary" :disabled="saving" @click="newMetric">
        ＋ 新建指标
      </button>
    </PageHeader>

    <p class="tip met-banner">
      原子指标绑定<strong>湖表</strong>（Iceberg/Hive），试跑/查询经 <strong>Trino</strong> 执行；源端 MySQL
      等不会出现在绑定表下拉里。请先入湖并在资产目录登记湖表后再建指标。
    </p>
    <p v-if="lastError && !catalog.length" class="met-banner warn">
      加载失败：{{ lastError.message || lastError }} · 请确认后端已迁移（含 V72 下线演示种子）且已登录
    </p>
    <p v-else-if="loading && !catalog.length" class="met-banner">正在加载指标目录…</p>

    <div class="met-domain-tabs">
      <button
        v-for="t in domainTabs"
        :key="t.id"
        type="button"
        class="met-domain-tab"
        :class="{ active: domainTab === t.id }"
        @click="domainTab = t.id"
      >
        {{ t.label }}
      </button>
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
              <td>{{ metricOwnerDisplay(row.owner) }}</td>
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
              <td colspan="10" class="met-empty">
                {{ loading ? '加载中…' : '暂无指标。点击「新建指标」开始' }}
              </td>
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
            <div class="met-drawer-sub">{{ active.name }} · {{ active.ver }} · Owner {{ metricOwnerDisplay(active.owner) }}</div>
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

        <div class="met-sec-title">下游影响</div>
        <div class="met-kv" style="margin-bottom: 12px">
          <div class="met-kv-row">
            <span>衍生 / 复合</span>
            <div>
              <template v-if="detailLineage?.downstream?.length">
                <div
                  v-for="d in detailLineage.downstream"
                  :key="d.metricCode"
                  style="margin: 2px 0"
                >
                  <code>{{ d.metricCode }}</code>
                  <span class="tip"> · {{ d.name || d.kind || '' }} · {{ d.status || '' }}</span>
                </div>
              </template>
              <span v-else class="tip">无下游指标依赖</span>
            </div>
          </div>
          <div class="met-kv-row">
            <span>数据服务 API</span>
            <div>
              <template v-if="detailLineage?.apiBindings?.length">
                <div
                  v-for="a in detailLineage.apiBindings"
                  :key="a.id || a.publicPath"
                  style="margin: 2px 0"
                >
                  <code>{{ a.publicPath || a.name }}</code>
                  <span class="tip">
                    · {{ a.sourceRef || '' }}
                    <template v-if="a.pinnedVer"> · 钉 {{ a.pinnedVer }}</template>
                  </span>
                </div>
              </template>
              <span v-else class="tip">无钉版本 API 绑定</span>
            </div>
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
            {{ trialBusy ? '试跑中…' : '▶ 试跑' }}
          </button>
          <button
            v-if="active.status === 'active' || active.status === 'review'"
            type="button"
            class="btn btn-sm"
            :disabled="saving"
            @click="doMaterialize"
          >
            📦 物化作业
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

    <CreateFormModal
      :key="formKey"
      :open="createOpen"
      v-bind="formBind"
      :initial-values="initialValues"
      @close="closeCreate"
      @submit="onSubmitCreate"
    />
  </div>
</template>

