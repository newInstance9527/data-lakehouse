/**
 * 切换 currentWs：非成员时确认后带 confirmNonMember 重试。
 */
import { setWsCurrent } from '@/api/workspace'

export function isNonMemberConfirmError(err) {
  const msg = String(err?.message || err || '')
  return msg.includes('NON_MEMBER_CONFIRM')
}

/**
 * @param {string} wsCode
 * @param {{ confirm?: (msg: string) => boolean, label?: string }} [opts]
 */
export async function switchWsWithMemberGuard(wsCode, opts = {}) {
  const code = String(wsCode || '').trim()
  if (!code) throw new Error('缺少空间编码')
  try {
    return await setWsCurrent(code)
  } catch (e) {
    if (!isNonMemberConfirmError(e)) throw e
    const label = opts.label || code
    const ask =
      opts.confirm ||
      ((msg) => (typeof window !== 'undefined' ? window.confirm(msg) : false))
    const ok = ask(
      `你不是空间「${label}」的成员。\n切换后新建资产将默认归属该空间（成本记账可能误绑）。\n确定切换？`,
    )
    if (!ok) {
      const cancel = new Error('已取消切换')
      cancel.cancelled = true
      throw cancel
    }
    return await setWsCurrent(code, { confirmNonMember: true })
  }
}
