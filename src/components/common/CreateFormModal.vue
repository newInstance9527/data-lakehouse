<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { t, tt, useLocale } from '@/composables/useLocale'
import SearchSelect from '@/components/common/SearchSelect.vue'
import MultiSearchSelect from '@/components/common/MultiSearchSelect.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '新建' },
  intro: { type: String, default: '' },
  fields: { type: Array, default: () => [] },
  submitLabel: { type: String, default: '提交' },
  width: { type: String, default: '560px' },
  /** 打开时预填（编辑场景） */
  initialValues: { type: Object, default: null },
  /** page：嵌入路由页；modal：遮罩弹窗（默认） */
  mode: { type: String, default: 'modal' },
})

const emit = defineEmits(['close', 'submit'])
const isPageMode = computed(() => props.mode === 'page')
const { showToast } = useToast()
const { locale } = useLocale()
/** 打开/预填过程中跳过 kind/table 等副作用 watch，避免冲掉编辑回填 */
let hydrating = false

function applyInitialValues() {
  if (!props.initialValues || typeof props.initialValues !== 'object') return
  Object.entries(props.initialValues).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form[k] = v
  })
  props.fields.forEach((f) => {
    if (f.type === 'preset-text' && form[f.key]) {
      presetPick[f.key] = '__custom__'
    }
  })
}

const displayTitle = computed(() => {
  void locale.value
  return tt(props.title)
})
const displayIntro = computed(() => {
  void locale.value
  return props.intro ? tt(props.intro) : ''
})
const displaySubmit = computed(() => {
  void locale.value
  return tt(props.submitLabel)
})

function fieldLabel(f) {
  void locale.value
  return tt(f.label || '')
}
function fieldHint(f) {
  void locale.value
  const h = resolveHint(f)
  return h ? tt(h) : ''
}
function fieldPlaceholder(f, fallback = '') {
  void locale.value
  return tt(f.placeholder || fallback)
}
const form = reactive({})
const presetPick = reactive({})
/** 异步 optionsLoad 完成后递增，驱动 resolveOptions 重算 */
const optionsTick = ref(0)

function optionValue(o) {
  return typeof o === 'object' && o !== null ? o.value : o
}
function optionLabel(o) {
  return typeof o === 'object' && o !== null ? o.label ?? o.value : o
}

function isEmptyValue(v) {
  if (v === undefined || v === null) return true
  if (Array.isArray(v)) return v.length === 0
  return String(v).trim() === ''
}

function defaultForField(f) {
  if (f.default !== undefined) {
    if (f.type === 'multi-search-select') {
      return Array.isArray(f.default) ? [...f.default] : f.default ? [f.default] : []
    }
    return f.default
  }
  if (f.type === 'multi-search-select') return []
  if (f.type === 'number') return 0
  if ((f.type === 'select' || f.type === 'search-select') && (f.options || []).length) {
    return optionValue(f.options[0])
  }
  return ''
}

function fillTemplate(tpl, vars = {}) {
  let out = String(tpl ?? '')
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replaceAll(`{${k}}`, v || '')
  })
  return out
}

function matchWhen(cond) {
  if (!cond) return false
  return form[cond.key] === cond.value
}

function isHidden(f) {
  if (matchWhen(f.hideWhen)) return true
  if (f.showWhen && !matchWhen(f.showWhen)) return true
  if (Array.isArray(f.showWhenAny) && f.showWhenAny.length) {
    return !f.showWhenAny.some((cond) => matchWhen(cond))
  }
  return false
}

function resolveOptions(f) {
  void optionsTick.value
  if (typeof f.optionsResolver === 'function') {
    return f.optionsResolver(form) || []
  }
  if (f.optionsBy && f.optionsByKey) {
    const dep = form[f.optionsByKey]
    return f.optionsBy[dep] || f.options || []
  }
  return f.options || []
}

async function runOptionsLoad(f) {
  if (typeof f.optionsLoad !== 'function') return
  try {
    await f.optionsLoad(form)
  } catch (e) {
    console.warn('[CreateFormModal] optionsLoad failed', f.key, e)
  } finally {
    optionsTick.value += 1
  }
}

