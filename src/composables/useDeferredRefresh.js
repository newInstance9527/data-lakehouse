/**
 * 后台拉取到新内容时不立刻改界面，等用户确认后再应用。
 * 首次加载 / force=true（用户主动操作）立即写入。
 */
import { computed, ref, unref } from 'vue'

function stableStringify(v) {
  try {
    return JSON.stringify(v, (_, val) => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.keys(val)
          .sort()
          .reduce((acc, k) => {
            acc[k] = val[k]
            return acc
          }, {})
      }
      return val
    })
  } catch {
    return String(v)
  }
}

/**
 * @param {object} [opts]
 * @param {(a:any,b:any)=>boolean} [opts.equals] 自定义相等；默认 JSON 稳定序列化
 * @param {import('vue').Ref<boolean>|boolean} [opts.pauseWhen] 为 true 时只暂存不提示也可（仍设 hasPending）
 */
export function useDeferredRefresh(opts = {}) {
  const data = ref(null)
  const pending = ref(null)
  const hydrated = ref(false)
  const equals =
    typeof opts.equals === 'function'
      ? opts.equals
      : (a, b) => stableStringify(a) === stableStringify(b)

  const hasPending = computed(() => {
    if (pending.value == null) return false
    if (data.value == null) return hydrated.value
    return !equals(pending.value, data.value)
  })

  const paused = computed(() => !!unref(opts.pauseWhen))

  /**
   * @param {any} next
   * @param {{ force?: boolean }} [o] force=用户主动刷新/操作后，立即应用
   * @returns {'applied'|'pending'|'unchanged'}
   */
  function offer(next, o = {}) {
    const force = !!o.force
    if (!hydrated.value || force || data.value == null) {
      data.value = next
      pending.value = null
      hydrated.value = true
      return 'applied'
    }
    if (equals(data.value, next)) {
      pending.value = null
      return 'unchanged'
    }
    pending.value = next
    return 'pending'
  }

  function applyPending() {
    if (pending.value == null) return false
    data.value = pending.value
    pending.value = null
    return true
  }

  function discardPending() {
    pending.value = null
  }

  /** 丢弃展示与暂存（切空间等） */
  function reset() {
    data.value = null
    pending.value = null
    hydrated.value = false
  }

  return {
    data,
    pending,
    hydrated,
    hasPending,
    paused,
    offer,
    applyPending,
    discardPending,
    reset,
    fingerprint: stableStringify,
  }
}
