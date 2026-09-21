/** 轻量 HTTP：对齐 Snowy CommonResult { code, msg, data }；带 Sa-Token */

import { clearToken, getToken } from './token'

export const API_BASE = import.meta.env.VITE_API_BASE || '/lakehouse'
const RELOGIN_CODES = new Set([401, 1011007, 1011008])

export class ApiError extends Error {
  constructor(message, code, payload) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.payload = payload
  }
}

let redirectingLogin = false

function goLogin() {
  if (redirectingLogin) return
  redirectingLogin = true
  clearToken()
  const hash = window.location.hash || ''
  if (!hash.includes('/login')) {
    const redirect = encodeURIComponent(hash.replace(/^#/, '') || '/')
    window.location.hash = `#/login?redirect=${redirect}`
  }
  setTimeout(() => {
    redirectingLogin = false
  }, 800)
}

async function request(method, path, { params, body, skipAuth } = {}) {
  let url = `${API_BASE}${path}`
  if (params && typeof params === 'object') {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return
      qs.set(k, String(v))
    })
    const s = qs.toString()
    if (s) url += (url.includes('?') ? '&' : '?') + s
  }
  const headers = {}
  if (body != null) headers['Content-Type'] = 'application/json'
  if (!skipAuth) {
    const token = getToken()
    if (token) headers.token = token
  }
  const res = await fetch(url, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
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
    if (res.status === 401) goLogin()
    throw new ApiError(json.msg || res.statusText, res.status, json)
  }
  if (json.code != null && json.code !== 200) {
    if (RELOGIN_CODES.has(json.code)) goLogin()
    throw new ApiError(json.msg || '业务失败', json.code, json)
  }
  return json.data
}

export const http = {
  get: (path, params, opts) => request('GET', path, { params, ...opts }),
  post: (path, body, opts) => request('POST', path, { body, ...opts }),
  put: (path, body, opts) => request('PUT', path, { body, ...opts }),
  delete: (path, params, opts) => request('DELETE', path, { params, ...opts }),
}
