<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useSession } from '@/composables/useSession'
import { useToast } from '@/composables/useToast'
import { t } from '@/composables/useLocale'
import { getLoginUser } from '@/api/auth'
import {
  loginUnreadMessageDetail,
  loginUnreadMessagePage,
  updatePasswordByOld,
  updateUserInfo,
} from '@/api/userCenter'
import { markAllMessagesRead } from '@/api/message'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { user, bootstrapSession } = useSession()

const tab = ref('profile')
const saving = ref(false)
const pwdBusy = ref(false)
const msgBusy = ref(false)

const form = reactive({
  id: '',
  account: '',
  name: '',
  nickname: '',
  gender: '',
  birthday: '',
  orgName: '',
  phone: '',
  email: '',
})

const pwd = reactive({
  password: '',
  newPassword: '',
  confirm: '',
})

const messages = ref([])
const msgTotal = ref(0)
const msgPage = ref(1)
const msgDetail = ref(null)

const tabs = computed(() => [
  { key: 'profile', label: t('usercenter.tab.profile') },
  { key: 'password', label: t('usercenter.tab.password') },
  { key: 'messages', label: t('usercenter.tab.messages') },
])

function syncFormFromUser(raw) {
  const u = raw || user.value?.raw || user.value || {}
  form.id = u.id || user.value?.id || ''
  form.account = u.account || user.value?.account || ''
  form.name = u.name || user.value?.name || ''
  form.nickname = u.nickname || ''
  form.gender = u.gender || ''
  form.birthday = u.birthday || ''
  form.orgName = u.orgName || user.value?.orgName || ''
  form.phone = u.phone || ''
  form.email = u.email || ''
}

async function reloadProfile() {
  try {
    const raw = await getLoginUser()
    syncFormFromUser(raw)
  } catch {
    syncFormFromUser()
  }
}

async function loadMessages() {
  msgBusy.value = true
  try {
    const page = await loginUnreadMessagePage({ current: msgPage.value, size: 20 })
    messages.value = page?.records || []
    msgTotal.value = Number(page?.total ?? messages.value.length)
  } catch (e) {
    showToast(e?.message || t('inbox.loadFail'), 'error')
    messages.value = []
  } finally {
    msgBusy.value = false
  }
}

watch(
  () => route.query.tab,
  (v) => {
    if (v === 'messages' || v === 'password' || v === 'profile') tab.value = String(v)
  },
  { immediate: true },
)

watch(tab, (v) => {
  router.replace({ path: '/usercenter', query: v === 'profile' ? {} : { tab: v } })
  if (v === 'messages') loadMessages()
})

onMounted(async () => {
  await reloadProfile()
  if (tab.value === 'messages') await loadMessages()
})

async function onSaveProfile() {
  if (!form.id || !String(form.name || '').trim()) {
    showToast(t('usercenter.profile.needName'), 'warning')
    return
  }
  saving.value = true
  try {
    await updateUserInfo({
      id: form.id,
      name: form.name.trim(),
      nickname: form.nickname || undefined,
      gender: form.gender || undefined,
      birthday: form.birthday || undefined,
    })
    await bootstrapSession()
    await reloadProfile()
    showToast(t('usercenter.profile.ok'), 'success')
  } catch (e) {
    showToast(e?.message || t('usercenter.profile.fail'), 'error')
  } finally {
    saving.value = false
  }
}

async function onSavePassword() {
  if (!pwd.password || !pwd.newPassword) {
    showToast(t('usercenter.pwd.need'), 'warning')
    return
  }
  if (pwd.newPassword !== pwd.confirm) {
    showToast(t('usercenter.pwd.mismatch'), 'warning')
    return
  }
  if (String(pwd.newPassword).length < 6) {
    showToast(t('usercenter.pwd.short'), 'warning')
    return
  }
  pwdBusy.value = true
  try {
    await updatePasswordByOld({
      password: pwd.password,
      newPassword: pwd.newPassword,
    })
    pwd.password = ''
    pwd.newPassword = ''
    pwd.confirm = ''
    showToast(t('usercenter.pwd.ok'), 'success')
  } catch (e) {
    showToast(e?.message || t('usercenter.pwd.fail'), 'error')
  } finally {
    pwdBusy.value = false
  }
}

async function openMsg(row) {
  if (!row?.id) return
  try {
    const d = await loginUnreadMessageDetail(row.id)
    msgDetail.value = { ...row, ...(d || {}) }
    row.read = true
  } catch (e) {
    msgDetail.value = { ...row, content: e?.message || String(e) }
  }
}

async function onMarkAll() {
  try {
    await markAllMessagesRead()
    showToast(t('inbox.markAll.ok'), 'success')
    await loadMessages()
  } catch (e) {
    showToast(e?.message || t('inbox.markAll.fail'), 'error')
  }
}
</script>

