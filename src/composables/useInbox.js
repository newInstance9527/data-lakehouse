/**
 * 顶栏站内信：列表 + 未读角标（WebSocket 实时推送 + 轮询兜底）
 */
import { computed, ref } from 'vue'
import {
  fetchIndexMessageDetail,
  fetchIndexMessageList,
  markAllMessagesRead,
} from '@/api/message'
import { API_BASE } from '@/api/http'
import { getToken } from '@/api/token'
import { useToast } from '@/composables/useToast'
import { t } from '@/composables/useLocale'

const messages = ref([])
const unreadCount = ref(0)
const loading = ref(false)
const open = ref(false)
const detail = ref(null)
const detailOpen = ref(false)
let pollTimer = null
let ws = null
let wsRetryTimer = null
let wsRetryMs = 3000
let lastNotifiedUnread = 0
let started = false

function countUnread(list) {
  if (!Array.isArray(list)) return 0
  return list.filter((m) => !m.read && m.read !== true && m.read !== 1 && m.read !== '1').length
}

function buildWsUrl() {
  const token = getToken()
  if (!token) return ''
  const base = API_BASE || '/lakehouse'
  const path = `${base.replace(/\/$/, '')}/dev/message/ws?token=${encodeURIComponent(token)}`
  if (/^https?:\/\//i.test(base)) {
    return path.replace(/^http/i, 'ws')
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${path.startsWith('/') ? path : `/${path}`}`
}

function notifyUnreadBump(next) {
  const n = Number(next) || 0
  if (n > lastNotifiedUnread && n > 0) {
    try {
      const { showToast } = useToast()
      showToast(
        t('inbox.push.new', '收到新的站内消息'),
        'info',
        { duration: 4500 },
      )
    } catch {
      /* ignore */
    }
  }
  lastNotifiedUnread = n
  unreadCount.value = n
}

async function refreshList() {
  if (!getToken()) {
    messages.value = []
    unreadCount.value = 0
    return
  }
  loading.value = true
  try {
    const data = await fetchIndexMessageList({ limit: 30 })
    const list = Array.isArray(data) ? data : data?.records || []
    messages.value = list
    const n = countUnread(list)
    notifyUnreadBump(n)
  } catch {
    /* soft — 不打扰顶栏 */
  } finally {
    loading.value = false
  }
}

async function refreshBadge() {
  if (!getToken()) {
    unreadCount.value = 0
    return
  }
  try {
    const data = await fetchIndexMessageList({ limit: 30 })
    const list = Array.isArray(data) ? data : data?.records || []
    const n = countUnread(list)
    notifyUnreadBump(n)
    if (open.value) messages.value = list
  } catch {
    /* soft */
  }
}

function stopWs() {
  if (wsRetryTimer) {
    clearTimeout(wsRetryTimer)
    wsRetryTimer = null
  }
  if (ws) {
    try {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      ws.close()
    } catch {
      /* ignore */
    }
    ws = null
  }
}

function scheduleWsRetry() {
  if (wsRetryTimer) return
  wsRetryTimer = setTimeout(() => {
    wsRetryTimer = null
    startWs()
  }, wsRetryMs)
  wsRetryMs = Math.min(wsRetryMs * 2, 60000)
}

function startWs() {
  if (!getToken() || typeof WebSocket === 'undefined') return
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return
  }
  const url = buildWsUrl()
  if (!url) return
  stopWs()
  try {
    ws = new WebSocket(url)
  } catch {
    scheduleWsRetry()
    return
  }
  ws.onopen = () => {
    wsRetryMs = 3000
  }
  ws.onmessage = (event) => {
    try {
      const result = JSON.parse(event.data)
      if (result?.code === 200 && result.data != null) {
        const n = Number(result.data) || 0
        notifyUnreadBump(n)
        if (open.value) refreshList()
      }
    } catch {
      /* ignore bad frame */
    }
  }
  ws.onerror = () => {
    /* onclose will retry */
  }
  ws.onclose = () => {
    ws = null
    if (started && getToken()) scheduleWsRetry()
  }
}

function startPoll() {
  stopPoll()
  // WS 正常时作低频兜底；断开时仍能刷角标
  pollTimer = setInterval(() => {
    refreshBadge()
  }, 120000)
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function useInbox() {
  async function openPanel() {
    open.value = true
    await refreshList()
  }

  function closePanel() {
    open.value = false
  }

  async function openDetail(row) {
    if (!row?.id) return
    detailOpen.value = true
    try {
      const data = await fetchIndexMessageDetail(row.id)
      detail.value = { ...row, ...(data || {}) }
      if (!row.read) {
        unreadCount.value = Math.max(0, unreadCount.value - 1)
        lastNotifiedUnread = unreadCount.value
        const hit = messages.value.find((m) => m.id === row.id)
        if (hit) hit.read = true
      }
    } catch (e) {
      detail.value = { ...row, error: e?.message || String(e) }
    }
  }

  function closeDetail() {
    detailOpen.value = false
    detail.value = null
  }

  async function markAllRead() {
    await markAllMessagesRead()
    messages.value = messages.value.map((m) => ({ ...m, read: true }))
    unreadCount.value = 0
    lastNotifiedUnread = 0
  }

  return {
    messages,
    unreadCount: computed(() => unreadCount.value),
    loading: computed(() => loading.value),
    open,
    detail,
    detailOpen,
    refreshList,
    refreshBadge,
    openPanel,
    closePanel,
    openDetail,
    closeDetail,
    markAllRead,
    startPoll,
    stopPoll,
  }
}

/** 顶栏单例：WS + 轮询（重复调用不会叠多个连接） */
export function ensureInboxPoll() {
  if (!started) {
    started = true
    lastNotifiedUnread = unreadCount.value
  }
  refreshBadge()
  startWs()
  if (!pollTimer) startPoll()
  return { refreshBadge, stopPoll, stopWs }
}

export function stopInboxPush() {
  started = false
  stopPoll()
  stopWs()
}
