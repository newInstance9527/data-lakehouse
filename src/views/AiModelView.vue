<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useAiModels } from '@/composables/useAiModels'
import { AI_MODEL_EDIT_FORM, AI_MODEL_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  AI_MODELS,
  AI_MODEL_KPIS,
  AI_ROUTES,
  AI_USAGE_BARS,
  formatAiPrice,
  formatUsageCalls,
  maskApiKey,
  modelStatusTag,
  routeStatusTag,
} from '@/data/ai'

const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const guide = pageGuideOf('aimodel')
const api = useAiModels()

/** ?demo=1 强制本地演示；否则优先真 API（空列表也算接真，不再用 AI_MODELS 垫底） */
const forceDemo = computed(() => String(route.query.demo || '') === '1')

const createOpen = ref(false)
const editOpen = ref(false)
const editingId = ref('')
const useDemo = ref(false)
const loadError = ref('')
const models = ref([])
const routeRows = ref([])
const usageBars = ref([])
const kpiCards = ref([
  { icon: '🧠', color: 'blue', value: '—', unit: '个', label: '已接入模型', trend: '加载中', trendUp: true },
  { icon: '✅', color: 'green', value: '—', unit: '', label: '连通性', trend: '', trendUp: true },
  { icon: '💬', color: 'purple', value: '—', unit: '', label: '本月调用', trend: '按空间分摊', trendUp: true },
  { icon: '💰', color: 'orange', value: '—', unit: '', label: '本月成本', trend: '按空间分摊', trendUp: true },
  { icon: '⚡', color: 'red', value: '—', unit: 's', label: '平均响应', trend: 'P95 ≤ 3s', trendUp: true },
])
const gatewayHint = ref('')

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(models)
const enabledCount = computed(() => models.value.filter((m) => m.enabled).length)

const vendorMeta = {
  OpenAI: { logo: '🟢', bg: '#e6f7ff' },
  Anthropic: { logo: '🟣', bg: '#f3e5ff' },
  DeepSeek: { logo: '🟠', bg: '#fff7e6' },
  阿里云: { logo: '🔵', bg: '#e6f7ff' },
  通义: { logo: '🔵', bg: '#e6f7ff' },
  GLM: { logo: '🟠', bg: '#fff7e6' },
  自建: { logo: '⚪', bg: '#f5f5f5' },
}

function applyDemoData() {
  useDemo.value = true
  models.value = AI_MODELS.map((m) => ({ ...m }))
  routeRows.value = AI_ROUTES.map((r) => ({ ...r }))
  usageBars.value = AI_USAGE_BARS.map((b) => ({ ...b }))
  kpiCards.value = AI_MODEL_KPIS.map((k) => ({ ...k }))
  gatewayHint.value = '演示数据（?demo=1 或 API 不可用）'
  resetPage()
}

function applyApiPayload() {
  useDemo.value = false
  models.value = (api.models.value || []).map((m) => ({ ...m }))
  routeRows.value = (api.routes.value || []).map((r) => ({
    scene: r.scene,
    ws: r.ws,
    primary: r.primary,
    fallback: r.fallback,
    status: r.status,
  }))
  usageBars.value = api.usageBars.value?.length
    ? api.usageBars.value.map((b) => ({ ...b }))
    : []
  if (api.overview.value) applyOverviewKpi(api.overview.value)
  else applyOverviewKpi({ total: models.value.length, enabledCount: enabledCount.value })
  const ov = api.overview.value || {}
  if (ov.litellmSyncMode) {
    const mode = ov.litellmSyncMode
    gatewayHint.value =
      mode === 'live'
        ? 'LiteLLM 同步：live'
        : mode === 'skipped'
          ? 'LiteLLM 未启用 · 启停仅写门户'
          : 'LiteLLM 降级 · 启停仅写门户'
  } else {
    gatewayHint.value = '已接 API'
  }
  resetPage()
}

onMounted(async () => {
  if (forceDemo.value) {
    applyDemoData()
    return
  }
  try {
    await api.loadAll()
    applyApiPayload()
  } catch (e) {
    loadError.value = e?.message || '加载失败'
    applyDemoData()
  }
})

