<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { COMPLIANCE_DELETE_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  COMPLIANCE_KPIS,
  COMPLIANCE_STAGES,
  COMPLIANCE_STATUS_TABS,
  COMPLIANCE_TICKETS,
  complianceTypeCls,
  filterComplianceTickets,
  impactHintForSubject,
  nextComplianceId,
} from '@/data/compliance'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('compliance')

const tickets = ref(COMPLIANCE_TICKETS.map((t) => ({ ...t, timeline: [...(t.timeline || [])] })))
const tab = ref('all')
const query = ref('')
const createOpen = ref(false)
const detailOpen = ref(false)
const activeId = ref('')

const active = computed(() => tickets.value.find((t) => t.id === activeId.value) || null)

const filtered = computed(() => filterComplianceTickets(tickets.value, tab.value, query.value))
const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filtered)

watch([tab, query], () => resetPage())

watch(
  () => route.query.create,
  (v) => {
    if (v === '1' || v === 'true') createOpen.value = true
  },
  { immediate: true },
)

function openCreate() {
  createOpen.value = true
}

function onCreate(payload) {
  const id = nextComplianceId(tickets.value)
  const subject = String(payload.subject || '').trim()
  const impact = String(payload.impact || '').trim() || impactHintForSubject(subject)
  const type = payload.type || '被遗忘权'
  const row = {
    id,
    subject,
    type,
    scope: payload.scope || '指定行',
    law: payload.law || '',
    impact,
    tables: [],
    approver: payload.approver || '安全岗+法务+Owner',
    approval: '安全岗待审',
    approvalPending: true,
    status: '审批中',
    statusKey: 'pending',
    statusCls: 'tag-orange',
    applicant: '当前用户',
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    deadline: payload.deadline || '7 天内',
    execMode: payload.execMode || 'Iceberg equality delete + CK ALTER DELETE',
    timeline: [
      { name: '创建工单', status: 'done', time: '刚刚' },
      { name: '血缘影响评估', status: 'current', time: '排队中', opinion: impact.slice(0, 40) },
      { name: '安全岗审批', status: 'pending' },
      { name: '法务审批', status: 'pending' },
      { name: 'Owner 签批', status: 'pending' },
      { name: '平台执行', status: 'pending' },
      { name: '审计归档', status: 'pending' },
    ],
  }
  tickets.value = [row, ...tickets.value]
  createOpen.value = false
  if (route.query.create) {
    router.replace({ path: '/compliance', query: {} })
  }
  showToast(`✅ 已创建 ${id} · 已通知审批链：${row.approver}`, 'success')
  openDetail(id)
}

function openDetail(id) {
  activeId.value = id
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
}

function exportList() {
  showToast('📤 合规删除工单导出中 · CSV（工单号,类型,主体,状态,截止日）', 'success')
}

function goLifecycle() {
  router.push('/lifecycle')
}

function goLineage(table) {
  router.push({ path: '/lineage', query: { q: table } })
}

function approve(t) {
  if (!t) return
  const idx = tickets.value.findIndex((x) => x.id === t.id)
  if (idx < 0) return
  const next = { ...tickets.value[idx] }
  if (next.statusKey === 'pending') {
    next.approval = '三方 ✓'
    next.approvalPending = false
    next.status = '待执行'
    next.statusKey = 'ready'
    next.statusCls = 'tag-blue'
    next.timeline = (next.timeline || []).map((n) =>
      n.status === 'current' ? { ...n, status: 'done', time: '刚刚', opinion: '同意' } : n,
    )
    const exec = next.timeline.find((n) => n.name.includes('执行') && n.status === 'pending')
    if (exec) exec.status = 'current'
  }
  tickets.value.splice(idx, 1, next)
  showToast(`✓ 已同意 ${t.id} · 进入待执行`, 'success')
}

