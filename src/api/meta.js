import { http } from './http.js'
import { resolveWs } from '@/utils/ws'

export function fetchGoldenPath(ws) {
  return http.get('/lh/meta/golden-path', { ws: resolveWs(ws) })
}
