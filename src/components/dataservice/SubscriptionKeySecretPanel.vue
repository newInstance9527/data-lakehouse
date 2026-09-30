<script setup>
/**
 * 订阅 Key 详情：脱敏展示 +「查看密钥」拉取 Vault 明文，支持复制 / 重新脱敏。
 */
import { computed, ref, watch } from 'vue'
import { revealDataapiKey } from '@/api/dataapi.js'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  /** mapKeyRow 结果或列表行：至少含 id、appKey / appKeyMasked、keyHint */
  keyMeta: { type: Object, default: null },
})

const { showToast } = useToast()

const revealed = ref(false)
const loading = ref(false)
const plainToken = ref('')
const plainAppKey = ref('')
const errorMsg = ref('')
const revealedAt = ref('')

watch(
  () => props.keyMeta?.id,
  () => {
    remask()
  },
)

const maskedAppKey = computed(() => {
  const k = props.keyMeta
  if (!k) return '—'
  return k.appKeyMasked || k.appKey || '—'
})

const displayAppKey = computed(() => {
  if (revealed.value && plainAppKey.value) return plainAppKey.value
  return maskedAppKey.value
})

const displayToken = computed(() => {
  if (!props.keyMeta) return '—'
  if (revealed.value && plainToken.value) return plainToken.value
  const hint = props.keyMeta.keyHint
  if (hint) return `sk_············${hint}`
  return '••••••••••••••••'
})

function remask() {
  revealed.value = false
  plainToken.value = ''
  plainAppKey.value = ''
  errorMsg.value = ''
  revealedAt.value = ''
}

async function reveal() {
  const id = props.keyMeta?.id
  if (!id) {
    showToast('缺少订阅 Key id，无法查看', 'warning')
    return
  }
  if (revealed.value && plainToken.value) {
    revealed.value = true
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await revealDataapiKey({ id, reason: '门户订阅 Key 详情查看密钥' })
    plainToken.value = res?.token || ''
    plainAppKey.value = res?.appKey || props.keyMeta?.appKey || ''
    if (!plainToken.value) {
      throw new Error('后端未返回 token')
    }
    revealedAt.value = res?.revealedAt ? String(res.revealedAt) : ''
    revealed.value = true
    showToast('已从 Vault 拉取密钥明文', 'success')
  } catch (e) {
    errorMsg.value = e?.message || String(e)
    showToast(`查看密钥失败：${errorMsg.value}`, 'warning')
  } finally {
    loading.value = false
  }
}

function toggle() {
  if (revealed.value) {
    remask()
    return
  }
  reveal()
}

async function copyText(text, label) {
  const t = String(text || '').trim()
  if (!t) {
    showToast(`无可复制的${label}`, 'warning')
    return
  }
  try {
    await navigator.clipboard.writeText(t)
    showToast(`已复制${label}`, 'success')
  } catch {
    showToast(`复制${label}失败`, 'warning')
  }
}

async function copyToken() {
  if (!revealed.value || !plainToken.value) {
    await reveal()
    if (plainToken.value) await copyText(plainToken.value, 'Bearer')
    return
  }
  await copyText(plainToken.value, 'Bearer')
}

function copyAppKey() {
  const v = revealed.value && plainAppKey.value ? plainAppKey.value : props.keyMeta?.appKey
  copyText(v, 'AppKey')
}

defineExpose({ remask })
</script>

<template>
  <div class="key-secret-panel">
    <div class="detail-sec-title">调用凭证</div>
    <div class="key-secret-block">
      <div class="key-secret-row">
        <span class="key-secret-label">AppKey</span>
        <code class="token-display" :class="{ revealed }">{{ displayAppKey }}</code>
        <button type="button" class="btn btn-sm" :disabled="!keyMeta" @click="copyAppKey">复制</button>
      </div>
      <div class="key-secret-row">
        <span class="key-secret-label">Bearer</span>
        <code
          class="token-display"
          :class="{ revealed }"
          title="点击显示 / 隐藏明文"
          @click="toggle"
        >{{ displayToken }}</code>
        <button type="button" class="btn btn-sm" :disabled="loading || !keyMeta?.id" @click="toggle">
          {{ loading ? '拉取中…' : revealed ? '隐藏' : '查看密钥' }}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="loading || !keyMeta?.id"
          @click="copyToken"
        >
          复制
        </button>
      </div>
      <p v-if="errorMsg" class="tip key-secret-err">{{ errorMsg }}</p>
      <p class="tip">
        列表默认脱敏；「查看密钥」按权限从 Vault 拉取明文（申请人或管理员），可再次隐藏。
        <template v-if="revealedAt"> · 本次查看 {{ revealedAt }}</template>
      </p>
    </div>
  </div>
</template>
