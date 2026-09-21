<script setup>
/**
 * 即席 SQL · Monaco（@dvaji/vite-plugin-monaco-editor · Vite 8）
 * 加载失败时降级暗色 textarea
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  dark: { type: Boolean, default: true },
  minHeight: { type: Number, default: 220 },
})
const emit = defineEmits(['update:modelValue', 'run', 'save'])

const hostRef = ref(null)
const taRef = ref(null)
const fallback = ref(false)
let editor = null
let monacoApi = null
let suppress = false

async function mountEditor() {
  if (!hostRef.value) return
  try {
    monacoApi = await import('monaco-editor')
    editor = monacoApi.editor.create(hostRef.value, {
      value: props.modelValue || '',
      language: 'sql',
      theme: props.dark ? 'vs-dark' : 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineHeight: 22,
      tabSize: 2,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      padding: { top: 8, bottom: 8 },
    })
    editor.onDidChangeModelContent(() => {
      if (suppress) return
      emit('update:modelValue', editor.getValue())
    })
    editor.addCommand(monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.Enter, () => emit('run'))
    editor.addCommand(monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyS, () => emit('save'))
  } catch (e) {
    console.warn('Monaco 加载失败，降级 textarea', e)
    fallback.value = true
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (!editor || fallback.value) return
    if (editor.getValue() === v) return
    suppress = true
    editor.setValue(v || '')
    suppress = false
  },
)

onMounted(() => {
  mountEditor()
})

onBeforeUnmount(() => {
  editor?.dispose()
  editor = null
})

function onFallbackInput(e) {
  emit('update:modelValue', e.target.value)
}

function onFallbackKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = e.target
    const start = el.selectionStart
    const end = el.selectionEnd
    const v = props.modelValue || ''
    emit('update:modelValue', `${v.slice(0, start)}  ${v.slice(end)}`)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2
    })
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    emit('run')
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    emit('save')
  }
}

/** 有选区则返回选中 SQL，否则全文 */
function getSelectedOrAll() {
  if (fallback.value) {
    const el = taRef.value
    if (el && el.selectionStart !== el.selectionEnd) {
      return (props.modelValue || '').slice(el.selectionStart, el.selectionEnd)
    }
    return props.modelValue || ''
  }
  if (!editor) return props.modelValue || ''
  const model = editor.getModel()
  if (!model) return editor.getValue()
  const sel = editor.getSelection()
  if (sel && !sel.isEmpty()) {
    return model.getValueInRange(sel)
  }
  return editor.getValue()
}

function getValue() {
  if (fallback.value) return props.modelValue || ''
  return editor?.getValue() ?? props.modelValue ?? ''
}

/** 在光标处插入标识符（目录点列） */
function insertText(text) {
  if (!text) return
  if (fallback.value) {
    const el = taRef.value
    const v = props.modelValue || ''
    const start = el?.selectionStart ?? v.length
    const end = el?.selectionEnd ?? v.length
    emit('update:modelValue', `${v.slice(0, start)}${text}${v.slice(end)}`)
    return
  }
  if (!editor) return
  const sel = editor.getSelection()
  if (!sel) return
  editor.executeEdits('catalog-insert', [{ range: sel, text, forceMoveMarkers: true }])
  editor.focus()
}

defineExpose({ getSelectedOrAll, getValue, insertText })
</script>

<template>
  <div class="monaco-sql" :style="{ minHeight: `${minHeight}px` }">
    <textarea
      v-if="fallback"
      ref="taRef"
      class="sql-fallback"
      spellcheck="false"
      :value="modelValue"
      :style="{ minHeight: `${minHeight}px` }"
      @input="onFallbackInput"
      @keydown="onFallbackKeydown"
    />
    <div
      v-else
      ref="hostRef"
      class="monaco-host"
      :style="{ minHeight: `${minHeight}px`, height: `${minHeight}px` }"
    />
  </div>
</template>

<style scoped>
.monaco-sql {
  width: 100%;
  background: #0f1a2e;
}
.monaco-host {
  width: 100%;
}
.sql-fallback {
  display: block;
  width: 100%;
  min-height: inherit;
  padding: 14px 18px;
  background: #0f1a2e;
  color: #e6ebf5;
  border: none;
  outline: none;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  tab-size: 2;
  box-sizing: border-box;
}
</style>
