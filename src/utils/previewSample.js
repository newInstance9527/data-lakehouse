/**
 * 按字段 Schema 生成演示预览行（超级管理员解锁预览时使用；非引擎真查）
 */

function sampleForField(field, rowIdx) {
  const en = String(field?.enName || field?.name || '').toLowerCase()
  const dt = String(field?.dataType || '').toUpperCase()
  const n = rowIdx + 1

  if (field?.sample != null && field.sample !== '') {
    return Array.isArray(field.sample) ? field.sample[rowIdx % field.sample.length] : field.sample
  }
  if (field?.pk || /(^|_)id$/.test(en) || en.endsWith('_id')) {
    return 10000 + n * 17
  }
  if (/mobile|phone/.test(en)) return `138****${String(1000 + n).slice(-4)}`
  if (/name|买家|姓名/.test(en) || /real_name|buyer_name/.test(en)) {
    return ['张*', '李*', '王*'][rowIdx % 3]
  }
  if (/status|channel|method|type|code|gender/.test(en) || field?.unit === '码值') {
    return [0, 1, 2][rowIdx % 3]
  }
  if (/amt|amount|price|gmv|fee|money/.test(en) || /DECIMAL|NUMERIC|MONEY/.test(dt)) {
    return (99.5 + n * 12.3).toFixed(2)
  }
  if (/qty|count|cnt|num/.test(en) || /^(INT|BIGINT|SMALLINT|TINYINT)/.test(dt)) {
    return n * 3
  }
  if (/time|date|gmt_|_at$|^dt$/.test(en) || /DATE|TIME|TIMESTAMP/.test(dt)) {
    if (dt.includes('DATE') && !dt.includes('TIME')) return `2026-09-0${(n % 9) + 1}`
    return `2026-09-0${(n % 9) + 1} 10:${String(n).padStart(2, '0')}:00`
  }
  if (/bool|is_|flag|deleted/.test(en) || /BOOL/.test(dt)) return n % 2 === 0
  if (/mail|email/.test(en)) return `user${n}@example.com`
  if (dt.includes('CHAR') || dt.includes('TEXT') || dt.includes('STRING')) {
    return `demo_${en || 'col'}_${n}`
  }
  return `v${n}`
}

/**
 * @param {Array} fields schema 字段
 * @param {number} rows 行数
 * @param {number} maxCols 最多列
 */
export function buildPreviewRows(fields = [], rows = 5, maxCols = 8) {
  const cols = (fields || []).slice(0, maxCols)
  if (!cols.length) return { cols: [], rows: [] }
  const data = Array.from({ length: rows }, (_, i) => {
    const row = {}
    cols.forEach((c) => {
      const key = c.enName || c.name
      row[key] = sampleForField(c, i)
    })
    return row
  })
  return { cols, rows: data }
}
