<script setup>
import { computed } from 'vue'
import { dsTypeIconLabel, resolveDsTypeIconUrl } from '@/data/dsTypeIcons'

const props = defineProps({
  /** 类型展示名，如 MySQL */
  type: { type: String, default: '' },
  /** 后端 typeCode，如 mysql */
  typeCode: { type: String, default: '' },
  /** 边长 px */
  size: { type: [Number, String], default: 20 },
})

const src = computed(() => resolveDsTypeIconUrl(props.type, props.typeCode))
const label = computed(() => dsTypeIconLabel(props.type || props.typeCode))
const px = computed(() => {
  const n = Number(props.size)
  return Number.isFinite(n) && n > 0 ? n : 20
})
</script>

<template>
  <img
    class="ds-type-icon"
    :src="src"
    :alt="label"
    :title="label"
    :width="px"
    :height="px"
    draggable="false"
  />
</template>

<style scoped>
.ds-type-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  object-fit: contain;
  /* 官方 logo 自带品牌色；浅色底上更清晰 */
  pointer-events: none;
}
</style>
