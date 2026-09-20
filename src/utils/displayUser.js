/**
 * 展示负责人：优先后端 enrich 的 *Name（sys_user.name），否则回退 raw（历史显示名或未解析 id）。
 * 鉴权仍用原始 owner / techOwner / createUser 字段，勿把本函数结果写回这些字段。
 */
export function displayUser(name, raw) {
  const n = String(name || '').trim()
  if (n) return n
  return String(raw || '').trim()
}

/** 卡片认责文案：去掉历史「张三(组)」括号段 */
export function bareDisplayUser(name, raw) {
  return displayUser(name, raw).split('(')[0].trim()
}
