<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppDrawer from '@/components/common/AppDrawer.vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import { createApplyTicket, approveTicket } from '@/api/apply'
import { fetchLineageImpact, postChangeEval, postBlockDdl } from '@/api/lineage'
import { useAssets } from '@/composables/useAssets'
import { useDatasources } from '@/composables/useDatasources'
import { useDomains } from '@/composables/useDomains'
import { useSession, isNeedOwnerApplyError } from '@/composables/useSession'
import { useToast } from '@/composables/useToast'
import { confirmDelete } from '@/composables/useConfirmDelete'
import { APPLY_EXPIRE_OPTIONS } from '@/data/apply'
import { ASSET_LAYERS, ASSET_LEVELS, assetNameLabels } from '@/data/assetMeta'
import { formatDataType, yesNo } from '@/utils/fieldSchema'
import { lineagePath, qualityPath, standardMapping, lifecyclePath, metricsPath } from '@/utils/moduleLinks'
import { displayUser } from '@/utils/displayUser'
import { ensureWorkspaceUserOptions, workspaceUserById, workspaceUserOptions } from '@/data/workspaceUsers'
import { levelToSensitivity, sensitivityToLevel } from '@/api/catalog'

const props = defineProps({
  asset: { type: Object, default: null },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'updated', 'deleted'])

const router = useRouter()
const { showToast } = useToast()
const { sources, getSource } = useDatasources()
const {
  loadSchema,
  loadSchemaAssess,
  loadDetail,
  refresh,
  updateMeta,
  updateSchemaColumns,
  editAsset,
  loadPreview,
  removeAsset,
} = useAssets()
const { domainOptions, ensureDomains } = useDomains()
const { user, isSuperAdmin, canPreviewAsset, hasTableReadGrant, isAssetOwner, canEditAsset, canDeleteAsset, canManageAsset, refreshGrant, refreshManageGrant } = useSession()
const tab = ref('info')
const schemaLoading = ref(false)
const schemaHint = ref('')
const schemaSource = ref('')
const localFields = ref(null)
const schemaEditing = ref(false)
const schemaAssessing = ref(false)
const schemaSaving = ref(false)
const columnAssess = ref({})
const assessHint = ref('')
const assessFocusTable = ref('')
const busy = ref(false)
const metaSaving = ref(false)
const infoEditing = ref(false)
const infoSaving = ref(false)
const infoForm = reactive({
  name: '',
  cnName: '',
  description: '',
  layer: '',
  domain: '',
  techOwner: '',
  bizOwner: '',
  level: '内部',
  engine: '',
  isGold: false,
  revision: null,
})
const ownerOptionsTick = ref(0)
const ownerOptions = computed(() => {
  void ownerOptionsTick.value
  const list = [...workspaceUserOptions()]
  const push = (raw, sub) => {
    const cur = String(raw || '').trim()
    if (!cur || list.some((o) => String(o.value) === cur)) return
    list.unshift({ value: cur, label: cur, sub, account: '', name: cur })
  }
  push(infoForm.techOwner, '技术 Owner')
  push(infoForm.bizOwner, '业务 Owner')
  return list
})
const previewLoading = ref(false)
const previewLive = ref(null)
const previewHint = ref('')
const grantChecking = ref(false)
const applyOpen = ref(false)
const applyBusy = ref(false)
const applyForm = ref({ purpose: '', expire: '30天' })
const metaEdit = ref({
  description: '',
  displayName: '',
  tagsText: '',
  gold: false,
  syncPortalDraft: true,
})
/** 避免 loadSchema → emit updated → current 替换 → watch 再打 schema 的循环 */
let schemaFetchedFor = null
let previewFetchedFor = null
let grantFetchedFor = null

const qualityExtra = computed(() => props.asset?.extras?.quality || null)
const lineageExtra = computed(() => props.asset?.extras?.lineage || null)
const metricsExtra = computed(() => props.asset?.extras?.metrics || null)
const standardExtra = computed(() => props.asset?.extras?.standard || null)
const lifecycleExtra = computed(() => props.asset?.extras?.lifecycle || null)
const driftExtra = computed(() => props.asset?.extras?.drift || null)
const failRules = computed(() => qualityExtra.value?.failRules || [])
const goldExtra = computed(() => props.asset?.extras?.gold || null)
const omMeta = computed(() => props.asset?.extras?.omMeta || null)
const canEditOmMeta = computed(() => !!props.asset?.omFqn)
const nameLabels = computed(() => assetNameLabels(props.asset))
const lifecycleTags = computed(() =>
  Array.isArray(lifecycleExtra.value?.tags) ? lifecycleExtra.value.tags : [],
)

function goStandard() {
  const a = props.asset
  const path =
    standardExtra.value?.path ||
    standardMapping(a?.objectName || a?.tableName || a?.name)
  go(path)
}

function goLifecycle() {
  const a = props.asset
  const path =
    lifecycleExtra.value?.path ||
    lifecyclePath(a?.objectName || a?.tableName || a?.name || a?.assetCode)
  go(path)
}

function syncMetaEditFromAsset() {
  const om = props.asset?.extras?.omMeta
  const gold = props.asset?.extras?.gold
  const tagFqns = Array.isArray(om?.tagFqns)
    ? om.tagFqns
    : Array.isArray(om?.tags)
      ? om.tags.map((t) => (typeof t === 'string' ? t : t?.tagFQN || t?.fullyQualifiedName)).filter(Boolean)
      : []
  metaEdit.value = {
    description: om?.description ?? props.asset?.desc ?? '',
    displayName: om?.displayName ?? props.asset?.cnName ?? props.asset?.name ?? '',
    tagsText: tagFqns.join(', '),
    gold: gold?.omHasGold === true || (!!props.asset?.isGold && gold?.omHasGold !== false),
    syncPortalDraft: true,
  }
}

function syncInfoFormFromAsset() {
  const a = props.asset
  if (!a) return
  infoForm.name = a.name || ''
  infoForm.cnName = a.cnName || ''
  infoForm.description = a.desc || a.description || ''
  infoForm.layer = a.layer || 'ods'
  infoForm.domain = a.domain || a.domainCode || ''
  infoForm.techOwner = a.techOwner || a.owner || ''
  infoForm.bizOwner = a.bizOwner || ''
  infoForm.level = a.level || sensitivityToLevel(a.sensitivity) || '内部'
  infoForm.engine = a.engine || ''
  infoForm.isGold = !!a.isGold
  infoForm.revision = a.revision ?? null
}

function resolveOwnerId(raw, { allowEmpty = false } = {}) {
  const v = String(raw || '').trim()
  if (!v) return allowEmpty ? '' : user.value?.id || ''
  if (workspaceUserById(v)) return v
  const hit = workspaceUserOptions().find(
    (o) => o.account === v || o.name === v || o.label === v,
  )
  return hit?.value || v
}

function startInfoEdit() {
  if (!canEdit.value) {
    showToast('无编辑权，请申请操作权限', 'warning')
    goApplyManage()
    return
  }
  syncInfoFormFromAsset()
  ensureDomains().catch(() => {})
  ensureWorkspaceUserOptions().then(() => {
    ownerOptionsTick.value += 1
  })
  infoEditing.value = true
}

function cancelInfoEdit() {
  infoEditing.value = false
  syncInfoFormFromAsset()
}

async function saveInfoEdit() {
  if (!props.asset?.id || infoSaving.value) return
  if (!canEdit.value) {
    showToast('无编辑权，请申请操作权限', 'warning')
    goApplyManage()
    return
  }
  if (!infoForm.layer || !infoForm.domain) {
    showToast('请选择分层与业务域', 'warning')
    return
  }
  infoSaving.value = true
  try {
    const row = await editAsset({
      id: props.asset.id,
      name: infoForm.name,
      cnName: infoForm.cnName,
      description: infoForm.description,
      layer: infoForm.layer,
      domain: infoForm.domain,
      techOwner: resolveOwnerId(infoForm.techOwner),
      bizOwner: resolveOwnerId(infoForm.bizOwner, { allowEmpty: true }),
      sensitivity: levelToSensitivity(infoForm.level),
      engine: infoForm.engine,
      isGold: infoForm.isGold,
      revision: infoForm.revision,
    })
    emit('updated', row)
    infoEditing.value = false
    syncInfoFormFromAsset()
    showToast('基本信息已保存', 'success')
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(e.message || '无编辑权', 'warning')
      goApplyManage()
    } else {
      showToast(`保存失败：${e.message || e}`, 'error')
    }
  } finally {
    infoSaving.value = false
  }
}

