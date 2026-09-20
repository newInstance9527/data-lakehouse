import { computed, ref } from 'vue'
import {
  deleteStdCode,
  deleteStdField,
  deleteStdMapping,
  deleteStdNaming,
  fetchStdCodes,
  fetchStdDetects,
  fetchStdFields,
  fetchStdMappings,
  fetchStdMetaOptions,
  fetchStdNamings,
  fetchStdOverview,
  upsertStdCode,
  upsertStdField,
  upsertStdMapping,
  upsertStdNaming,
} from '@/api/standard'
import { parseCodeValues } from '@/data/standards'

const fields = ref([])
const codes = ref([])
const namings = ref([])
const mappings = ref([])
const detects = ref([])
const overview = ref(null)
const metaOptions = ref(null)

const loaded = ref(false)
const loading = ref(false)
let loadError = null
let loadPromise = null

export function useStandards() {
  const fieldList = computed(() => {
    ensureLoaded()
    return fields.value
  })
  const codeList = computed(() => {
    ensureLoaded()
    return codes.value
  })
  const namingList = computed(() => {
    ensureLoaded()
    return namings.value
  })
  const mappingList = computed(() => {
    ensureLoaded()
    return mappings.value
  })
  const detectList = computed(() => {
    ensureLoaded()
    return detects.value
  })

  function ensureLoaded() {
    if (loaded.value || loading.value || loadPromise) return loadPromise
    loadPromise = loadAll()
      .catch(() => {})
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  async function loadAll() {
    loading.value = true
    loadError = null
    try {
      const [fieldPage, codePage, namingPage, mappingPage, detectPage, ov, meta] = await Promise.all([
        fetchStdFields({}, { current: 1, size: 500 }),
        fetchStdCodes({}, { current: 1, size: 500 }),
        fetchStdNamings({}, { current: 1, size: 500 }),
        fetchStdMappings({}, { current: 1, size: 500 }),
        fetchStdDetects({}, { current: 1, size: 500 }),
        fetchStdOverview().catch(() => null),
        fetchStdMetaOptions().catch(() => null),
      ])
      fields.value = (fieldPage?.records || []).map(normalizeField)
      codes.value = (codePage?.records || []).map(normalizeCode)
      namings.value = (namingPage?.records || []).map(normalizeNaming)
      mappings.value = (mappingPage?.records || []).map(normalizeMapping)
      detects.value = (detectPage?.records || []).map(normalizeDetect)
      overview.value = ov
      metaOptions.value = meta
      loaded.value = true
      return {
        fields: fields.value,
        codes: codes.value,
        namings: namings.value,
        mappings: mappings.value,
        detects: detects.value,
        overview: overview.value,
      }
    } catch (e) {
      loadError = e
      console.error('[standard] load failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function refreshOverview() {
    try {
      overview.value = await fetchStdOverview()
    } catch (e) {
      console.warn('[standard] overview failed', e)
    }
  }

  async function addField(payload) {
    const saved = await upsertStdField(payload)
    const row = normalizeField(saved)
    const idx = fields.value.findIndex((f) => f.name === row.name)
    if (idx >= 0) fields.value[idx] = { ...fields.value[idx], ...row }
    else fields.value.unshift(row)
    await refreshOverview()
    return row
  }

  async function addCode(payload) {
    const saved = await upsertStdCode(payload)
    const row = normalizeCode(saved)
    const idx = codes.value.findIndex((c) => c.id === row.id)
    if (idx >= 0) codes.value[idx] = { ...codes.value[idx], ...row }
    else codes.value.unshift(row)
    await refreshOverview()
    return row
  }

  async function addNaming(payload) {
    const saved = await upsertStdNaming(payload)
    const row = normalizeNaming(saved)
    const idx = namings.value.findIndex((n) => n.pattern === row.pattern && n.layer === row.layer)
    if (idx >= 0) namings.value[idx] = { ...namings.value[idx], ...row }
    else namings.value.unshift(row)
    return row
  }

  async function addMapping(payload) {
    const saved = await upsertStdMapping(payload)
    const row = normalizeMapping(saved)
    const idx = mappings.value.findIndex((m) => m.id && m.id === row.id)
    if (idx >= 0) mappings.value[idx] = { ...mappings.value[idx], ...row }
    else mappings.value.unshift(row)
    await refreshOverview()
    return row
  }

  async function removeField(row) {
    const id = row?.id || row?.name || row?.fieldName
    await deleteStdField(id)
    fields.value = fields.value.filter((f) => f.id !== row?.id && f.name !== row?.name)
    await refreshOverview()
  }

  async function removeCode(row) {
    const id = row?.pkId || row?.id || row?.codeSetId
    await deleteStdCode(id)
    codes.value = codes.value.filter((c) => c.pkId !== row?.pkId && c.id !== row?.id)
    await refreshOverview()
  }

  async function removeNaming(row) {
    if (!row?.id) throw new Error('缺少命名规范 id')
    await deleteStdNaming(row.id)
    namings.value = namings.value.filter((n) => n.id !== row.id)
  }

  async function removeMapping(row) {
    if (!row?.id) throw new Error('缺少映射 id')
    await deleteStdMapping(row.id)
    mappings.value = mappings.value.filter((m) => m.id !== row.id)
    await refreshOverview()
  }

  return {
    fields,
    codes,
    namings,
    mappings,
    detects,
    overview,
    metaOptions,
    fieldList,
    codeList,
    namingList,
    mappingList,
    detectList,
    loaded,
    loading,
    get loadError() {
      return loadError
    },
    ensureLoaded,
    loadAll,
    refreshOverview,
    addField,
    addCode,
    addNaming,
    addMapping,
    removeField,
    removeCode,
    removeNaming,
    removeMapping,
  }
}

export function normalizeField(vo) {
  if (!vo) return null
  return {
    id: vo.id,
    name: vo.name || vo.fieldName,
    fieldName: vo.fieldName || vo.name,
    type: vo.type || vo.dataType || '',
    dataType: vo.dataType || vo.type || '',
    unit: vo.unit || '—',
    desc: vo.desc || vo.description || '',
    description: vo.description || vo.desc || '',
    domain: vo.domain || vo.domainCode || '',
    domainCode: vo.domainCode || vo.domain || '',
    mapped: vo.mapped ?? 0,
    status: vo.status || vo.complianceStatus || 'ok',
    revision: vo.revision,
    updateTime: vo.updateTime,
  }
}

export function normalizeCode(vo) {
  if (!vo) return null
  const values = vo.values || ''
  const valueList =
    Array.isArray(vo.valueList) && vo.valueList.length
      ? vo.valueList
      : Array.isArray(vo.items) && vo.items.length
        ? vo.items.map((i) => ({ code: i.code, label: i.label }))
        : parseCodeValues(values)
  return {
    pkId: vo.pkId,
    id: vo.id || vo.codeSetId,
    codeSetId: vo.codeSetId || vo.id,
    name: vo.name || '',
    field: vo.field || vo.fieldName || '',
    fieldName: vo.fieldName || vo.field || '',
    values,
    valueList,
    count: vo.count ?? valueList.length,
    mapped: vo.mapped || vo.mappedSummary || '—',
    mappedSummary: vo.mappedSummary || vo.mapped || '',
    status: vo.status || vo.complianceStatus || 'ok',
    items: valueList,
    revision: vo.revision,
    updateTime: vo.updateTime,
  }
}

export function normalizeNaming(vo) {
  if (!vo) return null
  return {
    id: vo.id,
    pattern: vo.pattern || '',
    example: vo.example || '—',
    layer: vo.layer || '其他',
    status: vo.status || 'ok',
    revision: vo.revision,
    updateTime: vo.updateTime,
  }
}

export function normalizeMapping(vo) {
  if (!vo) return null
  return {
    id: vo.id,
    src: vo.src || `${vo.srcObject || ''}.${vo.srcField || ''}`.replace(/^\./, ''),
    srcObject: vo.srcObject,
    srcField: vo.srcField,
    std: vo.std || vo.stdFieldName || '',
    stdFieldName: vo.stdFieldName,
    codeSetId: vo.codeSetId,
    table: vo.table || vo.targetTable || '',
    targetTable: vo.targetTable || vo.table || '',
    rule: vo.rule || vo.ruleText || '',
    ruleText: vo.ruleText || vo.rule || '',
    status: vo.status || 'ok',
    dsId: vo.dsId,
    assetId: vo.assetId,
    etlJobId: vo.etlJobId,
    revision: vo.revision,
    updateTime: vo.updateTime,
  }
}

export function normalizeDetect(vo) {
  if (!vo) return null
  return {
    id: vo.id,
    table: vo.table || vo.tableName || '',
    tableName: vo.tableName || vo.table || '',
    field: vo.field || vo.fieldName || '',
    fieldName: vo.fieldName || vo.field || '',
    std: vo.std || vo.stdRef || '',
    stdRef: vo.stdRef || vo.std || '',
    check: vo.check || vo.checkType || '',
    checkType: vo.checkType || vo.check || '',
    result: vo.result || vo.resultText || '',
    resultText: vo.resultText || vo.result || '',
    status: vo.status || 'ok',
    assetId: vo.assetId,
    checkedAt: vo.checkedAt,
    runId: vo.runId,
  }
}
