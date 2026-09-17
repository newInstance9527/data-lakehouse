import { computed, ref } from 'vue'
import { STD_CODES, STD_FIELDS, STD_NAMING, parseCodeValues } from '@/data/standards'

const fields = ref(STD_FIELDS.map((f) => ({ ...f })))
const codes = ref(
  STD_CODES.map((c) => ({
    ...c,
    valueList: parseCodeValues(c.values),
  })),
)
const namings = ref(STD_NAMING.map((n) => ({ ...n })))

export function useStandards() {
  const fieldList = computed(() => fields.value)
  const codeList = computed(() => codes.value)
  const namingList = computed(() => namings.value)

  function addField(payload) {
    const row = {
      name: payload.name,
      type: payload.type || 'VARCHAR(64)',
      unit: payload.unit || '—',
      desc: payload.desc || '',
      domain: payload.domain || '通用',
      mapped: 0,
      status: 'ok',
    }
    const idx = fields.value.findIndex((f) => f.name === row.name)
    if (idx >= 0) {
      fields.value[idx] = { ...fields.value[idx], ...row }
      return fields.value[idx]
    }
    fields.value.unshift(row)
    return row
  }

  function addCode(payload) {
    const values = payload.values || ''
    const valueList = parseCodeValues(values)
    const row = {
      id: payload.id,
      name: payload.name,
      field: payload.field,
      values,
      valueList,
      count: valueList.length,
      mapped: payload.mapped || '—',
      status: 'ok',
    }
    const idx = codes.value.findIndex((c) => c.id === row.id)
    if (idx >= 0) {
      codes.value[idx] = { ...codes.value[idx], ...row }
      return codes.value[idx]
    }
    codes.value.unshift(row)
    return row
  }

  function addNaming(payload) {
    const row = {
      pattern: payload.pattern,
      example: payload.example || '—',
      layer: payload.layer || '其他',
      status: payload.status || 'ok',
    }
    const idx = namings.value.findIndex((n) => n.pattern === row.pattern && n.layer === row.layer)
    if (idx >= 0) {
      namings.value[idx] = { ...namings.value[idx], ...row }
      return namings.value[idx]
    }
    namings.value.unshift(row)
    return row
  }

  return {
    fields,
    codes,
    namings,
    fieldList,
    codeList,
    namingList,
    addField,
    addCode,
    addNaming,
  }
}
