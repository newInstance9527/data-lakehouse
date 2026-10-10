/**
 * 通过对比 index 里的 /assets/* 指纹，检测前端是否已发布新构建。
 * 开发模式跳过（Vite HMR 自行处理）。
 */

export function getDocAssetFingerprint(doc = document) {
  const urls = []
  for (const el of doc.querySelectorAll('script[src]')) {
    const src = el.getAttribute('src') || ''
    if (src.includes('/assets/')) urls.push(src.split('?')[0])
  }
  for (const el of doc.querySelectorAll('link[rel="stylesheet"][href]')) {
    const href = el.getAttribute('href') || ''
    if (href.includes('/assets/')) urls.push(href.split('?')[0])
  }
  return urls.sort().join('|')
}

export function getLocalAssetFingerprint() {
  return getDocAssetFingerprint(document)
}

/** @returns {Promise<string>} */
export async function fetchRemoteAssetFingerprint() {
  const base = import.meta.env.BASE_URL || '/'
  const url = `${base}${base.endsWith('/') ? '' : '/'}?_v=${Date.now()}`
  const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
  if (!res.ok) throw new Error(`version fetch ${res.status}`)
  const html = await res.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return getDocAssetFingerprint(doc)
}
