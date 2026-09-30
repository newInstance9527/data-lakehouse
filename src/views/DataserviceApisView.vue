<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import SqlEditor from '@/components/etl/SqlEditor.vue'
import ApiOnlineDebugPanel from '@/components/dataservice/ApiOnlineDebugPanel.vue'
import ApiDocDrawer from '@/components/dataservice/ApiDocDrawer.vue'
import RegisterBindingModal from '@/components/dataservice/RegisterBindingModal.vue'
import SubscriptionKeySecretPanel from '@/components/dataservice/SubscriptionKeySecretPanel.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useDataservice } from '@/composables/useDataservice'
import { useActionLock } from '@/composables/useActionLock'
import { useSession } from '@/composables/useSession'
import { pageGuideOf } from '@/data/pageGuides'
import { routeStatusMeta, routeOfApi } from '@/data/dataservice'
import { apiLifecycleMeta, publishTicketStatusLabel } from '@/utils/dataserviceUi'
import { formatDateTime } from '@/utils/datetime'
import '@/styles/dataservice-page.css'
import {
  FIELD_TRANSFORM_OPTIONS,
  RESPONSE_FORMAT_OPTIONS,
  RESPONSE_SHAPE_OPTIONS,
} from '@/data/apiBuild'
import {
  unpublishDataapi,
  deleteDataapi,
  fetchDataapiVersions,
  rollbackDataapi,
  updateDataapiTags,
} from '@/api/dataapi'

const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const { busy, run: runLocked } = useActionLock()
const guide = pageGuideOf('dataservice-apis')
const {
  apis,
  routes,
  apiKeys,
  callRank,
  degraded,
  workbench,
  ensureLoaded,
  openDetail,
  runSyncFromSqlrest,
  runRegister,
  exportOpenapi,
} = useDataservice()

const { currentWs, user, isSuperAdmin } = useSession()

onMounted(() => ensureLoaded(true))

watch(currentWs, () => {
  ensureLoaded(true).catch(() => {})
})

const apiSearch = ref('')
const selectedTags = ref([])
const tagDraft = ref('')
const tagsSaving = ref(false)
const registerOpen = ref(false)

const detailOpen = ref(false)
const detail = ref(null)
const docOpen = ref(false)
const debugOpen = ref(false)
const keyDetailOpen = ref(false)
const keyDetail = ref(null)
const keySecretPanel = ref(null)
const versionRows = ref([])
const versionsLoading = ref(false)
const versionsError = ref('')
const versionBusy = ref(false)

const assignmentList = computed(() => {
  const a = workbench.value?.assignments
  if (Array.isArray(a?.data)) return a.data
  if (Array.isArray(a)) return a
  return []
})

watch(
  () => route.query.q,
  (q) => {
    if (q != null && q !== '') apiSearch.value = String(q)
  },
  { immediate: true },
)

function apiTags(a) {
  const t = a?.tags
  return Array.isArray(t) ? t.filter((x) => x != null && String(x).trim()) : []
}

