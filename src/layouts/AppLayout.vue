<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed, onMounted, ref } from 'vue'
import { useSession } from '@/composables/useSession'
import { useToast } from '@/composables/useToast'
import { useWorkspace } from '@/composables/useWorkspace'
import { switchWsWithMemberGuard } from '@/composables/useWsSwitch'
import { useLocale, t } from '@/composables/useLocale'
import AppToast from '@/components/common/AppToast.vue'
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal.vue'
import GlobalAiAssistant from '@/components/ai/GlobalAiAssistant.vue'
import UiPrefsMenu from '@/components/common/UiPrefsMenu.vue'
import NavIcon from '@/components/common/NavIcon.vue'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { locale } = useLocale()
const { user, filteredNavGroups, logout, isSuperAdmin, currentWs, setCurrentWs } = useSession()
/** 与 WorkspaceView 共用 spaces，创建/删除后顶栏自动刷新 */
const { spaces: wsSpaces, ensureLoaded: ensureWsSpaces } = useWorkspace()

const activeId = computed(() => route.meta?.id || 'overview')
const appEnv = computed(() => String(import.meta.env.VITE_APP_ENV || 'DEV').toUpperCase())

const navGroups = computed(() => {
  void locale.value
  return filteredNavGroups.value.map((g) => ({
    ...g,
    title: t(`nav.g.${g.key}`, g.title),
    items: g.items.map((item) => ({
      ...item,
      label: t(`nav.${item.id}`, item.label),
    })),
  }))
})

const crumbs = computed(() => {
  void locale.value
  const id = activeId.value
  const group = filteredNavGroups.value.find((g) => g.items.some((i) => i.id === id))
  const item = group?.items.find((i) => i.id === id)
  if (!group || !item) {
    return [t('nav.g.workbench'), t('nav.overview')]
  }
  return [t(`nav.g.${group.key}`, group.title), t(`nav.${item.id}`, item.label)]
})

const avatarText = computed(() => {
  const n = user.value?.name || user.value?.account || '?'
  return String(n).slice(0, 2).toUpperCase()
})
const userTitle = computed(() => {
  const roles = user.value?.roles?.join(',') || ''
  return `${user.value?.name || ''} (${user.value?.account || ''})${roles ? ' · ' + roles : ''}`
})

const wsSwitching = ref(false)
const currentWsLabel = computed(() => {
  const code = currentWs.value || 'default'
  const hit = wsSpaces.value.find((s) => s.id === code || s.wsCode === code)
  return hit?.name ? `${hit.name}` : code
})

async function onSwitchWs(e) {
  const code = String(e?.target?.value || '').trim()
  if (!code || code === currentWs.value || wsSwitching.value) return
  wsSwitching.value = true
  try {
    const hit = wsSpaces.value.find((s) => (s.id || s.wsCode) === code)
    await switchWsWithMemberGuard(code, { label: hit?.name || code })
    setCurrentWs(code)
    showToast(t('app.ws.switched', { name: hit?.name || code }), 'success')
  } catch (err) {
    if (!err?.cancelled) {
      showToast(err?.message || t('app.ws.fail'), 'warning')
    }
    e.target.value = currentWs.value || 'default'
  } finally {
    wsSwitching.value = false
  }
}

function go(path) {
  router.push(path)
}

function onSearch(e) {
  const v = e.target.value?.trim()
  if (!v || e.key !== 'Enter') return
  e.target.value = ''
  router.push({ path: '/catalog', query: { q: v } })
}

async function onLogout() {
  await logout()
  router.replace('/login')
}

function isWsMember(s) {
  const r = s?.role || s?.myRole
  return !!(r && r !== '—' && String(r).trim())
}

onMounted(() => {
  ensureWsSpaces().catch(() => {})
})
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="logo" @click="go('/')">
        <div class="logo-icon">DL</div>
        <div>
          <div class="logo-text">DataLakeHub</div>
          <span class="logo-sub">{{ t('app.logoSub') }}</span>
        </div>
      </div>
      <nav class="side-nav">
        <div v-for="group in navGroups" :key="group.key || group.title" class="nav-group">
          <div class="nav-group-title">{{ group.title }}</div>
          <div
            v-for="item in group.items"
            :key="item.id"
            class="nav-item"
            :class="{ active: activeId === item.id }"
            @click="go(item.path)"
          >
            <span class="nav-icon"><NavIcon :name="item.icon || item.id" /></span>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </nav>
    </aside>

    <div class="main">
      <header class="header">
        <div class="header-left">
          <div class="crumbs">
            <span>{{ crumbs[0] }}</span>
            <span class="crumbs-sep">/</span>
            <span class="crumbs-current">{{ crumbs[1] }}</span>
          </div>
        </div>
        <div class="header-center">
          <div class="global-search">
            <span class="search-icon"><NavIcon name="search" :size="14" /></span>
            <input type="text" :placeholder="t('app.search.placeholder')" @keydown="onSearch" />
          </div>
        </div>
        <div class="header-right">
          <label class="ws-switch" :title="t('app.ws.title')">
            <span class="ws-switch-label">{{ t('app.ws') }}</span>
            <select
              class="ws-switch-select"
              :value="currentWs || 'default'"
              :disabled="wsSwitching"
              @change="onSwitchWs"
            >
              <option v-if="!wsSpaces.length" :value="currentWs || 'default'">
                {{ currentWsLabel }}
              </option>
              <option
                v-for="s in wsSpaces"
                :key="s.id || s.wsCode"
                :value="s.id || s.wsCode"
              >
                {{ s.name || s.id || s.wsCode }}{{ isWsMember(s) ? '' : t('app.ws.nonMember') }}
              </option>
            </select>
          </label>
          <span class="env-tag">{{ appEnv }}</span>
          <span
            v-if="isSuperAdmin"
            class="env-tag"
            style="background: var(--primary-light); color: var(--primary)"
          >{{ t('app.superAdmin') }}</span>
          <UiPrefsMenu />
          <button class="icon-btn" :title="t('app.notify')" type="button" @click="router.push('/ops')">
            <NavIcon name="notify" :size="16" />
          </button>
          <div class="user-avatar" :title="userTitle">{{ avatarText }}</div>
          <button class="icon-btn" :title="t('app.logout')" type="button" @click="onLogout">
            <NavIcon name="logout" :size="16" />
          </button>
        </div>
      </header>

      <main class="content">
        <router-view :key="currentWs || 'default'" />
      </main>
    </div>

    <AppToast />
    <ConfirmDeleteModal />
    <GlobalAiAssistant />
  </div>
</template>
