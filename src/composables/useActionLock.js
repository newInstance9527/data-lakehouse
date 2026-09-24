import { computed, reactive } from 'vue'

/**
 * 按钮异步动作防重复点击：同一 key 在途时直接忽略后续触发。
 * @example
 * const { busy, run } = useActionLock()
 * await run('save', async () => { ... })
 * :disabled="busy('save')"
 */
export function useActionLock() {
  const locks = reactive({})

  function busy(key) {
    return !!locks[key]
  }

  const anyBusy = computed(() => Object.values(locks).some(Boolean))

  /**
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @returns {Promise<T|undefined>} 若已在途则返回 undefined
   */
  async function run(key, fn) {
    if (!key || locks[key]) return undefined
    locks[key] = true
    try {
      return await fn()
    } finally {
      locks[key] = false
    }
  }

  return { busy, anyBusy, run }
}
