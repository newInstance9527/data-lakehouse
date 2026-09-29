<script setup>
import PageSizeSelect from '@/components/common/PageSizeSelect.vue'
import { t, useLocale } from '@/composables/useLocale'

defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  total: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  pageNums: { type: Array, default: () => [] },
  pageCount: { type: Number, default: 0 },
})

const emit = defineEmits(['update:page', 'update:pageSize', 'go'])
useLocale()

function onSize(n) {
  emit('update:pageSize', n)
  emit('go', 1)
}

function go(p) {
  emit('update:page', p)
  emit('go', p)
}
</script>

<template>
  <div v-if="total > 0" class="ds-pager">
    <div class="ds-pager-info">
      {{
        t('common.pager.info', {
          page,
          totalPages,
          pageCount,
          total,
        })
      }}
    </div>
    <div class="ds-pager-controls">
      <PageSizeSelect :model-value="pageSize" @update:model-value="onSize" />
      <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="go(page - 1)">
        {{ t('common.prev') }}
      </button>
      <template v-for="(n, i) in pageNums" :key="n">
        <span v-if="i > 0 && n - pageNums[i - 1] > 1" class="ds-pager-ellipsis">…</span>
        <button
          type="button"
          class="btn btn-sm"
          :class="{ 'btn-primary': n === page }"
          @click="go(n)"
        >{{ n }}</button>
      </template>
      <button type="button" class="btn btn-sm" :disabled="page >= totalPages" @click="go(page + 1)">
        {{ t('common.next') }}
      </button>
    </div>
  </div>
</template>
