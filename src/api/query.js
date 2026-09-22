/**
 * 即席查询 API（对齐 /lh/compute/query，兼容 /lh/query）
 */
import { API_BASE, http } from './http.js'
import { getToken } from './token.js'

const Q = '/lh/compute/query'

/** adhoc 默认扫描上限 10 GiB；硬顶 50 GiB（与后端 CpQueryScanGuard 一致） */
export const ADHOC_SCAN_LIMIT_BYTES = 10 * 1024 * 1024 * 1024
export const HARD_SCAN_LIMIT_BYTES = 50 * 1024 * 1024 * 1024

export function execQuery(payload) {
  return http.post(`${Q}/exec`, payload)
}

/**
 * SSE 执行：事件 started / progress / done / error
 * @returns {Promise<object>} done 载荷
 */
export async function execQueryStream(payload, { onStarted, onProgress, signal } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  const token = getToken()
  if (token) headers.token = token

  const res = await fetch(`${API_BASE}${Q}/exec-stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || res.statusText || `HTTP ${res.status}`)
  }
  if (!res.body) {
    throw new Error('浏览器不支持流式响应')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let eventName = 'message'
  let dataLines = []
  let donePayload = null
  let streamError = null

  const flush = () => {
    if (!dataLines.length && eventName === 'message') return
    const raw = dataLines.join('\n')
    dataLines = []
    const name = eventName
    eventName = 'message'
    let data = raw
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      /* keep string */
    }
    if (name === 'started') onStarted?.(data)
    else if (name === 'progress') onProgress?.(data)
    else if (name === 'done') donePayload = data
    else if (name === 'error') {
      const err = new Error((data && data.message) || raw || '执行失败')
      err.sse = true
      streamError = err
    }
  }

  const consume = (chunk, finalChunk) => {
    const parts = chunk.split(/\r?\n/)
    if (!finalChunk) buf = parts.pop() ?? ''
    for (const line of parts) {
      if (line === '') {
        flush()
        if (streamError || donePayload != null) return true
        continue
      }
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
        continue
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
    return false
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    if (consume(buf, false)) break
  }
  if (!streamError && donePayload == null && buf.trim()) {
    consume(`${buf}\n`, true)
  } else if (!streamError && donePayload == null) {
    flush()
  }

  if (streamError || donePayload != null) {
    reader.cancel().catch(() => {})
  }
  if (streamError) throw streamError
  if (donePayload == null) throw new Error('SSE 未收到 done 事件')
  return donePayload
}

export function cancelQuery(payload) {
  return http.post(`${Q}/cancel`, payload)
}

export function fetchQueryHistory(params = {}) {
  return http.get(`${Q}/history`, {
    ws: params.ws,
    limit: params.limit ?? 30,
    mineOnly: params.mineOnly ?? true,
  })
}

export function fetchSchemaTree() {
  return http.get(`${Q}/schema-tree`)
}

/** 懒加载表列。优先 assetId；fqn 为平台 layer.domain.assetCode */
export function fetchTableColumns(fqn, assetId) {
  return http.get(`${Q}/columns`, { fqn, assetId })
}

export function exportQueryAudit(payload) {
  return http.post(`${Q}/export`, payload)
}

export function explainQuery(payload) {
  return http.post(`${Q}/explain`, payload)
}

export function detectQueryParams(sql) {
  return http.post(`${Q}/detect-params`, { sql })
}

export function saveQueryDataset(payload) {
  return http.post(`${Q}/datasets`, payload)
}

/** 读取已保存数据集（含抽样行；优先对象存储） */
export function fetchQueryDataset(id) {
  return http.get(`${Q}/datasets/${encodeURIComponent(id)}`)
}

export function fetchQueryDatasets(params = {}) {
  return http.get(`${Q}/datasets`, {
    ws: params.ws,
    limit: params.limit ?? 30,
  })
}

/** 保存即席脚本到 cp_query_saved */
export function saveQueryScript(payload) {
  return http.post(`${Q}/saved`, payload)
}

export function fetchQueryScripts(params = {}) {
  return http.get(`${Q}/saved`, {
    ws: params.ws,
    limit: params.limit ?? 50,
  })
}

export function fetchQueryScript(id) {
  return http.get(`${Q}/saved/${encodeURIComponent(id)}`)
}

export function deleteQueryScript(id) {
  return http.post(`${Q}/saved/${encodeURIComponent(id)}/delete`, {})
}

/** 即席查询面：白名单 ∩ SHOW CATALOGS */
export function fetchQuerySurface() {
  return http.get(`${Q}/query-surface`)
}

/** Grav→Trino catalog 映射 */
export function fetchCatalogMaps(params = {}) {
  return http.get(`${Q}/catalog-map`, { ws: params.ws })
}

/** 联邦源开通 */
export function upsertCatalogMap(payload) {
  return http.post(`${Q}/catalog-map`, payload)
}

/** 查询治理总览：规则 / 队列 / KPI / 审计（与即席同源） */
export function fetchQueryGovOverview() {
  return http.get(`${Q}/gov/overview`)
}

/** 查询治理成本卡（group=ws；旁路 /lh/compute/query/gov/costs） */
export function fetchQueryGovCosts({ range = '30d', group = 'ws', ws } = {}) {
  return http.get(`${Q}/gov/costs`, { range, group, ws })
}

/** 本地探测 :name / ${name}（与后端 CpQueryParamBinder 对齐） */
export function detectParamNamesLocal(sql) {
  if (!sql) return []
  const names = []
  const seen = new Set()
  const re =
    /'(?:''|[^'])*'|"(?:\\.|[^"\\])*"|:([A-Za-z_][A-Za-z0-9_]*)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g
  let m
  while ((m = re.exec(sql))) {
    const n = m[1] || m[2]
    if (n && !seen.has(n)) {
      seen.add(n)
      names.push(n)
    }
  }
  return names
}

export function formatScanBytes(bytes) {
  if (bytes == null || bytes < 0 || Number.isNaN(Number(bytes))) return '—'
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  const kb = n / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}
