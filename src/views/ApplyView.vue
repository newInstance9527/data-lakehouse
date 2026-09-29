<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  APPLY_API_OPTIONS,
  APPLY_EXPIRE_OPTIONS,
  APPLY_METRIC_KINDS,
  APPLY_METRIC_SCOPES,
  APPLY_OPS_PRIVILEGES,
  APPLY_PERM_LEVELS,
  APPLY_PERM_MODES,
  APPLY_PUBLISH_ENVS,
  APPLY_TABLE_KINDS,
  APPLY_TABS,
  APPLY_TYPE_OPTIONS,
  applyTabMatches,
  buildApplyAssetOptions,
  buildApplyExportOptions,
  buildApplyMetricOptions,
  buildApplyReleaseOptions,
  issueApiCallToken,
  metricKindLabel,
  parseApiPathFromTicket,
  permModeLabel,
  tableKindLabel,
} from '@/data/apply'
import { createApplyTicket, approveTicket as apiApproveTicket, rejectTicket as apiRejectTicket, fetchApplyKpi } from '@/api/apply'
import { fetchDatasourcePage } from '@/api/datasource'
import { fetchDataapiApis, fetchDataapiDetail } from '@/api/dataapi'
import { fetchEtlDags } from '@/api/etl'
import { useApplyBoard, pushExportApply, approveExportOnBoard, hydrateApplyBoardFromServer } from '@/composables/useApplyBoard'
import { useMetrics } from '@/composables/useMetrics'
import { useAssets } from '@/composables/useAssets'
import { fetchReleases } from '@/api/compute'
import { useSession } from '@/composables/useSession'
import { useActionLock } from '@/composables/useActionLock'
import { OPS_RESOURCE_ENABLED, opsResourceLabel } from '@/data/opsResourceTypes'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { busy, run: runLocked } = useActionLock()
const guide = pageGuideOf('apply')
const { pending, mine } = useApplyBoard()

/** 服务端 KPI；失败时回落列表计数 */
const kpiRemote = ref(null)

const applyKpis = computed(() => {
  const remote = kpiRemote.value
  const pend = remote?.pending != null ? Number(remote.pending) : pending.value.length
  const my = remote?.mine != null ? Number(remote.mine) : mine.value.length
  const approved =
    remote?.monthApproved != null
      ? Number(remote.monthApproved)
      : mine.value.filter((m) => m.side === 'approved').length
  const rejected =
    remote?.monthRejected != null
      ? Number(remote.monthRejected)
      : mine.value.filter((m) => m.side === 'rejected').length
  const processing =
    remote?.minePending != null
      ? Number(remote.minePending)
      : mine.value.filter((m) => m.side === 'pending').length
  const metricHint =
    remote?.metricPending != null || remote?.metricMine != null
      ? `指标待审 ${Number(remote.metricPending) || 0} · 我的指标单 ${Number(remote.metricMine) || 0}`
      : ''
  return [
    {
      icon: '⏳',
      color: 'orange',
      label: '待我审批',
      value: String(pend),
      unit: '单',
      trend: pend ? `${pend} 单待处理` : '暂无待审',
      trendUp: false,
      trendWarn: pend > 0,
    },
    {
      icon: '📝',
      color: 'blue',
      label: '我申请的',
      value: String(my),
      unit: '单',
      trend: processing ? `${processing} 处理中` : metricHint || '已同步服务端',
      trendUp: processing > 0,
    },
    {
      icon: '✅',
      color: 'green',
      label: '本月通过',
      value: String(approved),
      unit: '单',
      trend: remote ? '按审批时间聚合' : '来自「我的申请」列表',
      trendUp: true,
    },
    {
      icon: '❌',
      color: 'red',
      label: '本月驳回',
      value: String(rejected),
      unit: '单',
      trend: remote ? '按审批时间聚合' : '来自「我的申请」列表',
      trendUp: false,
    },
  ]
})

async function refreshApplyKpi() {
  try {
    kpiRemote.value = await fetchApplyKpi({ ws: currentWs.value || 'default' })
  } catch {
    kpiRemote.value = null
  }
}

/** 刷新看板列表 + KPI */
async function syncApplyBoard() {
  await hydrateApplyBoardFromServer(currentWs.value || 'default').catch(() => false)
  await refreshApplyKpi()
}
const { catalog: metricCatalog, ensureLoaded: ensureMetricsLoaded } = useMetrics()
const { list: assetList, ensureLoaded: ensureAssetsLoaded } = useAssets()
const { currentWs } = useSession()
const assetsLive = ref(false)
const assetsLoadError = ref('')
const releaseHistory = ref([])

onMounted(async () => {
  await syncApplyBoard()
  const ticketQ = typeof route.query.ticket === 'string' ? route.query.ticket : ''
  if (ticketQ) {
    const hit =
      mine.value.find((m) => m.ticketNo === ticketQ || m.id === ticketQ) ||
      pending.value.find((m) => m.ticketNo === ticketQ || m.id === ticketQ)
    if (hit) openDetail(hit)
  }
  loadOpsResourceOptions()
  loadPublishedApiOptions()
  ensureMetricsLoaded()
  fetchReleases(currentWs.value || 'default')
    .then((list) => {
      const rows = Array.isArray(list) ? list : []
      releaseHistory.value = rows.map((r) => ({
        pkg: r.pkg || r.name || r.id,
        tag: r.tag || r.version || '—',
        env: r.env || r.targetEnv || '—',
        result: r.result || r.status || '—',
        time: r.publishedAt || r.updatedAt || r.createdAt || '',
      }))
    })
    .catch(() => {
      releaseHistory.value = []
    })
  try {
    await ensureAssetsLoaded()
    assetsLive.value = true
    assetsLoadError.value = ''
    if (!assetList.value.length) {
      showToast('资产目录暂无已登记表，请先在资产目录登记', 'warning')
    }
    // 资产到位后再按深链（含即席 fqn）补全选中项
    refillAssetFromRoute()
  } catch (e) {
    assetsLive.value = false
    assetsLoadError.value = e?.message || '资产列表加载失败'
    showToast('申请可选表加载失败：请确认已登录且资产目录可用', 'warning')
  }
})

watch(currentWs, () => {
  syncApplyBoard().catch(() => {})
})

const TYPE_LABEL = Object.fromEntries(APPLY_TYPE_OPTIONS.map((o) => [o.value, o.label]))
const SIDE_LABEL = { pending: '处理中', approved: '已通过', rejected: '已驳回' }
const METRIC_OPTIONS = computed(() => buildApplyMetricOptions(metricCatalog.value))
const ASSET_OPTIONS = computed(() => buildApplyAssetOptions(assetList.value))
const RELEASE_OPTIONS = computed(() => buildApplyReleaseOptions(releaseHistory.value))
const EXPORT_OPTIONS = computed(() => buildApplyExportOptions(assetList.value))
const SCOPE_LABEL = Object.fromEntries(APPLY_METRIC_SCOPES.map((o) => [o.value, o.label]))
const PERM_LEVEL_CLS = Object.fromEntries(APPLY_PERM_LEVELS.map((o) => [o.value, o.cls]))

function emptyForm() {
  return {
    type: 'perm',
    asset: '',
    assetCode: '',
    assetName: '',
    apiPath: APPLY_API_OPTIONS[0]?.value || '/api/gmv/daily',
    app: '',
    qps: 100,
    purpose: '',
    expire: '30天',
    metricKind: 'query',
    metricId: METRIC_OPTIONS.value[0]?.value || '',
    metricScope: 'dashboard',
    metricDomain: '交易域',
    metricNameNew: '',
    metricTypeNew: '衍生',
    caliberDiff: '',
    metricFromVer: '',
    metricToVer: '',
    permMode: 'read',
    permLevel: '内部',
    columns: '',
    tableKind: 'read',
    tableNameNew: '',
    releasePkg: RELEASE_OPTIONS.value[0]?.value || '',
    publishEnv: 'stg',
    rollbackPlan: '',
    exportTable: '',
    exportTarget: 'BI 报表',
    resourceType: 'asset',
    resourceId: '',
    resourceName: '',
    opsPrivilege: 'MANAGE',
  }
}

const activeTab = ref('all')
const creating = ref(false)
const showKpis = ref(false)
const form = ref(emptyForm())
const tokenModal = ref(null)
const rejectModal = ref(null) // { ticket, remark }
const rejectSubmitting = computed(() => busy('reject'))
const submitting = computed(() => busy('submit'))
const detailOpen = ref(false)
const detail = ref(null)
const apiPreview = ref(null)
const apiPreviewLoading = ref(false)
const apiPreviewError = ref('')
const tokenVisible = ref(false)
const opsDsOptions = ref([])
const opsEtlOptions = ref([])
/** 已发布 API（订阅下拉） */
const apiOptions = ref(APPLY_API_OPTIONS.map((o) => ({ ...o })))

async function loadPublishedApiOptions() {
  try {
    const list = await fetchDataapiApis({ state: 'published' })
    const rows = Array.isArray(list) ? list : list?.records || list?.data || []
    const mapped = rows
      .filter((a) => a && (a.path || a.publicPath))
      .map((a) => {
        const path = a.path || a.publicPath
        const method = (a.method || 'GET').toUpperCase()
        return {
          value: path,
          label: `${method} ${path}${a.name ? ` · ${a.name}` : ''}`,
          bindingId: a.id,
          method,
          name: a.name,
        }
      })
    if (mapped.length) {
      apiOptions.value = mapped
      if (!apiOptions.value.some((o) => o.value === form.value.apiPath)) {
        form.value.apiPath = mapped[0].value
      }
    }
  } catch {
    /* 保留下拉选项 */
  }
}

async function loadOpsResourceOptions() {
  try {
    const page = await fetchDatasourcePage({}, { current: 1, size: 200 })
    opsDsOptions.value = (page?.records || []).map((s) => {
      const ownerLabel = s.ownerName || s.owner || '—'
      return {
        value: s.id,
        label: s.name || s.dsCode || s.id,
        name: s.name || s.dsCode || s.id,
        sub: `${s.type || ''} · ${ownerLabel}`,
        type: s.type,
        owner: ownerLabel,
      }
    })
  } catch {
    opsDsOptions.value = []
  }
  try {
    const page = await fetchEtlDags({}, { current: 1, size: 200 })
    opsEtlOptions.value = (page?.records || []).map((d) => {
      const ownerLabel = d.ownerName || d.owner || '—'
      return {
        value: d.id,
        label: d.name || d.dagCode || d.id,
        name: d.name || d.dagCode || d.id,
        sub: `${d.dagCode || ''} · ${ownerLabel}`,
        dagCode: d.dagCode,
        owner: ownerLabel,
      }
    })
  } catch {
    opsEtlOptions.value = []
  }
}

function onOpsResourceTypeChange() {
  form.value.resourceId = ''
  form.value.resourceName = ''
}

function onOpsAssetPicked(id) {
  form.value.resourceId = id || ''
  form.value.asset = id || ''
  const opt = permAssetOptions.value.find((o) => o.value === id)
  form.value.resourceName = opt?.label || opt?.name || ''
  form.value.assetName = form.value.resourceName
}

function onOpsDsPicked(id) {
  form.value.resourceId = id || ''
  const opt = opsDsOptions.value.find((o) => o.value === id)
  form.value.resourceName = opt?.label || opt?.name || ''
}

function onOpsEtlPicked(id) {
  form.value.resourceId = id || ''
  const opt = opsEtlOptions.value.find((o) => o.value === id)
  form.value.resourceName = opt?.label || opt?.name || ''
}

const selectedMetric = computed(() => METRIC_OPTIONS.value.find((o) => o.value === form.value.metricId) || null)
const selectedAsset = computed(() => ASSET_OPTIONS.value.find((o) => o.value === form.value.asset) || null)
const selectedRelease = computed(() => RELEASE_OPTIONS.value.find((o) => o.value === form.value.releasePkg) || null)

/** 深链 / 即席带入：按 id、assetCode、fqn 末段匹配已登记资产 */
function resolveAssetPrefill(assetId, assetCode, fqn) {
  const opts = ASSET_OPTIONS.value
  if (assetId) {
    const byId = opts.find((o) => o.value === assetId)
    if (byId) {
      return { id: byId.value, code: byId.assetCode || assetCode, name: byId.name || byId.label }
    }
  }
  const codeHint = (assetCode || (fqn ? fqn.split('.').pop() : '') || '').trim()
  if (codeHint) {
    const byCode = opts.find(
      (o) =>
        o.assetCode === codeHint ||
        o.value === codeHint ||
        (fqn && (o.assetCode === fqn || String(o.label || '').includes(fqn))),
    )
    if (byCode) {
      return { id: byCode.value, code: byCode.assetCode || codeHint, name: byCode.name || byCode.label }
    }
  }
  if (fqn) {
    const byFqn = opts.find(
      (o) =>
        o.assetCode &&
        (fqn === o.assetCode || fqn.endsWith(`.${o.assetCode}`) || fqn.toLowerCase().endsWith(`.${String(o.assetCode).toLowerCase()}`)),
    )
    if (byFqn) {
      return { id: byFqn.value, code: byFqn.assetCode, name: byFqn.name || byFqn.label }
    }
  }
  return {
    id: assetId || '',
    code: assetCode || codeHint || '',
    name: '',
  }
}

