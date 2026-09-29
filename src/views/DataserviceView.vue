<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import SqlEditor from '@/components/etl/SqlEditor.vue'
import ApiBuildWorkbench from '@/components/dataservice/ApiBuildWorkbench.vue'
import RegisterBindingModal from '@/components/dataservice/RegisterBindingModal.vue'
import ProjectSyncListModal from '@/components/dataservice/ProjectSyncListModal.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useDataservice } from '@/composables/useDataservice'
import { useActionLock } from '@/composables/useActionLock'
import { useSession } from '@/composables/useSession'
import { pageGuideOf } from '@/data/pageGuides'
import { apisixStatusMeta, routeOfApi } from '@/data/dataservice'
import {
  FIELD_TRANSFORM_OPTIONS,
  RESPONSE_FORMAT_OPTIONS,
  RESPONSE_SHAPE_OPTIONS,
} from '@/data/apiBuild'

const router = useRouter()
const { showToast } = useToast()
const { busy, run: runLocked } = useActionLock()
const guide = pageGuideOf('dataservice')
const {
  apis,
  routes,
  subs,
  apiKeys,
  pendingPublish,
  kpis,
  callRank,
  callTrend,
  degraded,
  workbench,
  sqlrestDs,
  embed,
  ensureLoaded,
  openDetail,
  openManager,
  runSyncFromSqlrest,
  runProjectDs,
  runRegister,
  exportOpenapi,
} = useDataservice()

const { currentWs } = useSession()

onMounted(() => ensureLoaded(true))

watch(currentWs, () => {
  ensureLoaded(true).catch(() => {})
})

const apiSearch = ref('')
const createOpen = ref(false)
const editBindingId = ref('')
const registerOpen = ref(false)
const pendingListOpen = ref(false)
const failedListOpen = ref(false)
const projecting = computed(() => busy('project'))

const detailOpen = ref(false)
const detail = ref(null)
const keyDetailOpen = ref(false)
const keyDetail = ref(null)

const gatewayUrl = computed(() => embed.value?.gateway || workbench.value?.gatewayUrl || '')
const assignmentList = computed(() => {
  const a = workbench.value?.assignments
  if (Array.isArray(a?.data)) return a.data
  if (Array.isArray(a)) return a
  return []
})
const pendingProject = computed(() =>
  (sqlrestDs.value || []).filter(
    (d) => d.projectable && !d.projected && d.syncState !== 'error',
  ),
)
const failedProject = computed(() =>
  (sqlrestDs.value || []).filter((d) => d.projectable && d.syncState === 'error'),
)

const filteredApis = computed(() => {
  const f = apiSearch.value.trim().toLowerCase()
  if (!f) return apis.value
  return apis.value.filter(
    (a) =>
      (a.path || '').toLowerCase().includes(f) ||
      (a.name || '').toLowerCase().includes(f) ||
      (a.domain || '').toLowerCase().includes(f) ||
      (a.asset && a.asset !== '-' && a.asset.toLowerCase().includes(f)) ||
      (a.metric && a.metric !== '-' && a.metric.toLowerCase().includes(f)),
  )
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredApis)
watch(apiSearch, () => resetPage())

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

function apiLifecycleMeta(row) {
  if (!row) return { label: '—', cls: 'tag-gray' }
  const st = row.state
  const ts = row.publishTicketStatus
  if (st === 'published') return { label: '已发布', cls: 'tag-green' }
  if (st === 'retired') return { label: '已下线', cls: 'tag-gray' }
  if (ts === 'pending') return { label: '待发布·审核中', cls: 'tag-orange' }
  if (ts === 'rejected') return { label: '已驳回·待重改', cls: 'tag-red' }
  if (ts === 'approved' && st !== 'published') return { label: '待上线', cls: 'tag-blue' }
  if (st === 'draft' || !st) return { label: '草稿', cls: 'tag-gray' }
  return { label: row.level || st, cls: row.levelCls || 'tag-gray' }
}

function publishTicketStatusLabel(status) {
  if (status === 'pending') return '待审核'
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已驳回'
  return status || '—'
}

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
  editBindingId.value = ''
  createOpen.value = true
}

function openWorkbench(bindingId) {
  editBindingId.value = bindingId || ''
  createOpen.value = true
}

function onWorkbenchClose() {
  createOpen.value = false
  editBindingId.value = ''
}

