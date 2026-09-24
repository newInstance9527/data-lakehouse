import { ref } from 'vue'
import { createApplyTicket, approveTicket, pageMyTickets, pagePendingTickets } from '@/api/apply'

/**
 * 申请中心看板（模块单例）：出湖页与申请中心共用 pending / mine。
 * 无演示种子；启动 hydrate 拉服务端；create 失败只抛错，不落本地假单。
 */
const pending = ref([])
const mine = ref([])
const boardHydrated = ref(false)

function nowLabel() {
  return new Date()
    .toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(/\//g, '-')
}

function parsePayload(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/** 后端 ApplyTicket → 看板卡片 */
export function mapServerTicket(t, sideHint) {
  if (!t) return null
  const payload = parsePayload(t.payload)
  const isExport = t.ticketType === 'lake_export' || t.ticketType === 'export'
  const isOps = t.ticketType === 'resource_manage' || t.ticketType === 'manage'
  const isApiPublish = t.ticketType === 'api_publish' || t.ticketType === 'publish_api'
  const isScriptPublish = t.ticketType === 'script_publish' || t.ticketType === 'package_publish'
  const isApiSubscribe = t.ticketType === 'api_subscribe' || t.ticketType === 'subscribe'
  const isMetric = t.ticketType === 'metric' || t.ticketType === 'metric_publish'
  const isScanElevate =
    t.ticketType === 'scan_elevate' || t.ticketType === 'elevated' || t.ticketType === 'scan_quota'
  const type = isExport
    ? 'export'
    : isOps
      ? 'ops'
      : isScriptPublish
        ? 'publish'
        : isApiPublish
          ? 'api_publish'
          : isApiSubscribe
            ? 'api'
            : isMetric
              ? 'metric'
              : isScanElevate
                ? 'scan_elevate'
                : t.ticketType === 'table_read'
                  ? 'perm'
                  : t.ticketType || 'perm'
  const status = t.status || sideHint || 'pending'
  const side = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending'
  const awaitingSecurity = status === 'pending_security' || payload.approvalStep === 'security'
  const requiresSecurityCosign = Boolean(payload.requiresSecurityCosign) || awaitingSecurity
  const sensitivity = payload.sensitivity || ''
  const tableLabel = payload.exportTable || payload.assetCode || t.title || t.ticketNo
  const targetLabel = payload.exportTarget || '—'
  const expireLabel = payload.expireLabel || '—'
  const purposeText = t.reason || payload.purpose || ''
  const ticketNo = t.ticketNo || t.id
  const id = t.id || ticketNo
  const rejectRemark = t.remark || ''

  if (type === 'export') {
    const base = {
      id,
      serverId: t.id,
      fromServer: true,
      ticketNo,
      type: 'export',
      side,
      awaitingSecurity,
      requiresSecurityCosign,
      sensitivity,
      asset: tableLabel,
      target: targetLabel,
      purpose: purposeText,
      expire: expireLabel,
      applicant: t.applicant || '我',
      exportJob: {
        job: ticketNo,
        src: String(tableLabel).replace(/^(ads|dwd|dws)\./, '').replace(/^[\w]+\./, '') || tableLabel,
        target: targetLabel,
        purpose: String(purposeText).slice(0, 40),
        freq: side === 'approved' ? '审批通过' : awaitingSecurity ? '待安全加签' : '待 Owner',
        mask: '待配置',
        expire: expireLabel,
        status: side === 'approved' ? 'ok' : 'warn',
      },
    }
    if (side === 'pending') {
      const statusTag = awaitingSecurity
        ? '待安全加签'
        : requiresSecurityCosign
          ? '待 Owner → 安全加签'
          : '待 Owner'
      return {
        ...base,
        titleHtml: `<span class="tag tag-purple">出湖</span> ${base.applicant} 申请 ${tableLabel} → ${targetLabel}`,
        statusTag,
        statusCls: 'tag-orange',
        time: t.createTime || nowLabel(),
        desc: `链路 J：${tableLabel} → ${targetLabel} · 时效 ${expireLabel} · 用途：${purposeText} · 单号 ${ticketNo}${
          sensitivity ? ` · 敏感级 ${sensitivity}` : ''
        }`,
        timeline: awaitingSecurity
          ? [
              { label: '✓ 提交', cls: 'done' },
              { label: '✓ Owner', cls: 'done' },
              { label: '● 安全加签', cls: 'current' },
              { label: '作业上线', cls: '' },
            ]
          : requiresSecurityCosign
            ? [
                { label: '✓ 提交', cls: 'done' },
                { label: '● Owner', cls: 'current' },
                { label: '安全加签', cls: '' },
                { label: '作业上线', cls: '' },
              ]
            : [
                { label: '✓ 提交', cls: 'done' },
                { label: '● Owner', cls: 'current' },
                { label: '脱敏配置', cls: '' },
                { label: '作业上线', cls: '' },
              ],
      }
    }
    return {
      ...base,
      titleHtml: `<span class="tag tag-green">已通过</span> ${tableLabel} 出湖 → ${targetLabel} · ${ticketNo}`,
      time: t.approvedAt || t.updateTime || nowLabel(),
      desc: `已批准出湖 · 单号 ${ticketNo}（填回 ETL sink ticketNo）· 目标 ${targetLabel} · 时效 ${expireLabel}`,
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: requiresSecurityCosign ? '✓ Owner + 安全加签' : '✓ Owner', cls: 'done' },
        { label: '✓ 可配置脱敏/作业', cls: 'done' },
        { label: `✓ ticketNo ${ticketNo}`, cls: 'done' },
      ],
    }
  }

  if (type === 'ops') {
    const rt = payload.resourceType || 'asset'
    const rn = payload.resourceName || payload.resourceId || t.title || id
    const privilege = String(payload.privilege || 'MANAGE').toUpperCase()
    const typeTag =
      rt === 'datasource' ? '数据源' : rt === 'etl' ? 'ETL' : rt === 'asset' ? '资产' : rt
    return {
      id,
      serverId: t.id,
      fromServer: true,
      ticketNo,
      type: 'ops',
      side,
      resourceType: rt,
      resourceId: payload.resourceId,
      privilege,
      asset: rn,
      purpose: purposeText,
      expire: expireLabel,
      applicant: t.applicant || '我',
      titleHtml:
        side === 'approved'
          ? `<span class="tag tag-green">已通过</span> ${typeTag}操作权 · ${rn}`
          : `<span class="tag tag-blue">操作权限</span> 申请 ${typeTag}「${rn}」${privilege}权`,
      statusTag: side === 'pending' ? '待审批' : side === 'approved' ? `已授 ${privilege}` : '已驳回',
      statusCls: side === 'approved' ? 'tag-green' : 'tag-orange',
      time: t.createTime || nowLabel(),
      desc: purposeText || `privilege=${privilege} · ${rt}:${payload.resourceId || ''} · ${ticketNo}`,
      timeline:
        side === 'approved'
          ? [
              { label: '✓ 提交', cls: 'done' },
              { label: '✓ 审批', cls: 'done' },
              { label: `✓ ${privilege} 生效`, cls: 'done' },
            ]
          : [
              { label: '✓ 提交', cls: 'done' },
              { label: '● 审批', cls: 'current' },
              { label: `写 ${privilege} grant`, cls: '' },
            ],
    }
  }

  if (type === 'api_publish') {
    const path = payload.publicPath || payload.path || t.title || ticketNo
    const method = String(payload.method || 'GET').toUpperCase()
    return {
      id,
      serverId: t.id,
      fromServer: true,
      ticketNo,
      type: 'api_publish',
      side,
      apiBindingId: payload.apiBindingId,
      apiPath: path,
      method,
      purpose: purposeText,
      expire: expireLabel,
      remark: rejectRemark,
      applicant: t.applicant || '我',
      titleHtml:
        side === 'approved'
          ? `<span class="tag tag-green">API 发布</span> 已上线 ${method} ${path} · ${ticketNo}`
          : side === 'rejected'
            ? `<span class="tag tag-red">API 发布</span> 已驳回 ${method} ${path} · ${ticketNo}`
            : `<span class="tag tag-purple">API 发布</span> ${method} ${path}`,
      statusTag: side === 'pending' ? '待审核·通过后自动发布' : side === 'approved' ? '已自动发布' : '已驳回·请重改',
      statusCls: side === 'approved' ? 'tag-green' : side === 'rejected' ? 'tag-red' : 'tag-orange',
      time: t.createTime || nowLabel(),
      desc:
        side === 'rejected'
          ? `驳回意见：${rejectRemark || '请修改后重新申请发布'} · 单号 ${ticketNo}`
          : side === 'approved'
            ? `API 发布申请已通过并自动上线 · 单号 ${ticketNo}`
            : purposeText ||
              `API 发布申请 · 待审核通过后自动发布 · 绑定 ${payload.apiBindingId || '—'} · ${ticketNo}`,
      timeline:
        side === 'approved'
          ? [
              { label: '✓ 保存/申请发布', cls: 'done' },
              { label: '✓ 审核通过', cls: 'done' },
              { label: '✓ 自动发布', cls: 'done' },
              { label: '✓ 可调用', cls: 'done' },
            ]
          : side === 'rejected'
            ? [
                { label: '✓ 申请发布', cls: 'done' },
                { label: '✗ 退回重改', cls: 'done' },
                { label: '改后重提', cls: 'current' },
              ]
            : [
                { label: '✓ 申请发布', cls: 'done' },
                { label: '● 待审核', cls: 'current' },
                { label: '自动发布', cls: '' },
                { label: '可调用', cls: '' },
              ],
    }
  }

  if (type === 'api') {
    const path = payload.publicPath || payload.path || t.title || ticketNo
    const app = payload.consumerName || t.applicant || '应用'
    const qps = payload.qps || 100
    return {
      id,
      serverId: t.id,
      fromServer: true,
      ticketNo,
      type: 'api',
      side,
      apiBindingId: payload.apiBindingId,
      apiPath: path,
      app,
      qps,
      purpose: purposeText,
      expire: expireLabel,
      remark: rejectRemark,
      applicant: t.applicant || '我',
      titleHtml:
        side === 'approved'
          ? `<span class="tag tag-green">API 调用</span> ${app} · ${path} · ${ticketNo}`
          : side === 'rejected'
            ? `<span class="tag tag-red">API 调用</span> 已驳回 ${app} · ${path}`
            : `<span class="tag tag-blue">API 调用</span> ${app} 申请 ${path}`,
      statusTag: side === 'pending' ? '待审核·通过后签发 Key' : side === 'approved' ? '已签发调用 Key' : '已驳回·请重改',
      statusCls: side === 'approved' ? 'tag-green' : side === 'rejected' ? 'tag-red' : 'tag-orange',
      time: t.createTime || nowLabel(),
      desc:
        side === 'rejected'
          ? `驳回意见：${rejectRemark || '请修改后重提'} · 单号 ${ticketNo}`
          : purposeText || `API 调用申请 · 应用 ${app} · ${qps} QPS · 时效 ${expireLabel} · ${ticketNo}`,
      timeline:
        side === 'approved'
          ? [
              { label: '✓ 提交', cls: 'done' },
              { label: '✓ API Owner', cls: 'done' },
              { label: '✓ 签发令牌', cls: 'done' },
              { label: '✓ Gateway', cls: 'done' },
            ]
          : side === 'rejected'
            ? [
                { label: '✓ 提交', cls: 'done' },
                { label: '✗ 已驳回', cls: 'done' },
                { label: '改后重提', cls: 'current' },
              ]
            : [
                { label: '✓ 提交', cls: 'done' },
                { label: '● API Owner', cls: 'current' },
                { label: '签发令牌', cls: '' },
                { label: 'Gateway 生效', cls: '' },
              ],
    }
  }

  if (type === 'publish') {
    const pkg = payload.releaseId || payload.pkg || t.title || ticketNo
    const env = payload.publishEnv || 'stg'
    return {
      id,
      serverId: t.id,
      fromServer: true,
      ticketNo,
      type: 'publish',
      side,
      releasePkg: pkg,
      publishEnv: env,
      rollbackPlan: payload.rollbackPlan || '',
      purpose: purposeText,
      expire: expireLabel,
      remark: rejectRemark,
      applicant: t.applicant || '我',
      titleHtml:
        side === 'approved'
          ? `<span class="tag tag-green">发布包</span> ${pkg} → ${env} · ${ticketNo}`
          : side === 'rejected'
            ? `<span class="tag tag-red">发布包</span> 已驳回 ${pkg} · ${ticketNo}`
            : `<span class="tag tag-purple">发布包</span> ${pkg} → ${env}`,
      statusTag: side === 'pending' ? '待审批·通过后可发布' : side === 'approved' ? '已通过·可点发布' : '已驳回',
      statusCls: side === 'approved' ? 'tag-green' : side === 'rejected' ? 'tag-red' : 'tag-orange',
      time: t.createTime || nowLabel(),
      desc:
        side === 'rejected'
          ? `驳回意见：${rejectRemark || '请修改后重提'} · 单号 ${ticketNo}`
          : side === 'approved'
            ? `脚本发布审批已通过 · 请到「环境与发布」完成门禁后发布 · ${ticketNo}`
            : purposeText || `脚本发布申请 · release ${payload.releaseId || '—'} · ${ticketNo}`,
      timeline:
        side === 'approved'
          ? [
              { label: '✓ 提交', cls: 'done' },
              { label: '✓ 审批', cls: 'done' },
              { label: '门禁/发布', cls: 'current' },
            ]
          : side === 'rejected'
            ? [
                { label: '✓ 提交', cls: 'done' },
                { label: '✗ 驳回', cls: 'done' },
                { label: '改后重提', cls: 'current' },
              ]
            : [
                { label: '✓ 提交', cls: 'done' },
                { label: '● 审批', cls: 'current' },
                { label: '门禁/发布', cls: '' },
              ],
    }
  }

  if (type === 'metric') {
    const metricKind = payload.metricKind || 'query'
    const metricId = payload.metricCode || payload.metricId || '—'
    const metricName = payload.metricName || ''
    const kindTag =
      metricKind === 'create' ? '指标发布' : metricKind === 'change' ? '口径变更' : '指标权限'
    const isPublish = metricKind === 'create' || metricKind === 'change'
    return {
      id,
      serverId: t.id,
      fromServer: true,
      ticketNo,
      type: 'metric',
      side,
      metricKind,
      metricId,
      metricName,
      purpose: purposeText,
      expire: expireLabel,
      remark: rejectRemark,
      caliberDiff: payload.caliberDiff || '',
      applicant: t.applicant || '我',
      titleHtml:
        side === 'approved'
          ? `<span class="tag tag-green">${kindTag}</span> ${metricId} ${metricName} · ${ticketNo}`
          : side === 'rejected'
            ? `<span class="tag tag-red">${kindTag}</span> 已驳回 ${metricId} · ${ticketNo}`
            : `<span class="tag tag-blue">${kindTag}</span> ${metricId} ${metricName}`,
      statusTag: side === 'pending'
        ? isPublish
          ? '待审核·通过后自动启用'
          : '待指标 Owner'
        : side === 'approved'
          ? isPublish
            ? '已自动启用'
            : '已授权'
          : '已驳回·请重改',
      statusCls: side === 'approved' ? 'tag-green' : side === 'rejected' ? 'tag-red' : 'tag-orange',
      time: t.createTime || nowLabel(),
      desc:
        side === 'rejected'
          ? `驳回意见：${rejectRemark || '请修改后重新申请发布'} · 单号 ${ticketNo}`
          : side === 'approved'
            ? isPublish
              ? `指标发布申请已通过并自动启用 · 单号 ${ticketNo}`
              : `指标查询权限已通过 · 单号 ${ticketNo}`
            : purposeText ||
              (isPublish
                ? `指标发布申请 · 待审核通过后自动启用 · ${metricId} · ${ticketNo}`
                : `指标查询权限 · ${metricId} · ${ticketNo}`),
      timeline:
        side === 'approved'
          ? isPublish
            ? [
                { label: '✓ 保存/申请发布', cls: 'done' },
                { label: '✓ 审核通过', cls: 'done' },
                { label: '✓ 自动启用', cls: 'done' },
                { label: '✓ 可引用', cls: 'done' },
              ]
            : [
                { label: '✓ 提交', cls: 'done' },
                { label: '✓ 指标 Owner', cls: 'done' },
                { label: '✓ 已授权', cls: 'done' },
              ]
          : side === 'rejected'
            ? [
                { label: '✓ 申请发布', cls: 'done' },
                { label: '✗ 退回重改', cls: 'done' },
                { label: '改后重提', cls: 'current' },
              ]
            : isPublish
              ? [
                  { label: '✓ 申请发布', cls: 'done' },
                  { label: '● 待审核', cls: 'current' },
                  { label: '自动启用', cls: '' },
                  { label: '可引用', cls: '' },
                ]
              : [
                  { label: '✓ 提交', cls: 'done' },
                  { label: '● 指标 Owner', cls: 'current' },
                  { label: '写入授权', cls: '' },
                ],
    }
  }

  if (type === 'scan_elevate') {
    return {
      id,
      serverId: t.id,
      fromServer: true,
      ticketNo,
      type: 'scan_elevate',
      side,
      purpose: purposeText,
      expire: expireLabel,
      remark: rejectRemark,
      applicant: t.applicant || '我',
      titleHtml:
        side === 'approved'
          ? `<span class="tag tag-green">扫描抬额</span> 硬顶 50GB · ${ticketNo}`
          : side === 'rejected'
            ? `<span class="tag tag-red">扫描抬额</span> 已驳回 · ${ticketNo}`
            : `<span class="tag tag-orange">扫描抬额</span> 申请硬顶 50GB`,
      statusTag:
        side === 'pending' ? '待审批·通过后可 elevated' : side === 'approved' ? '已授 SCAN_ELEVATE' : '已驳回',
      statusCls: side === 'approved' ? 'tag-green' : side === 'rejected' ? 'tag-red' : 'tag-orange',
      time: t.createTime || nowLabel(),
      desc:
        side === 'rejected'
          ? `驳回意见：${rejectRemark || '请修改后重提'} · 单号 ${ticketNo}`
          : purposeText || `即席扫描抬额至平台硬顶 50GB · 时效 ${expireLabel} · ${ticketNo}`,
      timeline:
        side === 'approved'
          ? [
              { label: '✓ 提交', cls: 'done' },
              { label: '✓ 审批', cls: 'done' },
              { label: '✓ SCAN_ELEVATE', cls: 'done' },
            ]
          : side === 'rejected'
            ? [
                { label: '✓ 提交', cls: 'done' },
                { label: '✗ 已驳回', cls: 'done' },
                { label: '改后重提', cls: 'current' },
              ]
            : [
                { label: '✓ 提交', cls: 'done' },
                { label: '● 审批中', cls: 'current' },
                { label: '写 SCAN_ELEVATE', cls: '' },
              ],
    }
  }

  // table_read / perm
  const assetLabel = payload.assetCode || payload.assetId || t.title || id
  const permStatusTag = (() => {
    if (side === 'approved') return '已授权'
    if (side === 'rejected') return '已驳回·请重改'
    if (awaitingSecurity) return '待安全加签'
    if (requiresSecurityCosign) return '待 Owner → 安全加签'
    return '待 Owner'
  })()
  return {
    id,
    serverId: t.id,
    fromServer: true,
    ticketNo,
    type: 'perm',
    side,
    awaitingSecurity,
    requiresSecurityCosign,
    sensitivity,
    asset: assetLabel,
    purpose: purposeText,
    expire: expireLabel,
    remark: rejectRemark,
    columns: payload.columns || '',
    permMode: payload.privilege === 'SELECT' ? 'read' : payload.privilege || 'read',
    permLevel: sensitivity || undefined,
    applicant: t.applicant || '我',
    titleHtml:
      side === 'approved'
        ? `<span class="tag tag-green">已通过</span> ${assetLabel} · 表读权限`
        : side === 'rejected'
          ? `<span class="tag tag-red">已驳回</span> ${assetLabel} · 表读权限`
          : `<span class="tag tag-orange">处理中</span> 我申请 ${assetLabel} 读权限`,
    statusTag: permStatusTag,
    statusCls: side === 'approved' ? 'tag-green' : side === 'rejected' ? 'tag-red' : 'tag-orange',
    time: t.createTime || nowLabel(),
    desc:
      side === 'rejected'
        ? `驳回意见：${rejectRemark || '请修改后重提'} · 单号 ${ticketNo}`
        : purposeText || t.title,
    timeline: side === 'approved'
      ? [
          { label: '✓ 提交', cls: 'done' },
          { label: requiresSecurityCosign ? '✓ Owner + 安全加签' : '✓ 审批', cls: 'done' },
          { label: '✓ sec_auth_grant', cls: 'done' },
        ]
      : side === 'rejected'
        ? [
            { label: '✓ 提交', cls: 'done' },
            { label: '✗ 已驳回', cls: 'done' },
            { label: '改后重提', cls: 'current' },
          ]
        : awaitingSecurity
          ? [
              { label: '✓ 提交', cls: 'done' },
              { label: '✓ Owner', cls: 'done' },
              { label: '● 安全加签', cls: 'current' },
              { label: '写 grant', cls: '' },
            ]
          : requiresSecurityCosign
            ? [
                { label: '✓ 提交', cls: 'done' },
                { label: '● Owner', cls: 'current' },
                { label: '安全加签', cls: '' },
                { label: '写 grant', cls: '' },
              ]
            : [
                { label: '✓ 提交', cls: 'done' },
                { label: '● Owner', cls: 'current' },
                { label: '写 grant', cls: '' },
              ],
  }
}