function assessOf(enName) {
  return columnAssess.value[String(enName || '').toLowerCase()] || null
}

function goLineage() {
  const a = props.asset
  const path =
    lineageExtra.value?.path ||
    lineagePath({ focus: a?.objectName || a?.tableName || a?.name, omFqn: a?.omFqn })
  go(path)
}

function goMetrics() {
  go(metricsExtra.value?.path || metricsPath())
}

function goQuality() {
  const a = props.asset
  const path = qualityExtra.value?.path || qualityPath(a?.objectName || a?.tableName || a?.name)
  go(path)
}

watch(
  () => [props.open, props.asset?.id, props.asset?.extras?.omMeta?.omVersion],
  async ([open, id]) => {
    if (!open || !id) {
      schemaFetchedFor = null
      previewFetchedFor = null
      grantFetchedFor = null
      previewLive.value = null
      applyOpen.value = false
      schemaEditing.value = false
      infoEditing.value = false
      columnAssess.value = {}
      assessHint.value = ''
      return
    }
    syncMetaEditFromAsset()
    syncInfoFormFromAsset()
    ensureDomains().catch(() => {})
    if (grantFetchedFor !== id) {
      grantChecking.value = true
      grantFetchedFor = id
      try {
        await Promise.all([refreshGrant(id, props.asset), refreshManageGrant(id, props.asset)])
      } finally {
        grantChecking.value = false
      }
    }
    if (schemaFetchedFor === id) return
    tab.value = 'info'
    localFields.value = null
    schemaHint.value = ''
    schemaSource.value = ''
    schemaEditing.value = false
    columnAssess.value = {}
    assessHint.value = ''
    schemaFetchedFor = id
    previewFetchedFor = null
    previewLive.value = null
    await ensureSchema(id)
  },
)

const linkedSource = computed(() => {
  const a = props.asset
  if (!a) return null
  if (a.sourceId) return getSource(a.sourceId)
  if (a.sources?.length) {
    const p = a.sources.find((s) => s.linkRole === 'primary') || a.sources[0]
    if (p?.dsId) return getSource(p.dsId)
  }
  if (a.sourceName) {
    return sources.value.find((s) => s.name === a.sourceName || s.id === a.sourceName) || null
  }
  return sources.value.find((s) => s.asset === a.id) || null
})

const sourceType = computed(
  () => linkedSource.value?.type || props.asset?.sourceType || props.asset?.engine || '—',
)

/** 非关系表资产：禁止用演示字段模板冒充 Schema */
const NON_TABLE_KINDS = new Set([
  'bucket', 'index', 'topic', 'queue', 'path', 'key', 'key_prefix', 'collection', 'fileset', 'endpoint',
])
const isNonTableAsset = computed(() => {
  const a = props.asset || {}
  const kind = String(a.assetKind || a.kind || a.extras?.schema?.resolvedKind || '').toLowerCase()
  if (NON_TABLE_KINDS.has(kind)) return true
  const eng = String(sourceType.value || a.engine || '').toLowerCase()
  return /s3|minio|elastic|kafka|redis|mongo|ftp|hdfs|pulsar|rabbit/.test(eng)
})

const fields = computed(() => {
  if (localFields.value?.length) return localFields.value
  if (props.asset?.fields?.length) return props.asset.fields
  return []
})

const PREVIEW_SOURCE_LABEL = {
  trino: '查询引擎',
  'gravitino+trino': '元数据+查询',
  gravitino: '元数据',
  jdbc: 'JDBC',
  elasticsearch: 'Elasticsearch',
  s3: 'S3/MinIO',
  mongodb: 'MongoDB',
  kafka: 'Kafka',
  redis: 'Redis',
  http_api: 'HTTP API',
  meta_only: '仅元数据',
  denied: '无权限',
  none: '无适配器',
  error: '错误',
  empty: '空',
}

const previewSourceLabel = computed(() => {
  const s = previewLive.value?.source
  if (!s) return ''
  return PREVIEW_SOURCE_LABEL[s] || String(s)
})

const canPreview = computed(() => canPreviewAsset(props.asset))
const hasRead = computed(() => hasTableReadGrant(props.asset))
const isOwner = computed(() => isAssetOwner(props.asset))
const canEdit = computed(() => canEditAsset(props.asset))
const canDelete = computed(() => canDeleteAsset(props.asset))
const canManage = computed(() => canManageAsset(props.asset))
const previewAuthLabel = computed(() => {
  if (isOwner.value) return '拥有者'
  if (hasRead.value) return '已授权'
  return '无查询权限'
})
const manageAuthLabel = computed(() => {
  if (isOwner.value) return '拥有者'
  if (canEdit.value && canDelete.value) return '已授管理权'
  if (canEdit.value) return '已授编辑权'
  if (canDelete.value) return '已授删除权'
  return '无管理权'
})
const needApplyOps = computed(() => !canEdit.value && !canDelete.value)

const useLivePreview = computed(
  () => previewLive.value?.ok === true && Array.isArray(previewLive.value?.columns) && previewLive.value.columns.length > 0,
)
const previewCols = computed(() => {
  if (!useLivePreview.value) return []
  return (previewLive.value.columns || []).map((c) => ({
    enName: typeof c === 'string' ? c : c.name || String(c),
    cnName: typeof c === 'string' ? c : c.name || String(c),
  }))
})
const previewRows = computed(() => (useLivePreview.value ? previewLive.value.rows || [] : []))

watch(tab, async (t) => {
  if (t === 'preview' && props.asset?.id) {
    await ensurePreview(props.asset.id, false)
  }
})

/** @param {string} id @param {boolean} force 强制重新请求 */
async function ensurePreview(id, force = false) {
  if (!force && previewFetchedFor === id && previewLive.value != null) return
  previewLoading.value = true
  previewHint.value = ''
  previewLive.value = null
  try {
    await refreshGrant(id)
    grantFetchedFor = id
    const res = await loadPreview(id, { limit: 20 })
    previewLive.value = res || { ok: false, source: 'empty', message: '预览接口无返回' }
    previewFetchedFor = id
    const srcLabel = PREVIEW_SOURCE_LABEL[res?.source] || res?.source || '预览'
    if (res?.source === 'denied') {
      previewHint.value = res.message || '无查询权限'
      await refreshGrant(id)
    } else if (res?.source === 'none' || res?.source === 'meta_only') {
      previewHint.value = res.message || res.hint || '当前类型无行列预览'
    } else if (res?.degraded || res?.source === 'degraded') {
      previewHint.value = res.message || `${srcLabel} 降级/不可达`
    } else if (!res?.ok) {
      previewHint.value = res?.message || res?.hint || '预览失败'
    } else {
      const n = res.rowCount ?? (res.rows || []).length
      const via = srcLabel
      previewHint.value = res.qualifiedName
        ? `已通过 ${via} 返回 ${n} 行 · ${res.qualifiedName}`
        : `已通过 ${via} 返回 ${n} 行`
      if (res.hint) previewHint.value += ` · ${res.hint}`
    }
  } catch (e) {
    previewHint.value = e.message || String(e)
    previewLive.value = { ok: false, source: 'error', message: previewHint.value, columns: [], rows: [] }
    previewFetchedFor = id
  } finally {
    previewLoading.value = false
  }
}

const qs = computed(() => {
  const q = props.asset?.quality
  if (q === '—' || q == null || q === '') return 0
  const n = Number(q)
  return Number.isNaN(n) ? 0 : n
})
const hasQualityScore = computed(() => {
  const q = props.asset?.quality
  if (q === '—' || q == null || q === '') return false
  return !Number.isNaN(Number(q))
})
const qsc = computed(() =>
  qs.value >= 95 ? 'var(--success)' : qs.value >= 80 ? 'var(--warning)' : 'var(--danger)',
)