function applyOverviewKpi(ov) {
  const lat =
    ov.avgLatencySec != null
      ? String(ov.avgLatencySec)
      : ov.avgLatencyMs != null
        ? (Number(ov.avgLatencyMs) / 1000).toFixed(1)
        : '—'
  kpiCards.value = [
    {
      icon: '🧠',
      color: 'blue',
      value: String(ov.modelCount ?? ov.total ?? models.value.length),
      unit: '个',
      label: '已接入模型',
      trend: `${ov.enabledCount ?? enabledCount.value} 启用`,
      trendUp: true,
    },
    {
      icon: '✅',
      color: 'green',
      value: `${ov.okCount ?? ov.connectivity ?? '—'}`,
      unit: '',
      label: '连通性',
      trend: ov.warnCount ? `${ov.warnCount} 个告警` : ov.litellmReachable === false ? '网关未通' : '正常',
      trendUp: true,
    },
    {
      icon: '💬',
      color: 'purple',
      value: String(ov.monthCalls ?? '—'),
      unit: '',
      label: '本月调用',
      trend: '按空间分摊',
      trendUp: true,
    },
    {
      icon: '💰',
      color: 'orange',
      value: ov.monthCost != null ? `¥${ov.monthCost}` : '—',
      unit: '',
      label: '本月成本',
      trend: '按空间分摊',
      trendUp: true,
    },
    {
      icon: '⚡',
      color: 'red',
      value: lat,
      unit: 's',
      label: '平均响应',
      trend: 'P95 ≤ 3s',
      trendUp: true,
    },
  ]
}

const editInitial = computed(() => {
  const m = models.value.find((x) => x.id === editingId.value)
  if (!m) return null
  return {
    vendor: m.vendor,
    model: m.name,
    baseURL: m.endpoint,
    key: '',
    context: m.context || '128K',
    priceUnit: m.priceUnit || (m.input === '免费' ? 'free' : 'usd_1m'),
    inputRate: m.inputRate ?? 0,
    outputRate: m.outputRate ?? 0,
    use: m.role || '',
    egressApproved: m.egressApproved || m.egressKind === 'local' ? '1' : '0',
  }
})

function addModel() {
  createOpen.value = true
}

function applyPricing(payload) {
  const unit = payload.priceUnit || 'usd_1m'
  const inputRate = unit === 'free' ? 0 : Number(payload.inputRate) || 0
  const outputRate = unit === 'free' ? 0 : Number(payload.outputRate) || 0
  return {
    priceUnit: unit,
    inputRate,
    outputRate,
    input: formatAiPrice(unit, inputRate),
    output: formatAiPrice(unit, outputRate),
  }
}

async function onAddModel(payload) {
  try {
    if (!useDemo.value) {
      const n = await api.addModel(payload)
      models.value.unshift(n)
      if (n?.litellmSyncMessage) {
        showToast(`✅ 模型已接入：${payload.model} · ${n.litellmSyncMessage}`, n.litellmSyncOk ? 'success' : 'info')
      } else {
        showToast(`✅ 模型已接入：${payload.model}`, 'success')
      }
    } else {
      const meta = vendorMeta[payload.vendor] || vendorMeta['自建']
      const pricing = applyPricing(payload)
      models.value.unshift({
        id: `m_${Date.now().toString(36)}`,
        name: payload.model,
        vendor: payload.vendor,
        logo: meta.logo,
        bg: meta.bg,
        endpoint: payload.baseURL,
        key: maskApiKey(payload.key),
        context: payload.context || '128K',
        ...pricing,
        enabled: true,
        status: 'ok',
        latency: '—',
        calls: '0',
        cost: '¥0',
        role: payload.use || '新接入',
      })
      showToast(`✅ 模型已接入：${payload.model}`, 'success')
    }
    createOpen.value = false
    resetPage()
  } catch (e) {
    showToast(e?.message || '接入失败', 'error')
  }
}

function editModel(m) {
  editingId.value = m.id
  editOpen.value = true
}

async function onEditModel(payload) {
  try {
    if (!useDemo.value) {
      const saved = await api.editModel(editingId.value, payload)
      const idx = models.value.findIndex((x) => x.id === editingId.value)
      if (idx >= 0) {
        models.value[idx] = { ...models.value[idx], ...saved }
        if (String(payload.key || '').trim()) {
          models.value[idx].key = maskApiKey(payload.key)
        }
      }
    } else {
      const m = models.value.find((x) => x.id === editingId.value)
      if (m) {
        const meta = vendorMeta[payload.vendor] || vendorMeta['自建']
        const pricing = applyPricing(payload)
        m.name = payload.model
        m.vendor = payload.vendor
        m.logo = meta.logo
        m.bg = meta.bg
        m.endpoint = payload.baseURL
        m.context = payload.context || m.context
        m.role = payload.use || m.role
        Object.assign(m, pricing)
        if (String(payload.key || '').trim()) m.key = maskApiKey(payload.key)
      }
    }
    editOpen.value = false
    editingId.value = ''
    showToast(`✅ 已更新：${payload.model}`, 'success')
  } catch (e) {
    showToast(e?.message || '更新失败', 'error')
  }
}

