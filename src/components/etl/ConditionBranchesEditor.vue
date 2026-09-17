<script setup>
import SearchSelect from '@/components/common/SearchSelect.vue'
import { fieldSelectOptions } from '@/utils/etlFields'

const OPS = [
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
  { value: '==', label: '=' },
  { value: '!=', label: '≠' },
  { value: 'in', label: 'IN' },
  { value: 'not_in', label: 'NOT IN' },
  { value: 'is_null', label: '为空' },
  { value: 'not_null', label: '非空' },
  { value: 'contains', label: '包含' },
  { value: 'custom', label: '自定义表达式' },
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

function badge(i, total) {
  if (i === 0) return 'IF'
  if (i === total - 1 && total > 1) return 'ELSE'
  return 'ELIF'
}

function badgeClass(i, total) {
  if (i === 0) return 'if'
  if (i === total - 1 && total > 1) return 'else'
  return 'elif'
}

function normalize(row) {
  return {
    label: row.label || '',
    expr: row.expr || '',
    targetPort: row.targetPort || 'out1',
    field: row.field || '',
    op: row.op || 'custom',
    value: row.value ?? '',
  }
}

function patch(i, key, val) {
  const next = rows().map((r, idx) => {
    if (idx !== i) return r
    const row = { ...normalize(r), [key]: val }
    if (key === 'field' || key === 'op' || key === 'value') {
      if (row.op !== 'custom') row.expr = buildExpr(row)
    }
    if (key === 'op' && val === 'custom' && !row.expr) {
      row.expr = row.field ? `${row.field} > 0` : '1=1'
    }
    return row
  })
  update(next)
}

function onExprEdit(i, val) {
  const next = rows().map((r, idx) => {
    if (idx !== i) return r
    return { ...normalize(r), expr: val, op: 'custom' }
  })
  update(next)
}

function buildExpr(row) {
  const f = row.field || 'field'
  const v = row.value
  switch (row.op) {
    case 'is_null':
      return `${f} IS NULL`
    case 'not_null':
      return `${f} IS NOT NULL`
    case 'in':
      return `${f} IN (${formatList(v)})`
    case 'not_in':
      return `${f} NOT IN (${formatList(v)})`
    case 'contains':
      return `${f} LIKE '%${escapeStr(v)}%'`
    case '==':
    case '!=':
    case '>':
    case '>=':
    case '<':
    case '<=':
      return `${f} ${row.op === '==' ? '=' : row.op} ${formatLiteral(v)}`
    default:
      return row.expr || '1=1'
  }
}

function formatLiteral(v) {
  if (v === '' || v == null) return "''"
  if (/^-?\d+(\.\d+)?$/.test(String(v).trim())) return String(v).trim()
  if (String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'false') return String(v).toLowerCase()
  return `'${escapeStr(v)}'`
}

function formatList(v) {
  return String(v || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(formatLiteral)
    .join(', ')
}

function escapeStr(v) {
  return String(v ?? '').replace(/'/g, "''")
}

function needsValue(op) {
  return op !== 'is_null' && op !== 'not_null' && op !== 'custom'
}

function addBranch() {
  const next = rows().length + 1
  update([
    ...rows().map(normalize),
    {
      label: next === 1 ? 'IF 分支' : `ELIF 分支${next}`,
      expr: '',
      targetPort: `out${next}`,
      field: props.fields[0]?.name || '',
      op: next === 1 ? '>' : 'custom',
      value: '',
    },
  ])
}

function addElse() {
  const list = rows().map(normalize)
  if (list.length && (list[list.length - 1].op === 'else' || list[list.length - 1].expr === '1=1' && list[list.length - 1].label?.includes('ELSE'))) {
    return
  }
  const next = list.length + 1
  update([
    ...list,
    {
      label: 'ELSE 默认',
      expr: '1=1',
      targetPort: `out${next}`,
      field: '',
      op: 'custom',
      value: '',
    },
  ])
}

function removeBranch(i) {
  update(rows().filter((_, idx) => idx !== i).map(normalize))
}

function move(i, dir) {
  const list = rows().map(normalize)
  const j = i + dir
  if (j < 0 || j >= list.length) return
  const tmp = list[i]
  list[i] = list[j]
  list[j] = tmp
  // 重排端口号提示
  update(
    list.map((r, idx) => ({
      ...r,
      targetPort: r.targetPort?.startsWith('out') ? `out${idx + 1}` : r.targetPort,
    })),
  )
}
</script>

<template>
  <div class="cbr">
    <div class="cbr-toolbar">
      <span class="form-label" style="margin: 0">分支明细（自上而下匹配）</span>
      <span style="flex: 1" />
      <button type="button" class="btn btn-sm" @click="addBranch">＋ IF/ELIF</button>
      <button type="button" class="btn btn-sm" @click="addElse">＋ ELSE</button>
    </div>
    <div v-if="!rows().length" class="form-hint">尚未配置分支，点击上方按钮添加</div>

    <div v-for="(row, i) in rows()" :key="i" class="cbr-card">
      <div class="cbr-head">
        <span class="cbr-badge" :class="badgeClass(i, rows().length)">{{ badge(i, rows().length) }}</span>
        <input
          class="input"
          :value="row.label"
          placeholder="分支标签"
          @input="patch(i, 'label', $event.target.value)"
        />
        <button type="button" class="btn btn-sm" title="上移" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button type="button" class="btn btn-sm" title="下移" :disabled="i === rows().length - 1" @click="move(i, 1)">↓</button>
        <button type="button" class="btn btn-sm" title="删除" @click="removeBranch(i)">✕</button>
      </div>

      <div class="cbr-builder">
        <SearchSelect
          :model-value="row.field || ''"
          :options="fieldSelectOptions(fields)"
          allow-custom
          placeholder="字段"
          @update:model-value="patch(i, 'field', $event)"
        />
        <select class="select" :value="row.op || 'custom'" @change="patch(i, 'op', $event.target.value)">
          <option v-for="o in OPS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <input
          v-if="needsValue(row.op || 'custom')"
          class="input"
          :value="row.value"
          :placeholder="(row.op === 'in' || row.op === 'not_in') ? '值1,值2' : '比较值'"
          @input="patch(i, 'value', $event.target.value)"
        />
      </div>

      <label class="form-field">
        <span class="form-label">条件表达式</span>
        <input
          class="input mono"
          :value="row.expr"
          placeholder="amount > 1000"
          @input="onExprEdit(i, $event.target.value)"
        />
      </label>
      <label class="form-field">
        <span class="form-label">出端口</span>
        <input class="input" :value="row.targetPort" placeholder="out1" @input="patch(i, 'targetPort', $event.target.value)" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.cbr {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cbr-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cbr-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  background: var(--bg-2, #f7f8fa);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cbr-head {
  display: grid;
  grid-template-columns: auto 1fr 28px 28px 28px;
  gap: 4px;
  align-items: center;
}
.cbr-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.02em;
}
.cbr-badge.if {
  background: rgba(24, 144, 255, 0.12);
  color: #1890ff;
}
.cbr-badge.elif {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}
.cbr-badge.else {
  background: rgba(140, 140, 140, 0.15);
  color: #595959;
}
.cbr-builder {
  display: grid;
  grid-template-columns: 1.2fr 0.7fr 1fr;
  gap: 6px;
  align-items: center;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
