<script setup>
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
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

const selectedModel = ref('gpt4o')
const inputText = ref('')
const messages = ref(AI_INITIAL_MESSAGES.map((m) => ({ ...m })))
const chatBody = ref(null)
const sending = ref(false)

function goModelManage() {
  router.push('/aimodel')
}

function clearChat() {
  if (!confirm('确认清空当前对话？')) return
  messages.value = [
    {
      role: 'assistant',
      html: '👋 对话已清空。描述你的数据问题，或点击上方快捷指令开始。',
    },
  ]
  showToast('已清空当前对话', 'success')
}

function scrollChatBottom() {
  nextTick(() => {
    const el = chatBody.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function pushDemoReply(userText) {
  sending.value = true
  showToast('🤖 模型推理中…（演示）', 'info')
  setTimeout(() => {
    messages.value.push({
      role: 'assistant',
      html: `📌 这是一个静态演示回复。在真实环境中，我会：
<br>1. 解析你的意图（${escapeHtml(userText.substring(0, 30))}…）
<br>2. 检索当前空间 <code>ws_trade</code> 资产/指标/知识库
<br>3. 调用路由的 AI 模型（默认 GPT-4o）生成回答
<br>4. 标注引用来源（资产/知识条目）
<br><br>👉 试试上方快捷指令「📝 生成 SQL」查看完整示例。
<div class="code-head"><span>📎 上下文：ws_trade · 知识库 286 篇</span><span>消耗 ~800 tokens</span></div>`,
    })
    sending.value = false
    scrollChatBottom()
  }, 800)
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value) return
  messages.value.push({ role: 'user', text })
  inputText.value = ''
  scrollChatBottom()
  pushDemoReply(text)
}

function sendQuick(chipId) {
  const prompt = AI_QUICK_PROMPTS[chipId]
  if (!prompt) return
  inputText.value = prompt
  sendMessage()
}

function navContext(to) {
  if (to) router.push(to)
}

function onRecent(label) {
  showToast(`加载历史对话：${label}`, 'info')
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
            <div class="ai-head-sub">已加载当前空间 ws_trade · 42 张表 · 342 指标 · 知识库 286 篇</div>
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
            <div class="ai-msg-bubble">
              <div v-if="msg.html" v-html="msg.html" />
              <template v-else>{{ msg.text }}</template>
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
            @keydown.enter.exact.prevent="sendMessage"
          />
          <button type="button" class="btn btn-primary" :disabled="sending" @click="sendMessage">发送 ▶</button>
        </div>
      </div>

      <div class="ai-side">
        <div class="ai-side-card">
          <div class="asc-title">🧠 上下文（当前对话）</div>
          <div class="asc-body">
            <div
              v-for="(item, i) in AI_CONTEXT_ITEMS"
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
              v-for="(label, i) in AI_RECENT_CHATS"
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
              v-for="(ref, i) in AI_KNOWLEDGE_REFS"
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
