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

export function formatSql(input) {
  if (!input || !String(input).trim()) return ''
  let s = String(input)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()

  // 保护字符串字面量
  const strings = []
  s = s.replace(/('([^']|'')*'|"([^"]|"")*")/g, (m) => {
    strings.push(m)
    return `__STR${strings.length - 1}__`
  })

  KEYWORDS.sort((a, b) => b.length - a.length).forEach((kw) => {
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
  const lines = s.split('\n')
  const out = []
  let indent = 0
  for (const line of lines) {
    const upper = line.toUpperCase()
    const isMajor = /^(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|OUTER JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|UNION|UNION ALL|INSERT|UPDATE|DELETE|WITH|SET|VALUES)\b/.test(
      upper,
    )
    if (isMajor) indent = 0
    if (/^(AND|OR|ON|WHEN|THEN|ELSE)\b/.test(upper)) indent = 1
    out.push(`${'  '.repeat(indent)}${line}`)
    if (upper.startsWith('SELECT') || upper.startsWith('SET') || upper.startsWith('VALUES')) indent = 1
  }

  s = out.join('\n')
  s = s.replace(/__STR(\d+)__/g, (_, i) => strings[Number(i)])
  return s.trim() + '\n'
}
