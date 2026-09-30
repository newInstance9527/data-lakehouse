<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  /** 已选 value 数组 */
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  valueKey: { type: String, default: 'value' },
  labelKey: { type: String, default: 'label' },
  subKey: { type: String, default: '' },
  searchKeys: { type: [Array, String], default: () => [] },
  placeholder: { type: String, default: '搜索并选择' },
  disabled: { type: Boolean, default: false },
  emptyText: { type: String, default: '无匹配项' },
  max: { type: Number, default: 0 },
  /** 允许输入不在 options 中的自定义值 */
  allowCustom: { type: Boolean, default: false },
  customText: { type: String, default: '使用自定义' },
  searchPlaceholder: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const kw = ref('')
const rootEl = ref(null)
/** 外点收起后，吞掉同一次手势里 label 回传的 click，避免闪关又开 */
let suppressToggleUntil = 0

const selectedSet = computed(() => new Set((props.modelValue || []).map(String)))

const searchKeyList = computed(() => {
  if (Array.isArray(props.searchKeys)) return props.searchKeys
  if (typeof props.searchKeys === 'string' && props.searchKeys) {
    return props.searchKeys.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
})

const selectedOpts = computed(() =>
  (props.modelValue || []).map((v) => {
    const hit = props.options.find((o) => String(o[props.valueKey]) === String(v))
    if (hit) return hit
    return { [props.valueKey]: v, [props.labelKey]: v, __custom: true }
  }),
)

const filtered = computed(() => {
  const q = kw.value.trim().toLowerCase()
  const keys = [props.labelKey, props.subKey, props.valueKey, ...searchKeyList.value].filter(Boolean)
  let list = props.options
  if (q) {
    list = list.filter((o) => keys.some((k) => String(o[k] ?? '').toLowerCase().includes(q)))
  }
  return list
})

const customCandidate = computed(() => {
  if (!props.allowCustom) return ''
  const q = kw.value.trim()
  if (!q) return ''
  const exists =
    props.options.some((o) => String(o[props.valueKey]) === q) || selectedSet.value.has(q)
  return exists ? '' : q
})

const panelPlaceholder = computed(
  () =>
    props.searchPlaceholder ||
    (props.allowCustom ? '搜索或输入自定义后回车…' : '搜索…'),
)

watch(
  () => props.disabled,
  (v) => {
    if (v) open.value = false
  },
)

function onDocPointerDown(e) {
  if (!open.value) return
  const el = rootEl.value
  if (!el) return
  const t = e.target
  const path = typeof e.composedPath === 'function' ? e.composedPath() : []
  const inside = (path.length ? path.includes(el) : false) || el.contains(t)
  if (!inside) {
    open.value = false
    kw.value = ''
    suppressToggleUntil = Date.now() + 400
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
})

async function toggle() {
  if (props.disabled) return
  if (Date.now() < suppressToggleUntil) {
    suppressToggleUntil = 0
    return
  }
  open.value = !open.value
  if (open.value) {
    kw.value = ''
    await nextTick()
    rootEl.value?.querySelector('input')?.focus()
  }
}

function isSelected(opt) {
  return selectedSet.value.has(String(opt[props.valueKey]))
}

function setNext(next) {
  emit('update:modelValue', next)
  emit('change', next)
}

function toggleOpt(opt) {
  const v = String(opt[props.valueKey])
  const cur = [...(props.modelValue || [])].map(String)
  const i = cur.indexOf(v)
  let next
  if (i >= 0) {
    next = cur.filter((x) => x !== v)
  } else {
    if (props.max > 0 && cur.length >= props.max) return
    next = [...cur, v]
  }
  setNext(next)
  kw.value = ''
}

function pickCustom() {
  const v = customCandidate.value
  if (!v) return
  if (props.max > 0 && (props.modelValue || []).length >= props.max) return
  setNext([...(props.modelValue || []).map(String), v])
  kw.value = ''
}

function onSearchKeydown(e) {
  if (e.key === 'Enter' && props.allowCustom && customCandidate.value) {
    e.preventDefault()
    pickCustom()
  }
  if (e.key === 'Escape') open.value = false
}

function removeChip(v, e) {
  e?.stopPropagation()
  const next = (props.modelValue || []).map(String).filter((x) => x !== String(v))
  setNext(next)
}

function clearAll(e) {
  e.stopPropagation()
  setNext([])
  kw.value = ''
}

function chipLabel(opt) {
  if (!opt) return ''
  return opt[props.labelKey] || opt[props.valueKey]
}
</script>

<template>
  <div ref="rootEl" class="mss" :class="{ open, disabled }">
    <button type="button" class="mss-trigger input" :disabled="disabled" @click="toggle">
      <div class="mss-chips">
        <span v-if="!selectedOpts.length" class="mss-ph">{{ placeholder }}</span>
        <span
          v-for="opt in selectedOpts"
          :key="String(opt[valueKey])"
          class="mss-chip"
          @click.stop
        >
          {{ chipLabel(opt) }}
          <button
            v-if="!disabled"
            type="button"
            class="mss-chip-x"
            title="移除"
            @click="removeChip(opt[valueKey], $event)"
          >×</button>
        </span>
      </div>
      <span class="mss-actions">
        <span
          v-if="selectedOpts.length && !disabled"
          class="mss-clear"
          title="清空"
          @click="clearAll"
        >×</span>
        <span class="mss-caret">▾</span>
      </span>
    </button>

    <div v-if="open" class="mss-panel">
      <input
        v-model="kw"
        class="input mss-input"
        :placeholder="panelPlaceholder"
        @keydown="onSearchKeydown"
      />
      <div class="mss-list">
        <button
          v-for="opt in filtered"
          :key="String(opt[valueKey])"
          type="button"
          class="mss-option"
          :class="{ active: isSelected(opt) }"
          @click="toggleOpt(opt)"
        >
          <span class="mss-check">{{ isSelected(opt) ? '✓' : '' }}</span>
          <span class="mss-opt-body">
            <span class="mss-opt-main">{{ opt[labelKey] }}</span>
            <span v-if="subKey && opt[subKey]" class="mss-opt-sub">{{ opt[subKey] }}</span>
          </span>
        </button>
        <button
          v-if="customCandidate"
          type="button"
          class="mss-option mss-custom"
          @click="pickCustom"
        >
          <span class="mss-check">＋</span>
          <span class="mss-opt-body">
            <span class="mss-opt-main">{{ customText }}「{{ customCandidate }}」</span>
            <span class="mss-opt-sub">回车确认</span>
          </span>
        </button>
        <div v-if="!filtered.length && !customCandidate" class="mss-empty">{{ emptyText }}</div>
      </div>
      <div class="mss-foot">已选 {{ selectedOpts.length }} 项{{ max > 0 ? ` / 最多 ${max}` : '' }}</div>
    </div>
  </div>
</template>

<style scoped>
.mss {
  position: relative;
  width: 100%;
}
.mss.disabled {
  opacity: 0.6;
  pointer-events: none;
}
.mss-trigger {
  width: 100%;
  min-height: 36px;
  height: auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  background: var(--bg-1);
  padding-top: 6px;
  padding-bottom: 6px;
}
.mss-chips {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.mss-ph {
  color: var(--text-3);
  font-size: 13px;
}
.mss-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--primary-light);
  color: var(--primary);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.mss-chip-x {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0 0 0 2px;
}
.mss-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  color: var(--text-3);
  margin-top: 2px;
}
.mss-clear {
  width: 18px;
  height: 18px;
  line-height: 16px;
  text-align: center;
  border-radius: 50%;
  font-size: 14px;
}
.mss-clear:hover {
  background: var(--bg-2);
  color: var(--text-1);
}
.mss-panel {
  position: absolute;
  z-index: 30;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 26, 46, 0.12);
  overflow: hidden;
}
.mss-input {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  box-shadow: none;
}
.mss-input:focus {
  border-color: var(--border);
  box-shadow: none;
}
.mss-list {
  max-height: 220px;
  overflow: auto;
}
.mss-option {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
}
.mss-option:hover,
.mss-option.active {
  background: var(--primary-light, #e8f0ff);
}
.mss-custom {
  border-top: 1px solid var(--border);
  background: var(--bg-2, #f7f8fa);
}
.mss-custom .mss-opt-main {
  color: var(--primary);
}
.mss-check {
  width: 14px;
  color: var(--primary);
  font-weight: 700;
  flex-shrink: 0;
}
.mss-opt-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.mss-opt-main {
  color: var(--text-1);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.mss-opt-sub {
  color: var(--text-3);
  font-size: 11px;
}
.mss-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
}
.mss-foot {
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-3);
  background: var(--bg-2);
}
</style>