function reject(t) {
  if (!t) return
  const idx = tickets.value.findIndex((x) => x.id === t.id)
  if (idx < 0) return
  const next = {
    ...tickets.value[idx],
    status: '已驳回',
    statusKey: 'rejected',
    statusCls: 'tag-red',
    approvalPending: false,
    approval: '已驳回',
  }
  tickets.value.splice(idx, 1, next)
  showToast(`✕ 已驳回 ${t.id}`, 'warning')
}

function execute(t) {
  if (!t) return
  const idx = tickets.value.findIndex((x) => x.id === t.id)
  if (idx < 0) return
  const next = {
    ...tickets.value[idx],
    status: '已执行',
    statusKey: 'done',
    statusCls: 'tag-green',
    executedAt: '刚刚',
  }
  next.timeline = (next.timeline || []).map((n) => {
    if (n.status === 'current') return { ...n, status: 'done', time: '刚刚', opinion: '删除完成' }
    return n
  })
  tickets.value.splice(idx, 1, next)
  showToast(`⚡ 已提交执行 ${t.id} · ${next.execMode}`, 'success')
}

function destroy(t) {
  if (!t) return
  showToast(`🔥 物理销毁已排队 ${t.id} · 不可逆 · 审计已留痕`, 'warning')
}
</script>

