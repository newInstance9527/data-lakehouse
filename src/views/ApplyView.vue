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
  APPLY_KPIS,
  APPLY_METRIC_DOMAINS,
  APPLY_METRIC_KINDS,
  APPLY_METRIC_SCOPES,
  APPLY_METRIC_TYPES,
  APPLY_OPS_PRIVILEGES,
  APPLY_PERM_LEVELS,
  APPLY_PERM_MODES,
  APPLY_PUBLISH_ENVS,
  APPLY_TABLE_KINDS,
  APPLY_TABS,
  APPLY_TYPE_OPTIONS,
  applyTabMatches,
  buildApplyAssetOptions,
  buildApplyMetricOptions,
  buildApplyReleaseOptions,
  issueApiCallToken,
  metricKindLabel,
  parseApiPathFromTicket,
  permModeLabel,
  tableKindLabel,
} from '@/data/apply'
import { createApplyTicket, approveTicket as apiApproveTicket, rejectTicket as apiRejectTicket } from '@/api/apply'
import { fetchDatasourcePage } from '@/api/datasource'
import { fetchEtlDags } from '@/api/etl'
import { useApplyBoard, pushExportApply, approveExportOnBoard, hydrateApplyBoardFromServer } from '@/composables/useApplyBoard'
import { useMetrics } from '@/composables/useMetrics'
import { EXPORT_TABLE_OPTIONS } from '@/data/createForms'
import { ASSET_DATA } from '@/data/assets'
import { PUBLISH_HISTORY } from '@/data/publish'
import { OPS_RESOURCE_ENABLED, opsResourceLabel } from '@/data/opsResourceTypes'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('apply')
const { pending, mine } = useApplyBoard()
const { catalog: metricCatalog, ensureLoaded: ensureMetricsLoaded } = useMetrics()

onMounted(() => {
  hydrateApplyBoardFromServer()
  loadOpsResourceOptions()
  ensureMetricsLoaded()
})

const TYPE_LABEL = Object.fromEntries(APPLY_TYPE_OPTIONS.map((o) => [o.value, o.label]))
const SIDE_LABEL = { pending: '处理中', approved: '已通过', rejected: '已驳回' }
const METRIC_OPTIONS = computed(() => buildApplyMetricOptions(metricCatalog.value))
const ASSET_OPTIONS = buildApplyAssetOptions(ASSET_DATA)
const RELEASE_OPTIONS = buildApplyReleaseOptions(PUBLISH_HISTORY)
const EXPORT_OPTIONS = EXPORT_TABLE_OPTIONS
const SCOPE_LABEL = Object.fromEntries(APPLY_METRIC_SCOPES.map((o) => [o.value, o.label]))
const PERM_LEVEL_CLS = Object.fromEntries(APPLY_PERM_LEVELS.map((o) => [o.value, o.cls]))

function emptyForm() {
  return {
    type: 'perm',
    asset: ASSET_OPTIONS[0]?.value || '',
    assetCode: '',
    assetName: '',
    apiPath: APPLY_API_OPTIONS[0]?.value || '/api/gmv/daily',
    app: '',
    qps: 100,
    purpose: '',
    expire: '30天',
    metricKind: 'query',
    metricId: METRIC_OPTIONS.value[0]?.value || 'M-0001',
    metricScope: 'dashboard',
    metricDomain: '交易域',
    metricNameNew: '',
    metricTypeNew: '衍生',
    caliberDiff: '',
    metricFromVer: '',
    metricToVer: '',
    permMode: 'read',
    permLevel: ASSET_OPTIONS[0]?.level || '内部',
    columns: '',
    tableKind: 'read',
    tableNameNew: '',
    releasePkg: RELEASE_OPTIONS[0]?.value || '',
    publishEnv: 'stg',
    rollbackPlan: '',
    exportTable: EXPORT_OPTIONS[0]?.value || '',
    exportTarget: 'BI 报表',
    resourceType: 'asset',
    resourceId: '',
    resourceName: '',
    opsPrivilege: 'MANAGE',
  }
}

