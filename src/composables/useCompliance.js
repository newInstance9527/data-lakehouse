/**
 * 合规删除主台（对接 /lh/compliance）
 * 接口不可用时降级到 data/compliance.js 演示种子，页面结构保持不变。
 */
import { computed, ref } from 'vue'
import {
  abortDelRequest,
  assessDelRequest,
  createDelRequest,
  dryRunDelRequest,
  editDelPlan,
  executeDelRequest,
  fetchDelCoverage,
  fetchDelEvidence,
  fetchDelRequest,
  fetchDelRequests,
  fetchDelSubjectMaps,
  fetchDelSummary,
  holdDelRequest,
  releaseDelHold,
  restrictDelRequest,
  scheduleDelRequest,
  submitDelRequest,
  upsertDelSubjectMap,
  verifyDelRequest,
} from '@/api/compliance'
import { COMPLIANCE_TICKETS, DEL_STATUS_META } from '@/data/compliance'

const loading = ref(false)
const loaded = ref(false)
const lastError = ref(null)
const actionBusy = ref(false)
const degraded = ref(false)

const summary = ref(null)
const coverage = ref(null)
const requests = ref([])
const pageInfo = ref({ current: 1, size: 20, total: 0 })
const detail = ref(null)
const evidence = ref(null)
const lastDryRun = ref(null)
const subjectMaps = ref([])

const SEED_STATUS = {
  pending: 'pending_approval',
  ready: 'scheduled',
  done: 'done',
  archive: 'archived',
  rejected: 'rejected',
}

const SEED_TYPE = {
  被遗忘权: 'forget',
  错误数据擦除: 'erase_error',
  监管责令删除: 'regulator',
  合同到期清除: 'contract_expire',
}

function n(v, d = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}

/** 演示种子 → 新请求结构（仅在后端不可用时使用） */
function seedRequests() {
  return COMPLIANCE_TICKETS.map((t) => ({
    id: t.id,
    reqNo: t.id,
    status: SEED_STATUS[t.statusKey] || t.statusKey,
    statusLabel: t.status,
    subjectType: 'user',
    subjectMasked: t.subject,
    reqType: SEED_TYPE[t.type] || 'forget',
    reqTypeLabel: t.type,
    legalBasis: t.law,
    scopeLabel: t.scope,
    sourceSystem: t.applicant,
    ticketNo: null,
    deadline: t.deadline,
    createTime: t.createdAt,
    slaLevel: 'ok',
    planSummary: { total: (t.tables || []).length, included: (t.tables || []).length, done: 0, restricted: 0 },
    targets: (t.tables || []).map((tb, i) => ({
      id: `${t.id}-${i}`,
      carrier: 'iceberg',
      carrierLabel: '湖表 Iceberg',
      objectFqn: tb,
      mode: 'cow',
      modeLabel: 'Copy-on-Write DELETE',
      status: 'planned',
      statusLabel: '待执行',
      rowsEst: 0,
    })),
    timeline: (t.timeline || []).map((x) => ({
      step: x.name,
      status: x.status === 'done' ? 'success' : x.status === 'current' ? 'running' : 'queued',
      detail: x.opinion || '',
      at: x.time || '',
    })),
  }))
}

export function statusMeta(status) {
  return DEL_STATUS_META[status] || { label: status, cls: 'tag-gray' }
}

export function slaCls(level) {
  return level === 'overdue' ? 'tag-red' : level === 'warn' ? 'tag-orange' : 'tag-green'
}

