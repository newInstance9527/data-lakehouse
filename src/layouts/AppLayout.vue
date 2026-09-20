<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { CRUMBS } from '@/config/nav'
import { useSession } from '@/composables/useSession'
import { useToast } from '@/composables/useToast'
import AppToast from '@/components/common/AppToast.vue'
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal.vue'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { user, filteredNavGroups, logout, isSuperAdmin } = useSession()

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
          <span class="env-tag">PROD</span>
          <span v-if="isSuperAdmin" class="env-tag" style="background: var(--primary-light); color: var(--primary)">超管</span>
          <button class="icon-btn" title="通知" @click="showToast('3 条未读告警', 'warning')">🔔</button>
          <div class="user-avatar" :title="userTitle">{{ avatarText }}</div>
          <button class="icon-btn" title="退出登录" @click="onLogout">⎋</button>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>

    <AppToast />
    <ConfirmDeleteModal />
  </div>
</template>
