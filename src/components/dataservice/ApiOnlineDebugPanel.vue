<script setup>
import { computed, ref, watch } from 'vue'
import { trialDataapi, gatewayProbe } from '@/api/dataapi.js'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  detail: { type: Object, required: true },
  /** 本 API 已订阅 Key 元数据（可带出 AppKey，密文需用户粘贴） */
  keys: { type: Array, default: () => [] },
})

const { showToast } = useToast()

const AUTH_STORE_PREFIX = 'dataservice-debug-auth:'

const mode = ref('trial')
const running = ref(false)
const result = ref(null)
const appKey = ref('')
const bearerToken = ref('')
const showSecret = ref(false)
const selectedKeyId = ref('')
/** @type {import('vue').Ref<Array<{name:string,type:string,required:boolean,value:string,desc?:string}>>} */
const paramRows = ref([])

const published = computed(() => String(props.detail?.state || '').toLowerCase() === 'published')
const isOpenApi = computed(() => {
  const d = props.detail || {}
  const sr = d.sqlrest?.data || d.sqlrest || {}
  return !!(d.open ?? sr.open)
})
const authMode = computed(() => props.detail?.auth || props.detail?.authMode || 'Token')

const keyOptions = computed(() =>
  (props.keys || []).filter((k) => k && (k.appKey || k.appKeyMasked)),
)

function defaultMode() {
  return published.value ? 'gateway' : 'trial'
}

function authStorageKey() {
  return AUTH_STORE_PREFIX + String(props.detail?.id || '')
}

function loadAuth() {
  appKey.value = ''
  bearerToken.value = ''
  selectedKeyId.value = ''
  showSecret.value = false
  if (!props.detail?.id) return
  try {
    const raw = sessionStorage.getItem(authStorageKey())
    if (!raw) return
    const o = JSON.parse(raw)
    if (o?.appKey) appKey.value = String(o.appKey)
    if (o?.bearerToken) bearerToken.value = String(o.bearerToken)
  } catch {
    /* ignore */
  }
}

function saveAuth() {
  if (!props.detail?.id) return
  try {
    sessionStorage.setItem(
      authStorageKey(),
      JSON.stringify({
        appKey: appKey.value.trim(),
        bearerToken: bearerToken.value.trim(),
      }),
    )
  } catch {
    /* ignore */
  }
}

function syncParamsFromDetail() {
  const list = Array.isArray(props.detail?.params) ? props.detail.params : []
  paramRows.value = list
    .filter((p) => p && String(p.name || '').trim())
    .map((p) => ({
      name: String(p.name).trim(),
      type: String(p.type || 'string'),
      required: !!p.required,
      desc: p.desc || '',
      value: String(p.example ?? p.defaultValue ?? p.default ?? p.value ?? ''),
    }))
}

watch(
  () => props.detail?.id,
  () => {
    mode.value = defaultMode()
    result.value = null
    syncParamsFromDetail()
    loadAuth()
  },
  { immediate: true },
)

watch(
  () => props.detail?.params,
  () => {
    const prev = new Map(paramRows.value.map((r) => [r.name, r.value]))
    syncParamsFromDetail()
    for (const row of paramRows.value) {
      if (prev.has(row.name) && String(prev.get(row.name) || '').length) {
        row.value = prev.get(row.name)
      }
    }
  },
  { deep: true },
)

function onPickKey() {
  const hit = keyOptions.value.find((k) => String(k.id || k.appKey) === selectedKeyId.value)
  if (!hit) return
  const ak = hit.appKey || ''
  // 掩码不可直接当真实 Key
  if (ak && !String(ak).includes('*') && !String(ak).includes('…')) {
    appKey.value = ak
  } else if (hit.appKeyMasked && !appKey.value) {
    showToast('列表仅存掩码 AppKey，请粘贴完整 X-App-Key 与 Bearer Secret', 'info')
  }
}

const modeHint = computed(() => {
  if (mode.value === 'gateway') {
    if (!published.value) {
      return '接口尚未发布：Gateway 可能 404；建议改用 SQL 试跑，或先申请发布上线。'
    }
    if (isOpenApi.value) {
      return '接口为 open，可不填 Key；仍可带参验证鉴权链路。'
    }
    return `鉴权：${authMode.value}（请求头 X-App-Key + Authorization: Bearer）。密文仅审批当次展示，请粘贴后执行。`
  }
  return '经 SQLREST Manager debug 试跑绑定 SQL（不经 Gateway）。需已保存草稿。'
})

