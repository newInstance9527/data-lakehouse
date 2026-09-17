import { reactive } from 'vue'

const state = reactive({
  items: [],
})

let seq = 0

export function useToast() {
  function showToast(msg, type = 'info') {
    const id = ++seq
    state.items.push({ id, msg, type })
    setTimeout(() => {
      const i = state.items.findIndex((x) => x.id === id)
      if (i >= 0) state.items.splice(i, 1)
    }, 3200)
  }
  return { toasts: state.items, showToast }
}
