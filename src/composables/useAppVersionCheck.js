import { onMounted, onUnmounted, ref } from 'vue'
import { fetchRemoteAssetFingerprint, getLocalAssetFingerprint } from '@/utils/appVersion'

const POLL_MS = 60_000
const FIRST_DELAY_MS = 8_000

/**
 * 发现新前端构建时置 pending；不自动 reload，由用户确认。
 */
export function useAppVersionCheck() {
  const updateAvailable = ref(false)
  let localFp = ''
  let timer = null
  let bootTimer = null
  let stopped = false

  async function checkOnce() {
    if (import.meta.env.DEV || stopped) return
    try {
      if (!localFp) localFp = getLocalAssetFingerprint()
      if (!localFp) return
      const remote = await fetchRemoteAssetFingerprint()
      if (remote && remote !== localFp) {
        updateAvailable.value = true
      }
    } catch {
      /* 忽略网络抖动 */
    }
  }

  function applyUpdate() {
    window.location.reload()
  }

  function dismissUpdate() {
    updateAvailable.value = false
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      checkOnce()
    }, POLL_MS * 5)
  }

  onMounted(() => {
    if (import.meta.env.DEV) return
    localFp = getLocalAssetFingerprint()
    bootTimer = setTimeout(() => {
      checkOnce()
      timer = setInterval(checkOnce, POLL_MS)
    }, FIRST_DELAY_MS)
  })

  onUnmounted(() => {
    stopped = true
    if (bootTimer) clearTimeout(bootTimer)
    if (timer) clearInterval(timer)
  })

  return { updateAvailable, applyUpdate, dismissUpdate }
}
