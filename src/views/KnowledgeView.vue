<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import KnowledgeCreateDrawer from '@/components/knowledge/KnowledgeCreateDrawer.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { pageGuideOf } from '@/data/pageGuides'
import {
  KB_CATS,
  KB_CHUNK_STRATEGIES,
  KB_ITEMS,
  KB_KPIS,
  KB_PLATFORM_CHAIN,
  resolveKbCat,
} from '@/data/knowledge'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('knowledge')

const activeCat = ref('all')
const search = ref('')
const createOpen = ref(false)
const items = ref(KB_ITEMS.map((k) => ({ ...k })))

const cats = computed(() => {
  const counts = { all: items.value.length }
  items.value.forEach((k) => {
    counts[k.cat] = (counts[k.cat] || 0) + 1
  })
  return KB_CATS.map((c) => ({ ...c, count: counts[c.id] ?? c.count }))
})

const filteredItems = computed(() => {
  const f = search.value.trim().toLowerCase()
  return items.value.filter((k) => {
    const catOk = activeCat.value === 'all' || k.cat === activeCat.value
    const textOk =
      !f ||
      k.title.toLowerCase().includes(f) ||
      k.desc.toLowerCase().includes(f)
    return catOk && textOk
  })
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredItems)

watch([activeCat, search], () => resetPage())

function setCat(id) {
  activeCat.value = id
}

function newEntry() {
  createOpen.value = true
}

function strategyLabel(value) {
  return KB_CHUNK_STRATEGIES.find((s) => s.value === value)?.label || value
}

function onCreateEntry(payload) {
  const resolved = resolveKbCat(payload.cat)
  const chunks = payload.chunks || 1
  const sourceBit =
    payload.source === 'upload'
      ? `文档 ${payload.fileName}`
      : '手动录入'
  const relBit = payload.rel ? ` · 关联 ${payload.rel}` : ''
  items.value.unshift({
    cat: resolved.cat,
    icon: resolved.icon || '📖',
    title: payload.title,
    desc: payload.body,
    source: payload.source,
    chunks,
    embedModel: payload.embedModel,
    meta: `${sourceBit} · ${chunks} 分片 · ${strategyLabel(payload.strategy)} · 已向量化（演示）${relBit}`,
    link: '',
    to: '',
  })
  createOpen.value = false
  resetPage()
  showToast(
    `✅ 已入库：${payload.title} · ${chunks} 分片 · ${payload.embedModel}（演示）`,
    'success',
  )
}

function goAi() {
  router.push('/aiassistant')
}

function openItem(item) {
  showToast(`📖 ${item.title}`, 'info')
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
      subtitle="业务术语 · 数据字典 · 最佳实践 · FAQ · 平台手册 · 向量检索 · AI 助手引用源"
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

    <KnowledgeCreateDrawer
      :open="createOpen"
      @close="createOpen = false"
      @submit="onCreateEntry"
    />

    <div class="kpi-grid kb-kpi">
      <div v-for="(k, i) in KB_KPIS" :key="i" class="kpi-card" :class="k.color">
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
        <div v-if="!paged.length" class="kb-empty">无匹配条目</div>
        <div v-else class="grid grid-3 kb-grid">
          <div
            v-for="(k, i) in paged"
            :key="`${k.title}-${i}`"
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

    <div class="card kb-chain-card">
      <div class="card-header">
        <div class="card-title">🔗 知识库 × 平台串联 <span class="tip">· AI 助手回答时自动引用</span></div>
      </div>
      <div class="card-body kb-chain-body">
        <div class="kb-chain-row">
          <span class="tag tag-blue">{{ KB_PLATFORM_CHAIN.tags[0] }}</span>
          <span>→</span>
          <template v-for="(step, si) in KB_PLATFORM_CHAIN.steps" :key="si">
            <button type="button" class="btn-link" @click="router.push(step.to)">{{ step.label }}</button>
            <span v-if="si < KB_PLATFORM_CHAIN.steps.length - 1">→</span>
          </template>
        </div>
        <div class="kb-chain-note">{{ KB_PLATFORM_CHAIN.note }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kb-search {
  width: 180px;
}

.kb-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .kb-kpi {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 700px) {
  .kb-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.kb-main-card {
  margin-top: 16px;
}

.kb-tabs {
  flex-wrap: wrap;
}

.kb-tab {
  font-size: 11px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-2);
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.15s;
}
.kb-tab:hover,
.kb-tab.active {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}

.kb-grid {
  gap: 12px;
}

.kb-empty {
  color: var(--text-3);
  padding: 20px;
  text-align: center;
  grid-column: 1 / -1;
}

.kb-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--bg-1);
  cursor: pointer;
  transition: all 0.15s;
}
.kb-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.kb-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.kb-desc {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
  line-height: 1.5;
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

.kb-chain-card {
  margin-top: 16px;
  border-color: var(--primary);
}
.kb-chain-body {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.9;
}
.kb-chain-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.kb-chain-note {
  margin-top: 8px;
  color: var(--text-3);
}
</style>