const activeTab = ref('all')
const creating = ref(false)
const form = ref(emptyForm())
const tokenModal = ref(null)
const detailOpen = ref(false)
const detail = ref(null)
const tokenVisible = ref(false)
const opsDsOptions = ref([])
const opsEtlOptions = ref([])

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
const selectedAsset = computed(() => ASSET_OPTIONS.find((o) => o.value === form.value.asset) || null)
const selectedRelease = computed(() => RELEASE_OPTIONS.find((o) => o.value === form.value.releasePkg) || null)

/** 目录深链带来的真实资产 id，并入申请下拉 */
const permAssetOptions = computed(() => {
  const id = form.value.asset
  if (!id) return ASSET_OPTIONS
  if (ASSET_OPTIONS.some((o) => o.value === id)) return ASSET_OPTIONS
  return [
    {
      value: id,
      label: form.value.assetName || form.value.assetCode || id,
      name: form.value.assetName || form.value.assetCode || id,
      sub: form.value.assetCode || id,
      level: form.value.permLevel || '内部',
      owner: '—',
      domain: '',
    },
    ...ASSET_OPTIONS,
  ]
})

const showExpireField = computed(() => {
  if (form.value.type === 'publish') return false
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
      form.value = { ...emptyForm(), type: 'api', app: '我的应用' }
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
      const matched = assetId && ASSET_OPTIONS.some((o) => o.value === assetId)
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
      activeTab.value = t
      creating.value = true
      const assetId =
        (typeof route.query.assetId === 'string' && route.query.assetId) ||
        (typeof route.query.asset === 'string' && route.query.asset) ||
        ''
      const assetCode = typeof route.query.assetCode === 'string' ? route.query.assetCode : ''
      const assetName = typeof route.query.name === 'string' ? route.query.name : ''
      const matched = assetId && ASSET_OPTIONS.some((o) => o.value === assetId)
      form.value = {
        ...emptyForm(),
        type: t,
        asset: matched ? assetId : assetId || emptyForm().asset,
        assetCode,
        assetName: assetName || (matched ? ASSET_OPTIONS.find((o) => o.value === assetId)?.label : '') || '',
      }
      if (t === 'perm' && selectedAsset.value) form.value.permLevel = selectedAsset.value.level || '内部'
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
    if (form.value.type === 'manage' && form.value.resourceType === 'asset') {
      form.value.resourceId = form.value.asset || ''
      const opt = permAssetOptions.value.find((o) => o.value === form.value.asset)
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
    if (['api', 'metric', 'perm', 'table', 'publish', 'export'].includes(activeTab.value)) {
      form.value.type = activeTab.value
    }
    if (form.value.type === 'metric') syncMetricVersionDefaults()
  }
}

function purposePlaceholder() {
  if (form.value.type === 'api') return '业务系统、调用场景、预估 QPS 与下游产物'
  if (form.value.type === 'metric') {
    if (form.value.metricKind === 'change') return '变更背景、影响下游、回滚方案'
    if (form.value.metricKind === 'create') return '业务诉求、预期口径、消费方'
    return '看板 / 即席 / API 引用场景与下游产物'
  }
  if (form.value.type === 'perm') return '业务背景、访问场景、是否含敏感字段'
  if (form.value.type === 'manage') return '申请操作权限事由：为何需改删该资源、使用期限'
  if (form.value.type === 'table') return '对账 / 分析 / 登记原因与下游消费方'
  if (form.value.type === 'export') return '出湖业务用途、下游系统、是否含 PII / 脱敏要求'
  if (form.value.type === 'publish') return '变更说明、影响范围、验证结果'
  return '业务背景、分析/加工场景、下游产物'
}

async function submitApply() {
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
    if (form.value.metricKind === 'create') {
      if (!form.value.metricNameNew.trim()) {
        showToast('请填写拟新建指标名称', 'warning')
        return
      }
    } else if (!form.value.metricId) {
      showToast('请选择指标', 'warning')
      return
    }
    if (form.value.metricKind === 'change' && !form.value.caliberDiff.trim()) {
      showToast('请填写口径变更说明', 'warning')
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
    mine.value.unshift({
      id,
      type: 'api',
      side: 'pending',
      titleHtml: `<span class="tag tag-orange">处理中</span> 我申请 ${path} 调用权限`,
      time: now,
      desc: `应用：${app} · 申请方 ${form.value.qps} QPS · 时效 ${form.value.expire} · ${purpose}`,
      apiPath: path,
      app,
      qps: form.value.qps,
      expire: form.value.expire,
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: '● API Owner 审批中', cls: 'current' },
        { label: '签发令牌', cls: '' },
      ],
    })
    pending.value.unshift({
      id,
      type: 'api',
      side: 'pending',
      titleHtml: `<span class="tag tag-green">API</span> ${app} 申请 ${path} 调用权限`,
      statusTag: '待 API Owner',
      statusCls: 'tag-orange',
      desc: `应用：${app} · Token 鉴权 · 申请方 ${form.value.qps} QPS（受接口全局上限约束）· 时效 ${form.value.expire} · 用途：${purpose}`,
      apiPath: path,
      app,
      qps: form.value.qps,
      expire: form.value.expire,
      applicant: '我',
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: '● API Owner', cls: 'current' },
        { label: '签发令牌', cls: '' },
        { label: 'APISIX 生效', cls: '' },
      ],
    })
  } else if (form.value.type === 'metric') {
    submitMetricApply(id, now, purpose)
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
      await hydrateApplyBoardFromServer().catch(() => {})
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
      showToast(e?.message || '后端申请接口暂不可用，已落本地演示单', 'warning')
      submitPermApply(id, now, purpose)
    }
  } else if (form.value.type === 'table') {
    submitTableApply(id, now, purpose)
  } else if (form.value.type === 'publish') {
    submitPublishApply(id, now, purpose)
  } else if (form.value.type === 'export') {
    try {
      const r = await pushExportApply({
        table: form.value.exportTable,
        purpose,
        target: form.value.exportTarget.trim(),
        expire: form.value.expire,
        applicant: '我',
      })
      const tip = r.degraded
        ? `⚠️ 出湖申请已落本地：${r.ticketNo}（${r.message || '后端暂不可用'}）`
        : `✅ 出湖申请已提交：${r.ticketNo} · 请在「待我审批」通过后，将单号填回 ETL ticketNo`
      showToast(tip, r.degraded ? 'warning' : 'success', { duration: 8000 })
    } catch (e) {
      showToast(e?.message || '出湖申请提交失败', 'danger')
    }
    creating.value = false
    activeTab.value = 'export'
    return
  } else {
    mine.value.unshift({
      id,
      type: form.value.type,
      side: 'pending',
      titleHtml: `<span class="tag tag-orange">处理中</span> 我申请 ${form.value.asset}`,
      time: now,
      desc: `用途：${purpose} · 时效 ${form.value.expire}`,
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: '● Owner 审批中', cls: 'current' },
      ],
    })
  }

  creating.value = false
  showToast(`✅ 申请已提交：${id}（${typeLabel}）已通知审批人`, 'success')
}

