<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import AiMarkdownBody from '@/components/ai/AiMarkdownBody.vue'
import AiIcon from '@/components/ai/AiIcon.vue'
import { useToast } from '@/composables/useToast'
import { useAiAssistant } from '@/composables/useAiAssistant'
import {
  handleAiSqlAction,
  openQueryWithSql as openQueryWithSqlShared,
} from '@/composables/useAiSqlActions'
import { useSession } from '@/composables/useSession'
import { pageGuideOf } from '@/data/pageGuides'
import {
  AI_CHIP_SCENES,
  AI_QUICK_CHIPS,
  AI_QUICK_PROMPTS,
  chatModelOptionLabel,
  filterChatPickerModels,
} from '@/data/ai'
import { fetchAiModels } from '@/api/ai'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('aiassistant')
const assistant = useAiAssistant()
const { currentWs } = useSession()

const modelOptions = ref([])
/** 空 = 走后端 gov_ai_route，不强制 override */
const selectedModelId = ref('')
/** 用户粘贴/上传图片时置 true，选择器收窄到视觉能力模型 */
const hasImageInput = ref(false)
const inputText = ref('')
/** 快捷芯片选中的 scene，用户确认发送时带上；清空对话/发送后复位 */
const pendingScene = ref(undefined)
const inputEl = ref(null)
const messages = assistant.messages
const chatBody = ref(null)
const sending = assistant.sending
const liveReady = ref(false)
const contextItems = ref([])
const myAssets = ref([])
const recentSessionsUi = ref([])
const knowledgeRefs = ref([])
const headSub = ref('连接助手中…')
const routeModelLabel = ref('')

const sessionGroups = computed(() => {
  const today = []
  const earlier = []
  const now = new Date()
  for (const row of recentSessionsUi.value) {
    const d = row.updateTime ? new Date(row.updateTime) : null
    const isToday = d && !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString()
    if (isToday) today.push(row)
    else earlier.push(row)
  }
  const groups = []
  if (today.length) groups.push({ key: 'today', label: '今天', items: today })
  if (earlier.length) {
    groups.push({ key: 'earlier', label: today.length ? '更早' : '最近', items: earlier })
  }
  return groups
})

const modelOverrideId = computed(() => selectedModelId.value || undefined)
const activeModelLabel = computed(() => {
  if (selectedModelId.value) {
    const hit = modelOptions.value.find((m) => m.id === selectedModelId.value)
    return hit?.label || selectedModelId.value
  }
  return routeModelLabel.value || assistant.lastMeta.value?.modelName || '路由默认'
})

/** 流式进行中：最后一条助手消息已有正文或工具引用时，不再额外挂「思考中」空泡 */
const streamStatusLabel = computed(() => {
  if (!sending.value) return ''
  const last = messages.value[messages.value.length - 1]
  if (!last || last.role !== 'assistant') return '思考中…'
  const tools = (last.citations || []).filter((c) => c.type === 'tool' || c.tool)
  if (last.text) return ''
  if (tools.length) {
    const name = tools[tools.length - 1].title || tools[tools.length - 1].tool || '工具'
    return `已调用 ${tools.length} 个工具 · 最近 ${name}`
  }
  if (assistant.lastMeta.value?.mode === 'agent' || assistant.lastMeta.value?.status === 'exploring') {
    return '探索中…'
  }
  return '思考中…'
})

const showThinkingBubble = computed(() => sending.value && !!streamStatusLabel.value)

const visibleModelOptions = computed(() => {
  if (!hasImageInput.value) return modelOptions.value
  const vision = modelOptions.value.filter((m) => m.supportsVision)
  return vision.length ? vision : modelOptions.value
})

