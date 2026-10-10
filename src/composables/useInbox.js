/**
 * 顶栏站内信：列表 + 未读角标（轮询；WS 可选后续）
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  fetchIndexMessageDetail,
  fetchIndexMessageList,
  markAllMessagesRead,
} from '@/api/message'
import { getToken } from '@/api/token'

const messages = ref([])
const unreadCount = ref(0)
const loading = ref(false)
const open = ref(false)
const detail = ref(null)
const detailOpen = ref(false)
let pollTimer = null
let bootstrapped = false

function countUnread(list) {
  if (!Array.isArray(list)) return 0
  return list.filter((m) => !m.read && m.read !== true && m.read !== 1 && m.read !== '1').length
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
    unreadCount.value = countUnread(list)
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
    unreadCount.value = countUnread(list)
    if (open.value) messages.value = list
  } catch {
    /* soft */
  }
}

function startPoll() {
  stopPoll()
  pollTimer = setInterval(() => {
    refreshBadge()
  }, 60000)
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function useInbox() {
  if (!bootstrapped) {
    bootstrapped = true
  }

  onMounted(() => {
    refreshBadge()
    startPoll()
  })
  onUnmounted(() => {
    /* 多实例共享 poll：仅在 AppLayout 挂载时用 ensureInboxPoll */
  })

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

/** 顶栏单例轮询（重复调用不会叠多个 timer） */
export function ensureInboxPoll() {
  refreshBadge()
  if (!pollTimer) startPoll()
  return { refreshBadge, stopPoll }
}