/** 资产列表加载完成后，按路由参数回填申请表 */
function refillAssetFromRoute() {
  const q = route.query || {}
  const t = q.type
  if (t !== 'perm' && t !== 'table' && !(q.from === 'query' || q.privilege === 'SELECT')) {
    return
  }
  if (!creating.value && t !== 'perm' && t !== 'table') {
    return
  }
  const assetId = (typeof q.assetId === 'string' && q.assetId) || (typeof q.asset === 'string' && q.asset) || ''
  const assetCode = typeof q.assetCode === 'string' ? q.assetCode : ''
  const assetName = typeof q.name === 'string' ? q.name : ''
  const fqn = typeof q.fqn === 'string' ? q.fqn : ''
  if (!assetId && !assetCode && !fqn) return

  const resolved = resolveAssetPrefill(assetId, assetCode, fqn)
  if (!resolved.id && !resolved.code && !fqn) return

  creating.value = true
  if (form.value.type !== 'perm' && form.value.type !== 'table') {
    form.value.type = 'perm'
  }
  if (q.from === 'query' || q.privilege === 'SELECT') {
    form.value.type = 'perm'
    form.value.permMode = 'read'
    activeTab.value = 'perm'
  }
  if (resolved.id) form.value.asset = resolved.id
  else if (assetId) form.value.asset = assetId
  form.value.assetCode = resolved.code || assetCode || form.value.assetCode
  form.value.assetName = assetName || resolved.name || fqn || form.value.assetName
  if ((q.from === 'query' || q.privilege === 'SELECT') && !form.value.purpose) {
    form.value.purpose = `即席查询申请 SELECT · ${form.value.assetName || form.value.assetCode || fqn}`
  }
  if (form.value.type === 'perm' && selectedAsset.value) {
    form.value.permLevel = selectedAsset.value.level || form.value.permLevel
  }
}

/** 目录深链带来的真实资产 id，并入申请下拉 */
const permAssetOptions = computed(() => {
  const id = form.value.asset
  if (!id) return ASSET_OPTIONS.value
  if (ASSET_OPTIONS.value.some((o) => o.value === id)) return ASSET_OPTIONS.value
  return [
    {
      value: id,
      label: form.value.assetName || form.value.assetCode || id,
      name: form.value.assetName || form.value.assetCode || id,
      sub: form.value.assetCode || id,
      level: form.value.permLevel || '内部',
      owner: '—',
      domain: '',
      assetCode: form.value.assetCode || '',
    },
    ...ASSET_OPTIONS.value,
  ]
})

const showExpireField = computed(() => {
  if (form.value.type === 'publish' || form.value.type === 'api_publish') return false
  if (form.value.type === 'metric') return form.value.metricKind === 'query'
  if (form.value.type === 'table') return form.value.tableKind === 'read'
  return true
})

const pendingFiltered = computed(() => {
  const list = pending.value.filter((c) => applyTabMatches(c.type, activeTab.value))
  if (activeTab.value === 'all') return list.slice(0, 6)
  return list
})
const mineFiltered = computed(() =>
  mine.value.filter((c) => applyTabMatches(c.type, activeTab.value)),
)

watch(
  () => route.query.type,
  (t) => {
    if (t === 'api') {
      activeTab.value = 'api'
      creating.value = true
      loadPublishedApiOptions()
      const path = typeof route.query.path === 'string' ? route.query.path : ''
      form.value = {
        ...emptyForm(),
        type: 'api',
        app: '我的应用',
        apiPath: path || emptyForm().apiPath,
      }
    } else if (t === 'metric') {
      activeTab.value = 'metric'
      creating.value = true
      const mid = typeof route.query.metricId === 'string' ? route.query.metricId : ''
      form.value = {
        ...emptyForm(),
        type: 'metric',
        metricKind: typeof route.query.kind === 'string' ? route.query.kind : 'query',
        metricId: mid && METRIC_OPTIONS.value.some((o) => o.value === mid) ? mid : emptyForm().metricId,
      }
      syncMetricVersionDefaults()
    } else if (t === 'export') {
      activeTab.value = 'export'
      creating.value = true
      form.value = {
        ...emptyForm(),
        type: 'export',
        exportTable:
          (typeof route.query.table === 'string' && route.query.table) || emptyForm().exportTable,
        exportTarget:
          (typeof route.query.target === 'string' && route.query.target) || emptyForm().exportTarget,
        purpose: typeof route.query.purpose === 'string' ? route.query.purpose : '',
      }
    } else if (t === 'scan_elevate' || t === 'elevated' || t === 'scan_quota') {
      activeTab.value = 'scan_elevate'
      creating.value = true
      form.value = {
        ...emptyForm(),
        type: 'scan_elevate',
        purpose:
          (typeof route.query.purpose === 'string' && route.query.purpose) ||
          '即席查询需抬升扫描限额至平台硬顶 50GB',
        expire: typeof route.query.expire === 'string' ? route.query.expire : emptyForm().expire,
      }
    } else if (t === 'manage') {
      activeTab.value = 'ops'
      creating.value = true
      const resourceType =
        (typeof route.query.resourceType === 'string' && route.query.resourceType) || 'asset'
      const resourceId =
        (typeof route.query.resourceId === 'string' && route.query.resourceId) ||
        (typeof route.query.assetId === 'string' && route.query.assetId) ||
        ''
      const assetId =
        (typeof route.query.assetId === 'string' && route.query.assetId) ||
        (resourceType === 'asset' ? resourceId : '') ||
        ''
      const assetCode = typeof route.query.assetCode === 'string' ? route.query.assetCode : ''
      const assetName = typeof route.query.name === 'string' ? route.query.name : ''
      const privRaw =
        typeof route.query.privilege === 'string' ? route.query.privilege.toUpperCase() : 'MANAGE'
      const opsPrivilege = APPLY_OPS_PRIVILEGES.some((p) => p.value === privRaw) ? privRaw : 'MANAGE'
      const matched = assetId && ASSET_OPTIONS.value.some((o) => o.value === assetId)
      form.value = {
        ...emptyForm(),
        type: 'manage',
        resourceType,
        resourceId,
        resourceName: assetName,
        opsPrivilege,
        asset: matched
          ? assetId
          : assetId
            ? assetId
            : emptyForm().asset,
        assetCode,
        assetName,
        purpose: assetName
          ? `申请操作权限 · ${assetName}${assetCode ? `（${assetCode}）` : ''}`
          : resourceType === 'datasource'
            ? '申请数据源操作权限（改删/启停）'
            : resourceType === 'etl'
              ? '申请 ETL 任务操作权限（编辑/删除/发布）'
              : '申请资产操作权限（编辑/元数据写/删除）',
        expire: '30天',
      }
    } else if (t === 'perm' || t === 'table' || t === 'publish') {
      activeTab.value = t === 'table' && route.query.privilege === 'SELECT' ? 'perm' : t
      creating.value = true
      const assetId =
        (typeof route.query.assetId === 'string' && route.query.assetId) ||
        (typeof route.query.asset === 'string' && route.query.asset) ||
        ''
      const assetCode = typeof route.query.assetCode === 'string' ? route.query.assetCode : ''
      const assetName = typeof route.query.name === 'string' ? route.query.name : ''
      const fqn = typeof route.query.fqn === 'string' ? route.query.fqn : ''
      const fromQuery = route.query.from === 'query' || route.query.privilege === 'SELECT'
      const resolved = resolveAssetPrefill(assetId, assetCode, fqn)
      const type = fromQuery && (t === 'table' || t === 'perm') ? 'perm' : t
      form.value = {
        ...emptyForm(),
        type,
        permMode: type === 'perm' ? 'read' : emptyForm().permMode,
        asset: resolved.id || assetId || emptyForm().asset,
        assetCode: resolved.code || assetCode || (fqn ? fqn.split('.').pop() : ''),
        assetName: assetName || resolved.name || fqn || '',
        purpose:
          fromQuery && (assetName || fqn || resolved.name)
            ? `即席查询申请 SELECT · ${assetName || resolved.name || fqn}`
            : emptyForm().purpose,
      }
      if (type === 'perm' && selectedAsset.value) form.value.permLevel = selectedAsset.value.level || '内部'
    }
  },
  { immediate: true },
)

watch(
  () => route.query.tab,
  (tab) => {
    if (typeof tab === 'string' && APPLY_TABS.some((t) => t.id === tab)) {
      activeTab.value = tab
    }
  },
  { immediate: true },
)

watch(
  () => [form.value.type, form.value.metricKind, form.value.metricId],
  () => {
    if (form.value.type === 'metric') syncMetricVersionDefaults()
  },
)

watch(
  () => form.value.asset,
  () => {
    if (form.value.type === 'perm' && selectedAsset.value) {
      form.value.permLevel = selectedAsset.value.level || form.value.permLevel
    }
    const opt =
      selectedAsset.value ||
      permAssetOptions.value.find((o) => o.value === form.value.asset)
    if (opt && (form.value.type === 'perm' || form.value.type === 'table' || form.value.type === 'manage')) {
      form.value.assetName = opt.name || opt.label || form.value.assetName
      form.value.assetCode = opt.assetCode || form.value.assetCode
    }
    if (form.value.type === 'manage' && form.value.resourceType === 'asset') {
      form.value.resourceId = form.value.asset || ''
      if (opt) {
        form.value.resourceName = opt.label || opt.name || ''
        form.value.assetName = form.value.resourceName
      }
    }
  },
)

watch(
  () => form.value.type,
  (t) => {
    if (t === 'manage') activeTab.value = 'ops'
  },
)

function syncMetricVersionDefaults() {
  if (form.value.metricKind !== 'change') return
  const m = selectedMetric.value
  if (!m) return
  if (!form.value.metricFromVer) form.value.metricFromVer = m.ver || 'v1'
  if (!form.value.metricToVer) {
    const n = Number(String(m.ver || 'v1').replace(/\D/g, '')) || 1
    form.value.metricToVer = `v${n + 1}`
  }
}

function setTab(id) {
  activeTab.value = id
  const label = APPLY_TABS.find((t) => t.id === id)?.label || id
  showToast(`已切换至：${label.replace(/^[^\s]+\s/, '')}`, 'info')
}

function exportTickets() {
  showToast('📤 申请工单列表导出中 · CSV（工单号,类型,申请人、状态、创建时间）', 'success')
}

function toggleCreate() {
  creating.value = !creating.value
  if (creating.value) {
    form.value = emptyForm()
    if (['api', 'api_publish', 'metric', 'perm', 'table', 'publish', 'export', 'scan_elevate'].includes(activeTab.value)) {
      form.value.type = activeTab.value
    }
    if (form.value.type === 'metric') syncMetricVersionDefaults()
  }
}

function purposePlaceholder() {
  if (form.value.type === 'api') return '业务系统、调用场景、预估 QPS 与下游产物'
  if (form.value.type === 'api_publish') return '请从数据服务工作台发起「申请发布」'
  if (form.value.type === 'metric') {
    if (form.value.metricKind === 'change') return '请从指标中心发起「申请变更」'
    if (form.value.metricKind === 'create') return '请从指标中心保存草稿后发起「申请发布」'
    return '看板 / 即席 / API 引用场景与下游产物'
  }
  if (form.value.type === 'perm') return '业务背景、访问场景、是否含敏感字段'
  if (form.value.type === 'manage') return '申请操作权限事由：为何需改删该资源、使用期限'
  if (form.value.type === 'table') return '对账 / 分析 / 登记原因与下游消费方'
  if (form.value.type === 'export') return '出湖业务用途、下游系统、是否含 PII / 脱敏要求'
  if (form.value.type === 'scan_elevate') return '为何需超过默认 10GB 扫描限额、预估扫描量、业务紧急度'
  if (form.value.type === 'publish') return '变更说明、影响范围、验证结果'
  return '业务背景、分析/加工场景、下游产物'
}

