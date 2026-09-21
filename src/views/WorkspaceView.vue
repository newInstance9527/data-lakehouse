<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import { useToast } from '@/composables/useToast'
import { useWorkspace } from '@/composables/useWorkspace'
import { WORKSPACE_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('workspace')

const {
  spaces,
  quotas,
  kpis,
  loading,
  usingMock,
  sharedCatalog,
  wsQuotaBarColor,
  wsQuotaStatusMeta,
  ensureLoaded,
  loadMembers,
  switchCurrent,
  createSpace,
  dropMember,
  membersOfWs,
  quotaOfWs,
} = useWorkspace()

const createOpen = ref(false)
const activeId = ref('')
const members = ref([])

const list = computed(() => spaces.value)
const active = computed(() => list.value.find((w) => w.id === activeId.value) || list.value[0])
const activeQuota = computed(() => (active.value ? quotaOfWs(active.value.id) : null))

watch(
  list,
  (rows) => {
    if (!rows.length) return
    if (!activeId.value || !rows.some((r) => r.id === activeId.value)) {
      activeId.value = rows.find((r) => r.current)?.id || rows[0].id
    }
  },
  { immediate: true },
)

watch(
  activeId,
  async (id) => {
    if (!id) {
      members.value = []
      return
    }
    members.value = await loadMembers(id)
  },
  { immediate: true },
)

onMounted(async () => {
  await ensureLoaded()
  if (usingMock.value) {
    showToast('工作空间 API 不可用，已使用演示数据（需 Flyway V22 + 后端）', 'warning')
  }
})

function storagePct(w) {
  if (!w?.storage?.quota) return 0
  return Math.round((w.storage.used / w.storage.quota) * 100)
}
function cuPct(w) {
  if (!w?.cu?.quota) return 0
  return Math.round((w.cu.used / w.cu.quota) * 100)
}

function selectWs(w) {
  activeId.value = w.id
  if (!w.current) {
    showToast(`已选中：${w.name}（未设为当前协作上下文）`, 'info')
  }
}

async function setAsCurrent(w) {
  try {
    await switchCurrent(w.id)
    activeId.value = w.id
    showToast(`已设为当前团队上下文：${w.name} · 软过滤「我的团队」`, 'success')
  } catch (e) {
    showToast(e?.message || '切换失败', 'error')
  }
}

function goCatalog() {
  router.push('/catalog')
  showToast('打开资产目录 · 全局发现 · 可按团队筛选', 'info')
}

function goApply() {
  router.push('/apply')
  showToast('打开申请中心 · 读数/出湖须审批，入空间不自动授权', 'info')
}

function openCreate() {
  createOpen.value = true
}

async function onCreate(payload) {
  try {
    const item = await createSpace(payload)
    createOpen.value = false
    if (item?.id) activeId.value = item.id
    showToast(`已创建归属空间：${payload.name}（未建 Catalog）`, 'success')
  } catch (e) {
    showToast(e?.message || '创建失败', 'error')
  }
}

function inviteMember() {
  showToast('邀请成员请调用 POST /lh/workspace/spaces/{code}/members（演示入口）', 'info')
}

async function memberAction(row) {
  if (row.action === 'audit') {
    router.push('/apply')
    showToast('跳转申请中心查看权限相关审批', 'info')
    return
  }
  if (row.action === 'rotate') {
    showToast(`作业 SA 凭证轮转请走安全模块 · ${row.name}`, 'info')
    return
  }
  if (!active.value || usingMock.value) {
    showToast(`已移除成员 · ${row.name}（演示）`, 'warning')
    members.value = membersOfWs(active.value?.id).filter((m) => m.name !== row.name)
    return
  }
  try {
    await dropMember(active.value.id, row.id)
    members.value = await loadMembers(active.value.id)
    showToast(`已移除成员 · ${row.name}（不影响其已有 Grav grant）`, 'warning')
  } catch (e) {
    showToast(e?.message || '移除失败', 'error')
  }
}
</script>

<template>
  <div class="ws-page">
    <PageHeader
      title="🗂️ 工作空间"
      subtitle="组织归属 · 成本配额 · 协作上下文 · 共享资源池（非 Catalog 隔离）"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="goCatalog">📚 资产目录</button>
      <button type="button" class="btn btn-sm" @click="goApply">📝 申请中心</button>
      <button type="button" class="btn btn-sm btn-primary" @click="openCreate">＋ 新建空间</button>
    </PageHeader>

    <CreateFormModal
      :open="createOpen"
      v-bind="WORKSPACE_FORM"
      @close="createOpen = false"
      @submit="onCreate"
    />

    <div v-if="loading" class="ws-loading">加载工作空间…</div>

    <div class="kpi-grid ws-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span v-if="k.unit" class="kpi-unit"> {{ k.unit }}</span>
        </div>
        <div class="kpi-delta" :class="k.deltaCls">{{ k.delta }}</div>
      </div>
    </div>

    <div class="ws-banner">
      <span class="tag tag-blue">共享 Catalog</span>
      <code>{{ sharedCatalog.gravitino }}</code>
      <span class="muted">·</span>
      <span class="muted">{{ sharedCatalog.note }}</span>
      <span v-if="usingMock" class="tag tag-orange">演示数据</span>
    </div>

    <div class="ws-layout">
      <div class="card ws-side">
        <div class="card-header">
          <div class="card-title">📋 团队空间</div>
          <span class="tag tag-blue">{{ list.length }}</span>
        </div>
        <div class="card-body ws-list">
          <button
            v-for="w in list"
            :key="w.id"
            type="button"
            class="ws-list-item"
            :class="{ active: w.id === active?.id, current: w.current }"
            @click="selectWs(w)"
            @dblclick="setAsCurrent(w)"
          >
            <div class="wli-head">
              <span class="wli-name">{{ w.icon }} {{ w.name }}</span>
              <span v-if="w.current" class="wli-cur">● 当前</span>
            </div>
            <div class="wli-desc">{{ w.desc }}</div>
            <div class="wli-meta">
              <span>👥 {{ w.members }}</span>
              <span>📚 {{ w.tables }}</span>
              <span class="tag tag-gray">{{ w.domain }}</span>
            </div>
          </button>
        </div>
      </div>

      <div class="ws-main" v-if="active">
        <div class="card">
          <div class="card-header">
            <div class="card-title">🧾 归属详情 · {{ active.id }}（{{ active.domain }}）</div>
            <button
              v-if="!active.current"
              type="button"
              class="btn btn-sm btn-primary"
              @click="setAsCurrent(active)"
            >
              设为当前上下文
            </button>
          </div>
          <div class="card-body ws-detail">
            <div class="ws-detail-grid">
              <div><span class="muted">成本中心：</span><code>{{ active.costCenter }}</code></div>
              <div><span class="muted">Trino 资源组：</span><code>{{ active.rg }}</code></div>
              <div><span class="muted">共享 Catalog：</span><code>{{ active.gravitino }}</code></div>
              <div><span class="muted">常用 schema：</span><code>{{ active.preferredSchemas }}</code></div>
              <div><span class="muted">Owner：</span>{{ active.owners }}</div>
              <div><span class="muted">创建时间：</span>{{ active.createdAt }}</div>
              <div class="ws-tags">
                <span class="muted">标签：</span>
                <span v-for="(t, ti) in active.tags" :key="ti" class="tag" :class="t.cls">{{ t.text }}</span>
              </div>
            </div>
            <div class="ws-detail-desc">{{ active.detail }}</div>
            <div class="ws-quota-mini">
              <div>
                <div class="ws-quota-label">
                  <span>存储 {{ active.storage.used }}/{{ active.storage.quota }} TB</span>
                  <span>{{ storagePct(active) }}%</span>
                </div>
                <div class="quota-bar">
                  <div :style="{ width: `${storagePct(active)}%`, background: wsQuotaBarColor(storagePct(active)) }" />
                </div>
              </div>
              <div>
                <div class="ws-quota-label">
                  <span>计算 CU {{ active.cu.used }}/{{ active.cu.quota }}</span>
                  <span>{{ cuPct(active) }}%</span>
                </div>
                <div class="quota-bar">
                  <div :style="{ width: `${cuPct(active)}%`, background: wsQuotaBarColor(cuPct(active)) }" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card ws-members-card">
          <div class="card-header">
            <div class="card-title">🧑‍🤝‍🧑 成员与协作角色</div>
            <button type="button" class="btn btn-sm" @click="inviteMember">＋ 邀请成员</button>
          </div>
          <div class="card-body" style="padding: 0">
            <table class="table">
              <thead>
                <tr>
                  <th>成员</th>
                  <th>角色</th>
                  <th>门户职责（≠ 引擎 ACL）</th>
                  <th>最近登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!members.length">
                  <td colspan="5" style="text-align: center; color: var(--text-3); padding: 20px">暂无成员</td>
                </tr>
                <tr v-for="(m, mi) in members" :key="m.id || mi">
                  <td>{{ m.name }}</td>
                  <td><span class="tag" :class="m.roleCls">{{ m.role }}</span></td>
                  <td style="font-size: 12px">{{ m.scope }}</td>
                  <td style="font-size: 12px; color: var(--text-3)">{{ m.last }}</td>
                  <td>
                    <button type="button" class="btn-link" @click="memberAction(m)">
                      {{ m.action === 'audit' ? '去申请中心' : m.action === 'rotate' ? '轮转凭证' : '移除' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card ws-quota-side">
        <div class="card-header">
          <div class="card-title">⚖️ 成本与配额 <span class="tip">· {{ active?.rg || '—' }}</span></div>
        </div>
        <div class="card-body ws-quota-body">
          <div v-if="activeQuota" class="ws-quota-focus">
            <div class="wqf-title">当前团队 {{ activeQuota.ws }}</div>
            <div class="wqf-row">
              <span>存储</span>
              <div class="wqf-bar-wrap">
                <span>{{ activeQuota.storage }}</span>
                <div class="quota-bar">
                  <div :style="{ width: `${activeQuota.sPct}%`, background: wsQuotaBarColor(activeQuota.sPct) }" />
                </div>
              </div>
            </div>
            <div class="wqf-row">
              <span>CU</span>
              <div class="wqf-bar-wrap">
                <span>{{ activeQuota.cu }}</span>
                <div class="quota-bar">
                  <div :style="{ width: `${activeQuota.cPct}%`, background: wsQuotaBarColor(activeQuota.cPct) }" />
                </div>
              </div>
            </div>
            <div class="wqf-meta">
              <div>Trino 并发 {{ activeQuota.trino }}</div>
              <div>API QPS {{ activeQuota.api }}</div>
              <span class="tag" :class="wsQuotaStatusMeta(activeQuota.status).tag">
                {{ wsQuotaStatusMeta(activeQuota.status).label }}
              </span>
            </div>
          </div>

          <div class="wqf-all-title">全部团队配额</div>
          <div v-for="q in quotas" :key="q.ws" class="wqf-item" :class="{ active: q.ws === active?.id }">
            <div class="wqf-item-head">
              <b>{{ q.ws }}</b>
              <span class="tag" :class="wsQuotaStatusMeta(q.status).tag" style="font-size: 10px">
                {{ wsQuotaStatusMeta(q.status).label }}
              </span>
            </div>
            <div class="wqf-item-bars">
              <div class="quota-bar" :title="`存储 ${q.storage}`">
                <div :style="{ width: `${q.sPct}%`, background: wsQuotaBarColor(q.sPct) }" />
              </div>
              <div class="quota-bar" :title="`CU ${q.cu}`">
                <div :style="{ width: `${q.cPct}%`, background: wsQuotaBarColor(q.cPct) }" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ws-loading {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}
.ws-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 12px;
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

.ws-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-2);
  font-size: 12px;
}
.ws-banner .muted {
  color: var(--text-3);
}

.ws-layout {
  display: grid;
  grid-template-columns: 240px 1fr 300px;
  gap: 14px;
  align-items: start;
}
@media (max-width: 1100px) {
  .ws-layout {
    grid-template-columns: 1fr;
  }
}

.ws-list {
  padding: 8px;
  max-height: 640px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ws-list-item {
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.ws-list-item:hover {
  background: var(--bg-2);
  border-color: var(--border);
}
.ws-list-item.active {
  background: rgba(24, 144, 255, 0.08);
  border-color: var(--primary);
}
.ws-list-item.current .wli-cur {
  color: var(--primary);
  font-weight: 700;
}
.wli-head {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: flex-start;
}
.wli-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
}
.wli-cur {
  font-size: 10px;
  flex-shrink: 0;
}
.wli-desc {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.wli-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-3);
  align-items: center;
}

.ws-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.ws-detail {
  font-size: 13px;
  line-height: 1.9;
}
.ws-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px 20px;
  margin-bottom: 8px;
}
@media (max-width: 900px) {
  .ws-detail-grid {
    grid-template-columns: 1fr;
  }
}
.muted {
  color: var(--text-3);
}
.ws-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.ws-detail-desc {
  color: var(--text-3);
  margin: 6px 0 12px;
}
.ws-quota-mini {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.ws-quota-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-3);
}

.quota-bar {
  height: 6px;
  background: var(--bg-2);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}
.quota-bar > div {
  height: 100%;
  border-radius: 3px;
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.ws-quota-body {
  font-size: 12px;
}
.ws-quota-focus {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-2);
  margin-bottom: 14px;
}
.wqf-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.wqf-row {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.wqf-bar-wrap span {
  font-size: 11px;
  color: var(--text-3);
}
.wqf-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  color: var(--text-3);
  margin-top: 4px;
}
.wqf-all-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-2);
}
.wqf-item {
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 6px;
  border: 1px solid transparent;
}
.wqf-item.active {
  border-color: var(--primary);
  background: rgba(24, 144, 255, 0.06);
}
.wqf-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.wqf-item-bars {
  display: grid;
  gap: 4px;
}
</style>
