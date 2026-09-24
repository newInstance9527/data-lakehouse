/**
 * Snowy 系统管理 API（用户 / 角色 / 菜单 / 组织 / 职位 / 角色菜单授权）
 */
import { http } from './http.js'

/** —— 组织 / 部门 —— */
export function orgTree(params = {}) {
  // searchKey 非 null（含空串）→ 全量嵌套树；不传则后端懒加载只返回 parentId 下直接子级
  // 见 SysOrgServiceImpl.orgTreeSelector / treeSearch
  return http.get('/sys/org/orgTreeSelector', {
    parentId: params.parentId,
    searchKey: params.searchKey != null ? params.searchKey : '',
  })
}

export function pageOrgs(params = {}) {
  return http.get('/sys/org/page', {
    current: params.current ?? 1,
    size: params.size ?? 100,
    parentId: params.parentId,
    searchKey: params.searchKey,
  })
}

export function addOrg(body) {
  return http.post('/sys/org/add', body)
}

export function editOrg(body) {
  return http.post('/sys/org/edit', body)
}

export function deleteOrgs(ids) {
  return http.post(
    '/sys/org/delete',
    (ids || []).map((id) => ({ id })),
  )
}

export function detailOrg(id) {
  return http.get('/sys/org/detail', { id })
}

/** —— 用户 —— */
export function pageUsers(params = {}) {
  return http.get('/sys/user/page', {
    current: params.current ?? 1,
    size: params.size ?? 20,
    searchKey: params.searchKey,
    userStatus: params.userStatus,
    orgId: params.orgId,
    searchIncludeChild: params.searchIncludeChild,
  })
}

export function addUser(body) {
  return http.post('/sys/user/add', body)
}

export function editUser(body) {
  return http.post('/sys/user/edit', body)
}

export function deleteUsers(ids) {
  return http.post(
    '/sys/user/delete',
    (ids || []).map((id) => ({ id })),
  )
}

export function detailUser(id) {
  return http.get('/sys/user/detail', { id })
}

export function enableUser(id) {
  return http.post('/sys/user/enableUser', { id })
}

export function disableUser(id) {
  return http.post('/sys/user/disableUser', { id })
}

export function resetUserPassword(id) {
  return http.post('/sys/user/resetPassword', { id })
}

export function ownUserRoles(id) {
  return http.get('/sys/user/ownRole', { id })
}

export function grantUserRoles(id, roleIdList) {
  return http.post('/sys/user/grantRole', { id, roleIdList })
}

export function userOrgTree() {
  // 与 orgTree 一致：必须带 searchKey（可空）才能拿到含 children 的全量树
  return http.get('/sys/user/orgTreeSelector', { searchKey: '' })
}

export async function userPositionSelector(orgId) {
  const data = await http.get('/sys/user/positionSelector', { orgId })
  // Snowy 返回 Page；兼容直接数组
  return Array.isArray(data) ? data : data?.records || []
}

export function userRoleSelector() {
  return http.get('/sys/user/roleSelector')
}

/** —— 角色 —— */
export function pageRoles(params = {}) {
  return http.get('/sys/role/page', {
    current: params.current ?? 1,
    size: params.size ?? 50,
    searchKey: params.searchKey,
    category: params.category,
  })
}

export function addRole(body) {
  return http.post('/sys/role/add', body)
}

export function editRole(body) {
  return http.post('/sys/role/edit', body)
}

export function deleteRoles(ids) {
  return http.post(
    '/sys/role/delete',
    (ids || []).map((id) => ({ id })),
  )
}

export function detailRole(id) {
  return http.get('/sys/role/detail', { id })
}

export function ownRoleResource(id) {
  return http.get('/sys/role/ownResource', { id })
}

export function grantRoleResource(id, grantInfoList) {
  return http.post('/sys/role/grantResource', { id, grantInfoList })
}

export function roleResourceTree() {
  return http.get('/sys/role/resourceTreeSelector')
}

/** —— 菜单 —— */
export function menuTree(params = {}) {
  return http.get('/sys/menu/tree', params)
}

export function pageMenus(params = {}) {
  return http.get('/sys/menu/page', {
    current: params.current ?? 1,
    size: params.size ?? 100,
    module: params.module,
    searchKey: params.searchKey,
  })
}

export function addMenu(body) {
  return http.post('/sys/menu/add', body)
}

export function editMenu(body) {
  return http.post('/sys/menu/edit', body)
}

export function deleteMenus(ids) {
  return http.post(
    '/sys/menu/delete',
    (ids || []).map((id) => ({ id })),
  )
}

export function detailMenu(id) {
  return http.get('/sys/menu/detail', { id })
}

export function menuModuleSelector() {
  return http.get('/sys/menu/moduleSelector')
}

export function menuTreeSelector(module) {
  return http.get('/sys/menu/menuTreeSelector', { module })
}

/** —— 职位 —— */
export function pagePositions(params = {}) {
  return http.get('/sys/position/page', {
    current: params.current ?? 1,
    size: params.size ?? 50,
    orgId: params.orgId,
    searchIncludeChild: params.searchIncludeChild,
    category: params.category,
    searchKey: params.searchKey,
  })
}

export function addPosition(body) {
  return http.post('/sys/position/add', body)
}

export function editPosition(body) {
  return http.post('/sys/position/edit', body)
}

export function deletePositions(ids) {
  return http.post(
    '/sys/position/delete',
    (ids || []).map((id) => ({ id })),
  )
}

export function detailPosition(id) {
  return http.get('/sys/position/detail', { id })
}