async function submitApply() {
  await runLocked('submit', async () => {
  if (form.value.type === 'api_publish') {
    showToast('API 发布申请请到「数据服务 → 构建工作台」保存后发起', 'warning')
    router.push('/dataservice')
    return
  }
  if (form.value.type === 'metric' && (form.value.metricKind === 'create' || form.value.metricKind === 'change')) {
    showToast(
      form.value.metricKind === 'change'
        ? '口径变更发布请到「指标中心」对已启用指标点「申请变更」'
        : '指标发布请到「指标中心」新建并保存草稿后点「申请发布」',
      'warning',
    )
    router.push('/metrics')
    return
  }
  const purpose = form.value.purpose.trim()
  if (!purpose) {
    showToast('请填写使用用途', 'warning')
    return
  }
  if (form.value.type === 'api') {
    if (!form.value.app.trim() || !form.value.apiPath) {
      showToast('请填写应用名称并选择 API', 'warning')
      return
    }
  } else if (form.value.type === 'metric') {
    if (form.value.metricKind === 'query' && !form.value.metricId) {
      showToast('请选择要申请权限的指标', 'warning')
      return
    }
  } else if (form.value.type === 'perm') {
    if (!form.value.asset) {
      showToast('请选择申请资产', 'warning')
      return
    }
    if ((form.value.permMode === 'column' || form.value.permMode === 'plain') && !form.value.columns.trim()) {
      showToast('请填写申请列（逗号分隔）', 'warning')
      return
    }
    if (form.value.permMode === 'plain' && form.value.expire === '长期') {
      showToast('敏感列明文不可选长期，请缩短时效', 'warning')
      return
    }
  } else if (form.value.type === 'manage') {
    const rid = form.value.resourceId || (form.value.resourceType === 'asset' ? form.value.asset : '')
    if (!rid) {
      showToast('请指定资源 ID（可从资产目录/数据源/ETL 入口带入）', 'warning')
      return
    }
  } else if (form.value.type === 'table') {
    if (form.value.tableKind === 'register') {
      if (!form.value.tableNameNew.trim()) {
        showToast('请填写拟登记表名', 'warning')
        return
      }
    } else if (!form.value.asset) {
      showToast('请选择表', 'warning')
      return
    }
  } else if (form.value.type === 'publish') {
    if (!form.value.releasePkg) {
      showToast('请选择发布包', 'warning')
      return
    }
    if (form.value.publishEnv === 'prod' && !form.value.rollbackPlan.trim()) {
      showToast('发布到 prod 须填写回滚预案', 'warning')
      return
    }
  } else if (form.value.type === 'export') {
    if (!form.value.exportTable) {
      showToast('请选择出湖表', 'warning')
      return
    }
    if (!form.value.exportTarget?.trim()) {
      showToast('请填写目标系统', 'warning')
      return
    }
  } else if (form.value.type === 'scan_elevate') {
    // 平台级抬额，无需选资产
  } else if (!form.value.asset?.trim()) {
    showToast('请填写申请资产', 'warning')
    return
  }

  const id = `WF${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(100 + mine.value.length).padStart(5, '0')}`
  const typeLabel = APPLY_TYPE_OPTIONS.find((o) => o.value === form.value.type)?.label || '申请'
  const now = new Date().toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-')

  if (form.value.type === 'api') {
    const path = form.value.apiPath
    const app = form.value.app.trim()
    const hit = apiOptions.value.find((o) => o.value === path)
    try {
      const server = await createApplyTicket({
        ticketType: 'api_subscribe',
        title: `API 订阅 · ${app} · ${path}`,
        reason: purpose,
        consumerName: app,
        publicPath: path,
        method: hit?.method || 'GET',
        apiBindingId: hit?.bindingId || undefined,
        qps: form.value.qps || 100,
        expireLabel: form.value.expire,
      })
      showToast(
        `✅ 订阅申请已提交 ${server?.ticketNo || server?.id || ''}，审批通过后签发调用 Key`,
        'success',
        { duration: 8000 },
      )
      await syncApplyBoard()
      creating.value = false
      activeTab.value = 'api'
      return
    } catch (e) {
      showToast(e?.message || '订阅申请提交失败', 'danger')
      creating.value = false
      return
    }
  } else if (form.value.type === 'metric') {
    await submitMetricApply(id, now, purpose)
    creating.value = false
    return
  } else if (form.value.type === 'manage') {
    try {
      const resourceType = form.value.resourceType || 'asset'
      const resourceId =
        form.value.resourceId ||
        (resourceType === 'asset' ? form.value.asset : '') ||
        ''
      if (!resourceId) {
        showToast('请选择要申请操作权限的资源', 'warning')
        return
      }
      const nameHint =
        form.value.resourceName ||
        form.value.assetName ||
        form.value.name ||
        `${opsResourceLabel(resourceType)}:${resourceId}`
      const privilege = String(form.value.opsPrivilege || 'MANAGE').toUpperCase()
      const server = await createApplyTicket({
        ticketType: 'resource_manage',
        title: `操作权限 · ${nameHint}`,
        reason: purpose,
        assetId: resourceType === 'asset' ? resourceId : form.value.asset || null,
        resourceType,
        resourceId,
        privilege,
        expireLabel: form.value.expire,
      })
      showToast(
        `✅ 操作权限申请已提交 ${server?.ticketNo || server?.id || ''}，审批通过后写入 ${privilege} 授权`,
        'success',
        { duration: 8000 },
      )
      await syncApplyBoard()
    } catch (e) {
      showToast(e?.message || '操作权限申请提交失败', 'danger')
      return
    }
  } else if (form.value.type === 'perm') {
    try {
      const server = await createApplyTicket({
        ticketType: 'table_read',
        title: `表读权限 · ${form.value.assetName || form.value.assetCode || form.value.asset}`,
        reason: purpose,
        assetId: form.value.asset,
        privilege: form.value.permMode === 'read' ? 'SELECT' : form.value.permMode,
        expireLabel: form.value.expire,
        columns: form.value.columns.trim() || null,
      })
      const sid = server?.id || server?.ticketNo || id
      submitPermApply(sid, now, purpose, { fromServer: true, serverId: server?.id })
    } catch (e) {
      showToast(e?.message || '表读权限申请提交失败', 'danger')
      creating.value = false
      return
    }
  } else if (form.value.type === 'table') {
    showToast('建表/改表申请请走资产目录或工单 API', 'warning')
    creating.value = false
    return
  } else if (form.value.type === 'publish') {
    try {
      const pkg = form.value.releasePkg
      const env = form.value.publishEnv
      const server = await createApplyTicket({
        ticketType: 'script_publish',
        title: `脚本发布 · ${pkg} → ${env}`,
        reason: purpose,
        resourceId: selectedRelease.value?.id || pkg,
        resourceType: 'cp_release',
        publishEnv: env,
        rollbackPlan: form.value.rollbackPlan.trim(),
        expireLabel: form.value.expire,
      })
      showToast(
        `✅ 发布包申请已提交：${server?.ticketNo || server?.id || ''}，审批通过后到「环境与发布」点发布`,
        'success',
        { duration: 8000 },
      )
      await syncApplyBoard()
      activeTab.value = 'publish'
    } catch (e) {
      showToast(e?.message || '发布包申请失败', 'danger')
      creating.value = false
      return
    }
    creating.value = false
    return
  } else if (form.value.type === 'export') {
    try {
      const r = await pushExportApply({
        table: form.value.exportTable,
        purpose,
        target: form.value.exportTarget.trim(),
        expire: form.value.expire,
        applicant: '我',
      })
      showToast(
        `✅ 出湖申请已提交：${r.ticketNo} · 请在「待我审批」通过后，将单号填回 ETL ticketNo`,
        'success',
        { duration: 8000 },
      )
    } catch (e) {
      showToast(e?.message || '出湖申请提交失败', 'danger')
    }
    creating.value = false
    activeTab.value = 'export'
    return
  } else if (form.value.type === 'scan_elevate') {
    try {
      const server = await createApplyTicket({
        ticketType: 'scan_elevate',
        title: '扫描抬额 · 硬顶 50GB',
        reason: purpose,
        expireLabel: form.value.expire,
      })
      showToast(
        `✅ 扫描抬额已提交：${server?.ticketNo || server?.id || ''}，审批通过后可勾选 elevated`,
        'success',
        { duration: 8000 },
      )
      await syncApplyBoard()
      activeTab.value = 'scan_elevate'
    } catch (e) {
      showToast(e?.message || '扫描抬额申请失败', 'danger')
    }
    creating.value = false
    return
  } else {
    showToast(`不支持的申请类型：${form.value.type}`, 'warning')
    creating.value = false
    return
  }

  creating.value = false
  showToast(`✅ 申请已提交：${id}（${typeLabel}）已通知审批人`, 'success')
  })
}

async function submitMetricApply(id, now, purpose) {
  const kind = form.value.metricKind
  // create/change 已在 submitApply 拦截；此处仅 query，走真工单
  if (kind !== 'query') {
    showToast('指标发布/变更请到指标中心发起', 'warning')
    router.push('/metrics')
    return
  }
  const metricId = form.value.metricId
  const metricName = selectedMetric.value?.name || metricId
  try {
    const server = await createApplyTicket({
      ticketType: 'metric',
      title: `指标查询权限 · ${metricId} · ${metricName}`,
      reason: purpose,
      metricCode: metricId,
      metricKind: 'query',
      expireLabel: form.value.expire,
    })
    showToast(
      `✅ 指标查询权限申请已提交 ${server?.ticketNo || server?.id || ''}，审批通过后生效`,
      'success',
      { duration: 8000 },
    )
    await syncApplyBoard()
    activeTab.value = 'metric'
  } catch (e) {
    showToast(e?.message || '指标权限申请提交失败', 'danger')
  }
}

function submitPermApply(id, now, purpose, meta = {}) {
  const mode = form.value.permMode
  const asset = form.value.asset
  const level = form.value.permLevel
  const cols = form.value.columns.trim()
  const modeLabel = permModeLabel(mode)
  const levelCls = PERM_LEVEL_CLS[level] || 'tag-blue'
  const needSecurity = mode === 'plain' || level === '机密'
  const scope =
    mode === 'read' ? '全列只读' : cols ? `列：${cols}` : '指定列'
  const desc = `模式：${modeLabel} · ${scope} · 时效 ${form.value.expire} · ${purpose}`
  const base = {
    id,
    type: 'perm',
    side: 'pending',
    asset,
    permMode: mode,
    permLevel: level,
    columns: cols,
    expire: form.value.expire,
    purpose,
    applicant: '我',
    assetOwner: selectedAsset.value?.owner || '—',
    fromServer: Boolean(meta.fromServer),
    serverId: meta.serverId || (meta.fromServer ? id : null),
  }
  mine.value.unshift({
    ...base,
    titleHtml: `<span class="tag tag-orange">处理中</span> 我申请 ${asset} · ${modeLabel}`,
    time: now,
    desc,
    timeline: needSecurity
      ? [
          { label: '✓ 提交', cls: 'done' },
          { label: '● Owner 审批', cls: 'current' },
          { label: '安全加签', cls: '' },
          { label: '写入元数据目录', cls: '' },
        ]
      : [
          { label: '✓ 提交', cls: 'done' },
          { label: '● Owner 审批中', cls: 'current' },
          { label: '写入元数据目录', cls: '' },
        ],
  })
  pending.value.unshift({
    ...base,
    titleHtml: `<span class="tag ${levelCls}">${level}</span> 我 申请 ${asset} · ${modeLabel}`,
    statusTag: '待 Owner 审批',
    statusCls: 'tag-orange',
    desc,
    timeline: needSecurity
      ? [
          { label: '✓ 提交', cls: 'done' },
          { label: '● Owner 你', cls: 'current' },
          { label: '安全加签', cls: '' },
          { label: '写入元数据目录', cls: '' },
        ]
      : [
          { label: '✓ 提交', cls: 'done' },
          { label: '● Owner 你', cls: 'current' },
          { label: '写入元数据目录', cls: '' },
        ],
  })
}

