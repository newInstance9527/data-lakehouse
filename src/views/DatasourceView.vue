<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSizeSelect from '@/components/common/PageSizeSelect.vue'
import SourceDrawer from '@/components/datasource/SourceDrawer.vue'
import RegisterSourceModal from '@/components/datasource/RegisterSourceModal.vue'
import DsTypeIcon from '@/components/datasource/DsTypeIcon.vue'
import { useToast } from '@/composables/useToast'
import { useDatasources } from '@/composables/useDatasources'
import { useSession, isNeedOwnerApplyError } from '@/composables/useSession'
import {
  DS_CAT_LABEL,
  DS_CAT_OPTIONS,
  dsCategory,
  endpointOf,
  groupTypesByCategory,
  statusMeta,
} from '@/data/datasources'
import { schemaSummary, tablesToSchema } from '@/utils/schemaList'
import { pageGuideOf } from '@/data/pageGuides'
import { fetchDatasourceDetail, fetchDatasourceKpi } from '@/api/datasource'
import { confirmDelete } from '@/composables/useConfirmDelete'
import { displayUser } from '@/utils/displayUser'

const dsGuide = pageGuideOf('datasource')

const router = useRouter()
const { showToast } = useToast()
const { canEditDatasource, canDeleteDatasource, canManageDatasource, refreshManageGrant } = useSession()
const {
  sources,
  getSource,
  upsertSource,
  loadSources,
  testSource,
  toggleStatus: apiToggle,
  batchSync: apiBatchSync,
  ensureTables,
  removeSource,
} = useDatasources()

function goApplyManageDs(s) {
  if (!s) return
  router.push({
    path: '/apply',
    query: {
      type: 'manage',
      resourceType: 'datasource',
      resourceId: s.id,
      name: s.name || '',
    },
  })
}

function assertEditOrGuide(s, action = '编辑') {
  if (canEditDatasource(s)) return true
  showToast(`无${action}权，请申请操作权限`, 'warning')
  return false
}

function assertDeleteOrGuide(s) {
  if (canDeleteDatasource(s)) return true
  showToast('无删除权，请申请操作权限', 'warning')
  return false
}

const filters = reactive({
  kw: '',
  type: '',
  status: '',
  cat: '',
})
const view = ref('card')
const page = ref(1)
const pageSize = ref(10)
const drawerOpen = ref(false)
const current = ref(null)
const regOpen = ref(false)
const editing = ref(null)
const kpiRemote = ref(null)

onMounted(async () => {
  try {
    await loadSources()
    await Promise.all(
      (sources.value || []).slice(0, 50).map((s) => refreshManageGrant('datasource', s.id, s)),
    )
    kpiRemote.value = await fetchDatasourceKpi()
  } catch (e) {
    showToast(`加载数据源失败：${e.message || e}`, 'error')
  }
})


const typeOptions = computed(() => {
  const map = {}
  sources.value.forEach((s) => {
    map[s.type] = (map[s.type] || 0) + 1
  })
  return Object.keys(map).map((t) => ({ value: t, count: map[t] }))
})

const typeGroups = computed(() => groupTypesByCategory(typeOptions.value))

