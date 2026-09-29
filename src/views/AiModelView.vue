<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useAiModels } from '@/composables/useAiModels'
import { useActionLock } from '@/composables/useActionLock'
import { AI_MODEL_EDIT_FORM, AI_MODEL_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  formatUsageCalls,
  modelKindLabel,
  modelStatusTag,
  routeStatusTag,
} from '@/data/ai'

const router = useRouter()
const { showToast } = useToast()
const { busy, run: runLocked } = useActionLock()
const guide = pageGuideOf('aimodel')
const api = useAiModels()

const createOpen = ref(false)
const editOpen = ref(false)
const editingId = ref('')
const detailOpen = ref(false)
const detailModel = ref(null)
const detailLoading = ref(false)
const loadError = ref('')
const models = ref([])
const routeRows = ref([])
const usageBars = ref([])
const kpiCards = ref([
  { icon: '🧠', color: 'blue', value: '—', unit: '个', label: '已接入模型', trend: '加载中', trendUp: true },
  { icon: '✅', color: 'green', value: '—', unit: '', label: '连通性', trend: '', trendUp: true },
  { icon: '💬', color: 'purple', value: '—', unit: '', label: '本月调用', trend: '按空间分摊', trendUp: true },
  { icon: '💰', color: 'orange', value: '—', unit: '', label: '本月成本', trend: '按空间分摊', trendUp: true },
  { icon: '⚡', color: 'red', value: '—', unit: 's', label: '平均响应', trend: '本月均值', trendUp: true },
])
const gatewayHint = ref('')

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(models)
const enabledCount = computed(() => models.value.filter((m) => m.enabled).length)

function applyApiPayload() {
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
  try {
    await api.loadAll()
    applyApiPayload()
  } catch (e) {
    loadError.value = e?.message || '加载失败'
    models.value = []
    routeRows.value = []
    usageBars.value = []
    gatewayHint.value = ''
    showToast(loadError.value, 'warning')
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
      trend: lat !== '—' ? '本月均值' : '暂无样本',
      trendUp: true,
    },
  ]
}

const editInitial = computed(() => {
  const m = models.value.find((x) => x.id === editingId.value)
  if (!m) return null
  return {
    vendor: m.vendor,
    // 上游 model id（测试/调用用），不是展示名
    model: m.modelName || m.name,
    baseURL: m.endpoint,
    key: '',
    context: m.context || '128K',
    priceUnit: m.priceUnit || (m.input === '免费' ? 'free' : 'usd_1m'),
    inputRate: m.inputRate ?? 0,
    outputRate: m.outputRate ?? 0,
    tokenQuota: m.tokenQuota != null && Number(m.tokenQuota) > 0 ? m.tokenQuota : 0,
    costQuota: m.costQuota != null && Number(m.costQuota) > 0 ? m.costQuota : 0,
    use: m.role || '',
    kind: m.kind || 'chat',
    supportsVision: m.supportsVision ? '1' : '0',
    supportsImageOutput: m.supportsImageOutput || m.kind === 'image' ? '1' : '0',
    egressApproved: m.egressApproved || m.egressKind === 'local' ? '1' : '0',
  }
})

function egressLabel(m) {
  if (!m) return '—'
  if (m.egressKind === 'local') return '内网 / 本地'
  return m.egressApproved ? '外发 · 已评估' : '外发 · 未评估'
}

function capabilityLabel(m) {
  if (!m) return '—'
  const base = modelKindLabel(m.kind)
  if (m.kind === 'chat' && m.supportsVision) return `${base} · 视觉输入`
  if (m.kind === 'image' && m.supportsImageOutput) return `${base} · 生图`
  return base
}

function addModel() {
  createOpen.value = true
}

