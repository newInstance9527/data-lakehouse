<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import KnowledgeCreateDrawer from '@/components/knowledge/KnowledgeCreateDrawer.vue'
import KnowledgeDetailDrawer from '@/components/knowledge/KnowledgeDetailDrawer.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useKnowledge } from '@/composables/useKnowledge'
import { pageGuideOf } from '@/data/pageGuides'
import { KB_CATS } from '@/data/knowledge'

const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const guide = pageGuideOf('knowledge')
const api = useKnowledge()

const activeCat = ref('all')
const search = ref('')
const createOpen = ref(false)
const createSaving = ref(false)
const editEntry = ref(null)
const detailOpen = ref(false)
const detailEntryId = ref('')
const detailRef = ref(null)
const loadError = ref('')
const items = ref([])
const kpiCards = ref([
  { icon: '📖', color: 'blue', value: '—', unit: '', label: '知识条目', trend: '加载中' },
  { icon: '🏷️', color: 'purple', value: '—', unit: '', label: '业务术语', trend: '' },
  { icon: '📘', color: 'green', value: '—', unit: '', label: '平台手册', trend: '' },
  { icon: '❓', color: 'orange', value: '—', unit: '', label: 'FAQ', trend: '' },
  { icon: '🔗', color: 'red', value: '—', unit: '', label: 'AI 引用次数', trend: '' },
])

const cats = computed(() => {
  const counts = { all: items.value.length }
  items.value.forEach((k) => {
    counts[k.cat] = (counts[k.cat] || 0) + 1
  })
  return KB_CATS.map((c) => ({ ...c, count: counts[c.id] ?? 0 }))
})

