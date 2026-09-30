<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doLogin } from '@/api/auth'
import { useSession } from '@/composables/useSession'
import { ApiError } from '@/api/http'
import { t, useLocale } from '@/composables/useLocale'
import UiPrefsMenu from '@/components/common/UiPrefsMenu.vue'

const route = useRoute()
const router = useRouter()
const { bootstrapSession } = useSession()
/** 绑定 locale，切换语言时刷新登录文案 */
const { locale } = useLocale()

const account = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const redirectTo = computed(() => {
  const r = route.query.redirect
  if (typeof r === 'string' && r.startsWith('/') && !r.startsWith('//')) return r
  return '/'
})

async function submit() {
  errorMsg.value = ''
  if (!account.value.trim() || !password.value) {
    errorMsg.value = t('login.needCreds')
    return
  }
  loading.value = true
  try {
    await doLogin({
      account: account.value.trim(),
      password: password.value,
    })
    await bootstrapSession()
    await router.replace(redirectTo.value)
  } catch (e) {
    errorMsg.value = e instanceof ApiError ? e.message : e?.message || t('login.fail')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="lh-login">
    <div class="lh-login__prefs">
      <UiPrefsMenu on-dark />
    </div>
    <div class="lh-login__sky" aria-hidden="true">
      <div class="lh-login__ripple lh-login__ripple--a" />
      <div class="lh-login__ripple lh-login__ripple--b" />
      <div class="lh-login__mesh" />
      <svg class="lh-login__constellation" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice">
        <g class="lh-login__edges">
          <line x1="120" y1="180" x2="260" y2="320" />
          <line x1="260" y1="320" x2="420" y2="240" />
          <line x1="420" y1="240" x2="560" y2="380" />
          <line x1="260" y1="320" x2="340" y2="520" />
          <line x1="340" y1="520" x2="520" y2="560" />
          <line x1="520" y1="560" x2="640" y2="420" />
          <line x1="340" y1="520" x2="180" y2="640" />
          <line x1="520" y1="560" x2="480" y2="720" />
        </g>
        <g class="lh-login__nodes">
          <circle cx="120" cy="180" r="4" />
          <circle cx="260" cy="320" r="6" />
          <circle cx="420" cy="240" r="4" />
          <circle cx="560" cy="380" r="5" />
          <circle cx="340" cy="520" r="7" />
          <circle cx="520" cy="560" r="5" />
          <circle cx="640" cy="420" r="4" />
          <circle cx="180" cy="640" r="4" />
          <circle cx="480" cy="720" r="5" />
        </g>
      </svg>
      <div class="lh-login__strata">
        <span>ODS</span><span>DWD</span><span>DWS</span><span>ADS</span>
      </div>
    </div>

    <div class="lh-login__stage" :key="locale">
      <header class="lh-login__brand">
        <div class="lh-login__mark" aria-hidden="true">DL</div>
        <h1 class="lh-login__title">DataLakeHub</h1>
        <p class="lh-login__tagline">{{ t('login.tagline') }}</p>
      </header>

      <form class="lh-login__form" autocomplete="off" @submit.prevent="submit">
        <label class="lh-login__field">
          <span>{{ t('login.account') }}</span>
          <input
            v-model="account"
            type="text"
            name="lh-account"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            :placeholder="t('login.account.ph')"
          />
        </label>
        <label class="lh-login__field">
          <span>{{ t('login.password') }}</span>
          <input
            v-model="password"
            type="password"
            name="lh-password"
            autocomplete="new-password"
            :placeholder="t('login.password.ph')"
          />
        </label>
        <p v-if="errorMsg" class="lh-login__error" role="alert">{{ errorMsg }}</p>
        <button class="lh-login__submit" type="submit" :disabled="loading">
          {{ loading ? t('login.loading') : t('login.submit') }}
        </button>
        <p class="lh-login__hint">{{ t('login.hint') }}</p>
      </form>
    </div>
  </div>
</template>