function applyContext(s, ws) {
  const space = s?.ws || ws || currentWs.value || 'default'
  const modelName = s?.routeModelName || s?.routeModelId || ''
  routeModelLabel.value = modelName || routeModelLabel.value
  headSub.value = `只读探索智能体 · 空间 ${space} · 模型 ${activeModelLabel.value} · 登记表 ${s?.assetCount ?? '—'} · 可查 ${s?.myAssetCount ?? '—'} · 指标 ${s?.metricCount ?? '—'}`
  const preferHint = s?.softPrefer ? '（软偏好）' : ''
  contextItems.value = [
    { icon: '🗂️', label: `空间：${space}${preferHint}` },
    { icon: '🧠', label: `模型：${activeModelLabel.value}` },
    { icon: '🤖', label: '默认：只读智能体（生成 SQL 请点芯片）' },
    { icon: '📋', label: `目录表：${s?.assetCount ?? '—'}`, to: '/catalog' },
    { icon: '✅', label: `我可查：${s?.myAssetCount ?? '—'}`, to: '/catalog' },
    { icon: '🎯', label: `指标：${s?.metricCount ?? '—'}`, to: '/metrics' },
    { icon: '📖', label: `知识库：${s?.kbCount ?? '—'} 篇`, to: '/knowledge' },
  ]
  myAssets.value = Array.isArray(s?.preferredAssets) ? s.preferredAssets : []
  syncSessionListUi()
}

function syncSessionListUi() {
  recentSessionsUi.value = (assistant.recentSessions.value || []).map((x) => ({
    id: x.id,
    title: x.title || '未命名对话',
    ws: x.ws,
    updateTime: x.updateTime,
    timeLabel: formatSessionTime(x.updateTime),
  }))
}

function formatSessionTime(t) {
  if (!t) return ''
  const d = t instanceof Date ? t : new Date(t)
  if (Number.isNaN(d.getTime())) return String(t).slice(0, 16)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const pad = (n) => String(n).padStart(2, '0')
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const activeSessionTitle = computed(() => {
  if (!assistant.sessionId.value) return '未选择对话'
  const hit = recentSessionsUi.value.find((s) => s.id === assistant.sessionId.value)
  return hit?.title || '新对话'
})

async function loadModelOptions() {
  try {
    const page = await fetchAiModels({ kind: 'chat' }, { current: 1, size: 100 })
    const rows = page?.records || []
    modelOptions.value = filterChatPickerModels(rows).map((m) => ({
      id: m.id,
      label: chatModelOptionLabel(m),
      supportsVision: m.supportsVision === true || m.supportsVision === 1,
      kind: m.kind || 'chat',
    }))
    // 若当前选中已非对话模型（如改成 image），清空 override
    if (selectedModelId.value && !modelOptions.value.some((m) => m.id === selectedModelId.value)) {
      selectedModelId.value = ''
    }
  } catch {
    modelOptions.value = []
  }
}

onMounted(async () => {
  messages.value = []
  await loadModelOptions()
  try {
    await assistant.init(currentWs.value || 'default')
    liveReady.value = true
    applyContext(assistant.contextSummary.value, currentWs.value)
  } catch (e) {
    liveReady.value = false
    headSub.value = e?.message || '助手初始化失败'
    showToast(headSub.value, 'warning')
  }
})

watch(
  () => currentWs.value,
  async (ws) => {
    if (!ws || !liveReady.value) return
    try {
      await assistant.init(ws, { resetSession: true })
      applyContext(assistant.contextSummary.value, ws)
      showToast(`已切换协作空间偏好：${ws}`, 'info')
    } catch {
      /* ignore */
    }
  },
)

watch(
  () => messages.value.length,
  () => scrollChatBottom(),
)

watch(
  () => {
    const last = messages.value[messages.value.length - 1]
    if (!last || last.role !== 'assistant') return ''
    return `${last.text?.length || 0}:${last.citations?.length || 0}`
  },
  () => {
    if (sending.value) scrollChatBottom()
  },
)

watch(selectedModelId, () => {
  applyContext(assistant.contextSummary.value, currentWs.value)
})

watch(hasImageInput, (on) => {
  if (!on) return
  const vision = modelOptions.value.filter((m) => m.supportsVision)
  if (!vision.length) {
    showToast('当前无支持视觉输入的对话模型，请在模型管理中开启「支持上传图片」', 'warning')
    return
  }
  if (selectedModelId.value && vision.some((m) => m.id === selectedModelId.value)) return
  selectedModelId.value = vision[0].id
  showToast(`已切换到视觉模型：${vision[0].label}`, 'info')
})

function onChatPaste(e) {
  const items = e?.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      hasImageInput.value = true
      showToast('已检测到粘贴图片 · 请选用支持视觉输入的对话模型', 'info')
      return
    }
  }
}