function upsertBoardCard(listRef, card, preferFront = true) {
  if (!card?.id) return
  const idx = listRef.value.findIndex((x) => x.id === card.id || (card.ticketNo && x.ticketNo === card.ticketNo))
  if (idx >= 0) {
    listRef.value.splice(idx, 1, { ...listRef.value[idx], ...card })
  } else if (preferFront) {
    listRef.value.unshift(card)
  } else {
    listRef.value.push(card)
  }
}

/**
 * 从后端刷新申请看板（含 metric / api_publish 等）
 * @param {string} [ws] 工作空间；缺省不过滤
 */
export async function hydrateApplyBoardFromServer(ws) {
  try {
    const q = { current: 1, size: 50 }
    if (ws) q.ws = ws
    const [minePage, pendingPage] = await Promise.all([
      pageMyTickets(q),
      pagePendingTickets(q).catch(() => ({ records: [] })),
    ])
    const mineRecs = minePage?.records || minePage?.rows || []
    const pendRecs = pendingPage?.records || pendingPage?.rows || []

    mine.value = []
    pending.value = []

    for (const t of mineRecs) {
      const card = mapServerTicket(t)
      if (card) upsertBoardCard(mine, card)
    }
    for (const t of pendRecs) {
      const card = mapServerTicket(t, 'pending')
      if (card && card.side === 'pending') upsertBoardCard(pending, card)
    }
    boardHydrated.value = true
    return true
  } catch {
    boardHydrated.value = false
    return false
  }
}

