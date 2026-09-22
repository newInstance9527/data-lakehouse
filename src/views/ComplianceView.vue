<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { slaCls, statusMeta, useCompliance } from '@/composables/useCompliance'
import { COMPLIANCE_DELETE_FORM, SUBJECT_MAP_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  COMPLIANCE_STAGES,
  COMPLIANCE_STATUS_TABS,
  DEL_TARGET_STATUS_CLS,
} from '@/data/compliance'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('compliance')

const {
  loading,
  actionBusy,
  degraded,
  coverage,
  requests,
  detail,
  evidence,
  lastDryRun,
  subjectMaps,
  kpis,
  overdueCount,
  dueSoonCount,
  loadBoard,
  openDetail,
  create,
  assess,
  editPlan,
  dryRun,
  submit,
  schedule,
  execute,
  verify,
  restrict,
  hold,
  release,
  abort,
  loadEvidence,
  loadSubjectMaps,
  saveSubjectMap,
} = useCompliance()

const view = ref('requests')
const tab = ref('')
const query = ref('')
const createOpen = ref(false)
const mapOpen = ref(false)
const detailOpen = ref(false)
const drawerTab = ref('overview')

const confirmNo = ref('')
const excludeId = ref('')
const excludeReason = ref('')
const restrictReason = ref('法定保存期未届满')
const holdReason = ref('')
const abortReason = ref('')

const filtered = computed(() => {
  const s = query.value.trim().toLowerCase()
  if (!s) return requests.value
  return requests.value.filter(
    (r) =>
      String(r.reqNo || '').toLowerCase().includes(s) ||
      String(r.subjectMasked || '').toLowerCase().includes(s) ||
      String(r.sourceRef || '').toLowerCase().includes(s) ||
      String(r.ticketNo || '').toLowerCase().includes(s),
  )
})
const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filtered)

const targets = computed(() => detail.value?.targets || [])
const timeline = computed(() => detail.value?.timeline || [])
const plan = computed(() => detail.value?.planSummary || {})

const canAssess = computed(() => ['assessing', 'pending_approval', 'restricted'].includes(detail.value?.status))
const canSubmit = computed(
  () =>
    detail.value?.status === 'assessing' &&
    (plan.value.included || 0) > 0 &&
    !(plan.value.pendingConfirm > 0),
)
const canSchedule = computed(() => detail.value?.status === 'pending_approval' && detail.value?.ticketNo)
const canExecute = computed(() => ['scheduled', 'pending_approval', 'partial_failed'].includes(detail.value?.status))
const canVerify = computed(() => ['verifying', 'executing', 'partial_failed'].includes(detail.value?.status))

onMounted(() => reload())

watch(tab, () => {
  resetPage()
  reload()
})
watch(query, () => resetPage())

watch(
  () => route.query.create,
  (v) => {
    if (v === '1' || v === 'true') createOpen.value = true
  },
  { immediate: true },
)

watch(view, (v) => {
  if (v === 'maps' && !subjectMaps.value.length) {
    loadSubjectMaps().catch((e) => showToast(`主体索引加载失败：${e.message}`, 'warning'))
  }
})

watch(drawerTab, (t) => {
  if (t === 'evidence' && detail.value && !degraded.value) {
    loadEvidence(detail.value.id).catch((e) => showToast(`证据包读取失败：${e.message}`, 'warning'))
  }
})

async function reload() {
  try {
    await loadBoard({ status: tab.value || undefined, size: 200 })
  } catch {
    showToast('⚠ 合规删除接口不可用，已切换到演示数据', 'warning')
  }
}

function fmt(v) {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 16)
}

function targetCls(status) {
  return DEL_TARGET_STATUS_CLS[status] || 'tag-gray'
}

async function show(reqId) {
  try {
    await openDetail(reqId)
    drawerTab.value = 'overview'
    confirmNo.value = ''
    excludeId.value = ''
    detailOpen.value = true
  } catch (e) {
    showToast(`详情读取失败：${e.message}`, 'warning')
  }
}