const list = computed(() => {
  const kw = filters.kw.trim().toLowerCase()
  const filtered = sources.value.filter((s) => {
    if (filters.type && s.type !== filters.type) return false
    if (filters.status && s.status !== filters.status) return false
    if (filters.cat && dsCategory(s) !== filters.cat) return false
    if (!kw) return true
    return `${s.id} ${s.name} ${s.type} ${s.host} ${s.ownerName || ''} ${s.owner} ${s.database} ${s.desc || ''}`
      .toLowerCase()
      .includes(kw)
  })
  return filtered.slice().sort((a, b) => {
    const ta = Date.parse(a.createTime || a.create_time || '') || 0
    const tb = Date.parse(b.createTime || b.create_time || '') || 0
    if (tb !== ta) return tb - ta
    return String(b.id || '').localeCompare(String(a.id || ''))
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(list.value.length / pageSize.value)))

const pagedList = computed(() => {
  if (view.value === 'topology') return list.value
  const start = (page.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})

const pageNums = computed(() => {
  const total = totalPages.value
  const cur = page.value
  const nums = []
  const push = (n) => {
    if (!nums.includes(n) && n >= 1 && n <= total) nums.push(n)
  }
  push(1)
  for (let i = cur - 1; i <= cur + 1; i++) push(i)
  push(total)
  return nums.sort((a, b) => a - b)
})

watch([() => filters.kw, () => filters.type, () => filters.status, () => filters.cat, pageSize, view], () => {
  page.value = 1
})

watch(list, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})

const kpis = computed(() => {
  const all = sources.value
  const remote = kpiRemote.value
  const types = new Set(all.map((s) => s.type))
  return [
    { label: '数据源总数', value: remote?.total ?? all.length, sub: '已注册', icon: '📚', color: 'var(--primary)' },
    { label: '● 在线', value: remote?.online ?? all.filter((s) => s.status === 'online').length, sub: '正常可用', icon: '✅', color: 'var(--success)' },
    { label: '⚠ 告警', value: remote?.warn ?? all.filter((s) => s.status === 'warn').length, sub: '需处理', icon: '⚠', color: 'var(--warning)' },
    { label: '⏸ 停用', value: remote?.paused ?? all.filter((s) => s.status === 'paused').length, sub: '维护中', icon: '⏸', color: 'var(--text-3)' },
    { label: '覆盖类型', value: remote?.typeCount ?? types.size, sub: '种异构源', icon: '🧩', color: '#722ed1' },
  ]
})

const topoLayers = [
  { key: 'rdb', label: '① 关系型 / 云仓 JDBC' },
  { key: 'storage', label: '② 文件 / 对象 / Drive' },
  { key: 'mq', label: '③ 消息队列 / 流' },
  { key: 'nosql', label: '④ NoSQL' },
  { key: 'search', label: '⑤ 搜索引擎' },
  { key: 'api', label: '⑥ API / OpenAPI' },
  { key: 'dw', label: '⑦ 湖仓 / 查询引擎' },
  { key: 'dashboard', label: '⑧ BI / Dashboard（仅目录）' },
  { key: 'pipeline', label: '⑨ Pipeline / ML（仅目录）' },
]

const catColors = {
  rdb: '#08979c',
  dw: '#1890ff',
  mq: '#722ed1',
  nosql: '#52c41a',
  search: '#f5222d',
  storage: '#595959',
  api: '#722ed1',
  dashboard: '#389e0d',
  pipeline: '#13c2c2',
  outbound: '#fa541c',
}

function clearFilter() {
  filters.kw = ''
  filters.type = ''
  filters.status = ''
  filters.cat = ''
  page.value = 1
}

function openDetail(id) {
  const s = getSource(id)
  if (!s) return
  current.value = s
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}

async function test(id) {
  const s = getSource(id)
  try {
    const res = await testSource({ id, type: s?.type })
    if (res?.ok) showToast(`🧪 连通性测试 ${s?.name || id} · 成功（${res.costMs ?? '?'}ms）`, 'success')
    else showToast(`连通失败：${res?.error || '未知错误'}`, 'error')
    await onTested(id)
  } catch (e) {
    showToast(`连通失败：${e.message || e}`, 'error')
  }
}

async function onTested(id) {
  await loadSources()
  if (current.value?.id === id) current.value = getSource(id)
}

function openRegister() {
  editing.value = null
  regOpen.value = true
}

async function openEdit(id) {
  const s = getSource(id)
  if (!s) return
  if (!assertEditOrGuide(s, '编辑')) {
    goApplyManageDs(s)
    return
  }
  try {
    // 拉详情 + 表清单，保证编辑回显连接参数与 schema
    const [detail] = await Promise.all([
      fetchDatasourceDetail(id),
      ensureTables(id).catch(() => []),
    ])
    const local = getSource(id)
    editing.value = {
      ...(detail || s),
      ...(local || {}),
      conn: detail?.conn || local?.conn || s.conn,
      schema: detail?.schema || local?.schema || tablesToSchema(local?.tables) || s.schema || '',
      tables: local?.tables || s.tables,
    }
  } catch (e) {
    editing.value = { ...s }
    showToast(`加载详情失败，使用列表缓存：${e.message || e}`, 'warning')
  }
  drawerOpen.value = false
  regOpen.value = true
}

function openTables(id, e) {
  e?.stopPropagation?.()
  router.push(`/datasource/${id}/tables`)
}

async function toggleStatus(id) {
  const s = getSource(id)
  if (!s) return
  if (!assertEditOrGuide(s, '启停')) {
    goApplyManageDs(s)
    return
  }
  try {
    const res = await apiToggle(id)
    const next = res?.status || getSource(id)?.status
    if (next === 'paused') showToast(`⏸ 已停用 ${s.name}`, 'warning')
    else showToast(`▶ 已启用 ${s.name}`, 'success')
    if (current.value?.id === id) current.value = getSource(id)
    kpiRemote.value = await fetchDatasourceKpi()
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(e.message || '非拥有者不可启停', 'warning')
      goApplyManageDs(s)
    } else {
      showToast(`启停失败：${e.message || e}`, 'error')
    }
  }
}

async function onDeleteSource(id) {
  const s = getSource(id)
  if (!s) return
  if (!assertDeleteOrGuide(s)) {
    goApplyManageDs(s)
    return
  }
  const ok = await confirmDelete({
    title: `删除数据源「${s.name}」`,
    message: '将删除该数据源登记；关联资产不会级联删除，绑定会标为不可用。',
    confirmLabel: '确认删除',
  })
  if (!ok) return
  try {
    await removeSource(id)
    if (current.value?.id === id) {
      current.value = null
      drawerOpen.value = false
    }
    showToast(`已删除数据源 ${s.name}`, 'success')
    kpiRemote.value = await fetchDatasourceKpi().catch(() => kpiRemote.value)
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(e.message || '非拥有者不可删除', 'warning')
      goApplyManageDs(s)
    } else {
      showToast(`删除失败：${e.message || e}`, 'error')
    }
  }
}