/**
 * 提交出湖申请（出湖页 / 申请中心共用）→ 优先后端 lake_export
 * @returns {Promise<{ id: string, ticketNo: string, expire: string, fromServer?: boolean }>}
 */
export async function pushExportApply({
  table,
  purpose,
  target,
  expire,
  applicant = '我',
} = {}) {
  const tableLabel = String(table || '').trim() || '（未选表）'
  const targetLabel = String(target || '').trim() || '（未填目标）'
  const purposeText = String(purpose || '').trim() || '出湖回流'
  const expireLabel = String(expire || '30天')

  try {
    const server = await createApplyTicket({
      ticketType: 'lake_export',
      title: `出湖 · ${tableLabel} → ${targetLabel}`,
      reason: purposeText,
      exportTable: tableLabel,
      exportTarget: targetLabel,
      expireLabel,
    })
    const card = mapServerTicket(server, 'pending')
    if (card) {
      upsertBoardCard(mine, {
        ...card,
        titleHtml: `<span class="tag tag-orange">处理中</span> 我申请 ${tableLabel} 出湖 → ${targetLabel}`,
        applicant,
      })
      upsertBoardCard(pending, card)
    }
    return {
      id: server?.id || card?.id,
      ticketNo: server?.ticketNo || card?.ticketNo,
      expire: expireLabel,
      fromServer: true,
    }
  } catch (e) {
    throw e
  }
}

