<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import ProjectSyncListModal from '@/components/dataservice/ProjectSyncListModal.vue'
import { useToast } from '@/composables/useToast'
import { useDataservice } from '@/composables/useDataservice'
import { useActionLock } from '@/composables/useActionLock'
import { useSession } from '@/composables/useSession'
import { usePager } from '@/composables/usePager'
import { pageGuideOf } from '@/data/pageGuides'
import '@/styles/dataservice-page.css'

const router = useRouter()
const { showToast } = useToast()
const { busy, run: runLocked } = useActionLock()
const guide = pageGuideOf('dataservice')
const {
  pendingPublish,
  kpis,
  degraded,
  workbench,
  sqlrestDs,
  embed,
  ensureLoaded,
  runProjectDs,
} = useDataservice()

const { currentWs } = useSession()
onMounted(() => ensureLoaded(true))
watch(currentWs, () => {
  ensureLoaded(true).catch(() => {})
})

const pendingListOpen = ref(false)
const failedListOpen = ref(false)
const projecting = computed(() => busy('project'))
const gatewayUrl = computed(() => embed.value?.gateway || workbench.value?.gatewayUrl || '')
const pendingProject = computed(() =>
  (sqlrestDs.value || []).filter(
    (d) => d.projectable && !d.projected && d.syncState !== 'error',
  ),
)
const failedProject = computed(() =>
  (sqlrestDs.value || []).filter((d) => d.projectable && d.syncState === 'error'),
)

const {
  page: pendingPage,
  pageSize: pendingPageSize,
  total: pendingTotal,
  totalPages: pendingTotalPages,
  paged: pendingPaged,
  pageNums: pendingPageNums,
  goPage: goPendingPage,
} = usePager(pendingPublish)

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

function goApis(query) {
  router.push({ path: '/dataservice/apis', query })
}

function goBuild(id) {
  router.push(id ? `/dataservice/build/${id}` : '/dataservice/build')
}

function goRuntime() {
  router.push('/dataservice/runtime')
}

function goApplyTicket(ticketNo) {
  router.push({
    path: '/apply',
    query: ticketNo ? { tab: 'api_publish', ticket: ticketNo } : { tab: 'api_publish' },
  })
}
</script>

<template>
  <div class="ds-page">
    <PageHeader
      page-id="dataservice"
      title="服务概览"
      subtitle="投影 · 构建 · 发布 · 调用入口"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm btn-primary" @click="goBuild()">构建 API</button>
      <button type="button" class="btn btn-sm" @click="goApis()">API 目录</button>
      <button type="button" class="btn btn-sm" @click="goRuntime()">运行与网关</button>
    </PageHeader>

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
            <div class="tip">工作台编写 SQL/脚本并试跑</div>
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
        <button type="button" class="btn btn-sm" @click="goBuild()">打开构建工作台</button>
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
        <span class="tag tag-orange">{{ pendingTotal }} 条</span>
        <button type="button" class="btn btn-sm" style="margin-left: auto" @click="goApplyTicket()">
          申请中心 →
        </button>
      </div>
      <div class="card-body" style="padding: 0">
        <table v-if="pendingPaged.length" class="table ds-sub-table">
          <thead>
            <tr>
              <th>API</th>
              <th>工单号</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in pendingPaged" :key="p.ticketNo || p.id">
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
              <td class="ds-pending-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  :disabled="!p.bindingId"
                  @click="goBuild(p.bindingId)"
                >
                  回工作台
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="tip" style="padding: 12px 16px">
          暂无待发布项。在「构建工作台」保存后点「申请发布」，工单待审/驳回时会出现在此。
        </p>
        <ListPager
          v-model:page="pendingPage"
          v-model:page-size="pendingPageSize"
          :total="pendingTotal"
          :total-pages="pendingTotalPages"
          :page-nums="pendingPageNums"
          :page-count="pendingPaged.length"
          @go="goPendingPage"
        />
      </div>
    </div>
  </div>
</template>