async function onRegisterSubmit(payload) {
  const existed = !!getSource(payload.id)
  if (existed) {
    const s = getSource(payload.id)
    if (s && !assertEditOrGuide(s, '更新')) {
      goApplyManageDs(s)
      return
    }
  }
  try {
    const saved = await upsertSource(payload)
    // 新建时前端曾带临时 id，以服务端返回为准
    if (!existed && saved?.id) page.value = 1
    if (existed) showToast(`✅ 已更新数据源 ${payload.name}`, 'success')
    else showToast(`✅ 已注册 ${payload.name}（门户已保存；Grav/OM 按类型尽力同步）`, 'success')
    await loadSources()
    kpiRemote.value = await fetchDatasourceKpi()
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(e.message || '非拥有者不可保存', 'warning')
      if (s) goApplyManageDs(s)
    } else {
      showToast(`保存失败：${e.message || e}`, 'error')
    }
  }
}

async function batchSync() {
  const ids = list.value.map((s) => s.id)
  showToast(`🔄 批量同步 ${ids.length} 个数据源 Schema…`, 'info')
  try {
    const res = await apiBatchSync(ids)
    showToast(
      `✅ 同步完成：${res?.tableAdded ?? 0} 张表 · 约 ${res?.columnEstimate ?? 0} 列`,
      'success',
    )
    await loadSources()
  } catch (e) {
    if (isNeedOwnerApplyError(e)) {
      showToast(e.message || '无编辑权不可批量同步，请申请操作权限', 'warning')
    } else {
      showToast(`批量同步失败：${e.message || e}`, 'error')
    }
  }
}

function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
}
</script>

