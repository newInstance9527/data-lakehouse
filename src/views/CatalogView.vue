<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import AssetDrawer from '@/components/catalog/AssetDrawer.vue'
import RegisterAssetModal from '@/components/catalog/RegisterAssetModal.vue'
import { useAssets } from '@/composables/useAssets'
import { useDatasources } from '@/composables/useDatasources'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const catalogGuide = pageGuideOf('catalog')
const { sources, updateSource } = useDatasources()
const { assets, findAsset, addAsset } = useAssets()

const search = ref(String(route.query.q || ''))
const domain = ref('')
const sourceFilter = ref(String(route.query.source || route.query.sourceId || ''))
const drawerOpen = ref(false)
const current = ref(null)
const regOpen = ref(false)

const sourceOptions = computed(() => {
  const map = new Map()
  sources.value.forEach((s) => {
    if (!map.has(s.name)) {
      map.set(s.name, { id: s.id, name: s.name, type: s.type, asset: s.asset })
    }
  })
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
})

const activeSources = computed(() => {
  const f = sourceFilter.value.trim()
  if (!f) return []
  return sources.value.filter((s) => s.name === f || s.id === f)
})

const assetSourceNames = computed(() => {
  const map = {}
  sources.value.forEach((s) => {
    if (!s.asset) return
    if (!map[s.asset]) map[s.asset] = []
    if (!map[s.asset].includes(s.name)) map[s.asset].push(s.name)
  })
  assets.value.forEach((a) => {
    if (!a.sourceName) return
    if (!map[a.id]) map[a.id] = []
    if (!map[a.id].includes(a.sourceName)) map[a.id].push(a.sourceName)
  })
  return map
})

function syncFromRoute() {
  if (route.query.q != null) search.value = String(route.query.q)
  if (route.query.source != null) {
    sourceFilter.value = String(route.query.source)
  } else if (route.query.sourceId != null) {
    const s = sources.value.find((x) => x.id === String(route.query.sourceId))
    sourceFilter.value = s?.name || String(route.query.sourceId)
  }
  if (route.query.asset) {
    openAsset(String(route.query.asset), false)
  }
}

watch(
  () => [route.query.q, route.query.source, route.query.sourceId, route.query.asset],
  () => syncFromRoute(),
  { immediate: true },
)

watch(sourceFilter, (v) => {
  const curName = String(route.query.source || '')
  if ((v || '') === curName) return
  const next = { ...route.query }
  if (v) {
    next.source = v
    const s = sources.value.find((x) => x.name === v)
    if (s) next.sourceId = s.id
    else delete next.sourceId
  } else {
    delete next.source
    delete next.sourceId
  }
  router.replace({ path: '/catalog', query: next })
})

const list = computed(() => {
  const f = search.value.trim().toLowerCase()
  const linkedIds = new Set(activeSources.value.map((s) => s.asset).filter(Boolean))
  const filteringBySource = !!sourceFilter.value.trim()
  const activeIds = new Set(activeSources.value.map((s) => s.id))
  const activeNames = new Set(activeSources.value.map((s) => s.name))

  return assets.value.filter((a) => {
    if (domain.value && a.domain !== domain.value) return false
    if (filteringBySource) {
      const byLink = linkedIds.has(a.id)
      const byMeta =
        (a.sourceId && activeIds.has(a.sourceId)) ||
        (a.sourceName && activeNames.has(a.sourceName))
      if (!byLink && !byMeta) return false
    }
    if (!f) return true
    const srcNames = (assetSourceNames.value[a.id] || []).join(' ')
    return (
      a.key.toLowerCase().includes(f) ||
      a.desc.toLowerCase().includes(f) ||
      a.owner.toLowerCase().includes(f) ||
      a.id.toLowerCase().includes(f) ||
      srcNames.toLowerCase().includes(f) ||
      String(a.tableName || '')
        .toLowerCase()
        .includes(f)
    )
  })
})

function openAsset(id, toast = true) {
  const asset = findAsset(id)
  if (!asset) {
    if (toast) showToast(`未找到资产：${id}`, 'error')
    return
  }
  current.value = asset
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  if (route.query.asset) {
    const next = { ...route.query }
    delete next.asset
    router.replace({ path: '/catalog', query: next })
  }
}

function clearSourceFilter() {
  sourceFilter.value = ''
}

function openRegister() {
  regOpen.value = true
}

function onRegisterSubmit(payload) {
  const row = addAsset(payload)
  if (payload.sourceId) {
    updateSource(payload.sourceId, { asset: row.id })
  }
  showToast(`✅ 已注册资产 ${row.key} · 数据源 ${payload.sourceName}`, 'success')
  if (payload.sourceName) sourceFilter.value = payload.sourceName
  openAsset(row.id, false)
}

function exportCsv() {
  showToast('📤 资产清单导出（演示）', 'success')
}

function sourceLabel(assetId) {
  const names = assetSourceNames.value[assetId]
  if (!names?.length) return ''
  return names.length === 1 ? names[0] : `${names[0]} 等${names.length}个源`
}
</script>