async function ensureSchema(id) {
  schemaLoading.value = true
  try {
    const row = await loadSchema(id)
    const schema = row?.extras?.schema || row?.schema
    if (schema?.available && schema.columns?.length) {
      localFields.value = schema.columns.map((c) => ({
        cnName: c.comment || c.name || '',
        enName: c.name || '',
        desc: c.comment || '',
        dataType: c.type || '',
        length: null,
        scale: null,
        nullable: c.nullable !== false,
        pk: false,
      }))
      schemaSource.value = schema.source || ''
      schemaHint.value = schema.hint || (schema.relational === false
        ? '非关系表结构（对象/消息元数据列），非业务表字段'
        : '')
    } else {
      schemaSource.value = schema?.source || ''
      schemaHint.value = schema?.hint || schema?.reason || '暂无远端结构'
      // 非表类型：绝不回落演示假字段
      const kind = String(schema?.resolvedKind || props.asset?.assetKind || '').toLowerCase()
      const nonTable = NON_TABLE_KINDS.has(kind) || isNonTableAsset.value
      if (nonTable) {
        localFields.value = []
        if (!schemaHint.value) {
          schemaHint.value = '该类型无 JDBC/Grav 表字段；请用「数据预览」看对象/消息样例'
        }
      } else if (row?.fields?.length) {
        localFields.value = row.fields
      } else {
        localFields.value = []
        schemaHint.value = (schemaHint.value || '') + '（未回落演示字段，避免误导）'
      }
    }
    if (row?.id) emit('updated', row)
  } catch (e) {
    schemaHint.value = e.message || String(e)
  } finally {
    schemaLoading.value = false
  }
}

async function doRefresh() {
  if (!props.asset?.id) return
  if (!canEdit.value) {
    showToast(`无编辑权不可刷新对齐（${manageAuthLabel.value}），请申请操作权限`, 'warning')
    goApplyManage()
    return
  }
  busy.value = true
  try {
    schemaFetchedFor = null
    await refresh(props.asset.id)
    const detail = await loadDetail(props.asset.id)
    emit('updated', detail)
    schemaFetchedFor = props.asset.id
    syncMetaEditFromAsset()
    syncInfoFormFromAsset()
    await ensureSchema(props.asset.id)
    showToast('已同步字段 Schema 并对齐', 'success')
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(e.message || '无编辑权，请申请操作权限', 'warning')
      goApplyManage()
    } else {
      showToast(`同步失败：${e.message || e}`, 'error')
    }
  } finally {
    busy.value = false
  }
}

async function runSchemaAssess() {
  if (!props.asset?.id || schemaAssessing.value) return
  schemaAssessing.value = true
  try {
    const res = await loadSchemaAssess(props.asset.id)
    const map = {}
    for (const c of res?.columns || []) {
      if (c?.enName) map[String(c.enName).toLowerCase()] = c
    }
    columnAssess.value = map
    assessFocusTable.value = res?.focusTable || ''
    assessHint.value = res?.hint || ''
    if (schemaEditing.value && localFields.value?.length) {
      localFields.value = localFields.value.map((f) => {
        const a = map[String(f.enName || '').toLowerCase()]
        if (!a) return f
        return {
          ...f,
          cnName: f.cnName || a.cnName || f.enName,
          desc: f.desc || a.description || '',
          _origCn: f._origCn ?? (a.cnName || f.cnName || ''),
          _origDesc: f._origDesc ?? (a.description || f.desc || ''),
          _origType: f._origType ?? (f.dataType || ''),
        }
      })
    }
    showToast(`已评估 ${res?.columnCount ?? 0} 列 · 表下游 ${res?.tableDownstreamCount ?? 0}`, 'success')
  } catch (e) {
    showToast(`评估失败：${e.message || e}`, 'error')
  } finally {
    schemaAssessing.value = false
  }
}

async function startSchemaEdit() {
  if (!canEdit.value) {
    showToast('无编辑权，请申请操作权限', 'warning')
    goApplyManage()
    return
  }
  if (isNonTableAsset.value) {
    showToast('非表资产无字段编辑', 'warning')
    return
  }
  schemaEditing.value = true
  localFields.value = (localFields.value || []).map((f) => ({
    ...f,
    _origCn: f.cnName || '',
    _origDesc: f.desc || '',
    _origType: f.dataType || '',
    _draftType: f.dataType || '',
  }))
  await runSchemaAssess()
}

function cancelSchemaEdit() {
  schemaEditing.value = false
  if (props.asset?.id) ensureSchema(props.asset.id)
}

async function saveSchemaMeta() {
  if (!props.asset?.id || schemaSaving.value) return
  if (!canEdit.value) {
    showToast('无编辑权', 'warning')
    return
  }
  const dirty = (localFields.value || [])
    .filter((f) => {
      const cn = String(f.cnName ?? '')
      const desc = String(f.desc ?? '')
      return cn !== String(f._origCn ?? '') || desc !== String(f._origDesc ?? '')
    })
    .map((f) => ({
      enName: f.enName,
      cnName: f.cnName,
      description: f.desc,
    }))
  if (!dirty.length) {
    showToast('无人读字段变更', 'info')
    return
  }
  const warned = dirty.filter((d) => (assessOf(d.enName)?.downstreamCount || 0) > 0)
  if (warned.length) {
    showToast(`有 ${warned.length} 列存在下游边（人读仍可保存，请确认口径）`, 'warning')
  }
  schemaSaving.value = true
  try {
    await updateSchemaColumns({ id: props.asset.id, columns: dirty })
    showToast(`已保存 ${dirty.length} 列人读到 OM`, 'success')
    schemaEditing.value = false
    schemaFetchedFor = null
    await ensureSchema(props.asset.id)
    await runSchemaAssess()
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(e.message || '无编辑权', 'warning')
      goApplyManage()
    } else {
      showToast(`保存失败：${e.message || e}`, 'error')
    }
  } finally {
    schemaSaving.value = false
  }
}

async function evalStructIntent(field) {
  if (!field?.enName) return
  const a = assessOf(field.enName)
  const toType = String(field._draftType || field.dataType || '').trim()
  if (!toType) {
    showToast('请填写拟改类型', 'warning')
    return
  }
  if (a && a.structWritable === false && (a.downstreamCount || 0) > 0) {
    showToast(a.reason || '有下游且未批准，不可登记结构变更意图', 'warning')
  }
  const table =
    assessFocusTable.value ||
    props.asset?.objectName ||
    props.asset?.tableName ||
    props.asset?.key
  try {
    const r = await postChangeEval({
      table,
      field: field.enName,
      toType,
    })
    const ok = r?.passed === true || r?.status === 'approved'
    showToast(
      ok
        ? `评估通过 · 下游 ${r.impactCount ?? 0}（门户不执行 DDL，请外置变更后同步）`
        : `评估待审 · 下游 ${r.impactCount ?? 0} · ${r.ticketId || ''}`,
      ok ? 'success' : 'warning',
    )
    if (!ok) {
      await postBlockDdl({
        table,
        field: field.enName,
        reason: '目录结构变更评估未通过',
      }).catch(() => {})
    }
    await runSchemaAssess()
  } catch (e) {
    showToast(`变更评估失败：${e.message || e}`, 'error')
  }
}

async function saveOmMeta() {
  if (!props.asset?.id) return
  if (!canEdit.value) {
    showToast(`无编辑权不可写元数据（${manageAuthLabel.value}），请申请操作权限`, 'warning')
    goApplyManage()
    return
  }
  if (!canEditOmMeta.value) {
    showToast('请先刷新对齐 OM（无 omFqn）', 'error')
    return
  }
  metaSaving.value = true
  try {
    const tags = metaEdit.value.tagsText
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const res = await updateMeta({
      id: props.asset.id,
      description: metaEdit.value.description,
      displayName: metaEdit.value.displayName || undefined,
      tags,
      gold: !!metaEdit.value.gold,
      syncPortalDraft: !!metaEdit.value.syncPortalDraft,
      syncGold: true,
    })
    const detail = await loadDetail(props.asset.id)
    emit('updated', detail)
    syncMetaEditFromAsset()
    const audit = res?.auditEventId ? ` · 审计 ${res.auditEventId}` : ''
    showToast(`外部元数据已保存${audit}`, 'success')
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(`保存失败：${e.message || e}`, 'warning')
      goApplyManage()
    } else {
      showToast(`保存失败：${e.message || e}`, 'error')
    }
  } finally {
    metaSaving.value = false
  }
}

