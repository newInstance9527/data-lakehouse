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
import { ASSET_LAYERS, assetNameLabels } from '@/data/assetMeta'
import { useDomains } from '@/composables/useDomains'
import DsTypeIcon from '@/components/datasource/DsTypeIcon.vue'
import { dsTypeMeta } from '@/data/dsForm'
import { inferDsTypeCode } from '@/data/dsTypeIcons'
import { pageGuideOf } from '@/data/pageGuides'
import { bareDisplayUser } from '@/utils/displayUser'
import { invalidateMetricBindTables } from '@/data/metricBindAssets'

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

const VIEW_KEY = 'lh.catalog.view'
const view = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'card',
)
watch(view, (v) => {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    /* ignore */
  }
})

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

watch(currentWs, async () => {
  try {
    await loadSources({ ws: currentWs.value || 'default' })
  } catch (e) {
    showToast(`加载数据源失败：${e.message || e}`, 'error')
  }
  await reload()
})

onMounted(async () => {
  try {
    await Promise.all([
      loadSources({ ws: currentWs.value || 'default' }),
      ensureDomains().catch(() => {}),
    ])
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

async function onRegisterSubmit(payload, done) {
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
    import('@/analytics/portalAnalytics')
      .then((m) => m.trackFeature('asset_register', { assetId: row.id, layer: payload.layer }))
      .catch(() => {})
    if (payload.sourceName) sourceFilter.value = payload.sourceName
    invalidateMetricBindTables()
    await reload()
    await openAsset(row.id, false)
    done?.(true)
  } catch (e) {
    showToast(`注册失败：${e.message || e}`, 'error')
    done?.(false)
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

/** 列表主标题：优先业务名称，便于扫读 */
function titlePrimary(asset) {
  const biz = String(asset?.cnName || '').trim()
  const tech = String(asset?.name || asset?.key || '').trim()
  return biz || tech || '—'
}

/** 副标题：有业务名时补技术名；仅技术名时不再重复 */
function titleSecondary(asset) {
  const biz = String(asset?.cnName || '').trim()
  const tech = String(asset?.name || asset?.key || '').trim()
  if (biz && tech && biz !== tech) return tech
  return ''
}

function objectHint(asset) {
  const obj = String(asset?.objectName || asset?.tableName || '').trim()
  const tech = String(asset?.name || '').trim()
  if (obj && obj !== tech && obj !== titlePrimary(asset)) return obj
  return ''
}

function kindLabel(asset) {
  const labels = assetNameLabels(asset)
  const k = labels.kind || asset?.assetKind || ''
  if (!k || k === 'table') return ''
  return labels.tech.replace(/名$/, '') || k
}

function qualityText(asset) {
  const q = asset?.quality
  if (q === '—' || q == null || q === '') return ''
  const n = Number(q)
  if (Number.isNaN(n)) return String(q)
  return `${Math.round(n)}`
}

function statusLabel(asset) {
  const s = String(asset?.status || '').toLowerCase()
  if (!s || s === 'active') return ''
  const map = {
    draft: '草稿',
    syncing: '同步中',
    degraded: '降级',
    archived: '已归档',
  }
  return map[s] || s
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
          <div class="std-tabs catalog-view-tabs">
            <span class="std-tab" :class="{ active: view === 'card' }" @click="view = 'card'">卡片视图</span>
            <span class="std-tab" :class="{ active: view === 'list' }" @click="view = 'list'">列表视图</span>
          </div>
          <div class="catalog-toolbar-meta">
            <template v-if="loading">加载中… · </template>
            <template v-if="sourceFilter">
              数据源 <b>{{ sourceFilter }}</b> ·
            </template>
            展示 <b>{{ list.length }}</b> 项
          </div>
        </div>
        <p class="catalog-acl-hint tip">
          目录可见性 ≠ 引擎 ACL：能搜到资产不代表可预览或即席查询；非 Owner 须经
          <button type="button" class="btn-link" @click="router.push({ path: '/apply', query: { type: 'perm', privilege: 'SELECT', from: 'catalog' } })">申请中心</button>
          获 SELECT 后再生效。
        </p>

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

        <div v-else-if="view === 'card'" class="asset-grid">
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
              <div
                class="asset-ds-badge"
                :style="{ background: sourceTypeVisual(a).bg, color: sourceTypeVisual(a).color }"
                :title="sourceTypeLabel(a) || '数据源类型'"
              >
                <DsTypeIcon
                  :type="sourceTypeVisual(a).label"
                  :type-code="sourceTypeVisual(a).typeCode"
                  :size="20"
                />
              </div>
              <div class="asset-header-main">
                <div class="asset-name">
                  <span class="asset-layer" :class="`layer-${a.layer}`">{{ a.layerLabel }}</span>
                  <span v-if="kindLabel(a)" class="tag tag-gray asset-kind-tag">{{ kindLabel(a) }}</span>
                  <span class="asset-name-text" :title="titlePrimary(a)">{{ titlePrimary(a) }}</span>
                </div>
                <div v-if="titleSecondary(a)" class="asset-tech-line" :title="`${assetNameLabels(a).tech}：${titleSecondary(a)}`">
                  <span class="asset-name-label">{{ assetNameLabels(a).tech }}</span>
                  <code class="asset-tech-name">{{ titleSecondary(a) }}</code>
                </div>
                <div class="asset-meta-line">
                  <span class="asset-meta-chip">{{ a.domainLabel || a.domain || '未分域' }}</span>
                  <span v-if="sourceLabel(a)" class="asset-meta-chip" :title="sourceLabel(a)">
                    {{ sourceLabel(a) }}
                  </span>
                  <span v-else class="asset-meta-chip muted">未关联数据源</span>
                  <span
                    v-if="objectHint(a)"
                    class="asset-meta-chip mono"
                    :title="`源对象 ${objectHint(a)}`"
                  >{{ objectHint(a) }}</span>
                  <span v-if="a.engine" class="asset-meta-chip">{{ a.engine }}</span>
                </div>
              </div>
            </div>
            <div class="asset-desc" :title="a.desc || ''">{{ a.desc || '暂无描述' }}</div>
            <div class="asset-tags">
              <span class="tag" :class="a.levelClass">{{ a.level || '内部' }}</span>
              <span v-if="a.isGold" class="tag tag-green">黄金</span>
              <span v-if="qualityText(a)" class="tag" :class="a.qualityClass === 'qs-high' ? 'tag-green' : a.qualityClass === 'qs-low' ? 'tag-red' : 'tag-orange'">
                质量 {{ qualityText(a) }}
              </span>
              <span v-if="a.cols" class="tag tag-gray">{{ a.cols }} 列</span>
              <span v-if="statusLabel(a)" class="tag tag-orange">{{ statusLabel(a) }}</span>
              <span v-if="a.linkStatus === 'stale'" class="tag tag-orange">源失效</span>
              <span
                v-for="(t, i) in (a.tags || []).filter((x) => x?.[0] && x[0] !== a.assetKind && x[0] !== a.status).slice(0, 2)"
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
              <div class="asset-footer-right">
                <span v-if="a.updated" class="asset-updated" :title="a.updated">{{ a.updated }}</span>
                <div
                  v-if="sourceTypeLabel(a)"
                  class="asset-type-label"
                  :style="{ background: sourceTypeVisual(a).bg, color: sourceTypeVisual(a).color }"
                  :title="sourceTypeLabel(a)"
                >
                  {{ sourceTypeLabel(a) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="asset-list-wrap">
          <table class="std-table asset-list-table">
            <thead>
              <tr>
                <th style="width: 22%">资产</th>
                <th style="width: 8%">分层</th>
                <th style="width: 8%">业务域</th>
                <th style="width: 16%">数据源 / 源对象</th>
                <th style="width: 8%">敏感级</th>
                <th style="width: 7%">质量</th>
                <th style="width: 11%">Owner</th>
                <th style="width: 10%">更新</th>
                <th style="width: 10%">类型 / 状态</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="a in list"
                :key="a.id"
                class="asset-list-row"
                @click="openAsset(a.id)"
              >
                <td>
                  <div class="asset-list-title-row">
                    <span v-if="a.isGold" class="tag tag-green asset-list-gold">黄金</span>
                    <span class="asset-list-name" :title="titlePrimary(a)">{{ titlePrimary(a) }}</span>
                  </div>
                  <div v-if="titleSecondary(a)" class="asset-list-tech" :title="titleSecondary(a)">
                    {{ assetNameLabels(a).tech }} · {{ titleSecondary(a) }}
                  </div>
                  <div v-if="a.desc" class="asset-list-desc" :title="a.desc">{{ a.desc }}</div>
                </td>
                <td>
                  <span class="asset-layer" :class="`layer-${a.layer}`">{{ a.layerLabel }}</span>
                </td>
                <td>{{ a.domainLabel || a.domain || '—' }}</td>
                <td>
                  <div class="asset-list-ds" :title="sourceLabel(a) || ''">{{ sourceLabel(a) || '—' }}</div>
                  <div
                    v-if="a.objectName || a.tableName"
                    class="asset-list-obj"
                    :title="a.objectName || a.tableName"
                  >{{ a.objectName || a.tableName }}</div>
                </td>
                <td>
                  <span class="tag" :class="a.levelClass">{{ a.level || '—' }}</span>
                </td>
                <td>
                  <span
                    v-if="qualityText(a)"
                    class="tag"
                    :class="a.qualityClass === 'qs-high' ? 'tag-green' : a.qualityClass === 'qs-low' ? 'tag-red' : 'tag-orange'"
                  >{{ qualityText(a) }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td :title="ownerTitle(a)">{{ ownerLine(a) }}</td>
                <td>
                  <span class="asset-list-updated" :title="a.updated || ''">{{ a.updated || '—' }}</span>
                </td>
                <td>
                  <div class="asset-list-status">
                    <span
                      v-if="sourceTypeLabel(a)"
                      class="asset-type-label"
                      :style="{ background: sourceTypeVisual(a).bg, color: sourceTypeVisual(a).color }"
                    >{{ sourceTypeLabel(a) }}</span>
                    <span v-if="kindLabel(a)" class="tag tag-gray">{{ kindLabel(a) }}</span>
                    <span v-if="statusLabel(a)" class="tag tag-orange">{{ statusLabel(a) }}</span>
                    <span v-if="a.linkStatus === 'stale'" class="tag tag-orange">源失效</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