const catalogTags = computed(() => {
  const set = new Set()
  for (const a of apis.value || []) {
    for (const t of apiTags(a)) set.add(String(t))
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'))
})

const filteredApis = computed(() => {
  const f = apiSearch.value.trim().toLowerCase()
  const tags = selectedTags.value
  return (apis.value || []).filter((a) => {
    if (tags.length) {
      const own = apiTags(a).map(String)
      if (!tags.every((t) => own.includes(t))) return false
    }
    if (!f) return true
    const tagHit = apiTags(a).some((t) => String(t).toLowerCase().includes(f))
    return (
      tagHit ||
      (a.path || '').toLowerCase().includes(f) ||
      (a.name || '').toLowerCase().includes(f) ||
      (a.domain || '').toLowerCase().includes(f) ||
      (a.asset && a.asset !== '-' && a.asset.toLowerCase().includes(f)) ||
      (a.metric && a.metric !== '-' && a.metric.toLowerCase().includes(f))
    )
  })
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredApis)
watch([apiSearch, selectedTags], () => resetPage())

function toggleTagFilter(tag) {
  const cur = selectedTags.value
  if (cur.includes(tag)) selectedTags.value = cur.filter((t) => t !== tag)
  else selectedTags.value = [...cur, tag]
}

function clearTagFilter() {
  selectedTags.value = []
}

async function persistDetailTags(nextTags) {
  if (!detail.value?.id) return
  tagsSaving.value = true
  try {
    const res = await updateDataapiTags({ id: detail.value.id, tags: nextTags })
    const tags = Array.isArray(res?.tags) ? res.tags : nextTags
    detail.value = { ...detail.value, tags, ...(res?.binding || {}) }
    const idx = (apis.value || []).findIndex((a) => a.id === detail.value.id)
    if (idx >= 0) {
      const next = [...apis.value]
      next[idx] = { ...next[idx], tags }
      apis.value = next
    }
    showToast(res?.message || '标签已更新', 'success')
  } catch (e) {
    showToast(`标签更新失败：${e?.message || e}`, 'warning')
  } finally {
    tagsSaving.value = false
  }
}

async function addDetailTag() {
  const raw = tagDraft.value.trim()
  if (!raw || !detail.value?.id) return
  const cur = apiTags(detail.value)
  if (cur.includes(raw)) {
    tagDraft.value = ''
    return
  }
  if (cur.length >= 20) {
    showToast('最多 20 个标签', 'warning')
    return
  }
  await persistDetailTags([...cur, raw.slice(0, 32)])
  tagDraft.value = ''
}

async function removeDetailTag(tag) {
  if (!detail.value?.id) return
  await persistDetailTags(apiTags(detail.value).filter((t) => t !== tag))
}

const detailSubs = computed(() => {
  if (!detail.value) return []
  const path = detail.value.path
  const bid = detail.value.id
  return (apiKeys.value || []).filter((s) => (bid && s.bindingId === bid) || (path && s.api === path))
})
const detailRoute = computed(() => {
  if (!detail.value) return null
  return (
    routes.value.find((r) => r.path === detail.value.path) || routeOfApi(detail.value.path, routes.value)
  )
})
const detailCallStat = computed(() => {
  if (!detail.value?.path) return null
  return (callRank.value || []).find((r) => r.name === detail.value.path) || null
})
const detailStateMeta = computed(() => apiLifecycleMeta(detail.value))

const formatLabel = computed(() => {
  const v = detail.value?.responseFormat
  return RESPONSE_FORMAT_OPTIONS.find((o) => o.value === v)?.label || v || '统一封装'
})
const shapeLabel = computed(() => {
  const v = detail.value?.responseShape
  return RESPONSE_SHAPE_OPTIONS.find((o) => o.value === v)?.label || v || '列表'
})

function transformLabel(v) {
  return FIELD_TRANSFORM_OPTIONS.find((o) => o.value === v)?.label || v || '原样'
}

function buildApi() {
  router.push('/dataservice/build')
}

function openWorkbench(bindingId) {
  const id = bindingId != null && bindingId !== '' ? String(bindingId) : ''
  router.push(id ? `/dataservice/build/${id}` : '/dataservice/build')
}

async function loadVersions(bindingId) {
  if (!bindingId) {
    versionRows.value = []
    versionsError.value = ''
    return
  }
  versionsLoading.value = true
  versionsError.value = ''
  try {
    const pack = await fetchDataapiVersions(bindingId)
    const rows = Array.isArray(pack?.versions) ? pack.versions : []
    versionRows.value = rows.map((v) => ({
      ...v,
      createTime: formatDateTime(v.createTime, { empty: '' }),
    }))
    if (pack?.ok === false && pack?.message) versionsError.value = String(pack.message)
  } catch (e) {
    versionRows.value = []
    versionsError.value = e?.message || String(e)
  } finally {
    versionsLoading.value = false
  }
}


function canDeleteDetail(row) {
  if (!row?.id) return false
  if (row.canDelete === true) return true
  if (isSuperAdmin.value) return true
  const identities = [user.value?.id, user.value?.account, user.value?.name]
    .map((x) => String(x || '').trim().toLowerCase())
    .filter(Boolean)
  const owners = [row.createUser, row.owner, row.ownerUser]
    .map((x) => String(x || '').trim().toLowerCase())
    .filter(Boolean)
  return owners.some((o) => identities.includes(o) || identities.some((i) => o.startsWith(i + '(')))
}

async function doDelete() {
  if (!detail.value?.id) return
  if (detail.value.state === 'published') {
    showToast('请先「取消发布」回草稿后再删除', 'warning')
    return
  }
  if (!canDeleteDetail(detail.value)) {
    showToast('仅创建人/负责人或超管可删除', 'warning')
    return
  }
  const name = detail.value.name || detail.value.path || detail.value.id
  const tip =
    `确认删除 API「${name}」？\n` +
    `将软删门户绑定，并同步 SQLREST 下线；关联订阅 Key 一并吊销。\n` +
    `此操作不可从门户目录恢复。`
  if (!confirm(tip)) return
  versionBusy.value = true
  try {
    const res = await deleteDataapi(detail.value.id)
    showToast(res?.message || '已删除', res?.ok === false ? 'warning' : 'success')
    detailOpen.value = false
    detail.value = null
    await ensureLoaded(true)
  } catch (e) {
    showToast(`删除失败：${e?.message || e}`, 'warning')
  } finally {
    versionBusy.value = false
  }
}

async function doUnpublish() {
  if (!detail.value?.id || detail.value.state !== 'published') return
  if (!confirm('取消发布后网关将下线，接口回草稿。修改后需重新申请发布。确认？')) return
  versionBusy.value = true
  try {
    const res = await unpublishDataapi(detail.value.id)
    const binding = res?.binding
    if (binding) detail.value = { ...detail.value, ...binding }
    else detail.value = { ...detail.value, state: 'draft', publishTicketNo: '', publishTicketStatus: '' }
    showToast(res?.message || '已取消发布，可编辑后重新申请发布', 'success')
    await ensureLoaded(true)
    await loadVersions(detail.value.id)
  } catch (e) {
    showToast(`取消发布失败：${e?.message || e}`, 'warning')
  } finally {
    versionBusy.value = false
  }
}

async function doRollback(row) {
  if (!detail.value?.id || !row?.commitId) return
  const verLabel = row.version != null ? `v${row.version}` : `commit ${row.commitId}`
  const tip =
    detail.value.state === 'published'
      ? `将线上流量回退到 ${verLabel}，确认？`
      : `将版本指针切到 ${verLabel}（草稿，申请发布后生效），确认？`
  if (!confirm(tip)) return
  versionBusy.value = true
  try {
    const res = await rollbackDataapi(detail.value.id, row.commitId, row.version)
    const binding = res?.binding
    if (binding) detail.value = { ...detail.value, ...binding }
    showToast(res?.message || `已回退到 ${verLabel}`, 'success')
    await ensureLoaded(true)
    await loadVersions(detail.value.id)
  } catch (e) {
    showToast(`回退失败：${e?.message || e}`, 'warning')
  } finally {
    versionBusy.value = false
  }
}

function openOnlineDebug() {
  if (!detail.value?.id) {
    showToast('请先打开有效的 API 详情', 'warning')
    return
  }
  debugOpen.value = true
}

function closeOnlineDebug() {
  debugOpen.value = false
}

function goApply(apiPath) {
  router.push({ path: '/apply', query: { type: 'api', path: apiPath || undefined } })
}

function goApplyTicket(ticketNo) {
  router.push({
    path: '/apply',
    query: ticketNo ? { tab: 'api_publish', ticket: ticketNo } : { tab: 'api_publish' },
  })
}

function openKeyDetail(s) {
  keyDetail.value = s
  keyDetailOpen.value = true
}

function closeKeyDetail() {
  keyDetailOpen.value = false
  keySecretPanel.value?.remask?.()
}

function openApiFromKey(s) {
  closeKeyDetail()
  if (s?.bindingId) {
    const hit = apis.value.find((a) => a.id === s.bindingId)
    if (hit) {
      openApiDetail(hit)
      return
    }
  }
  if (s?.api && s.api !== '-') {
    const hit = apis.value.find((a) => a.path === s.api)
    if (hit) openApiDetail(hit)
    else showToast(`未找到绑定 ${s.api}`, 'info')
  }
}

async function syncFromSqlrest() {
  await runLocked('sync', async () => {
    try {
      const r = await runSyncFromSqlrest()
      showToast(
        `已从接口服务同步 · 写入 ${r?.upserted ?? 0} · 跳过 ${r?.skipped ?? 0}`,
        'success',
      )
    } catch (e) {
      showToast(`同步失败：${e?.message || e}`, 'warning')
    }
  })
}

async function onRegister(payload) {
  try {
    const r = await runRegister(payload)
    registerOpen.value = false
    showToast('登记成功', 'success')
    if (r?.binding) openApiDetail(r.binding)
  } catch (e) {
    showToast(`登记失败：${e?.message || e}`, 'warning')
  }
}

async function openApiDetail(a) {
  detail.value = a
  detailOpen.value = true
  tagDraft.value = ''
  versionRows.value = []
  versionsError.value = ''
  const full = await openDetail(a)
  if (full) detail.value = full
  if (detail.value?.id) loadVersions(detail.value.id)
}

watch(
  () => [route.query.open, apis.value],
  async ([openId]) => {
    if (!openId) return
    const hit = (apis.value || []).find((a) => String(a.id) === String(openId))
    if (hit) await openApiDetail(hit)
  },
  { immediate: true },
)

function closeApiDetail() {
  detailOpen.value = false
  debugOpen.value = false
  versionRows.value = []
  versionsError.value = ''
}

function copyPath() {
  const t = detail.value?.path
  if (!t) return
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).then(() => showToast('已复制路径', 'success'))
  } else {
    showToast(t, 'info')
  }
}