<template>
  <div class="uc-page">
    <PageHeader
      page-id="usercenter"
      :title="t('usercenter.title')"
      :subtitle="t('usercenter.subtitle')"
    />

    <div class="uc-tabs">
      <button
        v-for="tb in tabs"
        :key="tb.key"
        type="button"
        class="uc-tab"
        :class="{ active: tab === tb.key }"
        @click="tab = tb.key"
      >
        {{ tb.label }}
      </button>
    </div>

    <div v-if="tab === 'profile'" class="card uc-card">
      <div class="card-header">
        <div class="card-title">{{ t('usercenter.tab.profile') }}</div>
        <span class="tip">{{ form.account }}</span>
      </div>
      <div class="card-body uc-form">
        <label class="uc-field">
          <span>{{ t('usercenter.field.account') }}</span>
          <input class="input" :value="form.account" disabled />
        </label>
        <label class="uc-field">
          <span>{{ t('usercenter.field.org') }}</span>
          <input class="input" :value="form.orgName" disabled />
        </label>
        <label class="uc-field">
          <span>{{ t('usercenter.field.name') }}</span>
          <input v-model="form.name" class="input" />
        </label>
        <label class="uc-field">
          <span>{{ t('usercenter.field.nickname') }}</span>
          <input v-model="form.nickname" class="input" />
        </label>
        <label class="uc-field">
          <span>{{ t('usercenter.field.gender') }}</span>
          <select v-model="form.gender" class="select input">
            <option value="">{{ t('usercenter.field.gender.unset') }}</option>
            <option value="男">{{ t('usercenter.field.gender.m') }}</option>
            <option value="女">{{ t('usercenter.field.gender.f') }}</option>
          </select>
        </label>
        <label class="uc-field">
          <span>{{ t('usercenter.field.birthday') }}</span>
          <input v-model="form.birthday" class="input" type="date" />
        </label>
        <div class="uc-actions">
          <button type="button" class="btn btn-primary" :disabled="saving" @click="onSaveProfile">
            {{ saving ? t('common.busy') : t('usercenter.profile.save') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'password'" class="card uc-card">
      <div class="card-header">
        <div class="card-title">{{ t('usercenter.tab.password') }}</div>
      </div>
      <div class="card-body uc-form uc-form-narrow">
        <label class="uc-field">
          <span>{{ t('usercenter.pwd.old') }}</span>
          <input v-model="pwd.password" class="input" type="password" autocomplete="current-password" />
        </label>
        <label class="uc-field">
          <span>{{ t('usercenter.pwd.new') }}</span>
          <input v-model="pwd.newPassword" class="input" type="password" autocomplete="new-password" />
        </label>
        <label class="uc-field">
          <span>{{ t('usercenter.pwd.confirm') }}</span>
          <input v-model="pwd.confirm" class="input" type="password" autocomplete="new-password" />
        </label>
        <div class="uc-actions">
          <button type="button" class="btn btn-primary" :disabled="pwdBusy" @click="onSavePassword">
            {{ pwdBusy ? t('common.busy') : t('usercenter.pwd.save') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="card uc-card">
      <div class="card-header">
        <div class="card-title">{{ t('usercenter.tab.messages') }}</div>
        <div class="uc-msg-actions">
          <button type="button" class="btn btn-sm" :disabled="msgBusy" @click="loadMessages">
            {{ t('common.refresh') }}
          </button>
          <button type="button" class="btn btn-sm" :disabled="msgBusy" @click="onMarkAll">
            {{ t('inbox.markAll') }}
          </button>
        </div>
      </div>
      <div class="card-body">
        <div v-if="msgBusy && !messages.length" class="uc-empty">{{ t('common.loading') }}</div>
        <div v-else-if="!messages.length" class="uc-empty">{{ t('inbox.empty') }}</div>
        <div v-else class="uc-msg-list">
          <button
            v-for="m in messages"
            :key="m.id"
            type="button"
            class="uc-msg-row"
            :class="{ unread: !m.read }"
            @click="openMsg(m)"
          >
            <div class="uc-msg-top">
              <span class="uc-msg-subject">{{ m.subject || t('inbox.noSubject') }}</span>
              <span class="uc-msg-time">{{ m.createTime || '' }}</span>
            </div>
            <div class="uc-msg-snippet">{{ m.content || t('inbox.noContent') }}</div>
          </button>
        </div>
        <p v-if="msgTotal" class="tip uc-msg-total">{{ t('usercenter.msg.total', { n: msgTotal }) }}</p>

        <div v-if="msgDetail" class="uc-msg-detail">
          <div class="uc-msg-detail-head">
            <strong>{{ msgDetail.subject || t('inbox.detail') }}</strong>
            <button type="button" class="btn btn-sm" @click="msgDetail = null">{{ t('common.close') }}</button>
          </div>
          <div class="tip">{{ msgDetail.createTime }}</div>
          <div class="uc-msg-detail-body">{{ msgDetail.content || t('inbox.noContent') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uc-tabs {
  display: flex;
  gap: 8px;
  margin: 0 0 16px;
}
.uc-tab {
  border: 1px solid var(--border);
  background: var(--bg-1);
  color: var(--text-2);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}
.uc-tab.active {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
  font-weight: 600;
}
.uc-card {
  max-width: 860px;
}
.uc-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 18px;
}
.uc-form-narrow {
  max-width: 420px;
  grid-template-columns: 1fr;
}
.uc-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
}
.uc-actions {
  grid-column: 1 / -1;
  margin-top: 4px;
}
.uc-empty {
  padding: 28px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.uc-msg-actions {
  display: flex;
  gap: 8px;
}
.uc-msg-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.uc-msg-row {
  text-align: left;
  border: 1px solid var(--border);
  background: var(--bg-1);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
}
.uc-msg-row.unread {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background: color-mix(in srgb, var(--primary-light) 55%, var(--bg-1));
}
.uc-msg-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}
.uc-msg-subject {
  font-weight: 600;
  color: var(--text-1);
  font-size: 13px;
}
.uc-msg-time,
.uc-msg-snippet {
  font-size: 12px;
  color: var(--text-3);
}
.uc-msg-snippet {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.uc-msg-total {
  margin-top: 12px;
}
.uc-msg-detail {
  margin-top: 16px;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-0);
}
.uc-msg-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.uc-msg-detail-body {
  margin-top: 10px;
  white-space: pre-wrap;
  font-size: 13px;
  color: var(--text-1);
  line-height: 1.55;
}
@media (max-width: 720px) {
  .uc-form {
    grid-template-columns: 1fr;
  }
}
</style>