async function guarded(fn, okMsg) {
  try {
    const res = await fn()
    if (okMsg) showToast(okMsg, 'success')
    return res
  } catch (e) {
    showToast(`✕ ${e.message}`, 'warning')
    return null
  }
}

async function onCreate(payload) {
  const res = await guarded(() => create(payload))
  if (!res) return
  createOpen.value = false
  if (route.query.create) router.replace({ path: '/compliance', query: {} })
  showToast(`✅ 已受理 ${res.reqNo} · 已按主体索引展开 ${res.planSummary?.total ?? 0} 个载体`, 'success')
  show(res.id)
}

async function onSaveMap(payload) {
  const saved = await guarded(() => saveSubjectMap(payload), '✅ 主体索引已登记')
  if (saved) mapOpen.value = false
}

function doAssess() {
  guarded(async () => {
    const r = await assess(detail.value.id)
    const pc = r?.planSummary?.pendingConfirm || 0
    showToast(
      pc > 0
        ? `🔍 已展开计划 · ${pc} 项推断血缘待确认`
        : `🔍 已重新展开删除计划（含 lineage.expand 下游）`,
      pc > 0 ? 'warning' : 'success',
    )
    return r
  })
}

function doConfirmLineage(t) {
  guarded(
    () => editPlan({ reqId: detail.value.id, confirmIds: [t.id] }),
    `✅ 已确认推断血缘 ${t.objectFqn}`,
  )
}

async function doDryRun() {
  const res = await guarded(() => dryRun(detail.value.id))
  if (res) showToast(`🧮 试算命中 ${res.rowsEstTotal} 行 · ${res.targets?.length ?? 0} 个载体`, 'success')
}

function doSubmit() {
  guarded(async () => {
    const r = await submit(detail.value.id)
    showToast(`📮 已提交审批 ${r.ticketNo}`, 'success')
    return r
  })
}

function doSchedule() {
  guarded(() => schedule(detail.value.id), '🕑 已排期到下一维护窗口')
}

async function doExecute() {
  if (confirmNo.value.trim() !== detail.value.reqNo) {
    showToast('请回填请求号确认后再执行', 'warning')
    return
  }
  const res = await guarded(() =>
    execute({ reqId: detail.value.id, confirmReqNo: confirmNo.value.trim() }),
  )
  if (res) {
    confirmNo.value = ''
    drawerTab.value = 'exec'
    showToast('⚡ 已执行：Iceberg 已合并并定向过期快照，进入验证', 'success')
  }
}

function doVerify() {
  guarded(() => verify(detail.value.id), '✅ 残留反查完成')
}

function doRestrict(targetIds) {
  if (!restrictReason.value.trim()) {
    showToast('限制处理须填写依据', 'warning')
    return
  }
  guarded(
    () => restrict({ reqId: detail.value.id, targetIds, reason: restrictReason.value.trim() }),
    '🚫 已转限制处理 · 撤 ACL + 强制脱敏 + 禁出湖/API/训练',
  )
}

function doExclude(t) {
  if (!excludeReason.value.trim()) {
    showToast('排除载体必须填写理由', 'warning')
    return
  }
  guarded(
    () => editPlan({ reqId: detail.value.id, excludeIds: [t.id], excludeReason: excludeReason.value.trim() }),
    `已排除 ${t.objectFqn}`,
  ).then(() => {
    excludeId.value = ''
    excludeReason.value = ''
  })
}

function doHold() {
  if (!holdReason.value.trim()) {
    showToast('冻结须填写原因', 'warning')
    return
  }
  guarded(() => hold({ reqId: detail.value.id, reason: holdReason.value.trim() }), '🔒 已冻结')
}

function doRelease() {
  guarded(() => release({ reqId: detail.value.id, reason: '冻结条件消失' }), '🔓 已解除冻结')
}

function doAbort() {
  if (!abortReason.value.trim()) {
    showToast('中止须填写原因', 'warning')
    return
  }
  guarded(() => abort({ reqId: detail.value.id, remark: abortReason.value.trim() }), '已中止请求')
}

