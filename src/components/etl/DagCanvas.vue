<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { NODE_ICONS, NODE_STATUS_META, NODE_TYPES } from '@/data/etl'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  selectedEdgeIdx: { type: Number, default: null },
  connectFrom: { type: String, default: null },
})

const emit = defineEmits([
  'select-node',
  'select-edge',
  'clear',
  'move',
  'drop-type',
  'begin-connect',
  'complete-connect',
  'cancel-connect',
])

const NODE_W = 168
const NODE_H = 56
const MIN_ZOOM = 0.35
const MAX_ZOOM = 1.8

const canvasEl = ref(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const spaceDown = ref(false)
const panning = ref(false)
const nodeDrag = ref(null)
const panDrag = ref(null)

const bounds = computed(() => {
  let maxX = 1600
  let maxY = 900
  props.nodes.forEach((n) => {
    maxX = Math.max(maxX, n.x + NODE_W + 200)
    maxY = Math.max(maxY, n.y + NODE_H + 200)
  })
  return { w: maxX, h: maxY }
})

const worldStyle = computed(() => ({
  width: bounds.value.w + 'px',
  height: bounds.value.h + 'px',
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

function defOf(type) {
  return NODE_TYPES[type] || { label: type, color: '#8c8c8c', ports: [] }
}
function iconOf(type) {
  return NODE_ICONS[type] || '•'
}
function statusOf(st) {
  return NODE_STATUS_META[st] || NODE_STATUS_META.pending
}

function portPos(n, port) {
  if (port === 'out') return { x: n.x + NODE_W, y: n.y + NODE_H / 2 }
  return { x: n.x, y: n.y + NODE_H / 2 }
}

function edgePath(e) {
  const a = props.nodes.find((n) => n.id === e.from)
  const b = props.nodes.find((n) => n.id === e.to)
  if (!a || !b) return ''
  const p1 = portPos(a, 'out')
  const p2 = portPos(b, 'in')
  const dx = Math.max(40, (p2.x - p1.x) / 2)
  return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`
}

function clientToWorld(clientX, clientY) {
  const el = canvasEl.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  return {
    x: (clientX - rect.left - panX.value) / zoom.value,
    y: (clientY - rect.top - panY.value) / zoom.value,
  }
}

function onCanvasClick() {
  if (panDrag.value?.moved) return
  if (props.connectFrom) emit('cancel-connect')
  emit('clear')
}

function hasPort(n, port) {
  return (defOf(n.type).ports || []).includes(port)
}

function onNodeDown(n, ev) {
  if (ev.button === 1 || spaceDown.value) {
    ev.preventDefault()
    startPan(ev)
    return
  }
  if (ev.button !== 0) return
  ev.stopPropagation()

  // 连线模式：点击目标节点（含输入口）完成连线，不进入拖拽
  if (props.connectFrom) {
    if (props.connectFrom !== n.id && hasPort(n, 'in')) {
      emit('complete-connect', n.id)
    } else if (props.connectFrom === n.id) {
      // 再次点源节点：取消
      emit('cancel-connect')
    }
    return
  }

  emit('select-node', n.id)
  const startX = ev.clientX
  const startY = ev.clientY
  const ox = n.x
  const oy = n.y
  nodeDrag.value = { id: n.id, startX, startY, ox, oy, moved: false }

  const onMove = (e) => {
    if (!nodeDrag.value) return
    const dx = (e.clientX - nodeDrag.value.startX) / zoom.value
    const dy = (e.clientY - nodeDrag.value.startY) / zoom.value
    if (Math.abs(dx) + Math.abs(dy) > 2) nodeDrag.value.moved = true
    emit('move', nodeDrag.value.id, Math.round(nodeDrag.value.ox + dx), Math.round(nodeDrag.value.oy + dy))
  }
  const onUp = () => {
    nodeDrag.value = null
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onOutPort(n, ev) {
  ev.stopPropagation()
  ev.preventDefault()
  emit('begin-connect', n.id)
}

function onInPort(n, ev) {
  ev.stopPropagation()
  ev.preventDefault()
  if (props.connectFrom) {
    if (props.connectFrom !== n.id) emit('complete-connect', n.id)
    else emit('cancel-connect')
  } else {
    emit('select-node', n.id)
  }
}

function startPan(ev) {
  panning.value = true
  panDrag.value = {
    startX: ev.clientX,
    startY: ev.clientY,
    ox: panX.value,
    oy: panY.value,
    moved: false,
  }
  const onMove = (e) => {
    if (!panDrag.value) return
    const dx = e.clientX - panDrag.value.startX
    const dy = e.clientY - panDrag.value.startY
    if (Math.abs(dx) + Math.abs(dy) > 3) panDrag.value.moved = true
    panX.value = panDrag.value.ox + dx
    panY.value = panDrag.value.oy + dy
  }
  const onUp = () => {
    panning.value = false
    const moved = panDrag.value?.moved
    panDrag.value = moved ? { moved: true } : null
    // clear moved flag next tick so click can ignore
    setTimeout(() => {
      panDrag.value = null
    }, 0)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onCanvasDown(ev) {
  // 中键 / 空格+左键 / 左键点空白 → 平移
  const isPan =
    ev.button === 1 ||
    (ev.button === 0 && (spaceDown.value || ev.target === canvasEl.value || ev.target.classList?.contains('dag-world') || ev.target.classList?.contains('dag-edges') || ev.target.tagName === 'svg'))
  if (isPan) {
    ev.preventDefault()
    startPan(ev)
  }
}

function onDragOver(e) {
  e.preventDefault()
}

function onDrop(e) {
  e.preventDefault()
  const type = e.dataTransfer.getData('application/x-dag-type') || e.dataTransfer.getData('text/plain')
  if (!type || !NODE_TYPES[type]) return
  const w = clientToWorld(e.clientX, e.clientY)
  emit('drop-type', type, {
    x: Math.max(0, Math.round(w.x - NODE_W / 2)),
    y: Math.max(0, Math.round(w.y - NODE_H / 2)),
  })
}

function setZoomAt(next, clientX, clientY) {
  const el = canvasEl.value
  const z0 = zoom.value
  const z1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +next.toFixed(2)))
  if (z1 === z0) return
  if (el && clientX != null) {
    const rect = el.getBoundingClientRect()
    const cx = clientX - rect.left
    const cy = clientY - rect.top
    // 保持鼠标下的世界坐标不变
    const wx = (cx - panX.value) / z0
    const wy = (cy - panY.value) / z0
    zoom.value = z1
    panX.value = cx - wx * z1
    panY.value = cy - wy * z1
  } else {
    zoom.value = z1
  }
}

function zoomBy(delta) {
  const el = canvasEl.value
  if (!el) {
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(zoom.value + delta).toFixed(2)))
    return
  }
  const rect = el.getBoundingClientRect()
  setZoomAt(zoom.value + delta, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function onWheel(e) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.08 : 0.08
  setZoomAt(zoom.value + delta, e.clientX, e.clientY)
}

function onKeyDown(e) {
  if (e.key === 'Escape' && props.connectFrom) {
    emit('cancel-connect')
    return
  }
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
    spaceDown.value = true
    e.preventDefault()
  }
}
function onKeyUp(e) {
  if (e.code === 'Space') spaceDown.value = false
}

window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', onKeyUp)

onBeforeUnmount(() => {
  nodeDrag.value = null
  panDrag.value = null
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

defineExpose({ zoomBy, resetView, resetZoom: resetView, zoom, panX, panY })
</script>

<template>
  <div class="dag-canvas-wrap">
    <div
      ref="canvasEl"
      class="dag-canvas"
      :class="{ connecting: !!connectFrom, panning: panning || spaceDown }"
      @click="onCanvasClick"
      @mousedown="onCanvasDown"
      @wheel.prevent="onWheel"
      @dragover="onDragOver"
      @drop="onDrop"
      @auxclick.prevent
    >
      <div class="dag-world" :style="worldStyle">
        <svg class="dag-edges" :width="bounds.w" :height="bounds.h">
          <path
            v-for="(e, i) in edges"
            :key="i"
            class="dag-edge"
            :class="{ active: selectedEdgeIdx === i }"
            :d="edgePath(e)"
            @click.stop="emit('select-edge', i)"
            @mousedown.stop
          />
        </svg>

        <div
          v-for="n in nodes"
          :key="n.id"
          class="dag-node"
          :class="[
            defOf(n.type).cls,
            {
              selected: selectedId === n.id,
              'connect-from': connectFrom === n.id,
            },
          ]"
          :style="{ left: n.x + 'px', top: n.y + 'px', borderColor: defOf(n.type).color }"
          @mousedown="onNodeDown(n, $event)"
          @click.stop
        >
          <div
            v-if="(defOf(n.type).ports || []).includes('in')"
            class="d-port in"
            title="输入 · 点击完成连线"
            @mousedown.stop
            @click.stop.prevent="onInPort(n, $event)"
          />
          <div class="dag-node-body">
            <div class="dn-top">
              <span class="dn-icon">{{ iconOf(n.type) }}</span>
              <span class="dn-name">{{ n.name || defOf(n.type).label }}</span>
              <span class="dn-status" :style="{ background: statusOf(n.status).color }" :title="statusOf(n.status).label" />
            </div>
            <div class="dn-meta">{{ n.meta || defOf(n.type).label }}</div>
          </div>
          <div
            v-if="(defOf(n.type).ports || []).includes('out')"
            class="d-port out"
            title="输出 · 点击开始连线"
            @mousedown.stop
            @click.stop.prevent="onOutPort(n, $event)"
          />
        </div>
      </div>

      <div v-if="!nodes.length" class="dag-empty" @click.stop @mousedown.stop>
        从左侧拖入或点击算子开始编排
      </div>
      <div v-if="connectFrom" class="dag-connect-hint">
        连线中：点击目标节点或其输入端口完成（Esc / 点空白取消）
      </div>
      <div class="dag-view-hint">
        滚轮缩放 · 拖空白/中键/空格+拖 平移 · {{ Math.round(zoom * 100) }}%
      </div>
    </div>
  </div>
</template>
