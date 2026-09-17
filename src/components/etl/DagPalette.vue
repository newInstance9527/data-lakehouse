<script setup>
import { computed, ref } from 'vue'
import { NODE_GROUPS, NODE_ICONS, NODE_TYPES } from '@/data/etl'

const props = defineProps({
  kw: { type: String, default: '' },
})
const emit = defineEmits(['add'])

const localKw = ref('')

const keyword = computed(() => (props.kw || localKw.value).trim().toLowerCase())

const sections = computed(() =>
  NODE_GROUPS.map((g) => {
    const items = Object.entries(NODE_TYPES)
      .filter(([, def]) => def.group === g.key)
      .filter(([type, def]) => {
        const q = keyword.value
        if (!q) return true
        return type.includes(q) || def.label.toLowerCase().includes(q)
      })
      .map(([type, def]) => ({ type, ...def, icon: NODE_ICONS[type] || '•' }))
    return { ...g, items }
  }).filter((s) => s.items.length),
)

function onDragStart(e, type) {
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('application/x-dag-type', type)
  e.dataTransfer.setData('text/plain', type)
}
</script>

<template>
  <div class="dag-palette">
    <div class="dag-palette-search">
      <input v-model="localKw" class="input input-sm" placeholder="搜索算子…" />
    </div>
    <div class="dag-palette-scroll">
      <div v-for="sec in sections" :key="sec.key" class="palette-section">
        <div class="palette-sec-title">{{ sec.label }}</div>
        <button
          v-for="item in sec.items"
          :key="item.type"
          type="button"
          class="palette-node"
          :class="item.cls"
          draggable="true"
          :title="`点击或拖拽添加 · ${item.type}`"
          @dragstart="onDragStart($event, item.type)"
          @click="emit('add', item.type)"
        >
          <span class="pn-dot" :style="{ background: item.color }" />
          <span class="pn-icon">{{ item.icon }}</span>
          <span class="pn-name">{{ item.label }}</span>
        </button>
      </div>
      <div v-if="!sections.length" class="palette-empty">无匹配算子</div>
    </div>
  </div>
</template>