function usageReport() {
  showToast('📊 工作空间用量报表导出中 · CSV', 'success')
}

function goChat() {
  router.push('/aiassistant')
}

async function testModel(m) {
  try {
    if (!useDemo.value && m.id) {
      const r = await api.test(m.id)
      showToast(`🔧 测试 · ${m.name} · ${r?.status || 'ok'} · ${r?.latencyMs ?? '—'}ms`, 'success')
      if (r?.latencyMs != null) m.latency = `${(r.latencyMs / 1000).toFixed(1)}s`
      if (r?.status) m.status = r.status
    } else {
      showToast(`🔧 测试连通性 · ${m.name || m} · 正常（演示）`, 'success')
    }
  } catch (e) {
    showToast(e?.message || '测试失败', 'error')
  }
}

async function toggleModel(m) {
  try {
    if (!useDemo.value) {
      const saved = await api.toggle(m.id, !m.enabled)
      Object.assign(m, saved)
      const syncBit = saved?.litellmSyncMessage ? ` · ${saved.litellmSyncMessage}` : ''
      showToast(`${m.enabled ? '启用' : '停用'}模型 · ${m.name}${syncBit}`, 'info')
    } else {
      m.enabled = !m.enabled
      showToast(`${m.enabled ? '启用' : '停用'}模型 · ${m.name}`, 'info')
    }
  } catch (e) {
    showToast(e?.message || '操作失败', 'error')
  }
}

function addPolicy() {
  showToast('＋ 新增路由策略（P1）', 'info')
}

watch(
  () => api.models.value,
  (list) => {
    if (!useDemo.value && Array.isArray(list)) models.value = list.map((m) => ({ ...m }))
  },
)

watch(forceDemo, (v) => {
  if (v) applyDemoData()
})
</script>

