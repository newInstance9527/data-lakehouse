/**
 * 按引擎方言给 SQL 上色。标识符引号：Spark/Flink 反引号，Trino 双引号。
 */
import { engineFunctionList, engineKeywordList, engineTypeList } from './engineSqlDialect.js'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function span(cls, text) {
  return `<span class="${cls}">${escapeHtml(text)}</span>`
}

function escapeRe(word) {
  return String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
}

function alt(words) {
  return [...words].sort((a, b) => b.length - a.length).map(escapeRe).join('|')
}

function scanHighlight(input, rules) {
  const src = String(input || '')
  let i = 0
  let out = ''
  while (i < src.length) {
    const rest = src.slice(i)
    const prevWord = i > 0 && /[A-Za-z0-9_]/.test(src[i - 1])
    let hit = null
    for (const rule of rules) {
      if (rule.word && prevWord) continue
      rule.re.lastIndex = 0
      const m = rule.re.exec(rest)
      if (m && m.index === 0 && m[0]) {
        hit = { rule, m }
        break
      }
    }
    if (!hit) {
      out += escapeHtml(src[i])
      i += 1
      continue
    }
    out += hit.rule.render ? hit.rule.render(hit.m) : span(hit.rule.cls, hit.m[0])
    i += hit.m[0].length
  }
  return out
}

export function highlightEngineSql(input, dialect) {
  if (!input) return ''
  const quote = dialect?.quote || 'backtick'
  const stringRe = quote === 'double'
    ? /^(?:'(?:[^']|'')*')/
    : /^(?:'(?:[^']|'')*'|"(?:[^"]|"")*")/
  const identRe = quote === 'double' ? /^"(?:[^"]|"")*"/ : /^`[^`\n]+`/
  const kw = alt(engineKeywordList(dialect))
  const fn = alt(engineFunctionList(dialect))
  const types = alt(engineTypeList(dialect))
  return scanHighlight(input, [
    { re: /^\/\*[\s\S]*?\*\//, cls: 'tok-cmt' },
    { re: /^--[^\n]*/, cls: 'tok-cmt' },
    { re: stringRe, cls: 'tok-str' },
    { re: identRe, cls: 'tok-ident' },
    { re: new RegExp(`^(?:${fn})\\b(?=\\s*\\()`, 'i'), cls: 'tok-fn', word: true },
    { re: new RegExp(`^(?:${types})\\b`, 'i'), cls: 'tok-type', word: true },
    { re: new RegExp(`^(?:${kw})\\b`, 'i'), cls: 'tok-kw', word: true },
    { re: /^\d+(?:\.\d+)?\b/, cls: 'tok-num', word: true },
    { re: /^(?:<>|!=|<=|>=|\|\|)/, cls: 'tok-op' },
  ])
}
