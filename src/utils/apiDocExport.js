/**
 * API 文档导出：Markdown / HTML / Word（.doc HTML 兼容包）
 * 数据来源：门户绑定详情 + OpenAPI 3.0（可选）
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escMd(s) {
  return String(s ?? '').replace(/\|/g, '\\|')
}

function firstPathOp(openapi) {
  const paths = openapi?.paths || {}
  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue
    for (const [method, op] of Object.entries(item)) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method) && op) {
        return { path, method: method.toUpperCase(), op }
      }
    }
  }
  return null
}

function gatewayBase(openapi) {
  const servers = openapi?.servers
  if (Array.isArray(servers) && servers[0]?.url) {
    return String(servers[0].url).replace(/\/api\/?$/, '').replace(/\/$/, '')
  }
  return 'https://gateway.example.com'
}

function paramsFromDetail(detail) {
  return Array.isArray(detail?.params) ? detail.params : []
}

function responsesFromDetail(detail) {
  return Array.isArray(detail?.responses) ? detail.responses : []
}

function paramsFromOpenapi(op) {
  const list = Array.isArray(op?.parameters) ? op.parameters : []
  return list.map((p) => ({
    name: p.name,
    location: p.in,
    type: p.schema?.type || 'string',
    required: !!p.required,
    desc: p.description || '',
    example: p.example ?? p.schema?.default ?? p.schema?.example ?? '',
  }))
}

function curlOf(detail, openapi) {
  const hit = firstPathOp(openapi)
  const method = String(detail?.method || hit?.method || 'GET').toUpperCase()
  const path = String(detail?.path || hit?.path || '/api').replace(/^\//, '')
  const base = gatewayBase(openapi)
  const url = `${base}/api/${path}`
  const lines = [
    `curl -X ${method} '${url}' \\`,
    `  -H 'X-App-Key: <YOUR_APP_KEY>' \\`,
    `  -H 'Authorization: Bearer <YOUR_SECRET>'`,
  ]
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    lines[lines.length - 1] += ' \\'
    lines.push(`  -H 'Content-Type: application/json' \\`)
    lines.push(`  -d '{}'`)
  }
  return lines.join('\n')
}

function pickParams(detail, openapi) {
  const fromDetail = paramsFromDetail(detail)
  if (fromDetail.length) return fromDetail
  const hit = firstPathOp(openapi)
  return hit ? paramsFromOpenapi(hit.op) : []
}

/** 结构化文档模型（供预览与多格式导出） */
export function buildApiDocModel(detail = {}, openapi = null) {
  const hit = firstPathOp(openapi)
  const name = detail.name || hit?.op?.summary || detail.path || 'API'
  const method = String(detail.method || hit?.method || 'GET').toUpperCase()
  const path = detail.path || hit?.path || '—'
  const params = pickParams(detail, openapi)
  const responses = responsesFromDetail(detail)
  const format = detail.responseFormat || hit?.op?.['x-lakehouse']?.responseFormat || 'wrapped'
  const shape = detail.responseShape || hit?.op?.['x-lakehouse']?.responseShape || 'list'
  const qps = detail.qps ?? hit?.op?.['x-lakehouse']?.qps ?? '—'
  const burst = detail.burst ?? hit?.op?.['x-lakehouse']?.burst ?? '—'
  const tags = Array.isArray(detail.tags) ? detail.tags : []
  const description =
    detail.desc ||
    detail.remark ||
    (typeof hit?.op?.description === 'string' ? hit.op.description.split('\n')[0] : '') ||
    ''

  return {
    name,
    method,
    path,
    state: detail.state || '—',
    domain: detail.domain || '—',
    publishEnv: detail.publishEnv || '—',
    auth: detail.auth || 'Token · X-App-Key + Bearer',
    owner: detail.owner || '—',
    engine: detail.engine || detail.sqlrest?.engine || 'SQL/Groovy',
    sourceKind: detail.sourceKind || '—',
    sourceRef: detail.sourceRef || detail.asset || detail.metric || '—',
    asset: detail.asset && detail.asset !== '-' ? detail.asset : '',
    metric: detail.metric && detail.metric !== '-' ? detail.metric : '',
    qps,
    burst,
    format,
    shape,
    version: detail.sqlrestVersion != null ? `v${detail.sqlrestVersion}` : '—',
    revision: detail.revision ?? 1,
    publishedAt: detail.publishedAt || '—',
    updateTime: detail.updateTime || '—',
    tags,
    description,
    params,
    responses,
    curl: curlOf(detail, openapi),
    gateway: gatewayBase(openapi),
    openapiVersion: openapi?.openapi || '3.0.3',
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
  }
}

