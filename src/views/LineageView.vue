<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSizeSelect from '@/components/common/PageSizeSelect.vue'
import LineageGraph from '@/components/lineage/LineageGraph.vue'
import { pageGuideOf } from '@/data/pageGuides'
import {
  FIELD_META,
  focusTableMeta,
} from '@/data/lineage'
import { useLineage } from '@/composables/useLineage'
import { useToast } from '@/composables/useToast'
import { useSession } from '@/composables/useSession'
import { DEFAULT_PAGE_SIZE } from '@/config/pagination'
import { buildDownstreamPropagations, fieldNodeKey } from '@/utils/etlLineage'
import { fieldsFromAsset } from '@/utils/etlFields'
import { useAssets } from '@/composables/useAssets'
import { catalogAsset, resolveLineageFocus, standardMapping } from '@/utils/moduleLinks'

const route = useRoute()
const router = useRouter()
const guide = pageGuideOf('lineage')
const { showToast } = useToast()
const {
  fieldEdges,
  tables,
  lastParsedAt,
  stats,
  findTable,
  loadFields,
  loadGraphImpact,
  sync,
  changeEval,
  blockDdl: apiBlockDdl,
  graphPayload,
  impactPayload,
  syncInfo,
} = useLineage()
const { findAsset } = useAssets()
const { currentWs } = useSession()

const mode = ref('field')
const focusId = ref('')
const selectedField = ref('')
const upDepth = ref(5)
const downDepth = ref(5)
const edgeKw = ref('')
const impactPageSize = ref(DEFAULT_PAGE_SIZE)
const edgePage = ref(1)
const edgePageSize = ref(DEFAULT_PAGE_SIZE)
const propPage = ref(1)
const propPageSize = ref(DEFAULT_PAGE_SIZE)
const graphBusy = ref(false)
const syncBusy = ref(false)
const omDegraded = ref(false)
const graphSource = ref('')

/** 焦点下拉：门户字段边表优先，辅以图谱节点；无真数据时不回落演示主路径 */
const focusOptions = computed(() => {
  const map = new Map()
  const add = (value, label) => {
    const v = String(value || '').trim()
    if (!v || map.has(v)) return
    map.set(v, { value: v, label: label || v })
  }
  ;(fieldEdges.value || []).forEach((e) => {
    if (e.fromField === '*' && e.toField === '*') {
      add(e.fromTable, e.fromTable)
      add(e.toTable, e.toTable)
      return
    }
    add(e.fromTable, e.fromTable)
    add(e.toTable, e.toTable)
  })
  ;(graphPayload.value?.nodes || []).forEach((n) => add(n.id || n.name, n.name || n.id))
  ;(tables.value || []).forEach((t) => add(t.id || t.key, t.fullName || t.key || t.id))
  return [...map.values()].sort((a, b) => String(a.label).localeCompare(String(b.label), 'zh'))
})

function clampDepth(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return 0
  return Math.min(99, Math.floor(v))
}

function pageNums(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, cur, cur - 1, cur + 1].filter((n) => n >= 1 && n <= total))
  return [...set].sort((a, b) => a - b)
}

function pickDefaultField(fields) {
  if (!fields?.length) return ''
  const prefer = fields.find((f) => f.name === 'pay_amt') || fields.find((f) => /amt|amount|gmv/i.test(f.name))
  return prefer?.name || fields[0].name
}

function resolveFocusIdFromTable(tableKey) {
  return String(tableKey || '').trim()
}

const focusMeta = computed(() => focusTableMeta(focusId.value))

const focusEtlTable = computed(() => {
  const meta = focusMeta.value
  for (const a of meta.aliases || []) {
    const t = findTable(a)
    if (t) return t
  }
  return findTable(meta.tableKey) || tables.value.find((t) => t.assetId === meta.assetId) || null
})

const focusFields = computed(() => {
  const meta = focusMeta.value
  const fromEtl = focusEtlTable.value?.fields
  if (fromEtl?.length) return fromEtl
  const asset = findAsset(meta.assetId) || findAsset(meta.tableKey)
  if (asset) return fieldsFromAsset(asset)
  const fromEdges = new Set()
  ;(fieldEdges.value || []).forEach((e) => {
    if (e.fromField === '*' || e.toField === '*') return
    if (e.fromTable === meta.tableKey) fromEdges.add(e.fromField)
    if (e.toTable === meta.tableKey) fromEdges.add(e.toField)
  })
  if (fromEdges.size) {
    return [...fromEdges].map((name) => ({ name, type: 'STRING' }))
  }
  return []
})