function close() {
  emit('close')
}

async function onDeleteAsset() {
  const a = props.asset
  if (!a?.id || busy.value) return
  if (!canDelete.value) {
    showToast('无删除权，请申请操作权限', 'warning')
    goApplyManage()
    return
  }
  let impactLine = ''
  try {
    const focus = a.objectName || a.tableName || a.key || a.name
    const impact = await fetchLineageImpact({
      focus,
      omFqn: a.omFqn,
      upDepth: 1,
      downDepth: 3,
      ws: a.ws,
    })
    const down = impact?.downCount ?? 0
    if (down > 0) {
      impactLine = `\n表级下游约 ${down} 个对象；删除仅软删门户登记，不清理底层表与血缘边。`
    } else {
      impactLine = '\n暂无表级下游对象（或血缘未同步）。'
    }
  } catch {
    impactLine = '\n（下游影响查询失败，仍可软删门户登记）'
  }
  const ok = await confirmDelete({
    title: `删除资产「${a.cnName || a.name || a.key || a.id}」`,
    message: `将软删门户资产登记与源绑定；不物理删除 OM/底层表数据。${impactLine}`,
    confirmLabel: '确认删除',
  })
  if (!ok) return
  busy.value = true
  try {
    await removeAsset(a.id)
    showToast('已删除资产', 'success')
    emit('deleted', a.id)
    close()
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(e?.message || '无删除权，请申请操作权限', 'warning')
      goApplyManage()
    } else {
      showToast(e?.message || '删除失败', 'error')
    }
  } finally {
    busy.value = false
  }
}

function go(path) {
  close()
  router.push(path)
}

function applyPerm() {
  openApplyModal()
}

function openApplyModal() {
  if (hasRead.value) {
    const tip = isSuperAdmin.value
      ? '超管已具备本表查询权限'
      : isOwner.value
        ? '您是资产拥有者，可直接预览'
        : '已具备本表查询权限，无需申请'
    showToast(tip, 'info')
    return
  }
  applyForm.value = { purpose: '', expire: '30天' }
  applyOpen.value = true
}

async function submitApply(activate) {
  const assetId = props.asset?.id
  if (!assetId) {
    showToast('资产无效', 'warning')
    return
  }
  const purpose = applyForm.value.purpose.trim()
  if (!purpose) {
    showToast('请填写申请事由', 'warning')
    return
  }
  applyBusy.value = true
  try {
    const ticket = await createApplyTicket({
      ticketType: 'table_read',
      title: `表读权限 · ${props.asset?.cnName || props.asset?.name || props.asset?.assetCode || assetId}`,
      reason: purpose,
      assetId,
      privilege: 'SELECT',
      expireLabel: applyForm.value.expire,
    })
    if (activate && isSuperAdmin.value && ticket?.id) {
      await approveTicket(ticket.id, '目录抽屉自助生效')
      await refreshGrant(assetId)
      grantFetchedFor = assetId
      applyOpen.value = false
      showToast('已申请并通过：表级读权限已生效', 'success')
      previewFetchedFor = null
      tab.value = 'preview'
      await ensurePreview(assetId, true)
      return
    }
    applyOpen.value = false
    showToast(`申请已提交 ${ticket?.ticketNo || ticket?.id || ''}，待审批通过后可预览`, 'success')
  } catch (e) {
    showToast(e?.message || '提交申请失败', 'danger')
  } finally {
    applyBusy.value = false
  }
}

function goApplyCenter() {
  const assetId = props.asset?.id
  applyOpen.value = false
  close()
  router.push({
    path: '/apply',
    query: {
      type: 'perm',
      assetId: assetId || '',
      assetCode: props.asset?.assetCode || '',
      name: props.asset?.name || props.asset?.cnName || '',
    },
  })
}

function goApplyManage() {
  const assetId = props.asset?.id
  close()
  router.push({
    path: '/apply',
    query: {
      type: 'manage',
      resourceType: 'asset',
      resourceId: assetId || '',
      assetId: assetId || '',
      assetCode: props.asset?.assetCode || '',
      name: props.asset?.name || props.asset?.cnName || '',
    },
  })
}

async function openPreviewTab() {
  tab.value = 'preview'
  if (props.asset?.id) {
    await ensurePreview(props.asset.id, true)
  }
}

function goQuery() {
  close()
  const a = props.asset || {}
  const fqn =
    a.fqn ||
    a.gravFqn ||
    a.objectName ||
    a.tableName ||
    (a.omFqn && String(a.omFqn).includes('.') ? String(a.omFqn).split('.').slice(-3).join('.') : '') ||
    a.name
  router.push({
    path: '/query',
    query: fqn ? { fqn: String(fqn) } : {},
  })
}

function goDatasource() {
  const id = linkedSource.value?.id || props.asset?.sourceId
  if (id) {
    close()
    router.push({ path: '/datasource', query: { highlight: id } })
    return
  }
  go('/datasource')
}

function fmtCell(v) {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return v
}

/** Grav 列名与 Trino 行键大小写可能不一致 */
function cellAt(row, col) {
  if (!row || col == null) return undefined
  if (Object.prototype.hasOwnProperty.call(row, col)) return row[col]
  const want = String(col).toLowerCase()
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === want) return row[k]
  }
  return undefined
}
</script>

