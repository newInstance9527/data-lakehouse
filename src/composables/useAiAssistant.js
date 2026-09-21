/**
 * AI 助手（对接 /lh/ai/chat SSE）
 */
import { computed, ref } from 'vue'
import {
  createAiSession,
  fetchAiContextSummary,
  fetchAiSessions,
  runAiSql,
  streamAiChat,
} from '@/api/ai'

const sessionId = ref('')
const messages = ref([])
const contextSummary = ref(null)
const recentSessions = ref([])
const sending = ref(false)
const lastError = ref(null)
let abortCtrl = null

export function useAiAssistant() {
  async function init(ws) {
    try {
      const [summary, sessions] = await Promise.all([
        fetchAiContextSummary(ws).catch(() => null),
        fetchAiSessions(ws).catch(() => []),
      ])
      contextSummary.value = summary
      recentSessions.value = Array.isArray(sessions) ? sessions : sessions?.records || []
      if (!sessionId.value) {
        const s = await createAiSession({ ws, title: '新对话' })
        sessionId.value = s.id || s.sessionId
      }
    } catch (e) {
      lastError.value = e
      console.warn('[aiassistant] init degraded', e)
    }
  }

  function clearLocal() {
    messages.value = [
      {
        role: 'assistant',
        html: '👋 对话已清空。描述你的数据问题，或点击上方快捷指令开始。',
      },
    ]
  }

  function stop() {
    abortCtrl?.abort()
    abortCtrl = null
    sending.value = false
  }

  /**
   * @returns {Promise<{ citations?: any[], actions?: any[] }>}
   */
  function send({ text, scene, modelOverride, ws }) {
    if (!text || sending.value) return Promise.resolve({})
    messages.value.push({ role: 'user', text })
    sending.value = true
    lastError.value = null

    const assistant = { role: 'assistant', html: '', citations: [], actions: [] }
    messages.value.push(assistant)
    const idx = messages.value.length - 1

    return new Promise((resolve) => {
      abortCtrl = streamAiChat(
        {
          sessionId: sessionId.value,
          ws,
          text,
          scene,
          modelOverride,
        },
        {
          onEvent({ event, data }) {
            const msg = messages.value[idx]
            if (!msg) return
            if (event === 'meta' && data?.sessionId) {
              sessionId.value = data.sessionId
            }
            if (event === 'token') {
              const t = typeof data === 'string' ? data : data?.text || data?.token || ''
              msg.html = (msg.html || '') + t
              messages.value[idx] = { ...msg }
            }
            if (event === 'citation') {
              const list = Array.isArray(data) ? data : data ? [data] : []
              msg.citations = [...(msg.citations || []), ...list]
              messages.value[idx] = { ...msg }
            }
            if (event === 'action') {
              const list = Array.isArray(data) ? data : data ? [data] : []
              msg.actions = [...(msg.actions || []), ...list]
              messages.value[idx] = { ...msg }
            }
            if (event === 'done' && data?.content && !msg.html) {
              msg.html = data.content
              if (data.citations) msg.citations = data.citations
              messages.value[idx] = { ...msg }
            }
          },
          onError(e) {
            lastError.value = e
            const msg = messages.value[idx]
            if (msg) {
              msg.html =
                (msg.html || '') +
                `<br><span style="color:#cf1322">⚠️ ${e?.message || '请求失败'}；可稍后重试或检查后端 /lh/ai/chat。</span>`
              messages.value[idx] = { ...msg }
            }
            sending.value = false
            resolve({ error: e })
          },
          onDone(data) {
            sending.value = false
            abortCtrl = null
            resolve({
              citations: messages.value[idx]?.citations,
              actions: messages.value[idx]?.actions,
              data,
            })
          },
        },
      )
    })
  }

  async function confirmRunSql({ sql, sessionId: sid, turnId, ws }) {
    return runAiSql({
      sql,
      sessionId: sid || sessionId.value,
      turnId,
      ws: ws || 'default',
      confirmed: true,
    })
  }

  return {
    sessionId,
    messages,
    contextSummary: computed(() => contextSummary.value),
    recentSessions: computed(() => recentSessions.value),
    sending,
    lastError,
    init,
    clearLocal,
    stop,
    send,
    confirmRunSql,
  }
}
