<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { formatGroovy, formatSql } from '@/utils/sqlFormat'
import { resolveSqlDialect } from '@/utils/sqlDialect'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  modelValue: { type: String, default: '' },
  rows: { type: Number, default: 10 },
  placeholder: { type: String, default: 'SELECT …' },
  label: { type: String, default: 'SQL' },
  /** 打开时是否直接进入编辑 */
  defaultEditing: { type: Boolean, default: false },
  /** 只读（强制预览） */
  readonly: { type: Boolean, default: false },
  /** 紧凑高度（弹窗内） */
  compact: { type: Boolean, default: false },
  hint: { type: String, default: '' },
  /** sql | groovy */
  language: { type: String, default: 'sql' },
  /** 数据源方言 id 或类型码，见 sqlDialect.js */
  dialect: { type: String, default: 'mysql' },
  /** { caption, insert }[]，表名/列名等 */
  suggests: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])
const { showToast } = useToast()

const editing = ref(props.defaultEditing && !props.readonly)
const taRef = ref(null)
const hlRef = ref(null)
const gutterEditRef = ref(null)
const suggestOpen = ref(false)
const suggestIndex = ref(0)
const suggestHits = ref([])
let suggestSpan = { start: 0, end: 0 }
/** 失焦后仍记住选区，供元数据树双击插入 */
const savedSel = ref({ start: 0, end: 0 })

const SQL_SUGGESTS = [
  { caption: 'SELECT', insert: 'SELECT' },
  { caption: 'FROM', insert: 'FROM' },
  { caption: 'WHERE', insert: 'WHERE' },
  { caption: 'JOIN', insert: 'JOIN' },
  { caption: 'LEFT JOIN', insert: 'LEFT JOIN' },
  { caption: 'GROUP BY', insert: 'GROUP BY' },
  { caption: 'ORDER BY', insert: 'ORDER BY' },
  { caption: 'LIMIT', insert: 'LIMIT' },
  { caption: 'AND', insert: 'AND' },
  { caption: 'foreach', insert: '<foreach open="(" close=")" collection="" separator="," item="item" index="index">#{item}</foreach>' },
  { caption: 'if', insert: '<if test="" ></if>' },
  { caption: 'where', insert: '<where></where>' },
  { caption: 'trim', insert: '<trim prefix="" suffix="" suffixesToOverride="" prefixesToOverride=""></trim>' },
]
const GROOVY_SUGGESTS = [
  { caption: 'def', insert: 'def ' },
  { caption: 'if', insert: 'if () {\n}' },
  { caption: 'else', insert: 'else {\n}' },
  { caption: 'return', insert: 'return ' },
  { caption: 'each', insert: '.each { item ->\n}' },
  { caption: 'import', insert: 'import ' },
  { caption: 'class', insert: 'class ' },
  { caption: 'try', insert: 'try {\n} catch (Exception e) {\n}' },
]

watch(
  () => props.readonly,
  (v) => {
    if (v) editing.value = false
  },
)

const lineCount = computed(() => Math.max(1, String(props.modelValue || '').split('\n').length))
const lineNos = computed(() =>
  Array.from({ length: lineCount.value }, (_, i) => i + 1).join('\n'),
)

const boxHeight = computed(() => {
  const r = props.compact ? Math.max(8, props.rows) : props.rows
  return r * 20 + 24
})

const isGroovy = computed(() => props.language === 'groovy')

const previewHtml = computed(() => {
  const raw = String(props.modelValue || '')
  if (!raw.trim()) return `<span class="tok-ph">${isGroovy.value ? '空脚本' : '空 SQL'}</span>`
  return paint(raw)
})

const editHtml = computed(() => {
  const raw = String(props.modelValue || '')
  if (!raw) return ''
  let html = paint(raw)
  if (raw.endsWith('\n')) html += '\u200b'
  return html
})

const sqlDialect = computed(() => resolveSqlDialect(props.dialect))

function paint(raw) {
  return isGroovy.value ? highlightGroovy(raw) : highlightSql(raw, sqlDialect.value)
}

