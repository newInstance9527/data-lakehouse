/**
 * 指标目录按钮 ACL：状态 ∩（owner / 特权）
 * 与后端 assertCanEditMetric、草稿 forceMineOnly 对齐
 */
import { isResourceOwner } from '@/composables/useSession'
import { metricActions } from '@/data/metrics'

export function isMetricOwner(row, user) {
  return isResourceOwner(row, user, ['createUser', 'owner'])
}

function privileged(ctx = {}) {
  return Boolean(ctx.canScopeAll || ctx.isSuperAdmin)
}

export function canEditMetric(row, user, ctx = {}) {
  if (!row || !user) return false
  if (!['draft', 'review'].includes(row.status)) return false
  if (privileged(ctx)) return true
  return isMetricOwner(row, user)
}

export function canApplyPublishMetric(row, user, ctx = {}) {
  if (!row || row.status !== 'draft') return false
  if (privileged(ctx)) return true
  return isMetricOwner(row, user)
}

export function canApplyQueryMetric(row) {
  return row?.status === 'active'
}

export function canApplyChangeMetric(row, user, ctx = {}) {
  if (!row || !['active', 'version_review'].includes(row.status)) return false
  if (privileged(ctx)) return true
  return isMetricOwner(row, user)
}

export function canDeprecateMetric(row, user, ctx = {}) {
  if (!row || row.status !== 'active') return false
  if (privileged(ctx)) return true
  return isMetricOwner(row, user)
}

/** 删除：本人或超管；且仅草稿/待发布/已废弃（已启用须先废弃） */
export function canDeleteMetric(row, user, ctx = {}) {
  if (!row || !user) return false
  if (!['draft', 'review', 'deprecated'].includes(row.status)) return false
  if (ctx.isSuperAdmin) return true
  return isMetricOwner(row, user)
}

/** 按行过滤 metricActions(status) */
export function metricActionsFor(row, user, ctx = {}) {
  const base = metricActions(row?.status)
  return base.filter((a) => {
    switch (a) {
      case 'edit':
        return canEditMetric(row, user, ctx)
      case 'applyPublish':
        return canApplyPublishMetric(row, user, ctx)
      case 'applyQuery':
        return canApplyQueryMetric(row)
      case 'applyChange':
        return canApplyChangeMetric(row, user, ctx)
      case 'deprecate':
        return canDeprecateMetric(row, user, ctx)
      case 'delete':
        return canDeleteMetric(row, user, ctx)
      case 'detail':
      case 'goTicket':
        return true
      default:
        return true
    }
  })
}