const focusFieldInfo = computed(() => focusFields.value.find((f) => f.name === selectedField.value) || null)

const fieldMetaExtra = computed(() => {
  const key = fieldNodeKey(focusMeta.value.tableKey, selectedField.value)
  return FIELD_META[key] || null
})

const downstream = computed(() => {
  if (!selectedField.value) return { items: [], impactCount: 0, edges: [] }
  const meta = focusMeta.value
  const tableKey = focusEtlTable.value?.key || meta.tableKey
  const aliases = new Set([tableKey, meta.tableKey, ...(meta.aliases || [])])
  const edges = (fieldEdges.value || []).map((e) => ({
    ...e,
    fromTable: aliases.has(e.fromTable) ? tableKey : e.fromTable,
    toTable: aliases.has(e.toTable) ? tableKey : e.toTable,
  }))
  return buildDownstreamPropagations(tableKey, selectedField.value, edges, clampDepth(downDepth.value))
})

const graphNodes = computed(() => {
  const nodes = graphPayload.value?.nodes
  if (nodes?.length) return nodes
  return []
})

const graphEdges = computed(() => graphPayload.value?.edges || [])

const highlightIds = computed(() => {
  const ids = new Set(graphNodes.value.map((n) => n.id))
  const meta = focusMeta.value
  ;[focusId.value, meta.tableKey, ...(meta.aliases || [])].filter(Boolean).forEach((x) => ids.add(x))
  return [...ids]
})

const graphFocusId = computed(() => focusMeta.value.tableKey || focusId.value)

const impact = computed(() => ({
  up: impactPayload.value?.up || [],
  down: impactPayload.value?.down || [],
}))

const propTotalPages = computed(() => Math.max(1, Math.ceil(downstream.value.items.length / propPageSize.value)))
const pagedProps = computed(() => {
  const start = (propPage.value - 1) * propPageSize.value
  return downstream.value.items.slice(start, start + propPageSize.value)
})
const propPageNums = computed(() => pageNums(propPage.value, propTotalPages.value))

const changeWarn = computed(() => {
  const extra = fieldMetaExtra.value
  const type = focusFieldInfo.value?.type || 'STRING'
  const toType = extra?.suggestToType
  const count = downstream.value.impactCount
  if (!selectedField.value) return null
  if (toType) {
    return {
      title: count ? '⚠ 破坏性变更评估未通过' : 'ℹ 暂无下游字段边',
      body: count
        ? `拟将字段 ${selectedField.value} ${type} → ${toType}，影响 ${count} 个下游字段对象（下游 ${clampDepth(downDepth.value)} 层内）。`
        : `拟变更 ${selectedField.value}（${type} → ${toType}），当前门户字段边无下游。`,
    }
  }
  return {
    title: count ? `影响分析 · ${count} 个下游字段` : 'ℹ 暂无下游字段边',
    body: count
      ? `字段 ${selectedField.value}（${type}）在下游 ${clampDepth(downDepth.value)} 层内传播至 ${count} 个对象。`
      : `字段 ${selectedField.value} 在门户字段边中没有下游映射，可点「同步」重扫 ETL 后检查。`,
  }
})

const upTotalPages = computed(() => Math.max(1, Math.ceil(impact.value.up.length / impactPageSize.value)))
const downTotalPages = computed(() => Math.max(1, Math.ceil(impact.value.down.length / impactPageSize.value)))
const upPage = ref(1)
const downPage = ref(1)

const pagedUp = computed(() => {
  const start = (upPage.value - 1) * impactPageSize.value
  return impact.value.up.slice(start, start + impactPageSize.value)
})
const pagedDown = computed(() => {
  const start = (downPage.value - 1) * impactPageSize.value
  return impact.value.down.slice(start, start + impactPageSize.value)
})

const relatedFieldEdges = computed(() => {
  const q = edgeKw.value.trim().toLowerCase()
  let list = fieldEdges.value || []
  if (mode.value === 'field' && selectedField.value) {
    const tableKey = focusEtlTable.value?.key || focusMeta.value.tableKey
    const downKeys = new Set(downstream.value.items.map((i) => i.key))
    const focusKey = fieldNodeKey(tableKey, selectedField.value)
    downKeys.add(focusKey)
    list = list.filter((e) => {
      const from = fieldNodeKey(e.fromTable, e.fromField)
      const to = fieldNodeKey(e.toTable, e.toField)
      return downKeys.has(from) || downKeys.has(to) || from === focusKey || to === focusKey
    })
  }
  if (!q) return list
  return list.filter((e) =>
    `${e.fromTable} ${e.fromField} ${e.toTable} ${e.toField} ${e.transform}`.toLowerCase().includes(q),
  )
})