async function refreshAsyncOptions() {
  for (const f of props.fields) {
    if (isHidden(f)) continue
    if (typeof f.optionsLoad !== 'function') continue
    // 级联字段：依赖值未定时跳过
    if (f.optionsByKey && isEmptyValue(form[f.optionsByKey])) continue
    await runOptionsLoad(f)
  }
}

function syncDimToAtomOptions() {
  const dimDef = props.fields.find((f) => f.key === 'dim')
  if (!dimDef || isHidden(dimDef)) return
  const opts = resolveOptions(dimDef)
  const allow = new Set(opts.map((o) => (typeof o === 'object' ? o.value : o)))
  let cur = Array.isArray(form.dim) ? [...form.dim] : refsToArraySafe(form.dim)
  cur = cur.filter((k) => allow.has(k))
  if (!cur.length) {
    cur = opts.some((o) => optionValue(o) === 'dt')
      ? ['dt']
      : opts[0]
        ? [optionValue(opts[0])]
        : []
  }
  form.dim = cur
}

function refsToArraySafe(val) {
  if (Array.isArray(val)) return val.map(String).filter(Boolean)
  if (val == null || val === '') return []
  return String(val)
    .split(/[,+，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function resolvePresets(f) {
  let list = f.presets || []
  if (f.presetsBy && f.presetsByKey) {
    const dep = form[f.presetsByKey]
    list = f.presetsBy[dep] || f.presets || []
  }
  // 按作用范围过滤：字段级 / 表级
  if (f.filterByScope && form.scope) {
    const scoped = list.filter((p) => !p.scope || p.scope === form.scope)
    if (scoped.length) return scoped
  }
  return list
}

function interpolate(tpl, f) {
  const keys = f.interpolateKeys || []
  const vars = {}
  keys.forEach((k) => {
    const raw = form[k]
    if (Array.isArray(raw)) vars[k] = raw.filter(Boolean).join(', ')
    else vars[k] = raw || (k === 'field' ? 'order_id' : '')
  })
  // 默认支持 {field}
  if (!keys.includes('field') && String(tpl).includes('{field}')) {
    vars.field = form.field || 'order_id'
  }
  // 指标依赖：{atomRef} / {ref0}{ref1}{refs}
  const atom = form.atomRef || 'A-xxxx'
  const refs = Array.isArray(form.deriveRef)
    ? form.deriveRef.map(String).filter(Boolean)
    : String(form.deriveRef || '')
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
  vars.atomRef = vars.atomRef || atom
  vars.dim = vars.dim || form.dim || 'dt 按天'
  vars.time = vars.time || form.time || '日'
  vars.ref0 = refs[0] || 'M-xxxx'
  vars.ref1 = refs[1] || refs[0] || 'A-xxxx'
  vars.refs = refs.length ? refs.join(', ') : 'M-xxxx, A-xxxx'
  return fillTemplate(tpl, vars)
}

function applyPresetValue(f, preset) {
  if (!preset) {
    form[f.key] = f.default ?? ''
    return
  }
  form[f.key] = interpolate(preset.value ?? '', f)
}

function applyFirstPreset(f) {
  const presets = resolvePresets(f)
  const first = presets[0]
  if (first) {
    presetPick[f.key] = first.key || first.label
    applyPresetValue(f, first)
  } else {
    presetPick[f.key] = '__custom__'
    form[f.key] = f.default ?? ''
  }
}

function reapplyCurrentPreset(f) {
  if (presetPick[f.key] === '__custom__') return
  const hit = resolvePresets(f).find((p) => (p.key || p.label) === presetPick[f.key])
  if (hit) applyPresetValue(f, hit)
  else applyFirstPreset(f)
}

function resolveHint(f) {
  if (f.hintBy && f.hintByKey) {
    const dep = form[f.hintByKey]
    if (dep != null && f.hintBy[dep] != null) return f.hintBy[dep]
  }
  return f.hint || ''
}

function reapplyMetricFormulaPresets() {
  props.fields.forEach((f) => {
    if (f.key === 'formula' && f.type === 'preset-text' && !isHidden(f)) {
      reapplyCurrentPreset(f)
    }
  })
}

function defaultForSelect(f) {
  const opts = resolveOptions(f)
  if (f.default !== undefined && opts.some((o) => optionValue(o) === f.default)) return f.default
  return opts.length ? optionValue(opts[0]) : ''
}

function resetForm() {
  hydrating = true
  try {
    Object.keys(form).forEach((k) => delete form[k])
    Object.keys(presetPick).forEach((k) => delete presetPick[k])

    // 先写非依赖字段
    props.fields.forEach((f) => {
      if (f.type === 'preset-text') return
      if (f.optionsByKey) return
      form[f.key] = defaultForField(f)
    })

    // 再写级联 select（依赖已有值）
    props.fields.forEach((f) => {
      if ((f.type === 'select' || f.type === 'search-select') && f.optionsByKey) {
        form[f.key] = defaultForSelect(f)
      }
    })

    // 最后写 preset-text
    props.fields.forEach((f) => {
      if (f.type === 'preset-text') applyFirstPreset(f)
    })

    // 编辑预填覆盖
    applyInitialValues()

    // 按依赖指标校准统计粒度选项（仅衍生）
    if (form.kind === '衍生') syncDimToAtomOptions()
  } finally {
    hydrating = false
  }
}

watch(
  () => props.open,
  async (v) => {
    if (v) {
      resetForm()
      hydrating = true
      try {
        await refreshAsyncOptions()
        // 异步选项到位后再次套预填，避免级联默认值冲掉编辑值
        applyInitialValues()
        // 仅当预填值为空或不在选项中时，才回落到默认
        props.fields.forEach((f) => {
          if ((f.type === 'select' || f.type === 'search-select') && f.optionsByKey) {
            const opts = resolveOptions(f)
            const cur = form[f.key]
            if (cur !== undefined && cur !== null && cur !== '' && opts.some((o) => optionValue(o) === cur)) {
              return
            }
            if (!opts.some((o) => optionValue(o) === cur)) {
              form[f.key] = defaultForSelect(f)
            }
          }
        })
        applyInitialValues()
      } finally {
        hydrating = false
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.initialValues,
  async () => {
    if (props.open) {
      resetForm()
      hydrating = true
      try {
        await refreshAsyncOptions()
        applyInitialValues()
      } finally {
        hydrating = false
      }
    }
  },
)

onMounted(() => {
  // :key 重挂载且 open 已为 true 时，immediate watch 已处理；此处兜底空表单
  if (props.open && !Object.keys(form).length) {
    resetForm()
  }
})

/** 规则类型变化 → 刷新表达式预设 */
watch(
  () => form.rtype,
  () => {
    if (!props.open) return
    props.fields.forEach((f) => {
      if (f.type === 'preset-text' && f.presetsByKey === 'rtype') applyFirstPreset(f)
    })
  },
)

/** 表变化 → 刷新字段下拉，并重填表达式中的 {field} */
watch(
  () => form.table,
  async () => {
    if (!props.open || hydrating) return
    const fieldLoaders = props.fields.filter(
      (f) => f.optionsByKey === 'table' && typeof f.optionsLoad === 'function',
    )
    for (const f of fieldLoaders) {
      await runOptionsLoad(f)
    }
    props.fields.forEach((f) => {
      if ((f.type === 'select' || f.type === 'search-select') && f.optionsByKey === 'table') {
        const opts = resolveOptions(f)
        if (!opts.some((o) => optionValue(o) === form[f.key])) {
          form[f.key] = defaultForSelect(f)
        }
      }
      if (f.type === 'preset-text') reapplyCurrentPreset(f)
    })
  },
)

/** 字段变化 → 表达式模板插值 */
watch(
  () => form.field,
  () => {
    if (!props.open) return
    props.fields.forEach((f) => {
      if (f.type === 'preset-text') reapplyCurrentPreset(f)
    })
  },
)

/** 作用范围切换 → 刷新表达式预设列表 */
watch(
  () => form.scope,
  (scope) => {
    if (!props.open) return
    if (scope === 'table') {
      form.field = ''
    } else if (!form.field) {
      const fieldDef = props.fields.find((f) => f.key === 'field')
      if (fieldDef) form.field = defaultForSelect(fieldDef)
    }
    props.fields.forEach((f) => {
      if (f.type === 'preset-text') applyFirstPreset(f)
    })
  },
)

/** 指标类型切换 → 刷新级联默认值与单位提示 */
watch(
  () => form.kind,
  async (kind, prev) => {
    if (!props.open || !kind || hydrating) return
    // 初次赋值（undefined → 原子）不算用户切换，避免冲掉编辑预填
    if (prev === undefined || prev === null || prev === '') return
    if (kind === prev) return
    if (kind === '原子') {
      await refreshAsyncOptions()
      const tableDef = props.fields.find((f) => f.key === 'table')
      const fieldDef = props.fields.find((f) => f.key === 'field')
      if (tableDef && !form.table) form.table = defaultForSelect(tableDef)
      if (fieldDef) {
        const opts = resolveOptions(fieldDef)
        if (!opts.some((o) => optionValue(o) === form.field)) {
          form.field = defaultForSelect(fieldDef)
        }
      }
      if (!form.unit || form.unit === '元' || form.unit === '元/单' || form.unit === '%') form.unit = '个'
    } else if (kind === '衍生') {
      if (!form.atomRef) {
        const atomDef = props.fields.find((f) => f.key === 'atomRef')
        form.atomRef = atomDef ? defaultForField(atomDef) : ''
      }
      form.formula = ''
      if (!Array.isArray(form.qualifier)) form.qualifier = []
      syncDimToAtomOptions()
      if (!form.time) form.time = '近1天'
      if (!form.unit || form.unit === '个' || form.unit === '元/单') form.unit = '元'
    } else if (kind === '复合') {
      const deriveDef = props.fields.find((f) => f.key === 'deriveRef')
      if (!form.deriveRef?.length) {
        form.deriveRef = deriveDef ? defaultForField(deriveDef) : []
      }
      form.dim = []
      form.qualifier = []
      form.time = ''
      if (!form.unit || form.unit === '个') form.unit = '元/单'
      const formulaDef = props.fields.find((f) => f.key === 'formula')
      if (formulaDef?.type === 'preset-text') applyFirstPreset(formulaDef)
    }
  },
)

/** 依赖指标变化 → 复合刷新公式 ID；衍生校准粒度 */
watch(
  () => [form.atomRef, form.deriveRef],
  () => {
    if (!props.open) return
    if (form.kind === '复合') reapplyMetricFormulaPresets()
    if (form.kind === '衍生') syncDimToAtomOptions()
  },
  { deep: true },
)

function onPresetChange(f, pick) {
  presetPick[f.key] = pick
  if (pick === '__custom__') {
    if (!form[f.key]) form[f.key] = ''
    return
  }
  const hit = resolvePresets(f).find((p) => (p.key || p.label) === pick)
  if (hit) applyPresetValue(f, hit)
}

function isCustomExpr(f) {
  return presetPick[f.key] === '__custom__'
}

function close() {
  emit('close')
}

function submit() {
  for (const f of props.fields) {
    if (isHidden(f)) continue
    const need =
      f.required ||
      (f.requiredWhen && matchWhen(f.requiredWhen))
    if (!need) continue
    if (isEmptyValue(form[f.key])) {
      showToast(`${tt('请填写')}${tt(f.label || '')}`, 'warning')
      return
    }
    if (typeof f.validate === 'function') {
      const err = f.validate(form[f.key], form)
      if (err) {
        showToast(err, 'warning')
        return
      }
    }
  }
  const payload = {}
  props.fields.forEach((f) => {
    if (isHidden(f) && f.key === 'field') {
      payload[f.key] = ''
      return
    }
    const raw = form[f.key]
    if (Array.isArray(raw)) {
      payload[f.key] = raw.map((x) => String(x).trim()).filter(Boolean)
    } else {
      payload[f.key] = typeof raw === 'string' ? raw.trim() : raw
    }
  })
  emit('submit', payload)
  close()
}

const visibleFields = computed(() => props.fields.filter((f) => !isHidden(f)))
</script>

<template>
  <Teleport to="body" :disabled="isPageMode">
    <div
      v-if="open"
      :class="isPageMode ? 'cfm-page-root' : 'modal-mask'"
      @click.self="isPageMode ? undefined : close()"
    >
      <div class="modal" :class="{ 'modal-page': isPageMode }" :style="isPageMode ? undefined : { width }">
        <div class="modal-header">
          <div>
            <div class="modal-title">{{ displayTitle }}</div>
            <div v-if="displayIntro" class="modal-sub">{{ displayIntro }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="close">{{ isPageMode ? '返回' : '✕' }}</button>
        </div>
        <div class="modal-body">
          <div class="form-section">
            <div class="form-grid create-form-grid">
              <label
                v-for="f in visibleFields"
                :key="f.key"
                class="form-field"
                :class="{
                  wide:
                    f.type === 'textarea' ||
                    f.type === 'preset-text' ||
                    f.type === 'search-select' ||
                    f.type === 'multi-search-select' ||
                    f.wide,
                }"
              >
                <span class="form-label">
                  <span
                    v-if="f.required || (f.requiredWhen && matchWhen(f.requiredWhen))"
                    class="req"
                  >*</span>{{ fieldLabel(f) }}
                </span>

                <template v-if="f.type === 'preset-text'">
                  <select
                    class="select"
                    style="width: 100%; margin-bottom: 8px"
                    :value="presetPick[f.key]"
                    @change="onPresetChange(f, $event.target.value)"
                  >
                    <option
                      v-for="p in resolvePresets(f)"
                      :key="p.key || p.label"
                      :value="p.key || p.label"
                    >{{ tt(p.label) }}</option>
                    <option value="__custom__">{{ tt('自定义…') }}</option>
                  </select>
                  <textarea
                    v-model="form[f.key]"
                    class="input"
                    :readonly="!isCustomExpr(f)"
                    :placeholder="fieldPlaceholder(f, '选择预设或自定义表达式')"
                    rows="3"
                  />
                  <div v-if="!isCustomExpr(f)" class="preset-hint">
                    {{ tt(f.presetHint || '已选用预设（依赖指标 ID 已代入）；切到「自定义…」可编辑') }}
                  </div>
                </template>

                <textarea
                  v-else-if="f.type === 'textarea'"
                  v-model="form[f.key]"
                  class="input"
                  :placeholder="fieldPlaceholder(f)"
                  rows="3"
                />
                <select
                  v-else-if="f.type === 'select'"
                  v-model="form[f.key]"
                  class="select"
                  style="width: 100%"
                >
                  <option
                    v-for="o in resolveOptions(f)"
                    :key="optionValue(o)"
                    :value="optionValue(o)"
                  >
                    {{ tt(optionLabel(o)) }}
                  </option>
                </select>
                <SearchSelect
                  v-else-if="f.type === 'search-select'"
                  v-model="form[f.key]"
                  :options="resolveOptions(f)"
                  :placeholder="fieldPlaceholder(f, '搜索并选择')"
                  :sub-key="f.subKey || 'sub'"
                  :search-keys="f.searchKeys || ['name', 'caliber']"
                  :allow-custom="!!f.allowCustom"
                />
                <MultiSearchSelect
                  v-else-if="f.type === 'multi-search-select'"
                  v-model="form[f.key]"
                  :options="resolveOptions(f)"
                  :placeholder="fieldPlaceholder(f, '搜索并多选')"
                  :sub-key="f.subKey || 'sub'"
                  :search-keys="f.searchKeys || ['name', 'caliber', 'type']"
                  :max="f.max || 0"
                />
                <input
                  v-else
                  v-model="form[f.key]"
                  class="input"
                  style="width: 100%"
                  :type="f.type === 'number' ? 'number' : 'text'"
                  :placeholder="fieldPlaceholder(f)"
                />
                <div v-if="fieldHint(f)" class="field-hint">{{ fieldHint(f) }}</div>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" @click="close">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn-sm btn-primary" @click="submit">{{ displaySubmit }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cfm-page-root {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cfm-page-root .modal.modal-page {
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  max-height: none;
  box-shadow: none;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
}
.create-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
}
.create-form-grid .form-field.wide {
  grid-column: 1 / -1;
}
.create-form-grid .form-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-2);
}
.create-form-grid .req {
  color: var(--danger);
  margin-right: 2px;
}
.create-form-grid textarea.input {
  width: 100%;
  min-height: 72px;
  resize: vertical;
}
.create-form-grid textarea.input[readonly] {
  background: var(--bg-2);
  color: var(--text-2);
  cursor: default;
}
.preset-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-3);
}
.field-hint {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-3);
  white-space: pre-line;
}
@media (max-width: 560px) {
  .create-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