<template>
  <AppDrawer
    :open="open && !!asset"
    :default-width="720"
    :min-width="480"
    storage-key="drawer-width-asset"
    @close="close"
  >
    <template v-if="asset">
      <div class="drawer-header">
        <div style="flex: 1; min-width: 0">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
            <span class="asset-layer" :class="`layer-${asset.layer}`">{{ asset.layerLabel }}</span>
            <span class="drawer-title">{{ asset.key }}</span>
          </div>
          <div class="drawer-subtitle">
            {{ asset.desc || asset.cnName || '—' }}{{ asset.size ? ` · ${asset.size}` : '' }}
            <template v-if="linkedSource || asset.sourceName">
              · 🔌 {{ linkedSource?.name || asset.sourceName }}
              <span class="tag tag-gray" style="margin-left: 4px">{{ sourceType }}</span>
            </template>
            <template v-if="asset.omFqn">
              · <span style="font-family: monospace; font-size: 11px">{{ asset.omFqn }}</span>
            </template>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0">
          <span v-if="isSuperAdmin" class="tag tag-green" style="font-size: 10px">超管</span>
          <span v-else-if="grantChecking" class="tag tag-gray" style="font-size: 10px">鉴权中…</span>
          <span v-else-if="canManage" class="tag tag-green" style="font-size: 10px">{{ manageAuthLabel }}</span>
          <span v-else-if="hasRead" class="tag tag-green" style="font-size: 10px">已授权读</span>
          <span v-else class="tag tag-orange" style="font-size: 10px" title="目录可见 ≠ 引擎可查">未见 SELECT</span>
          <button
            v-if="canEdit"
            class="btn btn-sm"
            :disabled="busy"
            title="同步字段 Schema 并刷新对齐"
            @click="doRefresh"
          >↻ 同步 Schema</button>
          <button class="btn btn-sm" @click="goLineage">🔗 血缘</button>
          <button v-if="canPreview" class="btn btn-sm btn-primary" @click="openPreviewTab">👁 数据预览</button>
          <button v-else class="btn btn-sm btn-primary" :disabled="grantChecking" @click="applyPerm">🔐 申请查询</button>
          <button v-if="needApplyOps" class="btn btn-sm" :disabled="grantChecking" @click="goApplyManage">🔐 申请操作权限</button>
          <button
            v-if="canDelete"
            class="btn btn-sm"
            style="color: var(--danger)"
            :disabled="busy"
            @click="onDeleteAsset"
          >删除</button>
          <button class="btn btn-sm" title="关闭" @click="close">✕</button>
        </div>
      </div>

      <div class="drawer-body">
        <div class="std-tabs">
          <span class="std-tab" :class="{ active: tab === 'info' }" @click="tab = 'info'">基本信息</span>
          <span class="std-tab" :class="{ active: tab === 'schema' }" @click="tab = 'schema'">字段 Schema</span>
          <span class="std-tab" :class="{ active: tab === 'quality' }" @click="tab = 'quality'">质量</span>
          <span class="std-tab" :class="{ active: tab === 'preview' }" @click="tab = 'preview'">数据预览</span>
          <span class="std-tab" :class="{ active: tab === 'perm' }" @click="tab = 'perm'">权限 / 脱敏</span>
        </div>

        <p v-if="!grantChecking && !canPreview" class="asset-see-hint tip">
          看见 ≠ 能查：本目录可打开详情，预览与即席查询须 Owner 或已批准的表级读权限。
          <button type="button" class="btn-link" @click="applyPerm">申请 SELECT</button>
          ·
          <button type="button" class="btn-link" @click="goApplyCenter">申请中心</button>
        </p>

        <div v-show="tab === 'info'">
          <div class="detail-section-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            基本信息
            <span style="flex: 1" />
            <button
              v-if="canEdit && !infoEditing"
              type="button"
              class="btn btn-sm btn-primary"
              @click="startInfoEdit"
            >编辑基本信息</button>
            <template v-if="infoEditing">
              <button type="button" class="btn btn-sm" :disabled="infoSaving" @click="cancelInfoEdit">取消</button>
              <button type="button" class="btn btn-sm btn-primary" :disabled="infoSaving" @click="saveInfoEdit">
                {{ infoSaving ? '保存中…' : '保存' }}
              </button>
            </template>
          </div>
          <div v-if="!canEdit" style="font-size: 12px; color: var(--text-3); margin: 8px 0">
            仅<strong>资产拥有者</strong>（或已授 EDIT/MANAGE）可改分层/域与门户资产信息。
            <button type="button" class="btn-link" @click="goApplyManage">去申请操作权限</button>
          </div>

          <div v-if="infoEditing" class="om-meta-form" style="margin-top: 10px">
            <div class="info-grid">
              <div><div class="info-label">物理名 / 编码</div><div class="info-value" style="font-family: monospace">{{ asset.key }}</div></div>
              <div>
                <div class="info-label">关联数据源</div>
                <div class="info-value">{{ linkedSource?.name || asset.sourceName || '—' }} · {{ sourceType }}</div>
              </div>
              <div><div class="info-label">源对象</div><div class="info-value" style="font-family: monospace">{{ asset.tableName || asset.objectName || '—' }}</div></div>
              <div><div class="info-label">OM FQN</div><div class="info-value" style="font-family: monospace; font-size: 11px">{{ asset.omFqn || '—' }}</div></div>
            </div>
            <label class="form-field" style="margin-top: 10px">
              <span class="form-label">分层</span>
              <select v-model="infoForm.layer" class="select" style="width: 100%">
                <option v-for="l in ASSET_LAYERS" :key="l.value" :value="l.value">{{ l.full }}</option>
              </select>
            </label>
            <label class="form-field">
              <span class="form-label">业务域</span>
              <select v-model="infoForm.domain" class="select" style="width: 100%">
                <option v-for="d in domainOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
            </label>
            <label class="form-field">
              <span class="form-label">{{ nameLabels.tech }}</span>
              <input v-model="infoForm.name" class="input" :placeholder="nameLabels.tech" />
            </label>
            <label class="form-field">
              <span class="form-label">{{ nameLabels.biz }}</span>
              <input v-model="infoForm.cnName" class="input" :placeholder="nameLabels.biz" />
            </label>
            <label class="form-field">
              <span class="form-label">描述草稿</span>
              <textarea v-model="infoForm.description" class="textarea" rows="2" />
            </label>
            <label class="form-field">
              <span class="form-label">敏感级</span>
              <select v-model="infoForm.level" class="select" style="width: 100%">
                <option v-for="lv in ASSET_LEVELS" :key="lv.value" :value="lv.value">{{ lv.value }}</option>
              </select>
            </label>
            <label class="form-field">
              <span class="form-label">引擎</span>
              <input v-model="infoForm.engine" class="input" />
            </label>
            <div class="form-field">
              <span class="form-label">技术 Owner</span>
              <SearchSelect
                v-model="infoForm.techOwner"
                :options="ownerOptions"
                placeholder="搜索姓名 / 账号"
                sub-key="sub"
                :search-keys="['name', 'account', 'label', 'sub']"
              />
            </div>
            <div class="form-field">
              <span class="form-label">业务 Owner</span>
              <SearchSelect
                v-model="infoForm.bizOwner"
                :options="ownerOptions"
                placeholder="可选"
                sub-key="sub"
                :search-keys="['name', 'account', 'label', 'sub']"
              />
            </div>
            <label class="check-row" style="margin-top: 8px">
              <input v-model="infoForm.isGold" type="checkbox" />
              <span>门户黄金认证标记</span>
            </label>
          </div>

          <div v-else class="info-grid" style="margin-top: 10px">
            <div><div class="info-label">物理名 / 编码</div><div class="info-value" style="font-family: monospace">{{ asset.key }}</div></div>
            <div>
              <div class="info-label">分层 / 域</div>
              <div class="info-value">
                <span class="asset-layer" :class="`layer-${asset.layer}`">{{ asset.layerLabel }}</span>
                · {{ asset.domainLabel }}
              </div>
            </div>
            <div>
              <div class="info-label">{{ nameLabels.tech }}</div>
              <div class="info-value">{{ asset.name || '—' }}</div>
            </div>
            <div>
              <div class="info-label">{{ nameLabels.biz }}</div>
              <div class="info-value">{{ asset.cnName || '—' }}</div>
            </div>
            <div>
              <div class="info-label">描述草稿</div>
              <div class="info-value">{{ asset.desc || '—' }}</div>
            </div>
            <div>
              <div class="info-label">关联数据源</div>
              <div class="info-value">
                <template v-if="linkedSource || asset.sourceName">
                  <button class="btn-link" @click="goDatasource">
                    {{ linkedSource?.name || asset.sourceName }} · {{ sourceType }}
                  </button>
                </template>
                <template v-else>—</template>
              </div>
            </div>
            <div><div class="info-label">源对象</div><div class="info-value" style="font-family: monospace">{{ asset.tableName || asset.objectName || '—' }}</div></div>
            <div><div class="info-label">引擎</div><div class="info-value">{{ asset.engine || '—' }}</div></div>
            <div><div class="info-label">状态 / 同步</div><div class="info-value">{{ asset.status || '—' }} · {{ asset.lastSyncStatus || '—' }}</div></div>
            <div><div class="info-label">OM FQN</div><div class="info-value" style="font-family: monospace; font-size: 11px">{{ asset.omFqn || '—' }}</div></div>
            <div><div class="info-label">Owner</div><div class="info-value">{{ displayUser(asset.ownerName || asset.techOwnerName, asset.owner || asset.techOwner) || '—' }} / {{ displayUser(asset.bizOwnerName, asset.bizOwner) || '—' }}</div></div>
            <div>
              <div class="info-label">黄金对账</div>
              <div class="info-value">
                <span class="tag" :class="asset.isGold ? 'tag-green' : 'tag-gray'">
                  门户 {{ asset.isGold ? '已认证' : '未认证' }}
                </span>
                <span
                  v-if="goldExtra?.omHasGold != null"
                  class="tag"
                  :class="goldExtra.aligned ? 'tag-green' : 'tag-orange'"
                  style="margin-left: 4px"
                >
                  OM {{ goldExtra.omHasGold ? '有金标' : '无金标' }}
                  · {{ goldExtra.aligned ? '已对齐' : '漂移' }}
                </span>
                <span v-else class="muted" style="margin-left: 6px; font-size: 11px">OM 暂不可用</span>
              </div>
            </div>
            <div><div class="info-label">更新时间</div><div class="info-value">{{ asset.updated || '—' }}</div></div>
          </div>

          <div class="detail-section-title" style="margin-top: 18px; display: flex; align-items: center; gap: 8px">
            OM 人读元数据
            <span v-if="omMeta?.available" class="tag tag-blue">可编辑</span>
            <span v-else class="tag tag-gray">需 omFqn</span>
          </div>
          <div v-if="!canEdit" style="font-size: 12px; color: var(--text-3); margin: 8px 0">
            仅<strong>资产拥有者</strong>（或已授 EDIT/MANAGE）可写外部元数据 / 刷新对齐。
            <button type="button" class="btn-link" @click="goApplyManage">去申请操作权限</button>
          </div>
          <div v-else-if="!canEditOmMeta" style="font-size: 12px; color: var(--text-3); margin: 8px 0">
            资产尚未对齐外部目录。请先点「刷新」完成门户清单同步，再编辑描述与标签。
          </div>
          <div v-else class="om-meta-form" style="margin-top: 10px">
            <label class="form-field">
              <span class="form-label">展示名</span>
              <input v-model="metaEdit.displayName" class="input" placeholder="OM displayName" />
            </label>
            <label class="form-field">
              <span class="form-label">描述</span>
              <textarea
                v-model="metaEdit.description"
                class="textarea"
                rows="3"
                placeholder="OM description（人读说明）"
              />
            </label>
            <label class="form-field">
              <span class="form-label">标签 FQN</span>
              <input
                v-model="metaEdit.tagsText"
                class="input"
                placeholder="逗号分隔，如 Tier.Gold, PII.None"
              />
            </label>
            <div class="om-meta-checks">
              <label class="check-row">
                <input v-model="metaEdit.gold" type="checkbox" />
                <span>黄金认证（写入 {{ (goldExtra?.goldTagFqns || ['Tier.Gold'])[0] }}）</span>
              </label>
              <label class="check-row">
                <input v-model="metaEdit.syncPortalDraft" type="checkbox" />
                <span>同步回写门户 description 草稿</span>
              </label>
            </div>
            <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap">
              <button class="btn btn-sm btn-primary" :disabled="metaSaving" @click="saveOmMeta">
                {{ metaSaving ? '保存中…' : '保存到 OM' }}
              </button>
              <button class="btn btn-sm" :disabled="busy || metaSaving" @click="doRefresh">↻ 刷新并对齐黄金</button>
            </div>
            <div v-if="goldExtra?.hint" style="font-size: 11px; color: var(--text-3); margin-top: 8px">
              {{ goldExtra.hint }}
            </div>
          </div>
        </div>
        <div v-show="tab === 'schema'">
          <div class="detail-section-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            {{ isNonTableAsset ? '对象 / 消息结构' : '字段定义' }} · {{ fields.length }} 列
            <span v-if="schemaLoading" class="tag tag-gray">加载中…</span>
            <span v-else-if="schemaSource" class="tag tag-blue">来源 {{ schemaSource }}</span>
            <span v-else-if="isNonTableAsset" class="tag tag-orange">非表</span>
            <span v-else class="tag tag-gray">待加载</span>
            <span class="tag tag-gray">结构 DDL 门户不可执行</span>
            <span style="flex: 1" />
            <button
              v-if="canEdit && !isNonTableAsset"
              type="button"
              class="btn btn-sm"
              :disabled="busy || schemaLoading"
              @click="doRefresh"
            >同步字段 Schema</button>
            <button
              v-if="canEdit && !isNonTableAsset"
              type="button"
              class="btn btn-sm"
              :disabled="schemaAssessing"
              @click="runSchemaAssess"
            >{{ schemaAssessing ? '评估中…' : '评估可改性' }}</button>
            <button
              v-if="canEdit && !isNonTableAsset && !schemaEditing"
              type="button"
              class="btn btn-sm btn-primary"
              @click="startSchemaEdit"
            >编辑字段</button>
            <template v-if="schemaEditing">
              <button type="button" class="btn btn-sm" :disabled="schemaSaving" @click="cancelSchemaEdit">取消</button>
              <button type="button" class="btn btn-sm btn-primary" :disabled="schemaSaving" @click="saveSchemaMeta">
                {{ schemaSaving ? '保存中…' : '保存人读' }}
              </button>
            </template>
          </div>
          <div v-if="schemaHint" style="font-size: 12px; color: var(--text-3); margin-top: 6px">
            {{ schemaHint }}
          </div>
          <div v-if="assessHint" style="font-size: 12px; color: var(--text-3); margin-top: 4px">
            {{ assessHint }}
          </div>
          <div style="overflow: auto; max-height: 460px; margin-top: 8px">
            <table class="std-table field-meta-table" style="font-size: 12px">
              <thead>
                <tr>
                  <th style="min-width: 88px">中文名称</th>
                  <th style="min-width: 110px">英文名称</th>
                  <th style="min-width: 140px">描述</th>
                  <th style="min-width: 100px">字段类型</th>
                  <th style="width: 72px">字段长度</th>
                  <th style="width: 64px">小数位</th>
                  <th style="width: 72px">是否可空</th>
                  <th style="width: 72px">是否主键</th>
                  <th style="min-width: 120px">可改性</th>
                  <th v-if="schemaEditing" style="min-width: 100px">结构意图</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!fields.length">
                  <td :colspan="schemaEditing ? 10 : 9" style="text-align: center; color: var(--text-3)">
                    {{ isNonTableAsset ? '无表字段（对象存储/消息等请看数据预览）' : '暂无字段结构' }}
                  </td>
                </tr>
                <tr v-for="c in fields" :key="c.enName">
                  <td>
                    <input
                      v-if="schemaEditing && assessOf(c.enName)?.metaWritable !== false"
                      v-model="c.cnName"
                      class="input input-sm"
                      style="width: 100%; min-width: 72px"
                    />
                    <template v-else>{{ c.cnName }}</template>
                  </td>
                  <td style="font-family: monospace; font-weight: 500">
                    <span v-if="c.pk">🔑 </span>{{ c.enName }}
                  </td>
                  <td style="color: var(--text-2)">
                    <input
                      v-if="schemaEditing && assessOf(c.enName)?.metaWritable !== false"
                      v-model="c.desc"
                      class="input input-sm"
                      style="width: 100%; min-width: 100px"
                    />
                    <template v-else>{{ c.desc || '—' }}</template>
                  </td>
                  <td style="font-family: monospace; font-size: 11px; color: var(--primary)">
                    <template v-if="schemaEditing">
                      <input
                        v-model="c._draftType"
                        class="input input-sm"
                        style="width: 100%; min-width: 80px; font-family: monospace"
                        :title="assessOf(c.enName)?.reason || '拟改类型仅用于评估，不落 DDL'"
                        :placeholder="c.dataType"
                      />
                    </template>
                    <template v-else>{{ formatDataType(c) }}</template>
                  </td>
                  <td>{{ fmtCell(c.length) }}</td>
                  <td>{{ fmtCell(c.scale) }}</td>
                  <td>
                    <span :class="c.nullable ? 'tag tag-gray' : 'tag tag-orange'">{{ yesNo(c.nullable) }}</span>
                  </td>
                  <td>
                    <span :class="c.pk ? 'tag tag-blue' : 'tag tag-gray'">{{ yesNo(c.pk) }}</span>
                  </td>
                  <td>
                    <template v-if="assessOf(c.enName)">
                      <span
                        class="tag"
                        :class="assessOf(c.enName).metaWritable ? 'tag-green' : 'tag-gray'"
                        :title="assessOf(c.enName).reason"
                      >人读{{ assessOf(c.enName).metaWritable ? '可改' : '不可' }}</span>
                      <span
                        class="tag"
                        :class="assessOf(c.enName).structWritable ? 'tag-blue' : 'tag-orange'"
                        style="margin-left: 4px"
                        :title="assessOf(c.enName).reason"
                      >结构{{ assessOf(c.enName).structWritable ? '可评估' : '阻断' }}</span>
                      <span
                        v-if="assessOf(c.enName).downstreamCount"
                        class="tag tag-orange"
                        style="margin-left: 4px"
                      >↓{{ assessOf(c.enName).downstreamCount }}</span>
                    </template>
                    <span v-else class="tag tag-gray">未评估</span>
                  </td>
                  <td v-if="schemaEditing">
                    <button
                      type="button"
                      class="btn-link btn-sm"
                      :disabled="!c._draftType || c._draftType === (c._origType || c.dataType)"
                      @click="evalStructIntent(c)"
                    >登记评估</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-show="tab === 'quality'">
          <div style="display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap">
            <div
              v-if="hasQualityScore"
              class="big-score"
              :style="{ background: `conic-gradient(${qsc} 0 ${qs}%, var(--bg-2) ${qs}% 100%)` }"
            >
              <div class="big-score-inner">
                <div class="big-score-num" :style="{ color: qsc }">{{ asset.quality }}</div>
                <div class="big-score-label">质量分</div>
              </div>
            </div>
            <div
              v-else
              class="big-score"
              style="background: var(--bg-2)"
            >
              <div class="big-score-inner">
                <div class="big-score-num" style="color: var(--text-3); font-size: 18px">暂无</div>
                <div class="big-score-label">质量分</div>
              </div>
            </div>
            <div style="flex: 1; min-width: 220px">
              <div class="info-grid" style="margin-bottom: 12px">
                <div>
                  <div class="info-label">关联规则</div>
                  <div class="info-value">{{ qualityExtra?.ruleCount ?? 0 }} · 失败 {{ failRules.length }}</div>
                </div>
                <div>
                  <div class="info-label">血缘影响</div>
                  <div class="info-value">
                    上 {{ lineageExtra?.upCount ?? '—' }} / 下 {{ lineageExtra?.downCount ?? '—' }}
                    <span v-if="lineageExtra?.source" class="muted" style="margin-left: 4px; font-size: 11px">
                      · {{ lineageExtra.source === 'openmetadata' ? 'OM' : '门户' }}
                    </span>
                  </div>
                </div>
                <div>
                  <div class="info-label">黄金认证</div>
                  <div class="info-value">{{ asset.isGold ? '⭐ 已认证' : '待认证 / 已摘牌' }}</div>
                </div>
                <div>
                  <div class="info-label">标准覆盖率</div>
                  <div class="info-value">
                    <template v-if="standardExtra?.available && standardExtra?.coveragePct != null">
                      {{ standardExtra.coveragePct }}%
                      <span class="muted">
                        · {{ standardExtra.coveredCount ?? 0 }}/{{ standardExtra.columnCount ?? 0 }} 列
                      </span>
                    </template>
                    <template v-else-if="standardExtra?.available">
                      {{ standardExtra.hint || '—' }}
                      <span v-if="standardExtra.mappingCount" class="muted">
                        · 映射 {{ standardExtra.mappingCount }}
                      </span>
                    </template>
                    <template v-else>{{ standardExtra?.degraded ? '降级' : '—' }}</template>
                    <span
                      v-if="standardExtra?.detectFailCount"
                      class="muted"
                      style="margin-left: 4px"
                    >· 检测失败 {{ standardExtra.detectFailCount }}</span>
                  </div>
                </div>
                <div>
                  <div class="info-label">生命周期画像</div>
                  <div class="info-value">
                    <template v-if="lifecycleTags.length">
                      <span
                        v-for="t in lifecycleTags"
                        :key="t"
                        class="tag tag-gray"
                        style="margin-right: 4px"
                      >{{ t }}</span>
                    </template>
                    <template v-else-if="lifecycleExtra?.available">
                      {{ lifecycleExtra.hint || '无策略/画像' }}
                    </template>
                    <template v-else>{{ lifecycleExtra?.degraded ? '降级' : '—' }}</template>
                  </div>
                </div>
                <div v-if="driftExtra?.openCount">
                  <div class="info-label">元数据漂移</div>
                  <div class="info-value">
                    <span class="tag tag-orange">开单 {{ driftExtra.openCount }}</span>
                    <span
                      v-for="d in (driftExtra.items || []).slice(0, 3)"
                      :key="d.id || d.driftType"
                      class="muted"
                      style="margin-left: 6px; font-size: 11px"
                    >{{ d.driftType }}</span>
                  </div>
                </div>
              </div>
              <div
                v-if="standardExtra?.gaps?.length"
                style="margin-bottom: 10px"
              >
                <div class="detail-section-title">未覆盖列（预览）</div>
                <div style="font-size: 12px; color: var(--text-2)">
                  <code
                    v-for="g in standardExtra.gaps"
                    :key="g"
                    style="margin-right: 8px"
                  >{{ g }}</code>
                  <span v-if="standardExtra.gapCount > standardExtra.gaps.length" class="muted">
                    …共 {{ standardExtra.gapCount }}
                  </span>
                </div>
              </div>
              <div
                v-if="lineageExtra?.downPreview?.length"
                style="margin-bottom: 10px"
              >
                <div class="detail-section-title">下游影响（预览）</div>
                <div
                  v-for="d in lineageExtra.downPreview"
                  :key="d.key || d.assetId"
                  style="font-size: 12px; margin: 4px 0; color: var(--text-2)"
                >
                  <span class="tag tag-gray" style="margin-right: 6px">{{ d.type || '表' }}</span>
                  <code>{{ d.key }}</code>
                  <span v-if="d.owner" class="muted"> · {{ d.owner }}</span>
                  <span v-else-if="d.jobName" class="muted"> · {{ d.jobName }}</span>
                </div>
              </div>
              <div
                v-if="metricsExtra?.available"
                style="margin-bottom: 10px"
              >
                <div class="detail-section-title">
                  被引用指标
                  <span class="muted" style="font-weight: 400">· {{ metricsExtra.count ?? 0 }}</span>
                </div>
                <p v-if="!metricsExtra.items?.length" class="muted" style="font-size: 12px; margin: 4px 0">
                  {{ metricsExtra.hint || '无指标绑定本表' }}
                </p>
                <div
                  v-for="m in metricsExtra.items || []"
                  :key="m.metricCode"
                  style="font-size: 12px; margin: 4px 0; color: var(--text-2); display: flex; gap: 8px; align-items: center; flex-wrap: wrap"
                >
                  <span class="tag tag-red">指标</span>
                  <button type="button" class="btn-link" @click="go(m.path || metricsPath(m.metricCode))">
                    <code>{{ m.metricCode }}</code>
                  </button>
                  <span>{{ m.name || '' }}</span>
                  <span v-if="m.kind" class="muted">· {{ m.kind }}</span>
                  <span v-if="m.status" class="muted">· {{ m.status }}</span>
                  <span v-if="m.bindField" class="muted">· {{ m.bindField }}</span>
                </div>
              </div>
              <div v-if="failRules.length" style="margin-bottom: 10px">
                <div class="detail-section-title">最近失败规则</div>
                <div
                  v-for="f in failRules"
                  :key="f.ruleId || f.ruleCode"
                  style="font-size: 12px; margin: 4px 0; display: flex; gap: 8px; align-items: center"
                >
                  <code>{{ f.ruleCode }}</code>
                  <span class="muted">{{ f.fieldName || '整表' }}</span>
                  <button
                    v-if="f.lineagePath"
                    type="button"
                    class="btn-link"
                    @click="go(f.lineagePath)"
                  >上溯血缘</button>
                </div>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap">
                <button class="btn btn-sm" @click="goQuality">→ 数据质量</button>
                <button class="btn btn-sm" @click="goLineage">→ 字段血缘</button>
                <button class="btn btn-sm" @click="goMetrics">→ 指标中心</button>
                <button class="btn btn-sm" @click="goStandard">→ 数据标准</button>
                <button class="btn btn-sm" @click="goLifecycle">→ 生命周期</button>
              </div>
            </div>
          </div>
        </div>

        <div v-show="tab === 'preview'">
          <div class="detail-section-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            数据预览
            <span v-if="grantChecking" class="tag tag-gray">鉴权中…</span>
            <span v-else-if="canPreview" class="tag tag-green">{{ previewAuthLabel }}</span>
            <span v-else class="tag tag-orange">无查询权限</span>
            <span v-if="previewLoading" class="tag tag-gray">加载中…</span>
            <span v-else-if="useLivePreview" class="tag tag-blue">{{ previewSourceLabel || '预览' }}</span>
            <span v-else-if="previewLive && !previewLive.ok" class="tag tag-orange">未查到</span>
          </div>
          <div v-if="!canPreview && !grantChecking && previewLive?.source === 'denied'" style="font-size: 12px; color: var(--text-3); margin: 8px 0">
            看见≠能查：仅<strong>资产拥有者</strong>（技术/业务 Owner 或登记人）可直接预览；其他人须申请表级读权限，审批写入 <code>sec_auth_grant</code> 后方可预览。
            <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap">
              <button class="btn btn-sm btn-primary" @click="applyPerm">🔐 申请查询权限</button>
              <button class="btn btn-sm" @click="goApplyCenter">→ 申请中心</button>
            </div>
          </div>
          <template v-else>
            <div style="font-size: 12px; color: var(--text-3); margin: 8px 0">
              当前用户 <b>{{ user?.name || '—' }}</b>
              <template v-if="useLivePreview">
                · 按源类型探查（{{ previewSourceLabel }}）
                <code v-if="previewLive?.qualifiedName" style="margin-left: 6px">{{ previewLive.qualifiedName }}</code>
              </template>
              <template v-else-if="previewLoading">· 正在请求样例预览…</template>
              <template v-else>· 等待探查结果（对象/搜索/消息等走原生协议，仅湖表联邦走统一查询）</template>
            </div>
            <div v-if="previewHint" style="font-size: 12px; color: var(--text-3); margin: 6px 0">
              {{ previewHint }}
            </div>
            <div v-if="previewLive?.sql" style="font-size: 11px; font-family: monospace; color: var(--text-3); margin: 4px 0; word-break: break-all">
              {{ previewLive.sql }}
            </div>
            <div v-if="previewLoading" style="font-size: 12px; color: var(--text-3); padding: 16px 0">加载中…</div>
            <div v-else-if="!previewCols.length" style="font-size: 12px; color: var(--text-3); padding: 16px 0">
              {{
                previewLive?.source === 'denied'
                  ? '无权限，未查询数据。'
                  : isNonTableAsset
                    ? '暂无样例行。请确认数据源凭证与对象名；预览走源协议原生 API，不经过统一查询。'
                    : '暂无预览行。请确认资产已 refresh、源可达，或点击重新预览。'
              }}
            </div>
            <div v-else style="overflow: auto; margin-top: 8px">
              <table class="std-table" style="font-size: 12px">
                <thead>
                  <tr>
                    <th v-for="c in previewCols" :key="c.enName">{{ c.cnName || c.enName }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in previewRows" :key="ri">
                    <td v-for="c in previewCols" :key="c.enName">
                      {{ fmtCell(cellAt(row, c.enName)) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px">
              <button class="btn btn-sm" :disabled="previewLoading" @click="ensurePreview(asset.id, true)">
                ↻ 重新预览
              </button>
              <button v-if="!isNonTableAsset" class="btn btn-sm" @click="goQuery">→ 即席查询</button>
            </div>
          </template>
        </div>

        <div v-show="tab === 'perm'">
          <div class="detail-section-title">权限与脱敏</div>
          <div class="info-grid" style="margin-top: 10px">
            <div>
              <div class="info-label">当前身份</div>
              <div class="info-value">
                {{ user.name }}
                <span v-if="isSuperAdmin" class="tag tag-green" style="margin-left: 6px; font-size: 10px">superAdmin</span>
              </div>
            </div>
            <div>
              <div class="info-label">表级读权限</div>
              <div class="info-value">
                <span class="tag" :class="hasRead ? 'tag-green' : 'tag-orange'">
                  {{
                    isSuperAdmin
                      ? '✓ 超管短路'
                      : isOwner
                        ? '✓ 资产拥有者'
                        : hasRead
                          ? '✓ sec_auth_grant'
                          : grantChecking
                            ? '鉴权中…'
                            : '未授权（需申请）'
                  }}
                </span>
              </div>
            </div>
            <div>
              <div class="info-label">数据预览</div>
              <div class="info-value">
                <span class="tag" :class="canPreview ? 'tag-green' : 'tag-orange'">
                  {{ canPreview ? `✓ 允许（${previewAuthLabel}）` : '禁止 · 请申请' }}
                </span>
              </div>
            </div>
            <div>
              <div class="info-label">分级分类</div>
              <div class="info-value"><span class="tag" :class="asset.levelClass">{{ asset.level }}</span></div>
            </div>
            <div>
              <div class="info-label">查询 / 预览入口</div>
              <div class="info-value">
                {{
                  isNonTableAsset
                    ? '目录预览走源协议（对象/搜索/消息…）；分析联邦仅湖表走统一查询与元数据'
                    : '分析查询走统一查询与元数据；目录预览按源类型适配'
                }}
              </div>
            </div>
            <div>
              <div class="info-label">授权落点</div>
              <div class="info-value">apply_ticket → sec_auth_grant → Grav ACL（可投影 soft-fail）</div>
            </div>
          </div>
          <div style="margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap">
            <button v-if="!hasRead" class="btn btn-sm btn-primary" :disabled="grantChecking" @click="applyPerm">🔐 申请查询权限</button>
            <button v-else class="btn btn-sm btn-primary" @click="openPreviewTab">👁 查看数据预览</button>
            <button class="btn btn-sm" @click="goApplyCenter">→ 申请中心</button>
            <div style="font-size: 11px; color: var(--text-3); margin-top: 8px; width: 100%">
              规则：拥有者可直接预览；其他人申请通过后写入 sec_auth_grant（可投影 Grav ACL soft-fail）。
            </div>
            <button class="btn btn-sm" @click="go('/security')">→ 安全与权限</button>
            <button class="btn btn-sm" @click="goQuery">→ 即席查询</button>
          </div>
        </div>

      </div>
    </template>
  </AppDrawer>

  <div v-if="applyOpen" class="apply-mask" @click.self="applyOpen = false">
    <div class="apply-dialog" role="dialog" aria-modal="true" aria-label="申请表级读权限">
      <div class="apply-dialog__head">
        <strong>申请表级读权限</strong>
        <button type="button" class="btn btn-sm" @click="applyOpen = false">✕</button>
      </div>
      <p class="apply-dialog__asset">
        {{ asset?.cnName || asset?.name || asset?.key }}
        <code v-if="asset?.assetCode">{{ asset.assetCode }}</code>
      </p>
      <label class="form-field">
        <span class="form-label">时效</span>
        <select v-model="applyForm.expire" class="select" style="width: 100%">
          <option v-for="e in APPLY_EXPIRE_OPTIONS" :key="e" :value="e">{{ e }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">申请事由</span>
        <textarea
          v-model="applyForm.purpose"
          class="input"
          rows="3"
          placeholder="业务背景、访问场景、是否含敏感字段"
        />
      </label>
      <div class="apply-dialog__actions">
        <button type="button" class="btn btn-sm" :disabled="applyBusy" @click="goApplyCenter">去申请中心</button>
        <button type="button" class="btn btn-sm" :disabled="applyBusy" @click="submitApply(false)">仅提交</button>
        <button
          v-if="isSuperAdmin"
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="applyBusy"
          @click="submitApply(true)"
        >
          {{ applyBusy ? '处理中…' : '提交并生效' }}
        </button>
        <button
          v-else
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="applyBusy"
          @click="submitApply(false)"
        >
          {{ applyBusy ? '提交中…' : '提交申请' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field-meta-table th,
.field-meta-table td {
  white-space: nowrap;
}
.field-meta-table td:nth-child(3) {
  white-space: normal;
  min-width: 120px;
}
.om-meta-form .form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.om-meta-form .form-label {
  font-size: 11px;
  color: var(--text-3);
}
.om-meta-checks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.apply-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(20, 28, 40, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.apply-dialog {
  width: min(420px, 100%);
  background: var(--bg-1);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  padding: 16px 18px 18px;
}
.apply-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.apply-dialog__asset {
  font-size: 12px;
  color: var(--text-2);
  margin: 0 0 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.apply-dialog__asset code {
  font-size: 11px;
  color: var(--text-3);
}
.apply-dialog .form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.apply-dialog .form-label {
  font-size: 11px;
  color: var(--text-3);
}
.apply-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 14px;
}
.asset-see-hint {
  margin: 0 0 10px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-2);
  border-radius: 6px;
  background: color-mix(in srgb, var(--warning, #d97706) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning, #d97706) 28%, var(--border));
}
.asset-see-hint .btn-link {
  font-size: 12px;
}
</style>
