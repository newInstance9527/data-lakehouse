/**
 * 门户第一方埋点（appKey=lakehouse-portal）→ POST /lh/analytics/collect → Kafka。
 * 仅当 VITE_ANALYTICS_ENABLED=true 时启用；否则 no-op。
 */
import { Analytics } from '@lakehouse/web-analytics-sdk'
import { API_BASE } from '@/api/http'

const ENABLED = String(import.meta.env.VITE_ANALYTICS_ENABLED || '').toLowerCase() === 'true'
const APP_KEY = 'lakehouse-portal'
const ENDPOINT = `${API_BASE}/lh/analytics/collect`

const noop = {
  setUserId() {},
  track() {},
  getSessionId() {
    return ''
  },
  getDeviceId() {
    return ''
  },
  flush() {
    return Promise.resolve()
  },
  destroy() {},
}

let client = null

export function isPortalAnalyticsEnabled() {
  return ENABLED
}

export function getPortalAnalytics() {
  if (!ENABLED) return noop
  if (client) return client
  client = Analytics.init({
    appKey: APP_KEY,
    endpoint: ENDPOINT,
    appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0',
    debug: import.meta.env.DEV === true,
    batchSize: 8,
    flushIntervalMs: 4000,
  })
  return client
}

export function trackPageView(to) {
  if (!to) return
  getPortalAnalytics().track(
    'page_view',
    {
      navId: to.meta?.id || '',
      name: to.name ? String(to.name) : '',
    },
    to.fullPath || to.path || '/',
  )
}

export function trackFeature(feature, props = {}) {
  if (!feature) return
  getPortalAnalytics().track('feature_use', { feature, ...props })
}

export function bindAnalyticsUser(userId) {
  getPortalAnalytics().setUserId(userId || null)
}

export function clearAnalyticsUser() {
  getPortalAnalytics().setUserId(null)
}
