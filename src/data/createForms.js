/** 门户「新建」表单字段 · 对齐 DLH.create schema */

import {
  ensureMetricBindFields,
  ensureMetricBindTables,
  metricBindFieldOptions,
  metricBindTableOptions,
} from '@/data/metricBindAssets'
import {
  metricAtomOptions,
  metricDeriveAtomOptions,
  metricDimOptionsForAtom,
  metricQualifierOptionsForAtom,
  parseMetricFormula,
  refsToArray,
} from '@/data/metrics'
import {
  ensureWorkspaceUserOptions,
  workspaceUserOptions,
} from '@/data/workspaceUsers'
import { fetchStdCodes } from '@/api/standard'
import {
  domainSelectOptionsSync,
  ensureDomainSelectOptions,
} from '@/composables/useDomains'

let _stdCodeOpts = []
let _stdCodeLoaded = false

export function qualityStdCodeOptions() {
  return _stdCodeOpts
}

export async function ensureQualityStdCodeOptions() {
  if (_stdCodeLoaded && _stdCodeOpts.length) return _stdCodeOpts
  try {
    const page = await fetchStdCodes({}, { current: 1, size: 200 })
    const rows = page?.records || []
    _stdCodeOpts = rows
      .map((r) => {
        const id = r.codeSetId || r.id
        if (!id) return null
        return {
          value: id,
          label: `${id}${r.name ? ` · ${r.name}` : ''}${r.fieldName ? ` (${r.fieldName})` : ''}`,
        }
      })
      .filter(Boolean)
    _stdCodeLoaded = true
  } catch (e) {
    console.warn('[quality] load std codes failed', e)
    _stdCodeOpts = _stdCodeOpts.length ? _stdCodeOpts : []
  }
  return _stdCodeOpts
}

/** 出湖申请 · 源表选项（gov_asset；优先 ADS/DWD/DWS，无分层则全部） */
export function exportBindTableOptions() {
  const all = metricBindTableOptions()
  const layered = all.filter((o) => ['ads', 'dwd', 'dws'].includes(String(o.layer || '').toLowerCase()))
  return layered.length ? layered : all
}

