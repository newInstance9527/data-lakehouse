<script setup>
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()

const icon = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
}
</script>

<template>
  <div class="toast-wrap">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="`toast-${t.type}`"
    >
      <span>{{ icon[t.type] || icon.info }}</span>
      <span style="flex: 1">{{ t.msg }}</span>
    </div>
  </div>
</template>
