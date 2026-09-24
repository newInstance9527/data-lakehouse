/**
 * AI 模型管理（对接 /lh/ai/models*）
 */
import { computed, ref } from 'vue'
import {
  createAiModel,
  deleteAiModel,
  enableAiModel,
  fetchAiModel,
  fetchAiModelOverview,
  fetchAiModels,
  fetchAiRoutes,
  fetchAiUsage,
  testAiModel,
  updateAiModel,
} from '@/api/ai'
import { formatAiPrice, maskApiKey } from '@/data/ai'

function asBoolFlag(v) {
  return v === true || v === 1 || v === '1'
}

const models = ref([])
const routes = ref([])
const usageBars = ref([])
const overview = ref(null)
const loading = ref(false)
const loaded = ref(false)
const lastError = ref(null)
let loadPromise = null

const vendorMeta = {
  OpenAI: { logo: '🟢', bg: '#e6f7ff' },
  Anthropic: { logo: '🟣', bg: '#f3e5ff' },
  DeepSeek: { logo: '🟠', bg: '#fff7e6' },
  阿里云: { logo: '🔵', bg: '#e6f7ff' },
  通义: { logo: '🔵', bg: '#e6f7ff' },
  GLM: { logo: '🟠', bg: '#fff7e6' },
  自建: { logo: '⚪', bg: '#f5f5f5' },
}

export function normalizeAiModel(row) {
  if (!row) return null
  const unit = row.priceUnit || 'usd_1m'
  const inputRate = Number(row.inputRate) || 0
  const outputRate = Number(row.outputRate) || 0
  const meta = vendorMeta[row.vendor] || vendorMeta['自建']
  const kind = String(row.kind || 'chat').toLowerCase()
  return {
    id: row.id,
    name: row.name || row.modelName,
    vendor: row.vendor,
    logo: meta.logo,
    bg: meta.bg,
    endpoint: row.baseUrl || row.endpoint,
    key: row.keyMask || maskApiKey(row.key) || '（Vault）',
    context: row.contextTokens || row.context || '128K',
    priceUnit: unit,
    inputRate,
    outputRate,
    input: row.input || formatAiPrice(unit, inputRate),
    output: row.output || formatAiPrice(unit, outputRate),
    enabled: row.enabled === true || row.enabled === 1,
    status: row.status || (row.enabled ? 'ok' : 'off'),
    latency: row.latencyMs != null ? `${(row.latencyMs / 1000).toFixed(1)}s` : '—',
    latencyMs: row.latencyMs,
    calls: formatCalls(row.callsTotal),
    cost: formatCost(row.costTotal),
    role: row.roleLabel || row.role || '',
    kind,
    supportsVision: kind === 'chat' && asBoolFlag(row.supportsVision),
    supportsImageOutput: asBoolFlag(row.supportsImageOutput) || kind === 'image',
    modelName: row.modelName,
    vaultPath: row.vaultPath,
    litellmAlias: row.litellmAlias,
    litellmSyncOk: row.litellmSyncOk,
    litellmSyncSkipped: row.litellmSyncSkipped,
    litellmSyncMessage: row.litellmSyncMessage,
    egressKind: row.egressKind || 'egress',
    egressApproved: row.egressApproved === true || row.egressApproved === 1 || row.egressKind === 'local',
    tokenQuota: row.tokenQuota != null && Number(row.tokenQuota) > 0 ? Number(row.tokenQuota) : null,
    costQuota: row.costQuota != null && Number(row.costQuota) > 0 ? Number(row.costQuota) : null,
    tokenUsed: Number(row.tokenUsed) || 0,
    costUsed: Number(row.costUsed) || 0,
    tokenRemaining: row.tokenRemaining != null ? Number(row.tokenRemaining) : null,
    costRemaining: row.costRemaining != null ? Number(row.costRemaining) : null,
    tokenPct: Number(row.tokenPct) || 0,
    costPct: Number(row.costPct) || 0,
    quotaLimited: Boolean(row.quotaLimited),
  }
}

function capabilityPayload(payload) {
  const kind = payload.kind || 'chat'
  return {
    kind,
    supportsVision: kind === 'chat' && asBoolFlag(payload.supportsVision),
    supportsImageOutput:
      kind === 'image' &&
      (payload.supportsImageOutput === undefined ||
        payload.supportsImageOutput === '' ||
        asBoolFlag(payload.supportsImageOutput)),
  }
}

function formatCalls(n) {
  const v = Number(n) || 0
  if (v >= 10000) return `${(v / 10000).toFixed(1)}万`
  return String(v)
}

