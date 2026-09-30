/**
 * 后端 CommonPageRequest.PAGE_SIZE_MAX=100；前端曾传 500 会被截断。
 * 多页拉齐，避免「刚创建却不在第一页截断结果里」。
 */
export const BACKEND_PAGE_SIZE_MAX = 100

/**
 * @param {(page: { current: number, size: number }) => Promise<{ records?: any[], total?: number }|any>} fetchPage
 * @param {{ pageSize?: number, maxPages?: number }} [opts]
 */
export async function fetchAllPages(fetchPage, { pageSize = BACKEND_PAGE_SIZE_MAX, maxPages = 10 } = {}) {
  const records = []
  let current = 1
  let total = Infinity
  const size = Math.min(pageSize, BACKEND_PAGE_SIZE_MAX)
  while (current <= maxPages && records.length < total) {
    const page = await fetchPage({ current, size })
    const batch = page?.records || (Array.isArray(page) ? page : [])
    if (Array.isArray(page)) {
      records.push(...batch)
      break
    }
    total = Number(page?.total ?? batch.length)
    records.push(...batch)
    if (!batch.length || batch.length < size) break
    current += 1
  }
  return records
}