async function onAddModel(payload) {
  try {
    const n = await api.addModel(payload)
    models.value.unshift(n)
    if (n?.litellmSyncMessage) {
      showToast(`✅ 模型已接入：${payload.model} · ${n.litellmSyncMessage}`, n.litellmSyncOk ? 'success' : 'info')
    } else {
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
    const saved = await api.editModel(editingId.value, payload)
    const idx = models.value.findIndex((x) => x.id === editingId.value)
    if (idx >= 0) {
      models.value[idx] = { ...models.value[idx], ...saved }
    }
    editOpen.value = false
    editingId.value = ''
    showToast(
      String(payload.key || '').trim()
        ? `✅ 已更新模型与 Key：${payload.model}`
        : `✅ 已更新：${payload.model}`,
      'success',
    )
    // 重新拉列表，避免本地缓存与 Vault/model_name 不一致
    try {
      await api.loadAll()
      applyApiPayload()
    } catch {
      /* ignore */
    }
  } catch (e) {
    showToast(e?.message || '更新失败', 'error')
  }
}

async function openDetail(m) {
  if (!m?.id) {
    showToast('模型尚未持久化，无法查看详情', 'warning')
    return
  }
  detailModel.value = { ...m }
  detailOpen.value = true
  detailLoading.value = true
  try {
    const d = await api.getDetail(m.id)
    detailModel.value = d
  } catch (e) {
    showToast(e?.message || '加载详情失败', 'error')
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  detailOpen.value = false
  detailModel.value = null
  detailLoading.value = false
}

async function removeModel(m) {
  if (!m?.id) {
    showToast('模型尚未持久化，无法删除', 'warning')
    return
  }
  if (!window.confirm(`确认删除模型「${m.name || m.id}」？删除后列表不再展示。`)) return
  try {
    await api.removeModel(m.id)
    models.value = models.value.filter((x) => x.id !== m.id)
    if (detailModel.value?.id === m.id) closeDetail()
    showToast(`已删除：${m.name || m.id}`, 'success')
    resetPage()
  } catch (e) {
    showToast(e?.message || '删除失败', 'error')
  }
}

function usageReport() {
  showToast('📊 工作空间用量报表导出中 · CSV', 'success')
}

function goChat() {
  router.push('/aiassistant')
}

async function testModel(m) {
  if (!m?.id) {
    showToast('模型尚未持久化，无法测试', 'warning')
    return
  }
  const key = `test:${m.id}`
  await runLocked(key, async () => {
    try {
      const r = await api.test(m.id)
      if (r?.latencyMs != null) m.latency = `${(r.latencyMs / 1000).toFixed(1)}s`
      if (r?.status) m.status = r.status
      const detail = r?.message || r?.status || ''
      if (r?.ok === true) {
        showToast(`测试成功 · ${m.name}${detail ? ` · ${detail}` : ''} · ${r?.latencyMs ?? '—'}ms`, 'success')
      } else {
        showToast(`测试失败 · ${m.name}${detail ? ` · ${detail}` : ''}`, 'error')
      }
    } catch (e) {
      showToast(e?.message || '测试失败', 'error')
    }
  })
}

async function toggleModel(m) {
  if (!m?.id) return
  const key = `toggle:${m.id}`
  await runLocked(key, async () => {
    try {
      const saved = await api.toggle(m.id, !m.enabled)
      Object.assign(m, saved)
      const syncBit = saved?.litellmSyncMessage ? ` · ${saved.litellmSyncMessage}` : ''
      showToast(`${m.enabled ? '启用' : '停用'}模型 · ${m.name}${syncBit}`, 'info')
    } catch (e) {
      showToast(e?.message || '操作失败', 'error')
    }
  })
}

function addPolicy() {
  showToast('＋ 新增路由策略（P1）', 'info')
}

watch(
  () => api.models.value,
  (list) => {
    if (Array.isArray(list)) models.value = list.map((m) => ({ ...m }))
  },
)
</script>

<template>
  <div class="aim-page">
    <PageHeader
      page-id="aimodel"
      title="AI 模型管理"
      subtitle="多模型 API 配置 · 密钥保管（Vault）· 价格与上下文 · 路由策略 · 用量计量"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="addModel">＋ 接入模型</button>
      <button type="button" class="btn btn-sm" @click="usageReport">📊 用量报表</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goChat">🤖 去对话</button>
    </PageHeader>

    <div v-if="gatewayHint || loadError" class="aim-banner tip">
      <span v-if="loadError">{{ loadError }}</span>
      <span v-if="loadError && gatewayHint"> · </span>
      <span v-if="gatewayHint">{{ gatewayHint }}</span>
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

    <AppDrawer
      :open="detailOpen"
      storage-key="aimodel-drawer"
      :default-width="520"
      @close="closeDetail"
    >
      <div v-if="detailModel" class="aim-drawer">
        <div class="aim-drawer-hd">
          <div>
            <div class="aim-drawer-title">
              {{ detailModel.name }}
              <span class="tag" :class="modelStatusTag(detailModel).cls">{{ modelStatusTag(detailModel).text }}</span>
            </div>
            <div class="aim-drawer-sub tip">
              {{ detailModel.vendor }} · {{ capabilityLabel(detailModel) }}
              <span v-if="detailLoading"> · 刷新中…</span>
            </div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeDetail">关闭</button>
        </div>

        <div class="aim-kv">
          <div class="aim-kv-row"><span>ID</span><div><code>{{ detailModel.id }}</code></div></div>
          <div class="aim-kv-row"><span>名称</span><div>{{ detailModel.name || '—' }}</div></div>
          <div class="aim-kv-row"><span>厂商</span><div>{{ detailModel.vendor || '—' }}</div></div>
          <div class="aim-kv-row"><span>功能类别</span><div>{{ modelKindLabel(detailModel.kind) }}</div></div>
          <div class="aim-kv-row"><span>视觉输入</span><div>{{ detailModel.supportsVision ? '支持上传图片' : '否' }}</div></div>
          <div class="aim-kv-row"><span>图片输出</span><div>{{ detailModel.supportsImageOutput ? '是' : '否' }}</div></div>
          <div class="aim-kv-row"><span>Model ID</span><div><code>{{ detailModel.modelName || '—' }}</code></div></div>
          <div class="aim-kv-row"><span>Base URL</span><div class="break">{{ detailModel.endpoint || '—' }}</div></div>
          <div class="aim-kv-row"><span>启用</span><div>{{ detailModel.enabled ? '是' : '否' }}</div></div>
          <div class="aim-kv-row"><span>外发</span><div>{{ egressLabel(detailModel) }}</div></div>
          <div class="aim-kv-row"><span>备注</span><div>{{ detailModel.role || '—' }}</div></div>
          <div class="aim-kv-row"><span>状态</span><div>{{ detailModel.status || '—' }}</div></div>
          <div class="aim-kv-row"><span>延迟</span><div>{{ detailModel.latency || '—' }}</div></div>
          <div class="aim-kv-row"><span>API Key</span><div>{{ detailModel.key || '（Vault）' }}</div></div>
          <div class="aim-kv-row"><span>上下文</span><div>{{ detailModel.context || '—' }}</div></div>
          <div class="aim-kv-row"><span>输入价</span><div>{{ detailModel.input || '—' }}</div></div>
          <div class="aim-kv-row"><span>输出价</span><div>{{ detailModel.output || '—' }}</div></div>
          <div class="aim-kv-row">
            <span>Token 总限额</span>
            <div>
              已用 {{ detailModel.tokenUsed ?? 0 }}
              / 上限 {{ detailModel.tokenQuota != null ? detailModel.tokenQuota : '不限' }}
              <template v-if="detailModel.tokenQuota != null">
                · 剩余 {{ detailModel.tokenRemaining ?? '—' }}
              </template>
            </div>
          </div>
          <div class="aim-kv-row">
            <span>成本总限额</span>
            <div>
              已用 {{ detailModel.costUsed ?? 0 }}
              / 上限 {{ detailModel.costQuota != null ? detailModel.costQuota : '不限' }}
              <template v-if="detailModel.costQuota != null">
                · 剩余 {{ detailModel.costRemaining ?? '—' }}
              </template>
            </div>
          </div>
          <div v-if="detailModel.vaultPath" class="aim-kv-row">
            <span>Vault</span>
            <div><code>{{ detailModel.vaultPath }}</code></div>
          </div>
          <div v-if="detailModel.litellmAlias" class="aim-kv-row">
            <span>LiteLLM</span>
            <div><code>{{ detailModel.litellmAlias }}</code></div>
          </div>
        </div>

        <div class="aim-drawer-acts">
          <button type="button" class="btn btn-sm" :disabled="detailLoading" @click="openDetail(detailModel)">
            {{ detailLoading ? '刷新中…' : '刷新用量' }}
          </button>
          <button type="button" class="btn btn-sm" @click="editModel(detailModel); closeDetail()">✎ 编辑</button>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="busy(`test:${detailModel.id}`)"
            @click="testModel(detailModel)"
          >
            {{ busy(`test:${detailModel.id}`) ? '测试中…' : '🔧 测试' }}
          </button>
          <button type="button" class="btn btn-sm btn-danger" @click="removeModel(detailModel)">删除</button>
        </div>
      </div>
    </AppDrawer>

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
        <div v-if="!models.length" class="aim-empty tip">暂无模型 · 点击「接入模型」或刷新列表</div>
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
                  <button type="button" class="btn-link mc-name-link" @click="openDetail(m)">{{ m.name }}</button>
                  <span class="tag" :class="modelStatusTag(m).cls">{{ modelStatusTag(m).text }}</span>
                  <span class="tag tag-cyan" :title="capabilityLabel(m)">{{ modelKindLabel(m.kind) }}</span>
                  <span
                    v-if="m.supportsVision"
                    class="tag tag-purple"
                    title="对话模型支持图片上传 / 视觉输入"
                  >视觉</span>
                  <span
                    v-else-if="m.kind === 'image' && m.supportsImageOutput"
                    class="tag tag-purple"
                    title="图片生成"
                  >生图</span>
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
              <div class="flex gap-8 mc-acts">
                <button type="button" class="btn btn-sm" @click="openDetail(m)">详情</button>
                <button type="button" class="btn btn-sm" @click="editModel(m)">✎ 编辑</button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :disabled="busy(`test:${m.id}`)"
                  @click="testModel(m)"
                >
                  {{ busy(`test:${m.id}`) ? '测试中…' : '🔧 测试' }}
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="{ 'btn-primary': !m.enabled }"
                  :disabled="busy(`toggle:${m.id}`)"
                  @click="toggleModel(m)"
                >
                  {{ busy(`toggle:${m.id}`) ? '…' : m.enabled ? '停用' : '启用' }}
                </button>
                <button type="button" class="btn btn-sm btn-danger" @click="removeModel(m)">删除</button>
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
.btn-link {
  color: var(--primary, #1677ff);
  font: inherit;
  font-size: 12px;
  background: none;
  border: none;
  padding: 0;
}
.btn-link:hover {
  text-decoration: underline;
}
.mc-name-link {
  font-weight: 600;
  font-size: inherit;
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
.mc-acts {
  flex-wrap: wrap;
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
.aim-drawer {
  padding: 16px 20px 24px;
  height: 100%;
  overflow: auto;
}
.aim-drawer-hd {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.aim-drawer-title {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.aim-drawer-sub {
  margin-top: 4px;
  font-size: 12px;
}
.aim-kv {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}
.aim-kv-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 8px;
  align-items: start;
}
.aim-kv-row > span {
  color: var(--text-secondary, #888);
}
.aim-kv-row .break {
  word-break: break-all;
}
.aim-drawer-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid var(--border, #e8e8e8);
}
.btn-danger {
  color: #cf1322;
  border-color: #ffa39e;
}
.btn-danger:hover {
  background: #fff1f0;
}
</style>
