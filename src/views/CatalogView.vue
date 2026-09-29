<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import AssetDrawer from '@/components/catalog/AssetDrawer.vue'
import RegisterAssetModal from '@/components/catalog/RegisterAssetModal.vue'
import { useAssets } from '@/composables/useAssets'
import { useDatasources } from '@/composables/useDatasources'
import { useToast } from '@/composables/useToast'
import { useSession } from '@/composables/useSession'
import { ASSET_LAYERS } from '@/data/assetMeta'
import { useDomains } from '@/composables/useDomains'
import DsTypeIcon from '@/components/datasource/DsTypeIcon.vue'
import { dsTypeMeta } from '@/data/dsForm'
import { inferDsTypeCode } from '@/data/dsTypeIcons'
import { pageGuideOf } from '@/data/pageGuides'
import { bareDisplayUser } from '@/utils/displayUser'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const catalogGuide = pageGuideOf('catalog')
const { sources, loadSources, updateSource } = useDatasources()
const { assets, loading, loadAssets, loadDetail, addAsset, findAsset } = useAssets()
const { currentWs } = useSession()
const { domainOptions, ensureDomains } = useDomains()

const search = ref(String(route.query.q || ''))
const domain = ref('')
const layerFilter = ref('')
const sourceFilter = ref(String(route.query.source || route.query.sourceId || ''))
const drawerOpen = ref(false)
const current = ref(null)
const regOpen = ref(false)
const registering = ref(false)

/** 兼容深链 id → asset */
function resolveAssetQuery() {
  return route.query.asset || route.query.id || null
}

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

const selectedDsId = computed(() => {
  const s = activeSources.value[0]
  return s?.id || ''
})

const list = computed(() => assets.value)

async function reload() {
  const filters = {
    q: search.value.trim() || undefined,
    domain: domain.value || undefined,
    layer: layerFilter.value || undefined,
    dsId: selectedDsId.value || undefined,
    source: !selectedDsId.value && sourceFilter.value ? sourceFilter.value : undefined,
    scope: 'workspace',
    ws: currentWs.value || 'default',
  }
  try {
    await loadAssets(filters)
  } catch (e) {
    showToast(`加载资产失败：${e.message || e}`, 'error')
  }
}

function syncFromRoute() {
  if (route.query.q != null) search.value = String(route.query.q)
  if (route.query.source != null) {
    sourceFilter.value = String(route.query.source)
  } else if (route.query.sourceId != null) {
    const s = sources.value.find((x) => x.id === String(route.query.sourceId))
    sourceFilter.value = s?.name || String(route.query.sourceId)
  }
  const assetQ = resolveAssetQuery()
  if (assetQ) {
    openAsset(String(assetQ), false)
  }
}

watch(
  () => [route.query.q, route.query.source, route.query.sourceId, route.query.asset, route.query.id],
  () => syncFromRoute(),
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

let searchTimer
watch([search, domain, layerFilter, sourceFilter], () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => reload(), 280)
})

watch(currentWs, () => reload())

onMounted(async () => {
  try {
    await Promise.all([loadSources(), ensureDomains().catch(() => {})])
  } catch (e) {
    showToast(`加载数据源失败：${e.message || e}`, 'error')
  }
  syncFromRoute()
  await reload()
  const assetQ = resolveAssetQuery()
  if (assetQ) {
    await openAsset(String(assetQ), false)
  }
})

