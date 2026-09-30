/**
 * 协作空间：缺省跟当前会话，避免写入/列表落到 default 与当前空间错位。
 */
import { useSession } from '@/composables/useSession'

export function resolveWs(ws) {
  const explicit = ws != null && String(ws).trim() !== '' ? String(ws).trim() : ''
  if (explicit) return explicit
  try {
    const { currentWs } = useSession()
    return currentWs.value || 'default'
  } catch {
    return 'default'
  }
}
