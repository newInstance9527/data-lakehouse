<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppDrawer from '@/components/common/AppDrawer.vue'
import { createApplyTicket, approveTicket } from '@/api/apply'
import { useAssets } from '@/composables/useAssets'
import { useDatasources } from '@/composables/useDatasources'
import { useSession, isNeedOwnerApplyError } from '@/composables/useSession'
import { useToast } from '@/composables/useToast'
import { confirmDelete } from '@/composables/useConfirmDelete'
import { APPLY_EXPIRE_OPTIONS } from '@/data/apply'
import { formatDataType, yesNo } from '@/utils/fieldSchema'
import { lineagePath, qualityPath } from '@/utils/moduleLinks'
import { displayUser } from '@/utils/displayUser'

const props = defineProps({
  asset: { type: Object, default: null },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'updated', 'deleted'])

const router = useRouter()
const { showToast } = useToast()
const { sources, getSource } = useDatasources()
const { loadSchema, loadDetail, refresh, updateMeta, loadPreview, removeAsset } = useAssets()
const { user, isSuperAdmin, canPreviewAsset, hasTableReadGrant, isAssetOwner, canEditAsset, canDeleteAsset, canManageAsset, refreshGrant, refreshManageGrant } = useSession()
const tab = ref('schema')
const schemaLoading = ref(false)
const schemaHint = ref('')
const schemaSource = ref('')
const localFields = ref(null)
const busy = ref(false)
const metaSaving = ref(false)
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
const failRules = computed(() => qualityExtra.value?.failRules || [])
const goldExtra = computed(() => props.asset?.extras?.gold || null)
const omMeta = computed(() => props.asset?.extras?.omMeta || null)
const canEditOmMeta = computed(() => !!props.asset?.omFqn)

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