function validateRequired() {
  const miss = paramRows.value.filter((r) => r.required && !String(r.value ?? '').trim())
  if (miss.length) {
    showToast(`请填写必填入参：${miss.map((m) => m.name).join(', ')}`, 'warning')
    return false
  }
  return true
}

function payloadParams() {
  return paramRows.value.map((r) => ({
    name: r.name,
    type: r.type,
    required: r.required,
    value: r.value,
    example: r.value,
  }))
}

function pretty(v) {
  if (v == null) return ''
  if (typeof v === 'string') {
    try {
      return JSON.stringify(JSON.parse(v), null, 2)
    } catch {
      return v
    }
  }
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

const resultPreview = computed(() => {
  const r = result.value
  if (!r) return ''
  if (mode.value === 'gateway') {
    return pretty(r.bodyPreview || r.message || r)
  }
  const sample = r.sample ?? r.data?.answer ?? r.data
  if (sample != null) return pretty(sample)
  return pretty(r.message || r.hint || r)
})

async function run() {
  if (!props.detail?.id) {
    showToast('无绑定 id，请先保存草稿', 'warning')
    return
  }
  if (!validateRequired()) return
  running.value = true
  result.value = null
  try {
    const params = payloadParams()
    if (mode.value === 'gateway') {
      saveAuth()
      const res = await gatewayProbe({
        id: props.detail.id,
        path: props.detail.path,
        method: props.detail.method || 'GET',
        params,
        appKey: appKey.value.trim() || undefined,
        bearerToken: bearerToken.value.trim() || undefined,
      })
      result.value = res
      const detailMsg = [res?.hint || res?.message, res?.suggestion].filter(Boolean).join(' · ')
      if (res?.ok) {
        showToast(`Gateway 成功 HTTP ${res.httpStatus} · ${res.latencyMs}ms`, 'success')
      } else {
        showToast(detailMsg || `Gateway 失败${res?.httpStatus != null ? ` HTTP ${res.httpStatus}` : ''}`, 'warning')
      }
    } else {
      const res = await trialDataapi({
        id: props.detail.id,
        method: props.detail.method || 'GET',
        params,
        portalDsId: props.detail.portalDsId || props.detail.datasourceId,
        dsId: props.detail.portalDsId || props.detail.datasourceId,
        engine: props.detail.engine || props.detail.sqlrest?.engine || 'SQL',
        sql: props.detail.sql || undefined,
      })
      result.value = {
        ok: !!(res?.ok || res?.sample != null || res?.data != null),
        sample: res?.sample ?? res?.data?.answer ?? res?.data,
        message: res?.message,
        hint: res?.hint,
        latencyMs: res?.latencyMs,
        sqlPreview: res?.sqlPreview,
        degraded: !!res?.degraded,
      }
      if (result.value.ok) {
        showToast('SQL 试跑成功', 'success')
      } else {
        showToast(`试跑失败：${res?.message || res?.hint || '未知错误'}`, 'warning')
      }
    }
  } catch (e) {
    result.value = { ok: false, message: e?.message || String(e) }
    showToast(`调试失败：${e?.message || e}`, 'warning')
  } finally {
    running.value = false
  }
}

function clearAuth() {
  appKey.value = ''
  bearerToken.value = ''
  selectedKeyId.value = ''
  try {
    sessionStorage.removeItem(authStorageKey())
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <section class="online-debug">
    <div class="od-tabs" role="tablist">
      <button
        type="button"
        class="od-tab"
        :class="{ active: mode === 'gateway' }"
        role="tab"
        :aria-selected="mode === 'gateway'"
        @click="mode = 'gateway'"
      >
        Gateway 调用
      </button>
      <button
        type="button"
        class="od-tab"
        :class="{ active: mode === 'trial' }"
        role="tab"
        :aria-selected="mode === 'trial'"
        @click="mode = 'trial'"
      >
        SQL 试跑
      </button>
    </div>
    <p class="tip od-hint">{{ modeHint }}</p>

    <div v-if="mode === 'gateway'" class="od-card">
      <div class="od-card-head">
        <span class="od-card-title">鉴权</span>
        <span v-if="isOpenApi" class="tag tag-green">open</span>
        <span v-else class="tag tag-orange">需 Key</span>
        <button type="button" class="btn-link od-clear" @click="clearAuth">清空</button>
      </div>
      <div v-if="keyOptions.length" class="od-field">
        <label class="od-label">选用已有订阅</label>
        <select v-model="selectedKeyId" class="select" @change="onPickKey">
          <option value="">手动填写…</option>
          <option v-for="k in keyOptions" :key="k.id || k.appKey" :value="String(k.id || k.appKey)">
            {{ k.app || k.name || '订阅' }} · {{ k.appKey || k.appKeyMasked }}
          </option>
        </select>
      </div>
      <div class="od-field">
        <label class="od-label">X-App-Key</label>
        <input v-model="appKey" class="input" placeholder="AK_…" autocomplete="off" spellcheck="false" />
      </div>
      <div class="od-field">
        <label class="od-label">
          Bearer Secret
          <button type="button" class="btn-link" @click="showSecret = !showSecret">
            {{ showSecret ? '隐藏' : '显示' }}
          </button>
        </label>
        <input
          v-model="bearerToken"
          class="input"
          :type="showSecret ? 'text' : 'password'"
          placeholder="审批通过时展示的 Secret（可省略 Bearer 前缀）"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
    </div>

    <div class="od-card">
      <div class="od-card-head">
        <span class="od-card-title">业务入参</span>
        <span class="tip">{{ paramRows.length ? `${paramRows.length} 个` : '无' }}</span>
      </div>
      <div v-if="paramRows.length" class="od-params">
        <div v-for="row in paramRows" :key="row.name" class="od-param">
          <label class="od-param-label">
            <code>{{ row.name }}</code>
            <span class="od-type">{{ row.type }}</span>
            <span v-if="row.required" class="od-req">必填</span>
          </label>
          <input
            v-model="row.value"
            class="input"
            :placeholder="row.desc || row.name"
            :aria-required="row.required"
          />
        </div>
      </div>
      <p v-else class="tip detail-empty">无入参定义；可直接执行</p>
    </div>

    <div class="od-actions">
      <button type="button" class="btn btn-primary" :disabled="running || !detail?.id" @click="run">
        {{ running ? '执行中…' : mode === 'gateway' ? '调用 Gateway' : '执行试跑' }}
      </button>
    </div>

    <div class="od-card od-result-card">
      <div class="od-card-head">
        <span class="od-card-title">结果</span>
        <template v-if="result">
          <span class="tag" :class="result.ok ? 'tag-green' : 'tag-orange'">
            {{ result.ok ? '成功' : '失败' }}
          </span>
          <span v-if="result.httpStatus != null" class="tip">HTTP {{ result.httpStatus }}</span>
          <span v-if="result.latencyMs != null" class="tip">{{ result.latencyMs }}ms</span>
          <span v-if="result.authAppKey || result.authBearer" class="tip">已带鉴权头</span>
          <span v-if="result.degraded" class="tag tag-orange">降级</span>
        </template>
      </div>
      <template v-if="result">
        <p v-if="result.hint || result.suggestion || result.message" class="tip od-msg">
          {{ [result.hint || result.message, result.suggestion].filter(Boolean).join(' · ') }}
        </p>
        <p v-if="result.requestUrl" class="tip od-url">
          <code>{{ result.method }} {{ result.requestUrl }}</code>
        </p>
        <pre class="od-pre">{{ resultPreview }}</pre>
      </template>
      <p v-else class="tip detail-empty">配置鉴权与入参后点执行</p>
    </div>
  </section>
</template>

<style scoped>
.online-debug {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.od-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--bg-2, #f0f2f5);
  border-radius: 8px;
}
.od-tab {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 8px 10px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-2, #666);
}
.od-tab.active {
  background: var(--bg-1, #fff);
  color: var(--text-1, #111);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.od-hint {
  margin: 0;
}
.od-card {
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-1, #fff);
}
.od-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.od-card-title {
  font-size: 13px;
  font-weight: 600;
}
.od-clear {
  margin-left: auto;
  font-size: 12px;
}
.od-field {
  margin-bottom: 10px;
}
.od-field:last-child {
  margin-bottom: 0;
}
.od-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 4px;
}
.od-params {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.od-param-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 4px;
}
.od-type {
  color: var(--text-3);
}
.od-req {
  color: var(--danger, #c0392b);
  font-size: 11px;
}
.od-actions {
  display: flex;
  gap: 8px;
}
.od-result-card .od-card-head {
  margin-bottom: 8px;
}
.od-msg,
.od-url {
  margin: 0 0 6px;
  word-break: break-all;
}
.od-pre {
  margin: 0;
  max-height: min(50vh, 420px);
  overflow: auto;
  padding: 10px;
  font-size: 12px;
  line-height: 1.45;
  background: var(--bg-2, #f6f7f9);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
.detail-empty {
  margin: 0;
}
.select,
.input {
  width: 100%;
}
</style>