function submitMetricApply(id, now, purpose) {
  const kind = form.value.metricKind
  const kindLabel = metricKindLabel(kind)
  let metricId = form.value.metricId
  let metricName = selectedMetric.value?.name || metricId
  let titleCore = ''
  let desc = ''
  let statusTag = '待指标 Owner'
  let timelinePending = []
  let timelineMine = []
  const base = {
    id,
    type: 'metric',
    side: 'pending',
    metricKind: kind,
    purpose,
    applicant: '我',
    expire: form.value.expire,
    metricDomain: form.value.metricDomain,
  }

  if (kind === 'create') {
    metricId = '（待分配）'
    metricName = form.value.metricNameNew.trim()
    titleCore = `新建指标「${metricName}」· ${form.value.metricTypeNew}`
    desc = `类型：${form.value.metricTypeNew} · 域：${form.value.metricDomain} · ${purpose}`
    statusTag = '待指标委员会立项'
    timelinePending = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 指标委员会', cls: 'current' },
      { label: '分配 ID / 草稿', cls: '' },
      { label: '进入指标中心', cls: '' },
    ]
    timelineMine = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 指标委员会立项', cls: 'current' },
      { label: '进入指标中心', cls: '' },
    ]
    Object.assign(base, {
      metricId,
      metricName,
      metricTypeNew: form.value.metricTypeNew,
      metricDomain: form.value.metricDomain,
    })
  } else if (kind === 'change') {
    titleCore = `${metricId} ${metricName} · 口径变更 ${form.value.metricFromVer} → ${form.value.metricToVer}`
    desc = `变更：${form.value.caliberDiff.trim()} · ${purpose}`
    statusTag = '待指标委员会'
    timelinePending = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 指标委员会', cls: 'current' },
      { label: '版本发布', cls: '' },
      { label: '通知下游', cls: '' },
    ]
    timelineMine = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 指标委员会评审', cls: 'current' },
      { label: '版本发布', cls: '' },
    ]
    Object.assign(base, {
      metricId,
      metricName,
      metricFromVer: form.value.metricFromVer,
      metricToVer: form.value.metricToVer,
      caliberDiff: form.value.caliberDiff.trim(),
      metricOwner: selectedMetric.value?.owner,
      metricCaliber: selectedMetric.value?.caliber,
    })
  } else {
    const scopeLabel = SCOPE_LABEL[form.value.metricScope] || form.value.metricScope
    titleCore = `${metricId} ${metricName} · ${kindLabel}`
    desc = `场景：${scopeLabel} · 时效 ${form.value.expire} · ${purpose}`
    timelinePending = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 指标 Owner', cls: 'current' },
      { label: '写入 Gravitino', cls: '' },
    ]
    timelineMine = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● 指标 Owner 审批中', cls: 'current' },
      { label: '写入 Gravitino', cls: '' },
    ]
    Object.assign(base, {
      metricId,
      metricName,
      metricScope: form.value.metricScope,
      metricOwner: selectedMetric.value?.owner,
      metricCaliber: selectedMetric.value?.caliber,
      metricVer: selectedMetric.value?.ver,
    })
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
    titleHtml: `<span class="tag tag-blue">指标</span> ${titleCore}`,
    statusTag,
    statusCls: 'tag-orange',
    desc,
    timeline: timelinePending,
  })
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
          { label: '写入 Gravitino', cls: '' },
        ]
      : [
          { label: '✓ 提交', cls: 'done' },
          { label: '● Owner 审批中', cls: 'current' },
          { label: '写入 Gravitino', cls: '' },
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
          { label: '写入 Gravitino', cls: '' },
        ]
      : [
          { label: '✓ 提交', cls: 'done' },
          { label: '● Owner 你', cls: 'current' },
          { label: '写入 Gravitino', cls: '' },
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
      { label: 'Gravitino 登记', cls: '' },
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
      { label: '写入 Gravitino', cls: '' },
    ]
    timelineMine = [
      { label: '✓ 提交', cls: 'done' },
      { label: '● Owner 审批中', cls: 'current' },
      { label: '写入 Gravitino', cls: '' },
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
  const idx = pending.value.findIndex((w) => w.id === id)
  if (idx < 0) return
  const ticket = pending.value[idx]

  // perm / ops / publish(api_publish) 均须打后端
  if (
    (ticket.type === 'perm' || ticket.type === 'ops' || ticket.type === 'publish') &&
    (ticket.fromServer || ticket.serverId)
  ) {
    try {
      await apiApproveTicket(ticket.serverId || ticket.id)
      const ok = await hydrateApplyBoardFromServer().catch(() => false)
      if (ok) {
        const tip =
          ticket.type === 'publish'
            ? `✅ 已通过 ${ticket.ticketNo || id} · 可填回数据服务工作台发布`
            : `✅ 已通过 ${ticket.ticketNo || id} · 已写 sec_auth_grant（门户生效）`
        showToast(tip, 'success')
        return
      }
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
        { label: '✓ APISIX 已生效', cls: 'done' },
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
      const assigned = `M-${String(9000 + mine.value.length).slice(-4)}`
      title = `新建指标「${ticket.metricName}」已立项 · ${assigned}`
      desc = `类型：${ticket.metricTypeNew || '衍生'} · 域：${ticket.metricDomain || '—'} · 草稿已进入指标中心`
      timeline = [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ 指标委员会', cls: 'done' },
        { label: `✓ 分配 ${assigned}`, cls: 'done' },
        { label: '✓ 指标中心草稿', cls: 'done' },
      ]
      toastMsg = `✅ 已通过 ${id} · 已立项 ${assigned}，可在指标中心继续完善`
      ticket.metricId = assigned
    } else if (kind === 'change') {
      title = `${ticket.metricId} ${ticket.metricName || ''} · 口径 ${ticket.metricFromVer} → ${ticket.metricToVer}`
      desc = `已发布 ${ticket.metricToVer} · ${ticket.caliberDiff || ''} · 已通知下游 owner`
      timeline = [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ 指标委员会', cls: 'done' },
        { label: `✓ 版本发布 ${ticket.metricToVer}`, cls: 'done' },
        { label: '✓ 已通知下游', cls: 'done' },
      ]
      toastMsg = `✅ 已通过 ${id} · 口径版本 ${ticket.metricToVer} 已发布`
    } else {
      title = `${ticket.metricId} ${ticket.metricName || ''} · 查询权限`
      desc = `场景：${SCOPE_LABEL[ticket.metricScope] || ticket.metricScope || '—'} · 时效 ${ticket.expire || '—'} · 已写入 Gravitino 指标 ACL`
      timeline = [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ 指标 Owner', cls: 'done' },
        { label: '✓ Gravitino 已授权', cls: 'done' },
      ]
      toastMsg = `✅ 已通过 ${id} · 指标查询权限已写入 Gravitino`
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
        desc = `已写入资产目录 / Gravitino · ${ticket.purpose || ''}`
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
        desc = `已写入 Gravitino · 字段 ${ticket.columns || '全列'} · 时效 ${ticket.expire || '—'}`
        timeline = [
          { label: '✓ 提交', cls: 'done' },
          { label: '✓ Owner', cls: 'done' },
          { label: '✓ Gravitino 已授权', cls: 'done' },
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
}

async function rejectTicket(id) {
  const ticket = pending.value.find((w) => w.id === id)
  if ((ticket?.type === 'perm' || ticket?.type === 'ops') && (ticket.fromServer || ticket.serverId)) {
    try {
      await apiRejectTicket(ticket.serverId || ticket.id, '驳回')
      const ok = await hydrateApplyBoardFromServer().catch(() => false)
      if (ok) {
        showToast(`❌ 已驳回 ${ticket.ticketNo || id} · 已通知申请人`, 'warning')
        return
      }
    } catch (e) {
      showToast(e?.message || '驳回接口失败', 'danger')
      return
    }
  }
  const idx = pending.value.findIndex((w) => w.id === id)
  if (idx >= 0) pending.value.splice(idx, 1)
  if (ticket) {
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
        titleHtml: `<span class="tag tag-red">已驳回</span> ${ticket.asset || ticket.ticketNo || ticket.id}`,
        time: now,
        desc: `驳回原因：请补充用途/脱敏说明后重提 · 原单号 ${ticket.ticketNo || ticket.id}`,
        timeline: [
          { label: '✓ 提交', cls: 'done' },
          { label: '✗ 已驳回', cls: 'done' },
        ],
      })
    }
  }
  showToast(`❌ 已驳回 ${id} · 已通知申请人`, 'warning')
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
        { label: '✓ APISIX 已生效', cls: 'done' },
      ],
    })
  }
}

