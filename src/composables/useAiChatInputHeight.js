import { onBeforeUnmount, onMounted, watch } from 'vue'

/**
 * AI 对话输入框可拖高，并持久化高度（localStorage）。
 * 依赖 CSS：`resize: vertical` + min/max-height。
 */
export function useAiChatInputHeight(
  elRef,
  storageKey,
  { defaultPx = 96, minPx = 56, maxPx = 480 } = {},
) {
  let ro

  function clamp(h) {
    const n = Number(h)
    if (!Number.isFinite(n)) return defaultPx
    return Math.min(maxPx, Math.max(minPx, Math.round(n)))
  }

  function applyStored() {
    const el = elRef.value
    if (!el) return
    const stored = localStorage.getItem(storageKey)
    const h = stored != null && stored !== '' ? clamp(stored) : defaultPx
    el.style.height = `${h}px`
  }

  function persist() {
    const el = elRef.value
    if (!el) return
    const h = clamp(el.getBoundingClientRect().height)
    localStorage.setItem(storageKey, String(h))
  }

  onMounted(() => {
    applyStored()
    const el = elRef.value
    if (!el || typeof ResizeObserver === 'undefined') return
    ro = new ResizeObserver(() => persist())
    ro.observe(el)
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    ro = undefined
  })

  watch(elRef, (el, prev) => {
    if (el && el !== prev) applyStored()
  })

  return { applyStored }
}
