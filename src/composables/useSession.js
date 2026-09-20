/**
 * 会话 / 权限：消费 Snowy getLoginUser + loginMenu
 * 表级读权限：超管短路；否则读 sec_auth_grant（门户 API）
 */
import { computed, readonly, ref } from 'vue'
import { clearToken, getLoginUser, getToken, loginMenu, doLogout as apiLogout } from '@/api/auth'
import { http } from '@/api/http'
import { NAV_GROUPS } from '@/config/nav'
import { collectMenuNavIds } from '@/utils/menuNav'

const currentUser = ref(null)
const menuNavIds = ref(null)
const grantCache = ref({})
const ready = ref(false)
const bootstrapping = ref(false)

function mapUser(raw) {
  if (!raw) return null
  const roles = Array.isArray(raw.roleCodeList) ? raw.roleCodeList : []
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
    ws: 'default',
    raw,
  }
}

function isSuperAdminRoles(roles) {
  return (roles || []).includes('superAdmin')
}

export function useSession() {
  const user = computed(() => currentUser.value)
  const isLoggedIn = computed(() => Boolean(getToken() && currentUser.value))
  const isSuperAdmin = computed(() => isSuperAdminRoles(currentUser.value?.roles))

  const allowedNavIds = computed(() => {
    if (isSuperAdmin.value) return null
    return menuNavIds.value
  })

  const filteredNavGroups = computed(() => {
    const allow = allowedNavIds.value
    if (allow == null) return NAV_GROUPS
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((item) => allow.has(item.id)),
    })).filter((g) => g.items.length)
  })

  function hasRole(role) {
    return (currentUser.value?.roles || []).includes(role)
  }

  function canAccessNav(navId) {
    if (!navId) return true
    if (isSuperAdmin.value) return true
    if (menuNavIds.value == null) return true
    return menuNavIds.value.has(navId)
  }

  function canPreviewAsset(asset) {
    if (isSuperAdmin.value) return true
    const id = asset?.id || asset?.assetId
    if (!id) return false
    return Boolean(grantCache.value[id])
  }

  function hasTableReadGrant(asset) {
    return canPreviewAsset(asset)
  }

  async function refreshGrant(assetId) {
    if (!assetId || isSuperAdmin.value) {
      if (assetId && isSuperAdmin.value) {
        grantCache.value = { ...grantCache.value, [assetId]: true }
      }
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

  async function bootstrapSession() {
    if (bootstrapping.value) return
    bootstrapping.value = true
    try {
      if (!getToken()) {
        currentUser.value = null
        menuNavIds.value = new Set()
        ready.value = true
        return
      }
      const raw = await getLoginUser()
      currentUser.value = mapUser(raw)
      try {
        const tree = await loginMenu()
        const ids = collectMenuNavIds(tree)
        menuNavIds.value = ids.size ? ids : isSuperAdminRoles(currentUser.value?.roles) ? null : new Set()
      } catch {
        menuNavIds.value = isSuperAdminRoles(currentUser.value?.roles) ? null : new Set()
      }
      ready.value = true
    } catch {
      clearToken()
      currentUser.value = null
      menuNavIds.value = new Set()
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
  }

  return {
    user,
    isLoggedIn,
    isSuperAdmin,
    ready: readonly(ready),
    filteredNavGroups,
    canAccessNav,
    canPreviewAsset,
    hasTableReadGrant,
    hasRole,
    refreshGrant,
    bootstrapSession,
    logout,
    session: readonly(currentUser),
  }
}
