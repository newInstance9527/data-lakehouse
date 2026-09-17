<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { NAV_GROUPS } from '@/config/nav'
import PageHeader from '@/components/common/PageHeader.vue'
import { pageGuideOf } from '@/data/pageGuides'

const route = useRoute()
const router = useRouter()

const meta = computed(() => {
  const id = route.meta?.id
  for (const g of NAV_GROUPS) {
    const item = g.items.find((x) => x.id === id)
    if (item) return { group: g.title, ...item }
  }
  return { group: '模块', label: id || '未命名', icon: '📦', path: route.path, id }
})

const guide = computed(() => pageGuideOf(meta.value.id || route.meta?.id))

const done = [
  'overview', 'catalog', 'datasource', 'standard', 'integration', 'lineage',
  'lifecycle', 'storage-trend', 'compliance', 'develop', 'query', 'publish',
  'quality', 'security', 'contract',
  'dataservice', 'metrics', 'export',
  'apply',
  'ops', 'linktrace', 'infra', 'rootcause', 'reliability', 'querygov',
  'workspace',
  'aiassistant', 'aimodel', 'knowledge',
]
</script>

<template>
  <div class="placeholder-page">
    <PageHeader
      :title="`${meta.icon || ''} ${meta.label}`"
      :subtitle="`${meta.group}`"
      :guide-title="guide.title"
      :guide="guide"
    >
      <button class="btn btn-sm" @click="router.push('/')">← 总览</button>
      <button class="btn btn-sm btn-primary" @click="router.push('/catalog')">资产目录</button>
    </PageHeader>

    <div class="card">
      <div class="card-header">
        <div class="card-title">进度</div>
        <span class="tag tag-orange">待开发</span>
      </div>
      <div class="card-body">
        <p>
          待开发中
        </p>
        <p style="margin-top: 10px">
          已完成：
          <span v-for="id in done" :key="id" class="tag tag-green module-chip">{{ id }}</span>
        </p>
        <p style="margin-top: 10px; color: var(--text-3); font-size: 12px">
          路由：<code>{{ route.path }}</code> · 模块 ID：<code>{{ meta.id || route.meta.id }}</code>
        </p>
      </div>
    </div>
  </div>
</template>