function onPublishApi(row) {
  if (!row) return
  const idx = apis.value.findIndex((a) => a.path === row.path && a.method === row.method)
  if (idx >= 0) apis.value.splice(idx, 1, { ...apis.value[idx], ...row })
  else apis.value.unshift(row)
  resetPage()
  ensureLoaded(true)
  openApiDetail(row)
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

function fromPendingToDetail(row) {
  if (row?.bindingId) {
    const hit = apis.value.find((a) => a.id === row.bindingId)
    if (hit) {
      openApiDetail(hit)
      return
    }
  }
  openApiDetail({
    id: row.bindingId,
    path: row.path,
    method: row.method,
    name: row.name,
    state: 'draft',
    publishTicketNo: row.ticketNo,
    publishTicketStatus: row.status,
    publishTicketRemark: row.remark,
  })
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

async function projectByIds(ids, { successPrefix, emptyMsg } = {}) {
  const list = (ids || []).filter(Boolean)
  if (!list.length) {
    showToast(emptyMsg || '没有可处理的数据源', 'info')
    return
  }
  await runLocked('project', async () => {
    try {
      const r = await runProjectDs(list)
      const fail = r?.errors ?? r?.failed ?? 0
      const prefix = successPrefix || '投影完成'
      showToast(
        `${prefix} · 成功 ${r?.projected ?? 0} · 失败 ${fail}`,
        fail > 0 || r?.ok === false ? 'warning' : 'success',
      )
    } catch (e) {
      showToast(`投影失败：${e?.message || e}`, 'warning')
    }
  })
}

function projectAllPending() {
  return projectByIds(
    pendingProject.value.map((d) => d.id),
    { successPrefix: '投影完成', emptyMsg: '没有待投影数据源' },
  )
}

function retryAllFailed() {
  return projectByIds(
    failedProject.value.map((d) => d.id),
    { successPrefix: '重试完成', emptyMsg: '没有失败项' },
  )
}

function projectOne(d, mode) {
  return projectByIds([d?.id], {
    successPrefix: mode === 'failed' ? '重试完成' : '投影完成',
    emptyMsg: '缺少数据源 ID',
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
  const full = await openDetail(a)
  if (full) detail.value = full
}

function closeApiDetail() {
  detailOpen.value = false
}

function openInManager(row) {
  const link = row?.managerDeepLink
  if (link) {
    window.open(link, '_blank', 'noopener')
    return
  }
  openManager('interfaceList')
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
</script>

<template>
  <div class="ds-page">
    <PageHeader
      page-id="dataservice"
      title="数据服务中心"
      subtitle="接口构建与发布 · 绑定资产/指标 · 调用监控"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm btn-primary" @click="buildApi">构建 API</button>
      <button type="button" class="btn btn-sm" :disabled="busy('sync')" @click="syncFromSqlrest">{{ busy('sync') ? '同步中…' : '同步接口目录' }}</button>
      <button type="button" class="btn btn-sm" @click="registerOpen = true">登记绑定</button>
      <button type="button" class="btn btn-sm" @click="downloadOpenapi()">导出 OpenAPI</button>
      <button type="button" class="btn btn-sm" @click="goApply()">申请调用凭证</button>
    </PageHeader>

    <ApiBuildWorkbench
      :open="createOpen"
      :edit-id="editBindingId"
      @close="onWorkbenchClose"
      @publish="onPublishApi"
    />
    <RegisterBindingModal
      :open="registerOpen"
      :assignments="assignmentList"
      @close="registerOpen = false"
      @submit="onRegister"
    />
    <ProjectSyncListModal
      :open="pendingListOpen"
      mode="pending"
      :items="pendingProject"
      :projecting="projecting"
      @close="pendingListOpen = false"
      @project-all="projectAllPending"
      @project-one="(d) => projectOne(d, 'pending')"
    />
    <ProjectSyncListModal
      :open="failedListOpen"
      mode="failed"
      :items="failedProject"
      :projecting="projecting"
      @close="failedListOpen = false"
      @project-all="retryAllFailed"
      @project-one="(d) => projectOne(d, 'failed')"
    />

    <div class="ds-flow card">
      <div class="ds-flow-steps">
        <div class="ds-step">
          <span class="ds-step-n">1</span>
          <div>
            <div class="ds-step-t">投影数据源</div>
            <div class="tip">门户数据源 → 接口服务（可映射类型）</div>
          </div>
        </div>
        <div class="ds-step">
          <span class="ds-step-n">2</span>
          <div>
            <div class="ds-step-t">API 构建</div>
            <div class="tip">门户向导 → 创建/调试接口（SQL/脚本）</div>
          </div>
        </div>
        <div class="ds-step">
          <span class="ds-step-n">3</span>
          <div>
            <div class="ds-step-t">发布上线</div>
            <div class="tip">发布部署 · 绑定资产/指标</div>
          </div>
        </div>
        <div class="ds-step">
          <span class="ds-step-n">4</span>
          <div>
            <div class="ds-step-t">上线调用</div>
            <div class="tip">
              边缘 <code>gateway</code>
              <template v-if="gatewayUrl"> · {{ gatewayUrl }}</template>
            </div>
          </div>
        </div>
      </div>
      <div class="ds-flow-actions">
        <button
          type="button"
          class="btn btn-sm"
          :disabled="!pendingProject.length"
          title="查看待投影数据源列表"
          @click="pendingListOpen = true"
        >
          投影待同步源 ({{ pendingProject.length }})
        </button>
        <button
          v-if="failedProject.length"
          type="button"
          class="btn btn-sm"
          title="查看投影失败列表"
          @click="failedListOpen = true"
        >
          重试失败 ({{ failedProject.length }})
        </button>
      </div>
      <p v-if="failedProject.length" class="tip ds-hint" style="color: var(--danger)">
        有 {{ failedProject.length }} 个源投影失败，点击「重试失败」查看详情并重试
      </p>
      <p v-if="workbench?.hint" class="tip ds-hint">{{ workbench.hint }}</p>
    </div>

    <div class="kpi-grid ds-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card ds-kpi-card">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span v-if="k.unit" class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-delta" :class="k.deltaCls">{{ k.delta }}</div>
      </div>
    </div>
    <p v-if="degraded" class="tip" style="margin: -8px 0 12px">后端暂不可达，列表为空</p>

    <div class="card ds-pending-card">
      <div class="card-header">
        <div class="card-title">待发布</div>
        <span class="tag tag-orange">{{ pendingPublish.length }} 条</span>
      </div>
      <div class="card-body" style="padding: 0">
        <table v-if="pendingPublish.length" class="table ds-sub-table">
          <thead>
            <tr>
              <th>API</th>
              <th>工单号</th>
              <th>状态</th>
              <th>驳回意见</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in pendingPublish" :key="p.ticketNo || p.id">
              <td>
                <span class="ac-method" :class="p.method">{{ p.method }}</span>
                <code class="ds-pending-path">{{ p.path }}</code>
                <div class="tip" style="margin-top: 2px">{{ p.name }}</div>
              </td>
              <td>
                <button type="button" class="btn-link" @click="goApplyTicket(p.ticketNo)">
                  {{ p.ticketNo }}
                </button>
              </td>
              <td><span class="tag" :class="p.statusCls">{{ p.statusLabel }}</span></td>
              <td class="ds-reject-cell">{{ p.remark || '—' }}</td>
              <td class="ds-pending-actions">
                <button type="button" class="btn btn-sm" @click="fromPendingToDetail(p)">详情</button>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  :disabled="!p.bindingId"
                  @click="openWorkbench(p.bindingId)"
                >
                  回工作台
                </button>
                <button type="button" class="btn btn-sm" @click="goApplyTicket(p.ticketNo)">看申请</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="tip" style="padding: 12px 16px">
          暂无待发布项。在「构建工作台」保存后点「申请发布」，工单待审/驳回时会出现在此。
        </p>
      </div>
    </div>

    <div class="card ds-api-card">
      <div class="card-header">
        <div class="card-title">已发布 / 已绑定 API</div>
        <input
          v-model="apiSearch"
          class="input input-sm ds-search"
          type="search"
          placeholder="搜索 API 名 / 资产 / 域"
        />
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
              <button type="button" class="btn btn-sm ac-detail-btn" @click.stop="openInManager(a)">
                Manager
              </button>
            </div>
          </div>
        </div>
        <div v-else class="ds-empty">
          暂无绑定 · 请先在接口工作台构建，再「同步接口目录」或「登记绑定」
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
    </div>

    <div class="grid grid-2 ds-mid">
      <div class="card">
        <div class="card-header">
          <div class="card-title">近 7 日调用趋势</div>
          <span class="tag tag-green">调用概览</span>
        </div>
        <div class="card-body ds-trend">
          <div v-if="callTrend.length" class="ds-trend-bars">
            <div v-for="(t, ti) in callTrend" :key="ti" class="ds-trend-col" :title="`${t.day}: ${t.calls}`">
              <div class="ds-trend-fill" :style="{ height: `${Math.max(t.pct, 4)}%` }" />
              <div class="ds-trend-day">{{ String(t.day).slice(-5) }}</div>
            </div>
          </div>
          <p v-else class="tip" style="padding: 12px 0">暂无调用趋势。有流量后由调用概览自动回填。</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">调用量 Top</div>
          <span class="tag tag-green">Gateway 日志</span>
        </div>
        <div class="card-body ds-rank">
          <div v-for="(r, ri) in callRank" :key="ri" class="call-bar-row">
            <div class="cbr-name" :title="r.name">{{ r.name }}</div>
            <div class="cbr-bar">
              <div class="cbr-bar-fill" :style="{ width: `${r.pct}%` }" />
            </div>
            <div class="cbr-val">{{ r.calls }}</div>
          </div>
          <p v-if="!callRank.length" class="tip">暂无 Top 路径。发布并产生调用后可见。</p>
        </div>
      </div>
    </div>

    <div class="ds-mid-grid">
      <div class="card ds-mid">
        <div class="card-header">
          <div class="card-title">订阅 Key</div>
          <span class="tag tag-green">申请签发</span>
        </div>
        <div class="card-body" style="padding: 0">
          <table v-if="subs.length" class="table ds-sub-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>AppKey</th>
                <th>关联 API</th>
                <th>状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in subs" :key="s.id || s.appKey">
                <td>{{ s.name }}</td>
                <td><code>{{ s.appKeyMasked || s.appKey }}</code></td>
                <td><code>{{ s.api }}</code></td>
                <td><span class="tag" :class="s.cls">{{ s.status }}</span></td>
                <td>
                  <button type="button" class="btn btn-sm" @click="openKeyDetail(s)">查看详情</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="tip" style="padding: 12px 16px">
            暂无订阅 Key。申请中心提交「API 调用申请」并审批通过后签发，用于调用 Gateway。
          </p>
        </div>
      </div>

    </div>

    <div class="card ds-edge">
      <div class="card-header">
        <div class="card-title">
          对外边缘
          <span class="tip">· 统一网关（唯一边缘）</span>
        </div>
        <div class="ds-edge-actions">
          <span class="tag tag-green">gateway</span>
          <template v-if="gatewayUrl">
            <code class="tip" style="font-size: 11px">{{ gatewayUrl }}</code>
          </template>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table ds-route-table">
          <thead>
            <tr>
              <th>路径</th>
              <th>上游</th>
              <th>鉴权</th>
              <th>限流</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in routes" :key="r.path">
              <td><code class="route-path">{{ r.path }}</code></td>
              <td style="font-size: 12px">{{ r.upstream || '网关 → 执行器' }}</td>
              <td><span class="tag tag-purple" style="font-size: 10px">{{ r.auth }}</span></td>
              <td style="font-size: 12px">{{ r.rate }}</td>
              <td>
                <span class="tag" :class="apisixStatusMeta(r.status).tag" style="font-size: 10px">
                  {{ apisixStatusMeta(r.status).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!routes?.length" class="tip" style="padding: 12px 16px">
          暂无已发布绑定。在工作台调试/保存/发版后，同步接口目录即可。
        </p>
      </div>
    </div>

    <AppDrawer
      :open="detailOpen"
      storage-key="dataservice-api-detail-width"
      :default-width="600"
      @close="closeApiDetail"
    >
      <div v-if="detail" class="api-detail">
        <div class="detail-head">
          <div>
            <div class="detail-title">API 详情</div>
            <div class="tip">{{ detail.name || detail.path }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeApiDetail">✕</button>
        </div>

        <div class="detail-path-row">
          <span class="ac-method" :class="detail.method">{{ detail.method }}</span>
          <code class="detail-path">{{ detail.path }}</code>
          <button type="button" class="btn btn-sm" @click="copyPath">复制</button>
          <span class="tag" :class="detailStateMeta.cls">{{ detailStateMeta.label }}</span>
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
          <div><span>创建时间</span><div>{{ detail.createTime || '—' }}</div></div>
          <div><span>更新时间</span><div>{{ detail.updateTime || '—' }}</div></div>
          <div class="wide"><span>说明</span><div>{{ detail.desc || '—' }}</div></div>
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
          <div><span>发布时间</span><div>{{ detail.publishedAt || '—' }}</div></div>
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
            @click="openWorkbench(detail.id)"
          >
            打开工作台
          </button>
          <button
            v-if="detail.state !== 'published'"
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
        </div>

        <div class="detail-sec-title">调用侧</div>
        <p class="tip detail-empty" style="margin-top: 0">
          已发布接口可在申请中心提交「API 调用申请」；通过后签发订阅 Key（X-App-Key + Bearer）。密文仅审批当次展示一次。
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
        <p v-else class="tip detail-empty">暂无订阅 Key · 发布后可申请调用凭证</p>

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
          hint="深编请回工作台或 Manager"
        />
        <p v-else class="tip detail-empty">正文在接口服务；点下方打开工作台或管理端</p>

        <div class="detail-sec-title">入参</div>
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
              <td>{{ p.required ? '是' : '否' }}</td>
              <td>{{ p.example || '—' }}</td>
              <td>{{ p.desc || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="tip detail-empty">未配置入参（或仅存于 Manager）</p>

        <div class="detail-sec-title">出参映射</div>
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
        <p v-else class="tip detail-empty">未配置出参映射</p>

        <div class="detail-sec-title">边缘路由</div>
        <div v-if="detailRoute" class="detail-route">
          <div><span>匹配</span><code>{{ detailRoute.path }}</code></div>
          <div><span>上游</span><span>{{ detailRoute.upstream }}</span></div>
          <div>
            <span>状态</span>
            <span class="tag" :class="apisixStatusMeta(detailRoute.status).tag">
              {{ apisixStatusMeta(detailRoute.status).label }}
            </span>
          </div>
          <div v-if="detailRoute.note" class="wide tip">{{ detailRoute.note }}</div>
        </div>
        <p v-else class="tip detail-empty">未匹配到边缘路由记录（未发布或未同步）</p>

        <div class="detail-actions">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="!detail.id"
            @click="openWorkbench(detail.id)"
          >
            打开工作台
          </button>
          <button type="button" class="btn btn-sm" @click="openInManager(detail)">在 Manager 打开</button>
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
            v-if="detail.asset && detail.asset !== '-'"
            type="button"
            class="btn btn-sm"
            @click="goAsset(detail.asset)"
          >
            查看资产
          </button>
        </div>
      </div>
    </AppDrawer>

    <AppDrawer
      :open="keyDetailOpen"
      storage-key="dataservice-key-detail-width"
      :default-width="480"
      @close="closeKeyDetail"
    >
      <div v-if="keyDetail" class="api-detail">
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
            <span>AppKey（脱敏）</span>
            <div><code>{{ keyDetail.appKeyMasked || keyDetail.appKey }}</code></div>
          </div>
          <div v-if="keyDetail.keyHint">
            <span>密钥末位</span>
            <div><code>···{{ keyDetail.keyHint }}</code></div>
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
          <div><span>申请人</span><div>{{ keyDetail.applicant || keyDetail.user || '—' }}</div></div>
          <div><span>配额</span><div>{{ keyDetail.qps || '—' }} QPS</div></div>
          <div><span>时效</span><div>{{ keyDetail.expireAt || '长期 / 未设' }}</div></div>
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
          <div><span>签发时间</span><div>{{ keyDetail.createTime || '—' }}</div></div>
          <div v-if="keyDetail.remark" class="wide"><span>备注</span><div>{{ keyDetail.remark }}</div></div>
        </div>
        <p class="tip detail-empty">
          Bearer 密文仅在审批通过当次展示；列表与详情不回显完整 secret。若遗失请重新申请调用凭证。
        </p>
        <div class="detail-actions">
          <button type="button" class="btn btn-sm" @click="openApiFromKey(keyDetail)">查看关联 API</button>
          <button type="button" class="btn btn-sm" @click="goApply(keyDetail.api)">再申请调用</button>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<style scoped>
.ds-flow {
  padding: 14px 16px;
  margin-bottom: 16px;
}
.ds-flow-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.ds-step {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.ds-step-n {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary, #1e6fff);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ds-step-t {
  font-weight: 600;
  font-size: 13px;
}
.ds-flow-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.ds-hint {
  margin: 10px 0 0;
}
.ds-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}
.ds-kpi-card .kpi-label {
  order: -1;
}
.kpi-delta {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
}
.kpi-delta.success {
  color: var(--success);
}
.kpi-delta.warn {
  color: var(--warning);
}
.ds-search {
  width: 240px;
  margin-left: auto;
}
.ds-api-grid-wrap {
  padding: 12px 16px;
}
.ds-api-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.api-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.api-card:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(30, 111, 255, 0.08);
}
.ac-line1 {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ac-method {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.ac-method.GET {
  background: #e6f7ff;
  color: #096dd9;
}
.ac-method.POST {
  background: #f6ffed;
  color: #389e0d;
}
.ac-path {
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
}
.ac-name {
  font-weight: 600;
  margin-top: 6px;
  font-size: 13px;
}
.ac-metric {
  margin-left: 4px;
  font-size: 10px;
}
.ac-desc {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
  line-height: 1.5;
}
.ac-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-3);
  gap: 8px;
  flex-wrap: wrap;
}
.ac-bind {
  margin-top: 8px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ac-detail-btn {
  margin-left: auto;
}
.ds-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.ds-mid {
  margin-bottom: 16px;
}
.ds-mid-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.ds-mid-grid .ds-mid {
  margin-bottom: 0;
}
@media (max-width: 960px) {
  .ds-mid-grid {
    grid-template-columns: 1fr;
  }
}
.ds-rank {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ds-trend {
  min-height: 120px;
}
.ds-trend-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 120px;
  padding-top: 8px;
}
.ds-trend-col {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
}
.ds-trend-fill {
  width: 70%;
  max-width: 28px;
  background: var(--primary, #1e6fff);
  border-radius: 3px 3px 0 0;
  opacity: 0.85;
}
.ds-trend-day {
  font-size: 10px;
  color: var(--text-3, #94a3b8);
  white-space: nowrap;
}
.call-bar-row {
  display: grid;
  grid-template-columns: 140px 1fr 56px;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.cbr-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cbr-bar {
  height: 6px;
  background: var(--bg-2, #f0f2f5);
  border-radius: 3px;
}
.cbr-bar-fill {
  height: 100%;
  background: var(--primary, #1e6fff);
  border-radius: 3px;
}
.cbr-val {
  text-align: right;
  color: var(--text-3);
}
.ds-edge {
  margin-bottom: 16px;
}
.ds-edge-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.route-path {
  font-size: 12px;
}
.api-detail {
  padding: 4px 4px 24px;
}
.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.detail-title {
  font-weight: 700;
  font-size: 15px;
}
.detail-path-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.detail-path {
  font-size: 13px;
}
.detail-kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
  font-size: 12px;
  margin-bottom: 14px;
}
.detail-kv span {
  display: block;
  color: var(--text-3);
  margin-bottom: 2px;
}
.detail-kv .wide {
  grid-column: 1 / -1;
}
.detail-sec-title {
  font-weight: 600;
  font-size: 13px;
  margin: 14px 0 8px;
}
.detail-empty {
  margin: 0 0 8px;
}
.detail-table {
  font-size: 12px;
}
.detail-route {
  display: grid;
  gap: 6px;
  font-size: 12px;
}
.detail-route span:first-child {
  color: var(--text-3);
  margin-right: 8px;
}
.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.detail-inline-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 4px;
}
.ds-pending-card {
  margin-bottom: 16px;
}
.ds-pending-path {
  margin-left: 6px;
  font-size: 12px;
}
.ds-pending-actions {
  white-space: nowrap;
}
.ds-pending-actions .btn {
  margin: 2px 2px 2px 0;
}
.ds-reject-cell {
  max-width: 220px;
  font-size: 12px;
  color: var(--text-2);
  word-break: break-word;
}
.ds-reject-box {
  color: var(--danger, #b45309);
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
}
.btn-ghost {
  opacity: 0.85;
}
@media (max-width: 960px) {
  .ds-flow-steps {
    grid-template-columns: 1fr 1fr;
  }
  .ds-kpi {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