/** 按规则类型的表达式预设；`{field}` 会替换为所选字段名；scope=field|table */
export const QUALITY_EXPR_PRESETS = {
  主键唯一: [
    {
      key: 'f_pk_group',
      scope: 'field',
      label: '字段级 · GROUP BY 查重',
      value: 'SELECT {field}, COUNT(*) c FROM T GROUP BY {field} HAVING c > 1',
    },
    {
      key: 'f_pk_cnt',
      scope: 'field',
      label: '字段级 · 非空且去重计数 = COUNT(1)',
      value: '{field} IS NOT NULL AND COUNT(DISTINCT {field}) = COUNT(1)',
    },
    {
      key: 'f_pk_dup_rate',
      scope: 'field',
      label: '字段级 · 重复率 < 0.01%',
      value: '(COUNT(1) - COUNT(DISTINCT {field})) * 1.0 / COUNT(1) < 0.0001',
    },
    {
      key: 't_pk_composite',
      scope: 'table',
      label: '表级 · 复合主键 (order_id, sku_id) 唯一',
      value: 'SELECT order_id, sku_id, COUNT(*) c FROM T GROUP BY order_id, sku_id HAVING c > 1',
    },
  ],
  非空: [
    {
      key: 'f_nn_one',
      scope: 'field',
      label: '字段级 · IS NOT NULL',
      value: '{field} IS NOT NULL',
    },
    {
      key: 'f_nn_empty',
      scope: 'field',
      label: '字段级 · 非空且非空串',
      value: "{field} IS NOT NULL AND TRIM(CAST({field} AS VARCHAR)) <> ''",
    },
    {
      key: 'f_nn_rate',
      scope: 'field',
      label: '字段级 · 空值率 < 0.1%',
      value: 'SUM(CASE WHEN {field} IS NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(1) < 0.001',
    },
    {
      key: 't_nn_keys',
      scope: 'table',
      label: '表级 · 关键列非空 (order_id/dt/pay_amt)',
      value: 'order_id IS NOT NULL AND dt IS NOT NULL AND pay_amt IS NOT NULL',
    },
    {
      key: 't_nn_partition',
      scope: 'table',
      label: '表级 · 分区列 dt 非空',
      value: 'dt IS NOT NULL',
    },
  ],
  枚举: [
    {
      key: 'f_enum_std',
      scope: 'field',
      label: '字段级 · 绑标准码值集（填下方 stdCodeSetId）',
      value: 'codeSet=STD-C0021',
    },
    {
      key: 'f_enum_in',
      scope: 'field',
      label: '字段级 · ∈ 固定枚举集',
      value: "{field} IN ('App','H5','小程序','POS')",
    },
    {
      key: 'f_enum_status_bind',
      scope: 'field',
      label: '字段级 · 订单状态码值集',
      value: 'codeSet=ORDER_STATUS',
    },
    {
      key: 't_enum_status',
      scope: 'table',
      label: '表级 · order_status 绑 ORDER_STATUS',
      value: 'codeSet=ORDER_STATUS',
    },
    {
      key: 't_enum_channel',
      scope: 'table',
      label: '表级 · channel 绑 CHANNEL_CODE',
      value: 'codeSet=CHANNEL_CODE',
    },
  ],
  范围: [
    {
      key: 'f_range_ge0',
      scope: 'field',
      label: '字段级 · ≥ 0',
      value: '{field} >= 0',
    },
    {
      key: 'f_range_gt0',
      scope: 'field',
      label: '字段级 · > 0',
      value: '{field} > 0',
    },
    {
      key: 'f_range_pct',
      scope: 'field',
      label: '字段级 · 百分比 0~1',
      value: '{field} BETWEEN 0 AND 1',
    },
    {
      key: 'f_range_len',
      scope: 'field',
      label: '字段级 · 字符串长度 1~64',
      value: 'LENGTH(CAST({field} AS VARCHAR)) BETWEEN 1 AND 64',
    },
    {
      key: 't_range_amt',
      scope: 'table',
      label: '表级 · 金额守恒 original ≥ discount + pay',
      value: 'original_amt >= discount_amt + pay_amt - 0.01',
    },
    {
      key: 't_range_pay',
      scope: 'table',
      label: '表级 · 支付成功必有 pay_time',
      value: 'pay_amt >= 0 AND (order_status <> 3 OR pay_time IS NOT NULL)',
    },
  ],
  行数阈值: [
    {
      key: 'f_row_distinct',
      scope: 'field',
      label: '字段级 · 去重行数 ≥ 阈值',
      value: 'COUNT(DISTINCT {field}) >= 1000',
    },
    {
      key: 'f_row_null_cnt',
      scope: 'field',
      label: '字段级 · 空值行数 ≤ 100',
      value: 'SUM(CASE WHEN {field} IS NULL THEN 1 ELSE 0 END) <= 100',
    },
    {
      key: 't_row_min',
      scope: 'table',
      label: '表级 · 分区最小行数',
      value: 'COUNT(*) WHERE dt = ${dt} >= 1000',
    },
    {
      key: 't_row_max',
      scope: 'table',
      label: '表级 · 分区最大行数（防刷数）',
      value: 'COUNT(*) WHERE dt = ${dt} <= 50000000',
    },
    {
      key: 't_row_recon',
      scope: 'table',
      label: '表级 · ODS↔DWD 行数对账',
      value: '|COUNT(ODS) - COUNT(DWD)| ≤ 10',
    },
    {
      key: 't_row_wow',
      scope: 'table',
      label: '表级 · 日行数环比波动 ≤ 30%',
      value: 'ABS(cnt_today - cnt_yesterday) / NULLIF(cnt_yesterday,0) <= 0.30',
    },
  ],
  自定义SQL: [
    {
      key: 'f_regex_mobile',
      scope: 'field',
      label: '字段级 · 手机号正则',
      value: "{field} REGEXP '^1[3-9]\\\\d{9}$'",
    },
    {
      key: 'f_regex_email',
      scope: 'field',
      label: '字段级 · 邮箱格式',
      value: "{field} REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$'",
    },
    {
      key: 'f_fk_exists',
      scope: 'field',
      label: '字段级 · 外键存在于维表',
      value: '{field} IN (SELECT sku_id FROM dim.dim_sku)',
    },
    {
      key: 'f_fresh',
      scope: 'field',
      label: '字段级 · 事件时间不晚于 now+1h',
      value: '{field} <= CURRENT_TIMESTAMP + INTERVAL 1 HOUR',
    },
    {
      key: 't_sla_ready',
      scope: 'table',
      label: '表级 · 分区就绪 SLA（T+1 03:00 前）',
      value: 'dt 分区必须在 T+1 03:00 前就绪',
    },
    {
      key: 't_late_rate',
      scope: 'table',
      label: '表级 · 迟到事件占比 < 1%',
      value: 'SUM(CASE WHEN create_time >= dt + INTERVAL 1 DAY THEN 1 ELSE 0 END) * 1.0 / COUNT(1) < 0.01',
    },
    {
      key: 't_cdc_delete',
      scope: 'table',
      label: '表级 · CDC 删除标记闭合',
      value: '源 DELETE 事件 → __deleted=true 全链路传播',
    },
    {
      key: 't_dup_batch',
      scope: 'table',
      label: '表级 · 同批次无重复写入',
      value: 'COUNT(1) = COUNT(DISTINCT order_id) WHERE batch_id = ${batch_id}',
    },
  ],
}

export function fillExprTemplate(tpl, field) {
  const col = field && field !== '__table__' ? field : 'col'
  return String(tpl || '').replaceAll('{field}', col)
}

