<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import SqlEditor from '@/components/etl/SqlEditor.vue'
import ApiBuildWizard from '@/components/dataservice/ApiBuildWizard.vue'
import RegisterBindingModal from '@/components/dataservice/RegisterBindingModal.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useDataservice } from '@/composables/useDataservice'
import { pageGuideOf } from '@/data/pageGuides'
import { apisixStatusMeta, routeOfApi, subscribersOf } from '@/data/dataservice'
import {
  FIELD_TRANSFORM_OPTIONS,
  RESPONSE_FORMAT_OPTIONS,
  RESPONSE_SHAPE_OPTIONS,
} from '@/data/apiBuild'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('dataservice')
const {
  apis,
  routes,
  subs,
  kpis,
  callRank,
  degraded,
  workbench,
  sqlrestDs,
  embed,
  ensureLoaded,
  openDetail,
  runSyncApisix,
  runSyncFromSqlrest,
  runProjectDs,
  runRegister,
  openManager,
} = useDataservice()

onMounted(() => ensureLoaded())

const apiSearch = ref('')
const createOpen = ref(false)
const registerOpen = ref(false)
const projecting = ref(false)

const detailOpen = ref(false)
const detail = ref(null)

const edgeMode = computed(() => embed.value?.edgeMode || workbench.value?.edgeMode || 'gateway')
const gatewayUrl = computed(() => embed.value?.gateway || workbench.value?.gatewayUrl || '')
const assignmentList = computed(() => {
  const a = workbench.value?.assignments
  if (Array.isArray(a?.data)) return a.data
  if (Array.isArray(a)) return a
  return []
})
const pendingProject = computed(() => (sqlrestDs.value || []).filter((d) => !d.projected && d.projectable))

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
  const fromMock = subscribersOf(detail.value.path)
  if (fromMock.length) return fromMock
  return (subs.value || []).filter((s) => s.api === detail.value.path)
})
const detailRoute = computed(() => {
  if (!detail.value) return null
  return (
    routes.value.find((r) => r.path === detail.value.path) || routeOfApi(detail.value.path)
  )
})

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
  createOpen.value = true
}

function openManagerAdvanced() {
  const url = openManager('interfaceList')
  if (!url) showToast('无法打开 SQLREST Manager（请检查部署台账地址）', 'warning')
}

function onPublishApi(row) {
  if (!row) return
  const idx = apis.value.findIndex((a) => a.path === row.path && a.method === row.method)
  if (idx >= 0) apis.value.splice(idx, 1, { ...apis.value[idx], ...row })
  else apis.value.unshift(row)
  resetPage()
  openApiDetail(row)
}

function goApply(apiPath) {
  router.push({ path: '/apply', query: { type: 'api', path: apiPath || undefined } })
}

async function syncApisix() {
  try {
    const r = await runSyncApisix()
    if (r?.skipped) {
      showToast(r.message || '当前边缘为 SQLREST Gateway，无需同步 APISIX', 'info')
      return
    }
    showToast(
      r?.ok ? `已同步 ${r.synced || 0} 条路由` : `同步部分失败 · 成功 ${r?.synced || 0} / 失败 ${r?.failed || 0}`,
      r?.ok ? 'success' : 'warning',
    )
  } catch (e) {
    showToast(`同步失败：${e?.message || e}`, 'warning')
  }
}

async function syncFromSqlrest() {
  try {
    const r = await runSyncFromSqlrest()
    showToast(
      `已从 SQLREST 同步 · 写入 ${r?.upserted ?? 0} · 跳过 ${r?.skipped ?? 0}`,
      'success',
    )
  } catch (e) {
    showToast(`同步失败：${e?.message || e}`, 'warning')
  }
}

