/**
 * 合规删除主台（对接 /lh/compliance）
 * API 失败：空列表 + lastError；空成功保持空态（不自动造工单，与申请中心一致）。
 */
import { computed, ref } from 'vue'
import {
  abortDelRequest,
  assessDelRequest,
  createDelRequest,
  downloadDelEvidence,
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
  revealDelSubjectPlain,
  scheduleDelRequest,
  submitDelRequest,
  upsertDelSubjectMap,
  verifyDelRequest,
} from '@/api/compliance'
import { DEL_STATUS_META } from '@/data/compliance'

const loading = ref(false)
const loaded = ref(false)
const lastError = ref(null)
const actionBusy = ref(false)
/** true = 接口失败（仅 UI 横幅，无假数据） */
const degraded = ref(false)

const summary = ref(null)
const coverage = ref(null)
const requests = ref([])
const pageInfo = ref({ current: 1, size: 20, total: 0 })
const detail = ref(null)
const evidence = ref(null)
const lastDryRun = ref(null)
const subjectMaps = ref([])

function n(v, d = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}

export function statusMeta(status) {
  return DEL_STATUS_META[status] || { label: status, cls: 'tag-gray' }
}

export function slaCls(level) {
  return level === 'overdue' ? 'tag-red' : level === 'warn' ? 'tag-orange' : 'tag-green'
}

async function applyBoard(filters = {}) {
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
  return page
}

export function useCompliance() {
  const kpis = computed(() => {
    const s = summary.value
    const cov = coverage.value || s?.coverage || {}
    return [
      {
        icon: '🗑️',
        color: 'red',
        value: String(s ? s.total : requests.value.length || '—'),
        unit: s || requests.value.length ? '单' : '',
        label: '删除请求',
        trend: `进行中 ${s ? s.open : '—'}`,
      },
      {
        icon: '⏳',
        color: 'orange',
        value: String(s?.pendingApproval ?? (s ? 0 : '—')),
        unit: s ? '单' : '',
        label: '待审批',
        trend: '安全岗 → 法务 → Owner',
        trendDown: n(s?.pendingApproval) > 0,
      },
      {
        icon: '⚡',
        color: 'blue',
        value: String(s?.executing ?? (s ? 0 : '—')),
        unit: s ? '单' : '',
        label: '待执行 / 执行中',
        trend: '维护窗口 02:00',
      },
      {
        icon: '🚫',
        color: 'purple',
        value: String(s?.restricted ?? (s ? 0 : '—')),
        unit: s ? '单' : '',
        label: '限制处理',
        trend: '个保法 §47 兜底',
      },
      {
        icon: '🔥',
        color: 'gray',
        value: String(s?.pendingDestroy ?? (s ? 0 : '—')),
        unit: s ? '单' : '',
        label: '待物理销毁',
        trend: `备份观察 ${s?.sla?.backupObserveDays ?? 30} 天`,
      },
      {
        icon: '🧭',
        color: n(cov.gapCount) > 0 ? 'orange' : 'green',
        value: String(cov.coveragePct ?? '—'),
        unit: cov.coveragePct != null ? '%' : '',
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
      await applyBoard(filters)
      degraded.value = false
      loaded.value = true
      return pageInfo.value
    } catch (e) {
      lastError.value = e
      console.error('[compliance] load failed', e)
      requests.value = []
      pageInfo.value = { current: 1, size: 20, total: 0 }
      summary.value = null
      coverage.value = null
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
      if (reqId) {
        detail.value = res && res.reqNo ? res : await fetchDelRequest(reqId)
      }
      if (reload) {
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

  /** 二次授权查看明文；不刷新列表（避免详情默认带回明文） */
  async function revealSubjectPlain({ reqId, confirmReqNo, reason } = {}) {
    actionBusy.value = true
    try {
      return await revealDelSubjectPlain({ reqId, confirmReqNo, reason })
    } finally {
      actionBusy.value = false
    }
  }

  /** 二次授权下载证据包 ZIP（base64）；写审计 */
  async function downloadEvidencePackage({ reqId, confirmReqNo, reason } = {}) {
    actionBusy.value = true
    try {
      return await downloadDelEvidence({ reqId, confirmReqNo, reason })
    } finally {
      actionBusy.value = false
    }
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
    revealSubjectPlain,
    downloadEvidencePackage,
    loadSubjectMaps,
    saveSubjectMap,
  }
}
