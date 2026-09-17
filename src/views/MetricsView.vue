<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { METRIC_CREATE_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  METRIC_CATALOG,
  METRIC_DOMAIN_TABS,
  METRIC_KPIS,
  METRIC_LIFECYCLE_STAGES,
  METRIC_STATUS_TABS,
  applyMetricEdit,
  buildMetricFromForm,
  formatMetricCalcDisplay,
  metricActions,
  metricToFormPayload,
  transitionMetric,
} from '@/data/metrics'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('metrics')

const domainTab = ref('all')
const typeTab = ref('all')
const statusTab = ref('all')
const createOpen = ref(false)
const editOpen = ref(false)
const detailOpen = ref(false)
const editingId = ref('')
const activeId = ref('')
const catalog = ref(METRIC_CATALOG.map((r) => ({ ...r, history: [...(r.history || [])] })))

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
  return rows
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredCatalog)

watch([domainTab, typeTab, statusTab], () => resetPage())

watch(
  () => route.query.q,
  (q) => {
    const id = typeof q === 'string' ? q.trim() : ''
    if (!id) return
    const hit = catalog.value.find((r) => r.id === id || r.name.includes(id))
    if (hit) openDetail(hit.id)
  },
  { immediate: true },
)

const active = computed(() => catalog.value.find((r) => r.id === activeId.value) || null)
const editing = computed(() => catalog.value.find((r) => r.id === editingId.value) || null)

const editForm = computed(() => ({
  ...METRIC_CREATE_FORM,
  title: editing.value ? `✎ 编辑指标 · ${editing.value.id}` : '✎ 编辑指标',
  intro: '仅草稿可改口径定义；已启用请走「变更」进入新版本评审',
  submitLabel: '保存修改',
}))

const editInitial = computed(() => (editing.value ? metricToFormPayload(editing.value) : null))

const liveKpis = computed(() => {
  const all = catalog.value
  const atom = all.filter((r) => r.type === '原子').length
  const derive = all.filter((r) => r.type === '衍生').length
  const composite = all.filter((r) => r.type === '复合').length
  const enabled = all.filter((r) => r.status === 'active').length
  const base = METRIC_KPIS.map((k) => ({ ...k }))
  if (base[0]) base[0].value = String(all.length)
  if (base[1]) base[1].value = String(atom)
  if (base[2]) base[2].value = String(derive)
  if (base[3]) base[3].value = String(composite)
  if (base[4]) base[4].value = String(enabled)
  return base
})

function patchRow(id, next) {
  const idx = catalog.value.findIndex((r) => r.id === id)
  if (idx < 0 || !next) return
  catalog.value.splice(idx, 1, next)
  if (activeId.value === id) activeId.value = id
}

function newMetric() {
  createOpen.value = true
}

function onCreateMetric(payload) {
  let row
  try {
    row = buildMetricFromForm(payload, catalog.value)
  } catch (e) {
    showToast(e?.message || '公式无法解析', 'warning')
    return
  }
  catalog.value = [row, ...catalog.value]
  resetPage()
  showToast(`✅ 已保存草稿 ${row.id} ${row.name} · 可提交评审`, 'success')
  openDetail(row.id)
}

function openDetail(id) {
  activeId.value = id
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
}

function openEdit(row) {
  if (row.status !== 'draft') {
    showToast('仅草稿可直接编辑；已启用请使用「变更」', 'warning')
    return
  }
  editingId.value = row.id
  editOpen.value = true
}

function onEditMetric(payload) {
  const row = editing.value
  if (!row) return
  let patched
  try {
    patched = applyMetricEdit(row, payload)
  } catch (e) {
    showToast(e?.message || '公式无法解析', 'warning')
    return
  }
  patchRow(row.id, patched)
  editOpen.value = false
  showToast(`💾 已更新草稿 ${row.id}`, 'success')
}

function goApplyMetric(row, kind = 'query') {
  const query = { type: 'metric', kind }
  if (row?.id && kind !== 'create') query.metricId = row.id
  router.push({ path: '/apply', query })
}