function formatCost(n) {
  const v = Number(n) || 0
  return `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

export function normalizeAiRoute(row) {
  if (!row) return null
  return {
    id: row.id,
    scene: row.sceneLabel || sceneLabel(row.scene),
    sceneKey: row.scene,
    ws: row.wsScope === '*' ? '全部' : row.wsScope,
    wsScope: row.wsScope,
    primary: row.primaryName || row.primaryModelId,
    fallback: row.fallbackName || row.fallbackModelId || '—',
    primaryModelId: row.primaryModelId,
    fallbackModelId: row.fallbackModelId,
    status: row.enabled === false || row.enabled === 0 ? 'off' : row.status || 'ok',
    enabled: !(row.enabled === false || row.enabled === 0),
  }
}

function sceneLabel(s) {
  return (
    {
      sql: 'SQL 生成/优化',
      script: '脚本生成',
      diagnose: '故障诊断',
      manual: '使用手册问答',
      sandbox: '沙箱实验',
      embed: 'Embedding',
    }[s] || s
  )
}

export function useAiModels() {
  function ensureLoaded() {
    if (loaded.value || loading.value || loadPromise) return loadPromise
    loadPromise = loadAll()
      .catch(() => {})
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  async function loadAll(ws) {
    loading.value = true
    lastError.value = null
    try {
      const [page, ov, rts, usage] = await Promise.all([
        fetchAiModels({ ws }, { current: 1, size: 200 }),
        fetchAiModelOverview(ws).catch(() => null),
        fetchAiRoutes(ws).catch(() => []),
        fetchAiUsage({ range: '30d', group: 'model', ws }).catch(() => null),
      ])
      models.value = (page?.records || page || []).map(normalizeAiModel).filter(Boolean)
      overview.value = ov
      routes.value = (Array.isArray(rts) ? rts : rts?.records || []).map(normalizeAiRoute).filter(Boolean)
      usageBars.value = buildUsageBars(usage, models.value)
      loaded.value = true
      return models.value
    } catch (e) {
      lastError.value = e
      console.error('[aimodel] load failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function buildUsageBars(usage, list) {
    const items = usage?.items || usage?.records || []
    if (items.length) {
      const max = Math.max(...items.map((i) => Number(i.calls) || 0), 1)
      return items.map((i) => ({
        name: i.name || i.modelName || i.modelId,
        calls: Number(i.calls) || 0,
        pct: Math.round(((Number(i.calls) || 0) / max) * 100),
        cost: formatCost(i.costAmount ?? i.cost),
      }))
    }
    const max = Math.max(...list.map((m) => Number(String(m.calls).replace('万', '')) * (String(m.calls).includes('万') ? 10000 : 1) || 0), 1)
    return list.map((m) => {
      const calls = Number(m.callsTotal) || 0
      return {
        name: `${m.name} · ${m.role || ''}`.trim(),
        calls,
        pct: Math.round((calls / max) * 100),
        cost: m.cost,
      }
    })
  }

  async function addModel(payload) {
    const caps = capabilityPayload(payload)
    const saved = await createAiModel({
      vendor: payload.vendor,
      name: payload.model,
      modelName: payload.model,
      baseUrl: payload.baseURL || payload.baseUrl,
      key: payload.key,
      contextTokens: payload.context,
      priceUnit: payload.priceUnit,
      inputRate: payload.inputRate,
      outputRate: payload.outputRate,
      tokenQuota: Number(payload.tokenQuota) > 0 ? Math.floor(Number(payload.tokenQuota)) : 0,
      costQuota: Number(payload.costQuota) > 0 ? Number(payload.costQuota) : 0,
      roleLabel: payload.use,
      kind: caps.kind,
      supportsVision: caps.supportsVision,
      supportsImageOutput: caps.supportsImageOutput,
      ws: payload.ws,
      egressApproved: payload.egressApproved === true || payload.egressApproved === 1 || payload.egressApproved === '1',
    })
    const n = normalizeAiModel(saved)
    models.value.unshift(n)
    return n
  }

  async function editModel(id, payload) {
    const caps = capabilityPayload(payload)
    const saved = await updateAiModel(id, {
      vendor: payload.vendor,
      name: payload.model,
      modelName: payload.model,
      baseUrl: payload.baseURL || payload.baseUrl,
      key: payload.key,
      contextTokens: payload.context,
      priceUnit: payload.priceUnit,
      inputRate: payload.inputRate,
      outputRate: payload.outputRate,
      tokenQuota: Number(payload.tokenQuota) > 0 ? Math.floor(Number(payload.tokenQuota)) : 0,
      costQuota: Number(payload.costQuota) > 0 ? Number(payload.costQuota) : 0,
      roleLabel: payload.use,
      kind: caps.kind,
      supportsVision: caps.supportsVision,
      supportsImageOutput: caps.supportsImageOutput,
      egressApproved: payload.egressApproved === true || payload.egressApproved === 1 || payload.egressApproved === '1',
    })
    const n = normalizeAiModel(saved)
    const idx = models.value.findIndex((x) => x.id === id)
    if (idx >= 0) models.value[idx] = { ...models.value[idx], ...n }
    return n
  }

  async function toggle(id, enabled) {
    const saved = await enableAiModel(id, enabled)
    const n = normalizeAiModel(saved)
    const idx = models.value.findIndex((x) => x.id === id)
    if (idx >= 0) models.value[idx] = { ...models.value[idx], ...n }
    return n
  }

  async function test(id) {
    return testAiModel(id)
  }

  async function getDetail(id) {
    const row = await fetchAiModel(id)
    return normalizeAiModel(row)
  }

  async function removeModel(id) {
    await deleteAiModel(id)
    models.value = models.value.filter((m) => m.id !== id)
    // 后端可能级联停用路由；刷新列表与路由，避免本地假成功
    try {
      await loadAll()
    } catch {
      /* 删除已成功，列表已本地剔除 */
    }
  }

  return {
    models: computed(() => {
      ensureLoaded()
      return models.value
    }),
    routes: computed(() => {
      ensureLoaded()
      return routes.value
    }),
    usageBars: computed(() => {
      ensureLoaded()
      return usageBars.value
    }),
    overview: computed(() => overview.value),
    loading,
    loaded,
    lastError,
    loadAll,
    ensureLoaded,
    addModel,
    editModel,
    removeModel,
    getDetail,
    toggle,
    test,
  }
}
