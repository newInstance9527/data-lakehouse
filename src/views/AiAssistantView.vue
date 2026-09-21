<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useAiAssistant } from '@/composables/useAiAssistant'
import { useSession } from '@/composables/useSession'
import { pageGuideOf } from '@/data/pageGuides'
import {
  AI_CONTEXT_ITEMS,
  AI_INITIAL_MESSAGES,
  AI_KNOWLEDGE_REFS,
  AI_MODEL_SELECT,
  AI_QUICK_CHIPS,
  AI_QUICK_PROMPTS,
  AI_RECENT_CHATS,
} from '@/data/ai'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('aiassistant')
const assistant = useAiAssistant()
const { currentWs } = useSession()

const selectedModel = ref('gpt4o')
const inputText = ref('')
const messages = assistant.messages
const chatBody = ref(null)
const sending = assistant.sending
const useLive = ref(false)
const contextItems = ref(AI_CONTEXT_ITEMS.map((x) => ({ ...x })))
const recentChats = ref(AI_RECENT_CHATS.map((x) => x))
const knowledgeRefs = ref(AI_KNOWLEDGE_REFS.map((x) => ({ ...x })))
const headSub = ref('已加载当前空间 ws_trade · 演示模式')

const modelOverrideId = computed(() => {
  const map = { gpt4o: 'aim_gpt4o', claude35: 'aim_claude', qwen: 'aim_qwen', deepseek: 'aim_ds' }
  return map[selectedModel.value] || undefined
})

onMounted(async () => {
  messages.value = AI_INITIAL_MESSAGES.map((m) => ({ ...m }))
  try {
    await assistant.init(currentWs.value || 'default')
    useLive.value = true
    const s = assistant.contextSummary.value
    if (s) {
      headSub.value = `已加载当前空间 ${s.ws || currentWs.value} · ${s.assetCount ?? '—'} 张表 · ${s.metricCount ?? '—'} 指标 · 知识库 ${s.kbCount ?? '—'} 篇`
      contextItems.value = [
        { icon: '🗂️', label: `空间：${s.ws || currentWs.value}` },
        { icon: '📋', label: `表：${s.assetCount ?? '—'}`, to: '/catalog' },
        { icon: '🎯', label: `指标：${s.metricCount ?? '—'}`, to: '/metrics' },
        { icon: '📖', label: `知识库：${s.kbCount ?? '—'} 篇`, to: '/knowledge' },
      ]
    }
    if (assistant.recentSessions.value?.length) {
      recentChats.value = assistant.recentSessions.value.map(
        (x) => `💬 ${x.title || x.id}`,
      )
    }
  } catch {
    useLive.value = false
  }
})

watch(
  () => currentWs.value,
  async (ws) => {
    if (!ws || !useLive.value) return
    try {
      await assistant.init(ws)
      const s = assistant.contextSummary.value
      if (s) {
        headSub.value = `已加载当前空间 ${s.ws || ws} · ${s.assetCount ?? '—'} 张表 · ${s.metricCount ?? '—'} 指标 · 知识库 ${s.kbCount ?? '—'} 篇`
      }
      showToast(`已切换协作空间：${ws}`, 'info')
    } catch {
      /* ignore */
    }
  },
)

watch(
  () => messages.value.length,
  () => scrollChatBottom(),
)

function goModelManage() {
  router.push('/aimodel')
}

function clearChat() {
  if (!confirm('确认清空当前对话？')) return
  assistant.clearLocal()
  showToast('已清空当前对话', 'success')
}