<template>
  <div>
    <PageHeader
      title="🔌 数据源管理中心"
      subtitle="多类型异构源注册 · 连通性管理 · Schema 同步 · 分类分级"
      :guide-title="dsGuide.title"
      :guide="dsGuide"
    >
      <button class="btn btn-sm" @click="batchSync">🔄 批量同步</button>
      <button class="btn btn-sm btn-primary" @click="openRegister">＋ 注册数据源</button>
    </PageHeader>

    <div class="ds-filters">
      <input
        v-model="filters.kw"
        class="input"
        style="width: 280px"
        placeholder="搜索名称 / 域名 / IP / 类型 / 负责人..."
      />
      <select v-model="filters.type" class="select">
        <option value="">全部类型（{{ typeOptions.length }}）</option>
        <optgroup v-for="g in typeGroups" :key="g.value" :label="g.label">
          <option v-for="t in g.types" :key="t.value" :value="t.value">
            {{ t.value }} · {{ t.count }}
          </option>
        </optgroup>
      </select>
      <select v-model="filters.status" class="select">
        <option value="">全部状态</option>
        <option value="online">● 在线</option>
        <option value="warn">⚠ 告警</option>
        <option value="paused">⏸ 停用</option>
      </select>
      <select v-model="filters.cat" class="select">
        <option value="">全部分类</option>
        <option v-for="c in DS_CAT_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <button class="btn btn-sm" @click="clearFilter">重置筛选</button>
    </div>

    <div class="kpi-grid ds-kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="kpi-card ds-kpi">
        <div class="ds-kpi-top">
          <span :style="{ color: k.color }">{{ k.icon }}</span>
          <span style="color: var(--text-3); font-size: 11px">{{ k.sub }}</span>
        </div>
        <div class="kpi-value" :style="{ color: k.color, fontSize: '22px' }">{{ k.value }}</div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">
          📚 全部数据源
          <span class="tag tag-blue">筛选 {{ list.length }} / 共 {{ sources.length }}</span>
        </div>
        <div class="std-tabs" style="margin: 0">
          <span class="std-tab" :class="{ active: view === 'card' }" @click="view = 'card'">卡片视图</span>
          <span class="std-tab" :class="{ active: view === 'list' }" @click="view = 'list'">列表视图</span>
          <span class="std-tab" :class="{ active: view === 'topology' }" @click="view = 'topology'">架构拓扑</span>
        </div>
      </div>
      <div class="card-body" style="min-height: 520px">
          <div v-if="view === 'card'">
            <div v-if="!list.length" class="ds-empty">无匹配数据源，请调整筛选条件</div>
            <div v-else class="ds-card-grid">
              <div
                v-for="s in pagedList"
                :key="s.id"
                class="ds-card"
                @click="openDetail(s.id)"
              >
                <div class="ds-card-bar" :style="{ background: catColors[dsCategory(s)] || '#ccc' }" />
                <div class="ds-card-head">
                  <div class="ds-card-icon" :style="{ background: s.bg, color: s.color }">
                    <DsTypeIcon :type="s.type" :type-code="s.typeCode" :size="20" />
                  </div>
                  <div style="flex: 1; min-width: 0">
                    <div class="ds-card-name" :title="s.name">{{ s.name }}</div>
                    <div class="ds-card-meta">
                      {{ s.id }} · {{ s.ver }}
                      <span class="tag tag-gray">{{ DS_CAT_LABEL[dsCategory(s)] }}</span>
                      <span class="tag tag-gray">{{ s.type }}</span>
                    </div>
                  </div>
                  <span class="tag" :class="statusMeta(s.status).tag">{{ statusMeta(s.status).label }}</span>
                </div>
                <div class="ds-card-endpoint" :title="endpointOf(s)">{{ endpointOf(s) }}</div>
                <div class="ds-card-schema">
                  <button
                    class="btn-link btn-sm ds-schema-link"
                    :title="schemaSummary(s.schema).text"
                    @click="openTables(s.id, $event)"
                  >
                    📋 {{ schemaSummary(s.schema).text }}
                  </button>
                  <span style="margin-left: auto; color: var(--text-3)" :title="s.owner">👤 {{ displayUser(s.ownerName, s.owner) }}</span>
                </div>
                <div class="ds-card-actions" @click.stop>
                  <button class="btn-link btn-sm" @click="openTables(s.id)">表清单</button>
                  <button class="btn-link btn-sm" @click="test(s.id)">🧪 测试</button>
                  <button
                    v-if="canEditDatasource(s)"
                    class="btn-link btn-sm"
                    @click="openEdit(s.id)"
                  >✎ 编辑</button>
                  <button
                    v-else-if="!canDeleteDatasource(s)"
                    class="btn-link btn-sm"
                    @click="goApplyManageDs(s)"
                  >🔐 申请操作权限</button>
                  <button
                    v-if="canEditDatasource(s)"
                    class="btn-link btn-sm"
                    :style="{ color: s.status === 'online' ? 'var(--warning)' : 'var(--success)' }"
                    @click="toggleStatus(s.id)"
                  >
                    {{ s.status === 'online' ? '⏸ 停用' : '▶ 启用' }}
                  </button>
                  <button
                    v-if="canDeleteDatasource(s)"
                    class="btn-link btn-sm"
                    style="color: var(--danger)"
                    @click="onDeleteSource(s.id)"
                  >删除</button>
                  <button
                    v-else-if="canEditDatasource(s)"
                    class="btn-link btn-sm"
                    @click="goApplyManageDs(s)"
                  >🔐 申请删除权</button>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="view === 'list'">
            <div v-if="!list.length" class="ds-empty">无匹配数据源</div>
            <div v-else style="overflow: auto">
              <table class="std-table" style="font-size: 12px">
                <thead>
                  <tr>
                    <th style="width: 24%">数据源</th>
                    <th>连接</th>
                    <th style="width: 9%">状态</th>
                    <th style="width: 14%">延迟</th>
                    <th style="width: 10%">负责人</th>
                    <th style="width: 14%">版本/创建</th>
                    <th style="width: 12%">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in pagedList" :key="s.id" style="cursor: pointer" @click="openDetail(s.id)">
                    <td>
                      <span style="display: inline-flex; align-items: center; gap: 5px">
                        <span class="ds-mini-icon" :style="{ background: s.bg, color: s.color }">
                          <DsTypeIcon :type="s.type" :type-code="s.typeCode" :size="12" />
                        </span>
                        {{ s.name }}
                        <span class="tag tag-gray">{{ s.type }}</span>
                      </span>
                    </td>
                    <td style="font-family: monospace; font-size: 11px; color: var(--text-2)">{{ endpointOf(s) }}</td>
                    <td><span class="tag" :class="statusMeta(s.status).tag">{{ statusMeta(s.status).short }}</span></td>
                    <td>{{ s.lag || '-' }}</td>
                    <td>{{ displayUser(s.ownerName, s.owner) || '-' }}</td>
                    <td style="font-size: 11px; color: var(--text-3)">{{ s.ver }} · {{ s.created }}</td>
                    <td @click.stop style="white-space: nowrap">
                      <button class="btn-link btn-sm" @click="openTables(s.id)">表</button>
                      <button class="btn-link btn-sm" @click="test(s.id)">🧪</button>
                      <button
                        v-if="canEditDatasource(s)"
                        class="btn-link btn-sm"
                        @click="openEdit(s.id)"
                      >✎</button>
                      <button
                        v-else-if="!canDeleteDatasource(s)"
                        class="btn-link btn-sm"
                        @click="goApplyManageDs(s)"
                      >🔐</button>
                      <button
                        v-if="canEditDatasource(s)"
                        class="btn-link btn-sm"
                        :style="{ color: s.status === 'online' ? 'var(--warning)' : 'var(--success)' }"
                        @click="toggleStatus(s.id)"
                      >
                        {{ s.status === 'online' ? '⏸' : '▶' }}
                      </button>
                      <button
                        v-if="canDeleteDatasource(s)"
                        class="btn-link btn-sm"
                        style="color: var(--danger)"
                        @click="onDeleteSource(s.id)"
                      >删</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-else class="ds-topo">
            <div style="font-size: 11px; color: var(--text-3); margin-bottom: 10px">
              登记类型对齐 OpenMetadata 连接器分类 · 数据入湖 ≠ 仅采元数据 · 点击查看详情
            </div>
            <div v-for="L in topoLayers" :key="L.key" style="margin-bottom: 10px">
              <div style="font-weight: 600; font-size: 12px; color: var(--text-2); margin-bottom: 4px">{{ L.label }}</div>
              <template v-if="list.filter((s) => dsCategory(s) === L.key).length">
                <div
                  v-for="s in list.filter((x) => dsCategory(x) === L.key)"
                  :key="s.id"
                  class="ds-topo-chip"
                  :style="{ background: s.bg || '#fff' }"
                  @click="openDetail(s.id)"
                >
                  <span :style="{ color: s.color || 'var(--text-2)', display: 'inline-flex' }">
                    <DsTypeIcon :type="s.type" :type-code="s.typeCode" :size="14" />
                  </span>
                  <b>{{ s.name.split('-')[0] }}</b>
                  <span style="color: var(--text-3)">{{ s.type }}</span>
                </div>
              </template>
              <span v-else style="color: var(--text-3); font-size: 11px">无该类别</span>
            </div>
          </div>

          <div v-if="view !== 'topology' && list.length" class="ds-pager">
            <div class="ds-pager-info">
              第 {{ page }} / {{ totalPages }} 页 · 本页 {{ pagedList.length }} 条 · 共 {{ list.length }} 条
            </div>
            <div class="ds-pager-controls">
              <PageSizeSelect v-model="pageSize" />
              <button class="btn btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
              <template v-for="(n, i) in pageNums" :key="n">
                <span v-if="i > 0 && n - pageNums[i - 1] > 1" class="ds-pager-ellipsis">…</span>
                <button
                  class="btn btn-sm"
                  :class="{ 'btn-primary': n === page }"
                  @click="goPage(n)"
                >{{ n }}</button>
              </template>
              <button class="btn btn-sm" :disabled="page >= totalPages" @click="goPage(page + 1)">下一页</button>
            </div>
          </div>
        </div>
      </div>

    <SourceDrawer
      :open="drawerOpen"
      :source="current"
      @close="closeDrawer"
      @toggle-status="toggleStatus"
      @edit="openEdit"
      @open-tables="openTables"
      @tested="onTested"
      @delete="onDeleteSource"
      @apply-manage="(id) => goApplyManageDs(getSource(id) || current)"
    />

    <RegisterSourceModal
      :open="regOpen"
      :edit-source="editing"
      @close="regOpen = false"
      @submit="onRegisterSubmit"
    />
  </div>
</template>