export const QUALITY_RULE_FORM = {
  title: '＋ 新建质量规则',
  intro: '选类型 → 绑资产目录表/字段 → 枚举填码值集 → 表达式 → 严重度（无演示表回落）',
  submitLabel: '创建规则',
  width: '640px',
  fields: [
    { key: 'name', label: '规则名称', type: 'text', required: true, placeholder: '如 PK_UNIQUE / NOT_NULL', wide: true },
    {
      key: 'rtype',
      label: '规则类型',
      type: 'select',
      options: ['主键唯一', '非空', '枚举', '范围', '行数阈值', '自定义SQL'],
      default: '主键唯一',
    },
    {
      key: 'scope',
      label: '作用范围',
      type: 'select',
      options: [
        { value: 'field', label: '字段级（绑具体列）' },
        { value: 'table', label: '表级（整表/分区）' },
      ],
      default: 'field',
    },
    {
      key: 'table',
      label: '绑定表',
      type: 'search-select',
      required: true,
      optionsResolver: () => metricBindTableOptions(),
      optionsLoad: () => ensureMetricBindTables(),
      placeholder: '搜索资产目录中的表…',
      searchKeys: ['label', 'sub', 'name', 'assetCode', 'search'],
      subKey: 'sub',
      hint: '选项来自已登记资产（gov_asset）；无列表请先在资产目录注册湖表',
      wide: true,
    },
    {
      key: 'field',
      label: '绑定字段',
      type: 'search-select',
      requiredWhen: { key: 'scope', value: 'field' },
      optionsByKey: 'table',
      optionsResolver: (form) => metricBindFieldOptions(form),
      optionsLoad: (form) => ensureMetricBindFields(form?.table),
      hideWhen: { key: 'scope', value: 'table' },
      placeholder: '搜索列名…',
      searchKeys: ['label', 'name', 'type', 'comment'],
      hint: '列来自资产 schema（元数据优先，目录回退）',
      wide: true,
    },
    {
      key: 'stdCodeSetId',
      label: '标准码值集',
      type: 'search-select',
      showWhen: { key: 'rtype', value: '枚举' },
      requiredWhen: { key: 'rtype', value: '枚举' },
      optionsResolver: () => qualityStdCodeOptions(),
      optionsLoad: () => ensureQualityStdCodeOptions(),
      placeholder: '搜索 gov_std_code.code_set_id…',
      searchKeys: ['label', 'value'],
      hint: '选项来自数据标准码值；亦可手填 codeSetId',
      wide: true,
    },
    {
      key: 'expr',
      label: '表达式',
      type: 'preset-text',
      required: true,
      presetsByKey: 'rtype',
      presetsBy: QUALITY_EXPR_PRESETS,
      filterByScope: true,
      interpolateKeys: ['field'],
      placeholder: '枚举可选 codeSet=XXX；或手写 IN (…) SQL',
    },
    { key: 'sev', label: '严重度', type: 'select', options: ['阻断', '告警'], default: '阻断' },
  ],
}

export const SCHEMA_REG_FORM = {
  title: '＋ 注册 Schema',
  intro: '填 Topic/表 → 字段定义 → 兼容性 → 注册',
  submitLabel: '注册',
  fields: [
    { key: 'topic', label: 'Topic/表名', type: 'text', required: true, placeholder: 'cdc.trade.order', wide: true },
    {
      key: 'compat',
      label: '兼容性级别',
      type: 'select',
      options: ['BACKWARD', 'FORWARD', 'FULL', 'NONE'],
      default: 'BACKWARD',
    },
    {
      key: 'fields',
      label: '字段定义',
      type: 'textarea',
      required: true,
      placeholder: 'order_id BIGINT, pay_amt DECIMAL(18,2)',
    },
  ],
}

export const API_BUILD_FORM = {
  title: '📝 构建 API',
  intro: '构建工作台（左元数据 + SQL/接口/出参/缓存/流量），见 ApiBuildWorkbench',
  submitLabel: '创建草稿',
  fields: [
    { key: 'name', label: 'API 名称/路径', type: 'text', required: true, placeholder: '/api/gmv', wide: true },
  ],
}

export const EXPORT_APPLY_FORM = {
  title: '＋ 出湖申请',
  intro: '选湖内表 → 用途 → 目标系统 → 有效期 → 审批 → 到期回收',
  submitLabel: '提交申请',
  fields: [
    {
      key: 'table',
      label: '源表',
      type: 'search-select',
      required: true,
      optionsResolver: () => exportBindTableOptions(),
      optionsLoad: () => ensureMetricBindTables(),
      placeholder: '搜索资产目录中的表（优先 ADS / DWD / DWS）',
      searchKeys: ['label', 'sub', 'name', 'assetCode', 'layer', 'domain', 'search', 'value'],
      subKey: 'sub',
      hint: '选项来自已登记资产（gov_asset）；无列表请先在资产目录注册；不回落演示表',
      wide: true,
    },
    { key: 'purpose', label: '用途', type: 'textarea', required: true, placeholder: '业务用途与下游系统说明' },
    { key: 'target', label: '目标系统', type: 'text', required: true, placeholder: '如 BI 报表 / 业务 MySQL / ES', wide: true },
    {
      key: 'expire',
      label: '有效期',
      type: 'select',
      options: ['7天', '30天', '90天', '长期', '自定义'],
      default: '30天',
    },
    {
      key: 'expireDays',
      label: '自定义天数',
      type: 'number',
      requiredWhen: { key: 'expire', value: '自定义' },
      showWhen: { key: 'expire', value: '自定义' },
      default: 60,
      placeholder: '输入天数，如 60',
    },
  ],
}