function scrollChatBottom() {
  nextTick(() => {
    const el = chatBody.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pushDemoReply(userText) {
  sending.value = true
  showToast('🤖 模型推理中…（演示）', 'info')
  setTimeout(() => {
    messages.value.push({
      role: 'assistant',
      html: `📌 这是一个静态演示回复。在真实环境中，我会：
<br>1. 解析你的意图（${escapeHtml(userText.substring(0, 30))}…）
<br>2. 检索当前空间资产/指标/知识库
<br>3. 调用路由的 AI 模型生成回答
<br>4. 标注引用来源
<div class="code-head"><span>📎 演示模式 · 后端未就绪时回退</span><span>消耗 ~800 tokens</span></div>`,
    })
    sending.value = false
    scrollChatBottom()
  }, 800)
}

async function sendMessage(scene) {
  const text = inputText.value.trim()
  if (!text || sending.value) return
  inputText.value = ''
  scrollChatBottom()
  if (useLive.value) {
    showToast('🤖 推理中…', 'info')
    await assistant.send({
      text,
      scene,
      modelOverride: modelOverrideId.value,
      ws: currentWs.value || 'default',
    })
    const last = messages.value[messages.value.length - 1]
    if (last?.citations?.length) {
      knowledgeRefs.value = last.citations.map((c) => ({
        label: `📖 ${c.title || c.entryId || '引用'}`,
        to: '/knowledge',
      }))
    }
    scrollChatBottom()
  } else {
    messages.value.push({ role: 'user', text })
    pushDemoReply(text)
  }
}

function sendQuick(chipId) {
  const prompt = AI_QUICK_PROMPTS[chipId]
  if (!prompt) return
  inputText.value = prompt
  const sceneMap = {
    write_sql: 'nl2sql',
    write_script: 'gen_script',
    manual: 'docqa',
    diagnose: 'diagnose',
    explain: 'explain',
    optimize: 'sql_opt',
  }
  sendMessage(sceneMap[chipId])
}

function navContext(to) {
  if (to) router.push(to)
}

function onRecent(label) {
  showToast(`加载历史对话：${label}`, 'info')
}

function openQueryWithSql(sql) {
  if (!sql) return
  router.push({ path: '/query', query: { sql } })
}

async function onAction(act) {
  if (!act) return
  if (act.type === 'deeplink' && act.href) {
    const path = String(act.href).startsWith('/') ? act.href : `/${act.href}`
    if (path.startsWith('/query?')) {
      const q = path.slice('/query?'.length)
      const params = Object.fromEntries(new URLSearchParams(q))
      router.push({ path: '/query', query: params })
      return
    }
    router.push(path)
    return
  }
  if (act.type === 'run_sql' && act.sql) {
    const ok = window.confirm(
      '确认试跑以下只读 SQL？将经即席查询接入层（Trino + Grav），结果默认截断 1000 行。\n\n' +
        String(act.sql).slice(0, 400) +
        (String(act.sql).length > 400 ? '…' : ''),
    )
    if (!ok) return
    try {
      showToast('正在经即席接入层执行…', 'info')
      const r = await assistant.confirmRunSql({ sql: act.sql, ws: 'default' })
      const st = r?.statusLabel || r?.status || 'done'
      const rows = r?.rowCount ?? (r?.rows?.length ?? '—')
      showToast(`试跑完成：${st} · ${rows} 行 · Scan ${r?.scan || '—'}`, r?.scanOverLimit ? 'warning' : 'success')
      if (r?.queryId) {
        messages.value.push({
          role: 'assistant',
          html:
            `✅ 试跑已转发即席查询 <code>${escapeHtml(r.queryId)}</code>` +
            ` · 状态 ${escapeHtml(String(st))} · 行数 ${escapeHtml(String(rows))}` +
            ` · Scan ${escapeHtml(String(r.scan || '—'))}` +
            (r.scanOverLimit ? '<br>⚠️ 扫描超限额' : '') +
            `<br><button type="button" class="ai-inline-btn" data-open-sql="1">在即席查询打开</button>`,
          actions: [{ type: 'deeplink', label: '在即席查询打开', href: r.deeplink || `/query?sql=${encodeURIComponent(act.sql)}`, sql: act.sql }],
        })
      }
    } catch (e) {
      showToast(e?.message || '试跑失败', 'error')
    }
  }
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
      <select v-model="selectedModel" class="select input-sm ai-model-select">
        <option v-for="m in AI_MODEL_SELECT" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
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
            @click="sendQuick(c.id)"
          >{{ c.label }}</span>
        </div>

        <div class="ai-chat-input">
          <textarea
            v-model="inputText"
            placeholder="问任何问题…（示例：怎么申请敏感列明文权限？）"
            @keydown.enter.exact.prevent="sendMessage()"
          />
          <button type="button" class="btn btn-primary" :disabled="sending" @click="sendMessage()">发送 ▶</button>
        </div>
      </div>

      <div class="ai-side">
        <div class="ai-side-card">
          <div class="asc-title">🧠 上下文（当前对话）</div>
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
          <div class="asc-title">📜 最近对话</div>
          <div class="asc-body">
            <div
              v-for="(label, i) in recentChats"
              :key="i"
              class="asc-item clickable"
              @click="onRecent(label)"
            >
              {{ label }}
            </div>
          </div>
        </div>
        <div class="ai-side-card">
          <div class="asc-title">📖 知识库引用</div>
          <div class="asc-body">
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
