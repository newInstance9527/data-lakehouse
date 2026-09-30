/**
 * 列表范围（空间优先定型）：
 * - 默认跟随 currentWs（切换即刷新）
 * - 「查看全部」→ scope=all（不传 ws；仅特权巡检，服务端硬门禁）
 * 资产目录列表默认 scope=workspace（本空间）。
 */
import { computed, ref, watch } from 'vue'
import { useSession } from '@/composables/useSession'

export function useWsListScope() {
  const { currentWs, user, canScopeAll } = useSession()
  /** true = 仅当前空间（默认）；false = 查看全部 */
  const mineOnly = ref(true)

  const canShowAll = computed(() => Boolean(canScopeAll.value))

  /** UI：勾选 = 查看全部（与 mineOnly 相反）；非特权不可开 */
  const showAll = computed({
    get: () => !mineOnly.value && canShowAll.value,
    set: (v) => {
      if (v && !canShowAll.value) {
        mineOnly.value = true
        return
      }
      mineOnly.value = !v
    },
  })

  const listWs = computed(() => (mineOnly.value || !canShowAll.value ? currentWs.value || 'default' : undefined))

  function listWsParams(extra = {}) {
    const ws = listWs.value
    if (ws) return { ...extra, ws, scope: 'workspace' }
    return { ...extra, scope: 'all' }
  }

  /**
   * 范围或 currentWs 变化时回调（查看全部时切换空间不刷列表）。
   * @param {() => void} reload
   */
  function watchListScope(reload) {
    watch(mineOnly, () => reload())
    watch(canShowAll, (ok) => {
      if (!ok) mineOnly.value = true
    })
    watch(currentWs, () => {
      if (mineOnly.value) reload()
    })
  }

  return { user, currentWs, mineOnly, showAll, canShowAll, listWs, listWsParams, watchListScope }
}