export const AI_MODEL_FORM = {
  title: '＋ 接入模型',
  intro: '供应商 / 端点 / Key → 上下文与计价 → 用途 · Key 写入 Vault',
  submitLabel: '接入',
  width: '640px',
  fields: [
    {
      key: 'vendor',
      label: '供应商',
      type: 'select',
      options: ['OpenAI', 'Anthropic', 'DeepSeek', '阿里云', '通义', 'GLM', '自建'],
      default: 'DeepSeek',
    },
    { key: 'model', label: '模型名称', type: 'text', required: true, placeholder: '如 DeepSeek-V4.1-Flash / gpt-4o', default: 'DeepSeek-V4.1-Flash' },
    {
      key: 'baseURL',
      label: 'API 地址',
      type: 'text',
      required: true,
      placeholder: 'https://ai.datagoo.cn:3030/v1',
      default: 'https://ai.datagoo.cn:3030/v1',
      wide: true,
    },
    {
      key: 'key',
      label: 'API Key',
      type: 'text',
      required: true,
      placeholder: 'sk-...(Vault 加密存储)',
      wide: true,
    },
    {
      key: 'context',
      label: '上下文窗口',
      type: 'select',
      options: ['4K', '8K', '16K', '32K', '64K', '128K', '200K'],
      default: '128K',
    },
    {
      key: 'priceUnit',
      label: '计价单位',
      type: 'select',
      options: [
        { value: 'usd_1m', label: '$ / 1M tokens' },
        { value: 'cny_1m', label: '¥ / 1M tokens' },
        { value: 'cny_1k', label: '¥ / 1k tokens' },
        { value: 'free', label: '免费（本地/内网）' },
      ],
      default: 'cny_1m',
    },
    {
      key: 'inputRate',
      label: '输入价格',
      type: 'number',
      default: 0,
      placeholder: '如 2.5',
      hideWhen: { key: 'priceUnit', value: 'free' },
    },
    {
      key: 'outputRate',
      label: '输出价格',
      type: 'number',
      default: 0,
      placeholder: '如 10',
      hideWhen: { key: 'priceUnit', value: 'free' },
    },
    {
      key: 'tokenQuota',
      label: 'Token 总限额',
      type: 'number',
      default: 0,
      placeholder: '0 = 不限',
      wide: true,
    },
    {
      key: 'costQuota',
      label: '成本总限额',
      type: 'number',
      default: 0,
      placeholder: '0 = 不限',
      wide: true,
    },
    { key: 'use', label: '用途 / 角色', type: 'text', default: '默认对话 · DataGoo', wide: true },
    {
      key: 'kind',
      label: '功能类别',
      type: 'select',
      options: [
        { value: 'chat', label: '对话模型' },
        { value: 'image', label: '图片模型' },
        { value: 'embed', label: '向量模型' },
      ],
      default: 'chat',
      wide: true,
    },
    {
      key: 'supportsVision',
      label: '支持上传图片 / 视觉输入',
      type: 'select',
      options: [
        { value: '0', label: '否（纯文本对话）' },
        { value: '1', label: '是（多模态 / 识图）' },
      ],
      default: '0',
      showWhen: { key: 'kind', value: 'chat' },
      wide: true,
    },
    {
      key: 'supportsImageOutput',
      label: '支持图片输出（生图）',
      type: 'select',
      options: [
        { value: '0', label: '否' },
        { value: '1', label: '是' },
      ],
      default: '1',
      showWhen: { key: 'kind', value: 'image' },
      wide: true,
    },
    {
      key: 'egressApproved',
      label: '外发安全标记',
      type: 'select',
      options: [
        { value: '0', label: '未评估（外发不可进生产路由）' },
        { value: '1', label: '安全岗已标记（允许外发）' },
      ],
      default: '1',
      wide: true,
    },
  ],
}