<template>
  <div>
    <PageHeader
      title="数据资产目录"
      :guide-title="catalogGuide.title"
      :guide="catalogGuide"
    >
      <button class="btn btn-sm" @click="exportCsv">📤 资产导出</button>
      <button class="btn btn-sm btn-primary" @click="openRegister">+ 注册新资产</button>
    </PageHeader>

    <div class="grid" style="grid-template-columns: 220px 1fr; gap: 16px">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🎛 筛选器</div>
        </div>
        <div class="card-body" style="padding: 12px">
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-2)">数据源</div>
          <select v-model="sourceFilter" class="select" style="width: 100%; margin-bottom: 8px; font-size: 12px">
            <option value="">全部数据源</option>
            <option v-for="s in sourceOptions" :key="s.id" :value="s.name">
              {{ s.name }}
            </option>
          </select>
          <button
            v-if="sourceFilter"
            class="btn-link btn-sm"
            style="margin-bottom: 14px"
            @click="clearSourceFilter"
          >清除数据源筛选</button>

          <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-2)">数据分层</div>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; margin-bottom: 16px">
            <label><input type="checkbox" checked /> ODS 原始层</label>
            <label><input type="checkbox" checked /> DWD 明细层</label>
            <label><input type="checkbox" checked /> DIM 维度</label>
            <label><input type="checkbox" checked /> DWS 汇总层</label>
            <label><input type="checkbox" checked /> ADS 应用层</label>
          </div>
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-2)">业务域</div>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-2)">
            <label>🔄 交易域</label>
            <label>👤 用户域</label>
            <label>📦 商品域</label>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="catalog-toolbar">
          <div class="catalog-search">
            <span class="search-icon">🔍</span>
            <input v-model="search" type="text" placeholder="搜索资产名称 / 描述 / owner / 数据源…" />
          </div>
          <select v-model="domain" class="select input-sm">
            <option value="">全部域</option>
            <option value="trade">交易域</option>
            <option value="user">用户域</option>
            <option value="product">商品域</option>
            <option value="marketing">营销域</option>
            <option value="finance">财务域</option>
          </select>
          <select v-model="sourceFilter" class="select input-sm" style="max-width: 200px">
            <option value="">全部数据源</option>
            <option v-for="s in sourceOptions" :key="'tb-' + s.id" :value="s.name">
              {{ s.name }}
            </option>
          </select>
          <div style="margin-left: auto; font-size: 12px; color: var(--text-3)">
            <template v-if="sourceFilter">
              数据源 <b>{{ sourceFilter }}</b> ·
            </template>
            展示 <b>{{ list.length }}</b> 张
          </div>
        </div>

        <div v-if="sourceFilter && !list.length" class="ds-empty" style="padding: 48px">
          数据源「{{ sourceFilter }}」暂无关联资产
          <div style="margin-top: 12px">
            <button class="btn btn-sm btn-primary" @click="openRegister">＋ 注册新资产</button>
          </div>
        </div>

        <div v-else class="asset-grid">
          <div
            v-for="a in list"
            :key="a.id"
            class="asset-card"
            role="button"
            tabindex="0"
            @click="openAsset(a.id)"
            @keydown.enter="openAsset(a.id)"
          >
            <div class="asset-header">
              <div class="asset-name">
                <span class="asset-layer" :class="`layer-${a.layer}`">{{ a.layerLabel }}</span>
                {{ a.key }}
              </div>
              <div class="quality-score" :class="a.qualityClass">{{ a.quality }}</div>
            </div>
            <div class="asset-desc">{{ a.desc }}</div>
            <div v-if="sourceLabel(a.id)" class="asset-source">
              🔌 {{ sourceLabel(a.id) }}
            </div>
            <div class="asset-tags">
              <span class="tag" :class="a.levelClass">{{ a.level }}</span>
              <span v-if="a.isGold" class="tag tag-green">⭐ 黄金</span>
              <span
                v-for="(t, i) in (a.tags || []).slice(0, 3)"
                :key="i"
                class="tag"
                :class="t[1] || 'tag-gray'"
              >{{ t[0] }}</span>
            </div>
            <div class="asset-footer">
              <div class="asset-owner">
                <span class="owner-avatar">{{ a.ownerAvatar }}</span>
                {{ a.owner }} · {{ (a.bizOwner || '').split('(')[0] }}
              </div>
              <div class="asset-metrics">
                <span class="m">📄 {{ a.cols }}列</span>
                <span class="m">📈 {{ a.metrics?.read7d }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AssetDrawer :open="drawerOpen" :asset="current" @close="closeDrawer" />
    <RegisterAssetModal
      :open="regOpen"
      :preset-source-id="activeSources[0]?.id || ''"
      :preset-source-name="sourceFilter"
      @close="regOpen = false"
      @submit="onRegisterSubmit"
    />
  </div>
</template>
