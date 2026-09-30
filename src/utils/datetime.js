/**
 * 统一时间展示：yyyy-MM-dd HH:mm:ss
 */

function pad(n) {
  return String(n).padStart(2, '0')
}

function fromDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * @param {*} v Date / 时间戳 / ISO / 常见字符串
 * @param {{ empty?: string }} [opts]
 * @returns {string}
 */
export function formatDateTime(v, { empty = '—' } = {}) {
  if (v == null || v === '') return empty
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? empty : fromDate(v)
  }
  if (typeof v === 'number') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? empty : fromDate(d)
  }
  const raw = String(v).trim()
  if (!raw) return empty

  // 已是目标格式或可裁切的 ISO / 带毫秒
  let s = raw.replace('T', ' ').replace(/\.\d+/, '')
  s = s.replace(/Z$/i, '').replace(/[+-]\d{2}:\d{2}$/, '').trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return `${s}:00`
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`

  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return fromDate(d)
  return s.length >= 19 ? s.slice(0, 19) : s || empty
}