/** 编辑模型基础信息（Key 可选，留空不更换） */
export const AI_MODEL_EDIT_FORM = {
  title: '✎ 编辑模型',
  intro: '维护端点、上下文、输入/输出价格与用途 · 留空 Key 表示不更换',
  submitLabel: '保存',
  width: '640px',
  fields: [
    {
      key: 'vendor',
      label: '供应商',
      type: 'select',
      options: ['OpenAI', 'Anthropic', 'DeepSeek', '阿里云', '通义', 'GLM', '自建'],
      default: 'OpenAI',
    },
    { key: 'model', label: '模型名称', type: 'text', required: true, placeholder: '如 gpt-4o' },
    {
      key: 'baseURL',
      label: 'API 地址',
      type: 'text',
      required: true,
      placeholder: 'https://api.openai.com/v1',
      wide: true,
    },
    {
      key: 'key',
      label: 'API Key',
      type: 'text',
      placeholder: '留空则不更换 · 新 Key 写入 Vault',
      wide: true,
    },
    {
      key: 'context',
      label: '上下文窗口',
      type: 'select',
      options: ['4K', '8K', '16K', '32K', '64K', '128K', '200K'],
      default: '128K',
    },
    {
      key: 'priceUnit',
      label: '计价单位',
      type: 'select',
      options: [
        { value: 'usd_1m', label: '$ / 1M tokens' },
        { value: 'cny_1m', label: '¥ / 1M tokens' },
        { value: 'cny_1k', label: '¥ / 1k tokens' },
        { value: 'free', label: '免费（本地/内网）' },
      ],
      default: 'usd_1m',
    },
    {
      key: 'inputRate',
      label: '输入价格',
      type: 'number',
      default: 0,
      placeholder: '如 2.5',
      hideWhen: { key: 'priceUnit', value: 'free' },
    },
    {
      key: 'outputRate',
      label: '输出价格',
      type: 'number',
      default: 0,
      placeholder: '如 10',
      hideWhen: { key: 'priceUnit', value: 'free' },
    },
    {
      key: 'tokenQuota',
      label: 'Token 总限额',
      type: 'number',
      default: 0,
      placeholder: '0 = 不限',
      wide: true,
    },
    {
      key: 'costQuota',
      label: '成本总限额',
      type: 'number',
      default: 0,
      placeholder: '0 = 不限',
      wide: true,
    },
    { key: 'use', label: '用途 / 角色', type: 'text', wide: true },
    {
      key: 'kind',
      label: '功能类别',
      type: 'select',
      options: [
        { value: 'chat', label: '对话模型' },
        { value: 'image', label: '图片模型' },
        { value: 'embed', label: '向量模型' },
      ],
      default: 'chat',
      wide: true,
    },
    {
      key: 'supportsVision',
      label: '支持上传图片 / 视觉输入',
      type: 'select',
      options: [
        { value: '0', label: '否（纯文本对话）' },
        { value: '1', label: '是（多模态 / 识图）' },
      ],
      default: '0',
      showWhen: { key: 'kind', value: 'chat' },
      wide: true,
    },
    {
      key: 'supportsImageOutput',
      label: '支持图片输出（生图）',
      type: 'select',
      options: [
        { value: '0', label: '否' },
        { value: '1', label: '是' },
      ],
      default: '1',
      showWhen: { key: 'kind', value: 'image' },
      wide: true,
    },
    {
      key: 'egressApproved',
      label: '外发安全标记',
      type: 'select',
      options: [
        { value: '0', label: '未评估（外发不可进生产路由）' },
        { value: '1', label: '安全岗已标记（允许外发）' },
      ],
      default: '0',
      wide: true,
    },
  ],
}

export const WORKSPACE_FORM = {
  title: '＋ 新建工作空间',
  intro: '创建组织归属与成本记账空间 · 不新建 Grav Catalog · 读数仍走申请中心',
  submitLabel: '创建空间',
  fields: [
    { key: 'name', label: '空间名称', type: 'text', required: true, placeholder: '如 交易域团队', wide: true },
    { key: 'tpl', label: '业务域模板', type: 'select', options: ['交易', '用户', '商品', '自定义'], default: '自定义' },
    {
      key: 'costCenter',
      label: '成本中心',
      type: 'text',
      placeholder: '如 CC-TEAM-01',
      wide: true,
    },
    {
      key: 'res',
      label: '配额规格',
      type: 'select',
      options: ['小(存储2TB·CU400)', '中(存储4TB·CU800)', '大(存储8TB·CU2000)'],
      default: '中(存储4TB·CU800)',
    },
    {
      key: 'rg',
      label: '查询资源组',
      type: 'text',
      placeholder: '如 rg_team（可选，用于限流/记账）',
      wide: true,
    },
    {
      key: 'members',
      label: '初始成员',
      type: 'multi-search-select',
      optionsResolver: () => workspaceUserOptions(),
      optionsLoad: () => ensureWorkspaceUserOptions(),
      placeholder: '搜索姓名 / 账号，可多选（创建人自动为 Owner）',
      searchKeys: ['name', 'account', 'label', 'sub'],
      subKey: 'sub',
      default: [],
      wide: true,
      hint: '门户协作角色；默认 Developer。创建人已是 Owner，无需再选自己。',
    },
  ],
}