const edgeTotalPages = computed(() => Math.max(1, Math.ceil(relatedFieldEdges.value.length / edgePageSize.value)))
const pagedEdges = computed(() => {
  const start = (edgePage.value - 1) * edgePageSize.value
  return relatedFieldEdges.value.slice(start, start + edgePageSize.value)
})

const upPageNums = computed(() => pageNums(upPage.value, upTotalPages.value))
const downPageNums = computed(() => pageNums(downPage.value, downTotalPages.value))
const edgePageNums = computed(() => pageNums(edgePage.value, edgeTotalPages.value))

async function refreshGraph() {
  graphBusy.value = true
  try {
    const focus = focusId.value || focusOptions.value[0]?.value || ''
    if (!focusId.value && focus) focusId.value = focus
    const { graph } = await loadGraphImpact(
      focus,
      clampDepth(upDepth.value),
      clampDepth(downDepth.value),
      currentWs.value || 'default',
    )
    omDegraded.value = !!graph?.omDegraded
    graphSource.value = graph?.source || ''
    if (graph?.focusTable && !focusId.value) focusId.value = graph.focusTable
  } catch (e) {
    showToast(`血缘图加载失败：${e.message || e}`, 'error')
  } finally {
    graphBusy.value = false
  }
}

watch(
  () => [route.query.focus, route.query.node, route.query.omFqn, route.query.q],
  () => {
    const v = resolveLineageFocus(route.query)
    if (!v) return
    focusId.value = String(v)
  },
  { immediate: true },
)

watch(
  () => route.query.mode,
  (v) => {
    if (v === 'field' || v === 'table') mode.value = v
  },
  { immediate: true },
)

watch(
  () => route.query.field,
  (v) => {
    if (v) selectedField.value = String(v)
  },
  { immediate: true },
)

watch(focusId, () => {
  upPage.value = 1
  downPage.value = 1
  propPage.value = 1
  selectedField.value = pickDefaultField(focusFields.value)
  router.replace({
    query: { ...route.query, focus: focusId.value, mode: mode.value, field: selectedField.value || undefined },
  })
  refreshGraph()
})

watch(focusFields, (fields) => {
  if (!fields.some((f) => f.name === selectedField.value)) {
    selectedField.value = pickDefaultField(fields)
  }
})

watch(selectedField, (f) => {
  propPage.value = 1
  router.replace({
    query: { ...route.query, focus: focusId.value, mode: mode.value, field: f || undefined },
  })
})

watch([edgeKw, edgePageSize], () => {
  edgePage.value = 1
})

watch([upDepth, downDepth], () => {
  upPage.value = 1
  downPage.value = 1
  propPage.value = 1
  refreshGraph()
})

watch([impactPageSize, propPageSize], () => {
  upPage.value = 1
  downPage.value = 1
  propPage.value = 1
})

function setMode(m) {
  mode.value = m
  router.replace({ query: { ...route.query, mode: m, focus: focusId.value, field: selectedField.value || undefined } })
}

function onSelectNode(n) {
  if (!n?.id) return
  focusId.value = resolveFocusIdFromTable(n.id)
}

function onPickPropagation(p) {
  if (p?.tableKey) {
    focusId.value = resolveFocusIdFromTable(p.tableKey)
    selectedField.value = p.fieldName || selectedField.value
    return
  }
  showToast(`下游字段 ${p?.name || ''}`, 'info')
}

function goCatalog(assetId) {
  if (!assetId) {
    router.push('/catalog')
    return
  }
  router.push(catalogAsset(assetId))
}

function goStandardMapping() {
  const q = selectedField.value || focusMeta.value?.tableKey || focusId.value
  router.push(standardMapping(q))
}

function onGraphGo(target) {
  if (target === 'report') {
    showToast('报表节点：进资产目录或申请中心查看授权', 'info')
    return
  }
  if (target === '/metrics' || target === 'metrics') {
    router.push('/metrics')
    return
  }
  if (typeof target === 'string' && target.startsWith('/metrics')) {
    router.push(target)
    return
  }
  router.push(target || '/integration')
}

