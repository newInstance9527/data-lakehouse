/** AI 助手 & 模型管理 · 对齐演示 HTML */

export const AI_MODELS = [
  {
    id: 'm_gpt4o',
    name: 'GPT-4o',
    vendor: 'OpenAI',
    logo: '🟢',
    bg: '#e6f7ff',
    endpoint: 'https://api.openai.com/v1',
    key: 'sk-****...a3f9（Vault）',
    context: '128K',
    priceUnit: 'usd_1m',
    inputRate: 2.5,
    outputRate: 10,
    input: '$2.5/1M',
    output: '$10/1M',
    enabled: true,
    status: 'ok',
    latency: '1.2s',
    calls: '8.6万',
    cost: '¥1,240',
    role: '默认·强推理',
  },
  {
    id: 'm_claude35',
    name: 'Claude 3.5 Sonnet',
    vendor: 'Anthropic',
    logo: '🟣',
    bg: '#f3e5ff',
    endpoint: 'https://api.anthropic.com/v1',
    key: 'sk-ant-****...7c2e（Vault）',
    context: '200K',
    priceUnit: 'usd_1m',
    inputRate: 3,
    outputRate: 15,
    input: '$3/1M',
    output: '$15/1M',
    enabled: true,
    status: 'ok',
    latency: '1.5s',
    calls: '2.4万',
    cost: '¥480',
    role: '代码擅长',
  },
  {
    id: 'm_qwen',
    name: '通义千问 Max',
    vendor: '阿里云',
    logo: '🔵',
    bg: '#e6f7ff',
    endpoint: 'https://dashscope.aliyuncs.com/api/v1',
    key: 'sk-****...9b1d（Vault）',
    context: '128K',
    priceUnit: 'cny_1k',
    inputRate: 0.04,
    outputRate: 0.12,
    input: '¥0.04/1k',
    output: '¥0.12/1k',
    enabled: true,
    status: 'ok',
    latency: '0.8s',
    calls: '1.2万',
    cost: '¥86',
    role: '本地化',
  },
  {
    id: 'm_deepseek',
    name: 'DeepSeek V3',
    vendor: 'DeepSeek',
    logo: '🟠',
    bg: '#fff7e6',
    endpoint: 'https://api.deepseek.com/v1',
    key: 'sk-****...4f8a（Vault）',
    context: '128K',
    priceUnit: 'cny_1m',
    inputRate: 1,
    outputRate: 2,
    input: '¥1/1M',
    output: '¥2/1M',
    enabled: true,
    status: 'warn',
    latency: '1.1s',
    calls: '0.6万',
    cost: '¥36',
    role: '性价比·Key 将过期',
  },
  {
    id: 'm_local',
    name: 'Qwen2.5-14B 本地',
    vendor: '自建',
    logo: '⚪',
    bg: '#fafafa',
    endpoint: 'http://10.4.0.8:8080/v1',
    key: '无需（内网）',
    context: '32K',
    priceUnit: 'free',
    inputRate: 0,
    outputRate: 0,
    input: '免费',
    output: '免费',
    enabled: false,
    status: 'off',
    latency: '—',
    calls: '0',
    cost: '¥0',
    role: '备用·内网部署',
  },
]

export const AI_ROUTES = [
  { scene: 'SQL 生成/优化', ws: '全部', primary: 'GPT-4o', fallback: 'DeepSeek V3', status: 'ok' },
  { scene: '脚本生成', ws: '全部', primary: 'Claude 3.5 Sonnet', fallback: 'GPT-4o', status: 'ok' },
  { scene: '故障诊断', ws: 'ws_trade', primary: 'GPT-4o', fallback: '通义千问 Max', status: 'ok' },
  { scene: '使用手册问答', ws: '全部', primary: '通义千问 Max', fallback: 'DeepSeek V3', status: 'ok' },
  { scene: '沙箱实验', ws: 'ws_sandbox', primary: 'Qwen2.5-14B 本地', fallback: 'DeepSeek V3', status: 'off' },
]

export const AI_MODEL_KPIS = [
  { icon: '🧠', color: 'blue', value: '5', unit: '个', label: '已接入模型', trend: '4 启用 · 1 停用', trendUp: true },
  { icon: '✅', color: 'green', value: '4', unit: '/5', label: '连通性', trend: '1 个 Key 过期待换', trendUp: true },
  { icon: '💬', color: 'purple', value: '12.8', unit: '万', label: '本月调用', trend: '+18% 较上月', trendUp: true },
  { icon: '💰', color: 'orange', value: '¥1,842', unit: '', label: '本月成本', trend: '按空间分摊', trendUp: true },
  { icon: '⚡', color: 'red', value: '1.2', unit: 's', label: '平均响应', trend: 'P95 ≤ 3s', trendUp: true },
]

export const AI_USAGE_BARS = [
  { name: 'GPT-4o · 强推理', calls: 86000, pct: 100, cost: '¥1,240' },
  { name: 'Claude 3.5 · 代码', calls: 24000, pct: 28, cost: '¥480' },
  { name: '通义千问 · 本地化', calls: 12000, pct: 14, cost: '¥86' },
  { name: 'DeepSeek · 性价比', calls: 6000, pct: 7, cost: '¥36' },
  { name: 'Qwen2.5 · 本地', calls: 0, pct: 0, cost: '¥0' },
]