/** 工作空间 · 邀请成员（门户角色，非 Grav ACL） */
export const WORKSPACE_MEMBER_FORM = {
  title: '＋ 邀请成员',
  intro: '写入 gov_ws_member · 不写 Grav grant · 读数/出湖仍走申请中心',
  submitLabel: '添加成员',
  fields: [
    {
      key: 'subjectId',
      label: '用户',
      type: 'search-select',
      required: true,
      optionsResolver: () => workspaceUserOptions(),
      optionsLoad: () => ensureWorkspaceUserOptions(),
      placeholder: '搜索姓名 / 账号',
      searchKeys: ['name', 'account', 'label', 'sub'],
      subKey: 'sub',
      wide: true,
    },
    {
      key: 'roleCode',
      label: '协作角色',
      type: 'select',
      options: [
        { value: 'Developer', label: 'Developer · 登记/开发' },
        { value: 'Operator', label: 'Operator · 运维协作' },
        { value: 'BusinessUser', label: 'BusinessUser · 消费方' },
        { value: 'Owner', label: 'Owner · 认责/默认审批' },
        { value: 'SecurityOfficer', label: 'SecurityOfficer · 高敏感审批' },
      ],
      default: 'Developer',
      wide: true,
    },
  ],
}

/** 合规删除工单 · 填主体 → 范围 → 影响评估 → 三方审批 */
export const COMPLIANCE_DELETE_FORM = {
  title: '🗑️ 受理合规删除请求',
  intro: '主体 ID 只用于生成 HMAC 与掩码，不入库；受理后自动按主体索引展开删除计划',
  submitLabel: '受理并评估',
  width: '640px',
  fields: [
    {
      key: 'subjectId',
      label: '主体 ID',
      type: 'text',
      required: true,
      placeholder: '用户ID / 订单号 / 批次号（不落库，仅 HMAC + 掩码）',
      wide: true,
    },
    {
      key: 'subjectType',
      label: '主体类型',
      type: 'select',
      options: [
        { value: 'user', label: '用户 user' },
        { value: 'order', label: '订单 order' },
        { value: 'device', label: '设备 device' },
        { value: 'account', label: '账号 account' },
        { value: 'contract', label: '合同 contract' },
      ],
      default: 'user',
    },
    {
      key: 'reqType',
      label: '请求类型',
      type: 'select',
      options: [
        { value: 'forget', label: '被遗忘权' },
        { value: 'erase_error', label: '错误数据擦除' },
        { value: 'regulator', label: '监管责令删除' },
        { value: 'contract_expire', label: '合同到期清除' },
        { value: 'account_close', label: '账号注销' },
      ],
      default: 'forget',
    },
    {
      key: 'scopeLabel',
      label: '删除范围',
      type: 'select',
      options: ['指定行', '整表', '分区', '日志归档'],
      default: '指定行',
    },
    {
      key: 'sourceSystem',
      label: '来源系统',
      type: 'select',
      options: ['法务系统', '客服系统', '合规办公室', '数据治理', '人工'],
      default: '法务系统',
    },
    {
      key: 'legalBasis',
      label: '法律/业务依据',
      type: 'text',
      placeholder: '如 GDPR Art.17 / 个保法 §47 · 用户主动申请',
      default: 'GDPR Art.17 / 个保法 §47 · 用户主动申请',
      wide: true,
    },
    {
      key: 'sourceRef',
      label: '来源单号',
      type: 'text',
      placeholder: '如 LG-20260901-07',
      wide: true,
    },
    {
      key: 'remark',
      label: '备注',
      type: 'textarea',
      placeholder: '默认 SLA 15 个工作日；删不掉的载体将转限制处理并登记复查日',
      wide: true,
    },
  ],
}

