/** 知识库 · 表单枚举与分类标签（条目/KPI 走 /lh/knowledge） */

export const KB_FORM_CATS = [
  { value: 'FAQ', cat: 'faq', icon: '❓' },
  { value: '业务术语', cat: 'term', icon: '🏷️' },
  { value: '指标说明', cat: 'term', icon: '🏷️' },
  { value: '规范', cat: 'manual', icon: '📘' },
  { value: '最佳实践', cat: 'practice', icon: '💡' },
  { value: '案例', cat: 'practice', icon: '💡' },
  { value: '项目纪要', cat: 'minutes', icon: '📝' },
]

export const KB_CHUNK_STRATEGIES = [
  { value: 'fixed', label: '固定长度' },
  { value: 'paragraph', label: '按段落' },
  { value: 'heading', label: '按标题（Markdown）' },
]

export const KB_CHUNK_SEPARATORS = [
  { value: '\n\n', label: '空行 (\\n\\n)' },
  { value: '\n', label: '换行 (\\n)' },
  { value: ';', label: '分号 (;)' },
  { value: 'custom', label: '自定义' },
]

export const KB_EMBED_MODELS = [
  { value: 'bge-small-zh', label: 'BGE-small-zh（dev2 TEI）' },
  { value: 'text-embedding-3-small', label: 'text-embedding-3-small（别名 TEI / OpenAI）' },
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
  { value: 'bge-m3', label: 'BGE-M3（本地）' },
]

export const KB_UPLOAD_ACCEPT = '.pdf,.docx,.doc,.md,.txt,.html,.htm'
export const KB_UPLOAD_EXT = new Set(['pdf', 'docx', 'doc', 'md', 'txt', 'html', 'htm'])

/** 分类 Tab（count 由页面按真实条目计算） */
export const KB_CATS = [
  { id: 'all', name: '📚 全部' },
  { id: 'term', name: '🏷️ 业务术语' },
  { id: 'dict', name: '📖 数据字典' },
  { id: 'practice', name: '💡 最佳实践' },
  { id: 'faq', name: '❓ FAQ' },
  { id: 'manual', name: '📘 平台手册' },
  { id: 'minutes', name: '📝 项目纪要' },
]

export function estimateChunkCount(charCount, chunkSize = 500, overlap = 50) {
  const chars = Math.max(0, Number(charCount) || 0)
  if (!chars) return 0
  const size = Math.max(1, Number(chunkSize) || 500)
  const ov = Math.max(0, Math.min(size - 1, Number(overlap) || 0))
  const step = Math.max(1, size - ov)
  return Math.max(1, Math.ceil(chars / step))
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function estimateCharsFromFile(file) {
  if (!file) return 0
  const name = String(file.name || '').toLowerCase()
  const size = Number(file.size) || 0
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html') || name.endsWith('.htm')) {
    return size
  }
  return Math.max(200, Math.round(size * 0.45))
}

export function resolveKbCat(formCat) {
  const hit = KB_FORM_CATS.find((c) => c.value === formCat)
  return hit || KB_FORM_CATS[0]
}

/** 表单 cat 是否业务术语（Business Glossary SoT） */
export function isTermFormCat(formCat) {
  return resolveKbCat(formCat).cat === 'term'
}

/**
 * 组装术语/条目 refs_json。
 * term：metricCode / standardIds / assets / synonyms / broader / related / note / link
 */
export function buildKbRefsJson({
  isTerm,
  metricCode,
  standardIds,
  assets,
  synonyms,
  broader,
  related,
  note,
  rel,
} = {}) {
  if (isTerm) {
    const refs = {}
    const mc = String(metricCode || '').trim()
    if (mc) {
      refs.metricCode = mc
      refs.link = `/metric?code=${encodeURIComponent(mc)}`
    }
    const std = splitCsv(standardIds)
    if (std.length) refs.standardIds = std
    const as = splitCsv(assets)
    if (as.length) refs.assets = as
    const syn = splitCsv(synonyms)
    if (syn.length) refs.synonyms = syn
    const br = splitCsv(broader)
    if (br.length) refs.broader = br
    const relIds = splitCsv(related)
    if (relIds.length) refs.related = relIds
    const n = String(note || '').trim()
    if (n) refs.note = n
    return Object.keys(refs).length ? JSON.stringify(refs) : undefined
  }
  const text = String(rel || note || '').trim()
  return text ? JSON.stringify({ note: text, label: text }) : undefined
}

export function splitCsv(raw) {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x || '').trim()).filter(Boolean)
  }
  return String(raw || '')
    .split(/[,，;；\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export const TERM_EDGE_LABEL = {
  synonym: '同义',
  broader: '上位',
  related: '相关',
  implements_metric: '实现指标',
  maps_column: '映射列',
  governed_by_std: '受标准约束',
}