function onImpactClick(item) {
  if (item?.type === '指标' || item?.metricCode) {
    const code = item.metricCode || item.key
    router.push(item.path || `/metrics?q=${encodeURIComponent(code || '')}`)
    return
  }
  if (item.nodeId) {
    focusId.value = resolveFocusIdFromTable(item.nodeId)
    return
  }
  if (item.key) {
    focusId.value = resolveFocusIdFromTable(item.key)
    return
  }
  if (item.assetId) {
    goCatalog(item.assetId)
    return
  }
  showToast('打开对象详情', 'info')
}

function impactTypeClass(type) {
  if (type === '报表') return 'tag tag-purple'
  if (type === '指标') return 'tag tag-red'
  if (type === '接口') return 'tag tag-cyan'
  if (type === '源') return 'tag tag-gray'
  const layer = String(type || '').toLowerCase().slice(0, 3)
  return `asset-layer layer-${layer}`
}

function exportSvg() {
  showToast('已导出血缘关系图 SVG', 'success')
}

async function genChangeEval() {
  try {
    const r = await changeEval(
      focusMeta.value.tableKey,
      selectedField.value,
      fieldMetaExtra.value?.suggestToType,
    )
    showToast(
      `变更评估已生成 · 下游 ${r.impactCount ?? downstream.value.impactCount} 项 · ${r.id || ''}`,
      'success',
    )
  } catch (e) {
    showToast(`评估失败：${e.message || e}`, 'error')
  }
}

async function blockDdl() {
  try {
    const r = await apiBlockDdl(focusMeta.value.tableKey, selectedField.value, '变更评估未通过')
    showToast(`已登记阻断 DDL · ${r.ticketId || selectedField.value || ''}`, 'info')
  } catch (e) {
    showToast(`阻断失败：${e.message || e}`, 'error')
  }
}

async function onRebuild() {
  syncBusy.value = true
  try {
    const info = await sync(currentWs.value || 'default')
    const r = info?.result || {}
    const mzOk = info?.marquez?.ok === true || r?.marquez?.ok === true
    const edges = r.edgeCount ?? stats.value.fieldEdges
    const ok = r.lineageOk ?? 0
    const topo = r.topologyOk ?? 0
    const dags = r.dagCount ?? 0
    showToast(
      `同步完成 · 扫 ${dags} 个 DAG · 显式边+${ok} / 拓扑+${topo} · 合计 ${edges} · Marquez ${mzOk ? 'UP' : '降级'}`,
      'success',
      { duration: 6000 },
    )
    if (!focusId.value && focusOptions.value.length) {
      focusId.value = focusOptions.value[0].value
    }
    await refreshGraph()
  } catch (e) {
    showToast(`同步失败：${e.message || e}`, 'error')
  } finally {
    syncBusy.value = false
  }
}

onMounted(async () => {
  const fromRoute = resolveLineageFocus(route.query)
  try {
    await loadFields({ ws: currentWs.value || 'default' })
  } catch (e) {
    showToast(`字段边加载失败：${e.message || e}`, 'error')
  }
  if (fromRoute) {
    focusId.value = String(fromRoute)
  } else if (!focusId.value && focusOptions.value.length) {
    focusId.value = focusOptions.value[0].value
  }
  if (!selectedField.value) selectedField.value = pickDefaultField(focusFields.value)
  await refreshGraph()
})

watch(currentWs, async () => {
  try {
    await loadFields({ ws: currentWs.value || 'default' })
    const opts = focusOptions.value
    if (!opts.some((o) => o.value === focusId.value)) {
      focusId.value = opts[0]?.value || ''
      selectedField.value = pickDefaultField(focusFields.value)
    }
    await refreshGraph()
  } catch (e) {
    showToast(`字段边加载失败：${e.message || e}`, 'error')
  }
})
</script>