function goApplyCreate() {
  router.push({ path: '/apply', query: { type: 'metric', kind: 'create' } })
}

function runAction(row, action) {
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
  if (action === 'applyChange') {
    goApplyMetric(row, 'change')
    return
  }
  if (action === 'change') {
    const note = window.prompt('变更说明（新口径摘要）', row.caliber)
    if (note === null) return
    const next = transitionMetric(row, 'change')
    if (!next) return
    next.pendingCaliber = note.trim() || row.caliber
    patchRow(row.id, next)
    showToast(`📝 ${row.id} 已进入新版本评审（Owner 快捷变更）`, 'info')
    openDetail(row.id)
    return
  }
  const next = transitionMetric(row, action)
  if (!next) {
    showToast('当前状态不允许该操作', 'warning')
    return
  }
  patchRow(row.id, next)
  const tips = {
    submit: `已提交评审 ${row.id}`,
    approve: `已启用 ${row.id} · 可被报表/API 引用`,
    reject: `已退回草稿 ${row.id}`,
    approveVersion: `新版本 ${next.ver} 已启用 ${row.id}`,
    cancelChange: `已取消变更 ${row.id} · 保持 ${row.ver}`,
    deprecate: `已废弃 ${row.id} · 禁止新引用`,
  }
  showToast(
    tips[action] || `状态已更新 ${row.id}`,
    action === 'deprecate' || action === 'reject' ? 'warning' : 'success',
  )
}

function actionLabel(a) {
  return (
    {
      detail: '详情',
      edit: '编辑',
      submit: '提交评审',
      approve: '启用',
      reject: '退回',
      applyQuery: '申请权限',
      applyChange: '申请变更',
      change: 'Owner变更',
      approveVersion: '通过新版本',
      cancelChange: '取消变更',
      deprecate: '废弃',
    }[a] || a
  )
}

function actionClass(a) {
  if (a === 'deprecate' || a === 'reject') return 'danger'
  if (a === 'approve' || a === 'approveVersion' || a === 'submit') return 'ok'
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
</script>

<template>
  <div class="met-page">
    <PageHeader
      title="指标中心"
      subtitle="原子 / 衍生 / 复合 · 草稿→评审→启用→变更→废弃 · 查询权限走申请中心"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="goApplyCreate">📋 申请新建</button>
      <button type="button" class="btn btn-sm" @click="goApplyMetric(null, 'query')">
        🔑 申请权限
      </button>
      <button type="button" class="btn btn-sm btn-primary" @click="newMetric">＋ 新建指标</button>
    </PageHeader>

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
        <div class="card-title">生命周期 <span class="tip">· 草稿 → 评审中 → 已启用 → 新版本评审 → 已启用 · 已启用 → 已废弃</span></div>
      </div>
      <div class="card-body met-stages">
        <div v-for="(s, i) in METRIC_LIFECYCLE_STAGES" :key="s.id" class="met-stage">
          <span class="met-stage-idx">{{ i + 1 }}</span>
          <span>{{ s.label }}</span>
          <span v-if="i < METRIC_LIFECYCLE_STAGES.length - 1" class="met-stage-arrow">→</span>
        </div>
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
                  @click="runAction(row, a)"
                >
                  {{ actionLabel(a) }}
                </button>
              </td>
            </tr>
            <tr v-if="!paged.length">
              <td colspan="10" class="met-empty">暂无指标</td>
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
            <div>
              {{ active.dim }}
              <span v-if="active.dimCustom" class="tag tag-orange" style="margin-left: 6px">自定义·待评审</span>
            </div>
          </div>
          <div v-if="active.time" class="met-kv-row"><span>统计周期</span><div>{{ active.time }}</div></div>
          <div class="met-kv-row"><span>单位</span><div>{{ active.unit || '—' }}</div></div>
          <div class="met-kv-row"><span>最新值</span><div>{{ active.latest }} · {{ active.vol }}</div></div>
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
        </div>

        <div class="met-drawer-acts">
          <button
            v-if="active.status === 'active'"
            type="button"
            class="btn btn-sm btn-primary"
            @click="goApplyMetric(active, 'query')"
          >
            🔑 申请查询权限
          </button>
          <button
            v-if="active.status === 'active'"
            type="button"
            class="btn btn-sm"
            @click="goApplyMetric(active, 'change')"
          >
            申请口径变更
          </button>
          <button
            v-for="a in metricActions(active.status).filter(
              (x) => x !== 'detail' && x !== 'applyQuery' && x !== 'applyChange',
            )"
            :key="a"
            type="button"
            class="btn btn-sm"
            :class="{
              'btn-primary': actionClass(a) === 'ok',
            }"
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
        <p v-if="active.status === 'active'" class="met-apply-hint tip">
          「申请查询权限 / 申请口径变更」走申请中心工单；「Owner变更」为指标 Owner 在中心内快捷发起新版本评审。
        </p>
      </div>
    </AppDrawer>
  </div>
