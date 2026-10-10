/**
 * 会话 / 权限：消费 Snowy getLoginUser + loginMenu
 * 表级读 / 预览：资产拥有者或 sec_auth_grant；超管不短路
 * 改删：拥有者，或 privilege=EDIT|DELETE|MANAGE（MANAGE 覆盖改删）；超管不短路
 */
import { computed, readonly, ref } from 'vue'
import { clearToken, getLoginUser, getToken, loginMenu, doLogout as apiLogout } from '@/api/auth'
import { http } from '@/api/http'
import { fetchWsCurrent } from '@/api/workspace'
import { fetchPrincipalMe } from '@/api/security'
import { NAV_GROUPS } from '@/config/nav'
import { collectMenuNavIds } from '@/utils/menuNav'

const currentUser = ref(null)
const menuNavIds = ref(null)
const grantCache = ref({})
/** type:id — 兼容旧 MANAGE 缓存 */
const manageCache = ref({})
/** type:id:PRIV */
const opsCache = ref({})
/** Trino 主体映射：null=未探测 / true|false */
const principalMapped = ref(null)
const principalMe = ref(null)
const ready = ref(false)
const bootstrapping = ref(false)

export const NEED_OWNER_APPLY = 'NEED_OWNER_APPLY'

function isSuperAdminRoles(roles) {
  return (roles || []).some((r) => {
    const c = typeof r === 'string' ? r : r?.code || r?.roleCode || ''
    return normIdentity(c) === 'superadmin'
  })
}

function isSuperAdminUser(user) {
  if (!user) return false
  if (isSuperAdminRoles(user.roles)) return true
  return normIdentity(user.account) === 'superadmin'
}

export function mapUser(raw) {
  if (!raw) return null
  const roles = Array.isArray(raw.roleCodeList)
    ? raw.roleCodeList
    : Array.isArray(raw.roles)
      ? raw.roles
      : []
  const storedWs =
    (typeof localStorage !== 'undefined' && localStorage.getItem('lh_current_ws')) || 'default'
  return {
    id: raw.id,
    name: raw.name || raw.nickname || raw.account || '用户',
    account: raw.account || '',
    avatar: raw.avatar,
    orgId: raw.orgId,
    orgName: raw.orgName,
    roles,
    buttonCodeList: raw.buttonCodeList || [],
    permissionCodeList: raw.permissionCodeList || [],
    ws: storedWs,
    raw,
  }
}

function normIdentity(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
}

function userIdentities(user) {
  if (!user) return []
  return [user.id, user.account, user.name, user.raw?.nickname].map(normIdentity).filter(Boolean)
}

function ownerFieldMatches(ownerField, identities) {
  const raw = normIdentity(ownerField)
  if (!raw || !identities.length) return false
  if (identities.includes(raw)) return true
  const bare = raw.split('(')[0].trim()
  return Boolean(bare && identities.includes(bare))
}

/** 通用拥有者：createUser + 若干 owner 字段 */
export function isResourceOwner(resource, user, fields = ['createUser', 'owner', 'techOwner', 'bizOwner']) {
  if (!resource || !user) return false
  const identities = userIdentities(user)
  if (!identities.length) return false
  return fields.some((f) => ownerFieldMatches(resource[f], identities))
}

export function isAssetOwner(asset, user) {
  return isResourceOwner(asset, user, ['createUser', 'techOwner', 'bizOwner', 'owner'])
}

export function isDatasourceOwner(ds, user) {
  return isResourceOwner(ds, user, ['createUser', 'owner'])
}

export function isEtlOwner(task, user) {
  return isResourceOwner(task, user, ['createUser', 'owner'])
}

export function isMetricOwner(row, user) {
  return isResourceOwner(row, user, ['createUser', 'owner'])
}

export function isNeedOwnerApplyError(err) {
  const msg = String(err?.message || err || '')
  return msg.includes(NEED_OWNER_APPLY) || msg.includes('非拥有者不可直接')
}

