/**
 * 数据标准 API（对齐 /lh/standard）
 */
import { http } from './http.js'

const STD = '/lh/standard'

export function fetchStdOverview(ws) {
  return http.get(`${STD}/overview`, { ws })
}

export function fetchStdFields(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${STD}/fields`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    domain: filters.domain ?? filters.domainCode,
    status: filters.status,
    ws: filters.ws,
  })
}

export function upsertStdField(payload) {
  return http.post(`${STD}/fields`, {
    name: payload.name || payload.fieldName,
    fieldName: payload.fieldName || payload.name,
    type: payload.type || payload.dataType,
    dataType: payload.dataType || payload.type,
    unit: payload.unit,
    domain: payload.domain || payload.domainCode,
    domainCode: payload.domainCode || payload.domain,
    desc: payload.desc || payload.description,
    description: payload.description || payload.desc,
    ws: payload.ws,
    remark: payload.remark,
  })
}

export function fetchStdCodes(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${STD}/codes`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    status: filters.status,
    ws: filters.ws,
  })
}

export function upsertStdCode(payload) {
  const body = {
    id: payload.id || payload.codeSetId,
    codeSetId: payload.codeSetId || payload.id,
    name: payload.name,
    field: payload.field || payload.fieldName,
    fieldName: payload.fieldName || payload.field,
    values: payload.values,
    mapped: payload.mapped || payload.mappedSummary,
    mappedSummary: payload.mappedSummary || payload.mapped,
    ws: payload.ws,
    remark: payload.remark,
  }
  if (Array.isArray(payload.items) && payload.items.length) {
    body.items = payload.items.map((i) => ({
      code: i.code,
      label: i.label,
    }))
  }
  return http.post(`${STD}/codes`, body)
}

export function fetchStdNamings(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${STD}/namings`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    layer: filters.layer,
    ws: filters.ws,
  })
}

export function upsertStdNaming(payload) {
  return http.post(`${STD}/namings`, {
    pattern: payload.pattern,
    example: payload.example,
    layer: payload.layer,
    status: payload.status,
    ws: payload.ws,
    remark: payload.remark,
  })
}

export function deleteStdField(id, ws) {
  return http.post(`${STD}/fields/delete`, { id, ws })
}

export function deleteStdCode(id, ws) {
  return http.post(`${STD}/codes/delete`, { id, ws })
}

export function deleteStdNaming(id, ws) {
  return http.post(`${STD}/namings/delete`, { id, ws })
}

export function deleteStdMapping(id, ws) {
  return http.post(`${STD}/mappings/delete`, { id, ws })
}

export function fetchStdMappings(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${STD}/mappings`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    status: filters.status,
    dsId: filters.dsId,
    ws: filters.ws,
  })
}

export function upsertStdMapping(payload) {
  return http.post(`${STD}/mappings`, {
    src: payload.src,
    srcObject: payload.srcObject,
    srcField: payload.srcField,
    std: payload.std,
    stdFieldName: payload.stdFieldName,
    codeSetId: payload.codeSetId,
    table: payload.table || payload.targetTable,
    targetTable: payload.targetTable || payload.table,
    rule: payload.rule || payload.ruleText,
    ruleText: payload.ruleText || payload.rule,
    status: payload.status,
    dsId: payload.dsId,
    assetId: payload.assetId,
    etlJobId: payload.etlJobId,
    ws: payload.ws,
    remark: payload.remark,
  })
}

export function fetchStdDetects(filters = {}, { current = 1, size = 200 } = {}) {
  return http.get(`${STD}/detects`, {
    current,
    size,
    q: filters.q ?? filters.keyword,
    status: filters.status,
    ws: filters.ws,
  })
}

export function fetchStdMetaOptions() {
  return http.get(`${STD}/metaOptions`)
}