function clearImageInputFlag() {
  hasImageInput.value = false
}

function goModelManage() {
  router.push('/aimodel')
}

async function onNewChat() {
  if (sending.value) {
    showToast('请等待当前回复完成', 'warning')
    return
  }
  try {
    await assistant.newChat(currentWs.value || 'default')
    pendingScene.value = undefined
    inputText.value = ''
    clearImageInputFlag()
    knowledgeRefs.value = []
    syncSessionListUi()
    applyContext(assistant.contextSummary.value, currentWs.value)
    showToast('已新建对话', 'success')
    nextTick(() => inputEl.value?.focus())
  } catch (e) {
    showToast(e?.message || '新建对话失败', 'warning')
  }
}

function scrollChatBottom() {
  nextTick(() => {
    const el = chatBody.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function syncKnowledgeRefs(citations) {
  knowledgeRefs.value = (citations || [])
    .filter((c) => c.type === 'knowledge' || c.entryId)
    .map((c) => ({
      label: `📖 ${c.title || c.entryId || '引用'}`,
      to: c.href || (c.entryId ? `/knowledge?entry=${c.entryId}` : '/knowledge'),
    }))
}

async function sendMessage(scene) {
  const text = inputText.value.trim()
  if (!text || sending.value) return
  if (!assistant.sessionId.value) {
    showToast('请先点左侧「新对话」再提问', 'warning')
    return
  }
  const resolvedScene = scene || pendingScene.value
  inputText.value = ''
  pendingScene.value = undefined
  scrollChatBottom()
  if (!liveReady.value) {
    showToast(assistant.lastError?.value?.message || '助手未就绪，请稍后重试', 'warning')
    return
  }
  showToast('推理中…', 'info')
  const res = await assistant.send({
    text,
    scene: resolvedScene,
    modelOverride: modelOverrideId.value,
    ws: currentWs.value || 'default',
  })
  if (res?.meta?.modelName || res?.meta?.modelId) {
    routeModelLabel.value = res.meta.modelName || res.meta.modelId
    applyContext(assistant.contextSummary.value, currentWs.value)
  }
  const last = messages.value[messages.value.length - 1]
  if (last?.citations?.length) syncKnowledgeRefs(last.citations)
  syncSessionListUi()
  scrollChatBottom()
}

/** 芯片：填入可编辑草稿 + scene 提示，不自动发送；用户改完再点发送 */
function applyQuickChip(chipId) {
  const prompt = AI_QUICK_PROMPTS[chipId]
  if (prompt == null) return
  inputText.value = prompt
  pendingScene.value = AI_CHIP_SCENES[chipId]
  nextTick(() => {
    const el = inputEl.value
    if (!el) return
    el.focus()
    const len = el.value?.length ?? 0
    try {
      el.setSelectionRange(len, len)
    } catch {
      /* ignore */
    }
  })
}

function navContext(to) {
  if (!to) return
  if (typeof to === 'string') router.push(to)
  else router.push(to)
}

async function onSelectSession(row) {
  if (!row?.id || row.id === assistant.sessionId.value) return
  if (sending.value) {
    showToast('请等待当前回复完成', 'warning')
    return
  }
  try {
    await assistant.loadSession(row.id, currentWs.value || 'default')
    pendingScene.value = undefined
    inputText.value = ''
    clearImageInputFlag()
    const last = [...messages.value].reverse().find((m) => m.citations?.length)
    if (last) syncKnowledgeRefs(last.citations)
    else knowledgeRefs.value = []
    syncSessionListUi()
    scrollChatBottom()
  } catch (e) {
    showToast(e?.message || '加载会话失败', 'warning')
  }
}

async function onDeleteSession(row, ev) {
  ev?.stopPropagation?.()
  ev?.preventDefault?.()
  if (!row?.id) return
  if (sending.value) {
    showToast('请等待当前回复完成', 'warning')
    return
  }
  const title = row.title || '未命名对话'
  if (!window.confirm(`确认删除对话「${title}」？删除后列表不再展示。`)) return
  try {
    await assistant.deleteSession(row.id, currentWs.value || 'default')
    pendingScene.value = undefined
    inputText.value = ''
    clearImageInputFlag()
    knowledgeRefs.value = []
    syncSessionListUi()
    applyContext(assistant.contextSummary.value, currentWs.value)
    scrollChatBottom()
    showToast('已删除对话', 'success')
  } catch (e) {
    showToast(e?.message || '删除失败', 'warning')
  }
}

function openQueryWithSql(sql) {
  openQueryWithSqlShared(router, sql)
}

async function onAction(act) {
  await handleAiSqlAction(act, {
    router,
    messages,
    showToast,
    confirmRunSql: (p) => assistant.confirmRunSql(p),
    sessionId: assistant.sessionId.value,
    ws: currentWs.value || 'default',
  })
}

function onBubbleClick(e, msg) {
  const t = e.target
  if (t?.classList?.contains('ai-inline-btn') || t?.dataset?.openSql) {
    const sql = msg?.actions?.find((a) => a.sql)?.sql
    if (sql) openQueryWithSql(sql)
  }
}
</script>

<template>
  <div class="ai-page">
    <PageHeader
      page-id="aiassistant"
      title="AI 助手 · DataLake Copilot"
      subtitle="对话式答疑 · 生成 SQL/脚本 · 使用手册问答 · 故障诊断 · 上下文感知"
      :guide="guide"
    >
      <select v-model="selectedModelId" class="select input-sm ai-model-select" title="留空则按场景路由；带图时优先视觉模型">
        <option value="">路由默认（{{ routeModelLabel || 'gov_ai_route' }}）</option>
        <option v-for="m in visibleModelOptions" :key="m.id" :value="m.id">{{ m.label }}</option>
      </select>
      <span v-if="hasImageInput" class="tag tag-purple" title="检测到图片输入，已筛选视觉能力模型">视觉</span>
      <span class="tag tag-blue ai-ws-tag">ws: {{ currentWs || 'default' }}</span>
      <button type="button" class="btn btn-sm" @click="goModelManage">管理模型</button>
    </PageHeader>

    <div class="ai-chat-wrap">
      <aside class="ai-session-rail" aria-label="对话列表">
        <div class="ai-session-head">
          <div class="ai-session-head-text">
            <span class="ai-session-head-title">对话</span>
            <span v-if="recentSessionsUi.length" class="ai-session-head-count">{{ recentSessionsUi.length }}</span>
          </div>
          <button type="button" class="ai-session-compose" @click="onNewChat" title="新对话">
            <AiIcon name="plus" :size="14" />
            新对话
          </button>
        </div>
        <div class="ai-session-list">
          <div v-if="!recentSessionsUi.length" class="ai-session-empty">
            <div class="ai-session-empty-title">还没有对话</div>
            <div class="ai-session-empty-sub">点上方「新对话」开始提问</div>
          </div>
          <template v-for="g in sessionGroups" :key="g.key">
            <div class="ai-session-group">{{ g.label }}</div>
            <div
              v-for="row in g.items"
              :key="row.id"
              class="ai-session-item"
              :class="{ active: row.id === assistant.sessionId.value }"
              role="button"
              tabindex="0"
              :title="row.title"
              @click="onSelectSession(row)"
              @keydown.enter.prevent="onSelectSession(row)"
            >
              <span class="ai-session-ico" aria-hidden="true">
                <AiIcon name="chat" :size="14" />
              </span>
              <span class="ai-session-body">
                <span class="ai-session-title">{{ row.title }}</span>
                <span class="ai-session-time">{{ row.timeLabel || '—' }}</span>
              </span>
              <button
                type="button"
                class="ai-session-del"
                title="删除对话"
                aria-label="删除对话"
                @click="onDeleteSession(row, $event)"
              >
                <AiIcon name="trash" :size="14" />
              </button>
            </div>
          </template>
        </div>
      </aside>

      <div class="ai-chat">
        <div class="ai-chat-header">
          <div class="ai-avatar" aria-hidden="true">
            <AiIcon name="spark" :size="18" />
          </div>
          <div>
            <div class="ai-head-title">{{ activeSessionTitle }}</div>
            <div class="ai-head-sub">{{ headSub }}</div>
          </div>
          <div class="ai-online">● 在线</div>
        </div>

        <div ref="chatBody" class="ai-chat-body">
          <div v-if="!messages.length && !sending" class="ai-empty">
            <div class="ai-empty-title">{{ assistant.sessionId.value ? '开始提问' : '选择或新建对话' }}</div>
            <div class="ai-empty-sub">
              {{
                assistant.sessionId.value
                  ? '可查目录、可查资产、知识库、质量与血缘；生成 SQL 请点下方芯片。'
                  : '左侧点「新对话」后再提问；删除后不会自动再建空白对话。'
              }}
            </div>
          </div>
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="ai-msg"
            :class="msg.role"
          >
            <div class="ai-msg-bubble" @click="onBubbleClick($event, msg)">
              <details
                v-if="msg.role === 'assistant' && msg.citations?.some((x) => x.type === 'tool')"
                class="ai-tool-steps"
              >
                <summary class="ai-tool-steps-label">
                  工具调用 · {{ msg.citations.filter((x) => x.type === 'tool').length }} 步
                </summary>
                <div
                  v-for="(c, ti) in msg.citations.filter((x) => x.type === 'tool').slice(0, 8)"
                  :key="'t' + ti"
                  class="ai-tool-step"
                >
                  <span class="ai-tool-name">{{ c.tool || c.title || 'tool' }}</span>
                  <span class="ai-tool-text">{{ String(c.text || '').slice(0, 120) }}</span>
                </div>
              </details>
              <AiMarkdownBody :role="msg.role" :text="msg.text" :html="msg.html" />
              <div
                v-if="msg.role === 'assistant' && msg.citations?.length"
                class="ai-cite-footer"
              >
                <span class="ai-cite-label">引用</span>
                <button
                  v-for="(c, ci) in msg.citations.filter((x) => x.type === 'knowledge' || x.entryId).slice(0, 6)"
                  :key="ci"
                  type="button"
                  class="ai-cite-chip"
                  @click.stop="navContext(c.href || (c.entryId ? `/knowledge?entry=${c.entryId}` : '/knowledge'))"
                >
                  {{ c.title || c.entryId || '条目' }}
                </button>
              </div>
              <div v-if="msg.actions?.length" class="ai-msg-actions">
                <button
                  v-for="(act, ai) in msg.actions"
                  :key="ai"
                  type="button"
                  class="btn btn-sm"
                  :class="act.type === 'run_sql' ? 'btn-primary' : ''"
                  @click.stop="onAction(act)"
                >
                  {{ act.label || act.type }}
                </button>
              </div>
            </div>
          </div>
          <div v-if="showThinkingBubble" class="ai-msg assistant">
            <div class="ai-msg-bubble ai-thinking">{{ streamStatusLabel }}</div>
          </div>
        </div>

        <div class="ai-chat-quick">
          <span
            v-for="c in AI_QUICK_CHIPS"
            :key="c.id"
            class="ai-quick-btn"
            :title="'填入草稿到输入框，编辑后发送'"
            @click="applyQuickChip(c.id)"
          >{{ c.label }}</span>
        </div>

        <div class="ai-chat-input">
          <textarea
            ref="inputEl"
            v-model="inputText"
            placeholder="直接提问（默认只读智能体）；生成 SQL / 脚本请点上方芯片 · 可粘贴图片"
            @paste="onChatPaste"
            @keydown.enter.exact.prevent="sendMessage()"
          />
          <button
            v-if="sending"
            type="button"
            class="btn"
            title="停止生成"
            @click="assistant.stop()"
          >停止</button>
          <button type="button" class="btn btn-primary" :disabled="sending" @click="sendMessage()">发送 ▶</button>
        </div>
      </div>

      <div class="ai-side">
        <div class="ai-side-card">
          <div class="asc-title">🧠 上下文</div>
          <div class="asc-body">
            <div
              v-for="(item, i) in contextItems"
              :key="i"
              class="asc-item"
              :class="{ clickable: item.to }"
              @click="navContext(item.to)"
            >
              {{ item.icon }} {{ item.label }}
            </div>
          </div>
        </div>
        <div class="ai-side-card">
          <div class="asc-title">📋 我的可查资源</div>
          <div class="asc-body">
            <div v-if="!myAssets.length" class="asc-item tip">暂无 owned/granted 表</div>
            <div
              v-for="a in myAssets"
              :key="a.id"
              class="asc-item clickable"
              @click="navContext({ path: '/catalog', query: { asset: a.id } })"
            >
              {{ a.access === 'owned' ? '👑' : '🔑' }} {{ a.assetCode || a.name }}
            </div>
          </div>
        </div>
        <div class="ai-side-card">
          <div class="asc-title">📖 知识库引用</div>
          <div class="asc-body">
            <div v-if="!knowledgeRefs.length" class="asc-item tip">本轮暂无引用</div>
            <div
              v-for="(ref, i) in knowledgeRefs"
              :key="i"
              class="asc-item clickable"
              @click="navContext(ref.to)"
            >
              {{ ref.label }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-model-select {
  max-width: 240px;
}
.ai-ws-tag {
  font-size: 11px;
}

.ai-chat-wrap {
  display: grid;
  grid-template-columns: 248px 1fr 260px;
  gap: 14px;
  height: calc(100vh - 168px);
  min-height: 520px;
}
@media (max-width: 1100px) {
  .ai-chat-wrap {
    grid-template-columns: 220px 1fr;
  }
  .ai-side {
    display: none;
  }
}
@media (max-width: 720px) {
  .ai-chat-wrap {
    grid-template-columns: 1fr;
    height: auto;
  }
  .ai-session-rail {
    max-height: 240px;
  }
}

.ai-session-rail {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-1);
  min-height: 0;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.ai-session-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--bg-1) 0%, var(--bg-2) 100%);
}
.ai-session-head-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.ai-session-head-title {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-1);
  letter-spacing: 0.02em;
}
.ai-session-head-count {
  font-size: 11px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.ai-session-compose {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px dashed var(--border-dark);
  border-radius: var(--radius-md);
  background: var(--bg-1);
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.ai-session-compose:hover {
  background: var(--primary-light);
  border-color: var(--primary);
  border-style: solid;
}
.ai-session-compose:active {
  box-shadow: inset 0 1px 2px rgba(30, 111, 255, 0.12);
}
.ai-session-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  padding: 8px;
}
.ai-session-group {
  margin: 8px 6px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.04em;
  text-transform: none;
}
.ai-session-group:first-child {
  margin-top: 2px;
}
.ai-session-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 28px 12px;
  text-align: center;
}
.ai-session-empty-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.ai-session-empty-sub {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.4;
}
.ai-session-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 9px 8px 9px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-1);
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
  position: relative;
}
.ai-session-item:hover {
  background: var(--bg-2);
}
.ai-session-item.active {
  background: var(--primary-light);
  border-color: #b7d0ff;
}
.ai-session-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--primary);
}
.ai-session-ico {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  margin-top: 0;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ai-session-item.active .ai-session-ico {
  border-color: #b7d0ff;
  background: #fff;
  color: var(--primary);
}
.ai-session-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ai-session-title {
  font-size: 13px;
  font-weight: 560;
  line-height: 1.35;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-session-item.active .ai-session-title {
  color: var(--primary-dark);
  font-weight: 650;
}
.ai-session-time {
  font-size: 11px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.ai-session-item.active .ai-session-time {
  color: var(--text-2);
}
.ai-session-del {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  margin-top: 0;
  padding: 0;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  opacity: 0.55;
  pointer-events: auto;
  transition: opacity 0.12s ease, background 0.12s ease, color 0.12s ease;
}
.ai-session-item:hover .ai-session-del,
.ai-session-item.active .ai-session-del,
.ai-session-del:focus-visible {
  opacity: 1;
}
.ai-session-del:hover {
  background: var(--danger-light);
  color: var(--danger);
  opacity: 1;
}
.ai-empty {
  margin: auto;
  text-align: center;
  padding: 32px 16px;
  color: var(--text-3);
}
.ai-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 6px;
}
.ai-empty-sub {
  font-size: 12px;
  line-height: 1.5;
  max-width: 320px;
  margin: 0 auto;
}

.ai-chat {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-1);
  overflow: hidden;
  min-height: 480px;
  min-width: 0;
}
.ai-chat-header {
  padding: 12px 16px;
  background: linear-gradient(90deg, #1e6fff 0%, #5cdbd3 100%);
  color: #fff;
  display: flex;
  align-items: center;
  gap: 10px;
}
.ai-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.ai-head-title {
  font-size: 14px;
  font-weight: 600;
}
.ai-head-sub {
  font-size: 11px;
  opacity: 0.85;
}
.ai-online {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.85;
  background: rgba(255, 255, 255, 0.15);
  padding: 2px 8px;
  border-radius: 10px;
}
.ai-chat-body {
  flex: 1;
  padding: 18px;
  overflow-y: auto;
  background: var(--bg-2);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ai-msg {
  display: flex;
  gap: 10px;
  max-width: 88%;
}
.ai-msg.user {
  margin-left: auto;
  flex-direction: row-reverse;
}
.ai-msg-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.6;
  background: var(--bg-1);
  border: 1px solid var(--border);
  color: var(--text-1);
}
.ai-msg.user .ai-msg-bubble {
  background: var(--primary);
  color: #fff;
  border: none;
}
.ai-msg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.ai-cite-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #d6e4ff;
}
.ai-cite-label {
  font-size: 11px;
  color: var(--text-3);
}
.ai-cite-chip {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid #adc6ff;
  border-radius: 10px;
  background: #f0f5ff;
  color: #1d39c4;
  cursor: pointer;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-cite-chip:hover {
  border-color: var(--primary);
  background: #e6f4ff;
}
.ai-tool-steps {
  margin-bottom: 10px;
  padding: 6px 10px 8px;
  border-radius: 8px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  font-size: 12px;
  line-height: 1.4;
}
.ai-tool-steps-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-3);
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.ai-tool-steps-label::-webkit-details-marker {
  display: none;
}
.ai-tool-steps-label::before {
  content: '▸';
  display: inline-block;
  margin-right: 6px;
  transition: transform 0.15s ease;
}
.ai-tool-steps[open] > .ai-tool-steps-label::before {
  transform: rotate(90deg);
}
.ai-tool-steps[open] > .ai-tool-steps-label {
  margin-bottom: 6px;
}
.ai-tool-step {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 3px 0;
  border-top: 1px dashed #e2e8f0;
}
.ai-tool-step:first-of-type {
  border-top: none;
}
.ai-tool-name {
  flex: 0 0 auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  color: #1d39c4;
  background: #f0f5ff;
  border: 1px solid #adc6ff;
  border-radius: 4px;
  padding: 0 6px;
}
.ai-tool-text {
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-msg.assistant .ai-msg-bubble {
  background: #fff;
  border-color: #d6e4ff;
  box-shadow: 0 1px 2px rgba(22, 119, 255, 0.06);
}
.ai-thinking {
  color: var(--text-3);
  font-style: italic;
}
.ai-msg-bubble :deep(.ai-inline-btn) {
  margin-top: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-2);
  cursor: pointer;
}
.ai-thinking {
  opacity: 0.7;
  font-style: italic;
}
.ai-msg-bubble :deep(pre) {
  background: #1e2937;
  color: #e2e8f0;
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
  margin: 8px 0 0;
  overflow-x: auto;
  font-family: Consolas, Monaco, monospace;
}
.ai-msg-bubble :deep(.code-head) {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
}
.ai-chat-quick {
  padding: 10px 14px;
  background: var(--bg-1);
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ai-quick-btn {
  font-size: 11px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-2);
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.15s;
}
.ai-quick-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}
.ai-chat-input {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 10px;
  align-items: center;
  background: var(--bg-1);
}
.ai-chat-input textarea {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  resize: none;
  outline: none;
  height: 40px;
  font-family: inherit;
}
.ai-chat-input textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.ai-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
}
.ai-side-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-1);
}
.asc-title {
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}
.asc-body {
  padding: 8px 14px;
}
.asc-item {
  padding: 6px 0;
  font-size: 12px;
  color: var(--text-2);
}
.asc-item.tip {
  color: var(--text-3);
  cursor: default;
}
.asc-item.clickable {
  cursor: pointer;
}
.asc-item.clickable:hover {
  color: var(--primary);
}
</style>
