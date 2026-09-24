/** 知识库 · 表单枚举与分类标签（条目/KPI 走 /lh/knowledge） */

export const KB_FORM_CATS = [
  { value: 'FAQ', cat: 'faq', icon: '❓' },
  { value: '业务术语', cat: 'term', icon: '🏷️' },
  { value: '指标说明', cat: 'term', icon: '🏷️' },
  { value: '规范', cat: 'manual', icon: '📘' },
  { value: '最佳实践', cat: 'practice', icon: '💡' },
  { value: '案例', cat: 'practice', icon: '💡' },
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
