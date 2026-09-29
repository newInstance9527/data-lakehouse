/** AI 助手 & 模型管理 · UI 芯片与格式化（列表走 /lh/ai） */

export const AI_QUICK_CHIPS = [
  { id: 'write_sql', label: '📝 生成 SQL' },
  { id: 'ask_data', label: '📊 问数' },
  { id: 'my_tables', label: '📋 我的表' },
  { id: 'manual', label: '📖 查知识' },
  { id: 'write_script', label: '🔧 生成 CDC 脚本' },
  { id: 'diagnose', label: '🩺 诊断告警' },
  { id: 'explain', label: '💡 解释表结构' },
  { id: 'optimize', label: '⚡ 优化此 SQL' },
]

/** 芯片点击 → 填入输入框的可编辑草稿（不自动发送） */
export const AI_QUICK_PROMPTS = {
  write_sql: '帮我写一个 SQL：查…',
  ask_data: '问数：…是多少？',
  my_tables: '列出我可查的表',
  write_script: '帮我写一个 CDC 同步脚本：从 … 同步到 …',
  manual: '查知识：怎么…？',
  diagnose: '帮我诊断告警：…',
  explain: '解释一下表结构：…',
  optimize: '优化这段 SQL：\n',
}

/** chipId → 后端 IntentRouter scene（发送时一并带上） */
export const AI_CHIP_SCENES = {
  write_sql: 'nl2sql',
  ask_data: 'ask_data',
  my_tables: 'list_assets',
  write_script: 'gen_script',
  manual: 'docqa',
  diagnose: 'diagnose',
  explain: 'explain',
  optimize: 'sql_opt',
}

export function formatUsageCalls(calls) {
  if (!calls) return '0'
  const n = Number(calls)
  if (!Number.isFinite(n)) return String(calls)
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}

/** 模型功能类别（与 gov_ai_model.kind 对齐） */
export const AI_MODEL_KIND_OPTIONS = [
  { value: 'chat', label: '对话模型' },
  { value: 'image', label: '图片模型' },
  { value: 'embed', label: '向量模型' },
]

export function modelKindLabel(kind) {
  const k = String(kind || 'chat').toLowerCase()
  return AI_MODEL_KIND_OPTIONS.find((o) => o.value === k)?.label || kind || '对话模型'
}

export function isChatModel(m) {
  return String(m?.kind || 'chat').toLowerCase() === 'chat'
}

export function isImageModel(m) {
  return String(m?.kind || '').toLowerCase() === 'image'
}

export function isEmbedModel(m) {
  const k = String(m?.kind || '').toLowerCase()
  return k === 'embed' || k === 'embedding'
}

export function isVisionCapable(m) {
  return isChatModel(m) && (m?.supportsVision === true || m?.supportsVision === 1)
}

/**
 * 对话选择器：默认只要 chat；带图时要求 supportsVision。
 * IMAGE / EMBED 不进入默认对话列表。
 */
export function filterChatPickerModels(list, { requireVision = false } = {}) {
  const rows = Array.isArray(list) ? list : []
  return rows.filter((m) => {
    if (m?.enabled === false || m?.enabled === 0) return false
    if (!isChatModel(m)) return false
    if (requireVision && !isVisionCapable(m)) return false
    return true
  })
}

export function chatModelOptionLabel(m) {
  const name = m?.name || m?.modelName || m?.id || '模型'
  return isVisionCapable(m) ? `${name} · 视觉` : name
}

/** 将计价单位 + 单价格式化为卡片展示文案 */
export function formatAiPrice(priceUnit, rate) {
  if (priceUnit === 'free') return '免费'
  const n = Number(rate)
  const num = Number.isFinite(n) ? String(n) : '0'
  if (priceUnit === 'usd_1m') return `$${num}/1M`
  if (priceUnit === 'cny_1m') return `¥${num}/1M`
  if (priceUnit === 'cny_1k') return `¥${num}/1k`
  return String(rate ?? '—')
}

export function maskApiKey(key) {
  const s = String(key || '').trim()
  if (!s) return ''
  if (s.length > 8) return `${s.slice(0, 3)}-****...${s.slice(-4)}（Vault）`
  return '****（Vault）'
}

export function modelStatusTag(m) {
  if (m.status === 'ok') return { text: '● 在线', cls: 'tag-green' }
  if (m.status === 'warn') return { text: '⚠ Key将过期', cls: 'tag-orange' }
  return { text: '○ 未启用', cls: 'tag-gray' }
}

export function routeStatusTag(status) {
  return status === 'ok'
    ? { text: '启用', cls: 'tag-green' }
    : { text: '停用', cls: 'tag-gray' }
}
