/**
 * AI 模型 / 助手 / 知识库 API（对齐 /lh/ai/* · /lh/knowledge/*）
 */
import { getToken } from './token.js'
import { API_BASE, ApiError, http } from './http.js'

const AI = '/lh/ai'
const KB = '/lh/knowledge'

/** ========== 模型管理 ========== */

export function fetchAiModelOverview(ws) {
  return http.get(`${AI}/models/overview`, { ws })
}

export function fetchAiModels(filters = {}, { current = 1, size = 50 } = {}) {
  return http.get(`${AI}/models`, {
    current,
    size,
    q: filters.q,
    ws: filters.ws,
    kind: filters.kind,
    supportsVision: filters.supportsVision === true || filters.supportsVision === 1 ? true : undefined,
  })
}

export function fetchAiModel(id) {
  return http.get(`${AI}/models/${encodeURIComponent(id)}`)
}

export function createAiModel(payload) {
  return http.post(`${AI}/models`, payload)
}

export function updateAiModel(id, payload) {
  return http.put(`${AI}/models/${encodeURIComponent(id)}`, payload)
}

export function deleteAiModel(id) {
  return http.post(`${AI}/models/${encodeURIComponent(id)}/delete`, {})
}

export function testAiModel(id) {
  return http.post(`${AI}/models/${encodeURIComponent(id)}/test`, {})
}

export function enableAiModel(id, enabled) {
  return http.post(`${AI}/models/${encodeURIComponent(id)}/enable`, { enabled: !!enabled })
}

export function rotateAiModel(id, key) {
  return http.post(`${AI}/models/${encodeURIComponent(id)}/rotate`, { key })
}

export function fetchAiGatewayProbe() {
  return http.get(`${AI}/models/gateway/probe`)
}

export function fetchAiRoutes(ws) {
  return http.get(`${AI}/routes`, { ws })
}

export function saveAiRoutes(routes) {
  return http.put(`${AI}/routes`, { routes })
}

export function fetchAiUsage({ range = '30d', group = 'model', ws } = {}) {
  return http.get(`${AI}/usage`, { range, group, ws })
}

/** ========== 助手 ========== */

export function fetchAiContextSummary(ws) {
  return http.get(`${AI}/context/summary`, { ws })
}

export function fetchAiSessions(ws) {
  return http.get(`${AI}/sessions`, { ws })
}

export function fetchAiSessionTurns(sessionId) {
  return http.get(`${AI}/sessions/${encodeURIComponent(sessionId)}/turns`)
}

export function createAiSession(payload = {}) {
  return http.post(`${AI}/sessions`, payload)
}

/** 软删会话（仅本人）；优先 DELETE，失败再走 POST 兜底 */
export function deleteAiSession(sessionId) {
  const id = encodeURIComponent(sessionId)
  return http.delete(`${AI}/sessions/${id}`).catch((e) => {
    // 部分网关禁 DELETE 时回退
    if (e?.code === 405 || e?.status === 405 || /method not allowed/i.test(e?.message || '')) {
      return http.post(`${AI}/sessions/${id}/delete`, {})
    }
    throw e
  })
}

/**
 * SSE 对话。onEvent({ event, data })；返回 AbortController。
 */
export function streamAiChat(body, { onEvent, onError, onDone } = {}) {
  const controller = new AbortController()
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.token = token

  ;(async () => {
    try {
      const res = await fetch(`${API_BASE}${AI}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = text || res.statusText
        try {
          const j = JSON.parse(text)
          msg = j.msg || j.message || msg
        } catch {
          /* keep text */
        }
        throw new ApiError(msg, res.status)
      }
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('text/event-stream') && !ct.includes('text/plain')) {
        // 非 SSE：尝试 JSON 整包（含业务失败 / 配额硬门禁）
        const json = await res.json()
        if (json?.code != null && json.code !== 200) {
          throw new ApiError(json.msg || '业务失败', json.code, json)
        }
        const data = json?.data ?? json
        if (onEvent) onEvent({ event: 'done', data })
        if (onDone) onDone(data)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let eventName = 'message'
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() || ''
        for (const line of parts) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            const raw = line.slice(5).trim()
            let data = raw
            try {
              data = JSON.parse(raw)
            } catch {
              /* keep string */
            }
            if (onEvent) onEvent({ event: eventName, data })
            if (eventName === 'done' && onDone) onDone(data)
            eventName = 'message'
          }
        }
      }
      if (onDone) onDone()
    } catch (e) {
      if (e?.name === 'AbortError') return
      if (onError) onError(e)
    }
  })()

  return controller
}

export function runAiSql(payload) {
  return http.post(`${AI}/run-sql`, payload)
}

/** ========== 知识库 ========== */

export function fetchKbOverview(ws, scope) {
  return http.get(`${KB}/overview`, { ws, scope })
}

export function fetchKbEntries(filters = {}, { current = 1, size = 50 } = {}) {
  return http.get(`${KB}/entries`, {
    current,
    size,
    q: filters.q,
    cat: filters.cat === 'all' ? undefined : filters.cat,
    ws: filters.ws,
    scope: filters.scope,
  })
}

export function createKbEntry(payload) {
  return http.post(`${KB}/entries`, payload)
}

/**
 * 上传文档并真实解析入库。
 * @param {File} file
 * @param {Record<string, string|number|undefined>} fields title/cat/ws/scope/strategy/...
 */
export function uploadKbEntry(file, fields = {}) {
  const fd = new FormData()
  fd.append('file', file)
  Object.entries(fields).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    fd.append(k, String(v))
  })
  return http.postForm(`${KB}/entries/upload`, fd)
}

export function updateKbEntry(id, payload) {
  return http.put(`${KB}/entries/${encodeURIComponent(id)}`, payload)
}

export function deleteKbEntry(id) {
  return http.post(`${KB}/entries/${encodeURIComponent(id)}/delete`, {})
}

export function fetchKbEntry(id) {
  return http.get(`${KB}/entries/${encodeURIComponent(id)}`)
}

export function rebuildKbIndex(entryId) {
  const q = entryId ? `?entryId=${encodeURIComponent(entryId)}` : ''
  return http.post(`${KB}/index/rebuild${q}`, {})
}

export function searchKnowledge(payload) {
  return http.post(`${KB}/search`, payload)
}

export function fetchKbStats(range = '7d', ws) {
  return http.get(`${KB}/stats`, { range, ws })
}
