<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  focusId: { type: String, default: '' },
  highlightIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['select', 'open-asset', 'go', 'move'])

const NODE_W = 200
const NODE_H = 110
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.2

const el = ref(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const panning = ref(false)
const panDrag = ref(null)
const nodeDrag = ref(null)
const moved = ref(false)
const activeId = ref(null)
const popover = ref(null)
/** 本地拖动位置覆盖（id → {x,y}） */
const posOverrides = ref({})

const displayNodes = computed(() =>
  props.nodes.map((n) => {
    const ov = posOverrides.value[n.id]
    return ov ? { ...n, x: ov.x, y: ov.y } : n
  }),
)

const bounds = computed(() => {
  let maxX = 1600
  let maxY = 520
  displayNodes.value.forEach((n) => {
    maxX = Math.max(maxX, (n.x || 0) + NODE_W + 80)
    maxY = Math.max(maxY, (n.y || 0) + NODE_H + 80)
  })
  return { w: maxX, h: maxY }
})

const worldStyle = computed(() => ({
  width: bounds.value.w + 'px',
  height: bounds.value.h + 'px',
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

const hlSet = computed(() => new Set(props.highlightIds || []))

function isFocus(n) {
  if (!props.focusId) return !!n.focus
  return n.id === props.focusId || n.assetId === props.focusId || n.key === props.focusId
}

function isHl(n) {
  return isFocus(n) || hlSet.value.has(n.id) || hlSet.value.has(n.key) || hlSet.value.has(n.assetId)
}

function edgeHl(from, to) {
  if (!props.focusId) return false
  const a = displayNodes.value.find((n) => n.id === from)
  const b = displayNodes.value.find((n) => n.id === to)
  if (!a || !b) return false
  return isFocus(a) || isFocus(b) || isHl(a) || isHl(b)
}

function edgePath(from, to) {
  const a = displayNodes.value.find((n) => n.id === from)
  const b = displayNodes.value.find((n) => n.id === to)
  if (!a || !b) return ''
  const x1 = (a.x || 0) + NODE_W
  const y1 = (a.y || 0) + NODE_H / 2
  const x2 = b.x || 0
  const y2 = (b.y || 0) + NODE_H / 2
  const cx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
}

function clientToWorld(clientX, clientY) {
  const rect = el.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: (clientX - rect.left - panX.value) / zoom.value,
    y: (clientY - rect.top - panY.value) / zoom.value,
  }
}

function degree(nodeId) {
  let up = 0
  let down = 0
  props.edges.forEach((e) => {
    const s = Array.isArray(e) ? e[0] : e.from
    const t = Array.isArray(e) ? e[1] : e.to
    if (t === nodeId) up++
    if (s === nodeId) down++
  })
  return { up, down }
}

function layerText(n) {
  if (n.layer === 'report') return '报表'
  if (n.layer === 'metric') return '指标/API'
  if (n.layer === 'src') return 'L1源'
  return (n.layerLabel || n.layer || '').toUpperCase()
}

function layerClass(n) {
  if (n.type === 'report') return 'tag-purple'
  if (n.type === 'metric') return 'tag-red'
  const map = { ods: 'layer-ods', dwd: 'layer-dwd', dws: 'layer-dws', ads: 'layer-ads', dim: 'layer-dim', src: 'layer-ods' }
  return map[n.layer] || 'tag-blue'
}

function typeLabel(n) {
  return { table: '数据表', report: '报表', metric: '指标/API', src: '数据源' }[n.type] || '对象'
}

function typeMeta(n) {
  return { table: '📋 表', report: '📊 报表', metric: '🎯 指标', src: '🗂️ 源' }[n.type] || '对象'
}

function closePopover() {
  activeId.value = null
  popover.value = null
}

function showDetail(n, ev) {
  activeId.value = n.id
  emit('select', n)
  const d = degree(n.id)
  const rect = el.value?.getBoundingClientRect()
  const target = ev?.currentTarget || el.value?.querySelector?.(`.lineage-node[data-id="${n.id}"]`)
  const nr = target?.getBoundingClientRect?.()
  if (!rect || !nr) return
  let px = nr.right - rect.left + 10
  let flip = false
  if (px + 290 > rect.width) {
    px = nr.left - rect.left - 290
    flip = true
  }
  let py = nr.top - rect.top - 4
  if (py + 220 > rect.height) py = rect.height - 230
  if (py < 8) py = 8
  popover.value = {
    n,
    d,
    left: px,
    top: py,
    flip,
  }
}

function onPopoverAction() {
  const n = popover.value?.n
  if (!n) return
  closePopover()
  if (n.assetId) {
    emit('open-asset', n.assetId)
    return
  }
  if (n.type === 'metric') {
    emit('go', '/metrics')
    return
  }
  if (n.type === 'report') {
    emit('go', 'report')
    return
  }
  emit('go', '/integration')
}

function onWheel(ev) {
  ev.preventDefault()
  const delta = ev.deltaY > 0 ? -0.1 : 0.1
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(zoom.value + delta).toFixed(2)))
}

function onPointerDown(ev) {
  if (ev.button !== 0) return
  if (ev.target.closest?.('.lineage-node') || ev.target.closest?.('.lineage-popover') || ev.target.closest?.('.lineage-toolbar')) return
  panning.value = true
  moved.value = false
  panDrag.value = { x: ev.clientX, y: ev.clientY, ox: panX.value, oy: panY.value }
  closePopover()
  el.value?.setPointerCapture?.(ev.pointerId)
}

function onNodePointerDown(ev, n) {
  if (ev.button !== 0) return
  ev.stopPropagation()
  closePopover()
  const world = clientToWorld(ev.clientX, ev.clientY)
  const x = n.x || 0
  const y = n.y || 0
  nodeDrag.value = {
    id: n.id,
    node: n,
    startX: ev.clientX,
    startY: ev.clientY,
    offsetX: world.x - x,
    offsetY: world.y - y,
    moved: false,
  }
  moved.value = false
  el.value?.setPointerCapture?.(ev.pointerId)
}

function onPointerMove(ev) {
  if (nodeDrag.value) {
    const d = nodeDrag.value
    const dx = ev.clientX - d.startX
    const dy = ev.clientY - d.startY
    if (!d.moved && dx * dx + dy * dy > 16) {
      d.moved = true
      moved.value = true
    }
    if (d.moved) {
      const world = clientToWorld(ev.clientX, ev.clientY)
      const x = Math.max(0, world.x - d.offsetX)
      const y = Math.max(0, world.y - d.offsetY)
      posOverrides.value = { ...posOverrides.value, [d.id]: { x, y } }
      emit('move', d.id, x, y)
    }
    return
  }
  if (!panning.value || !panDrag.value) return
  const dx = ev.clientX - panDrag.value.x
  const dy = ev.clientY - panDrag.value.y
  if (Math.abs(dx) + Math.abs(dy) > 4) moved.value = true
  panX.value = panDrag.value.ox + dx
  panY.value = panDrag.value.oy + dy
}

function onPointerUp(ev) {
  if (nodeDrag.value) {
    const d = nodeDrag.value
    const wasMoved = d.moved
    nodeDrag.value = null
    try {
      el.value?.releasePointerCapture?.(ev.pointerId)
    } catch {
      /* ignore */
    }
    if (!wasMoved) {
      const live = displayNodes.value.find((n) => n.id === d.id) || d.node
      const nodeEl = el.value?.querySelector?.(`.lineage-node[data-id="${d.id}"]`)
      if (nodeEl) showDetail(live, { currentTarget: nodeEl })
      else showDetail(live, ev)
    }
    return
  }
  if (panning.value) {
    panning.value = false
    panDrag.value = null
    try {
      el.value?.releasePointerCapture?.(ev.pointerId)
    } catch {
      /* ignore */
    }
  }
}

function zoomBy(d) {
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(zoom.value + d).toFixed(2)))
}

