<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import ListPager from '@/components/common/ListPager.vue'
import SubscriptionKeySecretPanel from '@/components/dataservice/SubscriptionKeySecretPanel.vue'
import { useDataservice } from '@/composables/useDataservice'
import { useSession } from '@/composables/useSession'
import { usePager } from '@/composables/usePager'
import { pageGuideOf } from '@/data/pageGuides'
import { routeStatusMeta } from '@/data/dataservice'
import { formatDateTime } from '@/utils/datetime'
import '@/styles/dataservice-page.css'

const router = useRouter()
const guide = pageGuideOf('dataservice-runtime')
const {
  routes,
  subs,
  apis,
  callRank,
  callTrend,
  degraded,
  workbench,
  embed,
  ensureLoaded,
} = useDataservice()

const { currentWs } = useSession()
onMounted(() => ensureLoaded(true))
watch(currentWs, () => {
  ensureLoaded(true).catch(() => {})
})

const keyDetailOpen = ref(false)
const keyDetail = ref(null)
const keySecretPanel = ref(null)
const gatewayUrl = computed(() => embed.value?.gateway || workbench.value?.gatewayUrl || '')

const {
  page: subPage,
  pageSize: subPageSize,
  total: subTotal,
  totalPages: subTotalPages,
  paged: subPaged,
  pageNums: subPageNums,
  goPage: goSubPage,
} = usePager(subs)

const {
  page: routePage,
  pageSize: routePageSize,
  total: routeTotal,
  totalPages: routeTotalPages,
  paged: routePaged,
  pageNums: routePageNums,
  goPage: goRoutePage,
} = usePager(routes)

function openKeyDetail(s) {
  keyDetail.value = s
  keyDetailOpen.value = true
}

function closeKeyDetail() {
  keyDetailOpen.value = false
  keySecretPanel.value?.remask?.()
}

function goApply(apiPath) {
  router.push({ path: '/apply', query: { type: 'api', path: apiPath || undefined } })
}

function openApiFromKey(s) {
  closeKeyDetail()
  if (s?.bindingId) {
    router.push({ path: '/dataservice/apis', query: { open: s.bindingId } })
    return
  }
  if (s?.api && s.api !== '-') {
    const hit = (apis.value || []).find((a) => a.path === s.api)
    if (hit?.id) router.push({ path: '/dataservice/apis', query: { open: hit.id } })
    else router.push({ path: '/dataservice/apis', query: { q: s.api } })
  }
}
</script>

<template>
  <div class="ds-page">
    <PageHeader
      page-id="dataservice-runtime"
      title="运行与网关"
      subtitle="调用趋势 · 边缘路由 · 订阅 Key"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="router.push('/dataservice/apis')">API 目录</button>
      <button type="button" class="btn btn-sm" @click="goApply()">申请调用凭证</button>
    </PageHeader>

    <p v-if="degraded" class="tip" style="margin: 0 0 12px">后端暂不可达，列表为空</p>

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

    <div class="card ds-mid">
      <div class="card-header">
        <div class="card-title">订阅 Key</div>
        <span class="tag tag-green">申请签发</span>
        <span class="tip" style="margin-left: 8px">共 {{ subTotal }} 条</span>
      </div>
      <div class="card-body" style="padding: 0">
        <table v-if="subPaged.length" class="table ds-sub-table">
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
            <tr v-for="s in subPaged" :key="s.id || s.appKey">
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
        <ListPager
          v-model:page="subPage"
          v-model:page-size="subPageSize"
          :total="subTotal"
          :total-pages="subTotalPages"
          :page-nums="subPageNums"
          :page-count="subPaged.length"
          @go="goSubPage"
        />
      </div>
    </div>

    <div class="card ds-edge">
      <div class="card-header">
        <div class="card-title">
          对外边缘
          <span class="tip">· 统一网关（唯一边缘）· 共 {{ routeTotal }} 条</span>
        </div>
        <div class="ds-edge-actions">
          <span class="tag tag-green">gateway</span>
          <template v-if="gatewayUrl">
            <code class="tip" style="font-size: 11px">{{ gatewayUrl }}</code>
          </template>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table v-if="routePaged.length" class="table ds-route-table">
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
            <tr v-for="r in routePaged" :key="r.path">
              <td><code class="route-path">{{ r.path }}</code></td>
              <td style="font-size: 12px">{{ r.upstream || '网关 → 执行器' }}</td>
              <td><span class="tag tag-purple" style="font-size: 10px">{{ r.auth }}</span></td>
              <td style="font-size: 12px">{{ r.rate }}</td>
              <td>
                <span class="tag" :class="routeStatusMeta(r.status).tag" style="font-size: 10px">
                  {{ routeStatusMeta(r.status).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="tip" style="padding: 12px 16px">
          暂无已发布绑定。在工作台调试/保存/发版后，同步接口目录即可。
        </p>
        <ListPager
          v-model:page="routePage"
          v-model:page-size="routePageSize"
          :total="routeTotal"
          :total-pages="routeTotalPages"
          :page-nums="routePageNums"
          :page-count="routePaged.length"
          @go="goRoutePage"
        />
      </div>
    </div>

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