function refreshEvidence() {
  guarded(() => loadEvidence(detail.value.id), '📦 证据包已刷新')
}

function goLineage(table) {
  router.push({ path: '/lineage', query: { q: table } })
}

function goLifecycle() {
  router.push('/lifecycle')
}

function goTicket(ticketNo) {
  router.push({ path: '/apply', query: { q: ticketNo } })
}

function exportList() {
  showToast('📤 导出合规删除台账 · CSV（请求号,主体掩码,类型,状态,截止日,审批单）', 'success')
}
</script>

<template>
  <div class="cp-page">
    <PageHeader
      title="合规删除 / 被遗忘权"
      subtitle="主体索引 · 载体矩阵 · Iceberg/CK 硬删序列 · 限制处理兜底 · 证据链"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="exportList">📤 导出</button>
      <button type="button" class="btn btn-sm" @click="goLifecycle">⏳ 生命周期</button>
      <button type="button" class="btn btn-sm btn-primary" @click="createOpen = true">＋ 受理请求</button>
    </PageHeader>

    <div v-if="degraded" class="cp-degraded">
      ⚠ 未连上 <code>/lh/compliance</code>，当前为演示数据，执行类操作不可用。
    </div>

    <CreateFormModal
      :open="createOpen"
      v-bind="COMPLIANCE_DELETE_FORM"
      @close="createOpen = false"
      @submit="onCreate"
    />
    <CreateFormModal
      :open="mapOpen"
      v-bind="SUBJECT_MAP_FORM"
      @close="mapOpen = false"
      @submit="onSaveMap"
    />

    <div class="kpi-grid cp-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="k.trendDown ? 'down' : 'up'">{{ k.trend }}</div>
      </div>
    </div>

    <div class="card cp-flow">
      <div class="card-header">
        <div class="card-title">
          执行序列
          <span class="tip">· 受理评估 → 审批 → 排期 → 执行 → 验证 → 归档销毁</span>
        </div>
        <div v-if="overdueCount || dueSoonCount" class="cp-sla-chips">
          <span v-if="overdueCount" class="tag tag-red">超期 {{ overdueCount }}</span>
          <span v-if="dueSoonCount" class="tag tag-orange">3 日内到期 {{ dueSoonCount }}</span>
        </div>
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
        ⚠ Iceberg 必须走完 <code>DELETE → rewrite_data_files → 定向 expire_snapshots → 孤儿收尾</code>：
        只做 DELETE 等于没删（旧快照仍可时间旅行读回）；只做 TTL 过期也不等于合规删除。
      </div>
    </div>

    <div class="cp-switch">
      <button type="button" class="cp-tab" :class="{ active: view === 'requests' }" @click="view = 'requests'">
        删除请求
      </button>
      <button type="button" class="cp-tab" :class="{ active: view === 'maps' }" @click="view = 'maps'">
        主体索引
        <span v-if="coverage?.gapCount" class="tag tag-orange">缺口 {{ coverage.gapCount }}</span>
      </button>
    </div>

    <!-- 请求台账 -->
    <div v-if="view === 'requests'" class="card cp-list-card">
      <div class="card-header cp-list-hd">
        <div class="card-title">请求台账 <span v-if="loading" class="tip">· 加载中…</span></div>
        <div class="cp-filters">
          <div class="cp-tabs">
            <button
              v-for="t in COMPLIANCE_STATUS_TABS"
              :key="t.id || 'all'"
              type="button"
              class="cp-tab"
              :class="{ active: tab === t.id }"
              @click="tab = t.id"
            >
              {{ t.label }}
            </button>
          </div>
          <input v-model="query" class="input input-sm cp-search" placeholder="搜请求号 / 主体 / 单号" />
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>请求号</th>
              <th>主体（掩码）</th>
              <th>类型</th>
              <th>范围</th>
              <th>计划载体</th>
              <th>审批单</th>
              <th>截止</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in paged" :key="r.id">
              <td>
                <button type="button" class="btn-link" @click="show(r.id)">
                  <code>{{ r.reqNo }}</code>
                </button>
              </td>
              <td><code class="cp-mask">{{ r.subjectMasked }}</code></td>
              <td>{{ r.reqTypeLabel }}</td>
              <td style="font-size: 12px">{{ r.scopeLabel }}</td>
              <td style="font-size: 12px">
                {{ r.planSummary?.included ?? 0 }} 项
                <span v-if="r.planSummary?.restricted" class="tag tag-orange">
                  限制 {{ r.planSummary.restricted }}
                </span>
              </td>
              <td style="font-size: 11px">
                <button v-if="r.ticketNo" type="button" class="btn-link" @click="goTicket(r.ticketNo)">
                  {{ r.ticketNo }}
                </button>
                <span v-else class="tip">未提交</span>
              </td>
              <td style="font-size: 12px">
                {{ fmt(r.deadline) }}
                <span class="tag" :class="slaCls(r.slaLevel)">
                  {{ r.daysLeft == null ? '—' : r.daysLeft < 0 ? `超期${-r.daysLeft}天` : `剩${r.daysLeft}天` }}
                </span>
              </td>
              <td><span class="tag" :class="statusMeta(r.status).cls">{{ r.statusLabel || statusMeta(r.status).label }}</span></td>
              <td class="cp-acts">
                <button type="button" class="btn-link" @click="show(r.id)">详情</button>
              </td>
            </tr>
            <tr v-if="!paged.length">
              <td colspan="9" class="cp-empty">暂无请求</td>
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

    <!-- 主体索引 -->
    <div v-else class="card cp-list-card">
      <div class="card-header cp-list-hd">
        <div class="card-title">
          主体索引
          <span class="tip">· 主体在哪些载体、经什么列可定位；没有索引就删不干净</span>
        </div>
        <div class="cp-filters">
          <span class="tag" :class="coverage?.gapCount ? 'tag-orange' : 'tag-green'">
            高敏覆盖 {{ coverage?.coveragePct ?? '—' }}%
          </span>
          <button type="button" class="btn btn-sm btn-primary" @click="mapOpen = true">＋ 登记</button>
        </div>
      </div>
      <div v-if="coverage?.gapTables?.length" class="cp-gap">
        未登记的高敏资产：
        <button
          v-for="g in coverage.gapTables"
          :key="g"
          type="button"
          class="tag tag-orange cp-table-tag"
          @click="goLineage(g)"
        >
          {{ g }}
        </button>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>主体类型</th>
              <th>载体</th>
              <th>对象</th>
              <th>定位</th>
              <th>执行方式</th>
              <th>范围模板</th>
              <th>负责人</th>
              <th>最近核验</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in subjectMaps" :key="m.id">
              <td><code>{{ m.subjectType }}</code></td>
              <td>{{ m.carrierLabel }}</td>
              <td>
                <button type="button" class="btn-link" @click="goLineage(m.objectFqn)">{{ m.objectFqn }}</button>
              </td>
              <td style="font-size: 11px">{{ m.idColumn || m.joinPath || '—' }}</td>
              <td style="font-size: 11px"><code>{{ m.deleteMode }}</code></td>
              <td style="font-size: 11px">{{ m.scopeTpl || '—' }}</td>
              <td style="font-size: 11px">{{ m.owner || '—' }}</td>
              <td style="font-size: 11px">{{ fmt(m.verifiedAt) }}</td>
            </tr>
            <tr v-if="!subjectMaps.length">
              <td colspan="8" class="cp-empty">暂无主体索引</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppDrawer
      :open="detailOpen"
      storage-key="compliance-drawer"
      :default-width="640"
      @close="detailOpen = false"
    >
      <div v-if="detail" class="drawer-body">
        <div class="cp-drawer-hd">
          <div>
            <div class="cp-drawer-title">
              {{ detail.reqNo }}
              <span class="tag" :class="statusMeta(detail.status).cls">
                {{ detail.statusLabel || statusMeta(detail.status).label }}
              </span>
            </div>
            <div class="cp-drawer-sub">
              {{ detail.reqTypeLabel }} · <code class="cp-mask">{{ detail.subjectMasked }}</code>
              <span class="tip"> · 明文仅在 Vault，库内只存 HMAC</span>
            </div>
          </div>
          <button type="button" class="btn btn-sm" @click="detailOpen = false">关闭</button>
        </div>

        <div class="cp-tabs cp-drawer-tabs">
          <button type="button" class="cp-tab" :class="{ active: drawerTab === 'overview' }" @click="drawerTab = 'overview'">概览</button>
          <button type="button" class="cp-tab" :class="{ active: drawerTab === 'plan' }" @click="drawerTab = 'plan'">
            计划 {{ plan.total ?? 0 }}
          </button>
          <button type="button" class="cp-tab" :class="{ active: drawerTab === 'exec' }" @click="drawerTab = 'exec'">执行</button>
          <button type="button" class="cp-tab" :class="{ active: drawerTab === 'evidence' }" @click="drawerTab = 'evidence'">证据</button>
          <button type="button" class="cp-tab" :class="{ active: drawerTab === 'fallback' }" @click="drawerTab = 'fallback'">兜底</button>
        </div>

        <!-- 概览 -->
        <div v-if="drawerTab === 'overview'">
          <div class="cp-meta">
            <div><span>申请人 / 来源</span><b>{{ detail.applicant || '—' }} · {{ detail.sourceSystem || '—' }}</b></div>
            <div><span>来源单号</span><b>{{ detail.sourceRef || '—' }}</b></div>
            <div><span>受理时间</span><b>{{ fmt(detail.createTime) }}</b></div>
            <div>
              <span>截止（SLA 15 工作日）</span>
              <b>
                {{ fmt(detail.deadline) }}
                <span class="tag" :class="slaCls(detail.slaLevel)">
                  {{ detail.daysLeft == null ? '—' : detail.daysLeft < 0 ? `超期${-detail.daysLeft}天` : `剩${detail.daysLeft}天` }}
                </span>
              </b>
            </div>
          </div>

          <div class="cp-kv">
            <div class="cp-kv-row"><span>法律依据</span><div>{{ detail.legalBasis || '—' }}</div></div>
            <div class="cp-kv-row"><span>删除范围</span><div>{{ detail.scopeLabel || '—' }}</div></div>
            <div class="cp-kv-row">
              <span>审批单</span>
              <div>
                <button v-if="detail.ticketNo" type="button" class="btn-link" @click="goTicket(detail.ticketNo)">
                  {{ detail.ticketNo }}
                </button>
                <span v-else class="tip">未提交（申请中心 compliance_delete）</span>
              </div>
            </div>
            <div class="cp-kv-row"><span>执行窗口</span><div>{{ fmt(detail.execWindow) }}</div></div>
            <div class="cp-kv-row"><span>执行 / 验证</span><div>{{ fmt(detail.executedAt) }} · {{ fmt(detail.verifiedAt) }}</div></div>
            <div v-if="detail.destroyAfter" class="cp-kv-row">
              <span>备份销毁到期</span><div>{{ fmt(detail.destroyAfter) }}</div>
            </div>
            <div v-if="detail.holdReason" class="cp-kv-row">
              <span>冻结原因</span><div class="cp-danger">{{ detail.holdReason }}</div>
            </div>
          </div>

          <div class="cp-plan-chips">
            <span class="tag tag-blue">计划 {{ plan.total ?? 0 }}</span>
            <span class="tag tag-green">已删 {{ plan.done ?? 0 }}</span>
            <span class="tag tag-orange">待处理 {{ plan.pending ?? 0 }}</span>
            <span class="tag tag-orange">限制处理 {{ plan.restricted ?? 0 }}</span>
            <span v-if="plan.pendingConfirm" class="tag tag-gray">推断待确认 {{ plan.pendingConfirm }}</span>
            <span class="tag tag-gray">预估 {{ plan.rowsEst ?? 0 }} 行</span>
          </div>

          <div class="cp-drawer-acts">
            <button v-if="canAssess" type="button" class="btn btn-sm" :disabled="actionBusy" @click="doAssess">🔍 重新评估</button>
            <button type="button" class="btn btn-sm" :disabled="actionBusy" @click="doDryRun">🧮 试算</button>
            <button
              v-if="detail?.status === 'assessing' && (plan.included || 0) > 0"
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="actionBusy || !canSubmit"
              :title="plan.pendingConfirm ? `尚 ${plan.pendingConfirm} 项推断血缘待确认` : ''"
              @click="doSubmit"
            >📮 提交审批</button>
            <button v-if="canSchedule" type="button" class="btn btn-sm btn-primary" :disabled="actionBusy" @click="doSchedule">🕑 排期</button>
            <button v-if="canVerify" type="button" class="btn btn-sm" :disabled="actionBusy" @click="doVerify">✅ 验证残留</button>
          </div>

          <div v-if="lastDryRun" class="cp-dryrun">
            <div class="cp-sec-title">试算结果</div>
            <div>命中 <b>{{ lastDryRun.rowsEstTotal }}</b> 行 / {{ lastDryRun.targets?.length ?? 0 }} 个载体</div>
            <div class="cp-warn">{{ lastDryRun.snapshotNotice }}</div>
          </div>
        </div>

        <!-- 计划（载体矩阵） -->
        <div v-else-if="drawerTab === 'plan'">
          <div v-if="plan.pendingConfirm" class="cp-warn">
            推断血缘 {{ plan.pendingConfirm }} 项标灰，须人工确认后才能提交审批。
          </div>
          <table class="table cp-mini">
            <thead>
              <tr>
                <th>载体</th>
                <th>对象</th>
                <th>血缘</th>
                <th>方式</th>
                <th>预估</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in targets"
                :key="t.id"
                :class="{ 'cp-row-inferred': t.needsConfirm }"
              >
                <td>{{ t.carrierLabel }}</td>
                <td>
                  <button type="button" class="btn-link" @click="goLineage(t.objectFqn)">{{ t.objectFqn }}</button>
                  <div v-if="t.scopeExpr" class="tip">{{ t.scopeExpr }}</div>
                  <div v-if="t.owner || t.sensitivity || t.lineageLayer" class="tip">
                    <span v-if="t.lineageLayer">{{ t.lineageLayer }}</span>
                    <span v-if="t.owner"> · {{ t.owner }}</span>
                    <span v-if="t.sensitivity"> · {{ t.sensitivity }}</span>
                    <span v-if="t.hasSubjectCol === false"> · 无主体列</span>
                    <span v-else-if="t.hasSubjectCol"> · 有主体列</span>
                  </div>
                </td>
                <td style="font-size: 11px">
                  <span
                    v-if="t.lineageConfidence"
                    class="tag"
                    :class="t.lineageConfidence === 'inferred' ? 'tag-gray' : 'tag-green'"
                  >{{ t.lineageConfidence }}</span>
                  <span v-else class="tip">索引</span>
                  <span v-if="t.lineageHop != null" class="tip"> hop {{ t.lineageHop }}</span>
                  <span v-if="t.lineageConfirmed" class="tag tag-green">已确认</span>
                </td>
                <td style="font-size: 11px">{{ t.modeLabel }}</td>
                <td style="font-size: 11px">
                  {{ t.rowsEst ?? 0 }}
                  <span v-if="t.rowsVerified != null" class="tag tag-green">残留 {{ t.rowsVerified }}</span>
                </td>
                <td>
                  <span class="tag" :class="targetCls(t.status)">{{ t.statusLabel }}</span>
                  <div v-if="t.excludeReason" class="tip">{{ t.excludeReason }}</div>
                </td>
                <td class="cp-acts">
                  <button
                    v-if="t.needsConfirm"
                    type="button"
                    class="btn-link"
                    :disabled="actionBusy"
                    @click="doConfirmLineage(t)"
                  >确认推断</button>
                  <button
                    v-if="!['done', 'excluded'].includes(t.status)"
                    type="button"
                    class="btn-link danger"
                    @click="excludeId = excludeId === t.id ? '' : t.id"
                  >排除</button>
                  <button
                    v-if="!['done', 'excluded', 'restricted'].includes(t.status)"
                    type="button"
                    class="btn-link"
                    @click="doRestrict([t.id])"
                  >限制</button>
                  <div v-if="excludeId === t.id" class="cp-inline-form">
                    <input v-model="excludeReason" class="input input-sm" placeholder="排除理由（必填）" />
                    <button type="button" class="btn btn-sm" :disabled="actionBusy" @click="doExclude(t)">确认排除</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!targets.length">
                <td colspan="7" class="cp-empty">计划为空，请先评估</td>
              </tr>
            </tbody>
          </table>
          <div v-if="detail.gapTables?.length" class="cp-warn">
            主体索引缺口：{{ detail.gapTables.join('、') }}
          </div>
        </div>

        <!-- 执行 -->
        <div v-else-if="drawerTab === 'exec'">
          <div class="cp-exec-box">
            <div class="cp-sec-title">执行（不可逆）</div>
            <div class="cp-warn">
              执行将按 源库 → 湖表 → CK → 回流 → 出湖 → 平台 → 备份 的顺序推进；
              涉及的 Iceberg 表会被定向 <code>expire_snapshots(retain_last=1)</code>，短期失去回滚窗口。
            </div>
            <div class="cp-inline-form">
              <input v-model="confirmNo" class="input input-sm" :placeholder="`回填 ${detail.reqNo} 确认`" />
              <button
                type="button"
                class="btn btn-sm btn-primary"
                :disabled="actionBusy || !canExecute"
                @click="doExecute"
              >⚡ 执行删除</button>
            </div>
          </div>

          <div class="cp-sec-title">执行与状态流水</div>
          <div class="cp-timeline">
            <div v-for="(n, i) in timeline" :key="n.id || i" class="cp-tl-item" :class="n.status === 'success' ? 'done' : n.status === 'queued' ? 'pending' : 'current'">
              <div class="cp-tl-dot" />
              <div class="cp-tl-body">
                <div class="cp-tl-name">
                  <code>{{ n.step }}</code>
                  <span class="cp-tl-time">{{ fmt(n.at) }} · {{ n.operator || '—' }}</span>
                </div>
                <div v-if="n.detail" class="cp-tl-op">{{ n.detail }}</div>
                <button v-if="n.runId" type="button" class="btn-link" @click="goLifecycle">
                  生命周期运行 {{ n.runId }}
                </button>
              </div>
            </div>
            <div v-if="!timeline.length" class="cp-empty">暂无流水</div>
          </div>
        </div>

        <!-- 证据 -->
        <div v-else-if="drawerTab === 'evidence'">
          <div class="cp-drawer-acts">
            <button type="button" class="btn btn-sm" :disabled="actionBusy" @click="refreshEvidence">📦 生成 / 刷新证据包</button>
          </div>
          <div v-if="evidence">
            <div class="cp-kv-row"><span>摘要 sha256</span><div><code>{{ evidence.sha256 }}</code></div></div>
            <div class="cp-kv-row"><span>归档路径</span><div><code>{{ evidence.objectPath }}</code></div></div>
            <div class="cp-sec-title">完备性检查</div>
            <div v-for="c in evidence.checklist" :key="c.name" class="cp-check">
              <span :class="c.ok ? 'ok' : 'miss'">{{ c.ok ? '✓' : '✕' }}</span>
              <b>{{ c.name }}</b>
              <span class="tip">{{ c.detail }}</span>
            </div>
            <div class="cp-sec-title">证据条目</div>
            <div v-for="(it, i) in evidence.package?.items || []" :key="i" class="cp-evi">
              <span class="tag tag-blue">{{ it.kind }}</span>
              <b>{{ it.title }}</b>
              <div class="tip">{{ it.content }}</div>
            </div>
          </div>
          <div v-else class="tip">点击上方按钮生成证据包快照。</div>
        </div>

        <!-- 兜底 -->
        <div v-else>
          <div class="cp-sec-title">限制处理（个保法 §47）</div>
          <div class="tip">
            删不掉或法定保存期未届满时：停止除存储与必要安全保护之外的处理 —— 撤 ACL + 强制脱敏 + 禁出湖 / 禁 API / 禁训练 + 到期复查。
          </div>
          <div class="cp-inline-form">
            <input v-model="restrictReason" class="input input-sm" placeholder="依据，如 法定保存期未届满" />
            <button type="button" class="btn btn-sm" :disabled="actionBusy" @click="doRestrict(null)">
              🚫 剩余载体转限制处理
            </button>
          </div>

          <div class="cp-sec-title">法务冻结</div>
          <div class="cp-inline-form">
            <input v-model="holdReason" class="input input-sm" placeholder="诉讼保全 / 监管调查 / 法定保存期" />
            <button type="button" class="btn btn-sm" :disabled="actionBusy" @click="doHold">🔒 冻结</button>
            <button type="button" class="btn btn-sm" :disabled="actionBusy" @click="doRelease">🔓 解除</button>
          </div>

          <div class="cp-sec-title">中止请求</div>
          <div class="cp-inline-form">
            <input v-model="abortReason" class="input input-sm" placeholder="中止原因（必填）" />
            <button
              type="button"
              class="btn btn-sm"
              style="color: var(--danger); border-color: var(--danger)"
              :disabled="actionBusy"
              @click="doAbort"
            >✕ 中止</button>
          </div>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<style scoped>