</template>

<style scoped>
.met-domain-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.met-domain-tab {
  padding: 6px 14px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  color: var(--text-2);
  font: inherit;
}
.met-domain-tab.active {
  border-color: var(--primary);
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
}
.met-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1100px) {
  .met-kpi { grid-template-columns: repeat(3, 1fr); }
}

.met-flow { margin-bottom: 16px; }
.met-stages {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.met-stage {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
}
.met-stage-idx {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary);
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
}
.met-stage-arrow { color: var(--text-4); }

.met-catalog { margin-top: 0; }
.met-catalog-hd {
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.met-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}
.met-type-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-2);
  padding: 3px;
  border-radius: 8px;
  flex-wrap: wrap;
}
.met-type-tab {
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-2);
  font: inherit;
}
.met-type-tab.active {
  background: #fff;
  color: var(--text-1);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.met-table { font-size: 12px; }
.met-row.warn { background: var(--warning-light); }
.met-row.deprecated { opacity: 0.72; }
.met-row:hover { background: var(--bg-2); }
.met-id { font-family: monospace; font-size: 11px; }
.met-name { font-weight: 600; }
.met-caliber {
  font-size: 12px;
  color: var(--text-2);
  max-width: 200px;
}
.met-latest { font-weight: 700; }
.met-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  white-space: nowrap;
}
.met-empty {
  text-align: center;
  color: var(--text-3);
  padding: 24px !important;
}
.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.btn-link {
  border: none;
  background: none;
  color: var(--primary);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  font: inherit;
}
.btn-link:hover { text-decoration: underline; }
.btn-link.ok { color: var(--success); }
.btn-link.danger { color: var(--danger); }

.met-drawer-hd {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.met-drawer-title {
  font-size: 16px;
  font-weight: 700;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.met-drawer-sub {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}

.met-stage-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.met-stage-chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 99px;
  background: var(--bg-2);
  color: var(--text-3);
}
.met-stage-chip.done {
  background: var(--success-light);
  color: var(--success);
}
.met-stage-chip.current {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 650;
}

.met-kv { margin-bottom: 12px; }
.met-kv-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.met-kv-row span { color: var(--text-3); }
.met-kv-row .pending { color: var(--warning); font-weight: 600; }

.met-sec-title {
  font-size: 12px;
  font-weight: 650;
  margin: 12px 0 8px;
}
.met-timeline { padding-left: 4px; }
.met-tl-item {
  display: flex;
  gap: 10px;
  position: relative;
  padding-bottom: 12px;
}
.met-tl-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 1px;
  background: var(--border);
}
.met-tl-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid var(--border-dark);
  background: #fff;
  margin-top: 2px;
  flex-shrink: 0;
  z-index: 1;
}
.met-tl-item.current .met-tl-dot {
  background: var(--primary);
  border-color: var(--primary);
}
.met-tl-name { font-size: 12px; font-weight: 600; }
.met-tl-time {
  font-weight: 400;
  color: var(--text-3);
  margin-left: 6px;
  font-size: 11px;
}
.met-tl-note {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}
.met-drawer-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.met-apply-hint {
  margin-top: 10px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-3);
}
</style>