function submitTableApply(id, now, purpose) {
  const kind = form.value.tableKind
  const kindLabel = tableKindLabel(kind)
  let asset = form.value.asset
  let titleCore = ''
  let desc = ''
  let statusTag = '待 Owner 审批'
  let timelinePending = []
  let timelineMine = []
  const base = {
    id,
    type: 'table',
    side: 'pending',
    tableKind: kind,
    purpose,
    applicant: '我',
    expire: form.value.expire,
    columns: form.value.columns.trim(),
  }

  if (kind === 'register') {
    asset = form.value.tableNameNew.trim()
    titleCore = `登记上架 ${asset}`
    desc = `新表登记 · ${purpose}`
    statusTag = '待平台登记'
    timelinePending = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 平台 Owner', cls: 'current' },
      { label: '元数据登记', cls: '' },
      { label: '资产目录可见', cls: '' },
    ]
    timelineMine = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 平台登记中', cls: 'current' },
      { label: '资产目录可见', cls: '' },
    ]
    Object.assign(base, { asset, tableNameNew: asset })
  } else if (kind === 'alter') {
    titleCore = `${asset} · 结构变更`
    desc = `变更：${form.value.columns.trim() || '见说明'} · ${purpose}`
    statusTag = '待 Owner + 平台'
    timelinePending = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● Owner 你', cls: 'current' },
      { label: '平台变更', cls: '' },
      { label: '元数据生效', cls: '' },
    ]
    timelineMine = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● Owner 审批中', cls: 'current' },
      { label: '元数据生效', cls: '' },
    ]
    Object.assign(base, { asset, assetOwner: selectedAsset.value?.owner })
  } else {
    titleCore = `${asset} · 只读`
    desc = `字段：${form.value.columns.trim() || '全列'} · 时效 ${form.value.expire} · ${purpose}`
    timelinePending = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● Owner 你', cls: 'current' },
      { label: '写入元数据目录', cls: '' },
    ]
    timelineMine = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● Owner 审批中', cls: 'current' },
      { label: '写入元数据目录', cls: '' },
    ]
    Object.assign(base, { asset, assetOwner: selectedAsset.value?.owner })
  }

  mine.value.unshift({
    ...base,
    titleHtml: `<span class="tag tag-orange">处理中</span> 我申请 ${titleCore}`,
    time: now,
    desc,
    timeline: timelineMine,
  })
  pending.value.unshift({
    ...base,
    titleHtml: `<span class="tag tag-blue">表</span> ${titleCore}`,
    statusTag,
    statusCls: 'tag-orange',
    desc,
    timeline: timelinePending,
  })
}

function submitPublishApply(id, now, purpose) {
  const pkg = form.value.releasePkg
  const tag = selectedRelease.value?.tag || ''
  const env = form.value.publishEnv
  const desc = `目标 ${env} · ${purpose} · 回滚：${form.value.rollbackPlan.trim() || '（stg 可后补）'}`
  const base = {
    id,
    type: 'publish',
    side: 'pending',
    releasePkg: pkg,
    releaseTag: tag,
    publishEnv: env,
    rollbackPlan: form.value.rollbackPlan.trim(),
    purpose,
    applicant: '我',
  }
  mine.value.unshift({
    ...base,
    titleHtml: `<span class="tag tag-orange">处理中</span> 我申请 ${pkg} → ${env}`,
    time: now,
    desc,
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 门禁检查', cls: 'current' },
      { label: `上线 ${env}`, cls: '' },
    ],
  })
  pending.value.unshift({
    ...base,
    titleHtml: `<span class="tag tag-purple">发布</span> ${pkg}${tag ? ` ${tag}` : ''} → ${env}`,
    statusTag: env === 'prod' ? '门禁检查中' : '待平台发布',
    statusCls: 'tag-orange',
    desc,
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 门禁检查', cls: 'current' },
      { label: `上线 ${env}`, cls: '' },
    ],
  })
}

async function approveTicket(id) {
  await runLocked(`approve:${id}`, async () => {
  const idx = pending.value.findIndex((w) => w.id === id)
  if (idx < 0) return
  const ticket = pending.value[idx]

  // perm / ops / publish / api(subscribe) / metric 均须打后端
  if (
    (ticket.type === 'perm' || ticket.type === 'ops' || ticket.type === 'publish' || ticket.type === 'api_publish' || ticket.type === 'api' || ticket.type === 'metric' || ticket.type === 'scan_elevate') &&
    (ticket.fromServer || ticket.serverId)
  ) {
    try {
      const res = await apiApproveTicket(ticket.serverId || ticket.id)
      if (res?.awaitingSecurity || res?.status === 'pending_security') {
        showToast(`✅ Owner 已签 ${ticket.ticketNo || id} · 待安全岗加签后生效`, 'success')
        await syncApplyBoard()
        return
      }
      const issued = res?.issuedKey || res?.data?.issuedKey
      if (ticket.type === 'api' && issued?.token) {
        const gw = issued.publicPath || ticket.apiPath || ''
        tokenModal.value = {
          ticketId: ticket.ticketNo || ticket.id,
          app: ticket.app || issued.appKey || '应用',
          apiPath: gw,
          qps: issued.qpsLimit || ticket.qps || 100,
          expire: ticket.expire || '—',
          issuedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
          token: issued.token,
          appKey: issued.appKey,
          header: 'Authorization: Bearer <token> · X-App-Key: ' + (issued.appKey || ''),
          curl: issued.curl || `curl -H "Authorization: Bearer ${issued.token}" "{gateway}${gw}"`,
        }
        showToast(`✅ 已签发调用 Key ${ticket.ticketNo || id} · 请立即复制保存`, 'success')
      } else {
        const tip =
          ticket.type === 'api_publish'
            ? res?.publishOk === false
              ? `✅ 已通过 ${ticket.ticketNo || id}，但自动发布未完全成功，请到工作台「手动补发」`
              : `✅ 已通过并自动发布 ${ticket.ticketNo || id} · 接口可调用`
            : ticket.type === 'metric'
              ? ticket.metricKind === 'query'
                ? `✅ 已通过 ${ticket.ticketNo || id} · 指标查询权限已登记`
                : res?.publishOk === false
                  ? `✅ 已通过 ${ticket.ticketNo || id}，但自动启用未完全成功，请到指标中心核对状态`
                  : `✅ 已通过并自动启用 ${ticket.ticketNo || id} · 指标可被引用`
            : ticket.type === 'publish'
            ? `✅ 已通过 ${ticket.ticketNo || id}`
            : ticket.type === 'api'
              ? `✅ 已通过 ${ticket.ticketNo || id} · Key 已写入（密文仅首次返回）`
              : `✅ 已通过 ${ticket.ticketNo || id} · 已写 sec_auth_grant（门户生效）`
        showToast(tip, 'success')
      }
      await syncApplyBoard()
      return
    } catch (e) {
      showToast(e?.message || '审批接口失败', 'danger')
      return
    }
  }

  if (ticket.type === 'ops') {
    pending.value.splice(idx, 1)
    const now = new Date().toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '-')
    const privilege = String(ticket.privilege || 'MANAGE').toUpperCase()
    const typeTag =
      ticket.resourceType === 'datasource'
        ? '数据源'
        : ticket.resourceType === 'etl'
          ? 'ETL'
          : ticket.resourceType === 'asset'
            ? '资产'
            : ticket.resourceType || '资源'
    const approved = {
      ...ticket,
      side: 'approved',
      titleHtml: `<span class="tag tag-green">已通过</span> ${typeTag}操作权 · ${ticket.asset || '—'}`,
      time: now,
      desc: `已写入 sec_auth_grant · privilege=${privilege}（门户生效）`,
      statusTag: `已授 ${privilege}`,
      statusCls: 'tag-green',
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ 审批', cls: 'done' },
        { label: `✓ ${privilege} 生效`, cls: 'done' },
      ],
    }
    mine.value.unshift(approved)
    const mineIdx = mine.value.findIndex((m, i) => i > 0 && m.id === ticket.id && m.side === 'pending')
    if (mineIdx > 0) mine.value.splice(mineIdx, 1)
    showToast(`✅ 已通过 ${id} · 已写 sec_auth_grant（门户生效）`, 'success')
    return
  }

  if (ticket.type === 'api') {
    const issued = issueApiCallToken({
      apiPath: parseApiPathFromTicket(ticket),
      app: ticket.app || '申请应用',
      expire: ticket.expire || '30天',
      qps: ticket.qps || 100,
    })
    pending.value.splice(idx, 1)
    const now = new Date().toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '-')
    mine.value.unshift({
      id: ticket.id,
      type: 'api',
      side: 'approved',
      titleHtml: `<span class="tag tag-green">已通过</span> ${ticket.app || '应用'} · ${issued.apiPath}`,
      time: now,
      desc: `Token 已签发 · 申请方 ${issued.qps} QPS · 时效 ${issued.expire} · 详情中可查看令牌`,
      apiPath: issued.apiPath,
      app: issued.app,
      qps: issued.qps,
      expire: issued.expire,
      purpose: ticket.desc || '',
      applicant: ticket.applicant || '—',
      token: issued.token,
      tokenMasked: issued.tokenMasked,
      tokenIssued: true,
      tokenIssuedAt: issued.issuedAt,
      header: issued.header,
      curl: issued.curl,
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ API Owner', cls: 'done' },
        { label: '✓ 令牌已签发', cls: 'done' },
        { label: '✓ Gateway 已生效', cls: 'done' },
      ],
    })
    // 同步更新「我的申请」里同号处理中单
    const mineIdx = mine.value.findIndex((m, i) => i > 0 && m.id === ticket.id && m.side === 'pending')
    if (mineIdx > 0) mine.value.splice(mineIdx, 1)

    tokenModal.value = { ...issued, ticketId: ticket.id }
    showToast(`✅ 已通过 ${id} · 调用令牌已签发（可在详情中再次查看）`, 'success')
    return
  }

  if (ticket.type === 'metric') {
    // 仅服务端工单；metric 审批已在上方走 apiApproveTicket，此处不应再有本地假单
    pending.value.splice(idx, 1)
    const now = new Date().toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '-')
    const kind = ticket.metricKind || 'query'
    let title = ''
    let desc = ''
    let timeline = []
    let toastMsg = ''
    if (kind === 'create') {
      title = `${ticket.metricId || ''} ${ticket.metricName || ''} · 已启用`
      desc = `指标发布已通过并自动启用 · 可被报表/API 引用`
      timeline = [
        { label: '✓ 保存/申请发布', cls: 'done' },
        { label: '✓ 审核通过', cls: 'done' },
        { label: '✓ 自动启用', cls: 'done' },
        { label: '✓ 可引用', cls: 'done' },
      ]
      toastMsg = `✅ 已通过 ${id} · 指标已自动启用`
    } else if (kind === 'change') {
      title = `${ticket.metricId} ${ticket.metricName || ''} · 新版本已启用`
      desc = `口径变更已发布 · ${ticket.caliberDiff || ''}`
      timeline = [
        { label: '✓ 申请发布', cls: 'done' },
        { label: '✓ 审核通过', cls: 'done' },
        { label: '✓ 自动启用', cls: 'done' },
        { label: '✓ 已通知下游', cls: 'done' },
      ]
      toastMsg = `✅ 已通过 ${id} · 口径新版本已自动启用`
    } else {
      title = `${ticket.metricId} ${ticket.metricName || ''} · 查询权限`
      desc = `场景：${SCOPE_LABEL[ticket.metricScope] || ticket.metricScope || '—'} · 时效 ${ticket.expire || '—'} · 已登记授权`
      timeline = [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ 指标 Owner', cls: 'done' },
        { label: '✓ 已授权', cls: 'done' },
      ]
      toastMsg = `✅ 已通过 ${id} · 指标查询权限已登记`
    }
    mine.value.unshift({
      ...ticket,
      side: 'approved',
      titleHtml: `<span class="tag tag-green">已通过</span> ${title}`,
      time: now,
      desc,
      timeline,
    })
    const mineIdx = mine.value.findIndex((m, i) => i > 0 && m.id === ticket.id && m.side === 'pending')
    if (mineIdx > 0) mine.value.splice(mineIdx, 1)
    showToast(toastMsg, 'success')
    return
  }

  if (ticket.type === 'export') {
    pending.value.splice(idx, 1)
    try {
      const r = await approveExportOnBoard(ticket)
      const ticketNo = r?.ticketNo || ticket.ticketNo || ticket.id
      if (r?.awaitingSecurity) {
        showToast(`✅ Owner 已签 ${ticketNo} · 待安全岗加签后签发 EXP`, 'success', { duration: 8000 })
        await syncApplyBoard().catch(() => {})
        return
      }
      try {
        navigator.clipboard?.writeText?.(ticketNo)
      } catch {
        /* ignore */
      }
      showToast(
        `✅ 已通过出湖申请 ${ticketNo} · 单号已复制，可填回 ETL sink ticketNo`,
        'success',
        { duration: 8000 },
      )
    } catch (e) {
      pending.value.splice(idx, 0, ticket)
      showToast(e?.message || '出湖审批失败', 'danger')
    }
    return
  }

  if (ticket.type === 'perm' || ticket.type === 'table' || ticket.type === 'publish') {
    pending.value.splice(idx, 1)
    const now = new Date().toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '-')
    let title = ''
    let desc = ''
    let timeline = []
    let toastMsg = ''

    if (ticket.type === 'perm') {
      const modeLabel = permModeLabel(ticket.permMode)
      title = `${ticket.asset} · ${modeLabel}`
      desc = `已写入 sec_auth_grant（门户生效）· ${ticket.columns ? `列 ${ticket.columns} · ` : ''}时效 ${ticket.expire || '—'} · ${ticket.purpose || ''}`
      timeline = [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ Owner', cls: 'done' },
        ...(ticket.permMode === 'plain' || ticket.permLevel === '机密'
          ? [{ label: '✓ 安全加签', cls: 'done' }]
          : []),
        { label: '✓ sec_auth_grant', cls: 'done' },
      ]
      toastMsg = `✅ 已通过 ${id} · 已写 sec_auth_grant（门户生效）`
    } else if (ticket.type === 'table') {
      const kind = ticket.tableKind || 'read'
      if (kind === 'register') {
        title = `已登记 ${ticket.asset}`
        desc = `已写入资产目录 / 元数据 · ${ticket.purpose || ''}`
        timeline = [
          { label: '✓ 提交', cls: 'done' },
          { label: '✓ 平台登记', cls: 'done' },
          { label: '✓ 资产目录可见', cls: 'done' },
        ]
        toastMsg = `✅ 已通过 ${id} · 表已登记上架`
      } else if (kind === 'alter') {
        title = `${ticket.asset} · 结构变更已生效`
        desc = `${ticket.columns || ticket.purpose || ''} · 元数据已更新`
        timeline = [
          { label: '✓ 提交', cls: 'done' },
          { label: '✓ Owner', cls: 'done' },
          { label: '✓ 元数据生效', cls: 'done' },
        ]
        toastMsg = `✅ 已通过 ${id} · 表结构变更已生效`
      } else {
        title = `${ticket.asset} · 只读`
        desc = `已写入元数据目录 · 字段 ${ticket.columns || '全列'} · 时效 ${ticket.expire || '—'}`
        timeline = [
          { label: '✓ 提交', cls: 'done' },
          { label: '✓ Owner', cls: 'done' },
          { label: '✓ 元数据已授权', cls: 'done' },
        ]
        toastMsg = `✅ 已通过 ${id} · 表只读权限已授权`
      }
    } else {
      const env = ticket.publishEnv || 'stg'
      title = `${ticket.releasePkg} → ${env}`
      desc = `门禁通过 · 已上线 ${env} · 回滚：${ticket.rollbackPlan || '—'}`
      timeline = [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ 门禁通过', cls: 'done' },
        { label: `✓ 已上线 ${env}`, cls: 'done' },
      ]
      toastMsg = `✅ 已通过 ${id} · ${ticket.releasePkg} 已发布到 ${env}`
    }

    mine.value.unshift({
      ...ticket,
      side: 'approved',
      titleHtml: `<span class="tag tag-green">已通过</span> ${title}`,
      time: now,
      desc,
      timeline,
    })
    const mineIdx = mine.value.findIndex((m, i) => i > 0 && m.id === ticket.id && m.side === 'pending')
    if (mineIdx > 0) mine.value.splice(mineIdx, 1)
    showToast(toastMsg, 'success')
    return
  }

  pending.value.splice(idx, 1)
  showToast(`✅ 已通过 ${id}`, 'success')
  })
}