export function useCompliance() {
  const kpis = computed(() => {
    const s = summary.value
    const cov = coverage.value || s?.coverage || {}
    return [
      {
        icon: '🗑️',
        color: 'red',
        value: String(s ? s.total : requests.value.length),
        unit: '单',
        label: '删除请求',
        trend: `进行中 ${s ? s.open : '—'}`,
      },
      {
        icon: '⏳',
        color: 'orange',
        value: String(s?.pendingApproval ?? 0),
        unit: '单',
        label: '待审批',
        trend: '安全岗 → 法务 → Owner',
        trendDown: n(s?.pendingApproval) > 0,
      },
      {
        icon: '⚡',
        color: 'blue',
        value: String(s?.executing ?? 0),
        unit: '单',
        label: '待执行 / 执行中',
        trend: '维护窗口 02:00',
      },
      {
        icon: '🚫',
        color: 'purple',
        value: String(s?.restricted ?? 0),
        unit: '单',
        label: '限制处理',
        trend: '个保法 §47 兜底',
      },
      {
        icon: '🔥',
        color: 'gray',
        value: String(s?.pendingDestroy ?? 0),
        unit: '单',
        label: '待物理销毁',
        trend: `备份观察 ${s?.sla?.backupObserveDays ?? 30} 天`,
      },
      {
        icon: '🧭',
        color: n(cov.gapCount) > 0 ? 'orange' : 'green',
        value: String(cov.coveragePct ?? '—'),
        unit: '%',
        label: '主体索引覆盖',
        trend: n(cov.gapCount) > 0 ? `${cov.gapCount} 张高敏表未登记` : '高敏资产已全覆盖',
        trendDown: n(cov.gapCount) > 0,
      },
    ]
  })

  const overdueCount = computed(() => n(summary.value?.overdue))
  const dueSoonCount = computed(() => n(summary.value?.dueSoon))

  async function loadBoard(filters = {}) {
    loading.value = true
    lastError.value = null
    try {
      const [sum, page, cov] = await Promise.all([
        fetchDelSummary(filters.ws),
        fetchDelRequests(filters),
        fetchDelCoverage(filters.ws).catch(() => null),
      ])
      summary.value = sum
      coverage.value = cov || sum?.coverage || null
      requests.value = page?.records || []
      pageInfo.value = {
        current: n(page?.current, 1),
        size: n(page?.size, 20),
        total: n(page?.total, requests.value.length),
      }
      degraded.value = false
      loaded.value = true
      return page
    } catch (e) {
      lastError.value = e
      console.error('[compliance] load failed', e)
      requests.value = seedRequests()
      pageInfo.value = { current: 1, size: 20, total: requests.value.length }
      summary.value = null
      degraded.value = true
      loaded.value = true
      throw e
    } finally {
      loading.value = false
    }
  }

  function ensureLoaded(filters = {}) {
    if (loaded.value || loading.value) return Promise.resolve()
    return loadBoard(filters).catch(() => {})
  }

  async function openDetail(reqId) {
    if (degraded.value) {
      detail.value = requests.value.find((r) => r.id === reqId || r.reqNo === reqId) || null
      evidence.value = null
      return detail.value
    }
    detail.value = await fetchDelRequest(reqId)
    evidence.value = null
    lastDryRun.value = null
    return detail.value
  }

  /** 动作统一出口：执行后刷新详情与看板 */
  async function run(fn, { reqId, reload = true } = {}) {
    actionBusy.value = true
    try {
      const res = await fn()
      if (reqId && !degraded.value) {
        detail.value = res && res.reqNo ? res : await fetchDelRequest(reqId)
      }
      if (reload && !degraded.value) {
        await loadBoard({ current: pageInfo.value.current, size: pageInfo.value.size }).catch(() => {})
      }
      return res
    } finally {
      actionBusy.value = false
    }
  }

  const create = (payload) => run(() => createDelRequest(payload))
  const assess = (reqId) => run(() => assessDelRequest(reqId), { reqId })
  const editPlan = (payload) => run(() => editDelPlan(payload), { reqId: payload.reqId })
  const submit = (reqId) => run(() => submitDelRequest(reqId), { reqId })
  const schedule = (reqId, execWindow) => run(() => scheduleDelRequest(reqId, execWindow), { reqId })
  const verify = (reqId) => run(() => verifyDelRequest(reqId), { reqId })
  const restrict = (payload) => run(() => restrictDelRequest(payload), { reqId: payload.reqId })
  const hold = (payload) => run(() => holdDelRequest(payload), { reqId: payload.reqId })
  const release = (payload) => run(() => releaseDelHold(payload), { reqId: payload.reqId })
  const abort = (payload) => run(() => abortDelRequest(payload), { reqId: payload.reqId })

  async function dryRun(reqId) {
    const res = await run(() => dryRunDelRequest(reqId), { reqId, reload: false })
    lastDryRun.value = res
    return res
  }

  function execute({ reqId, confirmReqNo, urgent } = {}) {
    return run(
      () => executeDelRequest({ reqId, confirmReqNo, urgent, execKey: `ui-${confirmReqNo}` }),
      { reqId },
    )
  }

  async function loadEvidence(reqId) {
    evidence.value = await fetchDelEvidence(reqId)
    return evidence.value
  }

  async function loadSubjectMaps(filters = {}) {
    subjectMaps.value = await fetchDelSubjectMaps(filters)
    return subjectMaps.value
  }

  async function saveSubjectMap(payload) {
    actionBusy.value = true
    try {
      const saved = await upsertDelSubjectMap(payload)
      const idx = subjectMaps.value.findIndex((m) => m.id === saved.id)
      if (idx >= 0) subjectMaps.value[idx] = saved
      else subjectMaps.value.unshift(saved)
      coverage.value = await fetchDelCoverage(payload.ws).catch(() => coverage.value)
      return saved
    } finally {
      actionBusy.value = false
    }
  }

  return {
    loading,
    loaded,
    lastError,
    actionBusy,
    degraded,
    summary,
    coverage,
    requests,
    pageInfo,
    detail,
    evidence,
    lastDryRun,
    subjectMaps,
    kpis,
    overdueCount,
    dueSoonCount,
    ensureLoaded,
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
  }
}
