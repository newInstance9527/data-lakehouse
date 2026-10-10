<script setup>
/**
 * Superset Embedded SDK 容器（Guest Token；无二次登录；到期续期）
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { embedDashboard } from '@superset-ui/embedded-sdk'
import { fetchBiEmbedSession } from '@/api/bi'

const props = defineProps({
  /** 门户 gov_bi_dashboard.id */
  dashboardId: { type: String, default: '' },
  ws: { type: String, default: '' },
  height: { type: String, default: '70vh' },
  /** 维筛选；写入会话 urlParams，并在变更时重载 iframe */
  filters: { type: Object, default: null },
  /** 外部递增以强制重载（同 dashboard 按维刷新 SQL 后） */
  reloadToken: { type: [Number, String], default: 0 },
})
const emit = defineEmits(['ready', 'error'])

const mountEl = ref(null)
const loading = ref(false)
const err = ref('')
let unmount = null
let sessionDashId = ''

async function issueGuestToken() {
  const session = await fetchBiEmbedSession({
    id: props.dashboardId,
    ws: props.ws,
    filters: props.filters || undefined,
  })
  if (!session?.guestToken || !session?.embeddedId || !session?.supersetDomain) {
    throw new Error(session?.message || '内嵌会话无效')
  }
  return session
}

async function mount() {
  teardown()
  err.value = ''
  if (!props.dashboardId) return
  loading.value = true
  sessionDashId = props.dashboardId
  try {
    const session = await issueGuestToken()
    const mountPoint = mountEl.value
    if (!mountPoint) throw new Error('挂载点未就绪')
    mountPoint.innerHTML = ''
    const urlParams =
      session.urlParams && typeof session.urlParams === 'object' ? session.urlParams : {}
    const handle = await embedDashboard({
      id: session.embeddedId,
      supersetDomain: session.supersetDomain,
      mountPoint,
      fetchGuestToken: async () => {
        if (!props.dashboardId || props.dashboardId !== sessionDashId) {
          throw new Error('看板已切换')
        }
        const next = await issueGuestToken()
        return next.guestToken
      },
      dashboardUiConfig: {
        hideTitle: true,
        hideTab: false,
        filters: { expanded: true, visible: true },
        urlParams,
      },
    })
    unmount = typeof handle?.unmount === 'function' ? () => handle.unmount() : null
    emit('ready', session)
  } catch (e) {
    err.value = e?.message || String(e)
    emit('error', e)
  } finally {
    loading.value = false
  }
}

function teardown() {
  try {
    unmount?.()
  } catch {
    /* ignore */
  }
  unmount = null
  if (mountEl.value) mountEl.value.innerHTML = ''
}

watch(
  () => [props.dashboardId, props.reloadToken],
  () => {
    mount()
  },
  { immediate: true },
)

onBeforeUnmount(() => teardown())

defineExpose({ reload: mount })
</script>

<template>
  <div class="bi-embed">
    <div v-if="loading" class="bi-embed-loading" :style="{ minHeight: height }" aria-busy="true">
      <div class="bi-embed-loading-bar" />
      <p class="tip">正在打开看板…</p>
    </div>
    <div v-else-if="err" class="bi-embed-err" :style="{ minHeight: height }">
      <p class="bi-embed-err-t">看板暂时打不开</p>
      <p class="tip">{{ err }}</p>
      <p class="tip">
        请确认分析服务已开启内嵌，且允许当前门户地址嵌入。运维可对照
        <code>ops/superset-embed.md</code>。
      </p>
      <button type="button" class="btn btn-sm" @click="mount">重试</button>
    </div>
    <div
      v-show="!loading && !err"
      ref="mountEl"
      class="bi-embed-frame"
      :style="{ minHeight: height }"
    />
  </div>
</template>

<style scoped>
.bi-embed-frame {
  width: 100%;
  border: 1px solid var(--border, #e5e5e5);
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.bi-embed-frame :deep(iframe) {
  width: 100%;
  min-height: inherit;
  border: 0;
}
.bi-embed-loading,
.bi-embed-err {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed var(--border, #e5e5e5);
  border-radius: 6px;
  background: var(--bg-1, #fafafa);
  padding: 24px;
  text-align: center;
}
.bi-embed-loading-bar {
  width: 120px;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--primary, #1677ff), transparent);
  background-size: 200% 100%;
  animation: bi-embed-shine 1.2s linear infinite;
}
.bi-embed-err-t {
  margin: 0;
  font-weight: 600;
  font-size: 14px;
}
@keyframes bi-embed-shine {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
