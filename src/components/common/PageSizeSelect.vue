<script setup>
import { PAGE_SIZE_OPTIONS } from '@/config/pagination'

defineProps({
  modelValue: { type: Number, required: true },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <select
    class="select input-sm"
    :value="modelValue"
    @change="$emit('update:modelValue', Number($event.target.value))"
  >
    <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }} / 页</option>
  </select>
</template>