function enterEdit() {
  if (props.readonly) return
  editing.value = true
  nextTick(() => {
    taRef.value?.focus()
  })
}

function leaveEdit() {
  rememberSel()
  editing.value = false
}

function rememberSel() {
  const el = taRef.value
  if (!el) return
  const len = String(props.modelValue || '').length
  const start = Number.isFinite(el.selectionStart) ? el.selectionStart : len
  const end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : start
  savedSel.value = {
    start: Math.max(0, Math.min(start, len)),
    end: Math.max(0, Math.min(end, len)),
  }
}

function placeCaret(pos) {
  const el = taRef.value
  if (!el) return
  el.focus()
  const max = el.value != null ? el.value.length : String(props.modelValue || '').length
  const p = Math.max(0, Math.min(pos, max))
  el.selectionStart = el.selectionEnd = p
  savedSel.value = { start: p, end: p }
}

/**
 * 在当前光标/选区插入文本；编辑器未聚焦时用上次记住的选区。
 * @param {string} text
 * @param {{ wrapSpace?: boolean }} [opts]
 */
function insertText(text, opts = {}) {
  if (text == null || text === '') return
  let chunk = String(text)
  if (props.readonly) return
  if (!editing.value) {
    editing.value = true
  }
  nextTick(() => {
    const el = taRef.value
    const v = String(props.modelValue || '')
    let start
    let end
    // 失焦后浏览器常把 selection 置 0，必须用 blur 时保存的选区
    if (el && document.activeElement === el) {
      start = el.selectionStart
      end = el.selectionEnd
    } else {
      start = savedSel.value.start
      end = savedSel.value.end
    }
    start = Math.max(0, Math.min(start ?? v.length, v.length))
    end = Math.max(0, Math.min(end ?? start, v.length))
    if (opts.wrapSpace) {
      const left = v.slice(0, start)
      const right = v.slice(end)
      const needL = left.length && !/\s$/.test(left)
      const needR = right.length && !/^\s/.test(right)
      chunk = `${needL ? ' ' : ''}${chunk}${needR ? ' ' : ''}`
    }
    const next = `${v.slice(0, start)}${chunk}${v.slice(end)}`
    emit('update:modelValue', next)
    const caret = start + chunk.length
    savedSel.value = { start: caret, end: caret }
    nextTick(() => placeCaret(caret))
  })
}

defineExpose({ insertText, enterEdit, focus: () => taRef.value?.focus() })

function onFormat() {
  const next = isGroovy.value ? formatGroovy(props.modelValue) : formatSql(props.modelValue)
  emit('update:modelValue', next)
  showToast(isGroovy.value ? '已格式化 Groovy' : '已格式化 SQL', 'success')
}

function onCopy() {
  const t = props.modelValue || ''
  if (!t) {
    showToast('暂无内容', 'warning')
    return
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).then(() => showToast('已复制 SQL', 'success'))
  } else {
    showToast(t, 'info')
  }
}

function onKeydown(e) {
  if (suggestOpen.value && suggestHits.value.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      suggestIndex.value = (suggestIndex.value + 1) % suggestHits.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      suggestIndex.value = (suggestIndex.value - 1 + suggestHits.value.length) % suggestHits.value.length
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      applySuggest(suggestHits.value[suggestIndex.value])
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      suggestOpen.value = false
      return
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
    e.preventDefault()
    refreshSuggest(e.target.value, e.target.selectionStart, true)
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = e.target
    const start = el.selectionStart
    const end = el.selectionEnd
    const v = props.modelValue || ''
    const next = `${v.slice(0, start)}  ${v.slice(end)}`
    emit('update:modelValue', next)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2
    })
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
    e.preventDefault()
    onFormat()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    leaveEdit()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    leaveEdit()
  }
}

const KW =
  'SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|FULL|OUTER|CROSS|ON|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|UNION|ALL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|WITH|AS|AND|OR|CASE|WHEN|THEN|ELSE|END|DISTINCT|ASC|DESC|NOT|IN|IS|NULL|TRUE|FALSE|BETWEEN|LIKE|EXISTS|OVER|PARTITION|FETCH|ONLY|USING|RECURSIVE'
