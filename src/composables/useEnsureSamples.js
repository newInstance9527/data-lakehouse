/**
 * 列表成功但为空时，调 create API 写示例（同会话每 key 最多一次）。
 * API 业务错误应由调用方修通；本工具不回落 mock。
 */
import { useToast } from '@/composables/useToast'

const PREFIX = 'lh_sample_'

function storageKey(key) {
  return `${PREFIX}${key}`
}

export function sampleAlreadyTried(key) {
  try {
    return sessionStorage.getItem(storageKey(key)) === '1'
  } catch {
    return false
  }
}

export function markSampleTried(key) {
  try {
    sessionStorage.setItem(storageKey(key), '1')
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} key 模块唯一键
 * @param {() => boolean | Promise<boolean>} isEmpty
 * @param {() => Promise<unknown>} createFn 写入示例
 * @param {() => Promise<unknown>} [reloadFn] 写完后刷新
 * @returns {Promise<boolean>} 是否执行了 create
 */
export async function ensureOnce(key, isEmpty, createFn, reloadFn) {
  if (!key || sampleAlreadyTried(key)) return false
  const empty = await isEmpty()
  if (!empty) return false
  markSampleTried(key)
  try {
    await createFn()
    if (typeof reloadFn === 'function') await reloadFn()
    return true
  } catch (e) {
    const msg = e?.message || String(e)
    try {
      useToast().showToast(`示例写入失败：${msg}`, 'warning')
    } catch {
      console.warn('[ensureSamples]', key, msg)
    }
    return false
  }
}
