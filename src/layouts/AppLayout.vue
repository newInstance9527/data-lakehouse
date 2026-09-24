<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed, onMounted, ref } from 'vue'
import { CRUMBS } from '@/config/nav'
import { useSession } from '@/composables/useSession'
import { useToast } from '@/composables/useToast'
import { useWorkspace } from '@/composables/useWorkspace'
import { switchWsWithMemberGuard } from '@/composables/useWsSwitch'
import AppToast from '@/components/common/AppToast.vue'
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal.vue'
import GlobalAiAssistant from '@/components/ai/GlobalAiAssistant.vue'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { user, filteredNavGroups, logout, isSuperAdmin, currentWs, setCurrentWs } = useSession()
/** 与 WorkspaceView 共用 spaces，创建/删除后顶栏自动刷新 */
const { spaces: wsSpaces, ensureLoaded: ensureWsSpaces } = useWorkspace()

const activeId = computed(() => route.meta?.id || 'overview')
const crumbs = computed(() => CRUMBS[activeId.value] || ['工作台', '总览仪表盘'])
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
    showToast(`当前工作空间：${hit?.name || code} · 列表已切换`, 'success')
  } catch (err) {
    if (!err?.cancelled) {
      showToast(err?.message || '切换工作空间失败', 'warning')
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
  showToast(`🔍 全站搜索「${v}」· 跳转资产目录`, 'success')
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
          <span class="logo-sub">湖仓一体 · 治理平台 v0.1</span>
        </div>
      </div>
      <nav class="side-nav">
        <div v-for="group in filteredNavGroups" :key="group.title" class="nav-group">
          <div class="nav-group-title">{{ group.title }}</div>
          <div
            v-for="item in group.items"
            :key="item.id"
            class="nav-item"
            :class="{ active: activeId === item.id }"
            @click="go(item.path)"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
            <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
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
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="搜索表、字段、指标、报表…（支持跨模块）" @keydown="onSearch" />
            <span class="search-shortcut">⌘K</span>
          </div>
        </div>
        <div class="header-right">
          <label class="ws-switch" title="切换工作空间：整站列表默认跟随当前空间；授权仍走申请中心">
            <span class="ws-switch-label">空间</span>
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
                {{ s.name || s.id || s.wsCode }}{{ isWsMember(s) ? '' : ' · 非成员' }}
              </option>
            </select>
          </label>
          <span class="env-tag">PROD</span>
          <span v-if="isSuperAdmin" class="env-tag" style="background: var(--primary-light); color: var(--primary)">超管</span>
          <button class="icon-btn" title="通知" @click="showToast('3 条未读告警', 'warning')">🔔</button>
          <div class="user-avatar" :title="userTitle">{{ avatarText }}</div>
          <button class="icon-btn" title="退出登录" @click="onLogout">⎋</button>
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
