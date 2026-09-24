/**
 * AI 助手 SQL 动作（apply_sql / run_sql / deeplink）共用逻辑，避免 AiAssistantView 与 GlobalAiAssistant 漂移。
 * 实查一律经 confirmRunSql → POST /lh/ai/run-sql（AiSqlGuard + 即席/Grav），禁止无确认自动执行。
 */
import { runAiSql } from '@/api/ai'

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildQuerySqlHref(sql) {
  return `/query?sql=${encodeURIComponent(sql)}`
}

/**
 * @param {import('vue-router').Router} router
 * @param {string} sql
 */
export function openQueryWithSql(router, sql) {
  if (!sql || !router) return
  router.push({ path: '/query', query: { sql } })
}

/**
 * @param {import('vue-router').Router} router
 * @param {string} href
 */
export function navigateAiDeeplink(router, href) {
  if (!href || !router) return
  const path = String(href).startsWith('/') ? href : `/${href}`
  if (path.startsWith('/query?')) {
    const q = path.slice('/query?'.length)
    const params = Object.fromEntries(new URLSearchParams(q))
    router.push({ path: '/query', query: params })
    return
  }
  router.push(path)
}

/**
 * 二次确认后试跑；结果消息可 push 到 messages。
 * @param {{
 *   sql: string,
 *   ws?: string,
 *   sessionId?: string,
 *   turnId?: string,
 *   confirmRunSql?: (p: object) => Promise<object>,
 *   messages?: { value: any[] },
 *   showToast?: (msg: string, type?: string) => void,
 *   skipBrowserConfirm?: boolean,
 * }} opts
 */
export async function confirmAndRunAiSql(opts = {}) {
  const sql = opts.sql
  if (!sql) return null

  if (!opts.skipBrowserConfirm) {
    const ok = window.confirm(
      '确认试跑以下只读 SQL？将经即席查询接入层（Trino + Grav），结果默认截断 1000 行。\n\n' +
        String(sql).slice(0, 400) +
        (String(sql).length > 400 ? '…' : ''),
    )
    if (!ok) return { cancelled: true }
  }

  const run =
    opts.confirmRunSql ||
    ((p) =>
      runAiSql({
        sql: p.sql,
        sessionId: p.sessionId,
        turnId: p.turnId,
        ws: p.ws || 'default',
        confirmed: true,
      }))

  opts.showToast?.('正在经即席接入层执行…', 'info')
  try {
    const r = await run({
      sql,
      ws: opts.ws || 'default',
      sessionId: opts.sessionId,
      turnId: opts.turnId,
    })
    const st = r?.statusLabel || r?.status || 'done'
    const rows = r?.rowCount ?? (r?.rows?.length ?? '—')
    opts.showToast?.(
      `试跑完成：${st} · ${rows} 行 · Scan ${r?.scan || '—'}`,
      r?.scanOverLimit ? 'warning' : 'success',
    )
    if (opts.messages?.value && r?.queryId) {
      opts.messages.value.push({
        role: 'assistant',
        html:
          `✅ 试跑已转发即席查询 <code>${escapeHtml(r.queryId)}</code>` +
          ` · 状态 ${escapeHtml(String(st))} · 行数 ${escapeHtml(String(rows))}` +
          ` · Scan ${escapeHtml(String(r.scan || '—'))}` +
          (r.scanOverLimit ? '<br>⚠️ 扫描超限额' : '') +
          `<br><button type="button" class="ai-inline-btn" data-open-sql="1">在即席查询打开</button>`,
        actions: [
          {
            type: 'deeplink',
            label: '在即席查询打开',
            href: r.deeplink || buildQuerySqlHref(sql),
            sql,
          },
        ],
      })
    }
    return r
  } catch (e) {
    opts.showToast?.(e?.message || '试跑失败', 'error')
    throw e
  }
}

/**
 * Apply：打开即席页，并在聊天内挂出「确认试跑」按钮（不自动执行）。
 */
export function applySqlWithInlineRunOffer({ router, sql, messages, showToast, metricCode }) {
  if (!sql) return
  openQueryWithSql(router, sql)
  showToast?.('已打开即席查询（未执行）', 'success')
  if (messages?.value) {
    const runAct = {
      type: 'run_sql',
      label: '确认试跑（二次确认）',
      sql,
    }
    if (metricCode) runAct.metricCode = metricCode
    messages.value.push({
      role: 'assistant',
      html:
        '已写入即席查询编辑框。<br>' +
        '可直接在查询页编辑，或在聊天内<strong>二次确认后试跑</strong>（经 <code>/lh/ai/run-sql</code> · Grav，不自动执行）。',
      actions: [
        runAct,
        {
          type: 'deeplink',
          label: '再次打开即席页',
          href: buildQuerySqlHref(sql),
          sql,
        },
      ],
    })
  }
}

/**
 * 统一处理 SSE action：apply_sql / run_sql / deeplink。
 * @returns {Promise<'handled'|'ignored'>}
 */
export async function handleAiSqlAction(act, deps = {}) {
  if (!act) return 'ignored'
  const { router, messages, showToast, confirmRunSql, sessionId, ws } = deps

  if (act.type === 'apply_sql' && act.sql) {
    applySqlWithInlineRunOffer({
      router,
      sql: act.sql,
      messages,
      showToast,
      metricCode: act.metricCode,
    })
    return 'handled'
  }

  if (act.type === 'deeplink' && act.href) {
    navigateAiDeeplink(router, act.href)
    return 'handled'
  }

  if (act.type === 'run_sql' && act.sql) {
    try {
      await confirmAndRunAiSql({
        sql: act.sql,
        ws: ws || 'default',
        sessionId,
        confirmRunSql,
        messages,
        showToast,
      })
    } catch {
      /* toast already shown */
    }
    return 'handled'
  }

  return 'ignored'
}

export { escapeHtml }
