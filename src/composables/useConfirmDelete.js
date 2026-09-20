import { reactive } from 'vue'

const CONFIRM_PHRASE = 'delete'

const state = reactive({
  open: false,
  title: '确认删除',
  message: '',
  confirmLabel: '确认删除',
  busy: false,
  input: '',
  _resolve: null,
})

/**
 * 弹出「输入 delete 确认」对话框；返回 Promise<boolean>。
 * 需在布局中挂载 ConfirmDeleteModal。
 */
export function confirmDelete(opts = {}) {
  return new Promise((resolve) => {
    if (state._resolve) {
      state._resolve(false)
      state._resolve = null
    }
    state.title = opts.title || '确认删除'
    state.message = opts.message || ''
    state.confirmLabel = opts.confirmLabel || '确认删除'
    state.busy = false
    state.input = ''
    state.open = true
    state._resolve = resolve
  })
}

export function useConfirmDeleteState() {
  return state
}

export function isConfirmPhraseMatch(value) {
  return String(value ?? '').trim() === CONFIRM_PHRASE
}

export function settleConfirmDelete(ok) {
  const resolve = state._resolve
  state._resolve = null
  state.open = false
  state.busy = false
  state.input = ''
  resolve?.(!!ok)
}

export function setConfirmDeleteBusy(busy) {
  state.busy = !!busy
}

export { CONFIRM_PHRASE }
