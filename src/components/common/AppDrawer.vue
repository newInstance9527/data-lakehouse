<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 默认宽度 px */
  defaultWidth: { type: Number, default: 640 },
  minWidth: { type: Number, default: 420 },
  maxWidthRatio: { type: Number, default: 0.92 },
  storageKey: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const width = ref(props.defaultWidth)
const dragging = ref(false)

function loadWidth() {
  if (!props.storageKey) {
    width.value = props.defaultWidth
    return
  }
  try {
    const saved = Number(localStorage.getItem(props.storageKey))
    if (saved && saved >= props.minWidth) width.value = saved
    else width.value = props.defaultWidth
  } catch {
    width.value = props.defaultWidth
  }
}

function clampWidth(w) {
  const max = Math.floor(window.innerWidth * props.maxWidthRatio)
  return Math.min(max, Math.max(props.minWidth, Math.round(w)))
}

function saveWidth() {
  if (!props.storageKey) return
  try {
    localStorage.setItem(props.storageKey, String(width.value))
  } catch {
    /* ignore */
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) loadWidth()
  },
  { immediate: true },
)

function onMove(e) {
  if (!dragging.value) return
  width.value = clampWidth(window.innerWidth - e.clientX)
}

function stopDrag() {
  if (!dragging.value) return
  dragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', stopDrag)
  saveWidth()
}

function startDrag(e) {
  e.preventDefault()
  dragging.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', stopDrag)
}

onBeforeUnmount(stopDrag)

function close() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="drawer-mask"
      :class="{ 'is-dragging': dragging }"
      @click.self="close"
    />
    <aside
      v-if="open"
      class="drawer"
      :class="{ 'is-dragging': dragging }"
      :style="{ width: width + 'px' }"
    >
      <div
        class="drawer-resizer"
        title="拖动调整宽度"
        @mousedown="startDrag"
      />
      <slot />
    </aside>
  </Teleport>
</template>
