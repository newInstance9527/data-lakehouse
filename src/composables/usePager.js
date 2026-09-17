import { computed, ref, unref, watch } from 'vue'
import { DEFAULT_PAGE_SIZE } from '@/config/pagination'

/** 列表分页：source 为 Ref / Computed / 普通数组 */
export function usePager(source, { initialSize = DEFAULT_PAGE_SIZE, resetOnChange = true } = {}) {
  const page = ref(1)
  const pageSize = ref(initialSize)

  const total = computed(() => {
    const list = unref(source)
    return Array.isArray(list) ? list.length : 0
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  const paged = computed(() => {
    const list = unref(source) || []
    const start = (page.value - 1) * pageSize.value
    return list.slice(start, start + pageSize.value)
  })

  const pageNums = computed(() => {
    const tot = totalPages.value
    const cur = page.value
    const nums = []
    const push = (n) => {
      if (!nums.includes(n) && n >= 1 && n <= tot) nums.push(n)
    }
    push(1)
    for (let i = cur - 1; i <= cur + 1; i++) push(i)
    push(tot)
    return nums.sort((a, b) => a - b)
  })

  function goPage(p) {
    page.value = Math.min(totalPages.value, Math.max(1, p))
  }

  function resetPage() {
    page.value = 1
  }

  if (resetOnChange) {
    watch(pageSize, () => {
      page.value = 1
    })
    watch(total, (n) => {
      if (page.value > totalPages.value) page.value = totalPages.value
      if (n === 0) page.value = 1
    })
  }

  return { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage }
}
