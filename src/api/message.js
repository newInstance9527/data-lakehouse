/**
 * 站内消息（Snowy /sys/index/message）
 */
import { http } from './http.js'

/** 当前用户站内信列表（顶栏抽屉） */
export function fetchIndexMessageList(params = {}) {
  return http.get('/sys/index/message/list', {
    limit: params.limit,
  })
}

export function fetchIndexMessageDetail(id) {
  return http.get('/sys/index/message/detail', { id })
}

export function markAllMessagesRead() {
  return http.post('/sys/index/message/allMessageMarkRead', {})
}
