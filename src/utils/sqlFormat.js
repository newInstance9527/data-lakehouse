/** 轻量 SQL 格式化（演示用，无外部依赖） */
const KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'FULL JOIN',
  'OUTER JOIN',
  'ON',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'UNION ALL',
  'UNION',
  'INSERT',
  'INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE',
  'WITH',
  'AS',
  'AND',
  'OR',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
]

const TAG_RE = /<(foreach|if|where|trim|set|choose|when|otherwise|bind)\b[^>]*>[\s\S]*?<\/\1>/gi

/** 先摘掉动态 SQL 标签、#{param} 和字符串，避免逗号/关键字格式化把标签拆碎 */
function holdFragments(source) {
  const bags = []
  const hold = (m) => {
    bags.push(m)
    return `__HOLD${bags.length - 1}__`
  }
  let s = source
  let guard = 0
  let prev
  do {
    prev = s
    TAG_RE.lastIndex = 0
    s = s.replace(TAG_RE, hold)
  } while (s !== prev && ++guard < 20)
  s = s.replace(/#\{[^}\n]+\}|\{\{[^}\n]+\}\}/g, hold)
  s = s.replace(/('([^']|'')*'|"([^"]|"")*")/g, hold)
  return { s, bags }
}

/**
 * @param {string[]} [extraClauses] 引擎方言额外断行短语，如 LATERAL VIEW / WATERMARK FOR
 */
export function formatSql(input, extraClauses) {
  if (!input || !String(input).trim()) return ''
  const extras = (Array.isArray(extraClauses) ? extraClauses : [])
    .map((c) => String(c || '').trim().toUpperCase())
    .filter(Boolean)
  const held = holdFragments(String(input).replace(/\r\n/g, '\n'))
  let s = held.s
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n+/g, '\n')
    .trim()

  const phrases = [...extras, ...KEYWORDS].sort((a, b) => b.length - a.length)
  phrases.forEach((kw) => {
    const re = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'gi')
    s = s.replace(re, `\n${kw.toUpperCase()}`)
  })

  s = s
    .replace(/,/g, ',\n  ')
    .replace(/\n+/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')

  // 简单缩进：FROM/WHERE/JOIN 等顶格，SELECT 后列缩进
  const extraAlt = extras.map((c) => c.replace(/ /g, '\\s+')).join('|')
  const majorRe = new RegExp(
    `^(?:SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|OUTER JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|UNION|UNION ALL|INSERT|UPDATE|DELETE|WITH|SET|VALUES${extraAlt ? `|${extraAlt}` : ''})\\b`,
  )
  const lines = s.split('\n')
  const out = []
  let indent = 0
  for (const line of lines) {
    const upper = line.toUpperCase()
    const isMajor = majorRe.test(upper)
    if (isMajor) indent = 0
    if (/^(AND|OR|ON|WHEN|THEN|ELSE)\b/.test(upper)) indent = 1
    out.push(`${'  '.repeat(indent)}${line}`)
    if (upper.startsWith('SELECT') || upper.startsWith('SET') || upper.startsWith('VALUES')) indent = 1
  }

  s = out.join('\n')
  s = s.replace(/__HOLD(\d+)__/g, (_, i) => held.bags[Number(i)])
  return s.trim() + '\n'
}

/** 按 Spark / Flink / Trino 的断行短语格式化，不改写已有标识符引号 */
export function formatEngineSql(input, dialect) {
  return formatSql(input, dialect?.formatClauses || [])
}

/** 按花括号缩进 Groovy，不把字符串和注释拆开 */
export function formatGroovy(input) {
  if (!input || !String(input).trim()) return ''
  const bags = []
  const hold = (m) => {
    bags.push(m)
    return `\uE000HLD${bags.length - 1}Z\uE001`
  }
  let s = String(input).replace(/\r\n/g, '\n')
  s = s.replace(/\/\*[\s\S]*?\*\//g, hold)
  s = s.replace(/('''[\s\S]*?'''|"""[\s\S]*?""")/g, hold)
  s = s.replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, hold)
  s = s.replace(/\/\/[^\n]*/g, hold)

  let indent = 0
  const out = []
  for (const raw of s.split('\n')) {
    const trimmed = raw.trim()
    if (!trimmed) {
      out.push('')
      continue
    }
    const closeFirst = /^[}\])]/.test(trimmed)
    if (closeFirst) indent = Math.max(0, indent - 1)
    out.push(`${'    '.repeat(indent)}${trimmed}`)
    const opens = (trimmed.match(/[{([]/g) || []).length
    const closes = (trimmed.match(/[})\]]/g) || []).length
    let delta = opens - closes
    if (closeFirst) delta += 1
    indent = Math.max(0, indent + delta)
  }
  s = out.join('\n').replace(/\uE000HLD(\d+)Z\uE001/g, (_, i) => bags[Number(i)])
  return s.trimEnd() + '\n'
}
