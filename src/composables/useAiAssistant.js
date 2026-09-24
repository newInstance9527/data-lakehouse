/**
 * AI 助手（对接 /lh/ai/chat SSE）
 */
import { computed, ref } from 'vue'
import {
  createAiSession,
  fetchAiContextSummary,
  fetchAiSessions,
  fetchAiSessionTurns,
  runAiSql,
  streamAiChat,
} from '@/api/ai'
import { ensureOnce } from '@/composables/useEnsureSamples'

const sessionId = ref('')
const messages = ref([])
const contextSummary = ref(null)
const recentSessions = ref([])
const sending = ref(false)
const lastError = ref(null)
const lastMeta = ref(null)
let abortCtrl = null

export function useAiAssistant() {
  async function init(ws, { resetSession = false } = {}) {
    lastError.value = null
    try {
      if (resetSession) {
        sessionId.value = ''
        messages.value = []
        lastMeta.value = null
      }
      const [summary, sessions] = await Promise.all([
        fetchAiContextSummary(ws).catch(() => null),
        fetchAiSessions(ws).catch(() => []),
      ])
      contextSummary.value = summary
      const list = Array.isArray(sessions) ? sessions : sessions?.records || []
      recentSessions.value = list

      await ensureOnce(
        'ai_sample_session',
        () => !sessionId.value && list.length === 0,
        async () => {
          const s = await createAiSession({ ws, title: '新对话' })
          sessionId.value = s?.id || s?.sessionId || ''
          return s
        },
        async () => {
          const again = await fetchAiSessions(ws).catch(() => [])
          recentSessions.value = Array.isArray(again) ? again : again?.records || []
        },
      )

      if (!sessionId.value) {
        const s = await createAiSession({ ws, title: '新对话' })
        sessionId.value = s?.id || s?.sessionId || ''
      }
    } catch (e) {
      lastError.value = e
      recentSessions.value = []
      throw e
    }
  }

  function clearLocal() {
    messages.value = []
  }

  function stop() {
    abortCtrl?.abort()
    abortCtrl = null
    sending.value = false
  }

  async function loadSession(id, ws) {
    if (!id) return
    const turns = await fetchAiSessionTurns(id)
    sessionId.value = id
    messages.value = (Array.isArray(turns) ? turns : []).map((t) => {
      if (t.role === 'user') {
        return { role: 'user', text: t.content || '' }
      }
      let citations = []
      try {
        if (t.citationsJson) {
          const parsed = typeof t.citationsJson === 'string' ? JSON.parse(t.citationsJson) : t.citationsJson
          citations = Array.isArray(parsed) ? parsed : []
        }
      } catch {
        citations = []
      }
      return {
        role: 'assistant',
        html: String(t.content || '').replace(/\n/g, '<br/>'),
        citations,
        actions: [],
        intent: t.intent,
        modelId: t.modelId,
      }
    })
    if (ws) {
      const again = await fetchAiSessions(ws).catch(() => [])
      recentSessions.value = Array.isArray(again) ? again : again?.records || []
    }
  }

  /**
   * @returns {Promise<{ citations?: any[], actions?: any[], meta?: any }>}
   */
  function send({ text, scene, modelOverride, ws }) {
    if (!text || sending.value) return Promise.resolve({})
    messages.value.push({ role: 'user', text })
    sending.value = true
    lastError.value = null

    const assistantMsg = { role: 'assistant', html: '', citations: [], actions: [] }
    messages.value.push(assistantMsg)
    const idx = messages.value.length - 1

    const body = {
      sessionId: sessionId.value,
      ws,
      text,
      scene,
    }
    // 仅用户显式选择模型时才 override；空字符串不传，走后端 gov_ai_route
    if (modelOverride) {
      body.modelOverride = modelOverride
    }

    return new Promise((resolve) => {
      abortCtrl = streamAiChat(body, {
        onEvent({ event, data }) {
          const msg = messages.value[idx]
          if (!msg) return
          if (event === 'meta') {
            if (data?.sessionId) sessionId.value = data.sessionId
            lastMeta.value = data
            if (data?.modelId) msg.modelId = data.modelId
            messages.value[idx] = { ...msg }
          }
          if (event === 'token') {
            const t = typeof data === 'string' ? data : data?.text || data?.token || ''
            const chunk = String(t).replace(/\n/g, '<br/>')
            msg.html = (msg.html || '') + chunk
            messages.value[idx] = { ...msg }
          }
          if (event === 'citation') {
            const citeList = Array.isArray(data) ? data : data ? [data] : []
            msg.citations = [...(msg.citations || []), ...citeList]
            messages.value[idx] = { ...msg }
          }
          if (event === 'action') {
            const actList = Array.isArray(data) ? data : data ? [data] : []
            msg.actions = [...(msg.actions || []), ...actList]
            messages.value[idx] = { ...msg }
          }
          if (event === 'done') {
            if (data?.content && !msg.html) {
              msg.html = data.content
            }
            if (data?.citations) msg.citations = data.citations
            if (data?.error) {
              lastError.value = new Error(data.error)
              const errHtml = `<br><span style="color:#cf1322">⚠️ ${String(data.error)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</span>`
              msg.html = (msg.html || '') + errHtml
            }
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
            meta: lastMeta.value,
            data,
          })
        },
      })
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
    lastMeta: computed(() => lastMeta.value),
    sending,
    lastError,
    init,
    clearLocal,
    stop,
    send,
    loadSession,
    confirmRunSql,
  }
}
