<script setup>
/**
 * BI · 制作台（接通 → 接入指标 → 建图 → 同步 / 分享）
 */
import { computed } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import MetricDimFilterBar from '@/components/metrics/MetricDimFilterBar.vue'
import DeferredRefreshBar from '@/components/common/DeferredRefreshBar.vue'
import { pageGuideOf } from '@/data/pageGuides'
import { useBiWorkbench } from '@/composables/useBiWorkbench'
import '@/styles/dataservice-page.css'

const guide = pageGuideOf('bi-studio')
const wb = useBiWorkbench({ watchingMode: false })

const flow = computed(() => [
  {
    n: 1,
    title: '接通数据',
    done: wb.studioReady.connOk,
    desc: '湖仓查询接到分析服务',
  },
  {
    n: 2,
    title: '接入指标',
    done: wb.studioReady.dataOk,
    desc: '发布业务指标供建图与看数',
  },
  {
    n: 3,
    title: '创建图表',
    done: wb.studioReady.boardOk,
    desc: '在分析工具中建图并同步回来',
  },
])
</script>

<template>
  <div class="ds-page bi-page">
    <PageHeader
      page-id="bi-studio"
      title="制作台"
      subtitle="接通 · 接入指标 · 建图 · 同步与分享"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm btn-primary" @click="wb.router.push('/bi')">
        回看板看数
      </button>
      <button
        type="button"
        class="btn btn-sm"
        :disabled="wb.loading"
        @click="wb.reload({ force: true })"
      >
        刷新
      </button>
    </PageHeader>

    <DeferredRefreshBar
      :show="wb.hasBiPending"
      message="后台状态有更新，确认后刷新本页列表。"
      apply-label="更新"
      @apply="wb.confirmBiRefresh()"
      @dismiss="wb.discardBiPending()"
    />

    <CreateFormModal
      :open="wb.pinModalOpen"
      :title="wb.pinModalTitle"
      intro="收藏与关联指标后，门户看数才会按权限隔离。"
      :fields="wb.pinFields"
      :initial-values="wb.pinInitial"
      :submit-label="wb.pinModalSubmit"
      width="480px"
      @close="wb.pinModalOpen = false"
      @submit="wb.submitPin"
    />

    <div class="bi-flow card">
      <div v-for="s in flow" :key="s.n" class="bi-flow-item" :class="{ done: s.done }">
        <span class="bi-flow-n">{{ s.done ? '✓' : s.n }}</span>
        <div>
          <div class="bi-flow-t">{{ s.title }}</div>
          <div class="tip">{{ s.desc }}</div>
        </div>
      </div>
    </div>

    <section class="card bi-sec">
      <div class="bi-sec-head">
        <div>
          <div class="ds-step-t">① 接通数据</div>
          <p class="tip bi-lead">一般只需做一次。只接湖仓查询入口，不直连业务库。</p>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="wb.projecting"
          @click="wb.projectAll()"
        >
          {{ wb.projecting ? '接通中…' : '一键接通' }}
        </button>
      </div>
      <p v-if="wb.status && !wb.healthOk" class="tip bi-warn-line">
        分析服务未就绪（{{ wb.healthLabel }}）
        <template v-if="wb.status?.health?.message || wb.status?.health?.error">
          · {{ wb.status.health.message || wb.status.health.error }}
        </template>
        。请检查 Superset 地址与服务账号后点「刷新」。
      </p>
      <p v-if="wb.pending.length || wb.failed.length" class="tip bi-warn">
        待处理 {{ wb.pending.length + wb.failed.length }} 项
      </p>
      <table class="data-table" style="width: 100%">
        <thead>
          <tr>
            <th>名称</th>
            <th>状态</th>
            <th v-if="wb.showAdvanced">编码</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!wb.projection.length">
            <td :colspan="wb.showAdvanced ? 4 : 3" class="tip" style="padding: 16px">
              暂无查询入口。请先到
              <a href="#" @click.prevent="wb.router.push('/datasource')">数据源</a>
              登记后再接通。
            </td>
          </tr>
          <tr v-for="d in wb.projection" :key="d.dsId">
            <td>{{ d.name || d.dsCode }}</td>
            <td>
              <span :class="wb.syncStateClass(d.syncState || 'pending')">
                {{ wb.syncStateLabel(d.syncState || 'pending') }}
              </span>
            </td>
            <td v-if="wb.showAdvanced"><code>{{ d.dsCode }}</code></td>
            <td>
              <button
                type="button"
                class="btn btn-sm"
                :disabled="wb.projecting"
                @click="wb.projectOne(d.dsId)"
              >
                接通
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="btn btn-sm bi-adv-toggle" @click="wb.showAdvanced = !wb.showAdvanced">
        {{ wb.showAdvanced ? '收起技术细节' : '显示技术细节' }}
      </button>
    </section>

    <section class="card bi-sec">
      <div class="bi-sec-head">
        <div>
          <div class="ds-step-t">② 接入指标</div>
          <p class="tip bi-lead">把业务指标发布为分析可用的数据；可选维度后再建图或看数。</p>
        </div>
        <button type="button" class="btn btn-sm" @click="wb.router.push('/metrics/catalog')">
          指标目录
        </button>
      </div>
      <div class="bi-step-row">
        <input
          v-model="wb.publishCode"
          class="input"
          placeholder="指标编码，如 M-销售额"
          style="max-width: 200px"
        />
        <select v-model="wb.selectedDatasetId" class="input" style="max-width: 240px">
          <option value="">已接入列表…</option>
          <option v-for="d in wb.datasets" :key="d.id" :value="d.id">
            {{ d.metricCode }}（{{ d.ver }}）
          </option>
        </select>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="wb.publishing"
          @click="wb.doPublish()"
        >
          {{ wb.publishing ? '接入中…' : '接入指标' }}
        </button>
      </div>
      <MetricDimFilterBar
        v-model="wb.dimFilters"
        :ws="wb.currentWs"
        :column-filter="wb.grainCols"
      />
      <div class="bi-publish-row">
        <button
          type="button"
          class="btn btn-sm"
          :disabled="wb.refreshingDims"
          @click="wb.refreshDimsAndEmbed()"
        >
          {{ wb.refreshingDims ? '更新中…' : '按维度更新并去看板' }}
        </button>
      </div>
      <table class="data-table" style="width: 100%; margin-top: 12px">
        <thead>
          <tr>
            <th>指标</th>
            <th>版本</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!wb.datasets.length">
            <td colspan="4" class="tip" style="padding: 16px">
              尚未接入。填写编码点「接入指标」，或从指标目录「发布到 BI」。
            </td>
          </tr>
          <tr v-for="d in wb.datasets" :key="d.id">
            <td>{{ d.metricCode }}</td>
            <td>{{ d.ver }}</td>
            <td>
              <span :class="wb.syncStateClass(d.syncState)">{{ wb.syncStateLabel(d.syncState) }}</span>
            </td>
            <td style="white-space: nowrap">
              <button
                type="button"
                class="btn btn-sm"
                @click="
                  wb.selectedDatasetId = d.id;
                  wb.publishCode = d.metricCode || wb.publishCode
                "
              >
                选用
              </button>
              <button
                v-if="d.syncState === 'stale'"
                type="button"
                class="btn btn-sm btn-primary"
                :disabled="wb.publishing"
                @click="wb.republishStale(d)"
              >
                重新接入
              </button>
              <button
                v-if="wb.status?.oidcEnabled"
                type="button"
                class="btn btn-sm"
                @click="wb.goAuthorDataset(d)"
              >
                用它建图
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="card bi-sec">
      <div class="ds-step-t">③ 创建图表与看板</div>
      <p class="tip bi-lead">
        在分析工具中完成制图（与门户同一账号）。建好后「同步看板」即可在门户观看。
      </p>
      <div class="bi-author-grid">
        <button
          type="button"
          class="bi-author-card"
          :disabled="!wb.status?.oidcEnabled"
          @click="wb.goAuthoring('home')"
        >
          <strong>分析首页</strong>
          <span class="tip">进入编排总览</span>
        </button>
        <button
          type="button"
          class="bi-author-card"
          :disabled="!wb.status?.oidcEnabled"
          @click="wb.goAuthoring('dashboard')"
        >
          <strong>新建看板</strong>
          <span class="tip">组合多张图表</span>
        </button>
        <button
          type="button"
          class="bi-author-card"
          :disabled="!wb.status?.oidcEnabled"
          @click="wb.goAuthoring('sqllab')"
        >
          <strong>SQL 探索</strong>
          <span class="tip">即席验证后再固化</span>
        </button>
      </div>
      <p v-if="wb.status && !wb.status.oidcEnabled" class="tip bi-warn-line">
        建图需统一登录（OIDC）。现网应已开 Keycloak + Superset
        <code>AUTH_MODE=both</code>
        ；若仍见此提示，请重启门户并确认
        <code>lh.superset.oidc-enabled=true</code>。
      </p>
      <div class="bi-publish-row">
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="wb.syncingDash"
          @click="wb.syncDash()"
        >
          {{ wb.syncingDash ? '同步中…' : '同步看板到门户' }}
        </button>
        <button type="button" class="btn btn-sm" @click="wb.router.push('/bi')">去看板观看</button>
      </div>
    </section>

    <section class="card bi-sec">
      <div class="ds-step-t">④ 收藏、关联与分享</div>
      <p class="tip bi-lead">
        收藏到「我的」；关联业务指标后看数才按权限隔离。可复制门户链接给同事（需登录且有权限）。
      </p>
      <table class="data-table" style="width: 100%">
        <thead>
          <tr>
            <th>看板</th>
            <th>状态</th>
            <th>关联指标</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!wb.dashboards.length">
            <td colspan="4" class="tip" style="padding: 16px">
              还没有看板。请先建图并「同步看板到门户」。
            </td>
          </tr>
          <tr v-for="d in wb.dashboards" :key="d.id">
            <td>{{ d.title || d.slug || '未命名' }}</td>
            <td>
              <span :class="wb.syncStateClass(d.canEmbed === false ? 'error' : d.syncState)">
                {{ wb.boardStatusLabel(d) }}
              </span>
            </td>
            <td class="tip">{{ d.metricCodes || '—' }}</td>
            <td style="white-space: nowrap">
              <button
                v-if="!d.pinned"
                type="button"
                class="btn btn-sm"
                @click="wb.openPinModal(d, 'pin')"
              >
                收藏
              </button>
              <template v-else>
                <button type="button" class="btn btn-sm" @click="wb.openPinModal(d, 'edit')">
                  关联
                </button>
                <button type="button" class="btn btn-sm" @click="wb.toggleUnpin(d)">取消收藏</button>
              </template>
              <button type="button" class="btn btn-sm" @click="wb.copyShareLink(d)">复制链接</button>
              <button
                type="button"
                class="btn btn-sm btn-primary"
                @click="wb.router.push({ path: '/bi', query: { dashboardId: d.id } })"
              >
                打开
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.bi-flow {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
@media (max-width: 800px) {
  .bi-flow {
    grid-template-columns: 1fr;
  }
}
.bi-flow-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.bi-flow-item.done {
  opacity: 0.7;
}
.bi-flow-n {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary, #1677ff);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bi-flow-item.done .bi-flow-n {
  background: var(--success, #389e0d);
}
.bi-flow-t {
  font-size: 13px;
  font-weight: 600;
}
.bi-sec {
  padding: 18px 18px 14px;
  margin-bottom: 16px;
}
.bi-sec-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}
.bi-lead {
  margin: 4px 0 12px;
  line-height: 1.5;
}
.bi-step-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}
.bi-publish-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.bi-adv-toggle {
  margin-top: 10px;
}
.bi-warn {
  color: var(--warning, #d46b08);
}
.bi-warn-line {
  color: var(--danger, #cf1322);
  margin: 0 0 10px;
}
.bi-author-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 12px 0;
}
@media (max-width: 800px) {
  .bi-author-grid {
    grid-template-columns: 1fr;
  }
}
.bi-author-card {
  text-align: left;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-2, #f7f8fa);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.15s;
}
.bi-author-card:hover:not(:disabled) {
  border-color: var(--primary);
}
.bi-author-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bi-pill {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-2, #f5f5f5);
  color: var(--text-2, #666);
}
.bi-pill.ok {
  background: #f6ffed;
  color: #389e0d;
}
.bi-pill.warn {
  background: #fff7e6;
  color: #d46b08;
}
.bi-pill.bad {
  background: #fff1f0;
  color: #cf1322;
}
</style>
