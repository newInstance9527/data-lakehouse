/**
 * 工作空间创建 · 初始成员用户选项（sys/user/page）
 */
import { shallowRef } from 'vue'
import { pageUsers } from '@/api/sys'

const options = shallowRef([])
let loading = null

export function workspaceUserOptions() {
  return options.value
}

export function workspaceUserById(id) {
  const key = String(id ?? '')
  return options.value.find((o) => String(o.value) === key) || null
}

/** 历史数据可能存展示名：尽量解析为用户 id；解析不到则原样返回（或 fallback） */
export function resolveWorkspaceUserId(raw, fallback = '') {
  const v = String(raw || '').trim()
  if (!v) return fallback || ''
  if (workspaceUserById(v)) return v
  const hit = options.value.find(
    (o) => o.account === v || o.name === v || o.label === v,
  )
  return hit?.value || v
}

/** 列表/详情展示：id → 姓名，否则回退 raw */
export function workspaceUserLabel(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  return workspaceUserById(v)?.label || v
}

export async function ensureWorkspaceUserOptions() {
  if (loading) return loading
  loading = (async () => {
    try {
      const page = await pageUsers({ current: 1, size: 200, userStatus: 'ENABLE' })
      const records = page?.records || []
      options.value = records
        .map((u) => {
          const id = u.id
          if (!id) return null
          const account = u.account || ''
          const name = u.name || account || String(id)
          return {
            value: String(id),
            label: name,
            sub: account && account !== name ? account : u.orgName || '',
            account,
            name,
          }
        })
        .filter(Boolean)
    } catch {
      options.value = []
    } finally {
      loading = null
    }
  })()
  return loading
}