export function apiDocToMarkdown(model) {
  const m = model
  const lines = []
  lines.push(`# ${m.name}`)
  lines.push('')
  lines.push(`> 生成时间：${m.generatedAt} · OpenAPI ${m.openapiVersion}`)
  lines.push('')
  lines.push('## 1. 接口概要')
  lines.push('')
  lines.push('| 项 | 值 |')
  lines.push('|---|---|')
  lines.push(`| 名称 | ${escMd(m.name)} |`)
  lines.push(`| 方法 | \`${m.method}\` |`)
  lines.push(`| 路径 | \`${escMd(m.path)}\` |`)
  lines.push(`| 状态 | ${escMd(m.state)} |`)
  lines.push(`| 业务域 | ${escMd(m.domain)} |`)
  lines.push(`| 环境 | ${escMd(m.publishEnv)} |`)
  lines.push(`| 鉴权 | ${escMd(m.auth)} |`)
  lines.push(`| 引擎 | ${escMd(m.engine)} |`)
  lines.push(`| 来源 | ${escMd(m.sourceKind)} / ${escMd(m.sourceRef)} |`)
  if (m.asset) lines.push(`| 资产 | ${escMd(m.asset)} |`)
  if (m.metric) lines.push(`| 指标 | \`${escMd(m.metric)}\` |`)
  lines.push(`| 限流 | QPS ${escMd(m.qps)} · Burst ${escMd(m.burst)} |`)
  lines.push(`| 响应 | format=\`${m.format}\` · shape=\`${m.shape}\` |`)
  lines.push(`| 版本 | ${escMd(m.version)} · rev ${m.revision} |`)
  lines.push(`| 负责人 | ${escMd(m.owner)} |`)
  lines.push(`| 发布时间 | ${escMd(m.publishedAt)} |`)
  lines.push(`| 更新时间 | ${escMd(m.updateTime)} |`)
  if (m.tags?.length) lines.push(`| 标签 | ${m.tags.map(escMd).join(', ')} |`)
  lines.push('')
  if (m.description) {
    lines.push('## 2. 说明')
    lines.push('')
    lines.push(String(m.description).trim())
    lines.push('')
  }
  lines.push('## 3. 鉴权')
  lines.push('')
  lines.push('1. 在申请中心提交「API 调用申请」并等待审批通过')
  lines.push('2. 获取订阅 AppKey 与 Secret')
  lines.push('3. 每次请求携带请求头：')
  lines.push('   - `X-App-Key: <AppKey>`')
  lines.push('   - `Authorization: Bearer <Secret>`')
  lines.push('')
  lines.push('## 4. 入参')
  lines.push('')
  if (!m.params?.length) {
    lines.push('_无入参_')
    lines.push('')
  } else {
    lines.push('| 名称 | 位置 | 类型 | 必填 | 示例 | 说明 |')
    lines.push('|---|---|---|---|---|---|')
    for (const p of m.params) {
      lines.push(
        `| ${escMd(p.name)} | ${escMd(p.location || p.in || 'query')} | ${escMd(p.type || 'string')} | ${
          p.required ? '是' : '否'
        } | ${escMd(p.example ?? '')} | ${escMd(p.desc || p.remark || '')} |`,
      )
    }
    lines.push('')
  }
  lines.push('## 5. 出参映射')
  lines.push('')
  if (!m.responses?.length) {
    lines.push('_未配置字段映射（可能原样返回查询结果）_')
    lines.push('')
  } else {
    lines.push('| SQL 列 | 出参名 | 类型 | 转换 | 说明 |')
    lines.push('|---|---|---|---|---|')
    for (const r of m.responses) {
      lines.push(
        `| ${escMd(r.source || r.name)} | ${escMd(r.name)} | ${escMd(r.type || '')} | ${escMd(
          r.transform || '原样',
        )} | ${escMd(r.desc || r.remark || '')} |`,
      )
    }
    lines.push('')
  }
  lines.push('## 6. 响应约定')
  lines.push('')
  lines.push(`- **format**：\`${m.format}\``)
  lines.push(`- **shape**：\`${m.shape}\``)
  if (m.format === 'wrapped') {
    lines.push('- 成功时返回 `{ code, message, data }`，业务数据在 `data`')
  } else if (m.format === 'origin') {
    lines.push('- 直接返回查询结果（无统一外壳）')
  } else if (m.format === 'nil') {
    lines.push('- 仅返回状态头 `{ code, message }`')
  }
  lines.push('')
  lines.push('### 成功示例（wrapped + list）')
  lines.push('')
  lines.push('```json')
  lines.push(
    JSON.stringify(
      {
        code: 200,
        message: 'ok',
        data: [
          Object.fromEntries(
            (m.responses?.length ? m.responses : [{ name: 'id' }, { name: 'name' }]).map((r) => [
              r.name || 'field',
              r.type?.includes?.('int') || r.type?.includes?.('number') ? 1 : '示例',
            ]),
          ),
        ],
      },
      null,
      2,
    ),
  )
  lines.push('```')
  lines.push('')
  lines.push('## 7. 错误码')
  lines.push('')
  lines.push('| HTTP | 说明 |')
  lines.push('|---|---|')
  lines.push('| 400 | 参数校验失败 |')
  lines.push('| 401 | 缺少或无效订阅 Key |')
  lines.push('| 403 | 无调用权限 / 订阅过期 |')
  lines.push('| 404 | 接口不存在或未发布 |')
  lines.push('| 429 | 触发限流 |')
  lines.push('| 500 | 服务端执行失败 |')
  lines.push('')
  lines.push('## 8. 调用示例')
  lines.push('')
  lines.push('```bash')
  lines.push(m.curl)
  lines.push('```')
  lines.push('')
  lines.push('## 9. 网关')
  lines.push('')
  lines.push(`- Gateway：\`${m.gateway}\``)
  lines.push(`- 完整 URL：\`${m.gateway}/api/${String(m.path || '').replace(/^\//, '')}\``)
  lines.push('')
  return lines.join('\n')
}

