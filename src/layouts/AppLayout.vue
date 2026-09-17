<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { NAV_GROUPS, CRUMBS } from '@/config/nav'
import { useToast } from '@/composables/useToast'
import AppToast from '@/components/common/AppToast.vue'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

const activeId = computed(() => route.meta?.id || 'overview')
const crumbs = computed(() => CRUMBS[activeId.value] || ['工作台', '总览仪表盘'])

function go(path) {
  router.push(path)
}

function onSearch(e) {
  const v = e.target.value?.trim()
  if (!v || e.key !== 'Enter') return
  showToast(`🔍 全站搜索「${v}」· 跳转资产目录`, 'success')
  router.push({ path: '/catalog', query: { q: v } })
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
        <div v-for="group in NAV_GROUPS" :key="group.title" class="nav-group">
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
          <button class="icon-btn" title="通知" @click="showToast('3 条未读告警', 'warning')">🔔</button>
          <div class="user-avatar" title="当前用户">LM</div>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>

    <AppToast />
  </div>
</template>