<template>
  <div class="cp-page">
    <PageHeader
      title="合规删除工单"
      subtitle="被遗忘权 · 错误擦除 · 监管责令 · 合同到期 · 三方审批 · 不可逆执行"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="exportList">📤 导出</button>
      <button type="button" class="btn btn-sm" @click="goLifecycle">⏳ 生命周期</button>
      <button type="button" class="btn btn-sm btn-primary" @click="openCreate">＋ 创建工单</button>
    </PageHeader>

    <CreateFormModal
      :open="createOpen"
      v-bind="COMPLIANCE_DELETE_FORM"
      @close="createOpen = false"
      @submit="onCreate"
    />

    <div class="kpi-grid cp-kpi">
      <div v-for="(k, i) in COMPLIANCE_KPIS" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="k.trendDown ? 'down' : 'up'">{{ k.trend }}</div>
      </div>
    </div>

    <!-- 流程设计 -->
    <div class="card cp-flow">
      <div class="card-header">
        <div class="card-title">流程设计 <span class="tip">· 创建 → 评估 → 审批 → 执行 → 归档 → 销毁</span></div>
      </div>
      <div class="card-body cp-stages">
        <div v-for="(s, i) in COMPLIANCE_STAGES" :key="s.id" class="cp-stage">
          <div class="cp-stage-idx">{{ i + 1 }}</div>
          <div>
            <div class="cp-stage-lab">{{ s.label }}</div>
            <div class="cp-stage-desc">{{ s.desc }}</div>
          </div>
          <span v-if="i < COMPLIANCE_STAGES.length - 1" class="cp-stage-arrow">→</span>
        </div>
      </div>
      <div class="cp-flow-note">
        ⚠ 禁止与快照过期同窗口执行；DELETE 须经血缘 K 链路传播，否则看板可能「幽灵复活」。
      </div>
    </div>

    <!-- 工单列表 -->
    <div class="card cp-list-card">
      <div class="card-header cp-list-hd">
        <div class="card-title">工单管理</div>
        <div class="cp-filters">
          <div class="cp-tabs">
            <button
              v-for="t in COMPLIANCE_STATUS_TABS"
              :key="t.id"
              type="button"
              class="cp-tab"
              :class="{ active: tab === t.id }"
              @click="tab = t.id"
            >
              {{ t.label }}
            </button>
          </div>
          <input
            v-model="query"
            class="input input-sm cp-search"
            placeholder="搜工单号 / 主体 / 类型"
          />
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>工单</th>
              <th>主体</th>
              <th>类型</th>
              <th>范围</th>
              <th>影响</th>
              <th>审批</th>
              <th>截止</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in paged" :key="t.id">
              <td>
                <button type="button" class="btn-link" @click="openDetail(t.id)">
                  <code>{{ t.id }}</code>
                </button>
              </td>
              <td>{{ t.subject }}</td>
              <td><span class="tag" :class="complianceTypeCls(t.type)">{{ t.type }}</span></td>
              <td style="font-size: 12px">{{ t.scope }}</td>
              <td class="cp-impact">{{ t.impact }}</td>
              <td style="font-size: 11px">
                {{ t.approval }}
                <span v-if="t.approvalPending" class="tag tag-orange">待签</span>
              </td>
              <td style="font-size: 12px">{{ t.deadline }}</td>
              <td><span class="tag" :class="t.statusCls">{{ t.status }}</span></td>
              <td class="cp-acts">
                <button type="button" class="btn-link" @click="openDetail(t.id)">详情</button>
                <button
                  v-if="t.statusKey === 'pending'"
                  type="button"
                  class="btn-link ok"
                  @click="approve(t)"
                >同意</button>
                <button
                  v-if="t.statusKey === 'pending'"
                  type="button"
                  class="btn-link danger"
                  @click="reject(t)"
                >驳回</button>
                <button
                  v-if="t.statusKey === 'ready'"
                  type="button"
                  class="btn-link ok"
                  @click="execute(t)"
                >执行</button>
                <button
                  v-if="t.statusKey === 'archive'"
                  type="button"
                  class="btn-link danger"
                  @click="destroy(t)"
                >销毁</button>
              </td>
            </tr>
            <tr v-if="!paged.length">
              <td colspan="9" class="cp-empty">暂无工单</td>
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
      storage-key="compliance-drawer"
      :default-width="560"
      @close="closeDetail"
    >
      <div v-if="active" class="drawer-body">
        <div class="cp-drawer-hd">
          <div>
            <div class="cp-drawer-title">
              {{ active.id }}
              <span class="tag" :class="active.statusCls">{{ active.status }}</span>
            </div>
            <div class="cp-drawer-sub">{{ active.type }} · {{ active.subject }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeDetail">关闭</button>
        </div>

        <div class="cp-meta">
          <div><span>申请人</span><b>{{ active.applicant }}</b></div>
          <div><span>创建时间</span><b>{{ active.createdAt }}</b></div>
          <div><span>截止日期</span><b>{{ active.deadline }}</b></div>
          <div><span>审批链</span><b>{{ active.approver }}</b></div>
        </div>

        <div class="cp-kv">
          <div class="cp-kv-row"><span>法律依据</span><div>{{ active.law }}</div></div>
          <div class="cp-kv-row"><span>删除范围</span><div>{{ active.scope }}</div></div>
          <div class="cp-kv-row"><span>血缘影响</span><div>{{ active.impact }}</div></div>
          <div class="cp-kv-row"><span>执行方式</span><div>{{ active.execMode }}</div></div>
          <div v-if="active.executedAt" class="cp-kv-row"><span>执行时间</span><div>{{ active.executedAt }}</div></div>
          <div v-if="active.destroyAfter" class="cp-kv-row"><span>销毁观察至</span><div>{{ active.destroyAfter }}</div></div>
        </div>

        <div v-if="active.tables?.length" class="cp-tables">
          <div class="cp-sec-title">影响表</div>
          <button
            v-for="tb in active.tables"
            :key="tb"
            type="button"
            class="tag tag-blue cp-table-tag"
            @click="goLineage(tb)"
          >
            {{ tb }}
          </button>
        </div>

        <div class="cp-sec-title">审批 / 执行时间线</div>
        <div class="cp-timeline">
          <div
            v-for="(n, i) in active.timeline"
            :key="i"
            class="cp-tl-item"
            :class="n.status"
          >
            <div class="cp-tl-dot" />
            <div class="cp-tl-body">
              <div class="cp-tl-name">
                {{ n.name }}
                <span v-if="n.time" class="cp-tl-time">{{ n.time }}</span>
              </div>
              <div v-if="n.opinion" class="cp-tl-op">{{ n.opinion }}</div>
            </div>
          </div>
        </div>

        <div class="cp-drawer-acts">
          <button
            v-if="active.statusKey === 'pending'"
            type="button"
            class="btn btn-sm btn-primary"
            @click="approve(active)"
          >✓ 同意</button>
          <button
            v-if="active.statusKey === 'pending'"
            type="button"
            class="btn btn-sm"
            style="color: var(--danger); border-color: var(--danger)"
            @click="reject(active)"
          >✕ 驳回</button>
          <button
            v-if="active.statusKey === 'ready'"
            type="button"
            class="btn btn-sm btn-primary"
            @click="execute(active)"
          >⚡ 执行删除</button>
          <button
            v-if="active.statusKey === 'archive'"
            type="button"
            class="btn btn-sm"
            style="color: var(--danger); border-color: var(--danger)"
            @click="destroy(active)"
          >🔥 物理销毁</button>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<style scoped>
.cp-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .cp-kpi { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .cp-kpi { grid-template-columns: repeat(2, 1fr); }
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.cp-flow { margin-bottom: 16px; }
.cp-stages {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
  align-items: stretch;
}
.cp-stage {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 140px;
  padding: 4px 6px;
}
.cp-stage-idx {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--danger-light);
  color: var(--danger);
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.cp-stage-lab { font-size: 12px; font-weight: 650; }
.cp-stage-desc { font-size: 10px; color: var(--text-3); margin-top: 2px; }
.cp-stage-arrow { color: var(--text-4); margin-left: auto; padding: 0 4px; }
.cp-flow-note {
  margin: 0 16px 14px;
  padding: 8px 10px;
  background: var(--warning-light);
  color: var(--warning);
  border-radius: 6px;
  font-size: 11px;
}

.cp-list-card { margin-top: 0; }
.cp-list-hd {
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.cp-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-left: auto;
}
.cp-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  background: var(--bg-2);
  padding: 3px;
  border-radius: 8px;
}
.cp-tab {
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-2);
  font: inherit;
}
.cp-tab.active {
  background: #fff;
  color: var(--text-1);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.cp-search { width: 200px; }

.cp-impact {
  max-width: 220px;
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cp-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  white-space: nowrap;
}
.cp-empty {
  text-align: center;
  color: var(--text-3);
  padding: 24px !important;
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

.cp-drawer-hd {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.cp-drawer-title {
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cp-drawer-sub {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}

.cp-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 10px;
  background: var(--bg-2);
  border-radius: 8px;
  margin-bottom: 14px;
}
.cp-meta span {
  display: block;
  font-size: 10px;
  color: var(--text-3);
}
.cp-meta b {
  font-size: 12px;
  font-weight: 650;
}

.cp-kv { margin-bottom: 14px; }
.cp-kv-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.cp-kv-row span { color: var(--text-3); }
.cp-kv-row div { color: var(--text-1); line-height: 1.5; }

.cp-sec-title {
  font-size: 12px;
  font-weight: 650;
  margin: 12px 0 8px;
}
.cp-tables { margin-bottom: 8px; }
.cp-table-tag {
  margin: 0 6px 6px 0;
  cursor: pointer;
  border: none;
  font: inherit;
}

.cp-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 4px;
}
.cp-tl-item {
  display: flex;
  gap: 10px;
  position: relative;
  padding-bottom: 14px;
}
.cp-tl-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 1px;
  background: var(--border);
}
.cp-tl-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid var(--border-dark);
  background: #fff;
  margin-top: 2px;
  flex-shrink: 0;
  z-index: 1;
}
.cp-tl-item.done .cp-tl-dot {
  background: var(--success);
  border-color: var(--success);
}
.cp-tl-item.current .cp-tl-dot {
  background: var(--primary);
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}
.cp-tl-name {
  font-size: 12px;
  font-weight: 600;
}
.cp-tl-time {
  font-weight: 400;
  color: var(--text-3);
  margin-left: 6px;
  font-size: 11px;
}
.cp-tl-op {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}

.cp-drawer-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
</style>
