<script setup>
import SearchSelect from '@/components/common/SearchSelect.vue'
import { fieldSelectOptions } from '@/utils/etlFields'

const FIELD_OPS = [
  { value: 'trim', label: '去首尾空白' },
  { value: 'lower', label: '转小写' },
  { value: 'upper', label: '转大写' },
  { value: 'nullFill', label: '空值填充' },
  { value: 'typeCast', label: '类型转换' },
  { value: 'lenTrim', label: '长度截断' },
  { value: 'mask', label: '脱敏' },
  { value: 'regex', label: '正则替换' },
  { value: 'formatEmail', label: '邮箱格式校验' },
  { value: 'formatPhone', label: '手机号格式校验' },
]

const MASK_RULES = [
  { value: 'mask_middle', label: '中间脱敏' },
  { value: 'mask_all', label: '全脱敏' },
  { value: 'hash', label: 'Hash' },
  { value: 'rand', label: '随机替换' },
]

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  fields: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

function rows() {
  return Array.isArray(props.modelValue) ? props.modelValue : []
}

function update(next) {
  emit('update:modelValue', next)
}

function patch(i, key, val) {
  update(rows().map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))
}

function toggleOp(i, op) {
  const row = rows()[i] || {}
  const ops = Array.isArray(row.ops) ? [...row.ops] : []
  const next = ops.includes(op) ? ops.filter((x) => x !== op) : [...ops, op]
  patch(i, 'ops', next)
}

function addRow(field = '') {
  update([
    ...rows(),
    {
      field,
      ops: ['trim'],
      nullDefault: '',
      castType: '',
      lenMax: null,
      maskRule: '',
      regexPat: '',
      regexRep: '',
    },
  ])
}

function removeRow(i) {
  update(rows().filter((_, idx) => idx !== i))
}

function seedFromFields() {
  const existing = new Set(rows().map((r) => r.field))
  const add = (props.fields || [])
    .filter((f) => !existing.has(f.name))
    .slice(0, 8)
    .map((f) => ({
      field: f.name,
      ops: ['trim'],
      nullDefault: '',
      castType: '',
      lenMax: null,
      maskRule: '',
      regexPat: '',
      regexRep: '',
    }))
  if (add.length) update([...rows(), ...add])
}
</script>

<template>
  <div class="cfr">
    <div class="cfr-toolbar">
      <span class="form-label" style="margin: 0">按字段配置清洗</span>
      <span style="flex: 1" />
      <button type="button" class="btn btn-sm" :disabled="!fields.length" @click="seedFromFields">从上游字段带入</button>
      <button type="button" class="btn btn-sm" @click="addRow()">＋ 字段</button>
    </div>
    <div v-if="!fields.length" class="form-hint">暂无上游字段：请先连线源节点</div>
    <div v-else-if="!rows().length" class="form-hint">尚未配置字段规则，可「从上游字段带入」或逐条添加</div>

    <div v-for="(row, i) in rows()" :key="i" class="cfr-card">
      <div class="cfr-head">
        <SearchSelect
          :model-value="row.field"
          :options="fieldSelectOptions(fields)"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索字段或自定义"
          @update:model-value="patch(i, 'field', $event)"
        />
        <button type="button" class="btn btn-sm" title="删除" @click="removeRow(i)">✕</button>
      </div>
      <div class="cfr-ops">
        <label v-for="op in FIELD_OPS" :key="op.value" class="chk-item">
          <input type="checkbox" :checked="(row.ops || []).includes(op.value)" @change="toggleOp(i, op.value)" />
          {{ op.label }}
        </label>
      </div>
      <div v-if="(row.ops || []).includes('nullFill')" class="form-field">
        <span class="form-label">空值默认</span>
        <input class="input" :value="row.nullDefault" @input="patch(i, 'nullDefault', $event.target.value)" />
      </div>
      <div v-if="(row.ops || []).includes('typeCast')" class="form-field">
        <span class="form-label">目标类型</span>
        <input class="input" :value="row.castType" @input="patch(i, 'castType', $event.target.value)" />
      </div>
      <div v-if="(row.ops || []).includes('lenTrim')" class="form-field">
        <span class="form-label">最大长度</span>
        <input class="input" type="number" :value="row.lenMax" @input="patch(i, 'lenMax', Number($event.target.value))" />
      </div>
      <div v-if="(row.ops || []).includes('mask')" class="form-field">
        <span class="form-label">脱敏方式</span>
        <select class="select" :value="row.maskRule" @change="patch(i, 'maskRule', $event.target.value)">
          <option v-for="m in MASK_RULES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
      <div v-if="(row.ops || []).includes('regex')" class="form-grid-2">
        <label class="form-field"><span class="form-label">正则</span><input class="input" :value="row.regexPat" @input="patch(i, 'regexPat', $event.target.value)" /></label>
        <label class="form-field"><span class="form-label">替换为</span><input class="input" :value="row.regexRep" @input="patch(i, 'regexRep', $event.target.value)" /></label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cfr {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cfr-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cfr-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  background: var(--bg-2, #f7f8fa);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cfr-head {
  display: grid;
  grid-template-columns: 1fr 28px;
  gap: 6px;
  align-items: center;
}
.cfr-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.chk-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
</style>