export function useSession() {
  const user = computed(() => currentUser.value)
  const isLoggedIn = computed(() => Boolean(getToken() && currentUser.value))
  const isSuperAdmin = computed(() => isSuperAdminUser(currentUser.value))
  /** 跨空间列表巡检：超管 / dataOps / bizAdmin */
  const canScopeAll = computed(() => {
    if (isSuperAdmin.value) return true
    const roles = currentUser.value?.roles || []
    return roles.some((r) => {
      const c = typeof r === 'string' ? r : r?.code || r?.roleCode || ''
      return ['dataOps', 'bizAdmin', 'superAdmin'].includes(c)
    })
  })
  /** 当前协作工作空间（软上下文，非 Catalog 隔离） */
  const currentWs = computed(() => currentUser.value?.ws || 'default')

  function setCurrentWs(ws) {
    const next = String(ws || 'default').trim() || 'default'
    try {
      localStorage.setItem('lh_current_ws', next)
    } catch {
      /* ignore */
    }
    if (currentUser.value) {
      currentUser.value = { ...currentUser.value, ws: next }
    }
    return next
  }

  const allowedNavIds = computed(() => {
    if (isSuperAdmin.value) return null
    return menuNavIds.value
  })

  const filteredNavGroups = computed(() => {
    const allow = allowedNavIds.value
    if (allow == null) return NAV_GROUPS
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (allow.has(item.id)) return true
        // 数据服务 / 指标中心子页：有父权限即可见
        if (String(item.id).startsWith('dataservice-') && allow.has('dataservice')) return true
        if (String(item.id).startsWith('metrics-') && allow.has('metrics')) return true
        return false
      }),
    })).filter((g) => g.items.length)
  })

  function hasRole(role) {
    return (currentUser.value?.roles || []).includes(role)
  }

  function canAccessNav(navId) {
    if (!navId) return true
    // 个人中心 / 站内信：登录即可，不依赖侧栏菜单授权
    if (navId === 'usercenter') return true
    if (isSuperAdmin.value) return true
    if (menuNavIds.value == null) return true
    if (menuNavIds.value.has(navId)) return true
    if (String(navId).startsWith('dataservice-') && menuNavIds.value.has('dataservice')) return true
    if (String(navId).startsWith('metrics-') && menuNavIds.value.has('metrics')) return true
    return false
  }

  function canPreviewAsset(asset) {
    if (isAssetOwner(asset, currentUser.value)) return true
    const id = asset?.id || asset?.assetId
    if (!id) return false
    return Boolean(grantCache.value[id])
  }

  function hasTableReadGrant(asset) {
    return canPreviewAsset(asset)
  }

  function manageCacheKey(resourceType, resourceId) {
    return `${String(resourceType || 'asset').toLowerCase()}:${resourceId}`
  }

  function opsCacheKey(resourceType, resourceId, privilege) {
    return `${manageCacheKey(resourceType, resourceId)}:${String(privilege || 'MANAGE').toUpperCase()}`
  }

  function hasCachedOps(resourceType, resourceId, needed) {
    if (!resourceId) return false
    const base = manageCacheKey(resourceType, resourceId)
    if (manageCache.value[base] || (resourceType === 'asset' && manageCache.value[resourceId])) return true
    if (opsCache.value[`${base}:MANAGE`]) return true
    const need = String(needed || 'MANAGE').toUpperCase()
    if (need === 'MANAGE') return false
    return Boolean(opsCache.value[`${base}:${need}`])
  }

  function canManageAsset(asset) {
    return canEditAsset(asset) || canDeleteAsset(asset)
  }

  function canManageDatasource(ds) {
    return canEditDatasource(ds) || canDeleteDatasource(ds)
  }

  function canManageEtl(task) {
    return canEditEtl(task) || canDeleteEtl(task)
  }

  function canEditAsset(asset) {
    if (isAssetOwner(asset, currentUser.value)) return true
    const id = asset?.id || asset?.assetId
    return hasCachedOps('asset', id, 'EDIT')
  }

  function canDeleteAsset(asset) {
    if (isAssetOwner(asset, currentUser.value)) return true
    const id = asset?.id || asset?.assetId
    return hasCachedOps('asset', id, 'DELETE')
  }

  function canEditDatasource(ds) {
    if (isDatasourceOwner(ds, currentUser.value)) return true
    return hasCachedOps('datasource', ds?.id, 'EDIT')
  }

  function canDeleteDatasource(ds) {
    if (isDatasourceOwner(ds, currentUser.value)) return true
    return hasCachedOps('datasource', ds?.id, 'DELETE')
  }

  function canEditEtl(task) {
    if (isEtlOwner(task, currentUser.value)) return true
    return hasCachedOps('etl', task?.id, 'EDIT')
  }

  function canDeleteEtl(task) {
    if (isEtlOwner(task, currentUser.value)) return true
    return hasCachedOps('etl', task?.id, 'DELETE')
  }

  function canManageResource(resourceType, resource, idField = 'id') {
    const id = typeof resource === 'string' ? resource : resource?.[idField]
    if (!id) return false
    const type = String(resourceType || '').toLowerCase()
    if (type === 'asset') return canManageAsset(typeof resource === 'object' ? resource : { id })
    if (type === 'datasource') return canManageDatasource(typeof resource === 'object' ? resource : { id })
    if (type === 'etl') return canManageEtl(typeof resource === 'object' ? resource : { id })
    return hasCachedOps(type, id, 'MANAGE')
  }

  async function refreshGrant(assetId, asset) {
    if (!assetId) return false
    if (asset && isAssetOwner(asset, currentUser.value)) {
      grantCache.value = { ...grantCache.value, [assetId]: true }
      return true
    }
    try {
      const ok = await http.get('/lh/sec/grants/check', { assetId })
      grantCache.value = { ...grantCache.value, [assetId]: Boolean(ok) }
      return Boolean(ok)
    } catch {
      grantCache.value = { ...grantCache.value, [assetId]: false }
      return false
    }
  }

  /**
   * @param {string} resourceType
   * @param {string} resourceId
   * @param {object} [resource]
   * @param {string} [privilege] EDIT|DELETE|MANAGE
   */
  async function refreshOpsGrant(resourceType, resourceId, resource, privilege = 'MANAGE') {
    const type = String(resourceType || 'asset').toLowerCase()
    const id = resourceId
    if (!id) return false
    const privUp = String(privilege || 'MANAGE').toUpperCase()
    const key = manageCacheKey(type, id)
    const opsKey = opsCacheKey(type, id, privUp)

    const ownerOk =
      (type === 'asset' && resource && isAssetOwner(resource, currentUser.value)) ||
      (type === 'datasource' && resource && isDatasourceOwner(resource, currentUser.value)) ||
      (type === 'etl' && resource && isEtlOwner(resource, currentUser.value))
    if (ownerOk) {
      manageCache.value = {
        ...manageCache.value,
        [key]: true,
        ...(type === 'asset' ? { [id]: true } : {}),
      }
      opsCache.value = { ...opsCache.value, [opsKey]: true, [`${key}:MANAGE`]: true }
      return true
    }
    try {
      const params =
        type === 'asset'
          ? { assetId: id, privilege: privUp }
          : { resourceType: type, resourceId: id, privilege: privUp }
      const ok = await http.get('/lh/sec/grants/check', params)
      opsCache.value = { ...opsCache.value, [opsKey]: Boolean(ok) }
      if (privUp === 'MANAGE') {
        const next = { ...manageCache.value, [key]: Boolean(ok) }
        if (type === 'asset') next[id] = Boolean(ok)
        manageCache.value = next
      }
      return Boolean(ok)
    } catch {
      opsCache.value = { ...opsCache.value, [opsKey]: false }
      if (privUp === 'MANAGE') {
        const next = { ...manageCache.value, [key]: false }
        if (type === 'asset') next[id] = false
        manageCache.value = next
      }
      return false
    }
  }

  /**
   * 兼容旧签名：refreshManageGrant(assetId, asset?) 或 refreshManageGrant(type, id, resource?)
   * 并行探测 EDIT / DELETE / MANAGE
   */
  async function refreshManageGrant(resourceTypeOrAssetId, resourceIdOrAsset, resource) {
    let resourceType = 'asset'
    let resourceId = ''
    let res = resource
    if (arguments.length === 1 || (arguments.length >= 2 && typeof resourceIdOrAsset === 'object')) {
      resourceId = resourceTypeOrAssetId
      res = resourceIdOrAsset
    } else {
      resourceType = String(resourceTypeOrAssetId || 'asset').toLowerCase()
      resourceId = resourceIdOrAsset
    }
    if (!resourceId) return false
    const [editOk, delOk, manageOk] = await Promise.all([
      refreshOpsGrant(resourceType, resourceId, res, 'EDIT'),
      refreshOpsGrant(resourceType, resourceId, res, 'DELETE'),
      refreshOpsGrant(resourceType, resourceId, res, 'MANAGE'),
    ])
    return Boolean(editOk || delOk || manageOk)
  }

  async function refreshPrincipalMe() {
    if (!getToken()) {
      principalMapped.value = null
      principalMe.value = null
      return null
    }
    try {
      const me = await fetchPrincipalMe()
      principalMe.value = me || null
      principalMapped.value = Boolean(me?.mapped)
      return me
    } catch {
      principalMapped.value = false
      principalMe.value = null
      return null
    }
  }

  async function bootstrapSession() {
    if (bootstrapping.value) return
    bootstrapping.value = true
    try {
      if (!getToken()) {
        currentUser.value = null
        menuNavIds.value = new Set()
        principalMapped.value = null
        principalMe.value = null
        ready.value = true
        return
      }
      const raw = await getLoginUser()
      currentUser.value = mapUser(raw)
      // 当前协作 ws：以 /lh/workspace/current 为准（软偏好，非 ACL）
      try {
        const cur = await fetchWsCurrent()
        if (cur?.wsCode) setCurrentWs(cur.wsCode)
      } catch {
        /* 保留 localStorage / default */
      }
      try {
        const tree = await loginMenu()
        const ids = collectMenuNavIds(tree)
        menuNavIds.value = ids.size ? ids : isSuperAdminUser(currentUser.value) ? null : new Set()
      } catch {
        menuNavIds.value = isSuperAdminUser(currentUser.value) ? null : new Set()
      }
      // 主体映射不阻塞进页
      refreshPrincipalMe().catch(() => {})
      ready.value = true
    } catch {
      clearToken()
      currentUser.value = null
      menuNavIds.value = new Set()
      principalMapped.value = null
      principalMe.value = null
      ready.value = true
    } finally {
      bootstrapping.value = false
    }
  }

  async function logout() {
    try {
      await apiLogout()
    } catch {
      clearToken()
    }
    currentUser.value = null
    menuNavIds.value = new Set()
    grantCache.value = {}
    manageCache.value = {}
    opsCache.value = {}
    principalMapped.value = null
    principalMe.value = null
  }

  return {
    user,
    currentWs,
    setCurrentWs,
    isLoggedIn,
    isSuperAdmin,
    canScopeAll,
    principalMapped: readonly(principalMapped),
    principalMe: readonly(principalMe),
    refreshPrincipalMe,
    ready: readonly(ready),
    filteredNavGroups,
    canAccessNav,
    canPreviewAsset,
    hasTableReadGrant,
    canManageAsset,
    canManageDatasource,
    canManageEtl,
    canManageResource,
    canEditAsset,
    canDeleteAsset,
    canEditDatasource,
    canDeleteDatasource,
    canEditEtl,
    canDeleteEtl,
    isAssetOwner: (asset) => isAssetOwner(asset, currentUser.value),
    isDatasourceOwner: (ds) => isDatasourceOwner(ds, currentUser.value),
    isEtlOwner: (task) => isEtlOwner(task, currentUser.value),
    isMetricOwner: (row) => isMetricOwner(row, currentUser.value),
    hasRole,
    refreshGrant,
    refreshManageGrant,
    refreshOpsGrant,
    bootstrapSession,
    logout,
    session: readonly(currentUser),
  }
}