async function projectDatasources() {
  projecting.value = true
  try {
    const ids = pendingProject.value.map((d) => d.id).filter(Boolean)
    const r = await runProjectDs(ids)
    showToast(
      `投影完成 · 成功 ${r?.projected ?? 0} · 失败 ${r?.failed ?? 0}`,
      r?.ok === false ? 'warning' : 'success',
    )
  } catch (e) {
    showToast(`投影失败：${e?.message || e}`, 'warning')
  } finally {
    projecting.value = false
  }
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
  openSqlrestList()
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
</script>

<template>
  <div class="ds-page">
    <PageHeader
      title="数据服务中心"
      subtitle="经 SQLREST Manager API 构建（SQL/Groovy）· 默认边缘 Gateway · 门户负责投影绑定与发布编排"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm btn-primary" @click="buildApi">构建 API</button>
      <button type="button" class="btn btn-sm" @click="syncFromSqlrest">同步接口目录</button>
      <button type="button" class="btn btn-sm" @click="registerOpen = true">登记绑定</button>
      <button type="button" class="btn btn-sm" @click="goApply()">申请凭证</button>
      <button type="button" class="btn btn-sm btn-ghost" @click="openManagerAdvanced">打开 Manager</button>
    </PageHeader>

    <ApiBuildWizard :open="createOpen" @close="createOpen = false" @publish="onPublishApi" />
    <RegisterBindingModal
      :open="registerOpen"
      :assignments="assignmentList"
      @close="registerOpen = false"
      @submit="onRegister"
    />

    <div class="ds-flow card">
      <div class="ds-flow-steps">
        <div class="ds-step">
          <span class="ds-step-n">1</span>
          <div>
            <div class="ds-step-t">投影数据源</div>
            <div class="tip">门户数据源 → SQLREST（可映射类型）</div>
          </div>
        </div>
        <div class="ds-step">
          <span class="ds-step-n">2</span>
          <div>
            <div class="ds-step-t">API 构建</div>
            <div class="tip">门户向导 → SQLREST create/debug API（SQL/Groovy）</div>
          </div>
        </div>
        <div class="ds-step">
          <span class="ds-step-n">3</span>
          <div>
            <div class="ds-step-t">发布上线</div>
            <div class="tip">SQLREST publish/deploy · 绑定资产/指标</div>
          </div>
        </div>
        <div class="ds-step">
          <span class="ds-step-n">4</span>
          <div>
            <div class="ds-step-t">上线调用</div>
            <div class="tip">
              边缘
              <code>{{ edgeMode }}</code>
              <template v-if="gatewayUrl"> · {{ gatewayUrl }}</template>
            </div>
          </div>
        </div>
      </div>
      <div class="ds-flow-actions">
        <button
          type="button"
          class="btn btn-sm"
          :disabled="projecting || !pendingProject.length"
          @click="projectDatasources"
        >
          投影待同步源 ({{ pendingProject.length }})
        </button>
        <button type="button" class="btn btn-sm" @click="openManagerAdvanced">Manager 接口列表</button>
        <button type="button" class="btn btn-sm" @click="openManager('client')">客户端</button>
        <button type="button" class="btn btn-sm" @click="openManager('online')">在线服务</button>
      </div>
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
    <p v-if="degraded" class="tip" style="margin: -8px 0 12px">后端暂不可达，列表为本地演示数据</p>

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
          暂无绑定 · 请先在 SQLREST 构建，再「同步接口目录」或「登记绑定」
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
          <div class="card-title">调用量 Top</div>
          <span class="tag tag-green">SQLREST 概览</span>
        </div>
        <div class="card-body ds-rank">
          <div v-for="(r, ri) in callRank" :key="ri" class="call-bar-row">
            <div class="cbr-name" :title="r.name">{{ r.name }}</div>
            <div class="cbr-bar">
              <div class="cbr-bar-fill" :style="{ width: `${r.pct}%` }" />
            </div>
            <div class="cbr-val">{{ r.calls }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">订阅 / 客户端</div>
          <button type="button" class="btn btn-sm" @click="openManager('client')">SQLREST 客户端</button>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table ds-sub-table">
            <thead>
              <tr>
                <th>应用</th>
                <th>API</th>
                <th>申请人</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(s, si) in subs" :key="si">
                <td>{{ s.app }}</td>
                <td><code>{{ s.api }}</code></td>
                <td>{{ s.user }}</td>
                <td><span class="tag" :class="s.cls">{{ s.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card ds-apisix">
      <div class="card-header">
        <div class="card-title">
          对外边缘
          <span class="tip">· mode={{ edgeMode }}</span>
        </div>
        <div class="ds-apisix-actions">
          <span v-if="edgeMode === 'gateway'" class="tag tag-green">SQLREST Gateway</span>
          <span v-else class="tag tag-orange">含 APISIX</span>
          <button
            v-if="edgeMode !== 'gateway'"
            type="button"
            class="btn btn-sm"
            @click="syncApisix"
          >
            与 APISIX 同步
          </button>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table ds-route-table">
          <thead>
            <tr>
              <th>路由</th>
              <th>上游</th>
              <th>鉴权</th>
              <th>限流</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in routes" :key="r.path">
              <td><code class="route-path">{{ r.path }}</code></td>
              <td style="font-size: 12px">{{ r.upstream }}</td>
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
          暂无已发布绑定。在 Manager 调试/保存/发版后，同步到本页即可。
        </p>
      </div>
    </div>

    <AppDrawer
      :open="detailOpen"
      storage-key="dataservice-api-detail-width"
      :default-width="560"
      @close="closeApiDetail"
    >
      <div v-if="detail" class="api-detail">
        <div class="detail-head">
          <div>
            <div class="detail-title">API 详情</div>
            <div class="tip">{{ detail.name }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeApiDetail">✕</button>
        </div>

        <div class="detail-path-row">
          <span class="ac-method" :class="detail.method">{{ detail.method }}</span>
          <code class="detail-path">{{ detail.path }}</code>
          <button type="button" class="btn btn-sm" @click="copyPath">复制</button>
        </div>

        <div class="detail-kv">
          <div><span>业务域</span><div>{{ detail.domain || '—' }}</div></div>
          <div>
            <span>等级</span>
            <div><span class="tag" :class="detail.levelCls">{{ detail.level || detail.state || '—' }}</span></div>
          </div>
          <div><span>鉴权</span><div>{{ detail.auth || 'Token' }}</div></div>
          <div><span>环境</span><div>{{ detail.publishEnv || 'prod' }}</div></div>
          <div><span>全局限流</span><div>{{ detail.qps }} QPS · Burst {{ detail.burst || '—' }}</div></div>
          <div><span>引擎</span><div>{{ detail.sqlrest?.engine || detail.engine || 'SQL/Groovy' }}</div></div>
          <div><span>负责人</span><div>{{ detail.owner || '—' }}</div></div>
          <div><span>发布时间</span><div>{{ detail.publishedAt || '—' }}</div></div>
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
          <div class="wide"><span>说明</span><div>{{ detail.desc }}</div></div>
          <div>
            <span>响应封装</span>
            <div>{{ formatLabel }} / {{ shapeLabel }}</div>
          </div>
        </div>

        <div class="detail-sec-title">SQL / Groovy（只读预览）</div>
        <SqlEditor
          v-if="detail.sql"
          :model-value="detail.sql"
          readonly
          compact
          :rows="6"
          label="SQLREST"
          hint="完整编辑请打开 Manager"
        />
        <p v-else class="tip detail-empty">正文在 SQLREST；点下方在 Manager 中打开</p>

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
        <p v-else class="tip detail-empty">未匹配到边缘路由记录</p>

        <div class="detail-sec-title">订阅方</div>
        <table v-if="detailSubs.length" class="table detail-table">
          <thead>
            <tr>
              <th>应用</th>
              <th>申请人</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in detailSubs" :key="'s' + i">
              <td>{{ s.app }}</td>
              <td>{{ s.user }}</td>
              <td><span class="tag" :class="s.cls">{{ s.status }}</span></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="tip detail-empty">暂无订阅记录 · 可申请调用凭证</p>

        <div class="detail-actions">
          <button type="button" class="btn btn-sm btn-primary" @click="openInManager(detail)">在 Manager 打开</button>
          <button type="button" class="btn btn-sm" @click="goApply(detail.path)">申请凭证</button>
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
.ds-rank {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
.ds-apisix {
  margin-bottom: 16px;
}
.ds-apisix-actions {
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