/** 主体索引登记：主体在哪些载体、经什么列可定位 */
export const SUBJECT_MAP_FORM = {
  title: '🧭 登记主体索引',
  intro: '没有主体索引就删不干净：每个载体必须给出 ID 列或关联路径',
  submitLabel: '保存',
  width: '640px',
  fields: [
    {
      key: 'subjectType',
      label: '主体类型',
      type: 'select',
      options: ['user', 'order', 'device', 'account', 'contract'],
      default: 'user',
    },
    {
      key: 'carrier',
      label: '载体',
      type: 'select',
      options: [
        { value: 'iceberg', label: '湖表' },
        { value: 'ck', label: 'ClickHouse' },
        { value: 'source', label: '源库' },
        { value: 'sink', label: '回流副本' },
        { value: 'export', label: '出湖副本' },
        { value: 'platform', label: '平台留存' },
        { value: 'ai', label: 'AI / 知识库' },
        { value: 'meta', label: '元数据样例' },
        { value: 'log', label: '日志' },
        { value: 'backup', label: '备份 / 冷归档' },
        { value: 'kafka', label: '消息队列' },
      ],
      default: 'iceberg',
    },
    {
      key: 'objectFqn',
      label: '对象',
      type: 'text',
      required: true,
      placeholder: '表 FQN / 目标 / 桶，如 dwd_user.dwd_user_info',
      wide: true,
    },
    {
      key: 'idColumn',
      label: '主体 ID 列',
      type: 'text',
      placeholder: '代理键优先，如 user_key',
    },
    {
      key: 'joinPath',
      label: '关联路径',
      type: 'text',
      placeholder: '无主体列时填，如 order_id→user_key',
    },
    {
      key: 'deleteMode',
      label: '执行方式',
      type: 'select',
      options: [
        { value: 'cow', label: 'Copy-on-Write DELETE' },
        { value: 'mor', label: 'Merge-on-Read DELETE + 合并' },
        { value: 'drop_partition', label: '分区删除 / 重导' },
        { value: 'ck_mutation', label: 'ALTER DELETE（mutation）' },
        { value: 'sink_delete', label: '下游按主键删除' },
        { value: 'notify', label: '发删除请求并取回执' },
        { value: 'purge', label: '物理清除' },
        { value: 'register', label: '登记到期销毁' },
        { value: 'retention', label: '保留期到期自然消亡' },
      ],
      default: 'cow',
    },
    {
      key: 'scopeTpl',
      label: '范围模板',
      type: 'text',
      placeholder: '如 dt>=2024-01',
    },
    {
      key: 'owner',
      label: '负责人',
      type: 'text',
      placeholder: '表 Owner',
    },
    {
      key: 'sensitivity',
      label: '敏感级',
      type: 'select',
      options: ['公开', '内部', '秘密', '机密'],
      default: '秘密',
    },
  ],
}

const METRIC_DOMAINS = [] // 运行时由 domain options 填充

