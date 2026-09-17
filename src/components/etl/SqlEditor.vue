<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { formatSql } from '@/utils/sqlFormat'
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
})
const emit = defineEmits(['update:modelValue'])
const { showToast } = useToast()

const editing = ref(props.defaultEditing && !props.readonly)
const taRef = ref(null)

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

const highlighted = computed(() => highlightSql(props.modelValue || props.placeholder || ''))

function enterEdit() {
  if (props.readonly) return
  editing.value = true
  nextTick(() => {
    taRef.value?.focus()
  })
}

function leaveEdit() {
  editing.value = false
}

function onFormat() {
  const next = formatSql(props.modelValue)
  emit('update:modelValue', next)
  showToast('已格式化 SQL', 'success')
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
  'SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|FULL|OUTER|ON|GROUP|ORDER|BY|HAVING|LIMIT|UNION|ALL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|WITH|AS|AND|OR|CASE|WHEN|THEN|ELSE|END|DISTINCT|ASC|DESC|NOT|IN|IS|NULL|TRUE|FALSE|BETWEEN|LIKE|EXISTS|OVER|PARTITION'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightSql(input) {
  if (!input) return '<span class="tok-ph">空 SQL</span>'
  let s = escapeHtml(input)
  const bags = []
  s = s.replace(/('([^']|'')*'|"([^"]|"")*")/g, (m) => {
    bags.push(`<span class="tok-str">${m}</span>`)
    return `\u0000${bags.length - 1}\u0000`
  })
  s = s.replace(/(\{\{[\w.]+\}\})/g, '<span class="tok-param">$1</span>')
  s = s.replace(/(--[^\n]*)/g, '<span class="tok-cmt">$1</span>')
  s = s.replace(new RegExp(`\\b(${KW})\\b`, 'gi'), (m) => `<span class="tok-kw">${m.toUpperCase()}</span>`)
  s = s.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="tok-num">$1</span>')
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => bags[Number(i)])
  return s
}
</script>

<template>
  <div class="sql-editor" :class="{ compact, editing, readonly }">
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
      <pre class="sql-code" v-html="highlighted" />
    </div>

    <!-- 编辑模式 -->
    <div v-show="editing" class="sql-edit-wrap">
      <pre class="sql-gutter" aria-hidden="true">{{ lineNos }}</pre>
      <textarea
        ref="taRef"
        class="sql-area"
        :rows="compact ? Math.max(6, rows) : rows"
        :value="modelValue"
        :placeholder="placeholder"
        spellcheck="false"
        @input="emit('update:modelValue', $event.target.value)"
        @keydown="onKeydown"
      />
    </div>

    <div v-if="editing" class="sql-edit-tip">Tab 缩进 · Esc / Ctrl+Enter 完成编辑 · 支持 &#123;&#123;param&#125;&#125; 占位</div>
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
.compact .sql-view,
.compact .sql-edit-wrap {
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
  line-height: 1.65;
  text-align: right;
  user-select: none;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 2.2em;
}
.sql-code {
  margin: 0;
  padding: 12px 14px;
  color: #e6ebf5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre;
  overflow: auto;
  tab-size: 2;
}
.sql-area {
  display: block;
  width: 100%;
  min-height: 140px;
  margin: 0;
  padding: 12px 14px;
  background: transparent;
  color: #e6ebf5;
  border: none;
  outline: none;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  tab-size: 2;
  box-sizing: border-box;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
}
.compact .sql-area {
  min-height: 120px;
}
.sql-edit-tip {
  font-size: 11px;
  color: var(--text-3);
}

.sql-code :deep(.tok-kw) {
  color: #7dcfff;
  font-weight: 600;
}
.sql-code :deep(.tok-str) {
  color: #9ece6a;
}
.sql-code :deep(.tok-num) {
  color: #ff9e64;
}
.sql-code :deep(.tok-cmt) {
  color: #565f89;
  font-style: italic;
}
.sql-code :deep(.tok-param) {
  color: #bb9af7;
  background: rgba(187, 154, 247, 0.12);
  border-radius: 3px;
  padding: 0 2px;
}
.sql-code :deep(.tok-ph) {
  color: #6b7a99;
}
</style>
