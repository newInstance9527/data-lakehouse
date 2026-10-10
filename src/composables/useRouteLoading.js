import { computed, ref } from 'vue'

/** 路由切换中（懒加载 chunk / beforeEach 异步）。隧道慢网时给侧栏与顶栏即时反馈。 */
const navigating = ref(false)
const pendingNavId = ref(null)
let seq = 0

export function useRouteLoading() {
  return {
    navigating: computed(() => navigating.value),
    pendingNavId: computed(() => pendingNavId.value),
  }
}

export function beginRouteLoading(navId) {
  seq += 1
  navigating.value = true
  pendingNavId.value = navId || null
  return seq
}

export function endRouteLoading(token) {
  if (token != null && token !== seq) return
  navigating.value = false
  pendingNavId.value = null
}

export function installRouteLoading(router) {
  let token = 0
  router.beforeEach((to, from) => {
    if (to.fullPath === from.fullPath) return true
    token = beginRouteLoading(to.meta?.id)
    return true
  })
  router.afterEach(() => {
    endRouteLoading(token)
  })
  router.onError(() => {
    endRouteLoading(token)
  })
}
