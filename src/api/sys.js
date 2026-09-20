/**
 * Snowy 系统管理 API（用户 / 角色 / 菜单 / 角色菜单授权）
 */
import { http } from './http.js'

/** —— 用户 —— */
export function pageUsers(params = {}) {
  return http.get('/sys/user/page', {
    current: params.current ?? 1,
    size: params.size ?? 20,
    searchKey: params.searchKey,
    userStatus: params.userStatus,
    orgId: params.orgId,
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
  return http.get('/sys/user/orgTreeSelector')
}

export function userPositionSelector(orgId) {
  return http.get('/sys/user/positionSelector', { orgId })
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
