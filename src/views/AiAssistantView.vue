<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
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

const modelOverrideId = computed(() => selectedModelId.value || undefined)
const activeModelLabel = computed(() => {
  if (selectedModelId.value) {
    const hit = modelOptions.value.find((m) => m.id === selectedModelId.value)
    return hit?.label || selectedModelId.value
  }
  return routeModelLabel.value || assistant.lastMeta.value?.modelName || '路由默认'
})

const visibleModelOptions = computed(() => {
  if (!hasImageInput.value) return modelOptions.value
  const vision = modelOptions.value.filter((m) => m.supportsVision)
  return vision.length ? vision : modelOptions.value
})

function applyContext(s, ws) {
  const space = s?.ws || ws || currentWs.value || 'default'
  const modelName = s?.routeModelName || s?.routeModelId || ''
  routeModelLabel.value = modelName || routeModelLabel.value
  headSub.value = `空间 ${space} · 模型 ${activeModelLabel.value} · 表 ${s?.assetCount ?? '—'} · 指标 ${s?.metricCount ?? '—'} · 知识 ${s?.kbCount ?? '—'}`
  const preferHint = s?.softPrefer ? '（软偏好）' : ''
  contextItems.value = [
    { icon: '🗂️', label: `空间：${space}${preferHint}` },
    { icon: '🧠', label: `模型：${activeModelLabel.value}` },
    { icon: '📋', label: `目录表：${s?.assetCount ?? '—'}`, to: '/catalog' },
    { icon: '🎯', label: `指标：${s?.metricCount ?? '—'}`, to: '/metrics' },
    { icon: '📖', label: `知识库：${s?.kbCount ?? '—'} 篇`, to: '/knowledge' },
  ]
  myAssets.value = Array.isArray(s?.preferredAssets) ? s.preferredAssets : []
  recentSessionsUi.value = (assistant.recentSessions.value || []).map((x) => ({
    id: x.id,
    label: `💬 ${x.title || x.id}`,
  }))
}

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

function clearChat() {
  if (!confirm('确认清空当前对话？')) return
  assistant.clearLocal()
  pendingScene.value = undefined
  inputText.value = ''
  clearImageInputFlag()
  showToast('已清空当前对话', 'success')
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
  const resolvedScene = scene || pendingScene.value
  inputText.value = ''
  pendingScene.value = undefined
  scrollChatBottom()
  if (!liveReady.value) {
    showToast(assistant.lastError?.value?.message || '助手未就绪，请稍后重试', 'warning')
    return
  }
  showToast('🤖 推理中…', 'info')
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

async function onRecent(row) {
  if (!row?.id) return
  try {
    await assistant.loadSession(row.id, currentWs.value || 'default')
    const last = [...messages.value].reverse().find((m) => m.citations?.length)
    if (last) syncKnowledgeRefs(last.citations)
    showToast(`已加载会话：${row.label}`, 'success')
  } catch (e) {
    showToast(e?.message || '加载会话失败', 'warning')
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
      <button type="button" class="btn btn-sm" @click="clearChat">🧹 清空对话</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goModelManage">🧠 管理模型</button>
    </PageHeader>

    <div class="ai-chat-wrap">
      <div class="ai-chat">
        <div class="ai-chat-header">
          <div class="ai-avatar">🤖</div>
          <div>
            <div class="ai-head-title">DataLake Copilot</div>
            <div class="ai-head-sub">{{ headSub }}</div>
          </div>
          <div class="ai-online">● 在线</div>
        </div>

        <div ref="chatBody" class="ai-chat-body">
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="ai-msg"
            :class="msg.role"
          >
            <div class="ai-msg-bubble" @click="onBubbleClick($event, msg)">
              <div v-if="msg.html" v-html="msg.html" />
              <template v-else>{{ msg.text }}</template>
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
          <div v-if="sending" class="ai-msg assistant">
            <div class="ai-msg-bubble ai-thinking">思考中…</div>
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
            placeholder="问任何问题… 或点上方芯片填入草稿再发送 · 可粘贴图片以启用视觉模型筛选"
            @paste="onChatPaste"
            @keydown.enter.exact.prevent="sendMessage()"
          />
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
          <div class="asc-title">📜 最近对话</div>
          <div class="asc-body">
            <div v-if="!recentSessionsUi.length" class="asc-item tip">暂无会话</div>
            <div
              v-for="row in recentSessionsUi"
              :key="row.id"
              class="asc-item clickable"
              @click="onRecent(row)"
            >
              {{ row.label }}
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
.asc-item.tip {
  color: var(--text-3);
  cursor: default;
}

.ai-chat-wrap {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 16px;
  height: 560px;
}
@media (max-width: 960px) {
  .ai-chat-wrap {
    grid-template-columns: 1fr;
    height: auto;
  }
  .ai-side {
    max-height: 280px;
  }
}

.ai-chat {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-1);
  overflow: hidden;
  min-height: 480px;
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
  font-size: 18px;
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
.ai-msg.assistant .ai-msg-bubble {
  background: #fff;
  border-color: #d6e4ff;
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
  gap: 14px;
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
.asc-item.clickable {
  cursor: pointer;
}
.asc-item.clickable:hover {
  color: var(--primary);
}
</style>