function openRejectModal(id) {
  const ticket = pending.value.find((w) => w.id === id) || (detail.value?.id === id ? detail.value : null)
  if (!ticket || ticket.side === 'approved' || ticket.side === 'rejected') return
  rejectModal.value = {
    ticket,
    remark:
      ticket.type === 'api_publish'
        ? ''
        : '',
  }
}

function closeRejectModal() {
  if (busy('reject')) return
  rejectModal.value = null
}

async function confirmReject() {
  const modal = rejectModal.value
  if (!modal?.ticket) return
  const remark = String(modal.remark || '').trim()
  if (!remark) {
    showToast('请填写驳回意见', 'warning')
    return
  }
  if (remark.length < 2) {
    showToast('驳回意见过短，请说明需修改的内容', 'warning')
    return
  }
  await runLocked('reject', async () => {
    const ticket = modal.ticket
    const id = ticket.id
    try {
      if (ticket.fromServer || ticket.serverId) {
        await apiRejectTicket(ticket.serverId || ticket.id, remark)
        await syncApplyBoard()
        showToast(
          ticket.type === 'api_publish' || (ticket.type === 'metric' && ticket.metricKind !== 'query')
            ? `已退回重改 ${ticket.ticketNo || id} · 驳回意见已写入`
            : `已驳回 ${ticket.ticketNo || id} · 驳回意见已写入`,
          'warning',
        )
        rejectModal.value = null
        if (detail.value?.id === id) closeDetail()
        return
      }

      const idx = pending.value.findIndex((w) => w.id === id)
      if (idx >= 0) pending.value.splice(idx, 1)
      const mineIdx = mine.value.findIndex((m) => m.id === ticket.id && m.side === 'pending')
      if (mineIdx >= 0) {
        const now = new Date()
          .toLocaleString('zh-CN', {
            hour12: false,
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
          .replace(/\//g, '-')
        mine.value.splice(mineIdx, 1, {
          ...ticket,
          side: 'rejected',
          remark,
          titleHtml: `<span class="tag tag-red">已驳回</span> ${ticket.asset || ticket.apiPath || ticket.ticketNo || ticket.id}`,
          time: now,
          desc: `驳回意见：${remark} · 原单号 ${ticket.ticketNo || ticket.id}`,
          statusTag: '已驳回·请重改',
          statusCls: 'tag-red',
          timeline: [
            { label: '✓ 提交', cls: 'done' },
            { label: '✗ 已驳回', cls: 'done' },
            { label: '改后重提', cls: 'current' },
          ],
        })
      }
      showToast(`已驳回 ${id} · 驳回意见已记录`, 'warning')
      rejectModal.value = null
      if (detail.value?.id === id) closeDetail()
    } catch (e) {
      showToast(e?.message || '驳回失败', 'danger')
    }
  })
}

function rejectTicket(id) {
  openRejectModal(id)
}

function copyToken() {
  const t = tokenModal.value?.token || (tokenVisible.value ? detail.value?.token : '')
  if (!t) return
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).then(() => showToast('已复制令牌到剪贴板', 'success'))
  } else {
    showToast(t, 'info')
  }
}

function copyTicketNo(no) {
  if (!no) return
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(no).then(() => showToast(`已复制出湖单号 ${no}`, 'success'))
  } else {
    showToast(String(no), 'info')
  }
}

function copyDetailToken() {
  const t = detail.value?.token
  if (!t) {
    showToast('无可复制令牌', 'warning')
    return
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).then(() => showToast('已复制令牌到剪贴板', 'success'))
  } else {
    showToast(t, 'info')
  }
}

function closeTokenModal() {
  tokenModal.value = null
}

function openDetailFromTokenModal() {
  const tid = tokenModal.value?.ticketId
  const issued = tokenModal.value
  closeTokenModal()
  const found = mine.value.find((m) => m.id === tid && m.tokenIssued)
  if (found) {
    openDetail(found)
    return
  }
  if (issued) {
    openDetail({
      id: tid,
      type: 'api',
      side: 'approved',
      app: issued.app,
      apiPath: issued.apiPath,
      qps: issued.qps,
      expire: issued.expire,
      token: issued.token,
      tokenMasked: issued.tokenMasked,
      tokenIssued: true,
      tokenIssuedAt: issued.issuedAt,
      header: issued.header,
      curl: issued.curl,
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ API Owner', cls: 'done' },
        { label: '✓ 令牌已签发', cls: 'done' },
        { label: '✓ Gateway 已生效', cls: 'done' },
      ],
    })
  }
}

async function openDetail(w) {
  detail.value = w
  tokenVisible.value = false
  detailOpen.value = true
  apiPreview.value = null
  apiPreviewError.value = ''
  if (w?.type === 'api_publish') {
    await loadApiPublishPreview(w.apiBindingId)
  }
}

async function loadApiPublishPreview(bindingId) {
  if (!bindingId) return
  apiPreviewLoading.value = true
  apiPreviewError.value = ''
  try {
    const d = await fetchDataapiDetail(bindingId, true)
    if (!d) {
      apiPreviewError.value = '未找到绑定详情'
      return
    }
    const sr = d.sqlrest || {}
    const srData = sr.data && typeof sr.data === 'object' ? sr.data : sr
    let sqlText = d.sql || ''
    const sqlList = d.contextList || srData?.sqlList || d.sqlList
    if (!sqlText && Array.isArray(sqlList) && sqlList.length) {
      sqlText = sqlList
        .map((s) => (typeof s === 'string' ? s : s.sqlText || s.sql || ''))
        .filter(Boolean)
        .join('\n\n-- ---\n\n')
    } else if (Array.isArray(d.contextList) && d.contextList.length > 1) {
      sqlText = d.contextList.filter(Boolean).join('\n\n-- ---\n\n')
    }
    const script = d.script || srData?.script || ''
    const params = Array.isArray(d.params)
      ? d.params
      : Array.isArray(srData?.params)
        ? srData.params
        : []
    const outputs = Array.isArray(d.outputs)
      ? d.outputs
      : Array.isArray(d.responses)
        ? d.responses
        : Array.isArray(srData?.outputs)
          ? srData.outputs
          : []
    apiPreview.value = {
      id: d.id || bindingId,
      name: d.name || '—',
      method: d.method || 'GET',
      path: d.path || d.publicPath || '—',
      state: d.state || '—',
      engine: d.engine || srData?.engine || 'SQL',
      owner: d.owner || d.ownerUser || '—',
      domain: d.domain || d.domainCode || '—',
      desc: d.desc || d.description || d.remark || '',
      datasource: d.portalDsId || d.sqlrestDatasourceId || '—',
      sqlrestApiId: d.sqlrestApiId || '—',
      sql: sqlText,
      script,
      params,
      outputs,
      managerDeepLink: d.managerDeepLink || '',
    }
  } catch (e) {
    apiPreviewError.value = e?.message || String(e)
  } finally {
    apiPreviewLoading.value = false
  }
}

function closeDetail() {
  detailOpen.value = false
  tokenVisible.value = false
  apiPreview.value = null
  apiPreviewError.value = ''
}

function toggleTokenVisible() {
  if (!detail.value?.token) {
    showToast('该工单暂无令牌（未通过或非 API 申请）', 'warning')
    return
  }
  tokenVisible.value = !tokenVisible.value
}

function goMetricCenter(metricId) {
  router.push({ path: '/metrics', query: metricId && metricId !== '（待分配）' ? { q: metricId } : {} })
}

function goCatalog(asset) {
  if (!asset) return
  router.push({ path: '/catalog', query: { q: asset } })
}

function goPublishCenter(pkg) {
  router.push({ path: '/publish', query: pkg ? { q: pkg } : {} })
}

function goDataservice(path) {
  router.push({ path: '/dataservice', query: path ? { q: path } : {} })
}

function openExternal(url) {
  if (!url) return
  window.open(url, '_blank', 'noopener')
}

function approveBtnLabel(w) {
  if (w.awaitingSecurity) return '安全加签通过'
  if (w.requiresSecurityCosign && w.side === 'pending') return 'Owner 通过（待安全加签）'
  if (w.type === 'api') return '通过并签发调用 Key'
  if (w.type === 'api_publish') return '通过并自动发布'
  if (w.type === 'metric') {
    if (w.metricKind === 'change') return '通过并自动启用新版本'
    if (w.metricKind === 'create') return '通过并自动启用'
    return '通过并授权'
  }
  if (w.type === 'perm') return w.permMode === 'plain' || w.permLevel === '机密' ? '通过并加签授权' : '通过并授权'
  if (w.type === 'ops') return '通过并授权'
  if (w.type === 'table') {
    if (w.tableKind === 'register') return '通过并登记'
    if (w.tableKind === 'alter') return '通过并变更'
    return '通过并授权'
  }
  if (w.type === 'publish') {
    return `通过并上线 ${w.publishEnv || ''}`.trim()
  }
  if (w.type === 'export') return '通过并签发出湖单号'
  if (w.type === 'scan_elevate') return '通过并授予扫描抬额'
  return '通过'
}

function displayToken() {
  const w = detail.value
  if (!w?.token) return w?.tokenMasked || '—'
  return tokenVisible.value ? w.token : w.tokenMasked || `${String(w.token).slice(0, 8)}••••••••`
}
</script>

