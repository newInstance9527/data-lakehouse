<script setup>
import { computed, ref, watch } from 'vue'
import { trialDataapi, gatewayProbe, revealDataapiKey } from '@/api/dataapi.js'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  detail: { type: Object, required: true },
  /** 本 API 已订阅 Key 元数据；选用时会从 Vault 回显 AppKey + Bearer Secret */
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
const pickingKey = ref(false)
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
  (props.keys || []).filter((k) => k && (k.id || k.appKey || k.appKeyMasked)),
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

function isPlainSecret(v) {
  const s = String(v || '').trim()
  if (!s || s === '—') return false
  if (s.includes('*') || s.includes('…') || s.includes('•') || s.includes('·')) return false
  return true
}

async function onPickKey() {
  if (!selectedKeyId.value) return
  const hit = keyOptions.value.find((k) => String(k.id || k.appKey) === selectedKeyId.value)
  if (!hit) return

  // 列表偶发带明文时先填；Bearer Secret 通常不在列表，需 Vault
  if (isPlainSecret(hit.appKey)) {
    appKey.value = String(hit.appKey).trim()
  }
  if (isPlainSecret(hit.token) || isPlainSecret(hit.secret) || isPlainSecret(hit.bearerToken)) {
    bearerToken.value = String(hit.token || hit.secret || hit.bearerToken).trim()
    saveAuth()
    showToast('已填入订阅鉴权', 'success')
    return
  }

  const keyId = hit.id
  if (!keyId) {
    showToast('该订阅缺少 id，无法拉取 Secret，请手动粘贴', 'warning')
    return
  }

  pickingKey.value = true
  try {
    const res = await revealDataapiKey({
      id: keyId,
      reason: '在线调试选用已有订阅自动填充鉴权',
    })
    const ak = String(res?.appKey || hit.appKey || '').trim()
    const token = String(res?.token || '').trim()
    if (ak && isPlainSecret(ak)) appKey.value = ak
    if (token) {
      bearerToken.value = token
      showSecret.value = false
      saveAuth()
      showToast('已从 Vault 填充 X-App-Key 与 Bearer Secret', 'success')
    } else {
      showToast('已填充 AppKey，但未返回 Secret，请手动粘贴', 'warning')
    }
  } catch (e) {
    showToast(`拉取订阅密钥失败：${e?.message || e}（可手动粘贴）`, 'warning')
  } finally {
    pickingKey.value = false
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
    return `鉴权：${authMode.value}（请求头 X-App-Key + Authorization: Bearer）。可选用已有订阅自动从 Vault 填充，或手动粘贴。`
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
    const t = v.trim()
    if (!t) return ''
    try {
      return JSON.stringify(JSON.parse(t), null, 2)
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

function compact(v) {
  if (v == null) return ''
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return ''
    try {
      return JSON.stringify(JSON.parse(t))
    } catch {
      return v
    }
  }
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** 取响应体原文（未美化）；优先完整 body */
function resultRawPayload(r) {
  if (!r) return ''
  if (mode.value === 'gateway') {
    if (r.body != null && r.body !== '') return r.body
    if (r.bodyPreview != null && r.bodyPreview !== '') return r.bodyPreview
    return r.message ?? r
  }
  const sample = r.sample ?? r.data?.answer ?? r.data
  if (sample != null) return sample
  return r.message || r.hint || r
}

const formatPretty = ref(true)

const resultBodyTruncated = computed(() => !!(result.value && result.value.bodyTruncated))

const resultPreview = computed(() => {
  const r = result.value
  if (!r) return ''
  const payload = resultRawPayload(r)
  return formatPretty.value ? pretty(payload) : compact(payload)
})

const resultCharCount = computed(() => {
  const r = result.value
  if (!r) return 0
  if (typeof r.bodyLength === 'number') return r.bodyLength
  const raw = resultRawPayload(r)
  if (typeof raw === 'string') return raw.length
  try {
    return JSON.stringify(raw).length
  } catch {
    return 0
  }
})

async function copyResult() {
  const text = resultPreview.value
  if (!text) {
    showToast('无可复制内容', 'warning')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    showToast('已复制响应', 'success')
  } catch {
    showToast('复制失败', 'warning')
  }
}

function formatResult() {
  if (!result.value) return
  formatPretty.value = true
  const text = resultPreview.value
  if (!text) {
    showToast('无可格式化内容', 'warning')
    return
  }
  const raw = resultRawPayload(result.value)
  if (resultBodyTruncated.value) {
    showToast('响应曾被截断，格式化可能不完整', 'warning')
    return
  }
  if (typeof raw === 'string') {
    try {
      JSON.parse(raw.trim())
      showToast('已格式化 JSON', 'success')
    } catch {
      showToast('非 JSON，已按原文展示', 'info')
    }
  } else {
    showToast('已格式化 JSON', 'success')
  }
}

function toggleResultFormat() {
  if (!result.value) return
  formatPretty.value = !formatPretty.value
  showToast(formatPretty.value ? '已切换为格式化' : '已切换为紧凑', 'info')
}

async function run() {
  if (!props.detail?.id) {
    showToast('无绑定 id，请先保存草稿', 'warning')
    return
  }
  if (!validateRequired()) return
  running.value = true
  result.value = null
  formatPretty.value = true
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

function httpStatusClass(status) {
  const n = Number(status)
  if (!Number.isFinite(n)) return ''
  if (n >= 200 && n < 300) return 'ok'
  if (n >= 400 && n < 500) return 'warn'
  if (n >= 500) return 'err'
  return ''
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
    <p class="od-hint">{{ modeHint }}</p>

    <div v-if="mode === 'gateway'" class="od-card">
      <div class="od-card-head">
        <span class="od-card-title">鉴权</span>
        <span v-if="isOpenApi" class="tag tag-green">open</span>
        <span v-else class="tag tag-orange">需 Key</span>
        <button type="button" class="btn-link od-clear" @click="clearAuth">清空</button>
      </div>
      <div v-if="keyOptions.length" class="od-field">
        <label class="od-label">选用已有订阅</label>
        <select
          v-model="selectedKeyId"
          class="select"
          :disabled="pickingKey"
          @change="onPickKey"
        >
          <option value="">手动填写…</option>
          <option v-for="k in keyOptions" :key="k.id || k.appKey" :value="String(k.id || k.appKey)">
            {{ k.app || k.name || '订阅' }} · {{ k.appKeyMasked || k.appKey }}
          </option>
        </select>
        <span v-if="pickingKey" class="od-pick-hint">正在从 Vault 拉取密钥…</span>
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
        <span class="od-badge">{{ paramRows.length ? `${paramRows.length} 个` : '无' }}</span>
      </div>
      <div v-if="paramRows.length" class="od-params">
        <div v-for="row in paramRows" :key="row.name" class="od-param">
          <label class="od-param-label">
            <code>{{ row.name }}</code>
            <span class="od-type">{{ row.type }}</span>
            <span v-if="row.required" class="od-req">必填</span>
            <span v-if="row.desc" class="od-desc">{{ row.desc }}</span>
          </label>
          <input
            v-model="row.value"
            class="input"
            :placeholder="row.desc || `填写 ${row.name}`"
            :aria-required="row.required"
          />
        </div>
      </div>
      <div v-else class="od-empty">无入参定义；可直接执行</div>
    </div>

    <div class="od-actions">
      <button type="button" class="btn btn-primary" :disabled="running || !detail?.id" @click="run">
        {{ running ? '执行中…' : mode === 'gateway' ? '调用 Gateway' : '执行试跑' }}
      </button>
      <span v-if="!detail?.id" class="tip">需先保存草稿</span>
    </div>

    <div class="od-card od-result-card" :class="{ 'has-result': !!result, ok: result?.ok, fail: result && !result.ok }">
      <div class="od-card-head">
        <span class="od-card-title">响应结果</span>
        <template v-if="result">
          <span class="tag" :class="result.ok ? 'tag-green' : 'tag-orange'">
            {{ result.ok ? '成功' : '失败' }}
          </span>
          <span
            v-if="result.httpStatus != null"
            class="od-status"
            :class="httpStatusClass(result.httpStatus)"
          >
            HTTP {{ result.httpStatus }}
          </span>
          <span v-if="result.latencyMs != null" class="od-meta">{{ result.latencyMs }}ms</span>
          <span v-if="resultCharCount" class="od-meta">{{ resultCharCount.toLocaleString() }} 字符</span>
          <span v-if="result.authAppKey || result.authBearer" class="od-meta">已带鉴权头</span>
          <span v-if="result.degraded" class="tag tag-orange">降级</span>
          <span v-if="resultBodyTruncated" class="tag tag-orange" title="响应超过上限已截断">已截断</span>
          <div class="od-result-actions">
            <button type="button" class="btn btn-sm" title="JSON 缩进美化" @click="formatResult">
              格式化
            </button>
            <button
              type="button"
              class="btn btn-sm"
              :title="formatPretty ? '切换为紧凑单行' : '切换为缩进格式'"
              @click="toggleResultFormat"
            >
              {{ formatPretty ? '紧凑' : '展开' }}
            </button>
            <button type="button" class="btn btn-sm" title="复制当前展示内容" @click="copyResult">
              复制
            </button>
          </div>
        </template>
        <span v-else class="od-badge">待执行</span>
      </div>
      <template v-if="result">
        <p v-if="result.hint || result.suggestion || result.message" class="od-msg">
          {{ [result.hint || result.message, result.suggestion].filter(Boolean).join(' · ') }}
        </p>
        <p v-if="resultBodyTruncated" class="od-msg od-trunc-warn">
          响应体过大已截断，JSON 可能不完整、无法可靠格式化；请缩小结果集或加 LIMIT 后重试。
        </p>
        <div v-if="result.requestUrl" class="od-url">
          <span class="od-url-label">请求</span>
          <code>{{ result.method }} {{ result.requestUrl }}</code>
        </div>
        <pre class="od-pre">{{ resultPreview || '(空响应)' }}</pre>
      </template>
      <div v-else class="od-empty od-empty-result">
        配置鉴权与入参后点执行，响应体会显示在此处
      </div>
    </div>
  </section>
</template>

<style scoped>
.online-debug {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.od-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--bg-2, #f0f2f5);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
}
.od-tab {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 9px 10px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-2, #666);
  transition: background 0.12s, color 0.12s;
}
.od-tab:hover {
  color: var(--text-1, #111);
}
.od-tab.active {
  background: var(--bg-1, #fff);
  color: var(--text-1, #111);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.od-hint {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-2);
  background: var(--bg-2, #f6f7f9);
  border-radius: 6px;
  border-left: 3px solid var(--primary, #1e6fff);
}
.od-card {
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--bg-1, #fff);
}
.od-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.od-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.od-result-actions {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.od-badge {
  font-size: 11px;
  color: var(--text-3);
  background: var(--bg-2, #f0f2f5);
  border-radius: 99px;
  padding: 2px 8px;
}
.od-clear {
  margin-left: auto;
  font-size: 12px;
}
.od-field {
  margin-bottom: 12px;
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
  margin-bottom: 5px;
}
.od-pick-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-3);
}
.od-params {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.od-param {
  padding: 10px;
  background: var(--bg-2, #f6f7f9);
  border-radius: 6px;
  border: 1px solid transparent;
}
.od-param:focus-within {
  border-color: var(--primary-light, #d6e4ff);
  background: var(--bg-1, #fff);
}
.od-param-label {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
  margin-bottom: 6px;
}
.od-param-label code {
  font-weight: 600;
  font-size: 12px;
}
.od-type {
  color: var(--text-3);
  font-size: 11px;
}
.od-req {
  color: #fff;
  background: var(--danger, #c0392b);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
}
.od-desc {
  flex: 1 1 100%;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.4;
}
.od-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.od-result-card {
  transition: border-color 0.15s;
}
.od-result-card.ok {
  border-color: #b7eb8f;
}
.od-result-card.fail {
  border-color: #ffd591;
}
.od-result-card .od-card-head {
  margin-bottom: 10px;
}
.od-status {
  font-size: 11px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--bg-2);
  color: var(--text-2);
}
.od-status.ok {
  background: #f6ffed;
  color: #389e0d;
}
.od-status.warn {
  background: #fff7e6;
  color: #d46b08;
}
.od-status.err {
  background: #fff1f0;
  color: #cf1322;
}
.od-meta {
  font-size: 11px;
  color: var(--text-3);
}
.od-msg {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-2);
  word-break: break-word;
}
.od-url {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 0 0 8px;
  padding: 8px 10px;
  background: var(--bg-2, #f6f7f9);
  border-radius: 6px;
  font-size: 12px;
  word-break: break-all;
}
.od-url-label {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-3);
  margin-top: 1px;
}
.od-url code {
  font-size: 12px;
  line-height: 1.4;
}
.od-pre {
  margin: 0;
  max-height: min(70vh, 720px);
  overflow: auto;
  padding: 12px;
  font-size: 12px;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--text-1);
  background: var(--bg-2, #f6f7f9);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
.od-trunc-warn {
  color: #d46b08;
}
.od-empty {
  margin: 0;
  padding: 14px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
  background: var(--bg-2, #f6f7f9);
  border: 1px dashed var(--border);
  border-radius: 6px;
  line-height: 1.5;
}
.od-empty-result {
  padding: 28px 16px;
}
.select,
.input {
  width: 100%;
  box-sizing: border-box;
}
@media (max-width: 480px) {
  .od-tab {
    padding: 8px 6px;
    font-size: 12px;
  }
  .od-card {
    padding: 10px 12px;
  }
  .od-pre {
    max-height: min(40vh, 320px);
    font-size: 11px;
  }
}
</style>
