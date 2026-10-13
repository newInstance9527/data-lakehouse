<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchGlossaryGraph, fetchGlossaryStats, rebuildGlossaryEdges } from '@/api/ai'
import { TERM_EDGE_LABEL } from '@/data/knowledge'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  /** 可选根术语 entryId */
  root: { type: String, default: '' },
})

const emit = defineEmits(['open-term'])

const router = useRouter()
const { showToast } = useToast()

const loading = ref(false)
const rebuilding = ref(false)
const stats = ref(null)
const graph = ref({ nodes: [], edges: [] })
const err = ref('')

const kpi = computed(() => {
  const s = stats.value || {}
  return [
    { label: '业务术语', value: s.termCount ?? '—', tip: 'KB cat=term' },
    {
      label: '指标覆盖率',
      value: s.metricTermCoveragePct != null ? `${s.metricTermCoveragePct}%` : '—',
      tip: `已启用指标 ${s.metricWithTermCount ?? 0}/${s.activeMetricCount ?? 0}`,
    },
    {
      label: '术语挂接率',
      value: s.termLinkRatePct != null ? `${s.termLinkRatePct}%` : '—',
      tip: '至少一条类型化边',
    },
    {
      label: '断链率',
      value: s.brokenEdgeRatePct != null ? `${s.brokenEdgeRatePct}%` : '—',
      tip: `断边 ${s.brokenEdgeCount ?? 0}/${s.edgeCount ?? 0}`,
    },
  ]
})

const layout = computed(() => layoutCircle(graph.value?.nodes || [], 320, 200, 150))

const edgePaths = computed(() => {
  const pos = Object.fromEntries(layout.value.map((n) => [n.id, n]))
  return (graph.value?.edges || [])
    .map((e) => {
      const a = pos[e.fromId]
      const b = pos[e.toId]
      if (!a || !b) return null
      return {
        ...e,
        d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        label: TERM_EDGE_LABEL[e.edgeType] || e.edgeType,
        broken: e.status === 'broken',
      }
    })
    .filter(Boolean)
})

function layoutCircle(nodes, cx, cy, r) {
  const n = nodes.length || 1
  return nodes.map((node, i) => {
    const ang = (2 * Math.PI * i) / n - Math.PI / 2
    return {
      ...node,
      x: cx + r * Math.cos(ang),
      y: cy + r * Math.sin(ang),
    }
  })
}

async function load() {
  loading.value = true
  err.value = ''
  try {
    const [g, s] = await Promise.all([
      fetchGlossaryGraph({ root: props.root || undefined, depth: 2 }),
      fetchGlossaryStats(),
    ])
    graph.value = g || { nodes: [], edges: [] }
    stats.value = s
  } catch (e) {
    err.value = e?.message || '术语图谱加载失败'
    showToast(err.value, 'warning')
  } finally {
    loading.value = false
  }
}

async function onRebuild() {
  if (rebuilding.value) return
  rebuilding.value = true
  try {
    const r = await rebuildGlossaryEdges()
    showToast(`已重建 ${r?.edgeCount ?? 0} 条术语边`, 'success')
    await load()
  } catch (e) {
    showToast(e?.message || '重建失败', 'error')
  } finally {
    rebuilding.value = false
  }
}

function onNodeClick(node) {
  if (node.kind === 'term' && node.entryId) {
    emit('open-term', node.entryId)
    return
  }
  if (node.kind === 'metric' && node.refId) {
    router.push({ path: '/metric', query: { code: node.refId } })
    return
  }
  if (node.kind === 'standard' && node.refId) {
    router.push({ path: '/standard', query: { q: node.refId } })
  }
}

onMounted(load)
watch(() => props.root, load)

defineExpose({ reload: load })
</script>