function goAsset(asset) {
  if (!asset || asset === '-') return
  router.push({ path: '/catalog', query: { q: asset } })
}

async function downloadOpenapi(id) {
  try {
    await exportOpenapi({
      id,
      filename: id ? `openapi-${id}.json` : undefined,
    })
    showToast('已导出 OpenAPI', 'success')
  } catch (e) {
    showToast(`导出失败：${e?.message || e}`, 'warning')
  }
}

async function openApiDoc(api) {
  if (api) detail.value = api
  if (!detail.value) return
  docOpen.value = true
  // 尽量拉全量详情，便于文档含参数/响应
  try {
    const full = await openDetail(detail.value)
    if (full) detail.value = full
  } catch {
    /* 降级用列表卡字段 */
  }
}

function closeApiDoc() {
  docOpen.value = false
}
</script>

<template>
  <div class="ds-page">
    <PageHeader
      page-id="dataservice-apis"
      title="API 目录"
      subtitle="已发布 / 已绑定 · 同步 · 登记 · 详情调试"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm btn-primary" @click="buildApi">构建 API</button>
      <button type="button" class="btn btn-sm" :disabled="busy('sync')" @click="syncFromSqlrest">{{ busy('sync') ? '同步中…' : '同步接口目录' }}</button>
      <button type="button" class="btn btn-sm" @click="registerOpen = true">登记绑定</button>
      <button type="button" class="btn btn-sm" @click="downloadOpenapi()">导出 OpenAPI</button>
      <button type="button" class="btn btn-sm" @click="goApply()">申请调用凭证</button>
    </PageHeader>

    <RegisterBindingModal
      :open="registerOpen"
      :assignments="assignmentList"
      @close="registerOpen = false"
      @submit="onRegister"
    />
    <p v-if="degraded" class="tip" style="margin: 0 0 12px">后端暂不可达，列表为空</p>

    <div class="card ds-api-card">
      <div class="card-header">
        <div class="card-title">
          已发布 / 已绑定 API
          <span class="tip" style="font-weight: 400; margin-left: 8px">共 {{ total }} 条</span>
        </div>
        <input
          v-model="apiSearch"
          class="input input-sm ds-search"
          type="search"
          placeholder="搜索 API 名 / 资产 / 域 / 标签"
        />
      </div>
      <div v-if="catalogTags.length || selectedTags.length" class="ds-tag-filters">
        <span class="tip">标签</span>
        <button
          type="button"
          class="tag ds-tag-filter"
          :class="{ active: !selectedTags.length }"
          @click="clearTagFilter"
        >
          全部
        </button>
        <button
          v-for="t in catalogTags"
          :key="t"
          type="button"
          class="tag tag-blue ds-tag-filter"
          :class="{ active: selectedTags.includes(t) }"
          @click="toggleTagFilter(t)"
        >
          {{ t }}
        </button>
        <button
          v-if="selectedTags.length"
          type="button"
          class="btn btn-sm"
          @click="clearTagFilter"
        >
          清除
        </button>
      </div>
      <div class="card-body ds-api-grid-wrap">
        <div v-if="paged.length" class="ds-api-grid">
          <div
            v-for="a in paged"
            :key="a.id || a.path"
            class="api-card"
            role="button"
            tabindex="0"
            @click="openApiDetail(a)"
            @keydown.enter="openApiDetail(a)"
          >
            <div class="ac-line1">
              <span class="ac-method" :class="a.method">{{ a.method }}</span>
              <span class="ac-path">{{ a.path }}</span>
            </div>
            <div class="ac-name">
              {{ a.name }}
              <span v-if="a.metric && a.metric !== '-'" class="tag tag-red ac-metric">{{ a.metric }}</span>
            </div>
            <div class="ac-desc">{{ a.desc }}</div>
            <div v-if="apiTags(a).length" class="ac-tags">
              <span v-for="t in apiTags(a)" :key="t" class="tag tag-blue">{{ t }}</span>
            </div>
            <div class="ac-foot">
              <span>{{ a.sub || 0 }} 订阅 · {{ a.rt || '—' }} · {{ a.qps || '—' }} QPS</span>
              <span class="tag" :class="a.levelCls">{{ a.level || a.state || '—' }}</span>
            </div>
            <div class="ac-bind">
              绑定：
              <button
                v-if="a.asset && a.asset !== '-'"
                type="button"
                class="btn-link"
                @click.stop="goAsset(a.asset)"
              >
                资产 →
              </button>
              <span v-else class="muted">无</span>
              <button type="button" class="btn-link" style="margin-left: 8px" @click.stop="openApiDoc(a)">
                查看文档
              </button>
            </div>
          </div>
        </div>
        <div v-else class="ds-empty">
          暂无绑定 · 请先在接口工作台构建，再「同步接口目录」或「登记绑定」
        </div>
      </div>
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

    <AppDrawer
      :open="detailOpen"
      storage-key="dataservice-api-detail-width"
      :default-width="600"
      @close="closeApiDetail"
    >
      <div v-if="detail" class="drawer-body">
      <div class="api-detail">
        <div class="detail-head">
          <div>
            <div class="detail-title">{{ detail.name || detail.path || 'API 详情' }}</div>
            <div class="tip">API 详情 · {{ detail.domain || '未分域' }} · {{ detail.publishEnv || '—' }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeApiDetail">✕</button>
        </div>

        <div class="detail-endpoint">
          <span class="ac-method" :class="detail.method">{{ detail.method }}</span>
          <code class="detail-path">{{ detail.path }}</code>
          <div class="detail-endpoint-meta">
            <span class="tag" :class="detailStateMeta.cls">{{ detailStateMeta.label }}</span>
            <button type="button" class="btn btn-sm" @click="copyPath">复制路径</button>
          </div>
        </div>

        <div class="detail-sec-title">基本信息</div>
        <div class="detail-kv">
          <div><span>名称</span><div>{{ detail.name || '—' }}</div></div>
          <div>
            <span>状态</span>
            <div><span class="tag" :class="detailStateMeta.cls">{{ detailStateMeta.label }}</span></div>
          </div>
          <div><span>业务域</span><div>{{ detail.domain || '—' }}</div></div>
          <div><span>环境</span><div>{{ detail.publishEnv || '—' }}</div></div>
          <div><span>鉴权</span><div>{{ detail.auth || 'Token · X-App-Key + Bearer' }}</div></div>
          <div><span>引擎</span><div>{{ detail.engine || detail.sqlrest?.engine || 'SQL/Groovy' }}</div></div>
          <div><span>负责人</span><div>{{ detail.owner || '—' }}</div></div>
          <div><span>全局限流</span><div>{{ detail.qps }} QPS · Burst {{ detail.burst || '—' }}</div></div>
          <div>
            <span>版本</span>
            <div>
              <template v-if="detail.sqlrestVersion != null">v{{ detail.sqlrestVersion }}</template>
              <template v-else>—</template>
              <span class="tip"> · rev {{ detail.revision ?? 1 }}</span>
            </div>
          </div>
          <div v-if="detail.metric && detail.metric !== '-'"><span>指标</span><div><code>{{ detail.metric }}</code></div></div>
          <div v-if="detail.datasourceLabel || detail.datasourceId || detail.portalDsId">
            <span>数据源</span>
            <div><code>{{ detail.datasourceLabel || detail.datasourceId || detail.portalDsId }}</code></div>
          </div>
          <div v-if="detail.asset && detail.asset !== '-'">
            <span>资产</span>
            <div>
              <button type="button" class="btn-link" @click="goAsset(detail.asset)">{{ detail.asset }} →</button>
            </div>
          </div>
          <div><span>创建时间</span><div>{{ formatDateTime(detail.createTime) }}</div></div>
          <div><span>更新时间</span><div>{{ formatDateTime(detail.updateTime) }}</div></div>
          <div class="wide"><span>说明</span><div>{{ detail.desc || '—' }}</div></div>
          <div class="wide">
            <span>自定义标签</span>
            <div class="ds-detail-tags">
              <span
                v-for="t in apiTags(detail)"
                :key="t"
                class="tag tag-blue ds-tag-chip"
              >
                {{ t }}
                <button
                  type="button"
                  class="ds-tag-x"
                  :disabled="tagsSaving"
                  :title="`移除 ${t}`"
                  @click="removeDetailTag(t)"
                >
                  ×
                </button>
              </span>
              <span v-if="!apiTags(detail).length" class="muted">暂无</span>
              <input
                v-model="tagDraft"
                class="ds-tag-input"
                type="text"
                maxlength="32"
                placeholder="新标签"
                :disabled="tagsSaving || !detail.id"
                @keyup.enter="addDetailTag"
              />
              <button
                type="button"
                class="btn btn-sm"
                :disabled="tagsSaving || !detail.id || !tagDraft.trim()"
                @click="addDetailTag"
              >
                {{ tagsSaving ? '保存中…' : '＋ 添加' }}
              </button>
            </div>
          </div>
        </div>

        <div class="detail-sec-title">发布与工单</div>
        <div class="detail-kv">
          <div>
            <span>发布申请号</span>
            <div>
              <button
                v-if="detail.publishTicketNo"
                type="button"
                class="btn-link"
                @click="goApplyTicket(detail.publishTicketNo)"
              >
                {{ detail.publishTicketNo }}
              </button>
              <span v-else>—</span>
            </div>
          </div>
          <div>
            <span>审核状态</span>
            <div>{{ publishTicketStatusLabel(detail.publishTicketStatus) }}</div>
          </div>
          <div><span>发布时间</span><div>{{ formatDateTime(detail.publishedAt) }}</div></div>
          <div v-if="detail.lastError" class="wide">
            <span>最近错误</span>
            <div class="ds-reject-cell">{{ detail.lastError }}</div>
          </div>
          <div
            v-if="detail.publishTicketStatus === 'rejected' && detail.publishTicketRemark"
            class="wide"
          >
            <span>驳回意见</span>
            <div class="ds-reject-box">{{ detail.publishTicketRemark }}</div>
          </div>
        </div>
        <div class="detail-inline-actions">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="!detail.id"
            :title="detail.state === 'published' ? '已发布为只读，取消发布后方可编辑' : ''"
            @click="openWorkbench(detail.id)"
          >
            {{ detail.state === 'published' ? '查看工作台' : '打开工作台' }}
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="!detail.id"
            @click="openOnlineDebug"
          >
            在线调试
          </button>
          <button type="button" class="btn btn-sm" @click="openApiDoc(detail)">
            查看文档
          </button>
          <button
            v-if="detail.state === 'published'"
            type="button"
            class="btn btn-sm"
            :disabled="!detail.id || versionBusy"
            @click="doUnpublish"
          >
            {{ versionBusy ? '处理中…' : '取消发布' }}
          </button>
          <button
            v-if="detail.state !== 'published' && detail.state !== 'retired'"
            type="button"
            class="btn btn-sm"
            :disabled="!detail.id"
            @click="openWorkbench(detail.id)"
          >
            {{ detail.publishTicketStatus === 'rejected' ? '改后重新申请发布' : '申请发布' }}
          </button>
          <button
            v-if="detail.publishTicketNo"
            type="button"
            class="btn btn-sm"
            @click="goApplyTicket(detail.publishTicketNo)"
          >
            查看发布申请
          </button>
          <button
            v-if="canDeleteDetail(detail) && detail.state !== 'published'"
            type="button"
            class="btn btn-sm"
            style="color: var(--danger, #c44)"
            :disabled="!detail.id || versionBusy"
            @click="doDelete"
          >
            {{ versionBusy ? '处理中…' : '删除' }}
          </button>
        </div>
        <p v-if="detail.state === 'published'" class="detail-note">
          已发布接口不可直接改定义或删除。请先「取消发布」回草稿，编辑后重新申请发布（版本号递增）；也可在下方回退历史版本。删除仅创建人/负责人或超管。
        </p>
        <p v-else-if="canDeleteDetail(detail)" class="detail-note">
          删除将软删门户绑定并同步 SQLREST 下线、吊销订阅 Key；已发布须先取消发布。
        </p>

        <div class="detail-sec-title">
          发布版本
          <button
            type="button"
            class="btn btn-sm"
            :disabled="!detail.id || versionsLoading"
            @click="loadVersions(detail.id)"
          >
            {{ versionsLoading ? '刷新中…' : '刷新' }}
          </button>
        </div>
        <p class="tip detail-empty" style="margin-top: 0">
          每次成功发布生成新版本；回退将 deploy 到历史 commit。
        </p>
        <p v-if="versionsError" class="tip" style="color: var(--danger, #c44)">{{ versionsError }}</p>
        <table v-if="versionRows.length" class="table detail-table">
          <thead>
            <tr>
              <th>版本</th>
              <th>说明</th>
              <th>时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in versionRows" :key="String(v.commitId || v.version)">
              <td>
                <code>v{{ v.version ?? '—' }}</code>
                <span v-if="v.current" class="tag tag-green" style="margin-left: 6px; font-size: 10px">当前</span>
              </td>
              <td style="font-size: 12px">{{ v.description || '—' }}</td>
              <td style="font-size: 12px">{{ formatDateTime(v.createTime) }}</td>
              <td>
                <button
                  v-if="!v.current && v.commitId"
                  type="button"
                  class="btn btn-sm"
                  :disabled="versionBusy || detail.state === 'retired'"
                  @click="doRollback(v)"
                >
                  回退
                </button>
                <span v-else class="tip">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!versionsLoading" class="detail-empty-box">暂无版本历史（首次发布后可见）</p>

        <div class="detail-sec-title">调用侧</div>
        <p class="tip detail-empty" style="margin-top: 0">
          已发布接口可在申请中心提交「API 调用申请」；通过后签发订阅 Key（X-App-Key + Bearer）。详情支持按权限「查看密钥」从 Vault 回显。
        </p>
        <div class="detail-inline-actions">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="detail.state !== 'published'"
            :title="detail.state !== 'published' ? '需先发布上线' : ''"
            @click="goApply(detail.path)"
          >
            申请调用凭证
          </button>
        </div>
        <table v-if="detailSubs.length" class="table detail-table" style="margin-top: 10px">
          <thead>
            <tr>
              <th>应用</th>
              <th>AppKey</th>
              <th>配额</th>
              <th>状态</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in detailSubs" :key="'s' + i">
              <td>{{ s.app || s.name }}</td>
              <td><code>{{ s.appKeyMasked || s.appKey }}</code></td>
              <td>{{ s.qps || '—' }} QPS</td>
              <td><span class="tag" :class="s.cls">{{ s.status }}</span></td>
              <td>
                <button type="button" class="btn btn-sm" @click="openKeyDetail(s)">详情</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="detail-empty-box">暂无订阅 Key · 发布后可申请调用凭证</p>

        <div class="detail-sec-title">技术内容（只读）</div>
        <div class="detail-kv" style="margin-bottom: 8px">
          <div>
            <span>响应封装</span>
            <div>{{ formatLabel }} / {{ shapeLabel }}</div>
          </div>
          <div v-if="detailCallStat">
            <span>调用量（Top）</span>
            <div>{{ detailCallStat.calls }} 次</div>
          </div>
        </div>
        <SqlEditor
          v-if="detail.sql"
          :model-value="detail.sql"
          readonly
          compact
          :rows="6"
          label="SQL / Groovy"
          hint="深编请回工作台"
        />
        <p v-else class="detail-empty-box">正文在接口服务；点下方打开工作台</p>

        <div class="detail-sec-title">
          入参
          <span v-if="detail.params?.length" class="sec-count">{{ detail.params.length }} 个</span>
        </div>
        <table v-if="detail.params?.length" class="table detail-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>必填</th>
              <th>示例</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in detail.params" :key="'p' + i">
              <td><code>{{ p.name }}</code></td>
              <td>{{ p.type }}</td>
              <td>
                <span v-if="p.required" class="tag tag-orange" style="font-size: 10px">必填</span>
                <span v-else class="tip">否</span>
              </td>
              <td>{{ p.example || '—' }}</td>
              <td>{{ p.desc || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="detail-empty-box">未配置入参</p>

        <div class="detail-sec-title">
          出参映射
          <span v-if="detail.responses?.length" class="sec-count">{{ detail.responses.length }} 个</span>
        </div>
        <table v-if="detail.responses?.length" class="table detail-table">
          <thead>
            <tr>
              <th>SQL 列</th>
              <th>出参</th>
              <th>类型</th>
              <th>转换</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in detail.responses" :key="'r' + i">
              <td><code>{{ r.source || r.name }}</code></td>
              <td><code>{{ r.name }}</code></td>
              <td>{{ r.type }}</td>
              <td>{{ transformLabel(r.transform) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="detail-empty-box">未配置出参映射</p>

        <div class="detail-sec-title">边缘路由</div>
        <div v-if="detailRoute" class="detail-route">
          <div><span>匹配</span><code>{{ detailRoute.path }}</code></div>
          <div><span>上游</span>{{ detailRoute.upstream }}</div>
          <div>
            <span>状态</span>
            <span class="tag" :class="routeStatusMeta(detailRoute.status).tag">
              {{ routeStatusMeta(detailRoute.status).label }}
            </span>
          </div>
          <div v-if="detailRoute.note" class="wide tip">{{ detailRoute.note }}</div>
        </div>
        <p v-else class="detail-empty-box">未匹配到边缘路由记录（未发布或未同步）</p>

        <div class="detail-actions">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="!detail.id"
            :title="detail.state === 'published' ? '已发布为只读，取消发布后方可编辑' : ''"
            @click="openWorkbench(detail.id)"
          >
            {{ detail.state === 'published' ? '查看工作台' : '打开工作台' }}
          </button>
          <button
            v-if="detail.state === 'published'"
            type="button"
            class="btn btn-sm"
            :disabled="!detail.id || versionBusy"
            @click="doUnpublish"
          >
            取消发布
          </button>
          <button type="button" class="btn btn-sm" @click="openApiDoc(detail)">查看文档</button>
          <button type="button" class="btn btn-sm" @click="downloadOpenapi(detail.id)">导出 OpenAPI</button>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="detail.state !== 'published'"
            @click="goApply(detail.path)"
          >
            申请调用凭证
          </button>
          <button
            v-if="canDeleteDetail(detail) && detail.state !== 'published'"
            type="button"
            class="btn btn-sm"
            style="color: var(--danger, #c44)"
            :disabled="!detail.id || versionBusy"
            @click="doDelete"
          >
            {{ versionBusy ? '处理中…' : '删除' }}
          </button>
          <button
            v-if="detail.asset && detail.asset !== '-'"
            type="button"
            class="btn btn-sm"
            @click="goAsset(detail.asset)"
          >
            查看资产
          </button>
        </div>
      </div>
      </div>
    </AppDrawer>

    <ApiDocDrawer :open="docOpen" :detail="detail" @close="closeApiDoc" />

    <AppDrawer
      :open="debugOpen"
      storage-key="dataservice-api-debug-width"
      :default-width="600"
      @close="closeOnlineDebug"
    >
      <div v-if="detail && debugOpen" class="drawer-body detail-debug-shell">
        <div class="detail-head">
          <div>
            <div class="detail-title">在线调试</div>
            <div class="tip">{{ detail.name || detail.path }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeOnlineDebug">✕</button>
        </div>
        <div class="detail-endpoint">
          <span class="ac-method" :class="detail.method">{{ detail.method }}</span>
          <code class="detail-path">{{ detail.path }}</code>
          <div class="detail-endpoint-meta">
            <span class="tag" :class="detailStateMeta.cls">{{ detailStateMeta.label }}</span>
          </div>
        </div>
        <ApiOnlineDebugPanel :detail="detail" :keys="detailSubs" />
      </div>
    </AppDrawer>

    <AppDrawer
      :open="keyDetailOpen"
      storage-key="dataservice-key-detail-width"
      :default-width="480"
      @close="closeKeyDetail"
    >
      <div v-if="keyDetail" class="drawer-body">
      <div class="api-detail">
        <div class="detail-head">
          <div>
            <div class="detail-title">订阅 Key 详情</div>
            <div class="tip">{{ keyDetail.name || keyDetail.app }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeKeyDetail">✕</button>
        </div>
        <div class="detail-kv">
          <div>
            <span>应用 / 名称</span>
            <div>{{ keyDetail.app || keyDetail.name || '—' }}</div>
          </div>
          <div>
            <span>状态</span>
            <div><span class="tag" :class="keyDetail.cls">{{ keyDetail.status }}</span></div>
          </div>
          <div class="wide">
            <span>关联 API</span>
            <div>
              <span v-if="keyDetail.method" class="ac-method" :class="keyDetail.method">{{ keyDetail.method }}</span>
              <code>{{ keyDetail.api }}</code>
              <button
                v-if="keyDetail.api && keyDetail.api !== '-'"
                type="button"
                class="btn btn-sm"
                style="margin-left: 8px"
                @click="openApiFromKey(keyDetail)"
              >
                打开 API
              </button>
            </div>
          </div>
          <div><span>申请人</span><div>{{ keyDetail.applicantName || keyDetail.applicant || keyDetail.user || '—' }}</div></div>
          <div><span>配额</span><div>{{ keyDetail.qps || '—' }} QPS</div></div>
          <div><span>时效</span><div>{{ formatDateTime(keyDetail.expireAt, { empty: '长期 / 未设' }) }}</div></div>
          <div>
            <span>工单号</span>
            <div>
              <button
                v-if="keyDetail.ticketNo"
                type="button"
                class="btn-link"
                @click="router.push({ path: '/apply', query: { tab: 'api', ticket: keyDetail.ticketNo } })"
              >
                {{ keyDetail.ticketNo }}
              </button>
              <span v-else>—</span>
            </div>
          </div>
          <div><span>签发时间</span><div>{{ formatDateTime(keyDetail.createTime) }}</div></div>
          <div v-if="keyDetail.remark" class="wide"><span>备注</span><div>{{ keyDetail.remark }}</div></div>
        </div>
        <SubscriptionKeySecretPanel ref="keySecretPanel" :key-meta="keyDetail" />
        <div class="detail-actions">
          <button type="button" class="btn btn-sm" @click="openApiFromKey(keyDetail)">查看关联 API</button>
          <button type="button" class="btn btn-sm" @click="goApply(keyDetail.api)">再申请调用</button>
        </div>
      </div>
      </div>
    </AppDrawer>
  </div>
</template>

