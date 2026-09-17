<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import { useToast } from '@/composables/useToast'
import { WORKSPACE_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  WORKSPACES,
  WS_KPIS,
  WS_QUOTA,
  membersOf,
  quotaOf,
  wsQuotaBarColor,
  wsQuotaStatusMeta,
} from '@/data/workspace'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('workspace')

const createOpen = ref(false)
const list = ref(WORKSPACES.map((w) => ({ ...w })))
const activeId = ref(list.value.find((w) => w.current)?.id || list.value[0]?.id)

const active = computed(() => list.value.find((w) => w.id === activeId.value) || list.value[0])
const members = computed(() => membersOf(active.value?.id))
const activeQuota = computed(() => quotaOf(active.value?.id))

function storagePct(w) {
  return Math.round((w.storage.used / w.storage.quota) * 100)
}
function cuPct(w) {
  return Math.round((w.cu.used / w.cu.quota) * 100)
}

function selectWs(w) {
  activeId.value = w.id
  if (!w.current) {
    showToast(`已选中空间：${w.name}（未切换当前）`, 'info')
  }
}

function switchCurrent(w) {
  list.value.forEach((x) => {
    x.current = x.id === w.id
  })
  activeId.value = w.id
  showToast(`🔀 已切换工作空间：${w.name} · Catalog ${w.catalog}`, 'success')
}

function switchCatalog() {
  const target = list.value.find((w) => w.id === 'ws_finance') || list.value[0]
  switchCurrent(target)
  showToast(`已切换 Gravitino Catalog：${target.id}`, 'info')
}

function openCreate() {
  createOpen.value = true
}

function onCreate(payload) {
  const id = `ws_${Date.now().toString(36)}`
  const domain = payload.tpl === '自定义' ? '自定义' : payload.tpl
  const quotas = {
    '小(4C16G)': { storage: 2, cu: 400 },
    '中(8C32G)': { storage: 4, cu: 800 },
    '大(16C64G)': { storage: 8, cu: 2000 },
  }
  const q = quotas[payload.res] || quotas['中(8C32G)']
  const memberCount = payload.members
    ? payload.members.split(/[,，]/).map((s) => s.trim()).filter(Boolean).length
    : 1
  const item = {
    id,
    name: payload.name,
    icon: domain === '交易' ? '🛒' : domain === '用户' ? '👤' : domain === '商品' ? '📦' : '🗂️',
    desc: `${domain}域新建空间 · ${payload.res}`,
    members: memberCount,
    tables: 0,
    owner: '当前用户',
    owners: '当前用户',
    catalog: `iceberg_${id.replace('ws_', '')}`,
    gravitino: `lakehouse.${id.replace('ws_', '')}`,
    icebergDb: `iceberg.${id.replace('ws_', '')}`,
    minio: `s3a://lakehouse/${id.replace('ws_', '')}/`,
    createdAt: new Date().toISOString().slice(0, 10),
    tags: [{ text: '新建', cls: 'tag-blue' }],
    detail: `基于「${payload.tpl}」模板创建，规格 ${payload.res}。`,
    current: false,
    storage: { used: 0, quota: q.storage },
    cu: { used: 0, quota: q.cu },
    domain,
    role: 'Owner',
    rg: `rg_${id.replace('ws_', '')}`,
  }
  list.value.unshift(item)
  activeId.value = id
  showToast(`✅ 工作空间已创建：${payload.name}`, 'success')
}

function inviteMember() {
  showToast('已打开邀请成员对话框（演示）', 'info')
}

function memberAction(row) {
  if (row.action === 'audit') {
    router.push('/apply')
    return
  }
  if (row.action === 'rotate') {
    showToast(`🔑 已触发凭证轮转 · ${row.name}`, 'success')
    return
  }
  showToast(`已移除成员 · ${row.name}`, 'warning')
}
</script>

