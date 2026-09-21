<script setup>
/**
 * 数据开发 SQL 编辑器：随引擎切换 Spark / Flink / Trino 的高亮、补全。
 * 补全只含关键字、内置函数和已登记 UDF，不含库表列。
 */
import { computed, nextTick, ref } from 'vue'
import { engineCompletions, resolveEngineDialect } from '@/utils/engineSqlDialect'
import { highlightEngineSql } from '@/utils/sqlHighlight'

const props = defineProps({
  modelValue: { type: String, default: '' },
  engine: { type: String, default: 'spark' },
  udfs: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'save', 'run', 'format'])

const taRef = ref(null)
const hlRef = ref(null)
const gutterRef = ref(null)
const suggestOpen = ref(false)
const suggestIndex = ref(0)
const suggestHits = ref([])
let suggestSpan = { start: 0, end: 0 }

const dialect = computed(() => resolveEngineDialect(props.engine))
const pool = computed(() => engineCompletions(dialect.value, props.udfs))

const lineCount = computed(() => Math.max(1, String(props.modelValue || '').split('\n').length))
const lineNos = computed(() => Array.from({ length: lineCount.value }, (_, i) => i + 1).join('\n'))

const editHtml = computed(() => {
  const raw = String(props.modelValue || '')
  if (!raw) return ''
  let html = highlightEngineSql(raw, dialect.value)
  if (raw.endsWith('\n')) html += '\u200b'
  return html
})

function onInput(e) {
  const value = e.target.value
  emit('update:modelValue', value)
  refreshSuggest(value, e.target.selectionStart, false)
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
    insertAtCaret('  ')
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
    e.preventDefault()
    suggestOpen.value = false
    emit('format')
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    suggestOpen.value = false
    emit('run')
    return
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    suggestOpen.value = false
    emit('save')
  }
}

function refreshSuggest(value, caret, force) {
  const left = String(value || '').slice(0, caret ?? 0)
  const m = left.match(/[A-Za-z_][\w]*$/)
  if (!m || (!force && m[0].length < 1)) {
    suggestOpen.value = false
    return
  }
  const q = m[0].toLowerCase()
  const hits = pool.value
    .filter((item) => item.caption.toLowerCase().startsWith(q) || item.caption.toLowerCase().includes(q))
    .sort((a, b) => {
      const ap = a.caption.toLowerCase().startsWith(q) ? 0 : 1
      const bp = b.caption.toLowerCase().startsWith(q) ? 0 : 1
      return ap - bp || a.caption.localeCompare(b.caption)
    })
    .slice(0, 8)
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
  nextTick(() => placeCaret(caret))
}

function insertAtCaret(text) {
  const el = taRef.value
  const v = props.modelValue || ''
  const start = el?.selectionStart ?? v.length
  const end = el?.selectionEnd ?? start
  emit('update:modelValue', `${v.slice(0, start)}${text}${v.slice(end)}`)
  nextTick(() => placeCaret(start + text.length))
}

function placeCaret(pos) {
  const el = taRef.value
  if (!el) return
  el.focus()
  el.selectionStart = el.selectionEnd = pos
}

function insertText(text) {
  if (!text) return
  insertAtCaret(text)
}

function onScroll(e) {
  const top = e.target.scrollTop
  const left = e.target.scrollLeft
  if (hlRef.value) {
    hlRef.value.scrollTop = top
    hlRef.value.scrollLeft = left
  }
  if (gutterRef.value) gutterRef.value.scrollTop = top
}

defineExpose({ insertText })
</script>

<template>
  <div class="dev-sql-editor">
    <div class="dev-sql-box">
      <pre ref="gutterRef" class="dev-sql-gutter" aria-hidden="true">{{ lineNos }}</pre>
      <div class="dev-sql-pane">
        <pre ref="hlRef" class="dev-sql-hl" aria-hidden="true" v-html="editHtml" />
        <textarea
          id="devSqlArea"
          ref="taRef"
          class="dev-sql-area"
          spellcheck="false"
          :value="modelValue"
          :placeholder="`${dialect.label} · ${dialect.quoteHint}`"
          @input="onInput"
          @keydown="onKeydown"
          @scroll="onScroll"
        />
        <ul v-if="suggestOpen" class="dev-sql-suggest" role="listbox">
          <li
            v-for="(item, i) in suggestHits"
            :key="item.kind + item.caption"
            role="option"
            :class="{ on: i === suggestIndex }"
            @mousedown.prevent="applySuggest(item)"
          >
            <span class="dev-sql-kind">{{ item.kind }}</span>
            <span>{{ item.caption }}</span>
          </li>
        </ul>
      </div>
    </div>
    <div class="dev-sql-tip">
      {{ dialect.label }} · {{ dialect.quoteHint }} · 补全关键字 / 函数 / 本引擎 UDF · Ctrl+Space
    </div>
  </div>
</template>

<style scoped>
.dev-sql-editor {
  display: flex;
  flex-direction: column;
  min-height: 320px;
  background: #0b1325;
}
.dev-sql-box {
  display: grid;
  grid-template-columns: auto 1fr;
  min-height: 300px;
  flex: 1;
}
.dev-sql-gutter {
  margin: 0;
  padding: 14px 8px 14px 12px;
  background: #08101e;
  color: #4a5a78;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.7;
  text-align: right;
  user-select: none;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 2.4em;
}
.dev-sql-pane {
  display: grid;
  position: relative;
  min-width: 0;
  min-height: 300px;
}
.dev-sql-hl,
.dev-sql-area {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  min-height: 300px;
  margin: 0;
  padding: 14px 16px;
  border: none;
  box-sizing: border-box;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.7;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  scrollbar-gutter: stable;
}
.dev-sql-hl {
  color: #c7d5ec;
  pointer-events: none;
  scrollbar-width: none;
}
.dev-sql-hl::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.dev-sql-area {
  display: block;
  resize: none;
  outline: none;
  background: transparent;
  color: transparent;
  caret-color: #e6ebf5;
  z-index: 1;
}
.dev-sql-area::placeholder {
  color: #6b7a99;
}
.dev-sql-area::selection {
  background: rgba(64, 150, 255, 0.35);
  color: transparent;
}
.dev-sql-suggest {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 8px;
  z-index: 3;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  max-height: 200px;
  overflow: auto;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.dev-sql-suggest li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  font-size: 12px;
  color: #e6ebf5;
  cursor: pointer;
}
.dev-sql-suggest li.on,
.dev-sql-suggest li:hover {
  background: rgba(79, 193, 255, 0.18);
}
.dev-sql-kind {
  flex: 0 0 auto;
  min-width: 2.4em;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #8aa0c2;
}
.dev-sql-tip {
  padding: 6px 14px 8px;
  font-size: 11px;
  color: #8aa0c2;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.dev-sql-hl :deep(.tok-kw) { color: #4fc1ff; }
.dev-sql-hl :deep(.tok-fn) { color: #d16dff; }
.dev-sql-hl :deep(.tok-type) { color: #4ec9b0; }
.dev-sql-hl :deep(.tok-str) { color: #ce9178; }
.dev-sql-hl :deep(.tok-num) { color: #b5cea8; }
.dev-sql-hl :deep(.tok-cmt) { color: #6a9955; }
.dev-sql-hl :deep(.tok-ident) { color: #e6c07b; }
.dev-sql-hl :deep(.tok-op) { color: #d4d4d4; }
</style>
