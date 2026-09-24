<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useWsListScope } from '@/composables/useWsListScope'
import { SCHEMA_REG_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  CONTRACT_CDC_FLOW,
  CONTRACT_CDC_SEMANTICS,
  ICEBERG_EVOLUTION_RULES,
  contractCompatClass,
  contractSchemaStatusMeta,
  icebergAllowMeta,
} from '@/data/contract'
import {
  fetchContractOverview,
  fetchContractSchemas,
  registerContractSchema,
  fetchSchemaVersions,
  fetchContractChanges,
  createContractChange,
  putCdcConfig,
} from '@/api/contract'

const router = useRouter()
const { showToast } = useToast()
const { currentWs, showAll, listWsParams, watchListScope } = useWsListScope()
const guide = pageGuideOf('contract')

const createOpen = ref(false)
const loading = ref(false)
const schemas = ref([])
const versions = ref([])
const changes = ref([])
const overview = ref(null)
const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(schemas)

const kpis = computed(() => {
  const o = overview.value || {}
  const dash = (v) => (v == null ? '—' : String(v))
  return [
    { icon: '📜', color: 'blue', value: dash(o.schemaCount), unit: '', label: '注册 Schema', trend: '门户 SoT' },
    { icon: '✅', color: 'green', value: dash(o.compatOk), unit: '', label: '兼容通过', trend: 'status=ok' },
    { icon: '⚠️', color: 'orange', value: dash(o.breaking), unit: '', label: '破坏性变更', trend: '变更单' },
    { icon: '🔄', color: 'purple', value: dash(o.cdcConfigCount), unit: '', label: 'CDC 配置', trend: 'topic 数' },
    { icon: '🚫', color: 'red', value: dash(o.blocked), unit: '', label: '阻断中', trend: 'blocked' },
  ]
})

async function loadBoard() {
  loading.value = true
  try {
    const base = listWsParams()
    const [ov, list, ch] = await Promise.all([
      fetchContractOverview(base),
      fetchContractSchemas(base),
      fetchContractChanges(base),
    ])
    overview.value = ov || {}
    schemas.value = Array.isArray(list?.records) ? list.records : []
    changes.value = Array.isArray(ch?.records) ? ch.records : []
    resetPage()
    if (schemas.value[0]?.name) {
      versions.value = (await fetchSchemaVersions(schemas.value[0].name, base)) || []
    } else {
      versions.value = []
    }
  } catch (e) {
    showToast(e?.message || '契约加载失败', 'warning')
    overview.value = null
    schemas.value = []
    changes.value = []
    versions.value = []
  } finally {
    loading.value = false
  }
}

function registerSchema() {
  createOpen.value = true
}

async function onRegisterSchema(payload) {
  try {
    await registerContractSchema({
      ws: currentWs.value,
      topic: payload.topic,
      name: payload.topic,
      compat: payload.compat,
      fields: payload.fields,
    })
    createOpen.value = false
    showToast(`已注册 Schema ${payload.topic}`, 'success')
    await loadBoard()
  } catch (e) {
    showToast(e?.message || '注册失败', 'warning')
  }
}

async function openChangeTicket() {
  const name = schemas.value[0]?.name
  if (!name) {
    showToast('请先注册 Schema', 'warning')
    return
  }
  try {
    await createContractChange({
      ws: currentWs.value,
      schemaName: name,
      title: `变更 · ${name}`,
      changeSummary: '门户发起变更单',
    })
    showToast('已创建变更单（draft）', 'success')
    await loadBoard()
  } catch (e) {
    showToast(e?.message || '创建变更单失败', 'warning')
  }
}

function goLineage() {
  router.push('/lineage')
}

function goCatalog(name) {
  router.push({ path: '/catalog', query: { q: name } })
}

async function loadVersions(name) {
  try {
    versions.value = (await fetchSchemaVersions(name, listWsParams())) || []
  } catch (e) {
    showToast(e?.message || '版本加载失败', 'warning')
  }
}

async function newCdcConfig() {
  const topic = window.prompt('CDC Topic', schemas.value[0]?.name || 'cdc.sample')
  if (!topic) return
  try {
    await putCdcConfig(topic, { config: undefined }, { ws: currentWs.value })
    showToast(`已保存 CDC 配置 ${topic}`, 'success')
    await loadBoard()
  } catch (e) {
    showToast(e?.message || 'CDC 配置失败', 'warning')
  }
}

onMounted(loadBoard)
watchListScope(() => loadBoard())
</script>

