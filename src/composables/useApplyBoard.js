import { ref } from 'vue'
import { createApplyTicket, approveTicket, pageMyTickets, pagePendingTickets } from '@/api/apply'

/**
 * 申请中心看板（模块单例）：出湖页与申请中心共用 pending / mine。
 * 无演示种子；启动 hydrate 拉服务端；接口失败时的本地降级单仍可暂存。
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
  const type = isExport
    ? 'export'
    : isOps
      ? 'ops'
      : isApiPublish
        ? 'publish'
        : t.ticketType === 'table_read'
          ? 'perm'
          : t.ticketType || 'perm'
  const status = t.status || sideHint || 'pending'
  const side = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending'
  const tableLabel = payload.exportTable || payload.assetCode || t.title || t.ticketNo
  const targetLabel = payload.exportTarget || '—'
  const expireLabel = payload.expireLabel || '—'
  const purposeText = t.reason || payload.purpose || ''
  const ticketNo = t.ticketNo || t.id
  const id = t.id || ticketNo

  if (type === 'export') {
    const base = {
      id,
      serverId: t.id,
      fromServer: true,
      ticketNo,
      type: 'export',
      side,
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
        freq: side === 'approved' ? '审批通过' : '待审批',
        mask: '待配置',
        expire: expireLabel,
        status: side === 'approved' ? 'ok' : 'warn',
      },
    }
    if (side === 'pending') {
      return {
        ...base,
        titleHtml: `<span class="tag tag-purple">出湖</span> ${base.applicant} 申请 ${tableLabel} → ${targetLabel}`,
        statusTag: '待安全+域负责人',
        statusCls: 'tag-orange',
        time: t.createTime || nowLabel(),
        desc: `链路 J：${tableLabel} → ${targetLabel} · 时效 ${expireLabel} · 用途：${purposeText} · 单号 ${ticketNo}`,
        timeline: [
          { label: '✓ 提交', cls: 'done' },
          { label: '● 安全/域负责人', cls: 'current' },
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
        { label: '✓ 安全/域负责人', cls: 'done' },
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

  if (type === 'publish') {
    const path = payload.publicPath || payload.path || t.title || ticketNo
    const method = String(payload.method || 'GET').toUpperCase()
    return {
      id,
      serverId: t.id,
      fromServer: true,
      ticketNo,
      type: 'publish',
      side,
      apiBindingId: payload.apiBindingId,
      apiPath: path,
      method,
      purpose: purposeText,
      expire: expireLabel,
      applicant: t.applicant || '我',
      titleHtml:
        side === 'approved'
          ? `<span class="tag tag-green">已通过</span> API 发布 ${method} ${path} · ${ticketNo}`
          : `<span class="tag tag-purple">发布</span> API ${method} ${path}`,
      statusTag: side === 'pending' ? '待 API Owner' : side === 'approved' ? '可发布' : '已驳回',
      statusCls: side === 'approved' ? 'tag-green' : 'tag-orange',
      time: t.createTime || nowLabel(),
      desc:
        purposeText ||
        `api_publish · 绑定 ${payload.apiBindingId || '—'} · 单号 ${ticketNo}（填回工作台发布门禁）`,
      timeline:
        side === 'approved'
          ? [
              { label: '✓ 提交', cls: 'done' },
              { label: '✓ API Owner', cls: 'done' },
              { label: `✓ ${ticketNo}`, cls: 'done' },
            ]
          : [
              { label: '✓ 提交', cls: 'done' },
              { label: '● API Owner', cls: 'current' },
              { label: '工作台发布', cls: '' },
            ],
    }
  }

  // table_read / perm
  const assetLabel = payload.assetCode || payload.assetId || t.title || id
  return {
    id,
    serverId: t.id,
    fromServer: true,
    ticketNo,
    type: 'perm',
    side,
    asset: assetLabel,
    purpose: purposeText,
    expire: expireLabel,
    columns: payload.columns || '',
    permMode: payload.privilege === 'SELECT' ? 'read' : payload.privilege || 'read',
    applicant: t.applicant || '我',
    titleHtml:
      side === 'approved'
        ? `<span class="tag tag-green">已通过</span> ${assetLabel} · 表读权限`
        : `<span class="tag tag-orange">处理中</span> 我申请 ${assetLabel} 读权限`,
    statusTag: side === 'pending' ? '待 Owner' : side === 'approved' ? '已授权' : '已驳回',
    statusCls: side === 'approved' ? 'tag-green' : 'tag-orange',
    time: t.createTime || nowLabel(),
    desc: purposeText || t.title,
    timeline:
      side === 'approved'
        ? [
            { label: '✓ 提交', cls: 'done' },
            { label: '✓ 审批', cls: 'done' },
            { label: '✓ sec_auth_grant', cls: 'done' },
          ]
        : [
            { label: '✓ 提交', cls: 'done' },
            { label: '● 审批中', cls: 'current' },
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
 * 从后端刷新 perm + export 列表（失败则保留本会话降级单）
 */