function fit() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function resetPositions() {
  posOverrides.value = {}
}

onBeforeUnmount(() => {
  panning.value = false
  nodeDrag.value = null
  closePopover()
})

defineExpose({ zoomBy, fit, zoom, closePopover, resetPositions })
</script>

<template>
  <div
    ref="el"
    class="lineage-container"
    :class="{ dragging: panning || !!nodeDrag }"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="lineage-toolbar">
      <button type="button" class="lineage-zoom-btn" title="缩小" @click="zoomBy(-0.15)">−</button>
      <button type="button" class="lineage-zoom-btn" title="放大" @click="zoomBy(0.15)">+</button>
      <button type="button" class="lineage-zoom-btn" title="适应" style="font-size: 11px" @click="fit">⤢</button>
    </div>
    <div class="lineage-zoom-label">缩放 {{ Math.round(zoom * 100) }}%</div>
    <div class="lineage-hint">✋ 拖节点调整位置 · 拖空白平移 · 滚轮缩放 · 点击查看详情</div>

    <div class="lineage-graph" :style="worldStyle">
      <svg class="lineage-svg" :width="bounds.w" :height="bounds.h">
        <defs>
          <marker id="lin-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="#8c94a3" />
          </marker>
        </defs>
        <g marker-end="url(#lin-arr)">
          <path
            v-for="(e, i) in edges"
            :key="i"
            :d="edgePath(Array.isArray(e) ? e[0] : e.from, Array.isArray(e) ? e[1] : e.to)"
            class="lin-edge flow-h"
            :class="{ highlight: edgeHl(Array.isArray(e) ? e[0] : e.from, Array.isArray(e) ? e[1] : e.to) }"
          />
        </g>
      </svg>

      <div
        v-for="n in displayNodes"
        :key="n.id"
        class="lineage-node"
        :data-id="n.id"
        :class="[
          n.type,
          {
            focus: isFocus(n),
            highlight: isHl(n) && !isFocus(n),
            active: activeId === n.id,
            dragging: nodeDrag?.id === n.id,
          },
        ]"
        :style="{ left: (n.x || 0) + 'px', top: (n.y || 0) + 'px' }"
        @pointerdown="onNodePointerDown($event, n)"
      >
        <div class="ln-header">
          <span class="ln-layer-tag asset-layer" :class="layerClass(n)">{{ layerText(n) }}</span>
          <span class="ln-type-icon">{{ n.icon || '📋' }}</span>
        </div>
        <div class="ln-name">{{ n.name || n.fullName || n.key }}</div>
        <div class="ln-desc">{{ n.desc || '' }}</div>
        <div class="ln-meta">
          <span>{{ typeMeta(n) }}</span>
          <span>{{ n.type === 'src' ? '实时' : '98%可用' }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="popover"
      class="lineage-popover"
      :class="{ flip: popover.flip }"
      :style="{ left: popover.left + 'px', top: popover.top + 'px' }"
      @pointerdown.stop
      @click.stop
    >
      <div class="lp-top">
        <div class="lp-title-row">
          <span class="lp-icon">{{ popover.n.icon }}</span>
          <div>
            <div class="lp-name">{{ popover.n.name }}</div>
            <span class="ln-layer-tag asset-layer" :class="layerClass(popover.n)">{{ layerText(popover.n) }}</span>
          </div>
        </div>
        <button type="button" class="lp-close" @click="closePopover">×</button>
      </div>
      <div class="lp-desc">{{ popover.n.desc || '—' }}</div>
      
      <button type="button" class="btn btn-sm lp-action" @click="onPopoverAction">
        <template v-if="popover.n.assetId">查看完整资产详情 →</template>
      </button>
    </div>
  </div>
</template>

<style scoped>
.lineage-container {
  position: relative;
  background: linear-gradient(180deg, #f8fafe 0%, #eef2fb 100%);
  background-image: radial-gradient(circle at 1px 1px, rgba(30, 111, 255, 0.1) 1px, transparent 0);
  background-size: 22px 22px;
  border-radius: 0;
  min-height: 620px;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.lineage-container.dragging {
  cursor: grabbing;
}
.lineage-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 6px;
  z-index: 10;
}
.lineage-zoom-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--bg-1, #fff);
  border: 1px solid var(--border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--text-2);
}
.lineage-zoom-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.lineage-zoom-label {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  font-size: 11px;
  color: var(--text-2);
  background: var(--bg-1, #fff);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.lineage-hint {
  position: absolute;
  left: 16px;
  bottom: 12px;
  z-index: 6;
  font-size: 11px;
  color: var(--text-3);
  background: rgba(255, 255, 255, 0.7);
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid var(--border);
  pointer-events: none;
}
.lineage-graph {
  position: relative;
  will-change: transform;
}
.lineage-svg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  overflow: visible;
}
.lin-edge {
  fill: none;
  stroke: var(--border-dark, #c0c4cc);
  stroke-width: 1.5;
}
.lin-edge.highlight {
  stroke: var(--primary, #1e6fff);
  stroke-width: 2.5;
  filter: drop-shadow(0 0 4px rgba(30, 111, 255, 0.4));
}
.lin-edge.flow-h {
  stroke-dasharray: 6 4;
  animation: flow 1s linear infinite;
}
@keyframes flow {
  to {
    stroke-dashoffset: -20;
  }
}
.lineage-node {
  position: absolute;
  width: 200px;
  background: var(--bg-1, #fff);
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  cursor: grab;
  transition: border-color 0.2s, box-shadow 0.2s;
  z-index: 2;
  box-sizing: border-box;
}
.lineage-node:hover {
  border-color: var(--primary);
  box-shadow: 0 8px 24px rgba(30, 111, 255, 0.25);
  z-index: 5;
}
.lineage-node.dragging {
  cursor: grabbing;
  opacity: 0.95;
  z-index: 9;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
  transition: none;
}
.lineage-node.highlight {
  border-color: var(--primary);
  background: var(--primary-light, #e8f1ff);
}
.lineage-node.focus {
  border-color: var(--warning, #ffa940);
  box-shadow: 0 0 0 4px rgba(255, 169, 64, 0.2);
}
.lineage-node.report {
  border-color: #722ed1;
}
.lineage-node.metric {
  border-color: #eb2f96;
}
.lineage-node.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(30, 111, 255, 0.18), 0 8px 24px rgba(30, 111, 255, 0.25);
  z-index: 8;
}
.ln-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.ln-layer-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
}
.ln-type-icon {
  font-size: 14px;
}
.ln-name {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  word-break: break-all;
  line-height: 1.35;
}
.ln-desc {
  font-size: 10px;
  color: var(--text-3);
}
.ln-meta {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-3);
}
.lineage-popover {
  position: absolute;
  width: 280px;
  background: var(--bg-1, #fff);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
  padding: 14px;
  z-index: 50;
  cursor: default;
  animation: lp-in 0.15s ease-out;
}
.lineage-popover::before {
  content: '';
  position: absolute;
  left: -7px;
  top: 18px;
  width: 12px;
  height: 12px;
  background: var(--bg-1, #fff);
  border-left: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  transform: rotate(45deg);
}
.lineage-popover.flip::before {
  left: auto;
  right: -7px;
  transform: rotate(-135deg);
}
@keyframes lp-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.lp-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.lp-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lp-icon {
  font-size: 20px;
}
.lp-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}
.lp-close {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-3);
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
}
.lp-desc {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.5;
  margin-bottom: 10px;
}
.lp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  font-size: 11px;
  margin-bottom: 4px;
}
.lp-cell {
  padding: 6px 8px;
  background: var(--bg-2, #f5f5f5);
  border-radius: 6px;
}
.lp-k {
  color: var(--text-3);
  font-size: 10px;
}
.lp-v {
  font-weight: 600;
}
.lp-v.primary {
  color: var(--primary);
}
.lp-v.danger {
  color: var(--danger, #cf1322);
}
.lp-action {
  width: 100%;
  margin-top: 10px;
}
</style>
