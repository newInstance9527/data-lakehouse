/** 根因分析台 · helpers only（禁止演示故事线 / 假证据） */

export function rcMetricStyle(tone) {
  if (tone === 'danger') return { color: 'var(--danger)' }
  if (tone === 'warning') return { color: 'var(--warning)' }
  if (tone === 'muted') return { color: 'var(--text-2)' }
  return undefined
}

export function rcRowClass(tone) {
  if (tone === 'danger') return 'row-danger'
  if (tone === 'warning') return 'row-warning'
  if (tone === 'muted') return 'row-muted'
  return ''
}

export function rcStepContentClass(step) {
  return {
    'is-danger': step?.contentTone === 'danger',
    'is-bold': step?.contentBold,
  }
}
