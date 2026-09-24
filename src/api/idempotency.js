/**
 * 写操作幂等键：同 scope+指纹在 TTL 内复用，成功后释放以便有意再提交。
 */
const sticky = new Map()

function randomKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function fingerprintOf(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * @param {string} scope apply_ticket|release_create|release_publish|contract_change|contract_schema
 * @param {unknown} fingerprint 业务指纹（不含随机）
 * @param {{ ttlMs?: number }} [opts]
 */
export function stickyIdempotencyKey(scope, fingerprint, opts = {}) {
  const ttlMs = opts.ttlMs ?? 5 * 60 * 1000
  const slot = `${scope}:${fingerprintOf(fingerprint)}`
  const now = Date.now()
  const hit = sticky.get(slot)
  if (hit && hit.expires > now) return hit.key
  const key = randomKey()
  sticky.set(slot, { key, expires: now + ttlMs })
  return key
}

export function releaseIdempotencyKey(scope, fingerprint) {
  sticky.delete(`${scope}:${fingerprintOf(fingerprint)}`)
}

export function newIdempotencyKey() {
  return randomKey()
}