function mdInlineToHtml(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

/** 简易 Markdown → HTML（覆盖本导出器生成的子集） */
export function markdownToHtmlBody(md) {
  const lines = String(md || '').split('\n')
  const out = []
  let inCode = false
  let codeLang = ''
  let codeBuf = []
  let inTable = false

  function flushCode() {
    if (!inCode) return
    out.push(`<pre class="code"><code class="lang-${esc(codeLang)}">${esc(codeBuf.join('\n'))}</code></pre>`)
    inCode = false
    codeLang = ''
    codeBuf = []
  }

  function flushTable() {
    inTable = false
  }

  for (const raw of lines) {
    const line = raw
    if (line.startsWith('```')) {
      if (inCode) flushCode()
      else {
        inCode = true
        codeLang = line.slice(3).trim()
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }
    if (/^\|.*\|$/.test(line)) {
      if (/^\|?\s*-+/.test(line.replace(/\|/g, '|'))) continue
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
      if (!inTable) {
        inTable = true
        out.push('<table>')
        out.push(
          '<thead><tr>' +
            cells.map((c) => `<th>${mdInlineToHtml(c)}</th>`).join('') +
            '</tr></thead><tbody>',
        )
      } else {
        out.push('<tr>' + cells.map((c) => `<td>${mdInlineToHtml(c)}</td>`).join('') + '</tr>')
      }
      continue
    }
    if (inTable) {
      out.push('</tbody></table>')
      flushTable()
    }
    if (/^#\s+/.test(line)) {
      out.push(`<h1>${mdInlineToHtml(line.replace(/^#\s+/, ''))}</h1>`)
    } else if (/^##\s+/.test(line)) {
      out.push(`<h2>${mdInlineToHtml(line.replace(/^##\s+/, ''))}</h2>`)
    } else if (/^###\s+/.test(line)) {
      out.push(`<h3>${mdInlineToHtml(line.replace(/^###\s+/, ''))}</h3>`)
    } else if (/^>\s?/.test(line)) {
      out.push(`<blockquote>${mdInlineToHtml(line.replace(/^>\s?/, ''))}</blockquote>`)
    } else if (/^\d+\.\s+/.test(line)) {
      out.push(`<p class="ol-item">${mdInlineToHtml(line)}</p>`)
    } else if (/^[-*]\s+/.test(line)) {
      out.push(`<p class="ul-item">${mdInlineToHtml(line.replace(/^[-*]\s+/, '• '))}</p>`)
    } else if (!line.trim()) {
      out.push('')
    } else {
      out.push(`<p>${mdInlineToHtml(line)}</p>`)
    }
  }
  if (inCode) flushCode()
  if (inTable) out.push('</tbody></table>')
  return out.join('\n')
}

const DOC_CSS = `
  body{font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#1f2329;line-height:1.65;max-width:920px;margin:24px auto;padding:0 20px;font-size:14px}
  h1{font-size:24px;border-bottom:2px solid #1e6fff;padding-bottom:8px;margin-top:0}
  h2{font-size:18px;margin-top:28px;color:#0b3d91;border-bottom:1px solid #e5e6eb;padding-bottom:6px}
  h3{font-size:15px;margin-top:18px}
  table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px}
  th,td{border:1px solid #d0d3d9;padding:8px 10px;text-align:left;vertical-align:top}
  th{background:#f2f3f5;font-weight:600}
  code{background:#f5f6f8;padding:1px 6px;border-radius:4px;font-family:Consolas,Monaco,monospace;font-size:12px}
  pre.code{background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:8px;overflow:auto;font-size:12px;line-height:1.5}
  pre.code code{background:transparent;color:inherit;padding:0}
  blockquote{margin:12px 0;padding:8px 14px;background:#f7f8fa;border-left:4px solid #1e6fff;color:#4e5969}
  .meta{color:#86909c;font-size:12px}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;background:#e8f3ff;color:#1e6fff;font-weight:700;font-size:12px;margin-right:8px}
  .ul-item,.ol-item{margin:4px 0}
`

export function apiDocToHtmlDocument(model, { title } = {}) {
  const md = apiDocToMarkdown(model)
  const body = markdownToHtmlBody(md)
  const t = title || model.name || 'API 文档'
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(t)}</title>
<style>${DOC_CSS}</style>
</head>
<body>
<div class="meta"><span class="badge">${esc(model.method)}</span>${esc(model.path)} · 生成于 ${esc(model.generatedAt)}</div>
${body}
</body>
</html>`
}

/** Word 可打开的 HTML 包（.doc） */
export function apiDocToWordDocument(model, { title } = {}) {
  const md = apiDocToMarkdown(model)
  const body = markdownToHtmlBody(md)
  const t = title || model.name || 'API 文档'
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>${esc(t)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
${DOC_CSS}
@page{size:A4;margin:2cm}
</style>
</head>
<body>
<div class="meta"><span class="badge">${esc(model.method)}</span>${esc(model.path)} · 生成于 ${esc(model.generatedAt)}</div>
${body}
</body>
</html>`
}

function downloadBlob(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadApiDoc(model, format, { basename } = {}) {
  const base = (basename || model.name || model.path || 'api-doc')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .slice(0, 80)
  if (format === 'markdown' || format === 'md') {
    downloadBlob(apiDocToMarkdown(model), `${base}.md`, 'text/markdown;charset=utf-8')
    return
  }
  if (format === 'html') {
    downloadBlob(apiDocToHtmlDocument(model), `${base}.html`, 'text/html;charset=utf-8')
    return
  }
  if (format === 'word' || format === 'doc') {
    downloadBlob(
      apiDocToWordDocument(model),
      `${base}.doc`,
      'application/msword;charset=utf-8',
    )
    return
  }
  throw new Error(`不支持的格式: ${format}`)
}

export function downloadJson(obj, filename) {
  downloadBlob(JSON.stringify(obj, null, 2), filename, 'application/json;charset=utf-8')
}
