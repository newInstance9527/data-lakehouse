/**
 * 指标修饰词 / 公共维度主数据（前端缓存）
 */
import { ref, shallowRef } from 'vue'
import {
  fetchMetricDimOptions,
  fetchMetricQualifierOptions,
  createMetricQualifier,
  createMetricDim,
  updateMetricQualifier,
  updateMetricDim,
  fetchMetricQualifiers,
  fetchMetricDims,
  disableMetricQualifier,
  disableMetricDim,
} from '@/api/metric'
import { resolveWs } from '@/utils/ws'

export const metricOntologyRev = ref(0)
const qualifierOpts = shallowRef([])
const dimOpts = shallowRef([])
let qPromise = null
let dPromise = null
let cachedWs = ''

function bump() {
  metricOntologyRev.value += 1
}

export function invalidateMetricOntology() {
  qualifierOpts.value = []
  dimOpts.value = []
  cachedWs = ''
  qPromise = null
  dPromise = null
  bump()
}

export async function ensureMetricQualifierOptions({ force = false, domain, table } = {}) {
  const ws = resolveWs()
  if (!force && qPromise && cachedWs === ws && qualifierOpts.value.length) {
    return qPromise
  }
  qPromise = (async () => {
    try {
      const rows = await fetchMetricQualifierOptions({ ws, domain, table })
      qualifierOpts.value = Array.isArray(rows) ? rows : []
      cachedWs = ws
      bump()
    } catch {
      qualifierOpts.value = []
      bump()
    }
    return qualifierOpts.value
  })()
  return qPromise
}

export async function ensureMetricDimOptions({ force = false, domain } = {}) {
  const ws = resolveWs()
  if (!force && dPromise && cachedWs === ws && dimOpts.value.length) {
    return dPromise
  }
  dPromise = (async () => {
    try {
      const rows = await fetchMetricDimOptions({ ws, domain })
      dimOpts.value = Array.isArray(rows) ? rows : []
      cachedWs = ws
      bump()
    } catch {
      dimOpts.value = []
      bump()
    }
    return dimOpts.value
  })()
  return dPromise
}

export function metricQualifierMasterOptions() {
  void metricOntologyRev.value
  return qualifierOpts.value
}

export function metricDimMasterOptions() {
  void metricOntologyRev.value
  return dimOpts.value
}

export async function addQualifierMaster(payload) {
  const row = await createMetricQualifier(payload)
  invalidateMetricOntology()
  await ensureMetricQualifierOptions({ force: true })
  return row
}

export async function addDimMaster(payload) {
  const row = await createMetricDim(payload)
  invalidateMetricOntology()
  await ensureMetricDimOptions({ force: true })
  return row
}

export async function saveQualifierMaster(code, payload) {
  const row = await updateMetricQualifier(code, payload)
  invalidateMetricOntology()
  await ensureMetricQualifierOptions({ force: true })
  return row
}

export async function saveDimMaster(code, payload) {
  const row = await updateMetricDim(code, payload)
  invalidateMetricOntology()
  await ensureMetricDimOptions({ force: true })
  return row
}

export async function loadQualifierAdminList(filters = {}) {
  return fetchMetricQualifiers(filters)
}

export async function loadDimAdminList(filters = {}) {
  return fetchMetricDims(filters)
}

export async function retireQualifier(code, ws) {
  const r = await disableMetricQualifier(code, ws)
  invalidateMetricOntology()
  return r
}

export async function retireDim(code, ws) {
  const r = await disableMetricDim(code, ws)
  invalidateMetricOntology()
  return r
}
