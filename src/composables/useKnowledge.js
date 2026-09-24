/**
 * 知识库（对接 /lh/knowledge）
 */
import { computed, ref } from 'vue'
import {
  createKbEntry,
  deleteKbEntry,
  fetchKbEntries,
  fetchKbOverview,
  searchKnowledge,
  updateKbEntry,
  uploadKbEntry,
} from '@/api/ai'
import { resolveKbCat } from '@/data/knowledge'

const items = ref([])
const overview = ref(null)
const loading = ref(false)
const loaded = ref(false)
const lastError = ref(null)
let loadPromise = null

const CAT_ICON = {
  term: '🏷️',
  dict: '📖',
  practice: '💡',
  faq: '❓',
  manual: '📘',
}

export function normalizeKbEntry(row) {
  if (!row) return null
  const cat = row.cat || 'faq'
  let refs = row.refsJson
  if (typeof refs === 'string') {
    try {
      refs = JSON.parse(refs)
    } catch {
      refs = null
    }
  }
  const link = refs?.link || ''
  const to = link || ''
  const chunkCount = Number(
    row.chunkCount ?? (Array.isArray(row.chunks) ? row.chunks.length : row.chunks) ?? 0,
  )
  return {
    id: row.id,
    cat,
    icon: CAT_ICON[cat] || '📖',
    title: row.title,
    desc: row.body || row.desc || '',
    source: row.source || 'manual',
    chunks: chunkCount,
    embedModel: row.embedModelName || row.embedModelId || '',
    meta: buildMeta(row, chunkCount, refs),
    link: linkLabel(to),
    to,
    status: row.status || 'ready',
    citeCnt: row.citeCnt || 0,
    indexMode: row.indexMode,
    indexError: row.indexError,
    refs,
    scope: 'global',
    ws: row.ws,
  }
}

function buildMeta(row, chunks, refs) {
  const parts = []
  if (row.source === 'upload') parts.push(`文档 ${row.fileName || ''}`)
  else parts.push('手动录入')
  parts.push(`${chunks} 分片`)
  if (row.strategy) parts.push(row.strategy)
  parts.push(row.status === 'ready' ? '已索引' : row.status || '')
  if (refs?.metricCode) parts.push(`关联 ${refs.metricCode}`)
  else if (refs?.asset) parts.push(`关联 ${refs.asset}`)
  return parts.filter(Boolean).join(' · ')
}

function linkLabel(to) {
  if (!to) return ''
  if (to.includes('metric')) return '指标中心'
  if (to.includes('catalog')) return '资产目录'
  if (to.includes('apply')) return '申请审批'
  if (to.includes('quality')) return '数据质量'
  if (to.includes('security')) return '安全模块'
  if (to.includes('rootcause')) return '根因台'
  if (to.includes('aiassistant')) return 'AI 助手'
  return '查看'
}

export function useKnowledge() {
  function ensureLoaded() {
    if (loaded.value || loading.value || loadPromise) return loadPromise
    loadPromise = loadAll()
      .catch(() => {})
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  async function loadAll(filters = {}) {
    loading.value = true
    lastError.value = null
    try {
      const [page, ov] = await Promise.all([
        fetchKbEntries(filters, { current: 1, size: 500 }),
        fetchKbOverview(filters.ws, filters.scope).catch(() => null),
      ])
      items.value = (page?.records || []).map(normalizeKbEntry).filter(Boolean)
      overview.value = ov
      loaded.value = true
      return items.value
    } catch (e) {
      lastError.value = e
      console.error('[knowledge] load failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addEntry(payload) {
    const resolved = resolveKbCat(payload.cat)
    if (payload.source === 'upload' && payload.file) {
      const saved = await uploadKbEntry(payload.file, {
        title: payload.title,
        cat: resolved.cat,
        strategy: payload.strategy,
        chunkSize: payload.chunkSize,
        overlap: payload.overlap,
        separator: payload.separator === 'custom' ? payload.customSep : payload.separator,
        embedModelId: payload.embedModel,
        refsJson: payload.rel ? JSON.stringify({ note: payload.rel }) : undefined,
        ws: payload.ws,
        scope: 'workspace',
        entryId: payload.id || undefined,
      })
      const n = normalizeKbEntry(saved)
      if (payload.id) {
        const idx = items.value.findIndex((x) => x.id === payload.id)
        if (idx >= 0) items.value[idx] = n
        else items.value.unshift(n)
      } else {
        items.value.unshift(n)
      }
      return n
    }
    const saved = await createKbEntry({
      title: payload.title,
      cat: resolved.cat,
      body: payload.body,
      source: payload.source || 'manual',
      fileName: payload.fileName,
      strategy: payload.strategy,
      chunkSize: payload.chunkSize,
      overlap: payload.overlap,
      separator: payload.separator === 'custom' ? payload.customSep : payload.separator,
      embedModelId: payload.embedModel,
      refsJson: payload.rel ? JSON.stringify({ note: payload.rel }) : undefined,
      ws: payload.ws,
      scope: 'workspace',
    })
    const n = normalizeKbEntry(saved)
    items.value.unshift(n)
    return n
  }

  async function saveEntry(payload) {
    const resolved = resolveKbCat(payload.cat)
    if (payload.source === 'upload' && payload.file) {
      return addEntry(payload)
    }
    const body = {
      title: payload.title,
      cat: resolved.cat,
      body: payload.body,
      source: payload.source || 'manual',
      fileName: payload.fileName,
      strategy: payload.strategy,
      chunkSize: payload.chunkSize,
      overlap: payload.overlap,
      separator: payload.separator === 'custom' ? payload.customSep : payload.separator,
      embedModelId: payload.embedModel,
      refsJson: payload.rel ? JSON.stringify({ note: payload.rel }) : undefined,
      ws: payload.ws,
      scope: payload.scope || 'workspace',
    }
    if (payload.id) {
      const saved = await updateKbEntry(payload.id, body)
      const n = normalizeKbEntry(saved)
      const idx = items.value.findIndex((x) => x.id === payload.id)
      if (idx >= 0) items.value[idx] = n
      else items.value.unshift(n)
      return n
    }
    return addEntry(payload)
  }

  async function removeEntry(id) {
    await deleteKbEntry(id)
    items.value = items.value.filter((x) => x.id !== id)
  }

  async function search(query, opts = {}) {
    return searchKnowledge({
      query,
      topK: opts.topK || 5,
      ws: opts.ws,
      cats: opts.cats,
      scope: opts.scope,
      includePlatform: opts.includePlatform,
    })
  }

  return {
    items: computed(() => {
      ensureLoaded()
      return items.value
    }),
    overview: computed(() => overview.value),
    loading,
    loaded,
    lastError,
    loadAll,
    ensureLoaded,
    addEntry,
    saveEntry,
    removeEntry,
    search,
  }
}