<template>
  <div class="aim-page">
    <PageHeader
      title="AI 模型管理"
      subtitle="多模型 API 配置 · 密钥保管（Vault）· 价格与上下文 · 路由策略 · 用量计量"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="addModel">＋ 接入模型</button>
      <button type="button" class="btn btn-sm" @click="usageReport">📊 用量报表</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goChat">🤖 去对话</button>
    </PageHeader>

    <div v-if="gatewayHint || loadError" class="aim-banner tip">
      <span v-if="useDemo">演示模式</span>
      <span v-else>在线</span>
      <span v-if="gatewayHint"> · {{ gatewayHint }}</span>
      <span v-if="loadError"> · {{ loadError }}</span>
    </div>

    <CreateFormModal
      :open="createOpen"
      v-bind="AI_MODEL_FORM"
      @close="createOpen = false"
      @submit="onAddModel"
    />

    <CreateFormModal
      :open="editOpen"
      v-bind="AI_MODEL_EDIT_FORM"
      :initial-values="editInitial"
      @close="editOpen = false"
      @submit="onEditModel"
    />

    <div class="kpi-grid aim-kpi">
      <div v-for="(k, i) in kpiCards" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="{ up: k.trendUp }">{{ k.trend }}</div>
      </div>
    </div>

    <div class="card aim-models-card">
      <div class="card-header">
        <div class="card-title">🧠 已接入模型 <span class="tip">· 密钥统一存 Vault · 可维护价格与上下文</span></div>
        <span class="tag tag-green">{{ enabledCount }} 启用</span>
      </div>
      <div class="card-body">
        <div v-if="!models.length" class="aim-empty tip">暂无模型 · 点击「接入模型」或检查 /lh/ai/models</div>
        <div class="grid grid-3 aim-model-grid">
          <div
            v-for="m in paged"
            :key="m.id"
            class="model-card"
            :class="{ disabled: !m.enabled }"
          >
            <div class="mc-head">
              <div class="mc-logo" :style="{ background: m.bg }">{{ m.logo }}</div>
              <div style="flex: 1">
                <div class="mc-name">
                  {{ m.name }}
                  <span class="tag" :class="modelStatusTag(m).cls">{{ modelStatusTag(m).text }}</span>
                  <span
                    v-if="m.egressKind === 'local'"
                    class="tag tag-green"
                    title="内网/自建模型"
                  >内网</span>
                  <span
                    v-else-if="m.egressApproved"
                    class="tag tag-blue"
                    title="外发已安全岗标记"
                  >外发·已评</span>
                  <span
                    v-else
                    class="tag tag-orange"
                    title="外发未评估，不可进生产路由"
                  >外发·未评</span>
                </div>
                <div class="mc-vendor">{{ m.vendor }} · {{ m.role }}</div>
              </div>
            </div>
            <div class="mc-rows">
              <span class="mcr-k">Endpoint</span><span class="mcr-v">{{ m.endpoint }}</span>
              <span class="mcr-k">API Key</span><span class="mcr-v">{{ m.key }}</span>
              <span class="mcr-k">上下文</span><span class="mcr-v">{{ m.context }}</span>
              <span class="mcr-k">输入价格</span><span class="mcr-v">{{ m.input }}</span>
              <span class="mcr-k">输出价格</span><span class="mcr-v">{{ m.output }}</span>
            </div>
            <div class="mc-foot">
              <span class="mc-stats">📊 {{ m.calls }} 调用 · ⏱ {{ m.latency }} · 💰 {{ m.cost }}</span>
              <div class="flex gap-8">
                <button type="button" class="btn btn-sm" @click="editModel(m)">✎ 编辑</button>
                <button type="button" class="btn btn-sm" @click="testModel(m)">🔧 测试</button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="{ 'btn-primary': !m.enabled }"
                  @click="toggleModel(m)"
                >
                  {{ m.enabled ? '停用' : '启用' }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <ListPager
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="total"
          :total-pages="totalPages"
          :page-nums="pageNums"
          :page-count="paged.length"
          @go="goPage"
        />
      </div>
    </div>

    <div class="grid grid-2 aim-bottom">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔀 模型路由策略 <span class="tip">· 按场景/空间路由</span></div>
          <button type="button" class="btn btn-sm" @click="addPolicy">＋ 新增策略</button>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>场景</th>
                <th>空间</th>
                <th>主模型</th>
                <th>降级模型</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in routeRows" :key="i">
                <td>{{ r.scene }}</td>
                <td><code>{{ r.ws }}</code></td>
                <td><b>{{ r.primary }}</b></td>
                <td>{{ r.fallback }}</td>
                <td>
                  <span class="tag" :class="routeStatusTag(r.status).cls">{{ routeStatusTag(r.status).text }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 各模型用量 · 近 7 天 <span class="tip">· 按空间分摊成本</span></div>
        </div>
        <div class="card-body">
          <div v-for="(d, i) in usageBars" :key="i" class="call-bar-row">
            <div class="cbr-name">{{ d.name }}</div>
            <div class="cbr-bar">
              <div class="cbr-bar-fill" :style="{ width: `${d.pct}%` }" />
            </div>
            <div class="cbr-val">{{ formatUsageCalls(d.calls) }} · {{ d.cost }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aim-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 6px;
  background: var(--bg-muted, #f5f5f5);
}
.aim-empty {
  padding: 24px 8px;
  text-align: center;
}
.aim-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .aim-kpi {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 720px) {
  .aim-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}
.aim-models-card {
  margin-bottom: 16px;
}
.aim-model-grid {
  gap: 12px;
}
.model-card {
  border: 1px solid var(--border, #e8e8e8);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-card, #fff);
}
.model-card.disabled {
  opacity: 0.55;
}
.mc-head {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.mc-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.mc-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.mc-vendor {
  font-size: 12px;
  color: var(--text-secondary, #888);
  margin-top: 2px;
}
.mc-rows {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 4px 8px;
  font-size: 12px;
  margin-bottom: 10px;
}
.mcr-k {
  color: var(--text-secondary, #888);
}
.mcr-v {
  word-break: break-all;
}
.mc-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}
.mc-stats {
  font-size: 11px;
  color: var(--text-secondary, #888);
}
.aim-bottom {
  gap: 16px;
}
.call-bar-row {
  display: grid;
  grid-template-columns: 120px 1fr 100px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}
.cbr-bar {
  height: 8px;
  background: var(--bg-muted, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
}
.cbr-bar-fill {
  height: 100%;
  background: var(--primary, #1677ff);
  border-radius: 4px;
}
.cbr-val {
  text-align: right;
  color: var(--text-secondary, #888);
}
</style>