const FN =
  'COUNT|SUM|AVG|MIN|MAX|IFNULL|COALESCE|NULLIF|CAST|CONVERT|CONCAT|SUBSTRING|SUBSTR|LENGTH|CHAR_LENGTH|TRIM|LTRIM|RTRIM|NOW|CURDATE|CURTIME|DATE_FORMAT|DATE_ADD|DATE_SUB|ROUND|FLOOR|CEIL|CEILING|ABS|UPPER|LOWER|NVL|NVL2|GROUP_CONCAT|ROW_NUMBER|RANK|DENSE_RANK|IF|GREATEST|LEAST|REPLACE|INSTR|POSITION|MOD|POWER|SQRT'
const TYPES =
  'INT|INTEGER|BIGINT|SMALLINT|TINYINT|VARCHAR|CHAR|NCHAR|NVARCHAR|TEXT|DATE|DATETIME|TIMESTAMP|TIME|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BOOLEAN|BOOL|BLOB|JSON|CLOB'
const TAGS = 'foreach|if|where|trim|set|choose|when|otherwise|bind'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function span(cls, text) {
  return `<span class="${cls}">${escapeHtml(text)}</span>`
}

/** 从左到右匹配，未命中的字符原样输出，避免占位符把关键字变成序号 */
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

function wordAlt(base, extra) {
  return [...String(base || '').split('|'), ...(extra || [])].filter(Boolean).join('|')
}

