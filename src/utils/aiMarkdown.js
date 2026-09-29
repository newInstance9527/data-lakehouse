/**
 * AI 对话轻量 Markdown → HTML（无第三方依赖；XSS 先转义再排版）
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 无 lookbehind 的斜体，兼容旧 WebView */
function applyInlineEmphasis(html) {
  let out = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  return out
}

/**
 * @param {string} raw
 * @returns {string} safe HTML
 */
export function formatAiMarkdown(raw) {
  if (raw == null || raw === '') return ''
  let src = String(raw)
  if (!src.includes('\n') && /<br\s*\/?>/i.test(src)) {
    src = src.replace(/<br\s*\/?>/gi, '\n')
  }
  src = src.replace(/<\/?(script|iframe|object|embed)[^>]*>/gi, '')

  const fences = []
  src = src.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = fences.length
    fences.push({ lang: String(lang || '').trim(), code: String(code || '').replace(/\n$/, '') })
    return `\n@@FENCE${i}@@\n`
  })

  const inlines = []
  src = src.replace(/`([^`\n]+)`/g, (_, code) => {
    const i = inlines.length
    inlines.push(String(code))
    return `@@INLINE${i}@@`
  })

  let html = escapeHtml(src)

  html = html.replace(/^#{3}\s+(.+)$/gm, '<h3 class="ai-md-h">$1</h3>')
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h2 class="ai-md-h">$1</h2>')
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h1 class="ai-md-h">$1</h1>')
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="ai-md-quote">$1</blockquote>')
  html = html.replace(/^(-{3,}|\*{3,})$/gm, '<hr class="ai-md-hr"/>')
  html = applyInlineEmphasis(html)
  // 站内路径：data-route 供点击走 Hash 路由；外链仍新开标签
  html = html.replace(
    /\[([^\]]+)\]\((\/[^\s)]*)\)/g,
    '<a class="ai-md-a ai-md-route" href="#$2" data-route="$2">$1</a>',
  )
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a class="ai-md-a" href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  )

  html = html.replace(/(?:^|\n)((?:\s*[-*]\s+.+\n?)+)/g, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
      .filter(Boolean)
      .map((t) => `<li>${t}</li>`)
      .join('')
    return `\n<ul class="ai-md-ul">${items}</ul>\n`
  })
  html = html.replace(/(?:^|\n)((?:\s*\d+\.\s+.+\n?)+)/g, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => line.replace(/^\s*\d+\.\s+/, '').trim())
      .filter(Boolean)
      .map((t) => `<li>${t}</li>`)
      .join('')
    return `\n<ol class="ai-md-ol">${items}</ol>\n`
  })

  html = html
    .split(/\n{2,}/)
    .map((para) => {
      const t = para.trim()
      if (!t) return ''
      if (/^<(h[123]|ul|ol|blockquote|pre|hr|table)/i.test(t)) return t
      return `<p class="ai-md-p">${t.replace(/\n/g, '<br/>')}</p>`
    })
    .join('')

  inlines.forEach((code, i) => {
    html = html.replace(`@@INLINE${i}@@`, `<code class="ai-md-code">${escapeHtml(code)}</code>`)
  })
  fences.forEach((f, i) => {
    const lang = f.lang ? ` data-lang="${escapeHtml(f.lang)}"` : ''
    html = html.replace(
      `@@FENCE${i}@@`,
      `<pre class="ai-md-pre"${lang}><code>${escapeHtml(f.code)}</code></pre>`,
    )
  })

  return html
}
