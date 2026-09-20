/**
 * 治理模块运维 API：连接参数（脱敏）+ 探活状态
 */
import { http } from './http.js'

const B = '/lh/module-ops'

export function fetchModuleOpsList(module = 'all') {
  return http.get(B, { module })
}

export function fetchModuleOpsDetail(module) {
  return http.get(`${B}/detail`, { module })
}
