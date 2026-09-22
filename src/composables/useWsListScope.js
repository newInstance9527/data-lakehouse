/**
 * 列表「我的团队 / 查看全部」软过滤作用域。
 * team → 带当前 ws；all → 不传 ws（后端不过滤归属）。
 */
import { computed, ref, watch } from 'vue'
import { useSession } from '@/composables/useSession'

/**
 * @param {{ defaultScope?: 'team' | 'all', onChange?: (listWs: string | undefined) => void | Promise<void> }} [opts]
 */
export function useWsListScope(opts = {}) {
  const { currentWs } = useSession()
  const wsScope = ref(opts.defaultScope === 'all' ? 'all' : 'team')

  const listWs = computed(() =>
    wsScope.value === 'team' ? currentWs.value || 'default' : undefined,
  )

  const scopeLabel = computed(() =>
    wsScope.value === 'team' ? `我的团队 · ${currentWs.value || 'default'}` : '查看全部',
  )

  function setScope(scope) {
    wsScope.value = scope === 'all' ? 'all' : 'team'
  }

  if (typeof opts.onChange === 'function') {
    watch(
      listWs,
      (ws) => {
        opts.onChange(ws)
      },
      { flush: 'post' },
    )
  }

  return {
    currentWs,
    wsScope,
    listWs,
    scopeLabel,
    setScope,
    isTeam: computed(() => wsScope.value === 'team'),
  }
}
