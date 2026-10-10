<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useInbox, ensureInboxPoll } from '@/composables/useInbox'
import { useToast } from '@/composables/useToast'
import { t } from '@/composables/useLocale'
import NavIcon from '@/components/common/NavIcon.vue'

const router = useRouter()
const { showToast } = useToast()
const {
  messages,
  unreadCount,
  loading,
  open,
  detail,
  detailOpen,
  openPanel,
  closePanel,
  openDetail,
  closeDetail,
  markAllRead,
} = useInbox()

onMounted(() => {
  ensureInboxPoll()
})

async function onBell() {
  if (open.value) {
    closePanel()
    return
  }
  await openPanel()
}

async function onMarkAll() {
  try {
    await markAllRead()
    showToast(t('inbox.markAll.ok'), 'success')
  } catch (e) {
    showToast(e?.message || t('inbox.markAll.fail'), 'error')
  }
}

function goCenter() {
  closePanel()
  closeDetail()
  router.push({ path: '/usercenter', query: { tab: 'messages' } })
}

function goOps() {
  closePanel()
  router.push('/ops')
}
</script>

<template>
  <div class="inbox-wrap">
    <button
      class="icon-btn inbox-bell"
      type="button"
      :title="t('inbox.title')"
      @click="onBell"
    >
      <NavIcon name="notify" :size="16" />
      <span v-if="unreadCount > 0" class="inbox-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <div v-if="open" class="inbox-mask" @click="closePanel" />
    <div v-if="open" class="inbox-panel" role="dialog" :aria-label="t('inbox.title')">
      <div class="inbox-head">
        <div class="inbox-head-title">{{ t('inbox.title') }}</div>
        <div class="inbox-head-actions">
          <button type="button" class="btn btn-sm" :disabled="!unreadCount" @click="onMarkAll">
            {{ t('inbox.markAll') }}
          </button>
          <button type="button" class="btn btn-sm" @click="goCenter">{{ t('inbox.openCenter') }}</button>
        </div>
      </div>
      <div class="inbox-body">
        <div v-if="loading" class="inbox-empty">{{ t('common.loading') }}</div>
        <div v-else-if="!messages.length" class="inbox-empty">{{ t('inbox.empty') }}</div>
        <button
          v-for="m in messages"
          :key="m.id"
          type="button"
          class="inbox-item"
          :class="{ unread: !m.read }"
          @click="openDetail(m)"
        >
          <div class="inbox-item-top">
            <span class="inbox-subject">{{ m.subject || t('inbox.noSubject') }}</span>
            <span class="inbox-time">{{ m.createTime || '' }}</span>
          </div>
          <div class="inbox-snippet">{{ m.content || t('inbox.noContent') }}</div>
        </button>
      </div>
      <div class="inbox-foot">
        <button type="button" class="btn btn-sm" @click="goOps">{{ t('inbox.opsLink') }}</button>
      </div>
    </div>

    <div v-if="detailOpen" class="inbox-mask inbox-mask-detail" @click="closeDetail" />
    <div v-if="detailOpen" class="inbox-detail" role="dialog">
      <div class="inbox-detail-head">
        <div class="inbox-detail-title">{{ detail?.subject || t('inbox.detail') }}</div>
        <button type="button" class="icon-btn" @click="closeDetail">×</button>
      </div>
      <div class="inbox-detail-meta">{{ detail?.createTime || '' }}</div>
      <div class="inbox-detail-body">{{ detail?.content || detail?.error || t('inbox.noContent') }}</div>
    </div>
  </div>
</template>