<template>
  <div class="apply-page">
    <PageHeader
      page-id="apply"
      title="申请中心"
      subtitle="权限 / 出湖 / 扫描抬额 / API 发布 / API 调用 / 指标 · 统一工单"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="exportTickets">📤 导出工单</button>
      <button type="button" class="btn btn-sm btn-primary" @click="toggleCreate">+ 新建申请</button>
    </PageHeader>

    <div class="ops-kpi-toggle">
      <button type="button" class="btn btn-sm" @click="showKpis = !showKpis">
        {{ showKpis ? '收起概览' : '展开概览 KPI' }}
      </button>
    </div>
    <div v-if="showKpis" class="kpi-grid apply-kpi">
      <div v-for="(k, i) in applyKpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-trend" :class="k.trendUp ? 'up' : k.trendWarn ? '' : 'down'">
          <span v-if="k.trendUp" class="arrow">↑</span>
          {{ k.trend }}
        </div>
      </div>
    </div>

    <div v-if="creating" class="card apply-form-card">
      <div class="card-header">
        <div class="card-title">+ 新建申请</div>
        <p v-if="assetsLoadError" class="tip" style="margin: 0 0 8px">
          可选表未加载：{{ assetsLoadError }}
        </p>
        <p v-else-if="assetsLive && !ASSET_OPTIONS.length" class="tip" style="margin: 0 0 8px">
          资产目录暂无已登记表 · 请先在
          <button type="button" class="btn-link" @click="router.push('/catalog')">资产目录</button>
          登记后再申请
        </p>
        <p v-else-if="assetsLive" class="tip" style="margin: 0 0 8px">
          可选表来自门户资产目录（{{ ASSET_OPTIONS.length }}）· 提交挂 gov_asset.id
        </p>
        <button type="button" class="btn btn-sm" @click="creating = false">取消</button>
      </div>
      <div class="card-body apply-form">
        <label>
          <span>申请类型</span>
          <select v-model="form.type" class="select">
            <option v-for="o in APPLY_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>

        <template v-if="form.type === 'api'">
          <label>
            <span>调用应用</span>
            <input v-model="form.app" class="input" placeholder="如 经营看板 BFF / 合作伙伴日报" />
          </label>
          <label>
            <span>申请 API</span>
            <select v-model="form.apiPath" class="select">
              <option v-for="o in apiOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
          <label>
            <span>申请方限流 (QPS)</span>
            <input v-model.number="form.qps" class="input" type="number" min="1" />
          </label>
        </template>

        <template v-else-if="form.type === 'metric'">
          <label class="wide">
            <span>申请场景</span>
            <div class="metric-kind-row">
              <button
                v-for="k in APPLY_METRIC_KINDS"
                :key="k.value"
                type="button"
                class="metric-kind-btn"
                :class="{ active: form.metricKind === k.value }"
                @click="form.metricKind = k.value"
              >
                <b>{{ k.label }}</b>
                <span>{{ k.tip }}</span>
              </button>
            </div>
          </label>

          <template v-if="form.metricKind === 'create' || form.metricKind === 'change'">
            <p class="apply-api-hint wide">
              <template v-if="form.metricKind === 'create'">
                <strong>指标发布</strong>：请到「指标中心」新建并保存草稿后点「申请发布」；审核通过后自动启用。本页只做审批与查看，不在此新建发布单。
              </template>
              <template v-else>
                <strong>口径变更发布</strong>：请到「指标中心」对已启用指标点「申请变更」；审核通过后自动启用新版本。本页只做审批与查看。
              </template>
            </p>
            <button type="button" class="btn btn-sm" @click="router.push('/metrics')">打开指标中心</button>
          </template>
          <template v-else>
            <label class="wide">
              <span>选择指标</span>
              <SearchSelect
                v-model="form.metricId"
                :options="METRIC_OPTIONS"
                placeholder="搜索已启用指标 ID / 名称"
                sub-key="sub"
                :search-keys="['name', 'caliber', 'type', 'value', 'owner']"
              />
            </label>
            <p v-if="selectedMetric" class="apply-metric-meta tip wide">
              口径：{{ selectedMetric.caliber || '—' }} · Owner {{ selectedMetric.owner || '—' }} · {{ selectedMetric.ver || '' }}
            </p>
            <label>
              <span>使用场景</span>
              <select v-model="form.metricScope" class="select">
                <option v-for="s in APPLY_METRIC_SCOPES" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </label>
          </template>
        </template>

        <template v-else-if="form.type === 'manage'">
          <label>
            <span>资源模块</span>
            <select v-model="form.resourceType" class="select" @change="onOpsResourceTypeChange">
              <option v-for="o in OPS_RESOURCE_ENABLED" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </label>
          <label v-if="form.resourceType === 'asset'" class="wide">
            <span>选择资产</span>
            <SearchSelect
              v-model="form.asset"
              :options="permAssetOptions"
              placeholder="搜索已登记表 / 资产"
              sub-key="sub"
              :search-keys="['name', 'level', 'owner', 'domain', 'value', 'assetCode']"
              @update:model-value="onOpsAssetPicked"
            />
          </label>
          <label v-else-if="form.resourceType === 'datasource'" class="wide">
            <span>选择数据源</span>
            <SearchSelect
              v-model="form.resourceId"
              :options="opsDsOptions"
              placeholder="搜索数据源"
              sub-key="sub"
              :search-keys="['name', 'type', 'owner', 'value']"
              @update:model-value="onOpsDsPicked"
            />
          </label>
          <label v-else-if="form.resourceType === 'etl'" class="wide">
            <span>选择 ETL 任务</span>
            <SearchSelect
              v-model="form.resourceId"
              :options="opsEtlOptions"
              placeholder="搜索 ETL 任务"
              sub-key="sub"
              :search-keys="['name', 'dagCode', 'owner', 'value']"
              @update:model-value="onOpsEtlPicked"
            />
          </label>
          <label class="wide">
            <span>权限范围</span>
            <div class="metric-kind-row">
              <button
                v-for="k in APPLY_OPS_PRIVILEGES"
                :key="k.value"
                type="button"
                class="metric-kind-btn"
                :class="{ active: form.opsPrivilege === k.value }"
                @click="form.opsPrivilege = k.value"
              >
                <b>{{ k.label }}</b>
                <span>{{ k.tip }}</span>
              </button>
            </div>
          </label>
          <p class="apply-api-hint">
            审批通过写入对应 privilege（EDIT|DELETE|MANAGE；MANAGE 覆盖改删），即可操作该
            {{ opsResourceLabel(form.resourceType) }}；与数据预览的「表读权限」相互独立。
          </p>
        </template>

        <template v-else-if="form.type === 'perm'">
          <label class="wide">
            <span>权限模式</span>
            <div class="metric-kind-row">
              <button
                v-for="k in APPLY_PERM_MODES"
                :key="k.value"
                type="button"
                class="metric-kind-btn"
                :class="{ active: form.permMode === k.value }"
                @click="form.permMode = k.value"
              >
                <b>{{ k.label }}</b>
                <span>{{ k.tip }}</span>
              </button>
            </div>
          </label>
          <label class="wide">
            <span>申请资产</span>
            <SearchSelect
              v-model="form.asset"
              :options="permAssetOptions"
              placeholder="搜索已登记表 / 资产"
              sub-key="sub"
              :search-keys="['name', 'level', 'owner', 'domain', 'value', 'assetCode']"
            />
            <span v-if="form.assetCode || form.assetName" class="muted" style="font-size: 11px; margin-top: 4px">
              来自资产目录：{{ form.assetName || form.assetCode }}
            </span>
            <span v-else-if="!ASSET_OPTIONS.length" class="muted" style="font-size: 11px; margin-top: 4px">
              暂无可选表
            </span>
          </label>
          <label>
            <span>密级</span>
            <select v-model="form.permLevel" class="select">
              <option v-for="l in APPLY_PERM_LEVELS" :key="l.value" :value="l.value">{{ l.label }}</option>
            </select>
          </label>
          <label v-if="form.permMode !== 'read'" class="wide">
            <span>申请列（逗号分隔）</span>
            <input v-model="form.columns" class="input" placeholder="如 user_id,mobile,dt" />
          </label>
        </template>

        <template v-else-if="form.type === 'table'">
          <label class="wide">
            <span>申请场景</span>
            <div class="metric-kind-row">
              <button
                v-for="k in APPLY_TABLE_KINDS"
                :key="k.value"
                type="button"
                class="metric-kind-btn"
                :class="{ active: form.tableKind === k.value }"
                @click="form.tableKind = k.value"
              >
                <b>{{ k.label }}</b>
                <span>{{ k.tip }}</span>
              </button>
            </div>
          </label>
          <label v-if="form.tableKind === 'register'" class="wide">
            <span>拟登记表名</span>
            <input v-model="form.tableNameNew" class="input" placeholder="如 dwd_trade.dwd_refund_detail" />
          </label>
          <label v-else class="wide">
            <span>选择表</span>
            <SearchSelect
              v-model="form.asset"
              :options="ASSET_OPTIONS"
              placeholder="搜索已登记资产表"
              sub-key="sub"
              :search-keys="['name', 'level', 'owner', 'domain', 'value', 'assetCode']"
            />
            <span v-if="!ASSET_OPTIONS.length" class="muted" style="font-size: 11px; margin-top: 4px">
              暂无可选表
            </span>
          </label>
          <label v-if="form.tableKind !== 'register'" class="wide">
            <span>{{ form.tableKind === 'alter' ? '变更说明 / 字段' : '字段范围（可空=全列）' }}</span>
            <input
              v-model="form.columns"
              class="input"
              :placeholder="form.tableKind === 'alter' ? '如 ADD COL refund_reason STRING' : '如 order_id,pay_amt,dt'"
            />
          </label>
        </template>

        <template v-else-if="form.type === 'publish'">
          <label class="wide">
            <span>发布包</span>
            <SearchSelect
              v-model="form.releasePkg"
              :options="RELEASE_OPTIONS"
              placeholder="搜索发布包 / tag"
              sub-key="sub"
              :search-keys="['value', 'tag', 'env', 'result']"
            />
          </label>
          <label>
            <span>目标环境</span>
            <select v-model="form.publishEnv" class="select">
              <option v-for="e in APPLY_PUBLISH_ENVS" :key="e.value" :value="e.value">{{ e.label }}</option>
            </select>
          </label>
          <label class="wide">
            <span>回滚预案{{ form.publishEnv === 'prod' ? '（必填）' : '' }}</span>
            <textarea
              v-model="form.rollbackPlan"
              class="input apply-textarea"
              placeholder="如：回滚至上一 Git tag · 调度作业切回"
            />
          </label>
        </template>

        <template v-else-if="form.type === 'export'">
          <label class="wide">
            <span>出湖表</span>
            <SearchSelect
              v-model="form.exportTable"
              :options="EXPORT_OPTIONS"
              placeholder="搜索 ADS / DWD / DWS 表"
              sub-key="sub"
              :search-keys="['name', 'layer', 'domain', 'value']"
            />
          </label>
          <label class="wide">
            <span>目标系统</span>
            <input v-model="form.exportTarget" class="input" placeholder="如 BI 报表 / MySQL marketing_prod / SFTP" />
          </label>
          <p class="tip wide" style="margin: 0">
            审批通过后签发 <b>EXP-xxx</b> 单号，填回 ETL 出湖节点 ticketNo；也可在
            <button type="button" class="btn-link" @click="router.push('/export')">出湖与回流</button>
            提交同等申请。
          </p>
        </template>

        <label :class="{ wide: ['api', 'api_publish', 'metric', 'perm', 'table', 'publish', 'export', 'scan_elevate'].includes(form.type) }">
          <span>使用用途</span>
          <textarea
            v-model="form.purpose"
            class="input apply-textarea"
            :placeholder="purposePlaceholder()"
          />
        </label>
        <label v-if="showExpireField">
          <span>{{ form.type === 'api' ? '令牌时效' : form.type === 'export' ? '出湖时效' : form.type === 'scan_elevate' ? '抬额时效' : form.type === 'publish' ? '发布窗口' : '权限时效' }}</span>
          <select v-model="form.expire" class="select">
            <option v-for="e in APPLY_EXPIRE_OPTIONS" :key="e" :value="e">{{ e }}</option>
          </select>
        </label>
        <p v-if="form.type === 'api'" class="apply-api-hint">
          <strong>API 调用申请</strong>：对已发布接口申请调用凭证。此处填写的是本应用的调用配额（签发 Key），不是接口全局上限。全局 QPS 在「构建 API」配置；审批通过后签发 Bearer / AppKey。
        </p>
        <p v-else-if="form.type === 'api_publish'" class="apply-api-hint">
          <strong>API 发布申请</strong>：请到「数据服务 → 构建工作台」保存后点「申请发布」；审核通过后自动上线。本页只做审批与查看，不在此新建发布单。
          <button type="button" class="btn-link" @click="router.push('/dataservice')">前往数据服务</button>
        </p>
        <p v-else-if="form.type === 'metric'" class="apply-api-hint">
          <template v-if="form.metricKind === 'query'">查询权限通过后登记授权，可供看板 / 即席 / API 引用已启用指标。</template>
          <template v-else-if="form.metricKind === 'change'">口径变更发布须从指标中心发起；通过后自动启用新版本。</template>
          <template v-else>指标发布须从指标中心保存草稿后发起；通过后自动启用。</template>
        </p>
        <p v-else-if="form.type === 'scan_elevate'" class="apply-api-hint">
          <strong>扫描抬额</strong>：审批通过后写入 <code>SCAN_ELEVATE</code> 授权；即席勾选「抬额至硬顶」才可将 session 扫描限额提至 50GB。默认可不经审批使用 10GB。
          <button type="button" class="btn-link" @click="router.push('/query')">返回即席</button>
        </p>
        <p v-else-if="form.type === 'perm'" class="apply-api-hint">
          表/列权限通过后写入元数据目录；敏感列明文需安全加签，且不可选「长期」。
        </p>
        <p v-else-if="form.type === 'table'" class="apply-api-hint">
          只读走表 ACL；登记上架写入资产目录；结构变更需 Owner + 平台确认后元数据生效。
        </p>
        <p v-else-if="form.type === 'publish'" class="apply-api-hint">
          <strong>发布包审批</strong>（脚本/ETL 上线，单号 SCR-）。提交发布申请后也可从「数据开发」一键创建发布单（自动开 MR + SCR）。API 上线请用「API 发布申请」。prod 须填回滚预案。
          <button type="button" class="btn-link" @click="router.push('/publish')">前往环境与发布</button>
        </p>
        <button
          v-if="form.type === 'api_publish'"
          type="button"
          class="btn btn-sm btn-primary"
          @click="router.push('/dataservice')"
        >
          前往构建工作台
        </button>
        <button
          v-else-if="form.type === 'metric' && (form.metricKind === 'create' || form.metricKind === 'change')"
          type="button"
          class="btn btn-sm btn-primary"
          @click="router.push('/metrics')"
        >
          前往指标中心
        </button>
        <button
          v-else
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="submitting"
          @click="submitApply"
        >
          {{ submitting ? '提交中…' : '提交申请' }}
        </button>
      </div>
    </div>

    <div class="std-tabs apply-tabs">
      <span
        v-for="t in APPLY_TABS"
        :key="t.id"
        class="std-tab"
        :class="{ active: activeTab === t.id }"
        @click="setTab(t.id)"
      >{{ t.label }}</span>
    </div>

    <div class="grid grid-2 apply-columns">
      <div class="card">
        <div class="card-header">
          <div class="card-title">⏳ 待审批工单 <span class="tip">（我是资产 Owner / 空间 Owner / 超管）</span></div>
          <span class="tag tag-orange">{{ pendingFiltered.length }} 单</span>
        </div>
        <div class="card-body">
          <div v-if="!pendingFiltered.length" class="apply-empty">当前分类无待审批工单</div>
          <div v-for="w in pendingFiltered" :key="w.id" class="workflow-card">
            <div class="wf-side" :class="w.side" />
            <div class="wf-content">
              <div class="wf-header">
                <div class="wf-title" v-html="w.titleHtml" />
                <span class="tag" :class="w.statusCls">{{ w.statusTag }}</span>
              </div>
              <div class="wf-desc">{{ w.desc }}</div>
              <div v-if="w.side === 'rejected' && w.remark" class="wf-reject-opin">
                <span class="wf-reject-label">驳回意见</span>
                {{ w.remark }}
              </div>
              <div class="wf-timeline">
                <template v-for="(node, ni) in w.timeline" :key="ni">
                  <span class="wf-node" :class="node.cls">{{ node.label }}</span>
                  <span v-if="ni < w.timeline.length - 1" class="wf-arrow">→</span>
                </template>
              </div>
              <div class="wf-actions">
                <button type="button" class="btn btn-sm" @click="openDetail(w)">详情</button>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  :disabled="busy('approve:' + w.id)"
                  @click="approveTicket(w.id)"
                >
                  {{ busy('approve:' + w.id) ? '处理中…' : approveBtnLabel(w) }}
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :disabled="busy('approve:' + w.id) || rejectSubmitting"
                  @click="rejectTicket(w.id)"
                >
                  驳回 / 退回重改
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="tabs apply-mine-tabs">
          <div class="tab active">我的申请</div>
          <div class="tab">已完成</div>
          <div class="tab">我抄送的</div>
        </div>
        <div class="card apply-mine-card">
          <div class="card-body">
            <div v-if="!mineFiltered.length" class="apply-empty">当前分类无我的申请</div>
            <div v-for="(w, wi) in mineFiltered" :key="w.id || wi" class="workflow-card">
              <div class="wf-side" :class="w.side" />
              <div class="wf-content">
                <div class="wf-header">
                  <div class="wf-title" v-html="w.titleHtml" />
                  <span v-if="w.time" class="apply-time">{{ w.time }}</span>
                </div>
                <div class="wf-desc">{{ w.desc }}</div>
                <div v-if="w.side === 'rejected' && w.remark" class="wf-reject-opin">
                  <span class="wf-reject-label">驳回意见</span>
                  {{ w.remark }}
                </div>
                <div v-if="w.tokenMasked" class="token-chip" @click="openDetail(w)">
                  <span>令牌</span>
                  <code class="token-chip-code" title="点击查看详情并显示明文">{{ w.tokenMasked }}</code>
                  <button type="button" class="btn btn-sm" @click.stop="openDetail(w)">详情查看</button>
                </div>
                <div class="wf-timeline">
                  <template v-for="(node, ni) in w.timeline" :key="ni">
                    <span class="wf-node" :class="node.cls">{{ node.label }}</span>
                    <span v-if="ni < w.timeline.length - 1" class="wf-arrow">→</span>
                  </template>
                </div>
                <div class="wf-actions">
                  <button type="button" class="btn btn-sm" @click="openDetail(w)">详情</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="tokenModal" class="modal-mask" @click.self="closeTokenModal">
        <div class="modal token-modal">
          <div class="modal-header">
            <div>
              <div class="modal-title">🔑 调用令牌已签发</div>
              <div class="modal-sub">工单 {{ tokenModal.ticketId }} · 请复制保存；之后可在申请详情中点击查看</div>
            </div>
            <button type="button" class="btn btn-sm" @click="closeTokenModal">✕</button>
          </div>
          <div class="modal-body">
            <div class="token-kv">
              <div><span>应用</span><code>{{ tokenModal.app }}</code></div>
              <div v-if="tokenModal.appKey"><span>AppKey</span><code>{{ tokenModal.appKey }}</code></div>
              <div><span>API</span><code>{{ tokenModal.apiPath }}</code></div>
              <div><span>申请方限流 / 时效</span><code>{{ tokenModal.qps }} QPS · {{ tokenModal.expire }}</code></div>
              <div><span>签发时间</span><code>{{ tokenModal.issuedAt }}</code></div>
            </div>
            <label class="token-field">
              <span>Bearer Token</span>
              <div class="token-row">
                <code class="token-raw">{{ tokenModal.token }}</code>
                <button type="button" class="btn btn-sm btn-primary" @click="copyToken">复制</button>
              </div>
            </label>
            <pre class="token-curl">{{ tokenModal.curl }}</pre>
            <p class="field-hint">请求头：{{ tokenModal.header }} · 亦可在工单「详情」中点击令牌再次查看明文。</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-sm" @click="openDetailFromTokenModal">打开详情</button>
            <button type="button" class="btn btn-sm btn-primary" @click="closeTokenModal">我已保存</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="rejectModal" class="modal-mask" @click.self="closeRejectModal">
        <div class="modal token-modal">
          <div class="modal-header">
            <div>
              <div class="modal-title">
                {{ rejectModal.ticket?.type === 'api_publish' ? '退回重改' : '驳回申请' }}
              </div>
              <div class="modal-sub">
                工单 {{ rejectModal.ticket?.ticketNo || rejectModal.ticket?.id }} · 请填写意见以便申请人修改
              </div>
            </div>
            <button type="button" class="btn btn-sm" :disabled="rejectSubmitting" @click="closeRejectModal">✕</button>
          </div>
          <div class="modal-body">
            <label class="token-field">
              <span>驳回意见（必填）</span>
              <textarea
                v-model="rejectModal.remark"
                class="input apply-textarea"
                rows="4"
                :placeholder="
                  rejectModal.ticket?.type === 'api_publish'
                    ? '说明需修改的内容，例如：SQL 未加 LIMIT、路径冲突、参数校验不足…'
                    : '说明驳回原因与修改建议'
                "
              />
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-sm" :disabled="rejectSubmitting" @click="closeRejectModal">取消</button>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="rejectSubmitting"
              @click="confirmReject"
            >
              {{ rejectSubmitting ? '提交中…' : rejectModal.ticket?.type === 'api_publish' ? '确认退回' : '确认驳回' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <AppDrawer
      :open="detailOpen"
      storage-key="apply-detail-width"
      :default-width="detail?.apiBindingId ? 640 : 520"
      @close="closeDetail"
    >
      <div v-if="detail" class="detail-drawer">
        <div class="detail-head">
          <div>
            <div class="detail-title">申请详情</div>
            <div class="tip">{{ detail.ticketNo || detail.id || '—' }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeDetail">✕</button>
        </div>

        <div class="detail-kv">
          <div><span>类型</span><div>{{ TYPE_LABEL[detail.type] || detail.type }}</div></div>
          <div>
            <span>状态</span>
            <div>
              <span
                class="tag"
                :class="detail.side === 'approved' ? 'tag-green' : detail.side === 'rejected' ? 'tag-red' : 'tag-orange'"
              >{{ SIDE_LABEL[detail.side] || detail.statusTag || detail.side }}</span>
            </div>
          </div>
          <div v-if="detail.time || detail.tokenIssuedAt"><span>时间</span><div>{{ detail.time || detail.tokenIssuedAt }}</div></div>
          <div v-if="detail.applicant"><span>申请人</span><div>{{ detail.applicant }}</div></div>
          <div v-if="detail.app"><span>调用应用</span><div>{{ detail.app }}</div></div>
          <div v-if="detail.method && detail.apiBindingId"><span>方法</span><div><code>{{ detail.method }}</code></div></div>
          <div v-if="detail.apiPath"><span>API</span><div><code>{{ detail.apiPath }}</code></div></div>
          <div v-if="detail.apiBindingId"><span>绑定 id</span><div><code>{{ detail.apiBindingId }}</code></div></div>
          <div v-if="detail.asset"><span>资产 / 表</span><div><code>{{ detail.asset }}</code></div></div>
          <div v-if="detail.type === 'export' && (detail.ticketNo || detail.id)">
            <span>出湖单号</span>
            <div>
              <code>{{ detail.ticketNo || detail.id }}</code>
              <button
                v-if="detail.side === 'approved'"
                type="button"
                class="btn btn-sm"
                style="margin-left: 8px"
                @click="copyTicketNo(detail.ticketNo || detail.id)"
              >复制</button>
            </div>
          </div>
          <div v-if="detail.type === 'export' && detail.target"><span>目标系统</span><div>{{ detail.target }}</div></div>
          <div v-if="detail.type === 'perm'"><span>权限模式</span><div>{{ permModeLabel(detail.permMode) }}</div></div>
          <div v-if="detail.permLevel">
            <span>密级</span>
            <div><span class="tag" :class="PERM_LEVEL_CLS[detail.permLevel] || 'tag-gray'">{{ detail.permLevel }}</span></div>
          </div>
          <div v-if="detail.columns" class="wide"><span>字段 / 列</span><div><code>{{ detail.columns }}</code></div></div>
          <div v-if="detail.type === 'table'"><span>表申请场景</span><div>{{ tableKindLabel(detail.tableKind) }}</div></div>
          <div v-if="detail.releasePkg"><span>发布包</span><div><code>{{ detail.releasePkg }}</code> {{ detail.releaseTag || '' }}</div></div>
          <div v-if="detail.publishEnv && detail.type === 'publish' && !detail.apiBindingId"><span>目标环境</span><div>{{ detail.publishEnv }}</div></div>
          <div v-if="detail.rollbackPlan" class="wide"><span>回滚预案</span><div>{{ detail.rollbackPlan }}</div></div>
          <div v-if="detail.assetOwner"><span>资产 Owner</span><div>{{ detail.assetOwner }}</div></div>
          <div v-if="detail.type === 'metric'"><span>申请场景</span><div>{{ metricKindLabel(detail.metricKind) }}</div></div>
          <div v-if="detail.metricId"><span>指标</span><div><code>{{ detail.metricId }}</code> {{ detail.metricName || '' }}</div></div>
          <div v-if="detail.metricScope"><span>使用场景</span><div>{{ SCOPE_LABEL[detail.metricScope] || detail.metricScope }}</div></div>
          <div v-if="detail.metricDomain"><span>业务域</span><div>{{ detail.metricDomain }}</div></div>
          <div v-if="detail.metricTypeNew"><span>拟建类型</span><div>{{ detail.metricTypeNew }}</div></div>
          <div v-if="detail.metricFromVer || detail.metricToVer">
            <span>版本</span>
            <div>{{ detail.metricFromVer || '—' }} → {{ detail.metricToVer || '—' }}</div>
          </div>
          <div v-if="detail.metricOwner"><span>指标 Owner</span><div>{{ detail.metricOwner }}</div></div>
          <div v-if="detail.metricCaliber" class="wide"><span>当前口径</span><div>{{ detail.metricCaliber }}</div></div>
          <div v-if="detail.caliberDiff" class="wide"><span>口径变更</span><div>{{ detail.caliberDiff }}</div></div>
          <div v-if="detail.qps != null"><span>申请方限流</span><div>{{ detail.qps }} QPS</div></div>
          <div v-if="detail.expire"><span>时效</span><div>{{ detail.expire }}</div></div>
          <div v-if="detail.purpose || detail.desc" class="wide"><span>用途 / 说明</span><div>{{ detail.purpose || detail.desc }}</div></div>
          <div v-if="detail.side === 'rejected' && detail.remark" class="wide">
            <span>驳回 / 退回原因</span>
            <div class="reject-remark">{{ detail.remark }}</div>
          </div>
        </div>

        <!-- 数据服务 API 发布：审核看待发布内容 -->
        <template v-if="detail.type === 'api_publish'">
          <div class="detail-sec-title">待发布 API 内容</div>
          <p v-if="apiPreviewLoading" class="tip">加载绑定详情…</p>
          <p v-else-if="apiPreviewError" class="tip apply-api-err">加载失败：{{ apiPreviewError }}</p>
          <div v-else-if="apiPreview" class="api-preview">
            <div class="detail-kv">
              <div><span>名称</span><div>{{ apiPreview.name }}</div></div>
              <div><span>状态</span><div><code>{{ apiPreview.state }}</code></div></div>
              <div><span>方法 / 路径</span><div><code>{{ apiPreview.method }} {{ apiPreview.path }}</code></div></div>
              <div><span>引擎</span><div>{{ apiPreview.engine }}</div></div>
              <div><span>负责人</span><div>{{ apiPreview.owner }}</div></div>
              <div><span>业务域</span><div>{{ apiPreview.domain }}</div></div>
              <div v-if="apiPreview.desc" class="wide"><span>描述</span><div>{{ apiPreview.desc }}</div></div>
              <div class="wide"><span>接口服务 id</span><div><code>{{ apiPreview.sqlrestApiId }}</code></div></div>
            </div>
            <div v-if="apiPreview.params?.length" class="api-preview-block">
              <div class="detail-sec-title">入参（{{ apiPreview.params.length }}）</div>
              <table class="table detail-table">
                <thead>
                  <tr><th>名</th><th>类型</th><th>必填</th><th>位置</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(p, i) in apiPreview.params" :key="'ap-' + i">
                    <td><code>{{ p.name }}</code></td>
                    <td>{{ p.type || '—' }}</td>
                    <td>{{ p.required ? '是' : '否' }}</td>
                    <td>{{ p.location || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="apiPreview.outputs?.length" class="api-preview-block">
              <div class="detail-sec-title">出参 / 映射（{{ apiPreview.outputs.length }}）</div>
              <table class="table detail-table">
                <thead>
                  <tr><th>源</th><th>名</th><th>类型</th><th>转换</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(o, i) in apiPreview.outputs" :key="'ao-' + i">
                    <td><code>{{ o.source || o.name || '—' }}</code></td>
                    <td><code>{{ o.name || '—' }}</code></td>
                    <td>{{ o.type || '—' }}</td>
                    <td>{{ o.transform || 'none' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="apiPreview.sql || apiPreview.script" class="api-preview-block">
              <div class="detail-sec-title">{{ apiPreview.engine === 'GROOVY' ? 'Groovy 脚本' : 'SQL' }}</div>
              <pre class="api-sql">{{ apiPreview.script || apiPreview.sql }}</pre>
            </div>
            <p v-else class="tip">暂无 SQL/脚本正文（可能尚未同步到接口服务）</p>
          </div>
        </template>

        <div v-if="detail.type === 'api' && detail.tokenIssued" class="detail-token-block">
          <div class="detail-sec-title">调用令牌</div>
          <div class="token-reveal-row">
            <code
              class="token-display"
              :class="{ revealed: tokenVisible }"
              title="点击显示 / 隐藏明文"
              @click="toggleTokenVisible"
            >{{ displayToken() }}</code>
            <button type="button" class="btn btn-sm" @click="toggleTokenVisible">
              {{ tokenVisible ? '隐藏' : '显示' }}
            </button>
            <button type="button" class="btn btn-sm btn-primary" :disabled="!detail.token" @click="copyDetailToken">
              复制
            </button>
          </div>
          <p class="tip">默认脱敏；点击令牌或「显示」查看明文。签发于 {{ detail.tokenIssuedAt || '—' }}</p>
          <pre v-if="detail.curl || detail.token" class="token-curl">{{ detail.curl || `curl -H "Authorization: Bearer ${detail.token}" "https://api.lakehouse.local${detail.apiPath || ''}"` }}</pre>
        </div>
        <div v-else-if="detail.type === 'api'" class="detail-token-block tip">
          通过审批后将在此签发并展示调用令牌。
        </div>

        <div v-if="detail.type === 'metric'" class="detail-actions-row">
          <button
            type="button"
            class="btn btn-sm"
            @click="goMetricCenter(detail.metricId)"
          >
            打开指标中心
          </button>
          <button
            v-if="detail.side === 'pending' && (detail.metricKind === 'create' || detail.metricKind === 'change')"
            type="button"
            class="btn btn-sm"
            @click="rejectTicket(detail.id)"
          >
            驳回 / 退回重改
          </button>
        </div>
        <div v-else-if="detail.asset && (detail.type === 'perm' || detail.type === 'table')" class="detail-actions-row">
          <button type="button" class="btn btn-sm" @click="goCatalog(detail.asset)">打开资产目录</button>
        </div>
        <div v-else-if="detail.type === 'api_publish'" class="detail-actions-row">
          <button type="button" class="btn btn-sm" @click="goDataservice(detail.apiPath)">打开数据服务</button>
          <button
            v-if="apiPreview?.managerDeepLink"
            type="button"
            class="btn btn-sm"
            @click="openExternal(apiPreview.managerDeepLink)"
          >
            在 Manager 打开
          </button>
          <button type="button" class="btn btn-sm" :disabled="apiPreviewLoading" @click="loadApiPublishPreview(detail.apiBindingId)">
            刷新 API 内容
          </button>
          <button
            v-if="detail.side === 'pending'"
            type="button"
            class="btn btn-sm"
            @click="rejectTicket(detail.id)"
          >
            驳回 / 退回重改
          </button>
        </div>
        <div v-else-if="detail.type === 'publish'" class="detail-actions-row">
          <button type="button" class="btn btn-sm" @click="goPublishCenter(detail.releasePkg)">打开发布中心</button>
        </div>

        <div class="detail-sec-title">流转记录</div>
        <div class="wf-timeline detail-tl">
          <template v-for="(node, ni) in detail.timeline || []" :key="ni">
            <span class="wf-node" :class="node.cls">{{ node.label }}</span>
            <span v-if="ni < (detail.timeline?.length || 0) - 1" class="wf-arrow">→</span>
          </template>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<style scoped>
.apply-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1000px) {
  .apply-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.apply-form-card {
  margin-bottom: 16px;
}

.apply-form {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 16px;
  align-items: end;
}
.apply-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
}
.apply-form label.wide {
  grid-column: 1 / -1;
}
.apply-form label span:first-child {
  font-weight: 500;
}
.apply-textarea {
  min-height: 64px;
  resize: vertical;
  font-family: inherit;
}
.apply-form .btn-primary {
  grid-column: 1 / -1;
  justify-self: start;
}
.apply-api-hint {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.5;
}
.apply-metric-meta {
  grid-column: 1 / -1;
  margin: -4px 0 0;
}
.btn-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--primary, #1e6fff);
  cursor: pointer;
  font-size: inherit;
  text-decoration: underline;
}
.btn-link:hover {
  opacity: 0.85;
}
.metric-kind-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.metric-kind-btn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-1, #fff);
  cursor: pointer;
  color: var(--text-2);
}
.metric-kind-btn b {
  font-size: 13px;
  color: var(--text);
}
.metric-kind-btn span {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.4;
}
.metric-kind-btn.active {
  border-color: var(--primary);
  background: var(--primary-light, #e6f4ff);
}
.detail-actions-row {
  display: flex;
  gap: 8px;
  margin: 12px 0 4px;
  flex-wrap: wrap;
}
@media (max-width: 720px) {
  .metric-kind-row {
    grid-template-columns: 1fr;
  }
}

.apply-tabs {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: 1px solid var(--border);
}
.apply-columns {
  gap: 16px;
  margin-top: 16px;
  grid-template-columns: 1fr 1fr;
}
.apply-mine-tabs {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-bottom: none;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  padding: 0 16px;
}
.apply-mine-card {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
.apply-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.apply-time {
  font-size: 11px;
  color: var(--text-3);
  flex-shrink: 0;
}

.workflow-card {
  display: flex;
  gap: 14px;
  margin-bottom: 10px;
  padding: 14px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 8px);
  transition: all 0.15s;
}
.workflow-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.wf-side {
  width: 4px;
  margin: -14px 0;
  border-radius: 3px;
  flex-shrink: 0;
}
.wf-side.pending {
  background: var(--warning);
}
.wf-side.approved {
  background: var(--success);
}
.wf-side.rejected {
  background: var(--danger);
}
.wf-content {
  flex: 1;
  min-width: 0;
}
.wf-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}
.wf-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--text-1);
  font-size: 13px;
  font-weight: 600;
}
.wf-title :deep(.tag) {
  font-weight: 500;
}
.wf-desc {
  color: var(--text-2);
  margin-bottom: 8px;
  font-size: 12px;
}
.wf-reject-opin {
  margin: 0 0 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--danger, #b45309);
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
  line-height: 1.45;
}
.wf-reject-label {
  display: inline-block;
  margin-right: 6px;
  font-weight: 600;
  color: #ad6800;
}
.wf-timeline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
  color: var(--text-3);
  font-size: 11px;
}
.wf-node {
  background: var(--bg-2);
  color: var(--text-2);
  border-radius: 10px;
  padding: 3px 8px;
}
.wf-node.done {
  background: var(--success-light, #f6ffed);
  color: var(--success);
}
.wf-node.current {
  background: var(--warning-light, #fff7e6);
  color: #d48806;
  font-weight: 600;
}
.wf-node.rejected {
  background: var(--danger-light, #fff2f0);
  color: var(--danger);
}
.wf-arrow {
  color: var(--text-4, var(--text-3));
}
.wf-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.token-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  font-size: 12px;
  cursor: pointer;
}
.token-chip-code {
  background: var(--bg-2);
  padding: 2px 8px;
  border-radius: 4px;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.token-chip code {
  background: var(--bg-2);
  padding: 2px 8px;
  border-radius: 4px;
}

.detail-drawer {
  padding: 16px 18px 24px;
  height: 100%;
  overflow: auto;
}
.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.detail-title {
  font-size: 16px;
  font-weight: 600;
}
.detail-kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  font-size: 13px;
  margin-bottom: 18px;
}
.detail-kv > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.detail-kv > div.wide {
  grid-column: 1 / -1;
}
.detail-kv span {
  color: var(--text-3);
  font-size: 12px;
}
.detail-kv code {
  font-size: 12px;
  word-break: break-all;
}
.detail-sec-title {
  font-size: 13px;
  font-weight: 600;
  margin: 8px 0 10px;
}
.api-preview {
  margin-bottom: 8px;
}
.api-preview-block {
  margin-top: 10px;
}
.api-sql {
  margin: 0;
  padding: 10px 12px;
  max-height: 280px;
  overflow: auto;
  font-size: 11px;
  line-height: 1.45;
  background: var(--bg-2, #f8fafc);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
.apply-api-err {
  color: var(--danger, #c0392b);
}
.reject-remark {
  color: var(--danger, #b45309);
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
}
.detail-token-block {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-2);
  border-radius: 8px;
}
.token-reveal-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.token-display {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-1, #fff);
  border: 1px dashed var(--border, #d9d9d9);
  border-radius: 6px;
  word-break: break-all;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}
.token-display.revealed {
  border-style: solid;
  user-select: text;
  cursor: text;
}
.detail-tl {
  flex-wrap: wrap;
}

.token-modal {
  width: min(560px, 94vw);
}
.token-kv {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 12px;
}
.token-kv > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.token-kv span {
  color: var(--text-3);
}
.token-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
}
.token-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.token-raw {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-2);
  border-radius: 6px;
  word-break: break-all;
  font-size: 12px;
}
.token-curl {
  margin-top: 12px;
  padding: 10px;
  background: var(--bg-2);
  border-radius: 6px;
  font-size: 11px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.field-hint {
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.5;
}
@media (max-width: 900px) {
  .apply-columns {
    grid-template-columns: 1fr;
  }
}
</style>