function highlightSql(input, dialect) {
  if (!input) return ''
  const quote = dialect?.quote || 'none'
  const stringRe = quote === 'double' || quote === 'bracket'
    ? /^(?:N'(?:[^']|'')*'|'(?:[^']|'')*')/i
    : /^(?:N'(?:[^']|'')*'|'(?:[^']|'')*'|"(?:[^"]|"")*")/i
  const identRe = quote === 'double'
    ? /^"(?:[^"]|"")*"/
    : quote === 'bracket'
      ? /^(?:\[[^\]]+\]|"(?:[^"]|"")*")/
      : quote === 'backtick'
        ? /^`[^`\n]+`/
        : null
  const kw = wordAlt(KW, dialect?.keywords)
  const fn = wordAlt(FN, dialect?.functions)
  const types = wordAlt(TYPES, dialect?.types)
  const rules = [
    { re: /^\/\*[\s\S]*?\*\//, cls: 'tok-cmt' },
    { re: /^--[^\n]*/, cls: 'tok-cmt' },
    { re: stringRe, cls: 'tok-str' },
    { re: /^(?:#\{[^}\n]+\}|\{\{[^}\n]+\}\})/, cls: 'tok-param' },
  ]
  if (identRe) rules.push({ re: identRe, cls: 'tok-ident' })
  rules.push(
    {
      re: new RegExp(`^</?(?:${TAGS})\\b`, 'i'),
      render(m) {
        const slash = m[0].startsWith('</') ? '/' : ''
        const name = m[0].slice(slash ? 2 : 1)
        return `${escapeHtml('<' + slash)}${span('tok-tag', name)}`
      },
    },
    { re: new RegExp(`^(?:${fn})\\b(?=\\s*\\()`, 'i'), cls: 'tok-fn', word: true },
    { re: new RegExp(`^(?:${types})\\b`, 'i'), cls: 'tok-type', word: true },
    { re: new RegExp(`^(?:${kw})\\b`, 'i'), cls: 'tok-kw', word: true },
    { re: /^\d+(?:\.\d+)?\b/, cls: 'tok-num', word: true },
    { re: /^(?:<>|!=|<=|>=|\|\||::|:=)/, cls: 'tok-op' },
    { re: /^[<>]/, cls: 'tok-op' },
  )
  return scanHighlight(input, rules)
}

const GKW =
  'as|assert|break|case|catch|class|const|continue|def|default|do|else|enum|extends|finally|for|goto|if|implements|import|in|instanceof|interface|new|package|return|super|switch|this|throw|throws|trait|try|while|true|false|null|void|public|private|protected|static|final|abstract|synchronized|native|transient|volatile|yield|var'

function highlightGroovy(input) {
  if (!input) return ''
  return scanHighlight(input, [
    { re: /^\/\*[\s\S]*?\*\//, cls: 'tok-cmt' },
    { re: /^\/\/[^\n]*/, cls: 'tok-cmt' },
    { re: /^(?:'''[\s\S]*?'''|"""[\s\S]*?""")/, cls: 'tok-str' },
    { re: /^(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/, cls: 'tok-str' },
    { re: /^#\{[^}\n]+\}/, cls: 'tok-param' },
    { re: /^@[A-Za-z_][\w.]*/, cls: 'tok-ann' },
    { re: new RegExp(`^(?:${GKW})\\b`, 'i'), cls: 'tok-kw', word: true },
    {
      re: /^\.[a-z_][\w]*/,
      render(m) {
        return `.${span('tok-fn', m[0].slice(1))}`
      },
    },
    { re: /^[A-Z][A-Za-z0-9_]*/, cls: 'tok-type', word: true },
    { re: /^[a-zA-Z_][\w]*(?=\s*\()/, cls: 'tok-fn', word: true },
    { re: /^\d+(?:\.\d+)?\b/, cls: 'tok-num', word: true },
  ])
}

function onAreaInput(e) {
  const value = e.target.value
  emit('update:modelValue', value)
  refreshSuggest(value, e.target.selectionStart, false)
}

function normalizeSuggest(s) {
  if (typeof s === 'string') return { caption: s, insert: s }
  return { caption: s.caption || s.insert, insert: s.insert || s.caption }
}

/** 越小越优先：前缀 / 列名段 / 包含 */
function suggestRank(item, q) {
  const cap = String(item.caption || '').toLowerCase()
  if (!cap) return -1
  if (cap === q) return 0
  if (cap.startsWith(q)) return 1
  const dot = cap.lastIndexOf('.')
  if (dot >= 0) {
    const col = cap.slice(dot + 1)
    if (col === q || col.startsWith(q)) return 2
  }
  if (cap.includes(q)) return 3
  const ins = String(item.insert || '').toLowerCase()
  if (ins.includes(q)) return 4
  return -1
}

function refreshSuggest(value, caret, force) {
  const left = String(value || '').slice(0, caret ?? 0)
  const m = left.match(/[A-Za-z_\u4e00-\u9fa5][\w.]*$/)
  if (!m || (!force && m[0].length < 1)) {
    suggestOpen.value = false
    return
  }
  const q = m[0].toLowerCase()
  const extra = (props.suggests || []).map(normalizeSuggest)
  const dialectHits = isGroovy.value
    ? []
    : [
        ...(sqlDialect.value.keywords || []).map((k) => ({ caption: k, insert: k })),
        ...(sqlDialect.value.completes || []),
      ]
  const builtins = isGroovy.value ? GROOVY_SUGGESTS : SQL_SUGGESTS
  // 表/列（extra）优先于关键字，避免被 SELECT/FROM 等占满前几项
  const scored = []
  const seen = new Set()
  for (const [group, meta] of [
    [extra, true],
    [dialectHits, false],
    [builtins, false],
  ]) {
    for (const item of group) {
      if (!item?.caption) continue
      const rank = suggestRank(item, q)
      if (rank < 0) continue
      const key = `${item.caption}\0${item.insert}`
      if (seen.has(key)) continue
      seen.add(key)
      scored.push({ item, rank, meta })
    }
  }
  scored.sort((a, b) => {
    if (a.meta !== b.meta) return a.meta ? -1 : 1
    if (a.rank !== b.rank) return a.rank - b.rank
    return String(a.item.caption).localeCompare(String(b.item.caption))
  })
  const hits = scored.slice(0, 12).map((x) => x.item)
  suggestSpan = { start: caret - m[0].length, end: caret }
  suggestHits.value = hits
  suggestIndex.value = 0
  suggestOpen.value = hits.length > 0
}

function applySuggest(item) {
  if (!item) return
  const v = props.modelValue || ''
  const next = `${v.slice(0, suggestSpan.start)}${item.insert}${v.slice(suggestSpan.end)}`
  emit('update:modelValue', next)
  suggestOpen.value = false
  const caret = suggestSpan.start + item.insert.length
  savedSel.value = { start: caret, end: caret }
  nextTick(() => {
    const el = taRef.value
    if (!el) return
    el.focus()
    el.selectionStart = el.selectionEnd = caret
  })
}

function onEditScroll(e) {
  const top = e.target.scrollTop
  const left = e.target.scrollLeft
  if (hlRef.value) {
    hlRef.value.scrollTop = top
    hlRef.value.scrollLeft = left
  }
  if (gutterEditRef.value) gutterEditRef.value.scrollTop = top
}
</script>

<template>
  <div class="sql-editor" :class="{ compact, editing, readonly, 'lang-groovy': isGroovy }">
    <div class="sql-toolbar">
      <div class="sql-toolbar-left">
        <span class="sql-label">{{ label }}</span>
        <span class="sql-mode-tag" :class="editing ? 'is-edit' : 'is-view'">
          {{ readonly ? '只读' : editing ? '编辑中' : '预览' }}
        </span>
        <span v-if="hint" class="sql-hint">{{ hint }}</span>
      </div>
      <div class="sql-toolbar-acts">
        <button type="button" class="btn btn-sm" @click="onCopy">复制</button>
        <button type="button" class="btn btn-sm" :disabled="!modelValue" @click="onFormat">格式化</button>
        <template v-if="!readonly">
          <button v-if="!editing" type="button" class="btn btn-sm btn-primary" @click="enterEdit">
            编辑
          </button>
          <button v-else type="button" class="btn btn-sm btn-primary" @click="leaveEdit">
            完成
          </button>
        </template>
      </div>
    </div>

    <!-- 预览模式 -->
    <div
      v-show="!editing"
      class="sql-view"
      role="button"
      tabindex="0"
      :title="readonly ? '' : '点击进入编辑'"
      @click="enterEdit"
      @keydown.enter.prevent="enterEdit"
    >
      <pre class="sql-gutter" aria-hidden="true">{{ lineNos }}</pre>
      <pre class="sql-code" v-html="previewHtml" />
    </div>

    <!-- 编辑模式：透明输入层叠在高亮层上，输入时即可看到分色 -->
    <div v-show="editing" class="sql-edit-wrap" :style="{ height: `${boxHeight}px` }">
      <pre ref="gutterEditRef" class="sql-gutter sql-gutter-edit" aria-hidden="true">{{ lineNos }}</pre>
      <div class="sql-edit-pane">
        <pre ref="hlRef" class="sql-hl" aria-hidden="true" v-html="editHtml" />
        <textarea
          ref="taRef"
          class="sql-area"
          :value="modelValue"
          :placeholder="placeholder"
          spellcheck="false"
          @input="onAreaInput"
          @keydown="onKeydown"
          @scroll="onEditScroll"
          @click="rememberSel"
          @keyup="rememberSel"
          @select="rememberSel"
          @blur="rememberSel"
        />
        <ul v-if="suggestOpen" class="sql-suggest">
          <li
            v-for="(item, i) in suggestHits"
            :key="item.caption + i"
            :class="{ on: i === suggestIndex }"
            @mousedown.prevent="applySuggest(item)"
          >
            {{ item.caption }}
          </li>
        </ul>
      </div>
    </div>

    <div v-if="editing" class="sql-edit-tip">输入表/列名可自动补全 · Ctrl+Space 强制补全 · Tab 缩进 · Ctrl+Shift+F 格式化 · Esc / Ctrl+Enter 完成 · 支持 &#123;&#123;param&#125;&#125; / #{param}</div>
  </div>
</template>

<style scoped>
.sql-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.sql-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.sql-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.sql-toolbar-acts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.sql-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.sql-mode-tag {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-3);
}
.sql-mode-tag.is-edit {
  background: var(--primary-light, #e6f4ff);
  border-color: transparent;
  color: var(--primary, #1677ff);
}
.sql-mode-tag.is-view {
  background: var(--bg-2);
}
.sql-hint {
  font-size: 11px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sql-view,
.sql-edit-wrap {
  display: grid;
  grid-template-columns: auto 1fr;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
  background: #0f1a2e;
  min-height: 140px;
}
.sql-edit-wrap {
  min-height: 0;
}
.compact .sql-view {
  min-height: 120px;
}
.sql-view {
  cursor: text;
}
.sql-view:hover {
  outline: 1px solid rgba(64, 150, 255, 0.35);
}
.sql-gutter {
  margin: 0;
  padding: 12px 8px 12px 12px;
  background: #0b1324;
  color: #4a5a78;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  text-align: right;
  user-select: none;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 2.2em;
}
.sql-code {
  margin: 0;
  padding: 12px 14px;
  color: #d4d4d4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  white-space: pre;
  overflow: auto;
  tab-size: 2;
}
.sql-gutter-edit {
  height: 100%;
  overflow: hidden;
}
.sql-edit-pane {
  display: grid;
  position: relative;
  min-width: 0;
  height: 100%;
}
.sql-hl,
.sql-area {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 12px 14px;
  border: none;
  box-sizing: border-box;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  scrollbar-gutter: stable;
}
.sql-hl {
  color: #d4d4d4;
  pointer-events: none;
  scrollbar-width: none;
  z-index: 0;
}
.sql-hl::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.sql-area {
  display: block;
  resize: none;
  outline: none;
  background: transparent;
  color: transparent;
  caret-color: #e6ebf5;
  z-index: 1;
}
.sql-area::placeholder {
  color: #6b7a99;
}
.sql-area::selection {
  background: rgba(64, 150, 255, 0.35);
  color: transparent;
}
.sql-suggest {
  position: absolute;
  left: 48px;
  right: 16px;
  bottom: 8px;
  z-index: 3;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  max-height: 180px;
  overflow: auto;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.sql-suggest li {
  padding: 4px 10px;
  font-size: 12px;
  color: #e6ebf5;
  cursor: pointer;
}
.sql-suggest li.on,
.sql-suggest li:hover {
  background: rgba(79, 193, 255, 0.18);
  color: #4fc1ff;
}
.sql-edit-tip {
  font-size: 11px;
  color: var(--text-3);
}

.sql-code :deep(.tok-kw),
.sql-hl :deep(.tok-kw) {
  color: #4fc1ff;
}
.sql-code :deep(.tok-fn),
.sql-hl :deep(.tok-fn) {
  color: #d16dff;
}
.sql-code :deep(.tok-type),
.sql-hl :deep(.tok-type) {
  color: #4ec9b0;
}
.sql-code :deep(.tok-str),
.sql-hl :deep(.tok-str) {
  color: #ce9178;
}
.sql-code :deep(.tok-num),
.sql-hl :deep(.tok-num) {
  color: #b5cea8;
}
.sql-code :deep(.tok-cmt),
.sql-hl :deep(.tok-cmt) {
  color: #6a9955;
}
.sql-code :deep(.tok-param),
.sql-hl :deep(.tok-param) {
  color: #dcdcaa;
}
.sql-code :deep(.tok-ident),
.sql-hl :deep(.tok-ident) {
  color: #e6c07b;
}
.sql-code :deep(.tok-tag),
.sql-hl :deep(.tok-tag) {
  color: #c586c0;
}
.sql-code :deep(.tok-op),
.sql-hl :deep(.tok-op) {
  color: #d4d4d4;
}
.sql-code :deep(.tok-ph) {
  color: #6b7a99;
}
.lang-groovy :deep(.tok-kw) {
  color: #cc7832;
}
.lang-groovy :deep(.tok-fn) {
  color: #ffc66d;
}
.lang-groovy :deep(.tok-str) {
  color: #6a8759;
}
.lang-groovy :deep(.tok-num) {
  color: #6897bb;
}
.lang-groovy :deep(.tok-cmt) {
  color: #808080;
}
.lang-groovy :deep(.tok-type) {
  color: #a9b7c6;
}
.lang-groovy :deep(.tok-ann) {
  color: #bbb529;
}
</style>