<template>
  <div class="gloss-panel">
    <div class="gloss-toolbar">
      <div class="gloss-title">术语图谱 · Business Glossary</div>
      <div class="gloss-actions">
        <button type="button" class="btn btn-sm" :disabled="loading" @click="load">刷新</button>
        <button type="button" class="btn btn-sm" :disabled="rebuilding" @click="onRebuild">
          {{ rebuilding ? '重建中…' : '重建边' }}
        </button>
      </div>
    </div>
    <p class="gloss-hint">
      SoT = 知识库业务术语（cat=term）；边从 refs_json 物化。OM Glossary 仅标准/指标镜像，不作业务术语写入口。
    </p>

    <div class="gloss-kpi">
      <div v-for="k in kpi" :key="k.label" class="gloss-kpi-item">
        <div class="gloss-kpi-val">{{ k.value }}</div>
        <div class="gloss-kpi-lab">{{ k.label }}</div>
        <div class="gloss-kpi-tip">{{ k.tip }}</div>
      </div>
    </div>

    <p v-if="err" class="tip">{{ err }}</p>
    <p v-else-if="loading" class="tip">加载术语图谱…</p>
    <div v-else-if="!(graph.nodes || []).length" class="kb-empty">
      暂无术语节点。请新建「业务术语」并填写指标/标准/同义词后点「重建边」。
    </div>
    <div v-else class="gloss-graph-wrap">
      <svg class="gloss-svg" viewBox="0 0 640 400" role="img" aria-label="术语图谱">
        <g v-for="(e, i) in edgePaths" :key="e.id || i">
          <path
            :d="e.d"
            fill="none"
            :stroke="e.broken ? 'var(--danger, #c44)' : 'var(--border, #c9d0da)'"
            stroke-width="1.5"
            :stroke-dasharray="e.broken ? '4 3' : undefined"
          />
          <text :x="e.mx" :y="e.my - 4" class="gloss-edge-lab">{{ e.label }}</text>
        </g>
        <g
          v-for="n in layout"
          :key="n.id"
          class="gloss-node"
          :class="n.kind"
          @click="onNodeClick(n)"
        >
          <circle :cx="n.x" :cy="n.y" r="22" />
          <text :x="n.x" :y="n.y + 4" text-anchor="middle">{{ (n.label || n.id || '').slice(0, 6) }}</text>
        </g>
      </svg>
      <ul class="gloss-legend">
        <li><span class="dot term" />术语</li>
        <li><span class="dot metric" />指标</li>
        <li><span class="dot standard" />标准</li>
        <li><span class="dot asset" />资产</li>
        <li><span class="dot label" />同义</li>
      </ul>
      <div
        v-if="stats?.uncoveredMetricCodes?.length"
        class="gloss-uncovered"
      >
        未挂术语的已启用指标（最多 20）：
        {{ stats.uncoveredMetricCodes.join(', ') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.gloss-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.gloss-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.gloss-title {
  font-weight: 600;
  font-size: 14px;
}
.gloss-actions {
  display: flex;
  gap: 8px;
}
.gloss-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary, #667);
}
.gloss-kpi {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.gloss-kpi-item {
  border: 1px solid var(--border, #e5e8ef);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--surface, #fff);
}
.gloss-kpi-val {
  font-size: 18px;
  font-weight: 650;
}
.gloss-kpi-lab {
  font-size: 12px;
  color: var(--text-secondary, #667);
}
.gloss-kpi-tip {
  font-size: 11px;
  color: var(--text-muted, #99a);
  margin-top: 2px;
}
.gloss-graph-wrap {
  border: 1px solid var(--border, #e5e8ef);
  border-radius: 10px;
  padding: 8px;
  background: var(--surface-2, #f7f8fb);
}
.gloss-svg {
  width: 100%;
  height: auto;
  max-height: 420px;
  display: block;
}
.gloss-node {
  cursor: pointer;
}
.gloss-node circle {
  fill: #eef2f8;
  stroke: #8a97ab;
  stroke-width: 1.5;
}
.gloss-node.term circle {
  fill: #ebe4ff;
  stroke: #7c5cbf;
}
.gloss-node.metric circle {
  fill: #e4f4ea;
  stroke: #3d9a6a;
}
.gloss-node.standard circle {
  fill: #fff0e0;
  stroke: #c47a2c;
}
.gloss-node.asset circle {
  fill: #e4eefc;
  stroke: #3b6fb6;
}
.gloss-node.label circle {
  fill: #f0f0f0;
  stroke: #888;
}
.gloss-node text,
.gloss-edge-lab {
  font-size: 10px;
  fill: var(--text, #223);
  pointer-events: none;
}
.gloss-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  font-size: 12px;
  color: var(--text-secondary, #667);
}
.gloss-legend .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
.gloss-legend .dot.term { background: #7c5cbf; }
.gloss-legend .dot.metric { background: #3d9a6a; }
.gloss-legend .dot.standard { background: #c47a2c; }
.gloss-legend .dot.asset { background: #3b6fb6; }
.gloss-legend .dot.label { background: #888; }
.gloss-uncovered {
  margin-top: 8px;
  font-size: 12px;
  color: var(--warning-text, #8a5a00);
}
@media (max-width: 900px) {
  .gloss-kpi {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