function goLineage() {
  const a = props.asset
  const path =
    lineageExtra.value?.path ||
    lineagePath({ focus: a?.objectName || a?.tableName || a?.name, omFqn: a?.omFqn })
  go(path)
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
      return
    }
    syncMetaEditFromAsset()
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
    tab.value = 'schema'
    localFields.value = null
    schemaHint.value = ''
    schemaSource.value = ''
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
  trino: 'Trino',
  'gravitino+trino': 'Gravitino+Trino',
  gravitino: 'Gravitino',
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
    await ensureSchema(props.asset.id)
    showToast('已刷新对齐', 'success')
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(e.message || '无编辑权，请申请操作权限', 'warning')
      goApplyManage()
    } else {
      showToast(`刷新失败：${e.message || e}`, 'error')
    }
  } finally {
    busy.value = false
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
    showToast(`OM 元数据已保存${audit}`, 'success')
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
  const ok = await confirmDelete({
    title: `删除资产「${a.cnName || a.name || a.key || a.id}」`,
    message: '将软删门户资产登记与源绑定；不物理删除 OM/底层表数据。',
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
  router.push('/query')
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
          <button
            v-if="canEdit"
            class="btn btn-sm"
            :disabled="busy"
            title="刷新对齐"
            @click="doRefresh"
          >↻ 刷新</button>
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
          <span class="std-tab" :class="{ active: tab === 'schema' }" @click="tab = 'schema'">字段 Schema</span>
          <span class="std-tab" :class="{ active: tab === 'quality' }" @click="tab = 'quality'">质量</span>
          <span class="std-tab" :class="{ active: tab === 'preview' }" @click="tab = 'preview'">数据预览</span>
          <span class="std-tab" :class="{ active: tab === 'perm' }" @click="tab = 'perm'">权限 / 脱敏</span>
          <span class="std-tab" :class="{ active: tab === 'info' }" @click="tab = 'info'">基本信息</span>
        </div>

        <div v-show="tab === 'schema'">
          <div class="detail-section-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            {{ isNonTableAsset ? '对象 / 消息结构' : '字段定义' }} · {{ fields.length }} 列
            <span v-if="schemaLoading" class="tag tag-gray">加载中…</span>
            <span v-else-if="schemaSource" class="tag tag-blue">来源 {{ schemaSource }}</span>
            <span v-else-if="isNonTableAsset" class="tag tag-orange">非表</span>
            <span v-else class="tag tag-gray">待加载</span>
          </div>
          <div v-if="schemaHint" style="font-size: 12px; color: var(--text-3); margin-top: 6px">
            {{ schemaHint }}
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
                </tr>
              </thead>
              <tbody>
                  <tr v-if="!fields.length">
                  <td colspan="8" style="text-align: center; color: var(--text-3)">
                    {{ isNonTableAsset ? '无表字段（对象存储/消息等请看数据预览）' : '暂无字段结构' }}
                  </td>
                </tr>
                <tr v-for="c in fields" :key="c.enName">
                  <td>{{ c.cnName }}</td>
                  <td style="font-family: monospace; font-weight: 500">
                    <span v-if="c.pk">🔑 </span>{{ c.enName }}
                  </td>
                  <td style="color: var(--text-2)">{{ c.desc || '—' }}</td>
                  <td style="font-family: monospace; font-size: 11px; color: var(--primary)">
                    {{ formatDataType(c) }}
                  </td>
                  <td>{{ fmtCell(c.length) }}</td>
                  <td>{{ fmtCell(c.scale) }}</td>
                  <td>
                    <span :class="c.nullable ? 'tag tag-gray' : 'tag tag-orange'">{{ yesNo(c.nullable) }}</span>
                  </td>
                  <td>
                    <span :class="c.pk ? 'tag tag-blue' : 'tag tag-gray'">{{ yesNo(c.pk) }}</span>
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
              <div style="display: flex; gap: 8px">
                <button class="btn btn-sm" @click="goQuality">→ 数据质量</button>
                <button class="btn btn-sm" @click="goLineage">→ 字段血缘</button>
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
              <template v-else-if="previewLoading">· 正在请求 <code>/lh/catalog/assets/preview</code>…</template>
              <template v-else>· 等待探查结果（S3/ES/Kafka 等走原生 API，仅湖表/Trino 联邦才用 Trino）</template>
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
                    ? '暂无样例行。请确认数据源凭证与对象名；预览走 S3/ES 等原生 API，不经过 Trino。'
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
                      {{ fmtCell(row[c.enName]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px">
              <button class="btn btn-sm" :disabled="previewLoading" @click="ensurePreview(asset.id, true)">
                ↻ 重新预览
              </button>
              <button v-if="!isNonTableAsset" class="btn btn-sm" @click="goQuery">→ 即席查询（Trino）</button>
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
                    ? '目录预览走源协议（S3/ES/Kafka…）；分析联邦仅湖表走 Trino→Gravitino'
                    : '分析查询走 Trino→Gravitino；目录预览按源类型适配'
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

        <div v-show="tab === 'info'">
          <div class="detail-section-title">基本信息</div>
          <div class="info-grid" style="margin-top: 10px">
            <div><div class="info-label">物理名 / 编码</div><div class="info-value" style="font-family: monospace">{{ asset.key }}</div></div>
            <div>
              <div class="info-label">分层 / 域</div>
              <div class="info-value">
                <span class="asset-layer" :class="`layer-${asset.layer}`">{{ asset.layerLabel }}</span>
                · {{ asset.domainLabel }}
              </div>
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
            仅<strong>资产拥有者</strong>（或已授 EDIT/MANAGE）可写 OM 元数据 / 刷新对齐。
            <button type="button" class="btn-link" @click="goApplyManage">去申请操作权限</button>
          </div>
          <div v-else-if="!canEditOmMeta" style="font-size: 12px; color: var(--text-3); margin: 8px 0">
            资产尚未对齐 OpenMetadata。请先点「刷新」完成门户清单→OM，再编辑描述与标签。
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
</style>