export async function hydrateApplyBoardFromServer() {
  try {
    const [minePage, pendingPage] = await Promise.all([
      pageMyTickets({ current: 1, size: 50 }),
      pagePendingTickets({ current: 1, size: 50 }).catch(() => ({ records: [] })),
    ])
    const mineRecs = minePage?.records || minePage?.rows || []
    const pendRecs = pendingPage?.records || pendingPage?.rows || []

    // 清掉已同步服务端卡；保留本会话 API 失败降级单与其它 Tab 本地单
    mine.value = mine.value.filter((m) => !m.fromServer)
    pending.value = pending.value.filter((p) => !p.fromServer)

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
    // 降级本地演示单（无后端时）
    const ticketNo = `EXP-L${Date.now().toString().slice(-6)}`
    const id = ticketNo
    const now = nowLabel()
    const base = {
      id,
      ticketNo,
      type: 'export',
      side: 'pending',
      asset: tableLabel,
      target: targetLabel,
      purpose: purposeText,
      expire: expireLabel,
      applicant,
      fromServer: false,
      exportJob: {
        job: ticketNo,
        src: tableLabel.replace(/^(ads|dwd|dws)\./, '').replace(/^[\w]+\./, '') || tableLabel,
        target: targetLabel,
        purpose: purposeText.slice(0, 40),
        freq: '待审批',
        mask: '待配置',
        expire: expireLabel,
        status: 'warn',
      },
    }
    mine.value.unshift({
      ...base,
      titleHtml: `<span class="tag tag-orange">处理中</span> 我申请 ${tableLabel} 出湖 → ${targetLabel}`,
      time: now,
      desc: `用途：${purposeText} · 目标 ${targetLabel} · 时效 ${expireLabel} · 单号 ${ticketNo}（本地降级）`,
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: '● 安全/域负责人审批', cls: 'current' },
        { label: '作业可引用 ticketNo', cls: '' },
      ],
    })
    pending.value.unshift({
      ...base,
      titleHtml: `<span class="tag tag-purple">出湖</span> ${applicant} 申请 ${tableLabel} → ${targetLabel}`,
      statusTag: '待安全+域负责人',
      statusCls: 'tag-orange',
      desc: `链路 J：${tableLabel} → ${targetLabel} · 时效 ${expireLabel} · 用途：${purposeText} · 单号 ${ticketNo}`,
      timeline: [
        { label: '✓ 提交', cls: 'done' },
        { label: '● 安全/域负责人', cls: 'current' },
        { label: '脱敏配置', cls: '' },
        { label: '作业上线', cls: '' },
      ],
    })
    const err = e?.message || String(e)
    console.warn('pushExportApply fallback local:', err)
    return { id, ticketNo, expire: expireLabel, fromServer: false, degraded: true, message: err }
  }
}

/** 审批通过出湖单：优先后端，再回写看板 */
export async function approveExportOnBoard(ticket) {
  if (!ticket || ticket.type !== 'export') return null
  const ticketNo = ticket.ticketNo || ticket.id
  if (ticket.fromServer || ticket.serverId) {
    try {
      const res = await approveTicket(ticket.serverId || ticket.id)
      const approvedNo = res?.ticketNo || res?.ticket?.ticketNo || ticketNo
      const approved = {
        ...ticket,
        side: 'approved',
        ticketNo: approvedNo,
        titleHtml: `<span class="tag tag-green">已通过</span> ${ticket.asset || '—'} 出湖 → ${ticket.target || '—'} · ${approvedNo}`,
        time: nowLabel(),
        desc: `已批准出湖 · 单号 ${approvedNo}（填回 ETL sink ticketNo）· 目标 ${ticket.target || '—'} · 时效 ${ticket.expire || '—'}`,
        timeline: [
          { label: '✓ 提交', cls: 'done' },
          { label: '✓ 安全/域负责人', cls: 'done' },
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

  // 本地演示单
  const approved = {
    ...ticket,
    side: 'approved',
    ticketNo,
    titleHtml: `<span class="tag tag-green">已通过</span> ${ticket.asset || '—'} 出湖 → ${ticket.target || '—'} · ${ticketNo}`,
    time: nowLabel(),
    desc: `已批准出湖 · 单号 ${ticketNo}（填回 ETL sink ticketNo）· 目标 ${ticket.target || '—'} · 时效 ${ticket.expire || '—'} · ${ticket.purpose || ''}`,
    timeline: [
      { label: '✓ 提交', cls: 'done' },
      { label: '✓ 安全/域负责人', cls: 'done' },
      { label: '✓ 可配置脱敏/作业', cls: 'done' },
      { label: `✓ ticketNo ${ticketNo}`, cls: 'done' },
    ],
    exportJob: ticket.exportJob
      ? { ...ticket.exportJob, freq: '审批通过', status: 'ok', mask: ticket.exportJob.mask || '待配置' }
      : null,
  }
  const mineIdx = mine.value.findIndex((m) => m.id === ticket.id && m.side === 'pending')
  if (mineIdx >= 0) mine.value.splice(mineIdx, 1, approved)
  else mine.value.unshift(approved)
  return { ticketNo, approved, fromServer: false }
}

export function useApplyBoard() {
  return { pending, mine, boardHydrated, pushExportApply, approveExportOnBoard, hydrateApplyBoardFromServer }
}
