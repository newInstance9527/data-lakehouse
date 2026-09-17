/** 知识库 · 对齐演示 HTML */

/** 新建条目 · 分类（表单 value → 列表 cat id） */
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
  { value: 'text-embedding-3-small', label: 'text-embedding-3-small' },
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
  { value: 'bge-m3', label: 'BGE-M3（本地）' },
]

/** 演示支持的文档扩展名 */
export const KB_UPLOAD_ACCEPT = '.pdf,.docx,.doc,.md,.txt,.html,.htm'
export const KB_UPLOAD_EXT = new Set(['pdf', 'docx', 'doc', 'md', 'txt', 'html', 'htm'])

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

/** 演示：用文件大小估算可解析字符数 */
export function estimateCharsFromFile(file) {
  if (!file) return 0
  const name = String(file.name || '').toLowerCase()
  const size = Number(file.size) || 0
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.html') || name.endsWith('.htm')) {
    return size
  }
  // pdf/docx 压缩比较高，粗估
  return Math.max(200, Math.round(size * 0.45))
}

export function resolveKbCat(formCat) {
  const hit = KB_FORM_CATS.find((c) => c.value === formCat)
  return hit || KB_FORM_CATS[0]
}

export const KB_KPIS = [
  { icon: '📖', color: 'blue', value: '286', unit: '篇', label: '知识条目', trend: '本周 +12 篇', trendUp: true },
  { icon: '🏷️', color: 'purple', value: '48', unit: '条', label: '业务术语', trend: '已关联资产', trendUp: true },
  { icon: '📘', color: 'green', value: '1', unit: '部', label: '平台手册', trend: 'v1.1 · 12 章', trendUp: true },
  { icon: '❓', color: 'orange', value: '86', unit: '条', label: 'FAQ', trend: '命中率 92%', trendUp: true },
  { icon: '🔗', color: 'red', value: '1.2', unit: 'k', label: 'AI 引用次数', trend: '本月', trendUp: true },
]

export const KB_CATS = [
  { id: 'all', name: '📚 全部', count: 286 },
  { id: 'term', name: '🏷️ 业务术语', count: 48 },
  { id: 'dict', name: '📖 数据字典', count: 62 },
  { id: 'practice', name: '💡 最佳实践', count: 54 },
  { id: 'faq', name: '❓ FAQ', count: 86 },
  { id: 'manual', name: '📘 平台手册', count: 36 },
]

export const KB_ITEMS = [
  {
    cat: 'term',
    icon: '🏷️',
    title: 'GMV（Gross Merchandise Volume）',
    desc: '成交总额。口径：已支付订单的 pay_amt 之和，含运费，不含退款。单位元，保留 2 位小数。',
    meta: '关联 M-0001 · ads_gmv_board',
    link: '指标中心',
    to: '/metrics',
  },
  {
    cat: 'term',
    icon: '🏷️',
    title: '订单状态码值 STD-C0021',
    desc: 'DRAFT=0, PAID=1, SHIPPED=2, DELIVERED=3, REFUNDED=4, CLOSED=5。禁止源库自行扩展。',
    meta: '关联 dwd_order_detail.order_status',
    link: '资产目录',
    to: '/catalog',
  },
  {
    cat: 'term',
    icon: '🏷️',
    title: '买家手机号脱敏策略',
    desc: 'PII 字段。默认脱敏：保留前 3 后 4（138****1234）。明文需安全岗二次审批。',
    meta: '关联 dwd_user_info.buyer_mobile',
    link: '安全模块',
    to: '/security',
  },
  {
    cat: 'dict',
    icon: '📖',
    title: 'dwd_order_detail 字段字典',
    desc: '23 列完整说明：order_id(PK) / order_no / buyer_mobile(脱敏) / pay_amt(元,2位) / order_channel(码值) …',
    meta: '23 列 · Gravitino 同步',
    link: '查看资产',
    to: '/catalog',
  },
  {
    cat: 'dict',
    icon: '📖',
    title: '指标 M-0001 日GMV 定义',
    desc: '业务口径：当日已支付订单的成交总额。技术口径：SUM(pay_amt) WHERE is_paid=1 AND dt=${date}。',
    meta: '关联 ads_gmv_board · /api/gmv/daily',
    link: '指标中心',
    to: '/metrics',
  },
  {
    cat: 'practice',
    icon: '💡',
    title: 'Iceberg 表分区最佳实践',
    desc: '按 dt 日分区 + order_id 哈希分桶。小表（<1亿）可不分桶。历史分区 90 天后转冷归档。',
    meta: '适用 ODS/DWD',
    link: '—',
    to: null,
  },
  {
    cat: 'practice',
    icon: '💡',
    title: 'Flink CDC Checkpoint 配置',
    desc: '间隔 3min · 保留 3 个 · MinIO checkpoint。JM 重启后从最近 checkpoint 恢复，避免重复写入。',
    meta: '关联 cdc.trade.order',
    link: '任务运维',
    to: '/ops',
  },
  {
    cat: 'practice',
    icon: '💡',
    title: '质量门禁阻断规范',
    desc: 'PK_UNIQUE / NULL_CHECK 失败必须阻断 DAG。业务规则失败仅告警不阻断。门禁结果回写资产质量分。',
    meta: '关联 7 条阻断规则',
    link: '数据质量',
    to: '/quality',
  },
  {
    cat: 'faq',
    icon: '❓',
    title: '怎么申请敏感列明文权限？',
    desc: '申请审批 → 勾选「申请明文」→ 填详细用途 → 资产 Owner 审 → 安全岗二次加签 → 写入 Gravitino → 到期自动回收。',
    meta: '命中率 94%',
    link: '申请审批',
    to: '/apply',
  },
  {
    cat: 'faq',
    icon: '❓',
    title: '对账失败后看板为什么不更新？',
    desc: 'ads_gmv_board 湖/CK 分区级对账失败 → 自动摘牌黄金数据集 → Superset 看板冻结 → 需修复后重跑对账通过才恢复。',
    meta: '关联当前 P0 告警',
    link: '根因台',
    to: '/rootcause',
  },
  {
    cat: 'faq',
    icon: '❓',
    title: 'AI 助手能生成什么？',
    desc: 'SQL（Trino/Flink）· Shell 脚本 · Python ETL · UDF 模板 · 数据质量规则 · 故障诊断建议。生成内容自动绑定当前空间资产上下文。',
    meta: '命中率 96%',
    link: 'AI 助手',
    to: '/aiassistant',
  },
  {
    cat: 'manual',
    icon: '📘',
    title: '平台使用手册 v1.1 · 第 3 章 数据申请',
    desc: '步骤：选资产 → 选列 → 选时效 → 填用途 → 审批链（Owner/安全岗）→ Gravitino 写入 → 即席查询可见。含驳回率 12.5% 常见原因。',
    meta: '12 章 · 36 节',
    link: '—',
    to: null,
  },
]

export const KB_PLATFORM_CHAIN = {
  tags: ['业务术语 GMV'],
  steps: [
    { label: '指标 M-0001', to: '/metrics' },
    { label: '资产 ads_gmv_board', to: '/catalog' },
    { label: 'AI 助手引用', to: '/aiassistant' },
  ],
  note: '示例：用户问「GMV 口径是什么」→ AI 助手从知识库检索「术语-GMV」→ 返回定义 + 关联指标 M-0001 + 资产 ads_gmv_board + 计算公式，并标注引用来源。知识条目变更后自动重建向量索引。',
}
