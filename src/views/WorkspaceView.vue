<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import { useToast } from '@/composables/useToast'
import { useSession } from '@/composables/useSession'
import { useWorkspace } from '@/composables/useWorkspace'
import { useActionLock } from '@/composables/useActionLock'
import { WORKSPACE_FORM, WORKSPACE_MEMBER_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'

const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const { isSuperAdmin } = useSession()
const { busy, run: runLocked } = useActionLock()
const guide = pageGuideOf('workspace')

const {
  spaces,
  quotas,
  kpis,
  loading,
  lastError,
  currentWs,
  sharedCatalog,
  wsQuotaBarColor,
  wsQuotaStatusMeta,
  ensureLoaded,
  loadMembers,
  switchCurrent,
  createSpace,
  deleteSpace,
  inviteMember,
  dropMember,
  syncGitRemote,
  addTag,
  removeTag,
  refreshQuota,
  updateQuota,
  quotaOfWs,
} = useWorkspace()

const createOpen = ref(false)
const inviteOpen = ref(false)
const activeId = ref('')
const members = ref([])
const aiEditOpen = ref(false)
const aiTokenDraft = ref('')
const aiCostDraft = ref('')
const tagDraft = ref('')
const tagCls = ref('tag-blue')
const tagRemoving = ref('')

const quotaRefreshing = computed(() => busy('quota-refresh'))
const quotaSaving = computed(() => busy('quota-save'))
const deleting = computed(() => busy('delete'))
const tagAdding = computed(() => busy('tag-add'))
const syncingGit = computed(() => busy('sync-git'))
const creatingWs = computed(() => busy('create'))
const inviting = computed(() => busy('invite'))

const TAG_CLS_OPTIONS = [
  { value: 'tag-blue', label: '蓝' },
  { value: 'tag-gray', label: '灰' },
  { value: 'tag-green', label: '绿' },
  { value: 'tag-orange', label: '橙' },
  { value: 'tag-red', label: '红' },
  { value: 'tag-purple', label: '紫' },
]

const list = computed(() => spaces.value)
const active = computed(() => list.value.find((w) => w.id === activeId.value) || null)
const activeQuota = computed(() => (active.value ? quotaOfWs(active.value.id) : null))
const canEditQuota = computed(
  () => Boolean(isSuperAdmin.value) || active.value?.role === 'Owner',
)
const canManageTags = computed(
  () => Boolean(isSuperAdmin.value) || active.value?.role === 'Owner',
)
const canDeleteActive = computed(() => {
  if (!active.value?.id || active.value.id === 'default') return false
  return Boolean(isSuperAdmin.value) || active.value?.role === 'Owner'
})

watch(
  list,
  (rows) => {
    if (!rows.length) {
      activeId.value = ''
      return
    }
    const q = typeof route.query.ws === 'string' ? route.query.ws.trim() : ''
    if (q && rows.some((r) => r.id === q)) {
      activeId.value = q
      return
    }
    if (!activeId.value || !rows.some((r) => r.id === activeId.value)) {
      activeId.value =
        rows.find((r) => r.current)?.id ||
        rows.find((r) => r.id === currentWs.value)?.id ||
        rows[0].id
    }
  },
  { immediate: true },
)

watch(
  () => route.query.ws,
  (ws) => {
    const q = typeof ws === 'string' ? ws.trim() : ''
    if (q && list.value.some((r) => r.id === q)) {
      activeId.value = q
    }
  },
)

watch(
  activeId,
  async (id) => {
    aiEditOpen.value = false
    tagDraft.value = ''
    tagCls.value = 'tag-blue'
    if (!id) {
      members.value = []
      return
    }
    try {
      members.value = await loadMembers(id)
    } catch (e) {
      members.value = []
      showToast(e?.message || '成员加载失败', 'error')
    }
  },
  { immediate: true },
)

onMounted(async () => {
  try {
    await ensureLoaded()
  } catch (e) {
    showToast(e?.message || '工作空间加载失败', 'error')
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
    showToast(`已设为当前团队上下文：${w.name}`, 'success')
  } catch (e) {
    if (e?.cancelled) return
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

function openAiEdit() {
  const q = activeQuota.value
  aiTokenDraft.value =
    q?.aiTokenQuota != null && Number(q.aiTokenQuota) > 0 ? String(q.aiTokenQuota) : ''
  aiCostDraft.value =
    q?.aiCostQuota != null && Number(q.aiCostQuota) > 0 ? String(q.aiCostQuota) : ''
  aiEditOpen.value = true
}

async function onRefreshQuota() {
  if (!active.value?.id) return
  await runLocked('quota-refresh', async () => {
    try {
      await refreshQuota(active.value.id)
      showToast('已刷新今日 AI 可用额度', 'success')
    } catch (e) {
      showToast(e?.message || '刷新配额失败', 'error')
    }
  })
}

async function onSaveAiQuota() {
  if (!active.value?.id) return
  const tokenRaw = String(aiTokenDraft.value ?? '').trim()
  const costRaw = String(aiCostDraft.value ?? '').trim()
  const tokenNum = tokenRaw === '' ? 0 : Number(tokenRaw)
  const costNum = costRaw === '' ? 0 : Number(costRaw)
  if (!Number.isFinite(tokenNum) || tokenNum < 0) {
    showToast('AI Token 上限须为非负整数（空/0=不限）', 'warning')
    return
  }
  if (!Number.isFinite(costNum) || costNum < 0) {
    showToast('AI 成本上限须为非负数（空/0=不限）', 'warning')
    return
  }
  await runLocked('quota-save', async () => {
    try {
      await updateQuota(active.value.id, {
        aiTokenQuota: Math.floor(tokenNum),
        aiCostQuota: costNum,
      })
      aiEditOpen.value = false
      showToast('AI 日配额已更新', 'success')
    } catch (e) {
      showToast(e?.message || '保存配额失败（需空间 Owner 或超管）', 'error')
    }
  })
}

function fmtAiRemaining(q, kind) {
  if (!q) return '—'
  if (kind === 'token') {
    if (!q.aiLimited || q.aiTokenQuota == null) return '不限'
    return q.aiTokenRemaining != null ? String(q.aiTokenRemaining) : '—'
  }
  if (!q.aiLimited || q.aiCostQuota == null) return '不限'
  return q.aiCostRemaining != null ? String(q.aiCostRemaining) : '—'
}

function openCreate() {
  createOpen.value = true
}

async function onCreate(payload) {
  await runLocked('create', async () => {
    try {
      const item = await createSpace(payload)
      createOpen.value = false
      if (item?.id) activeId.value = item.id
      showToast(`已创建归属空间：${payload.name}（未建 Catalog）`, 'success')
    } catch (e) {
      showToast(e?.message || '创建失败', 'error')
    }
  })
}

async function onDeleteActive() {
  const w = active.value
  if (!w?.id || !canDeleteActive.value) return
  const ok = window.confirm(
    `确认删除工作空间「${w.name}」（${w.id}）？\n删除后列表不再展示；成员/配额保留作历史；若为当前上下文将切回 default。`,
  )
  if (!ok) return
  await runLocked('delete', async () => {
    try {
      const deletedId = w.id
      await deleteSpace(deletedId)
      if (activeId.value === deletedId) activeId.value = ''
      showToast(`已删除空间 ${deletedId}（软删 · 已从列表隐藏）`, 'success')
    } catch (e) {
      showToast(e?.message || '删除失败', 'error')
    }
  })
}

function openInvite() {
  if (!active.value?.id) {
    showToast('请先选择工作空间', 'warning')
    return
  }
  inviteOpen.value = true
}

async function onInvite(payload) {
  if (!active.value?.id) return
  await runLocked('invite', async () => {
    try {
      await inviteMember(active.value.id, payload)
      inviteOpen.value = false
      members.value = await loadMembers(active.value.id)
      showToast('已添加成员（门户协作角色 · 未写 Grav grant）', 'success')
    } catch (e) {
      showToast(e?.message || '邀请失败', 'error')
    }
  })
}

async function onSyncGit() {
  if (!active.value?.id) return
  await runLocked('sync-git', async () => {
    try {
      const row = await syncGitRemote(active.value.id)
      const display = redactGitRemoteDisplay(row?.gitRemoteUrlDisplay || row?.gitRemoteUrl || '')
      if (row?.gitRemoteCustom) {
        showToast(display ? `已保留自定义远程：${display}` : '已保留自定义远程', 'success')
      } else {
        showToast(display ? `已同步 Gitea：${display}` : '已同步 Gitea', 'success')
      }
    } catch (e) {
      showToast(e?.message || '同步 Gitea 失败', 'error')
    }
  })
}

async function onAddTag() {
  if (!active.value?.id) {
    showToast('请先选择工作空间', 'warning')
    return
  }
  if (!canManageTags.value) {
    showToast('仅空间 Owner 或超管可管理标签', 'warning')
    return
  }
  const text = String(tagDraft.value || '').trim()
  if (!text) {
    showToast('请输入标签文案', 'warning')
    return
  }
  await runLocked('tag-add', async () => {
    try {
      await addTag(active.value.id, { text, cls: tagCls.value || 'tag-blue' })
      tagDraft.value = ''
      showToast(`已添加标签：${text}`, 'success')
    } catch (e) {
      showToast(e?.message || '添加标签失败', 'error')
    }
  })
}

async function onRemoveTag(text) {
  if (!active.value?.id || !text) return
  if (!canManageTags.value) {
    showToast('仅空间 Owner 或超管可管理标签', 'warning')
    return
  }
  tagRemoving.value = text
  try {
    await removeTag(active.value.id, text)
    showToast(`已移除标签：${text}`, 'success')
  } catch (e) {
    showToast(e?.message || '移除标签失败', 'error')
  } finally {
    tagRemoving.value = ''
  }
}

/** 双保险：去掉 userinfo，界面永不展示 token */
function redactGitRemoteDisplay(url) {
  if (!url) return ''
  return String(url).replace(/:\/\/[^/@]+(?::[^/@]*)?@/, '://')
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
    <CreateFormModal
      :open="inviteOpen"
      v-bind="WORKSPACE_MEMBER_FORM"
      @close="inviteOpen = false"
      @submit="onInvite"
    />

    <p class="tip ws-soft-banner">
      当前工作边界 <code>{{ currentWs || 'default' }}</code>
      · 列表默认跟随本空间；跨团队发现走企业共享；授权仍走申请中心
      · 软过滤偏好（目录/指标/ETL/查询/AI），
      <b>不是</b> Grav ACL 旁路；读数/出湖仍走申请中心。空列表合法，无演示回落。
    </p>

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
      <span v-if="lastError" class="tag tag-orange">加载异常</span>
    </div>

    <div class="ws-layout">
      <div class="card ws-side">
        <div class="card-header">
          <div class="card-title">📋 团队空间</div>
          <span class="tag tag-blue">{{ list.length }}</span>
        </div>
        <div class="card-body ws-list">
          <div v-if="!loading && !list.length" class="tip ws-empty">
            暂无工作空间 · 点「新建空间」创建归属与成本记账（不建 Catalog）
          </div>
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
            <div class="ws-detail-actions">
              <button
                v-if="!active.current"
                type="button"
                class="btn btn-sm btn-primary"
                @click="setAsCurrent(active)"
              >
                设为当前上下文
              </button>
              <button
                v-if="canDeleteActive"
                type="button"
                class="btn btn-sm btn-danger"
                :disabled="deleting"
                @click="onDeleteActive"
              >
                {{ deleting ? '删除中…' : '删除空间' }}
              </button>
            </div>
          </div>
          <div class="card-body ws-detail">
            <div class="ws-detail-grid">
              <div><span class="muted">成本中心：</span><code>{{ active.costCenter }}</code></div>
              <div><span class="muted">Trino 资源组：</span><code>{{ active.rg }}</code></div>
              <div><span class="muted">共享 Catalog：</span><code>{{ active.gravitino }}</code></div>
              <div><span class="muted">常用 schema：</span><code>{{ active.preferredSchemas }}</code></div>
              <div><span class="muted">Owner：</span>{{ active.owners }}</div>
              <div><span class="muted">创建时间：</span>{{ active.createdAt }}</div>
              <div class="ws-git-remote">
                <span class="muted">Git 远程：</span>
                <code v-if="active.gitRemoteUrlDisplay || active.gitRemoteUrl">{{
                  redactGitRemoteDisplay(active.gitRemoteUrlDisplay || active.gitRemoteUrl)
                }}</code>
                <span v-else class="muted">未绑定</span>
                <span v-if="active.gitRemoteCustom" class="tag tag-blue">自定义</span>
                <button type="button" class="btn btn-sm" :disabled="syncingGit" @click="onSyncGit">
                  {{ syncingGit ? '同步中…' : '同步 Gitea' }}
                </button>
                <p class="ws-git-hint muted">
                  空/内网/平台 Gitea → 同步为每空间独立仓；自定义公网 remote 同步时保留。凭证仅服务端 push 使用，界面不展示 token。
                </p>
              </div>
              <div class="ws-tags">
                <span class="muted">标签：</span>
                <span
                  v-for="(t, ti) in active.tags"
                  :key="`${t.text}-${ti}`"
                  class="tag ws-tag-chip"
                  :class="t.cls"
                >
                  {{ t.text }}
                  <button
                    v-if="canManageTags"
                    type="button"
                    class="ws-tag-x"
                    :disabled="tagRemoving === t.text"
                    :title="`移除 ${t.text}`"
                    @click="onRemoveTag(t.text)"
                  >
                    ×
                  </button>
                </span>
                <span v-if="!active.tags?.length" class="muted">暂无</span>
                <template v-if="canManageTags">
                  <input
                    v-model="tagDraft"
                    class="ws-tag-input"
                    type="text"
                    maxlength="32"
                    placeholder="新标签"
                    @keyup.enter="onAddTag"
                  />
                  <select v-model="tagCls" class="ws-tag-cls">
                    <option v-for="o in TAG_CLS_OPTIONS" :key="o.value" :value="o.value">
                      {{ o.label }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :disabled="tagAdding"
                    @click="onAddTag"
                  >
                    {{ tagAdding ? '添加中…' : '＋ 添加' }}
                  </button>
                </template>
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
            <button type="button" class="btn btn-sm" @click="openInvite">＋ 邀请成员</button>
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

      <div v-else class="card ws-main ws-main-empty">
        <div class="card-body tip" style="padding: 24px">
          {{ loading ? '加载中…' : '请选择左侧空间，或新建归属空间' }}
        </div>
      </div>

      <div class="card ws-quota-side">
        <div class="card-header">
          <div class="card-title">⚖️ 成本与配额 <span class="tip">· {{ active?.rg || '—' }}</span></div>
          <button
            v-if="active"
            type="button"
            class="btn btn-sm"
            :disabled="quotaRefreshing || !activeQuota"
            @click="onRefreshQuota"
          >
            {{ quotaRefreshing ? '刷新中…' : '刷新可用额度' }}
          </button>
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

            <div class="wqf-ai-block">
              <div class="wqf-ai-head">
                <b>AI 日配额</b>
                <button
                  v-if="canEditQuota"
                  type="button"
                  class="btn btn-sm"
                  @click="openAiEdit"
                >
                  自定义额度
                </button>
              </div>
              <div class="wqf-ai-grid">
                <div class="wqf-ai-cell">
                  <div class="wqf-ai-label">Token</div>
                  <div class="wqf-ai-nums">
                    <span>已用 {{ activeQuota.aiTokenUsed ?? 0 }}</span>
                    <span>上限 {{ activeQuota.aiTokenQuota != null ? activeQuota.aiTokenQuota : '不限' }}</span>
                    <span class="wqf-remain">剩余 {{ fmtAiRemaining(activeQuota, 'token') }}</span>
                  </div>
                  <div v-if="activeQuota.aiTokenQuota != null" class="quota-bar">
                    <div :style="{ width: `${activeQuota.aiTokenPct}%`, background: wsQuotaBarColor(activeQuota.aiTokenPct) }" />
                  </div>
                </div>
                <div class="wqf-ai-cell">
                  <div class="wqf-ai-label">成本</div>
                  <div class="wqf-ai-nums">
                    <span>已用 {{ activeQuota.aiCostUsed ?? 0 }}</span>
                    <span>上限 {{ activeQuota.aiCostQuota != null ? activeQuota.aiCostQuota : '不限' }}</span>
                    <span class="wqf-remain">剩余 {{ fmtAiRemaining(activeQuota, 'cost') }}</span>
                  </div>
                  <div v-if="activeQuota.aiCostQuota != null" class="quota-bar">
                    <div :style="{ width: `${activeQuota.aiCostPct}%`, background: wsQuotaBarColor(activeQuota.aiCostPct) }" />
                  </div>
                </div>
              </div>
              <p class="tip wqf-ai-tip">
                硬门禁按今日用量实时汇总；不够时请联系空间 Owner 调高，或走
                <button type="button" class="linkish" @click="goApply">申请中心</button>
                （暂无独立 AI 配额工单，Owner 可在此直改）。
              </p>
              <div v-if="aiEditOpen" class="wqf-ai-edit">
                <label>
                  Token 日上限
                  <input v-model="aiTokenDraft" type="number" min="0" step="1" placeholder="空或 0 = 不限" />
                </label>
                <label>
                  成本日上限
                  <input v-model="aiCostDraft" type="number" min="0" step="0.0001" placeholder="空或 0 = 不限" />
                </label>
                <div class="wqf-ai-edit-actions">
                  <button type="button" class="btn btn-sm" :disabled="quotaSaving" @click="aiEditOpen = false">
                    取消
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    :disabled="quotaSaving"
                    @click="onSaveAiQuota"
                  >
                    {{ quotaSaving ? '保存中…' : '保存' }}
                  </button>
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
          <div v-else-if="active" class="tip" style="margin-bottom: 12px">该空间暂无配额快照</div>

          <div class="wqf-all-title">全部团队配额</div>
          <div v-if="!quotas.length" class="tip">暂无配额数据</div>
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
.ws-soft-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-2);
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-2);
}
.ws-soft-banner code {
  font-size: 12px;
}
.ws-empty {
  padding: 16px 8px;
  text-align: center;
}
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
.ws-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.ws-detail-actions .btn-danger {
  color: var(--danger, #cf1322);
  border-color: var(--danger, #cf1322);
  background: transparent;
}
.ws-detail-actions .btn-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger, #cf1322) 12%, transparent);
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
  grid-column: 1 / -1;
}
.ws-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.ws-tag-x {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.7;
}
.ws-tag-x:hover:not(:disabled) {
  opacity: 1;
}
.ws-tag-x:disabled {
  cursor: wait;
  opacity: 0.4;
}
.ws-tag-input {
  width: 120px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-1);
  color: var(--text-1);
  font-size: 12px;
}
.ws-tag-cls {
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-1);
  color: var(--text-1);
  font-size: 12px;
}
.ws-detail-desc {
  color: var(--text-3);
  margin: 6px 0 12px;
}
.ws-git-remote {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ws-git-remote code {
  word-break: break-all;
  font-size: 12px;
}
.ws-git-hint {
  flex: 1 1 100%;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
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
.wqf-ai-block {
  margin: 8px 0;
  padding: 8px 0 4px;
  border-top: 1px dashed var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wqf-ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}
.wqf-ai-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wqf-ai-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wqf-ai-label {
  font-size: 11px;
  color: var(--text-2);
  font-weight: 600;
}
.wqf-ai-nums {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 11px;
  color: var(--text-1);
}
.wqf-remain {
  color: var(--primary);
  font-weight: 600;
}
.wqf-ai-tip {
  margin: 0;
  line-height: 1.45;
}
.wqf-ai-tip .linkish {
  border: none;
  background: none;
  padding: 0;
  color: var(--primary);
  cursor: pointer;
  text-decoration: underline;
  font-size: inherit;
}
.wqf-ai-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
}
.wqf-ai-edit label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-2);
}
.wqf-ai-edit input {
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 8px;
  background: var(--bg-1);
  color: var(--text-1);
}
.wqf-ai-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