<template>
  <div class="ws-page">
    <PageHeader
      title="🗂️ 工作空间"
      subtitle="数据域治理 · Catalog 隔离 · 资源与配额 · 成员与角色"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="switchCatalog">🔀 切换 Catalog</button>
      <button type="button" class="btn btn-sm btn-primary" @click="openCreate">＋ 新建空间</button>
    </PageHeader>

    <CreateFormModal
      :open="createOpen"
      v-bind="WORKSPACE_FORM"
      @close="createOpen = false"
      @submit="onCreate"
    />

    <div class="kpi-grid ws-kpi">
      <div v-for="(k, i) in WS_KPIS" :key="i" class="kpi-card">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span v-if="k.unit" class="kpi-unit"> {{ k.unit }}</span>
        </div>
        <div class="kpi-delta" :class="k.deltaCls">{{ k.delta }}</div>
      </div>
    </div>

    <div class="ws-layout">
      <!-- 左侧空间列表 -->
      <div class="card ws-side">
        <div class="card-header">
          <div class="card-title">📋 空间列表</div>
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
            @dblclick="switchCurrent(w)"
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

      <!-- 中间详情 + 成员 -->
      <div class="ws-main" v-if="active">
        <div class="card">
          <div class="card-header">
            <div class="card-title">🧾 空间详情 · {{ active.id }}（{{ active.domain }}域）</div>
            <button
              v-if="!active.current"
              type="button"
              class="btn btn-sm btn-primary"
              @click="switchCurrent(active)"
            >
              切换为当前
            </button>
          </div>
          <div class="card-body ws-detail">
            <div class="ws-detail-grid">
              <div><span class="muted">Catalog：</span><code>{{ active.gravitino }}</code></div>
              <div><span class="muted">Iceberg DB：</span><code>{{ active.icebergDb }}</code></div>
              <div><span class="muted">MinIO Path：</span><code>{{ active.minio }}</code></div>
              <div><span class="muted">Owner：</span>{{ active.owners }}</div>
              <div><span class="muted">创建时间：</span>{{ active.createdAt }}</div>
              <div class="ws-tags">
                <span class="muted">标签：</span>
                <span v-for="(t, ti) in active.tags" :key="ti" class="tag" :class="t.cls">{{ t.text }}</span>
              </div>
            </div>
            <div class="ws-detail-desc">📐 空间描述：{{ active.detail }}</div>
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
            <div class="card-title">🧑‍🤝‍🧑 成员与角色</div>
            <button type="button" class="btn btn-sm" @click="inviteMember">＋ 邀请成员</button>
          </div>
          <div class="card-body" style="padding: 0">
            <table class="table">
              <thead>
                <tr>
                  <th>成员</th>
                  <th>角色</th>
                  <th>数据范围</th>
                  <th>最近登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!members.length">
                  <td colspan="5" style="text-align: center; color: var(--text-3); padding: 20px">暂无成员</td>
                </tr>
                <tr v-for="(m, mi) in members" :key="mi">
                  <td>{{ m.name }}</td>
                  <td><span class="tag" :class="m.roleCls">{{ m.role }}</span></td>
                  <td style="font-size: 12px">{{ m.scope }}</td>
                  <td style="font-size: 12px; color: var(--text-3)">{{ m.last }}</td>
                  <td>
                    <button type="button" class="btn-link" @click="memberAction(m)">
                      {{ m.action === 'audit' ? '权限审计' : m.action === 'rotate' ? '轮转凭证' : '移除' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 右侧配额 -->
      <div class="card ws-quota-side">
        <div class="card-header">
          <div class="card-title">⚖️ 资源配额 <span class="tip">· {{ active?.rg || '—' }}</span></div>
        </div>
        <div class="card-body ws-quota-body">
          <div v-if="activeQuota" class="ws-quota-focus">
            <div class="wqf-title">当前空间 {{ activeQuota.ws }}</div>
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

          <div class="wqf-all-title">全部空间配额</div>
          <div v-for="q in WS_QUOTA" :key="q.ws" class="wqf-item" :class="{ active: q.ws === active?.id }">
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
.ws-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
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