<template>
  <div class="ctr-page">
    <PageHeader
      title="数据契约"
      subtitle="门户 Schema SoT · 兼容性 · CDC · Iceberg 演进"
      :guide="guide"
    >
      <label class="ws-mine-chk" title="默认跟随顶栏当前空间；勾选后查看全部归属">
        <input v-model="showAll" type="checkbox" />
        查看全部
      </label>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="loadBoard">
        {{ loading ? '刷新中…' : '↻ 刷新' }}
      </button>
      <button type="button" class="btn btn-sm" @click="registerSchema">＋ 注册 Schema</button>
      <button type="button" class="btn btn-sm" @click="openChangeTicket">📋 变更单</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goLineage">🔗 血缘影响</button>
    </PageHeader>

    <CreateFormModal
      :open="createOpen"
      v-bind="SCHEMA_REG_FORM"
      @close="createOpen = false"
      @submit="onRegisterSchema"
    />

    <p class="tip ctr-banner">列表/KPI 接 `/lh/contract/*`；下方 Iceberg/CDC 约定为流程规则，非业务假数。</p>

    <div class="kpi-grid ctr-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend">{{ k.trend }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 Schema Registry</div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>Schema</th>
              <th>类型</th>
              <th>当前版本</th>
              <th>兼容性</th>
              <th>字段数</th>
              <th>最近变更</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!paged.length">
              <td colspan="7" style="text-align: center; color: var(--text-3); padding: 24px">暂无 Schema</td>
            </tr>
            <tr v-for="(s, si) in paged" :key="`${s.name}-${si}`">
              <td>
                <button type="button" class="btn-link" @click="goCatalog(s.name); loadVersions(s.name)">
                  <code>{{ s.name }}</code>
                </button>
              </td>
              <td><span class="tag tag-blue" style="font-size: 10px">{{ s.type }}</span></td>
              <td><b>{{ s.version }}</b></td>
              <td>
                <span class="compat-badge" :class="contractCompatClass(s.compat)">{{ s.compat }}</span>
              </td>
              <td style="text-align: center">{{ s.fields }}</td>
              <td style="font-size: 11px; color: var(--text-3)">{{ s.change }}</td>
              <td>
                <span class="tag" :class="contractSchemaStatusMeta(s.status).tag" style="font-size: 10px">
                  {{ contractSchemaStatusMeta(s.status).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
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

    <div class="grid grid-2 ctr-grid-top">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔄 Schema 版本演进</div>
        </div>
        <div class="card-body">
          <div v-if="!versions.length" class="tip">暂无版本历史</div>
          <ul v-else class="ctr-ver-list">
            <li v-for="v in versions" :key="v.id">
              <b>{{ v.version }}</b>
              <span>{{ v.diffSummary || '—' }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🗑️ CDC 删除传播链路（约定）</div>
          <button type="button" class="btn btn-sm" @click="newCdcConfig">配置</button>
        </div>
        <div class="card-body">
          <div class="flow-chain ctr-flow">
            <template v-for="(node, ni) in CONTRACT_CDC_FLOW" :key="ni">
              <div v-if="ni > 0" class="flow-arrow">→</div>
              <div class="flow-node">
                <div class="fn-icon">{{ node.icon }}</div>
                <div class="fn-title">{{ node.title }}</div>
                <div class="fn-sub">{{ node.sub }}</div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 变更单</div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>标题</th>
              <th>Schema</th>
              <th>状态</th>
              <th>兼容结果</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!changes.length">
              <td colspan="4" style="text-align: center; color: var(--text-3); padding: 24px">暂无变更单</td>
            </tr>
            <tr v-for="c in changes" :key="c.id">
              <td>{{ c.title || '—' }}</td>
              <td><code>{{ c.schemaName }}</code></td>
              <td>{{ c.status }}</td>
              <td>{{ c.compatResult || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🧊 Iceberg 演进约定</div>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>变更</th>
                <th>允许</th>
                <th>动作</th>
                <th>CK</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in ICEBERG_EVOLUTION_RULES" :key="ri">
                <td>{{ r.change }}</td>
                <td>
                  <span class="tag" :class="icebergAllowMeta(r.allow).tag" style="font-size: 10px">
                    {{ icebergAllowMeta(r.allow).label }}
                  </span>
                </td>
                <td style="font-size: 12px">{{ r.action }}</td>
                <td style="font-size: 11px; color: var(--text-3)">{{ r.ck }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">📡 CDC 语义约定</div>
        </div>
        <div class="card-body">
          <div v-for="(s, si) in CONTRACT_CDC_SEMANTICS" :key="si" class="ctr-qa">
            <div class="ctr-q">{{ s.q }}</div>
            <div class="ctr-a">{{ s.a }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ctr-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1100px) {
  .ctr-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}
.tip {
  font-size: 12px;
  color: var(--text-3);
}
.ctr-banner {
  margin: -4px 0 12px;
}
.ctr-page .card {
  margin-top: 16px;
}
.ctr-grid-top {
  margin-top: 0;
}
.ctr-ver-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ctr-ver-list li {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.flow-chain {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.flow-arrow {
  color: var(--text-3);
}
.flow-node {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  min-width: 88px;
  background: var(--bg-2);
}
.fn-icon {
  font-size: 16px;
}
.fn-title {
  font-weight: 600;
  font-size: 12px;
}
.fn-sub {
  font-size: 11px;
  color: var(--text-3);
}
.compat-badge {
  font-size: 11px;
  font-weight: 600;
}
.compat-badge.backward {
  color: var(--success);
}
.compat-badge.forward {
  color: var(--primary);
}
.compat-badge.full {
  color: var(--success);
}
.compat-badge.breaking {
  color: var(--danger);
}
.ctr-qa {
  margin-bottom: 10px;
}
.ctr-q {
  font-weight: 600;
  font-size: 12px;
}
.ctr-a {
  font-size: 12px;
  color: var(--text-2);
}
</style>