const filteredItems = computed(() => {
  const f = search.value.trim().toLowerCase()
  return items.value.filter((k) => {
    const catOk = activeCat.value === 'all' || k.cat === activeCat.value
    const textOk =
      !f ||
      k.title.toLowerCase().includes(f) ||
      (k.desc || '').toLowerCase().includes(f)
    return catOk && textOk
  })
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredItems)

watch([activeCat, search], () => resetPage())

function applyOverview(ov) {
  if (!ov) {
    kpiCards.value = [
      { icon: '📖', color: 'blue', value: String(items.value.length), unit: '篇', label: '知识条目', trend: items.value.length ? '' : '暂无' },
      { icon: '🏷️', color: 'purple', value: '—', unit: '', label: '业务术语', trend: '暂无' },
      { icon: '📘', color: 'green', value: '—', unit: '', label: '平台手册', trend: '暂无' },
      { icon: '❓', color: 'orange', value: '—', unit: '', label: 'FAQ', trend: '暂无' },
      { icon: '🔗', color: 'red', value: '—', unit: '', label: 'AI 引用次数', trend: '暂无' },
    ]
    return
  }
  kpiCards.value = [
    { icon: '📖', color: 'blue', value: String(ov.total ?? items.value.length), unit: '篇', label: '知识条目', trend: '', trendUp: true },
    { icon: '🏷️', color: 'purple', value: String(ov.termCount ?? 0), unit: '条', label: '业务术语', trend: '', trendUp: true },
    { icon: '📘', color: 'green', value: String(ov.manualCount ?? 0), unit: '部', label: '平台手册', trend: '', trendUp: true },
    { icon: '❓', color: 'orange', value: String(ov.faqCount ?? 0), unit: '条', label: 'FAQ', trend: '', trendUp: true },
    { icon: '🔗', color: 'red', value: String(ov.citeTotal ?? ov.citeCnt ?? 0), unit: '', label: 'AI 引用次数', trend: '累计', trendUp: true },
  ]
}

function syncItemsFromApi() {
  items.value = (api.items.value || []).map((k) => ({ ...k }))
}

async function reloadList() {
  await api.loadAll({})
  syncItemsFromApi()
  applyOverview(api.overview.value)
  resetPage()
}

function setEntryQuery(id) {
  const q = { ...route.query }
  if (id) q.entry = id
  else delete q.entry
  delete q.scope
  router.replace({ query: q })
}

function openDetail(id) {
  if (!id) return
  detailEntryId.value = String(id)
  detailOpen.value = true
  setEntryQuery(id)
}

function closeDetail() {
  detailOpen.value = false
  detailEntryId.value = ''
  if (route.query.entry) setEntryQuery(null)
}

function openFromQuery() {
  const id = typeof route.query.entry === 'string' ? route.query.entry.trim() : ''
  if (!id) return
  detailEntryId.value = id
  detailOpen.value = true
}

onMounted(async () => {
  try {
    await reloadList()
    loadError.value = ''
  } catch (e) {
    items.value = []
    applyOverview(null)
    loadError.value = e?.message || '知识库加载失败'
    showToast(loadError.value, 'warning')
  }
  openFromQuery()
})

watch(
  () => route.query.entry,
  (id) => {
    if (typeof id === 'string' && id.trim()) {
      if (detailEntryId.value !== id || !detailOpen.value) {
        detailEntryId.value = id.trim()
        detailOpen.value = true
      }
    } else if (detailOpen.value && !createOpen.value) {
      detailOpen.value = false
      detailEntryId.value = ''
    }
  },
)

function setCat(id) {
  activeCat.value = id
}

function newEntry() {
  editEntry.value = null
  createOpen.value = true
}

function closeCreate() {
  const reopenId = editEntry.value?.id ? detailEntryId.value || editEntry.value.id : ''
  createOpen.value = false
  editEntry.value = null
  if (reopenId) {
    detailEntryId.value = String(reopenId)
    detailOpen.value = true
  }
}

async function onCreateEntry(payload) {
  createSaving.value = true
  try {
    const isEdit = !!payload.id
    const n = await api.saveEntry({ ...payload })
    syncItemsFromApi()
    createOpen.value = false
    editEntry.value = null
    resetPage()
    applyOverview(api.overview.value)
    const chunks = n?.chunks ?? n?.chunkCount
    const chunkHint = chunks != null && chunks !== '' ? ` · ${chunks} 分片` : ''
    const modeHint = n?.indexMode ? ` · ${n.indexMode === 'hybrid' ? '混合索引' : '关键词索引'}` : ''
    showToast(
      (isEdit ? `已更新：${payload.title}` : `已入库：${payload.title}`) + chunkHint + modeHint,
      'success',
    )
    if (n?.id) {
      openDetail(n.id)
      await nextTick()
      detailRef.value?.reload?.()
    }
  } catch (e) {
    showToast(e?.message || (payload.id ? '保存失败' : '入库失败'), 'error')
  } finally {
    createSaving.value = false
  }
}

function goAi() {
  router.push('/aiassistant')
}

function openItem(item) {
  if (!item?.id) {
    showToast(item?.title || '无条目 ID', 'info')
    return
  }
  openDetail(item.id)
}

function onEditFromDetail(entry) {
  if (!entry?.id) {
    showToast('无法编辑：条目未加载完整', 'warning')
    return
  }
  detailOpen.value = false
  editEntry.value = entry
  createOpen.value = true
}

async function onDeleted(id) {
  try {
    await api.removeEntry(id)
    syncItemsFromApi()
    applyOverview(api.overview.value)
    closeDetail()
    resetPage()
    showToast('已删除', 'success')
  } catch (e) {
    showToast(e?.message || '删除失败', 'error')
  }
}

async function onDetailUpdated() {
  try {
    await reloadList()
  } catch {
    /* keep local list */
  }
}

function goLink(to, e) {
  e?.stopPropagation()
  if (to) router.push(to)
}
</script>

<template>
  <div class="kb-page">
    <PageHeader
      title="知识库"
      subtitle="全局知识条目 · 向量检索 · AI 助手引用源"
      :guide="guide"
    >
      <input
        v-model="search"
        class="input input-sm kb-search"
        placeholder="🔍 搜索知识库…"
      />
      <button type="button" class="btn btn-sm" @click="newEntry">＋ 新建条目</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goAi">🤖 去 AI 问答</button>
    </PageHeader>

    <p v-if="loadError" class="tip kb-banner">{{ loadError }}</p>

    <KnowledgeDetailDrawer
      ref="detailRef"
      :open="detailOpen"
      :entry-id="detailEntryId"
      :can-write="true"
      @close="closeDetail"
      @edit="onEditFromDetail"
      @deleted="onDeleted"
      @updated="onDetailUpdated"
    />

    <KnowledgeCreateDrawer
      :open="createOpen"
      :entry="editEntry"
      :saving="createSaving"
      @close="closeCreate"
      @submit="onCreateEntry"
    />

    <div class="kpi-grid kb-kpi">
      <div v-for="(k, i) in kpiCards" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend up">{{ k.trend }}</div>
      </div>
    </div>

    <div class="card kb-main-card">
      <div class="card-header">
        <div class="card-title">📚 知识分类</div>
        <div class="flex gap-8 kb-tabs">
          <span
            v-for="c in cats"
            :key="c.id"
            class="ai-quick-btn kb-tab"
            :class="{ active: activeCat === c.id }"
            @click="setCat(c.id)"
          >{{ c.name }} ({{ c.count }})</span>
        </div>
      </div>
      <div class="card-body">
        <div v-if="!paged.length" class="kb-empty">暂无知识条目</div>
        <div v-else class="grid grid-3 kb-grid">
          <div
            v-for="(k, i) in paged"
            :key="k.id || `${k.title}-${i}`"
            class="kb-card"
            @click="openItem(k)"
          >
            <div class="kb-title">{{ k.icon }} {{ k.title }}</div>
            <div class="kb-desc">{{ k.desc }}</div>
            <div class="kb-meta"><span>{{ k.meta }}</span></div>
            <button
              v-if="k.to"
              type="button"
              class="kb-link btn-link"
              @click="goLink(k.to, $event)"
            >
              ↗ {{ k.link }}
            </button>
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
  </div>
</template>

<style scoped>
.kb-search { width: 180px; }
.kb-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .kb-kpi { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .kb-kpi { grid-template-columns: repeat(2, 1fr); }
}
.tip { font-size: 12px; color: var(--text-3); }
.kb-banner { margin: -4px 0 12px; }
.kb-main-card { margin-top: 16px; }
.kb-tabs { flex-wrap: wrap; }
.kb-tab {
  font-size: 11px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-2);
  color: var(--text-2);
  cursor: pointer;
}
.kb-tab:hover,
.kb-tab.active {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}
.kb-grid { gap: 12px; }
.kb-empty {
  color: var(--text-3);
  padding: 20px;
  text-align: center;
}
.kb-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--bg-1);
  cursor: pointer;
}
.kb-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.kb-title { font-size: 13px; font-weight: 600; }
.kb-desc {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.kb-meta {
  font-size: 10px;
  color: var(--text-4);
  margin-top: 8px;
}
.kb-link {
  color: var(--primary);
  font-size: 11px;
  margin-top: 6px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
}
</style>
