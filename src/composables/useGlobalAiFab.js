/**
 * 全局悬浮 AI 助手（独立会话态，不与 AiAssistantView 共用 module-level refs）
 * 对接 /lh/ai/chat SSE · /lh/ai/models · /lh/ai/sessions
 *
 * 多模态说明：GovAiChatParam 仅 text；图片/文件走文本描述回退（见 buildAttachmentPrompt）。
 */
import { computed, ref } from 'vue'
import { createAiSession, fetchAiModels, runAiSql, streamAiChat } from '@/api/ai'
import { chatModelOptionLabel, filterChatPickerModels } from '@/data/ai'
import { formatAiMarkdown } from '@/utils/aiMarkdown'

const LS_POS = 'lh_ai_fab_pos'
const LS_SIZE = 'lh_ai_fab_size'
const DRAG_THRESHOLD = 6
const DEFAULT_SIZE = { width: 380, height: 480 }
const FAB_SIZE = 48

export { LS_POS, LS_SIZE, DRAG_THRESHOLD, DEFAULT_SIZE, FAB_SIZE }

function defaultPos() {
  if (typeof window === 'undefined') return { left: 24, top: 24 }
  return {
    left: Math.max(12, window.innerWidth - 24 - FAB_SIZE),
    top: Math.max(12, window.innerHeight - 24 - FAB_SIZE),
  }
}

export function loadFabPos() {
  try {
    const raw = localStorage.getItem(LS_POS)
    if (!raw) return defaultPos()
    const p = JSON.parse(raw)
    if (typeof p?.left === 'number' && typeof p?.top === 'number') return clampPos(p)
  } catch {
    /* ignore */
  }
  return defaultPos()
}

export function saveFabPos(pos) {
  try {
    localStorage.setItem(LS_POS, JSON.stringify(clampPos(pos)))
  } catch {
    /* ignore */
  }
}