<template>
  <div class="lineage-page">
    <PageHeader
      page-id="lineage"
      title="字段级血缘图谱"
      subtitle="端到端血缘 · 可输入上下游钻取层数（默认 5）· 支持变更影响分析"
      :guide-title="guide.title"
      :guide="guide"
    >
      <select v-model="focusId" class="select input-sm" style="min-width: 220px">
        <option v-if="!focusOptions.length" value="" disabled>暂无表（请发布 ETL 或同步）</option>
        <option v-for="o in focusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <label class="depth-ctl">
        <span>上游</span>
        <input
          v-model.number="upDepth"
          class="input input-sm depth-input"
          type="number"
          min="0"
          max="99"
          title="上游钻取层数"
          @change="upDepth = clampDepth(upDepth)"
        />
        <span>层</span>
      </label>
      <label class="depth-ctl">
        <span>下游</span>
        <input
          v-model.number="downDepth"
          class="input input-sm depth-input"
          type="number"
          min="0"
          max="99"
          title="下游钻取层数"
          @change="downDepth = clampDepth(downDepth)"
        />
        <span>层</span>
      </label>
      <select :value="mode" class="select input-sm" @change="setMode($event.target.value)">
        <option value="field">字段级</option>
        <option value="table">表级</option>
      </select>
      <button class="btn btn-sm" @click="exportSvg">⬇ 导出 SVG</button>
    </PageHeader>

    <div class="lin-layout">
      <div class="lin-main-col">
        <section class="card">
          <div class="card-header lin-head">
            <div class="card-title">
              🗺️ 全链路血缘视图
              <span class="tip">（ETL 发布写边 · 点击节点查看详情）</span>
              <span v-if="graphBusy" class="tag tag-gray" style="margin-left: 8px">加载中…</span>
              <span
                v-else-if="graphSource"
                class="tag tag-blue"
                style="margin-left: 8px"
                :title="graphSource"
              >{{ graphSource.includes('portal') ? '门户边' : graphSource.includes('openmetadata') ? '外部目录' : graphSource }}</span>
              <span v-if="omDegraded" class="tag tag-orange" style="margin-left: 8px" title="外部血缘 soft-fail">
                外部降级
              </span>
            </div>
            <div class="flex align-center gap-8">
              <span class="tag layer-ods" style="border: none">ODS</span>
              <span class="tag layer-dwd" style="border: none">DWD</span>
              <span class="tag layer-dws" style="border: none">DWS</span>
              <span class="tag layer-ads" style="border: none">ADS/加速层</span>
              <span class="tag tag-purple" style="border: none">报表</span>
            </div>
          </div>
          <div class="card-body" style="padding: 0; min-height: 620px; position: relative">
            <LineageGraph
              :nodes="graphNodes"
              :edges="graphEdges"
              :focus-id="graphFocusId"
              :highlight-ids="highlightIds"
              @select="onSelectNode"
              @open-asset="goCatalog"
              @go="onGraphGo"
            />
            <div
              v-if="!graphBusy && !graphNodes.length"
              style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--text-3); font-size: 13px; pointer-events: none"
            >
              暂无血缘节点：请在 ETL 配置 fieldMaps 并发布，或点「同步」重扫 DAG 写边
            </div>
          </div>
        </section>

        <div class="impact-panel">
          <div class="impact-list">
            <div class="impact-list-header">
              <span style="color: var(--primary)">⬆ 上游溯源（{{ clampDepth(upDepth) }} 层内）</span>
              <span class="tag tag-blue">{{ impact.up.length }} 项</span>
            </div>
            <button
              v-for="(t, i) in pagedUp"
              :key="'u' + i + t.key"
              type="button"
              class="impact-item"
              @click="onImpactClick(t)"
            >
              <span :class="impactTypeClass(t.type)" style="margin-right: 8px">{{ t.type }}</span>
              <div class="ii-body">
                <div class="ii-name">{{ t.key }}</div>
                <div class="muted">{{ t.note }}</div>
              </div>
              <span class="ii-arrow up">↑</span>
            </button>
            <div v-if="!pagedUp.length" class="muted empty">无上游</div>
            <div v-if="impact.up.length > impactPageSize" class="ds-pager impact-pager">
              <div class="ds-pager-info">{{ upPage }} / {{ upTotalPages }}</div>
              <div class="ds-pager-controls">
                <PageSizeSelect v-model="impactPageSize" />
                <button class="btn btn-sm" :disabled="upPage <= 1" @click="upPage--">上一页</button>
                <button
                  v-for="n in upPageNums"
                  :key="'up' + n"
                  class="btn btn-sm"
                  :class="{ 'btn-primary': n === upPage }"
                  @click="upPage = n"
                >{{ n }}</button>
                <button class="btn btn-sm" :disabled="upPage >= upTotalPages" @click="upPage++">下一页</button>
              </div>
            </div>
          </div>

          <div class="impact-list">
            <div class="impact-list-header">
              <span style="color: var(--danger)">⬇ 下游影响（{{ clampDepth(downDepth) }} 层内）</span>
              <span class="tag tag-red">{{ impact.down.length }} 项</span>
            </div>
            <button
              v-for="(t, i) in pagedDown"
              :key="'d' + i + t.key"
              type="button"
              class="impact-item"
              @click="onImpactClick(t)"
            >
              <span :class="impactTypeClass(t.type)" style="margin-right: 8px">{{ t.type }}</span>
              <div class="ii-body">
                <div class="ii-name">{{ t.key }}</div>
                <div class="muted">{{ t.note }}</div>
              </div>
              <span class="ii-arrow down">↓</span>
            </button>
            <div v-if="!pagedDown.length" class="muted empty">无下游</div>
            <div v-if="impact.down.length > impactPageSize" class="ds-pager impact-pager">
              <div class="ds-pager-info">{{ downPage }} / {{ downTotalPages }}</div>
              <div class="ds-pager-controls">
                <PageSizeSelect v-model="impactPageSize" />
                <button class="btn btn-sm" :disabled="downPage <= 1" @click="downPage--">上一页</button>
                <button
                  v-for="n in downPageNums"
                  :key="'dn' + n"
                  class="btn btn-sm"
                  :class="{ 'btn-primary': n === downPage }"
                  @click="downPage = n"
                >{{ n }}</button>
                <button class="btn btn-sm" :disabled="downPage >= downTotalPages" @click="downPage++">下一页</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 字段级：ETL 解析的字段边明细（分页）；表级隐藏以免干扰 -->
        <section v-if="mode === 'field'" class="card" style="margin-top: 16px">
          <div class="card-header">
            <div class="card-title">字段血缘明细</div>
            <div class="lin-edge-tools">
              <input v-model="edgeKw" class="input input-sm" style="width: 200px" placeholder="筛选表/字段…" />
              <button class="btn btn-sm" :disabled="syncBusy" @click="onRebuild">↻ 同步</button>
              <span class="muted" v-if="lastParsedAt">{{ lastParsedAt }}</span>
              <span class="muted" v-if="syncInfo?.result?.markValue">水位 {{ syncInfo.result.markValue }}</span>
            </div>
          </div>
          <div class="card-body" style="padding: 0; overflow: auto">
            <table class="lin-table">
              <thead>
                <tr>
                  <th>源表</th>
                  <th>源字段</th>
                  <th></th>
                  <th>目标表</th>
                  <th>目标字段</th>
                  <th>变换</th>
                  <th>置信</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in pagedEdges" :key="e.id">
                  <td><code>{{ e.fromTable }}</code></td>
                  <td><code>{{ e.fromField }}</code></td>
                  <td class="arrow">→</td>
                  <td><code>{{ e.toTable }}</code></td>
                  <td><code>{{ e.toField }}</code></td>
                  <td>{{ e.transform || '—' }}</td>
                  <td>
                    <span class="tag" :class="e.confidence === 'explicit' ? 'tag-green' : 'tag-gray'">
                      {{ e.confidence === 'explicit' ? '显式' : '推断' }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!pagedEdges.length">
                  <td colspan="7" class="empty">暂无字段边。请在 ETL 配置 fieldMaps 并发布，或点「同步」重扫 DAG。</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="relatedFieldEdges.length" class="ds-pager" style="padding: 12px">
            <div class="ds-pager-info">
              第 {{ edgePage }} / {{ edgeTotalPages }} 页 · 本页 {{ pagedEdges.length }} 条 · 共 {{ relatedFieldEdges.length }} 条
            </div>
            <div class="ds-pager-controls">
              <PageSizeSelect v-model="edgePageSize" />
              <button class="btn btn-sm" :disabled="edgePage <= 1" @click="edgePage--">上一页</button>
              <template v-for="(n, i) in edgePageNums" :key="'e' + n">
                <span v-if="i > 0 && n - edgePageNums[i - 1] > 1" class="ds-pager-ellipsis">…</span>
                <button class="btn btn-sm" :class="{ 'btn-primary': n === edgePage }" @click="edgePage = n">{{ n }}</button>
              </template>
              <button class="btn btn-sm" :disabled="edgePage >= edgeTotalPages" @click="edgePage++">下一页</button>
            </div>
          </div>
        </section>
      </div>

      <!-- 右侧：字段级变更影响 -->
      <aside class="lin-side-card">
        <template v-if="mode === 'field'">
          <div class="lin-side-hd">
            <div class="lin-side-title">字段级变更影响</div>
            <div class="lin-side-sub">{{ focusEtlTable?.fullName || focusMeta.tableKey }}</div>
          </div>
          <div class="lin-side-bd">
            <label class="lin-field-pick">
              <span>焦点字段</span>
              <select v-model="selectedField" class="select input-sm">
                <option v-for="f in focusFields" :key="f.name" :value="f.name">
                  {{ f.name }}{{ f.cn ? ` · ${f.cn}` : '' }}
                </option>
              </select>
            </label>

            <div v-if="changeWarn" class="lin-alert" :class="{ info: !downstream.impactCount }">
              <div class="lin-alert-t">{{ changeWarn.title }}</div>
              <div class="lin-alert-b">{{ changeWarn.body }}</div>
            </div>

            <div class="lin-block">
              <div class="lin-block-t">字段定义</div>
              <div class="lin-def-grid">
                <div class="lin-def">
                  <span>字段名</span>
                  <strong>
                    <code>{{ selectedField || '—' }}</code>
                    <em v-if="fieldMetaExtra?.tag" class="lin-pill">{{ fieldMetaExtra.tag }}</em>
                  </strong>
                </div>
                <div class="lin-def">
                  <span>所属表</span>
                  <button type="button" class="linkish" @click="goCatalog(focusMeta.assetId)">
                    {{ focusEtlTable?.fullName || focusMeta.tableKey }} →
                  </button>
                </div>
                <div class="lin-def">
                  <span>当前类型</span>
                  <strong>
                    {{ focusFieldInfo?.type || '—' }}
                    <template v-if="fieldMetaExtra?.unit"> · {{ fieldMetaExtra.unit }}</template>
                  </strong>
                </div>
                <div v-if="fieldMetaExtra?.std" class="lin-def">
                  <span>标准映射</span>
                  <button type="button" class="linkish" @click="goStandardMapping">
                    <strong>{{ fieldMetaExtra.std }}</strong>
                  </button>
                </div>
                <div v-else class="lin-def">
                  <span>标准映射</span>
                  <button type="button" class="linkish" @click="goStandardMapping">打开映射检索 →</button>
                </div>
                <div v-if="fieldMetaExtra?.desc || focusFieldInfo?.cn" class="lin-def full">
                  <span>口径说明</span>
                  <p>{{ fieldMetaExtra?.desc || focusFieldInfo?.cn }}</p>
                </div>
              </div>
            </div>

            <div class="lin-block">
              <div class="lin-block-t">
                下游传播清单
                <span class="lin-count">{{ downstream.impactCount }}</span>
              </div>
              <button
                v-for="p in pagedProps"
                :key="p.key"
                type="button"
                class="lin-prop"
                @click="onPickPropagation(p)"
              >
                <div class="lin-prop-main">
                  <div class="lin-prop-name">{{ p.name }}</div>
                  <div class="lin-prop-meta">{{ p.transform }} · 下 {{ p.hop }} 层</div>
                </div>
                <span class="tag" :class="p.tagClass">{{ p.tag }}</span>
              </button>
              <div v-if="!pagedProps.length" class="lin-empty">无下游字段边</div>
              <div v-if="downstream.items.length > propPageSize" class="ds-pager impact-pager">
                <div class="ds-pager-info">{{ propPage }} / {{ propTotalPages }}</div>
                <div class="ds-pager-controls">
                  <PageSizeSelect v-model="propPageSize" />
                  <button class="btn btn-sm" :disabled="propPage <= 1" @click="propPage--">上一页</button>
                  <button
                    v-for="n in propPageNums"
                    :key="'pp' + n"
                    class="btn btn-sm"
                    :class="{ 'btn-primary': n === propPage }"
                    @click="propPage = n"
                  >{{ n }}</button>
                  <button class="btn btn-sm" :disabled="propPage >= propTotalPages" @click="propPage++">下一页</button>
                </div>
              </div>
            </div>

            <div class="lin-actions">
              <button type="button" class="lin-act primary" @click="genChangeEval">
                <b>生成变更评估</b>
                <small>汇总下游影响，生成评审单</small>
              </button>
              <button type="button" class="lin-act danger" @click="blockDdl">
                <b>阻断 DDL</b>
                <small>评估未通过前拦截字段变更</small>
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="lin-side-hd">
            <div class="lin-side-title">表级视图</div>
          </div>
          <div class="lin-side-bd">
            <p class="lin-empty" style="text-align: left; padding: 0 0 12px">
              图谱与上下游列表展示资产级依赖。切换到字段级后，可按 ETL 字段边展开下游传播。
            </p>
            <button class="btn btn-sm btn-primary" style="width: 100%" @click="setMode('field')">
              切换到字段级 →
            </button>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.lin-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  align-items: start;
}
.depth-ctl {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}
.depth-input {
  width: 52px;
  text-align: center;
  padding-left: 6px;
  padding-right: 6px;
}
.lin-main-col {
  min-width: 0;
}
.lin-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}
.impact-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.impact-list {
  background: var(--bg-1, #fff);
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.impact-list-header {
  padding: 10px 14px;
  background: var(--bg-2, #fafafa);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.impact-item {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: #fff;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.impact-item:last-child {
  border-bottom: none;
}
.impact-item:hover {
  background: var(--bg-2, #fafafa);
}
.ii-body {
  flex: 1;
  min-width: 0;
}
.ii-name {
  font-size: 12px;
  font-weight: 500;
  word-break: break-all;
}
.muted {
  font-size: 10px;
  color: var(--text-3);
}
.ii-arrow.up {
  color: var(--primary);
  font-size: 11px;
}
.ii-arrow.down {
  color: var(--danger, #cf1322);
  font-size: 11px;
}
.empty {
  padding: 12px;
  text-align: center;
}
.impact-pager {
  padding: 8px 10px;
  border-top: 1px solid var(--border);
}
.lin-side-card {
  position: sticky;
  top: 0;
  align-self: start;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  min-width: 0;
}
.lin-side-hd {
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
}
.lin-side-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.01em;
}
.lin-side-sub {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-3);
  word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.lin-side-bd {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lin-field-pick {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  color: var(--text-3);
  font-weight: 600;
}
.lin-field-pick .select {
  width: 100%;
}
.lin-alert {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--danger-light);
  border: 1px solid #ffccc7;
}
.lin-alert.info {
  background: #f5f8fc;
  border-color: var(--border);
}
.lin-alert-t {
  font-size: 12px;
  font-weight: 700;
  color: var(--danger);
  margin-bottom: 4px;
}
.lin-alert.info .lin-alert-t {
  color: var(--text-2);
}
.lin-alert-b {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.55;
}
.lin-alert-b :deep(code),
.lin-alert-b code {
  background: #fff;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid #f0f0f0;
}
.lin-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lin-block-t {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
}
.lin-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 99px;
  background: var(--danger-light);
  color: var(--danger);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.lin-def-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-2);
  border-radius: 10px;
  border: 1px solid #e8edf5;
}
.lin-def {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  align-items: start;
  font-size: 12px;
}
.lin-def.full {
  grid-template-columns: 1fr;
  gap: 4px;
}
.lin-def span {
  color: var(--text-3);
  font-size: 11px;
  padding-top: 1px;
}
.lin-def strong {
  font-weight: 600;
  color: var(--text-1);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.lin-def p {
  margin: 0;
  color: var(--text-2);
  line-height: 1.55;
  font-size: 12px;
}
.lin-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 99px;
  background: #fff7e6;
  color: #d48806;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  border: 1px solid #ffe7ba;
}
.lin-prop {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
}
.lin-prop + .lin-prop {
  margin-top: 6px;
}
.lin-prop:hover {
  border-color: #b7d0ff;
  background: #f7faff;
  box-shadow: 0 2px 8px rgba(30, 111, 255, 0.06);
}
.lin-prop-main {
  flex: 1;
  min-width: 0;
}
.lin-prop-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  word-break: break-all;
}
.lin-prop-meta {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-3);
}
.lin-empty {
  padding: 14px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
}
.lin-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
}
.lin-act {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #fff;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
}
.lin-act b {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}
.lin-act small {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.4;
}
.lin-act.primary {
  border-color: #b7d0ff;
  background: linear-gradient(180deg, #f5f9ff 0%, #eef4ff 100%);
}
.lin-act.primary:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(30, 111, 255, 0.12);
}
.lin-act.primary b {
  color: var(--primary);
}
.lin-act.danger {
  border-color: #ffccc7;
  background: linear-gradient(180deg, #fff8f7 0%, #fff1f0 100%);
}
.lin-act.danger:hover {
  border-color: var(--danger);
  box-shadow: 0 4px 12px rgba(245, 34, 45, 0.1);
}
.lin-act.danger b {
  color: var(--danger);
}
.linkish {
  border: none;
  background: none;
  color: var(--primary);
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  text-align: left;
  word-break: break-all;
}
.lin-edge-tools {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.lin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.lin-table th,
.lin-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}
.lin-table th {
  background: var(--bg-2, #fafafa);
  position: sticky;
  top: 0;
  z-index: 1;
}
.lin-table .arrow {
  color: var(--text-3);
}
@media (max-width: 1100px) {
  .lin-layout {
    grid-template-columns: 1fr;
  }
  .impact-panel {
    grid-template-columns: 1fr;
  }
  .lin-side-card {
    position: static;
  }
}
</style>
