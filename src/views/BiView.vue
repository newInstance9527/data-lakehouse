<script setup>
/**
 * BI · 看板（看数主场）
 * 制作 / 接入 / 建图 → /bi/studio
 */
import { computed } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import MetricDimFilterBar from '@/components/metrics/MetricDimFilterBar.vue'
import BiEmbedFrame from '@/components/bi/BiEmbedFrame.vue'
import DeferredRefreshBar from '@/components/common/DeferredRefreshBar.vue'
import { pageGuideOf } from '@/data/pageGuides'
import { useBiWorkbench } from '@/composables/useBiWorkbench'
import '@/styles/dataservice-page.css'

const guide = pageGuideOf('bi')
const wb = useBiWorkbench({ watchingMode: true })

const setupHint = computed(() => {
  const n = (wb.pending?.length || 0) + (wb.failed?.length || 0)
  if (wb.needsSetup) return '还没有可看内容，请先到制作台完成接通与发布'
  if (n > 0) return `制作台有 ${n} 项待处理`
  return ''
})
</script>

<template>
  <div class="ds-page bi-page">
    <PageHeader page-id="bi" title="看板" subtitle="选一块直接看，数据按您的权限展示" :guide="guide">
      <button
        type="button"
        class="btn btn-sm btn-primary"
        :disabled="wb.syncingDash"
        @click="wb.syncDash()"
      >
        {{ wb.syncingDash ? '同步中…' : '同步列表' }}
      </button>
      <button type="button" class="btn btn-sm" @click="wb.router.push('/bi/studio')">制作台</button>
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
      message="有新的看板更新。确认后刷新列表，不会打断当前观看。"
      apply-label="更新列表"
      @apply="wb.confirmBiRefresh()"
      @dismiss="wb.discardBiPending()"
    />

    <CreateFormModal
      :open="wb.pinModalOpen"
      :title="wb.pinModalTitle"
      intro="收藏后会出现在「仅我的」；关联业务指标后才能按权限安全看数。"
      :fields="wb.pinFields"
      :initial-values="wb.pinInitial"
      :submit-label="wb.pinModalSubmit"
      width="480px"
      @close="wb.pinModalOpen = false"
      @submit="wb.submitPin"
    />

    <div class="bi-status-slim">
      <span
        class="bi-status-dot"
        :class="{ ok: wb.healthOk, bad: wb.status?.configured && !wb.healthOk }"
      />
      <span>{{ wb.healthOk ? '可看数' : wb.healthLabel }}</span>
      <span class="tip">· 我的 {{ wb.myBoards.length }} / 全部 {{ wb.dashboards.length }}</span>
      <button
        v-if="setupHint"
        type="button"
        class="bi-linkish bi-warn"
        @click="wb.router.push('/bi/studio')"
      >
        {{ setupHint }}
      </button>
    </div>

    <div class="bi-view-layout">
      <aside class="card bi-board-rail">
        <div class="bi-rail-head">
          <strong>看板列表</strong>
          <label class="tip bi-check">
            <input v-model="wb.showPinnedOnly" type="checkbox" />
            仅我的
          </label>
        </div>
        <input
          v-model="wb.boardQuery"
          class="input bi-rail-search"
          type="search"
          placeholder="搜索看板…"
        />
        <div v-if="!wb.filteredDashboards.length" class="bi-rail-empty tip">
          <template v-if="wb.needsSetup">
            暂无看板
            <button
              type="button"
              class="btn btn-sm btn-primary"
              style="margin-top: 10px"
              @click="wb.router.push('/bi/studio')"
            >
              去制作台
            </button>
          </template>
          <template v-else-if="wb.boardQuery">无匹配</template>
          <template v-else>
            列表为空。可点「同步列表」，或到制作台建图后再同步。
          </template>
        </div>
        <ul v-else class="bi-board-list">
          <li
            v-for="d in wb.filteredDashboards"
            :key="d.id"
            class="bi-board-item"
            :class="{
              active: d.id === wb.embedDashboardId,
              muted: d.syncState === 'revoked' || d.canEmbed === false,
            }"
          >
            <button type="button" class="bi-board-pick" @click="wb.viewEmbedded(d)">
              <span class="bi-board-title">{{ d.title || d.slug || '未命名看板' }}</span>
              <span class="bi-board-meta tip">
                <span :class="wb.syncStateClass(d.canEmbed === false ? 'error' : d.syncState)">
                  {{ wb.boardStatusLabel(d) }}
                </span>
              </span>
            </button>
            <div class="bi-board-acts">
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
                  设置
                </button>
                <button type="button" class="btn btn-sm" @click="wb.toggleUnpin(d)">取消</button>
              </template>
            </div>
          </li>
        </ul>
      </aside>

      <section class="card bi-embed-panel">
        <div class="bi-embed-head">
          <div>
            <div class="ds-step-t">{{ wb.embedTitle || '从左侧选择看板' }}</div>
            <div class="tip">门户内直接观看，无需再次登录</div>
          </div>
          <div class="bi-embed-head-acts">
            <button
              type="button"
              class="btn btn-sm"
              :class="{ 'btn-primary': wb.dimOpen }"
              @click="wb.dimOpen = !wb.dimOpen"
            >
              {{ wb.dimOpen ? '收起筛选' : '维度筛选' }}
            </button>
          </div>
        </div>

        <div v-if="wb.dimOpen" class="bi-dim-drawer">
          <p class="tip bi-lead">选择指标与维度后应用到当前看板。</p>
          <div class="bi-step-row">
            <select v-model="wb.selectedDatasetId" class="input" style="max-width: 280px">
              <option value="">选择已接入指标…</option>
              <option v-for="d in wb.datasets" :key="d.id" :value="d.id">
                {{ d.metricCode }}（{{ d.ver }}）
              </option>
            </select>
            <input
              v-model="wb.publishCode"
              class="input"
              placeholder="或填指标编码"
              style="max-width: 160px"
            />
          </div>
          <MetricDimFilterBar
            v-model="wb.dimFilters"
            :ws="wb.currentWs"
            :column-filter="wb.grainCols"
          />
          <div class="bi-publish-row">
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="wb.refreshingDims"
              @click="wb.refreshDimsAndEmbed()"
            >
              {{ wb.refreshingDims ? '更新中…' : '应用到看板' }}
            </button>
            <button type="button" class="btn btn-sm" @click="wb.router.push('/bi/studio')">
              去接入更多指标
            </button>
          </div>
        </div>

        <div v-if="wb.activeBoard && wb.activeBoard.canEmbed === false" class="bi-empty">
          <p class="bi-empty-t">暂时不能观看</p>
          <p class="tip">{{ wb.friendlyEmbedBlock(wb.activeBoard) }}</p>
          <div class="bi-onboard-links" style="justify-content: center">
            <button
              type="button"
              class="btn btn-sm btn-primary"
              @click="wb.openPinModal(wb.activeBoard, wb.activeBoard.pinned ? 'edit' : 'pin')"
            >
              设置关联指标
            </button>
            <button type="button" class="btn btn-sm" @click="wb.router.push('/apply')">
              申请权限
            </button>
          </div>
        </div>
        <template v-else-if="wb.embedDashboardId && wb.activeBoard?.canEmbed !== false">
          <BiEmbedFrame
            :dashboard-id="wb.embedDashboardId"
            :ws="wb.currentWs"
            :filters="wb.dimFilters"
            :reload-token="wb.embedReloadToken"
            height="70vh"
            @error="(e) => wb.showToast(e?.message || '看板加载失败', 'warning')"
          />
        </template>
        <div v-else-if="wb.needsSetup" class="bi-empty">
          <p class="bi-empty-t">从制作台开始</p>
          <p class="tip">接通数据 → 接入指标 → 建图 → 同步回这里</p>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            @click="wb.router.push('/bi/studio')"
          >
            打开制作台
          </button>
        </div>
        <div v-else class="bi-empty tip">在左侧点选看板即可观看</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.bi-status-slim {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--text-2, #666);
}
.bi-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-3, #999);
}
.bi-status-dot.ok {
  background: var(--success, #389e0d);
}
.bi-status-dot.bad {
  background: var(--danger, #cf1322);
}
.bi-linkish {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}
.bi-warn {
  color: var(--warning, #d46b08);
}
.bi-view-layout {
  display: grid;
  grid-template-columns: minmax(200px, 260px) 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 960px) {
  .bi-view-layout {
    grid-template-columns: 1fr;
  }
}
.bi-board-rail {
  padding: 14px;
  max-height: calc(70vh + 100px);
  overflow: auto;
}
.bi-rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.bi-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.bi-rail-search {
  width: 100%;
  margin-bottom: 10px;
}
.bi-rail-empty {
  padding: 20px 4px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.bi-board-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bi-board-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  transition: border-color 0.15s;
}
.bi-board-item.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary-light, rgba(22, 119, 255, 0.2));
}
.bi-board-item.muted {
  opacity: 0.55;
}
.bi-board-pick {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 2px;
  color: inherit;
}
.bi-board-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}
.bi-board-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.bi-board-acts {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.bi-embed-panel {
  padding: 16px 18px;
  min-height: 360px;
}
.bi-embed-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.bi-embed-head-acts {
  display: flex;
  gap: 8px;
}
.bi-dim-drawer {
  padding: 12px 14px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--bg-2, #f7f8fa);
}
.bi-lead {
  margin: 0 0 10px;
  line-height: 1.5;
}
.bi-step-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.bi-publish-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.bi-empty {
  padding: 56px 16px;
  text-align: center;
}
.bi-empty-t {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
}
.bi-onboard-links {
  margin-top: 14px;
  display: flex;
  gap: 8px;
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