export const AI_MODEL_SELECT = [
  { value: 'gpt4o', label: 'GPT-4o（默认·强推理）' },
  { value: 'claude35', label: 'Claude 3.5 Sonnet（代码擅长）' },
  { value: 'qwen', label: '通义千问 Max（本地化）' },
  { value: 'deepseek', label: 'DeepSeek V3（性价比）' },
]

export const AI_QUICK_CHIPS = [
  { id: 'write_sql', label: '📝 生成 SQL' },
  { id: 'write_script', label: '🔧 生成 Flink 脚本' },
  { id: 'manual', label: '📖 平台使用手册' },
  { id: 'diagnose', label: '🩺 诊断告警' },
  { id: 'explain', label: '💡 解释 dwd_order_detail' },
  { id: 'optimize', label: '⚡ 优化此 SQL' },
]

export const AI_QUICK_PROMPTS = {
  write_sql: '帮我写一个 SQL：查近 7 天各渠道 GMV，要从 dwd_order_detail 取数，金额脱敏',
  write_script: '帮我写一个 Flink CDC 脚本：从 MySQL 同步订单到 Iceberg',
  manual: '怎么申请敏感列明文权限？',
  diagnose: 'dwd_order_detail 为什么质量阻断？怎么修？',
  explain: '解释一下 dwd_order_detail 这张表',
  optimize: '优化这段 SQL：SELECT * FROM dwd_order_detail WHERE dt=yesterday',
}

export const AI_INITIAL_MESSAGES = [
  {
    role: 'assistant',
    html: `👋 你好！我是 DataLake Copilot，可以帮你：
<br>• <b>生成/优化 SQL</b>：自然语言转 SQL，自动绑定资产上下文
<br>• <b>生成脚本</b>：Flink/Shell/Python ETL 脚本
<br>• <b>使用手册问答</b>：平台操作、配置、最佳实践
<br>• <b>故障诊断</b>：根据报错/告警给出排查建议`,
  },
  {
    role: 'user',
    text: '帮我写一个 SQL：查近 7 天各渠道 GMV，从 dwd_order_detail 取数，金额脱敏',
  },
  {
    role: 'assistant',
    html: `已基于资产 <code>dwd_trade.dwd_order_detail</code> 生成 SQL，自动应用 <code>buyer_mobile</code> 动态脱敏：
<pre>SELECT
  dt,
  order_channel,
  COUNT(DISTINCT order_id) AS order_cnt,
  SUM(pay_amt)             AS gmv,
  buyer_mobile
FROM iceberg.dwd_trade.dwd_order_detail
WHERE dt BETWEEN date '2026-08-27' AND date '2026-09-02'
  AND is_paid = 1
GROUP BY dt, order_channel, buyer_mobile
ORDER BY dt DESC, gmv DESC;</pre>
<div class="code-head"><span>上下文：dwd_order_detail · 23 列 · 质量分 78（阻断中）</span><span>消耗 1,284 tokens</span></div>`,
  },
  {
    role: 'user',
    text: 'dwd_order_detail 为什么质量阻断？怎么修？',
  },
  {
    role: 'assistant',
    html: `📌 <b>诊断结果</b>（质量规则 + 血缘 + 任务运维 综合分析）：
<br><br>🔴 <b>阻断规则</b>：<code>dwd.dwd_order_detail.PK_UNIQUE</code> 失败，主键 <code>order_id</code> 重复 12,842 条（0.006%）。
<br>📍 <b>根因</b>：上游 <code>cdc.trade.order</code> 在 09-02 14:20 Flink JobManager 重启，checkpoint 回退后重复写入 ODS。
<br>🔧 <b>修复建议</b>：
<br>1. DWD SQL 增加 <code>WHERE order_id IS NOT NULL</code> + ROW_NUMBER 去重
<br>2. 修复脚本已在数据开发 v23 起草，建议 TEST 试跑
<br>3. 上游 CDC 已切到新 checkpoint（任务运维）
<div class="code-head"><span>关联：质量规则 / 根因台 / 数据开发</span><span>消耗 1,856 tokens</span></div>`,
  },
]

export const AI_CONTEXT_ITEMS = [
  { icon: '🗂️', label: '空间：ws_trade' },
  { icon: '📋', label: '表：dwd_order_detail', to: '/catalog' },
  { icon: '✅', label: '规则：PK_UNIQUE（失败）', to: '/quality' },
  { icon: '🎯', label: '指标：M-0001 日GMV', to: '/metrics' },
  { icon: '📖', label: '知识库：交易域术语 28 条', to: '/knowledge' },
]

export const AI_RECENT_CHATS = [
  '💬 GMV 趋势 SQL 生成',
  '💬 质量阻断诊断',
  '💬 申请权限流程咨询',
  '💬 Flink CDC 配置',
  '💬 对账失败排查',
]

export const AI_KNOWLEDGE_REFS = [
  { label: '📘 平台使用手册 v1.1', to: '/knowledge' },
  { label: '📗 SQL 开发规范', to: '/knowledge' },
  { label: '📙 数据质量治理手册', to: '/knowledge' },
  { label: '📕 FAQ · 86 条', to: '/knowledge' },
]

export function formatUsageCalls(calls) {
  if (!calls) return '0'
  return `${(calls / 10000).toFixed(1)}万`
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
    ? { text: '生效', cls: 'tag-green' }
    : { text: '停用', cls: 'tag-gray' }
}
