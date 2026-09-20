<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  /** option 的 value 字段名 */
  valueKey: { type: String, default: 'value' },
  /** option 的主展示字段 */
  labelKey: { type: String, default: 'label' },
  /** 副标题字段（可选） */
  subKey: { type: String, default: '' },
  /** 参与搜索的额外字段，逗号分隔或数组 */
  searchKeys: { type: [Array, String], default: () => [] },
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  emptyText: { type: String, default: '无匹配项' },
  /** 允许输入不在 options 中的自定义值 */
  allowCustom: { type: Boolean, default: false },
  customText: { type: String, default: '使用自定义' },
})

const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const kw = ref('')
const rootEl = ref(null)

const searchKeyList = computed(() => {
  if (Array.isArray(props.searchKeys)) return props.searchKeys
  if (typeof props.searchKeys === 'string' && props.searchKeys) {
    return props.searchKeys.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
})

const selected = computed(() =>
  props.options.find((o) => String(o[props.valueKey]) === String(props.modelValue)) || null,
)

const displayLabel = computed(() => {
  if (selected.value) {
    const main = selected.value[props.labelKey] || ''
    const sub = props.subKey && selected.value[props.subKey] ? ` · ${selected.value[props.subKey]}` : ''
    return main + sub
  }
  // 自定义值：直接展示 modelValue
  if (props.allowCustom && props.modelValue !== '' && props.modelValue != null) {
    return String(props.modelValue)
  }
  return ''
})

const filtered = computed(() => {
  const q = kw.value.trim().toLowerCase()
  if (!q) return props.options
  const keys = [props.labelKey, props.subKey, props.valueKey, ...searchKeyList.value].filter(Boolean)
  return props.options.filter((o) =>
    keys.some((k) => String(o[k] ?? '').toLowerCase().includes(q)),
  )
})

const customCandidate = computed(() => {
  if (!props.allowCustom) return ''
  const q = kw.value.trim()
  if (!q) return ''
  const exists = props.options.some((o) => String(o[props.valueKey]) === q)
  return exists ? '' : q
})

watch(
  () => props.modelValue,
  () => {
    if (!open.value) kw.value = ''
  },
)

watch(
  () => props.disabled,
  (v) => {
    if (v) open.value = false
  },
)

function onDocClick(e) {
  if (!rootEl.value?.contains(e.target)) {
    open.value = false
    kw.value = ''
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))

async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    kw.value = ''
    await nextTick()
    rootEl.value?.querySelector('input')?.focus()
  }
}

function pick(opt) {
  const v = opt[props.valueKey]
  emit('update:modelValue', v)
  emit('change', opt)
  open.value = false
  kw.value = ''
}

function pickCustom() {
  const v = customCandidate.value
  if (!v) return
  emit('update:modelValue', v)
  emit('change', { [props.valueKey]: v, [props.labelKey]: v, __custom: true })
  open.value = false
  kw.value = ''
}

function onOptionMouseDown(e) {
  // 防止外层 <label> 把点击回传到 trigger，导致选完又立刻展开
  e.preventDefault()
  e.stopPropagation()
}

function onSearchKeydown(e) {
  if (e.key === 'Enter' && props.allowCustom && customCandidate.value) {
    e.preventDefault()
    pickCustom()
  }
  if (e.key === 'Escape') open.value = false
}

function clear(e) {
  e.stopPropagation()
  emit('update:modelValue', '')
  emit('change', null)
  kw.value = ''
}
</script>

<template>
  <div ref="rootEl" class="search-select" :class="{ open, disabled }">
    <button
      type="button"
      class="search-select-trigger input"
      :disabled="disabled"
      @click="toggle"
    >
      <span v-if="displayLabel" class="search-select-value">{{ displayLabel }}</span>
      <span v-else class="search-select-ph">{{ placeholder }}</span>
      <span class="search-select-actions">
        <span
          v-if="modelValue && !disabled"
          class="search-select-clear"
          title="清除"
          @click="clear"
        >×</span>
        <span class="search-select-caret">▾</span>
      </span>
    </button>

    <div v-if="open" class="search-select-panel" @mousedown.stop>
      <input
        v-model="kw"
        class="input search-select-input"
        :placeholder="allowCustom ? '搜索或输入自定义…' : '搜索…'"
        @keydown="onSearchKeydown"
      />
      <div class="search-select-list">
        <button
          v-for="opt in filtered"
          :key="String(opt[valueKey])"
          type="button"
          class="search-select-option"
          :class="{ active: String(opt[valueKey]) === String(modelValue) }"
          @mousedown="onOptionMouseDown"
          @click="pick(opt)"
        >
          <span class="search-select-opt-main">{{ opt[labelKey] }}</span>
          <span v-if="subKey && opt[subKey]" class="search-select-opt-sub">{{ opt[subKey] }}</span>
        </button>
        <button
          v-if="customCandidate"
          type="button"
          class="search-select-option search-select-custom"
          @mousedown="onOptionMouseDown"
          @click="pickCustom"
        >
          <span class="search-select-opt-main">{{ customText }}「{{ customCandidate }}」</span>
          <span class="search-select-opt-sub">回车确认</span>
        </button>
        <div v-if="!filtered.length && !customCandidate" class="search-select-empty">{{ emptyText }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-select {
  position: relative;
  width: 100%;
}
.search-select.disabled {
  opacity: 0.6;
  pointer-events: none;
}
.search-select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  background: var(--bg-1);
}
.search-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-1);
  font-size: 13px;
}
.search-select-ph {
  flex: 1;
  color: var(--text-3);
  font-size: 13px;
}
.search-select-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: var(--text-3);
}
.search-select-clear {
  width: 18px;
  height: 18px;
  line-height: 16px;
  text-align: center;
  border-radius: 50%;
  font-size: 14px;
}
.search-select-clear:hover {
  background: var(--bg-2);
  color: var(--text-1);
}
.search-select-panel {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 26, 46, 0.12);
  overflow: hidden;
}
.search-select-input {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  box-shadow: none;
}
.search-select-input:focus {
  border-color: var(--border);
  box-shadow: none;
}
.search-select-list {
  max-height: 220px;
  overflow: auto;
}
.search-select-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
}
.search-select-option:hover,
.search-select-option.active {
  background: var(--primary-light, #e8f0ff);
}
.search-select-opt-main {
  color: var(--text-1);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.search-select-opt-sub {
  color: var(--text-3);
  font-size: 11px;
}
.search-select-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
}
.search-select-custom {
  border-top: 1px solid var(--border);
  background: var(--bg-2, #f7f8fa);
}
.search-select-custom .search-select-opt-main {
  color: var(--primary);
}
</style>