async function openAsset(id, toast = true) {
  let asset = findAsset(id)
  try {
    asset = (await loadDetail(id)) || asset
  } catch (e) {
    if (!asset) {
      if (toast) showToast(`未找到资产：${id}`, 'error')
      return
    }
  }
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

function onAssetDeleted() {
  current.value = null
  closeDrawer()
}

function clearSourceFilter() {
  sourceFilter.value = ''
}

function openRegister() {
  regOpen.value = true
}

async function onRegisterSubmit(payload) {
  registering.value = true
  try {
    const row = await addAsset({
      sourceId: payload.sourceId,
      tableName: payload.tableName,
      layer: payload.layer,
      domain: payload.domain,
      assetCode: payload.key || payload.id,
      name: payload.name,
      cnName: payload.cnName,
      desc: payload.desc,
      owner: payload.owner,
      bizOwner: payload.bizOwner,
      level: payload.level,
      engine: payload.engine,
      ws: currentWs.value || 'default',
    })
    if (payload.sourceId && row?.id) {
      const src = sources.value.find((s) => s.id === payload.sourceId)
      const linked = Array.isArray(src?.linkedAssets) ? [...src.linkedAssets] : []
      const objectName = payload.tableName || row.tableName || row.objectName || ''
      if (objectName && !linked.some((a) => String(a.objectName || '') === String(objectName))) {
        linked.push({
          assetId: row.id,
          assetCode: row.key || row.assetCode,
          name: row.name,
          objectName,
          linkRole: 'primary',
        })
      }
      updateSource(payload.sourceId, { asset: row.id, linkedAssets: linked })
    }
    showToast(`已注册资产 ${row.key} · ${payload.sourceName || ''}`, 'success')
    if (payload.sourceName) sourceFilter.value = payload.sourceName
    await reload()
    await openAsset(row.id, false)
  } catch (e) {
    showToast(`注册失败：${e.message || e}`, 'error')
  } finally {
    registering.value = false
  }
}

function exportCsv() {
  const rows = list.value
  if (!rows.length) {
    showToast('无可导出资产', 'warning')
    return
  }
  const header = ['id', 'assetCode', 'name', 'layer', 'domain', 'owner', 'source', 'objectName', 'omFqn']
  const lines = [header.join(',')]
  rows.forEach((a) => {
    lines.push(
      [
        a.id,
        a.key,
        a.name,
        a.layer,
        a.domain,
        a.ownerName || a.owner,
        a.sourceName || '',
        a.tableName || '',
        a.omFqn || '',
      ]
        .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
  })
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `catalog-assets-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
  showToast(`已导出 ${rows.length} 条`, 'success')
}

function sourceLabel(asset) {
  if (asset?.sourceName) return asset.sourceName
  if (asset?.sourceSummary) return asset.sourceSummary
  return ''
}

function resolveSource(asset) {
  if (!asset) return null
  if (asset.sourceId) {
    const byId = sources.value.find((s) => s.id === asset.sourceId)
    if (byId) return byId
  }
  const name = asset.sourceName || ''
  if (name) {
    return sources.value.find((s) => s.name === name || s.id === name) || null
  }
  return null
}

/** 与数据源管理卡片一致的类型视觉（bg / color / label；图标由 DsTypeIcon 按类型解析） */
function sourceTypeVisual(asset) {
  const src = resolveSource(asset)
  const label = src?.type || asset?.sourceType || ''
  const meta = dsTypeMeta(label)
  const typeCode = src?.typeCode || asset?.sourceTypeCode || inferDsTypeCode(label)
  return {
    bg: src?.bg || meta.bg || '#e8f0ff',
    color: src?.color || meta.color || '#1e6fff',
    label,
    typeCode,
  }
}

function sourceTypeLabel(asset) {
  return sourceTypeVisual(asset).label || ''
}

/** 左下角认责：技术 Owner；业务 Owner 仅在不同时追加 */
function ownerLine(asset) {
  const tech = bareDisplayUser(asset?.ownerName || asset?.techOwnerName, asset?.owner || asset?.techOwner)
  const biz = bareDisplayUser(asset?.bizOwnerName, asset?.bizOwner)
  if (tech && biz && tech !== biz) return `${tech} · ${biz}`
  return tech || biz || '—'
}

function ownerTitle(asset) {
  const tech = bareDisplayUser(asset?.ownerName || asset?.techOwnerName, asset?.owner || asset?.techOwner)
  const biz = bareDisplayUser(asset?.bizOwnerName, asset?.bizOwner)
  if (tech && biz && tech !== biz) return `技术 ${tech} · 业务 ${biz}`
  if (tech) return `Owner ${tech}`
  if (biz) return `业务 Owner ${biz}`
  return '未指定 Owner'
}

function onAssetUpdated(row) {
  if (row?.id) current.value = row
}
</script>

<template>
  <div>
    <PageHeader
      page-id="catalog"
      title="数据资产目录"
      :guide-title="catalogGuide.title"
      :guide="catalogGuide"
    >
      <button class="btn btn-sm" @click="exportCsv">📤 资产导出</button>
      <button class="btn btn-sm btn-primary" :disabled="registering" @click="openRegister">
        + 注册新资产
      </button>
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
              {{ s.type ? `${s.type} · ${s.name}` : s.name }}
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
            <label>
              <input v-model="layerFilter" type="radio" value="" /> 全部
            </label>
            <label v-for="l in ASSET_LAYERS" :key="l.value">
              <input v-model="layerFilter" type="radio" :value="l.value" /> {{ l.full }}
            </label>
          </div>
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-2)">业务域</div>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-2)">
            <label>
              <input v-model="domain" type="radio" value="" /> 全部域
            </label>
            <label v-for="d in domainOptions" :key="d.value">
              <input v-model="domain" type="radio" :value="d.value" /> {{ d.label }}
            </label>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="catalog-toolbar">
          <div class="catalog-search">
            <span class="search-icon">🔍</span>
            <input v-model="search" type="text" placeholder="搜索资产编码 / 描述 / owner / 数据源…" />
          </div>
          <select v-model="domain" class="select input-sm">
            <option value="">全部域</option>
            <option v-for="d in domainOptions" :key="'tb-' + d.value" :value="d.value">
              {{ d.label }}
            </option>
          </select>
          <select v-model="sourceFilter" class="select input-sm" style="max-width: 200px">
            <option value="">全部数据源</option>
            <option v-for="s in sourceOptions" :key="'tb-' + s.id" :value="s.name">
              {{ s.type ? `${s.type} · ${s.name}` : s.name }}
            </option>
          </select>
          <div style="margin-left: auto; font-size: 12px; color: var(--text-3)">
            <template v-if="loading">加载中… · </template>
            <template v-if="sourceFilter">
              数据源 <b>{{ sourceFilter }}</b> ·
            </template>
            展示 <b>{{ list.length }}</b> 项
          </div>
        </div>

        <div v-if="!loading && sourceFilter && !list.length" class="ds-empty" style="padding: 48px">
          数据源「{{ sourceFilter }}」暂无关联资产
          <div style="margin-top: 12px">
            <button class="btn btn-sm btn-primary" @click="openRegister">＋ 注册新资产</button>
          </div>
        </div>

        <div v-else-if="!loading && !list.length" class="ds-empty" style="padding: 48px">
          本空间暂无资产，请先同步数据源表清单后注册
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
              <div class="asset-ds-badge" :style="{ background: sourceTypeVisual(a).bg, color: sourceTypeVisual(a).color }" :title="sourceTypeLabel(a) || '数据源类型'">
                <DsTypeIcon :type="sourceTypeVisual(a).label" :type-code="sourceTypeVisual(a).typeCode" :size="20" />
              </div>
              <div class="asset-header-main">
                <div class="asset-name">
                  <span class="asset-layer" :class="`layer-${a.layer}`">{{ a.layerLabel }}</span>
                  <span class="asset-name-text" :title="a.key">{{ a.key }}</span>
                </div>
                <div class="asset-origin">
                  <span v-if="sourceLabel(a)" class="asset-source-name" :title="sourceLabel(a)">
                    {{ sourceLabel(a) }}
                  </span>
                  <span v-if="a.tableName || a.objectName" class="asset-object-name" :title="a.tableName || a.objectName">
                    {{ a.tableName || a.objectName }}
                  </span>
                  <span v-if="!sourceLabel(a)" class="asset-source-name muted">未关联数据源</span>
                </div>
              </div>
            </div>
            <div class="asset-desc">{{ a.desc || a.cnName || '—' }}</div>
            <div class="asset-tags">
              <span class="tag" :class="a.levelClass">{{ a.level }}</span>
              <span v-if="a.isGold" class="tag tag-green">⭐ 黄金</span>
              <span v-if="a.status === 'degraded'" class="tag tag-orange">降级</span>
              <span v-if="a.linkStatus === 'stale'" class="tag tag-orange">源失效</span>
              <span
                v-for="(t, i) in (a.tags || []).slice(0, 3)"
                :key="i"
                class="tag"
                :class="t[1] || 'tag-gray'"
              >{{ t[0] }}</span>
            </div>
            <div class="asset-footer">
              <div class="asset-owner" :title="ownerTitle(a)">
                <span class="owner-avatar">{{ a.ownerAvatar }}</span>
                <span>{{ ownerLine(a) }}</span>
              </div>
              <div
                v-if="sourceTypeLabel(a)"
                class="asset-type-label"
                :style="{ background: sourceTypeVisual(a).bg, color: sourceTypeVisual(a).color }"
                :title="sourceTypeLabel(a)"
              >
                {{ sourceTypeLabel(a) }}
              </div>
              <div v-else class="asset-type-label muted">—</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AssetDrawer
      :open="drawerOpen"
      :asset="current"
      @close="closeDrawer"
      @updated="onAssetUpdated"
      @deleted="onAssetDeleted"
    />
    <RegisterAssetModal
      :open="regOpen"
      :preset-source-id="activeSources[0]?.id || ''"
      :preset-source-name="sourceFilter"
      @close="regOpen = false"
      @submit="onRegisterSubmit"
    />
  </div>
</template>