export function loadFabSize() {
  try {
    const raw = localStorage.getItem(LS_SIZE)
    if (!raw) return { ...DEFAULT_SIZE }
    const s = JSON.parse(raw)
    if (typeof s?.width === 'number' && typeof s?.height === 'number') {
      return {
        width: Math.min(720, Math.max(300, s.width)),
        height: Math.min(800, Math.max(320, s.height)),
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SIZE }
}

export function saveFabSize(size) {
  try {
    localStorage.setItem(
      LS_SIZE,
      JSON.stringify({
        width: Math.min(720, Math.max(300, size.width)),
        height: Math.min(800, Math.max(320, size.height)),
      }),
    )
  } catch {
    /* ignore */
  }
}

function clampPos({ left, top }) {
  if (typeof window === 'undefined') return { left, top }
  const maxL = Math.max(0, window.innerWidth - FAB_SIZE)
  const maxT = Math.max(0, window.innerHeight - FAB_SIZE)
  return {
    left: Math.min(maxL, Math.max(0, left)),
    top: Math.min(maxT, Math.max(0, top)),
  }
}

/**
 * 附件 → 追加进 text（后端无 multipart / 视觉通道）
 * @returns {Promise<{ prompt: string, previews: { name: string, kind: string, url?: string }[] }>}
 */
export async function buildAttachmentPrompt(files) {
  const list = Array.from(files || []).filter(Boolean)
  const chunks = []
  const previews = []
  for (const f of list) {
    const name = f.name || 'clipboard-image'
    const kind = f.type || 'application/octet-stream'
    const kb = Math.max(1, Math.round((f.size || 0) / 1024))
    if (kind.startsWith('image/')) {
      let url
      try {
        url = URL.createObjectURL(f)
      } catch {
        url = undefined
      }
      previews.push({ name, kind, url })
      chunks.push(
        `[用户附带图片：${name} · ${kind} · ${kb}KB。当前 /lh/ai/chat 为文本通道，未做视觉识别；请结合用户文字理解意图。]`,
      )
    } else if (
      kind.startsWith('text/') ||
      /\.(txt|md|json|csv|sql|log|xml|yml|yaml|js|ts|py|java|vue)$/i.test(name)
    ) {
      let body = ''
      try {
        body = await f.text()
      } catch {
        body = ''
      }
      const clipped = body.slice(0, 8000)
      previews.push({ name, kind })
      chunks.push(
        `[附件 ${name}]\n${clipped}${body.length > 8000 ? '\n…(内容已截断)' : ''}`,
      )
    } else {
      previews.push({ name, kind })
      chunks.push(
        `[附件：${name}（${kind}，${kb}KB）。二进制未上传；请用户用文字补充要点。]`,
      )
    }
  }
  return { prompt: chunks.join('\n\n'), previews }
}

export function useGlobalAiFab() {
  const open = ref(false)
  const pos = ref(loadFabPos())
  const size = ref(loadFabSize())
  const sessionId = ref('')
  const messages = ref([])
  const sending = ref(false)
  const lastError = ref(null)
  const modelOptions = ref([])
  /** 空 = 走后端 gov_ai_route */
  const selectedModelId = ref('')
  /** 粘贴/上传图片时置 true，选择器收窄到视觉能力模型 */
  const hasImageInput = ref(false)
  let abortCtrl = null

  const visibleModelOptions = computed(() => {
    if (!hasImageInput.value) return modelOptions.value
    const vision = modelOptions.value.filter((m) => m.supportsVision)
    return vision.length ? vision : modelOptions.value
  })

  async function ensureSession(ws) {
    if (sessionId.value) return sessionId.value
    const s = await createAiSession({ ws, title: '悬浮助手' })
    sessionId.value = s?.id || s?.sessionId || ''
    return sessionId.value
  }

  async function loadModels() {
    try {
      const page = await fetchAiModels({ kind: 'chat' }, { current: 1, size: 100 })
      const rows = page?.records || []
      modelOptions.value = filterChatPickerModels(rows).map((m) => ({
        id: m.id,
        label: chatModelOptionLabel(m),
        supportsVision: m.supportsVision === true || m.supportsVision === 1,
        kind: m.kind || 'chat',
      }))
      if (selectedModelId.value && !modelOptions.value.some((m) => m.id === selectedModelId.value)) {
        selectedModelId.value = ''
      }
    } catch {
      modelOptions.value = []
    }
  }

  /**
   * @returns {{ switched?: boolean, warn?: string, info?: string }}
   */
  function preferVisionModel() {
    const vision = modelOptions.value.filter((m) => m.supportsVision)
    if (!vision.length) {
      return { warn: '当前无支持视觉输入的对话模型，请在模型管理中开启「支持上传图片」' }
    }
    if (selectedModelId.value && vision.some((m) => m.id === selectedModelId.value)) {
      return {}
    }
    selectedModelId.value = vision[0].id
    return { switched: true, info: `已切换到视觉模型：${vision[0].label}` }
  }

  function clearChat() {
    messages.value = []
    lastError.value = null
    hasImageInput.value = false
  }

  function stop() {
    abortCtrl?.abort()
    abortCtrl = null
    sending.value = false
  }

  /**
   * @param {{ text: string, ws: string, attachments?: File[] }} opts
   */
  async function send({ text, ws, attachments } = {}) {
    const trimmed = (text || '').trim()
    const files = attachments || []
    if ((!trimmed && !files.length) || sending.value) return { error: null }

    const { prompt: attachPrompt, previews } = await buildAttachmentPrompt(files)
    const fullText = [trimmed, attachPrompt].filter(Boolean).join('\n\n')
    if (!fullText) return { error: null }

    lastError.value = null
    messages.value.push({
      role: 'user',
      text: trimmed || '（附件）',
      previews,
    })
    const assistantMsg = { role: 'assistant', text: '', html: '', citations: [], actions: [] }
    messages.value.push(assistantMsg)
    const idx = messages.value.length - 1
    sending.value = true

    try {
      await ensureSession(ws)
    } catch (e) {
      lastError.value = e
      assistantMsg.text = `⚠️ ${e?.message || '创建会话失败'}`
      assistantMsg.html = formatAiMarkdown(assistantMsg.text)
      messages.value[idx] = { ...assistantMsg }
      sending.value = false
      return { error: e }
    }

    const body = {
      sessionId: sessionId.value,
      ws,
      text: fullText,
    }
    if (selectedModelId.value) {
      body.modelOverride = selectedModelId.value
    }

    return new Promise((resolve) => {
      abortCtrl = streamAiChat(body, {
        onEvent({ event, data }) {
          const msg = messages.value[idx]
          if (!msg) return
          if (event === 'meta' && data?.sessionId) {
            sessionId.value = data.sessionId
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
            if (data?.actions) msg.actions = data.actions
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
            msg.text = `${msg.text || ''}\n\n⚠️ ${e?.message || '请求失败'}`
            msg.html = formatAiMarkdown(msg.text)
            messages.value[idx] = { ...msg }
          }
          sending.value = false
          abortCtrl = null
          resolve({ error: e })
        },
        onDone() {
          sending.value = false
          abortCtrl = null
          resolve({ error: lastError.value })
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
    open,
    pos,
    size,
    sessionId,
    messages,
    sending,
    lastError,
    modelOptions,
    visibleModelOptions,
    selectedModelId,
    hasImageInput,
    loadModels,
    preferVisionModel,
    ensureSession,
    clearChat,
    stop,
    send,
    confirmRunSql,
    persistPos: () => saveFabPos(pos.value),
    persistSize: () => saveFabSize(size.value),
    clampPosInto: (p) => {
      pos.value = clampPos(p)
    },
  }
}