/** 审批通过出湖单：须服务端工单 */
export async function approveExportOnBoard(ticket) {
  if (!ticket || ticket.type !== 'export') return null
  const ticketNo = ticket.ticketNo || ticket.id
  if (!(ticket.fromServer || ticket.serverId)) {
    throw new Error('仅支持服务端出湖工单审批')
  }
  try {
    const res = await approveTicket(ticket.serverId || ticket.id)
    const approvedNo = res?.ticketNo || res?.ticket?.ticketNo || ticketNo
    if (res?.awaitingSecurity || res?.status === 'pending_security') {
      const mid = mapServerTicket(res.ticket || { ...ticket, status: 'pending_security', ticketNo: approvedNo })
      await hydrateApplyBoardFromServer().catch(() => {})
      return { ticketNo: approvedNo, awaitingSecurity: true, approved: mid, fromServer: true }
    }
    const approved = {
      ...ticket,
      side: 'approved',
      awaitingSecurity: false,
      ticketNo: approvedNo,
      titleHtml: `<span class="tag tag-green">已通过</span> ${ticket.asset || '—'} 出湖 → ${ticket.target || '—'} · ${approvedNo}`,
      time: nowLabel(),
      desc: `已批准出湖 · 单号 ${approvedNo}（填回 ETL sink ticketNo）· 目标 ${ticket.target || '—'} · 时效 ${ticket.expire || '—'}`,
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: '✓ Owner + 安全加签', cls: 'done' },
        { label: '✓ 可配置脱敏/作业', cls: 'done' },
        { label: `✓ ticketNo ${approvedNo}`, cls: 'done' },
      ],
      exportJob: ticket.exportJob
        ? { ...ticket.exportJob, freq: '审批通过', status: 'ok', mask: ticket.exportJob.mask || '待配置' }
        : null,
    }
    const mineIdx = mine.value.findIndex((m) => m.id === ticket.id && m.side === 'pending')
    if (mineIdx >= 0) mine.value.splice(mineIdx, 1, approved)
    else mine.value.unshift(approved)
    return { ticketNo: approvedNo, approved, fromServer: true }
  } catch (e) {
    throw e
  }
}

export function useApplyBoard() {
  return { pending, mine, boardHydrated, pushExportApply, approveExportOnBoard, hydrateApplyBoardFromServer }
}
