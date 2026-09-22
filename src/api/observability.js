/**
 * 可观测用量 / 成本（§24.3 · group=ws）
 */
import { http } from './http'

const BASE = '/lh/observability'

/** 成本卡：默认 group=ws；可选 ws / range */
export function fetchObsCosts({ range = '30d', group = 'ws', ws } = {}) {
  return http.get(`${BASE}/costs`, { range, group, ws })
}

/** 用量聚合（与 costs 同源） */
export function fetchObsUsage({ range = '30d', group = 'ws', ws } = {}) {
  return http.get(`${BASE}/usage`, { range, group, ws })
}
