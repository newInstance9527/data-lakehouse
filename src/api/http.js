/** 轻量 HTTP：对齐 Snowy CommonResult { code, msg, data } */

const BASE = import.meta.env.VITE_API_BASE || ''

export class ApiError extends Error {
  constructor(message, code, payload) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.payload = payload
  }
}

async function request(method, path, { params, body } = {}) {
  let url = `${BASE}${path}`
  if (params && typeof params === 'object') {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return
      qs.set(k, String(v))
    })
    const s = qs.toString()
    if (s) url += (url.includes('?') ? '&' : '?') + s
  }
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    throw new ApiError(text || res.statusText || '无效响应', res.status)
  }
  if (!res.ok) {
    throw new ApiError(json.msg || res.statusText, res.status, json)
  }
  if (json.code != null && json.code !== 200) {
    throw new ApiError(json.msg || '业务失败', json.code, json)
  }
  return json.data
}

export const http = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
}
