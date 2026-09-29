/**
 * AI 助手（对接 /lh/ai/chat SSE）
 */
import { computed, ref } from 'vue'
import {
  createAiSession,
  deleteAiSession,
  fetchAiContextSummary,
  fetchAiSessions,
  fetchAiSessionTurns,
  runAiSql,
  streamAiChat,
} from '@/api/ai'
import { formatAiMarkdown } from '@/utils/aiMarkdown'

const sessionId = ref('')
const messages = ref([])
const contextSummary = ref(null)
const recentSessions = ref([])
const sending = ref(false)
const lastError = ref(null)
const lastMeta = ref(null)
let abortCtrl = null

function mapTurns(turns) {
  return (Array.isArray(turns) ? turns : []).map((t) => {
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
      text: String(t.content || ''),
      html: formatAiMarkdown(String(t.content || '')),
      citations,
      actions: [],
      intent: t.intent,
      modelId: t.modelId,
    }
  })
}

export function useAiAssistant() {
  async function refreshSessions(ws) {
    const sessions = await fetchAiSessions(ws).catch(() => [])
    recentSessions.value = Array.isArray(sessions) ? sessions : sessions?.records || []
    return recentSessions.value
  }

  /**
   * 初始化：拉上下文 + 会话列表；默认打开最近一次对话。
   * 列表为空时不自动建会话——须用户点「新对话」或首次发消息（后端 ensureSession）。
   */
  async function init(ws, { resetSession = false } = {}) {
    lastError.value = null
    try {
      if (resetSession) {
        sessionId.value = ''
        messages.value = []
        lastMeta.value = null
      }
      const [summary, list] = await Promise.all([
        fetchAiContextSummary(ws).catch(() => null),
        refreshSessions(ws),
      ])
      contextSummary.value = summary

      if (sessionId.value && list.some((s) => s.id === sessionId.value)) {
        await loadSession(sessionId.value, ws)
        return
      }

      if (list.length) {
        await loadSession(list[0].id, ws)
        return
      }

      // 无历史会话：保持空白，勿自动 createSession
      sessionId.value = ''
      messages.value = []
      lastMeta.value = null
    } catch (e) {
      lastError.value = e
      recentSessions.value = []
      throw e
    }
  }

  /** 新建对话并切到该会话（仅手动「新对话」调用） */
  async function newChat(ws, { title = '新对话' } = {}) {
    stop()
    const s = await createAiSession({ ws, title })
    sessionId.value = s?.id || s?.sessionId || ''
    messages.value = []
    lastMeta.value = null
    await refreshSessions(ws)
    return { sessionId: sessionId.value }
  }

  function clearLocal() {
    messages.value = []
  }

  function clearActiveSession() {
    stop()
    sessionId.value = ''
    messages.value = []
    lastMeta.value = null
  }

  function stop() {
    abortCtrl?.abort()
    abortCtrl = null
    sending.value = false
  }

  async function loadSession(id, ws) {
    if (!id) return
    stop()
    const turns = await fetchAiSessionTurns(id)
    sessionId.value = id
    messages.value = mapTurns(turns)
    lastMeta.value = null
    if (ws) {
      await refreshSessions(ws).catch(() => {})
    }
  }

  /**
   * 软删会话；若删的是当前会话则切到下一条，列表空则清空本地（不自动新建）。
   * @returns {Promise<{ deletedId: string, nextSessionId?: string }>}
   */
  async function deleteSession(id, ws) {
    if (!id) return { deletedId: '' }
    stop()
    await deleteAiSession(id)
    const wasCurrent = sessionId.value === id
    const list = await refreshSessions(ws)
    if (!wasCurrent) {
      return { deletedId: id, nextSessionId: sessionId.value }
    }
    if (list.length) {
      await loadSession(list[0].id, ws)
      return { deletedId: id, nextSessionId: list[0].id }
    }
    clearActiveSession()
    return { deletedId: id, nextSessionId: '' }
  }

  /**
   * @returns {Promise<{ citations?: any[], actions?: any[], meta?: any }>}
   */
  function send({ text, scene, modelOverride, ws }) {
    if (!text || sending.value) return Promise.resolve({})
    messages.value.push({ role: 'user', text })
    sending.value = true
    lastError.value = null

    const assistantMsg = { role: 'assistant', text: '', html: '', citations: [], actions: [] }
    messages.value.push(assistantMsg)
    const idx = messages.value.length - 1

    const body = {
      sessionId: sessionId.value,
      ws,
      text,
      scene,
    }
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
            msg.text = (msg.text || '') + String(t)
            msg.html = formatAiMarkdown(msg.text)
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
            if (data?.content) {
              msg.text = String(data.content)
            }
            msg.html = formatAiMarkdown(msg.text || '')
            if (data?.citations) msg.citations = data.citations
            if (data?.error) {
              lastError.value = new Error(data.error)
              msg.text = `${msg.text || ''}\n\n⚠️ ${data.error}`
              msg.html = formatAiMarkdown(msg.text)
            }
            messages.value[idx] = { ...msg }
          }
        },
        onError(e) {
          lastError.value = e
          const msg = messages.value[idx]
          if (msg) {
            msg.text = `${msg.text || ''}\n\n⚠️ ${e?.message || '请求失败'}；可稍后重试或检查后端 /lh/ai/chat。`
            msg.html = formatAiMarkdown(msg.text)
            messages.value[idx] = { ...msg }
          }
          sending.value = false
          resolve({ error: e })
        },
        onDone(data) {
          sending.value = false
          abortCtrl = null
          refreshSessions(ws).catch(() => {})
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
    newChat,
    refreshSessions,
    clearLocal,
    clearActiveSession,
    stop,
    send,
    loadSession,
    deleteSession,
    confirmRunSql,
  }
}
