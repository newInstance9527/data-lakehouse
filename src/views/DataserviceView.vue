<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import SqlEditor from '@/components/etl/SqlEditor.vue'
import ApiBuildWizard from '@/components/dataservice/ApiBuildWizard.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { pageGuideOf } from '@/data/pageGuides'
import {
  API_CALL_RANK,
  API_LIST,
  APISIX_ROUTES,
  DS_KPIS,
  SUB_LIST,
  apisixStatusMeta,
  routeOfApi,
  subscribersOf,
} from '@/data/dataservice'
import {
  FIELD_TRANSFORM_OPTIONS,
  RESPONSE_FORMAT_OPTIONS,
  RESPONSE_SHAPE_OPTIONS,
} from '@/data/apiBuild'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('dataservice')

const apiSearch = ref('')
const createOpen = ref(false)
const apis = ref(API_LIST.map((a) => ({ ...a })))
const routes = ref(APISIX_ROUTES.map((r) => ({ ...r })))

const detailOpen = ref(false)
const detail = ref(null)

const filteredApis = computed(() => {
  const f = apiSearch.value.trim().toLowerCase()
  if (!f) return apis.value
  return apis.value.filter(
    (a) =>
      a.path.toLowerCase().includes(f) ||
      a.name.toLowerCase().includes(f) ||
      a.domain.toLowerCase().includes(f) ||
      (a.asset !== '-' && a.asset.toLowerCase().includes(f)) ||
      (a.metric !== '-' && a.metric.toLowerCase().includes(f)),
  )
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredApis)
watch(apiSearch, () => resetPage())

const detailSubs = computed(() => (detail.value ? subscribersOf(detail.value.path) : []))
const detailRoute = computed(() => (detail.value ? routeOfApi(detail.value.path) : null))

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

function onPublishApi(row) {
  apis.value.unshift(row)
  routes.value.unshift({
    path: row.path,
    upstream: 'SQLREST Executor → Trino',
    auth: row.auth || 'Token',
    rate: `${row.qps}/s`,
    breaker: '✓',
    meter: '✓',
    status: row.publishEnv === 'prod' ? 'ok' : 'warn',
    note: row.publishEnv === 'prod' ? '新建 · 待 API Owner' : '新建 · stg',
  })
  resetPage()
  const env = row.publishEnv === 'prod' ? 'prod（待 API Owner 审批）' : 'stg'
  showToast(`🚀 已发布 ${row.method} ${row.path} → APISIX ${env}`, 'success')
  openApiDetail(row)
}

function goApply(apiPath) {
  router.push({ path: '/apply', query: { type: 'api', path: apiPath || undefined } })
}

function syncApisix() {
  showToast('已触发与 APISIX Admin 同步', 'info')
}

function openApiDetail(a) {
  detail.value = a
  detailOpen.value = true
}

function closeApiDetail() {
  detailOpen.value = false
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
      subtitle="SQLREST SQL2API 构建 / 试跑 · APISIX 运行时 · 查询经 Trino · 订阅与调用审计 · SLA 99.9%"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="buildApi">📝 构建 API</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goApply()">🔑 申请凭证</button>
    </PageHeader>

    <ApiBuildWizard :open="createOpen" @close="createOpen = false" @publish="onPublishApi" />

    <div class="kpi-grid ds-kpi">
      <div v-for="(k, i) in DS_KPIS" :key="i" class="kpi-card ds-kpi-card">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span v-if="k.unit" class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-delta" :class="k.deltaCls">{{ k.delta }}</div>
      </div>
    </div>

    <div class="card ds-api-card">
      <div class="card-header">
        <div class="card-title">🔌 已发布 API（按业务域）</div>
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
            :key="a.path"
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
              <span>👥 {{ a.sub }} 订阅 · ⏱ {{ a.rt }} · <span class="ac-qps">{{ a.qps }} QPS</span></span>
              <span class="tag" :class="a.levelCls">{{ a.level }}</span>
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
              <button type="button" class="btn btn-sm ac-detail-btn" @click.stop="openApiDetail(a)">
                详情
              </button>
            </div>
          </div>
        </div>
        <div v-else class="ds-empty">无匹配 API</div>
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
          <div class="card-title">📊 调用量 Top（近 7 天）</div>
          <span class="tag tag-green">APISIX 审计</span>
        </div>
        <div class="card-body ds-rank">
          <div v-for="(r, ri) in API_CALL_RANK" :key="ri" class="call-bar-row">
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
          <div class="card-title">🧾 订阅凭证</div>
          <span class="tag tag-orange">3 待审批</span>
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
              <tr v-for="(s, si) in SUB_LIST" :key="si">
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
        <div class="card-title">🌐 APISIX 路由与策略 <span class="tip">· 同步状态：15s 前</span></div>
        <div class="ds-apisix-actions">
          <span class="tag tag-green">● 网关集群正常 3 节点</span>
          <button type="button" class="btn btn-sm" @click="syncApisix">♻️ 与 APISIX 同步</button>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table ds-route-table">
          <thead>
            <tr>
              <th>路由</th>
              <th>上游（APISIX → SQLREST → Trino）</th>
              <th>鉴权</th>
              <th>限流</th>
              <th>熔断</th>
              <th>计量</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in routes" :key="r.path">
              <td><code class="route-path">{{ r.path }}</code></td>
              <td style="font-size: 12px">{{ r.upstream }}</td>
              <td><span class="tag tag-purple" style="font-size: 10px">{{ r.auth }}</span></td>
              <td style="font-size: 12px">{{ r.rate }}</td>
              <td style="text-align: center">{{ r.breaker }}</td>
              <td style="text-align: center">{{ r.meter }}</td>
              <td>
                <span class="tag" :class="apisixStatusMeta(r.status).tag" style="font-size: 10px">
                  {{ apisixStatusMeta(r.status).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
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
            <div><span class="tag" :class="detail.levelCls">{{ detail.level }}</span></div>
          </div>
          <div><span>鉴权</span><div>{{ detail.auth || 'Token' }}</div></div>
          <div><span>环境</span><div>{{ detail.publishEnv || 'prod' }}</div></div>
          <div><span>全局限流</span><div>{{ detail.qps }} QPS · Burst {{ detail.burst || '—' }}</div></div>
          <div><span>延迟 / 订阅</span><div>{{ detail.rt }} · {{ detail.sub }} 应用</div></div>
          <div><span>负责人</span><div>{{ detail.owner || '—' }}</div></div>
          <div><span>发布时间</span><div>{{ detail.publishedAt || '—' }}</div></div>
          <div v-if="detail.metric && detail.metric !== '-'"><span>指标</span><div><code>{{ detail.metric }}</code></div></div>
          <div v-if="detail.datasourceLabel || detail.datasourceId">
            <span>数据源</span>
            <div><code>{{ detail.datasourceLabel || detail.datasourceId }}</code></div>
          </div>
          <div v-if="detail.srcType"><span>来源类型</span><div>{{ detail.srcType }}</div></div>
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
          <div><span>熔断</span><div>{{ detail.breaker || '—' }}</div></div>
        </div>

        <div class="detail-sec-title">SQL 模板</div>
        <SqlEditor
          v-if="detail.sql"
          :model-value="detail.sql"
          readonly
          compact
          :rows="6"
          label="SQLREST"
          hint="只读预览"
        />
        <p v-else class="tip detail-empty">暂无 SQL 模板（可能为代理或非 SQL 接口）</p>

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
        <p v-else class="tip detail-empty">未配置入参</p>

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

        <div class="detail-sec-title">APISIX 路由</div>
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
        <p v-else class="tip detail-empty">未匹配到网关路由</p>

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
          <button type="button" class="btn btn-sm" @click="goApply(detail.path)">🔑 申请凭证</button>
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
.ac-qps {
  font-weight: 600;
  color: var(--text-2);
}
.ac-bind {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ac-detail-btn {
  margin-left: auto;
  font-size: 11px;
  padding: 2px 8px;
}
.muted {
  color: var(--text-4);
}
.ds-empty {
  text-align: center;
  padding: 24px;
  color: var(--text-3);
}
.ds-mid {
  margin-bottom: 14px;
}
.call-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.cbr-name {
  width: 38%;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}
.cbr-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-2);
  border-radius: 4px;
  overflow: hidden;
}
.cbr-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), #69c0ff);
  border-radius: 4px;
}
.cbr-val {
  font-size: 11px;
  font-weight: 600;
  width: 52px;
  text-align: right;
  flex-shrink: 0;
}
.ds-sub-table {
  font-size: 12px;
}
.ds-apisix {
  margin-top: 0;
}
.ds-apisix-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}
.ds-route-table {
  font-size: 12px;
}
.route-path {
  font-size: 12px;
  font-weight: 600;
}

.api-detail {
  padding: 16px 18px 28px;
  height: 100%;
  overflow: auto;
}
.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.detail-title {
  font-size: 16px;
  font-weight: 600;
}
.detail-path-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.detail-path {
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}
.detail-kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  font-size: 13px;
  margin-bottom: 16px;
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
.detail-sec-title {
  font-size: 13px;
  font-weight: 600;
  margin: 14px 0 8px;
}
.detail-table {
  font-size: 12px;
  margin-bottom: 4px;
}
.detail-empty {
  margin: 0 0 8px;
}
.detail-route {
  display: grid;
  gap: 8px;
  font-size: 12px;
  padding: 10px 12px;
  background: var(--bg-2);
  border-radius: 8px;
}
.detail-route > div {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.detail-route > div > span:first-child {
  color: var(--text-3);
  min-width: 40px;
  flex-shrink: 0;
}
.detail-route .wide {
  display: block;
}
.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 18px;
  flex-wrap: wrap;
}
.tip {
  font-size: 12px;
  color: var(--text-3);
}
</style>
