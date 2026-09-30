/** 数据服务 UI 状态文案（多页复用） */

export function apiLifecycleMeta(row) {
  if (!row) return { label: '—', cls: 'tag-gray' }
  const st = row.state
  const ts = row.publishTicketStatus
  if (st === 'published') return { label: '已发布', cls: 'tag-green' }
  if (st === 'retired') return { label: '已下线', cls: 'tag-gray' }
  if (ts === 'pending') return { label: '待发布·审核中', cls: 'tag-orange' }
  if (ts === 'rejected') return { label: '已驳回·待重改', cls: 'tag-red' }
  if (ts === 'approved' && st !== 'published') return { label: '待上线', cls: 'tag-blue' }
  if (st === 'draft' || !st) return { label: '草稿', cls: 'tag-gray' }
  return { label: row.level || st, cls: row.levelCls || 'tag-gray' }
}

export function publishTicketStatusLabel(status) {
  if (status === 'pending') return '待审核'
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已驳回'
  return status || '—'
}