.cp-kpi {
  grid-template-columns: repeat(6, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1400px) {
  .cp-kpi { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .cp-kpi { grid-template-columns: repeat(2, 1fr); }
}

.tip {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
}

.cp-degraded {
  margin-bottom: 12px;
  padding: 8px 10px;
  background: var(--warning-light);
  color: var(--warning);
  border-radius: 6px;
  font-size: 12px;
}

.cp-flow { margin-bottom: 16px; }
.cp-sla-chips { display: flex; gap: 6px; margin-left: auto; }
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

.cp-switch {
  display: flex;
  gap: 4px;
  background: var(--bg-2);
  padding: 3px;
  border-radius: 8px;
  margin-bottom: 12px;
  width: fit-content;
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
.cp-drawer-tabs { margin-bottom: 14px; }
.cp-tab {
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-2);
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.cp-tab.active {
  background: #fff;
  color: var(--text-1);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.cp-search { width: 200px; }
.cp-mask { font-size: 11px; }

.cp-gap {
  padding: 8px 16px 0;
  font-size: 11px;
  color: var(--text-3);
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
  grid-template-columns: 96px 1fr;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.cp-kv-row span { color: var(--text-3); }
.cp-kv-row div { color: var(--text-1); line-height: 1.5; word-break: break-all; }
.cp-danger { color: var(--danger); }

.cp-plan-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.cp-row-inferred td {
  color: var(--text-3);
  background: color-mix(in srgb, var(--bg-2) 80%, transparent);
}
.cp-row-inferred .btn-link:not(.danger) {
  color: var(--text-2);
}

.cp-sec-title {
  font-size: 12px;
  font-weight: 650;
  margin: 12px 0 8px;
}
.cp-table-tag {
  margin: 0 6px 6px 0;
  cursor: pointer;
  border: none;
  font: inherit;
}

.cp-mini :deep(td),
.cp-mini :deep(th) { font-size: 12px; }

.cp-inline-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 8px 0 12px;
}
.cp-inline-form .input { flex: 1; min-width: 180px; }

.cp-exec-box {
  border: 1px solid var(--danger);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 14px;
}
.cp-warn {
  font-size: 11px;
  color: var(--warning);
  background: var(--warning-light);
  padding: 8px 10px;
  border-radius: 6px;
  margin: 8px 0;
}
.cp-dryrun { font-size: 12px; }

.cp-check {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
  padding: 4px 0;
}
.cp-check .ok { color: var(--success); }
.cp-check .miss { color: var(--danger); }
.cp-evi {
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
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
