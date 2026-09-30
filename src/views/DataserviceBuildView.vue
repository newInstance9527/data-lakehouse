<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ApiBuildWorkbench from '@/components/dataservice/ApiBuildWorkbench.vue'
import { useDataservice } from '@/composables/useDataservice'
import { useSession } from '@/composables/useSession'
import { pageGuideOf } from '@/data/pageGuides'
import '@/styles/dataservice-page.css'

const route = useRoute()
const router = useRouter()
const guide = pageGuideOf('dataservice-build')
const { ensureLoaded, apis } = useDataservice()
const { currentWs } = useSession()

onMounted(() => ensureLoaded(true))
watch(currentWs, () => {
  ensureLoaded(true).catch(() => {})
})

const editId = computed(() => {
  const id = route.params.id
  return id != null && id !== '' ? String(id) : ''
})

const seed = computed(() => {
  if (!editId.value) return null
  return (apis.value || []).find((a) => String(a.id) === editId.value) || null
})

function onClose() {
  router.push('/dataservice/apis')
}

function onPublish(row) {
  if (row?.id) {
    router.replace(`/dataservice/build/${row.id}`)
  }
  ensureLoaded(true)
}
</script>

<template>
  <div class="ds-page ds-build-page">
    <PageHeader
      page-id="dataservice-build"
      title="构建工作台"
      subtitle="SQL/脚本构建 · 试跑 · 保存 · 申请发布"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="router.push('/dataservice/apis')">API 目录</button>
      <button type="button" class="btn btn-sm" @click="router.push('/dataservice')">服务概览</button>
    </PageHeader>

    <ApiBuildWorkbench
      mode="page"
      :open="true"
      :edit-id="editId"
      :seed="seed"
      @close="onClose"
      @publish="onPublish"
    />
  </div>
</template>

<style scoped>
.ds-build-page {
  display: flex;
  flex-direction: column;
  /* 锁死可视高度，避免左侧表树撑开整页滚动 */
  height: calc(100vh - var(--header-h, 56px) - 60px);
  max-height: calc(100vh - var(--header-h, 56px) - 60px);
  overflow: hidden;
}
.ds-build-page :deep(.wb-page-root) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ds-build-page :deep(.wb.wb-page) {
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
}
</style>
