import { reactive } from 'vue'

const state = reactive({
  items: [],
})

let seq = 0

export function useToast() {
  /**
   * @param {string} msg
   * @param {'info'|'success'|'warning'|'error'|'danger'} [type]
   * @param {{ duration?: number }} [opts]
   */
  function showToast(msg, type = 'info', opts = {}) {
    const id = ++seq
    const t = type === 'danger' ? 'error' : type
    const duration = opts.duration ?? (t === 'error' || t === 'warning' ? 6500 : 3200)
    state.items.push({ id, msg: String(msg ?? ''), type: t })
    setTimeout(() => {
      const i = state.items.findIndex((x) => x.id === id)
      if (i >= 0) state.items.splice(i, 1)
    }, duration)
  }
  return { toasts: state.items, showToast }
}