function openDetail(w) {
  detail.value = w
  tokenVisible.value = false
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  tokenVisible.value = false
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

function approveBtnLabel(w) {
  if (w.type === 'api') return '通过并签发令牌'
  if (w.type === 'metric') {
    if (w.metricKind === 'change') return '通过并发布版本'
    if (w.metricKind === 'create') return '通过并立项'
    return '通过并授权'
  }
  if (w.type === 'perm') return w.permMode === 'plain' || w.permLevel === '机密' ? '通过并加签授权' : '通过并授权'
  if (w.type === 'ops') return '通过并授权'
  if (w.type === 'table') {
    if (w.tableKind === 'register') return '通过并登记'
    if (w.tableKind === 'alter') return '通过并变更'
    return '通过并授权'
  }
  if (w.type === 'publish') return `通过并上线 ${w.publishEnv || ''}`.trim()
  if (w.type === 'export') return '通过并签发出湖单号'
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
      title="申请中心"
      subtitle="权限 / 表 / 发布 / API / 指标 · 统一工单 · 通过后写门户授权或上线门禁"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="exportTickets">📤 导出工单</button>
      <button type="button" class="btn btn-sm btn-primary" @click="toggleCreate">+ 新建申请</button>
    </PageHeader>

    <div class="kpi-grid apply-kpi">
      <div v-for="(k, i) in APPLY_KPIS" :key="i" class="kpi-card" :class="k.color">
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
              <option v-for="o in APPLY_API_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
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

          <template v-if="form.metricKind === 'create'">
            <label>
              <span>拟新建名称</span>
              <input v-model="form.metricNameNew" class="input" placeholder="如 跨境日 GMV" />
            </label>
            <label>
              <span>指标类型</span>
              <select v-model="form.metricTypeNew" class="select">
                <option v-for="t in APPLY_METRIC_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </label>
            <label>
              <span>业务域</span>
              <select v-model="form.metricDomain" class="select">
                <option v-for="d in APPLY_METRIC_DOMAINS" :key="d" :value="d">{{ d }}</option>
              </select>
            </label>
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
            <label v-if="form.metricKind === 'query'">
              <span>使用场景</span>
              <select v-model="form.metricScope" class="select">
                <option v-for="s in APPLY_METRIC_SCOPES" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </label>
            <template v-if="form.metricKind === 'change'">
              <label>
                <span>当前版本</span>
                <input v-model="form.metricFromVer" class="input" placeholder="v3" />
              </label>
              <label>
                <span>目标版本</span>
                <input v-model="form.metricToVer" class="input" placeholder="v4" />
              </label>
              <label class="wide">
                <span>口径变更说明</span>
                <textarea v-model="form.caliberDiff" class="input apply-textarea" placeholder="说明新旧口径差异、影响范围" />
              </label>
            </template>
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
              placeholder="搜索表 / 资产"
              sub-key="sub"
              :search-keys="['name', 'level', 'owner', 'domain', 'value']"
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
              placeholder="搜索表 / 资产"
              sub-key="sub"
              :search-keys="['name', 'level', 'owner', 'domain', 'value']"
            />
            <span v-if="form.assetCode || form.assetName" class="muted" style="font-size: 11px; margin-top: 4px">
              来自资产目录：{{ form.assetName || form.assetCode }}
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
              placeholder="搜索资产表"
              sub-key="sub"
              :search-keys="['name', 'level', 'owner', 'domain', 'value']"
            />
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
              placeholder="如：回滚至上一 Git tag · DS 作业切回"
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

        <label :class="{ wide: ['api', 'metric', 'perm', 'table', 'publish', 'export'].includes(form.type) }">
          <span>使用用途</span>
          <textarea
            v-model="form.purpose"
            class="input apply-textarea"
            :placeholder="purposePlaceholder()"
          />
        </label>
        <label v-if="showExpireField">
          <span>{{ form.type === 'api' ? '令牌时效' : form.type === 'export' ? '出湖时效' : form.type === 'publish' ? '发布窗口' : '权限时效' }}</span>
          <select v-model="form.expire" class="select">
            <option v-for="e in APPLY_EXPIRE_OPTIONS" :key="e" :value="e">{{ e }}</option>
          </select>
        </label>
        <p v-if="form.type === 'api'" class="apply-api-hint">
          此处填写的是 <b>本应用</b> 的调用配额（绑定签发令牌），不是接口全局上限。全局 QPS 在「构建 API」时配置；申请方配额合计不得超过全局上限。审批通过后签发 Bearer 令牌。
        </p>
        <p v-else-if="form.type === 'metric'" class="apply-api-hint">
          <template v-if="form.metricKind === 'query'">查询权限通过后写入 Gravitino 指标 ACL，可供看板 / 即席 / API 引用。</template>
          <template v-else-if="form.metricKind === 'change'">口径变更需指标委员会评审；通过后发布新版本并通知下游。</template>
          <template v-else>新建立项通过后分配指标 ID，并在指标中心生成草稿供完善口径与启用。</template>
        </p>
        <p v-else-if="form.type === 'perm'" class="apply-api-hint">
          表/列权限通过后写入 Gravitino；敏感列明文需安全加签，且不可选「长期」。
        </p>
        <p v-else-if="form.type === 'table'" class="apply-api-hint">
          只读走表 ACL；登记上架写入资产目录；结构变更需 Owner + 平台确认后元数据生效。
        </p>
        <p v-else-if="form.type === 'publish'" class="apply-api-hint">
          发布须过门禁（编译 / 血缘 / 质量 / stg）；prod 必须填写回滚预案，禁止裸改生产 SQL。
        </p>
        <button type="button" class="btn btn-sm btn-primary" @click="submitApply">提交申请</button>
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
          <div class="card-title">⏳ 待审批工单 <span class="tip">（我是资产 Owner/安全岗/API Owner）</span></div>
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
              <div class="wf-timeline">
                <template v-for="(node, ni) in w.timeline" :key="ni">
                  <span class="wf-node" :class="node.cls">{{ node.label }}</span>
                  <span v-if="ni < w.timeline.length - 1" class="wf-arrow">→</span>
                </template>
              </div>
              <div class="wf-actions">
                <button type="button" class="btn btn-sm" @click="openDetail(w)">详情</button>
                <button type="button" class="btn btn-sm btn-primary" @click="approveTicket(w.id)">
                  {{ approveBtnLabel(w) }}
                </button>
                <button type="button" class="btn btn-sm" @click="rejectTicket(w.id)">驳回</button>
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

    <AppDrawer
      :open="detailOpen"
      storage-key="apply-detail-width"
      :default-width="520"
      @close="closeDetail"
    >
      <div v-if="detail" class="detail-drawer">
        <div class="detail-head">
          <div>
            <div class="detail-title">申请详情</div>
            <div class="tip">{{ detail.id || '—' }}</div>
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
          <div v-if="detail.apiPath"><span>API</span><div><code>{{ detail.apiPath }}</code></div></div>
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
          <div v-if="detail.publishEnv && detail.type === 'publish'"><span>目标环境</span><div>{{ detail.publishEnv }}</div></div>
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
        </div>

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
        </div>
        <div v-else-if="detail.asset && (detail.type === 'perm' || detail.type === 'table')" class="detail-actions-row">
          <button type="button" class="btn btn-sm" @click="goCatalog(detail.asset)">打开资产目录</button>
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