/** 新建指标 · 原子 / 衍生 / 复合（按类型切换字段） */
export const METRIC_CREATE_FORM = {
  title: '＋ 新建指标',
  intro: '原子定义聚合；衍生 = 原子 + 业务限定 + 粒度 + 周期；复合只写公式',
  submitLabel: '保存草稿',
  width: '680px',
  fields: [
    {
      key: 'kind',
      label: '指标类型',
      type: 'select',
      options: [
        { value: '原子', label: '原子指标 · 绑物理字段 + 聚合计算' },
        { value: '衍生', label: '衍生指标 · 原子 + 业务限定 + 粒度 + 周期' },
        { value: '复合', label: '复合指标 · 仅公式（不带粒度）' },
      ],
      default: '原子',
      wide: true,
    },
    { key: 'name', label: '指标名', type: 'text', required: true, placeholder: '如 支付成功订单数 / 日GMV / 客单价', wide: true },
    {
      key: 'domain',
      label: '业务域',
      type: 'select',
      optionsResolver: () => domainSelectOptionsSync(),
      optionsLoad: () => ensureDomainSelectOptions(),
      default: 'trade',
    },
    {
      key: 'unit',
      label: '单位',
      type: 'text',
      default: '个',
      placeholder: '个 / 元 / % / 元/单',
    },
    // —— 原子（绑定表/字段读资产目录 gov_asset + Grav/OM schema）——
    {
      key: 'table',
      label: '绑定表',
      type: 'search-select',
      requiredWhen: { key: 'kind', value: '原子' },
      showWhen: { key: 'kind', value: '原子' },
      optionsResolver: () => metricBindTableOptions(),
      optionsLoad: () => ensureMetricBindTables(),
      placeholder: '搜索资产目录中的表…',
      searchKeys: ['label', 'sub', 'name', 'assetCode', 'search'],
      subKey: 'sub',
      hint: '选项来自已登记资产（gov_asset）；无列表请先在资产目录注册湖表',
      wide: true,
    },
    {
      key: 'field',
      label: '绑定字段',
      type: 'search-select',
      requiredWhen: { key: 'kind', value: '原子' },
      showWhen: { key: 'kind', value: '原子' },
      optionsByKey: 'table',
      optionsResolver: (form) => metricBindFieldOptions(form),
      optionsLoad: (form) => ensureMetricBindFields(form?.table),
      placeholder: '搜索列名…',
      searchKeys: ['label', 'name', 'type', 'comment'],
      hint: '列来自资产 schema（元数据优先，目录回退）',
      wide: true,
    },
    {
      key: 'agg',
      label: '聚合方式',
      type: 'select',
      requiredWhen: { key: 'kind', value: '原子' },
      showWhen: { key: 'kind', value: '原子' },
      options: ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COUNT DISTINCT'],
      default: 'COUNT',
    },
    // —— 衍生 ——
    {
      key: 'atomRef',
      label: '依赖原子指标',
      type: 'search-select',
      requiredWhen: { key: 'kind', value: '衍生' },
      showWhen: { key: 'kind', value: '衍生' },
      optionsResolver: () => metricAtomOptions(),
      placeholder: '搜索并选择原子指标（空目录请先建原子）',
      searchKeys: ['name', 'caliber', 'value'],
      subKey: 'sub',
      default: '',
      wide: true,
    },
    // —— 复合 ——
    {
      key: 'deriveRef',
      label: '依赖衍生/原子指标',
      type: 'multi-search-select',
      requiredWhen: { key: 'kind', value: '复合' },
      showWhen: { key: 'kind', value: '复合' },
      optionsResolver: () => metricDeriveAtomOptions(),
      placeholder: '搜索并多选衍生 / 原子指标',
      searchKeys: ['name', 'caliber', 'type', 'value'],
      subKey: 'sub',
      default: [],
      wide: true,
    },
    // —— 复合 · 仅公式 ——
    {
      key: 'formula',
      label: '计算公式',
      type: 'preset-text',
      required: true,
      showWhen: { key: 'kind', value: '复合' },
      presets: [
        {
          key: 'ratio',
          label: '比率 · ref0 / ref1（推荐）',
          value: '{ref0} / {ref1}',
        },
        {
          key: 'pct',
          label: '占比 · (ref0 - ref1) / ref0',
          value: '({ref0} - {ref1}) / {ref0}',
        },
        {
          key: 'sum',
          label: '求和 · ref0 + ref1',
          value: '{ref0} + {ref1}',
        },
        {
          key: 'product',
          label: '乘积 · ref0 * ref1',
          value: '{ref0} * {ref1}',
        },
      ],
      placeholder: '仅写指标 ID 与运算，如 {ref0} / {ref1}',
      presetHint: '改依赖后会自动刷新 ID；切「自定义…」可手写',
      validate: (v) => {
        const parsed = parseMetricFormula(v)
        return parsed.ok ? '' : parsed.error
      },
      hint: '复合指标只定义计算公式；粒度/周期继承各依赖指标，此处不配置。',
      wide: true,
    },
    // —— 衍生 · 业务限定 + 粒度 + 周期（无计算公式）——
    {
      key: 'qualifier',
      label: '业务限定',
      type: 'multi-search-select',
      showWhen: { key: 'kind', value: '衍生' },
      optionsResolver: (form) => metricQualifierOptionsForAtom(form.atomRef),
      placeholder: '可选业务过滤条件（非时间）；不选=无限定',
      searchKeys: ['name', 'group', 'value', 'sub'],
      subKey: 'sub',
      default: [],
      wide: true,
      hint: '业务限定 ≈ WHERE 非时间条件。聚合只在原子指标定义；衍生不写计算公式。',
    },
    {
      key: 'dim',
      label: '统计粒度',
      type: 'multi-search-select',
      showWhen: { key: 'kind', value: '衍生' },
      optionsResolver: (form) => metricDimOptionsForAtom(form.atomRef),
      placeholder: '从依赖原子指标绑定表字段中多选（不选=全表）',
      searchKeys: ['name', 'group', 'type', 'value'],
      subKey: 'sub',
      default: [],
      wide: true,
      validate: (v, form) => {
        const keys = refsToArray(v)
        const opts = metricDimOptionsForAtom(form.atomRef)
        if (!opts.length) return '请先选择依赖原子指标'
        const allow = new Set(opts.map((o) => o.value))
        const bad = keys.find((k) => !allow.has(k))
        if (bad) return `「${bad}」不在依赖原子指标绑定表可粒度字段中`
        return ''
      },
      hint: '统计粒度 = GROUP BY。衍生 = 原子 + 业务限定 + 统计粒度 + 统计周期。',
    },
    {
      key: 'time',
      label: '统计周期',
      type: 'select',
      requiredWhen: { key: 'kind', value: '衍生' },
      showWhen: { key: 'kind', value: '衍生' },
      options: ['近1天', '近7天', '近30天', '自然日', '自然周', '自然月', '累计'],
      default: '近1天',
      hint: '统计周期 ≈ WHERE 时间范围；与粒度中的 dt（按日切开）不同。',
    },
    {
      key: 'caliber',
      label: '口径定义',
      type: 'textarea',
      required: true,
      placeholder: '业务统计口径说明（衍生可不写计算式，描述组合语义即可）',
      wide: true,
    },
    {
      key: 'owner',
      label: '负责人',
      type: 'search-select',
      optionsResolver: (form) => {
        const list = [...workspaceUserOptions()]
        const cur = String(form?.owner || '').trim()
        if (cur && !list.some((o) => String(o.value) === cur)) {
          list.unshift({
            value: cur,
            label: cur,
            sub: '当前负责人',
            account: '',
            name: cur,
          })
        }
        return list
      },
      optionsLoad: () => ensureWorkspaceUserOptions(),
      placeholder: '搜索姓名 / 账号',
      searchKeys: ['name', 'account', 'label', 'sub'],
      subKey: 'sub',
      default: '',
      hint: '选项来自系统用户；提交存用户 id',
    },
  ],
}
