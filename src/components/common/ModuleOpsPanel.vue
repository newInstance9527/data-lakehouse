<script setup>
import { onMounted, ref, watch } from 'vue'
import { fetchModuleOpsDetail } from '@/api/moduleOps'

const props = defineProps({
  /** catalog | quality | lineage */
  module: { type: String, required: true },
  /** 默认收起，避免占掉业务首屏 */
  defaultOpen: { type: Boolean, default: false },
})

const open = ref(!!props.defaultOpen)
const loading = ref(false)
const loaded = ref(false)
const data = ref(null)
const err = ref('')

async function load() {
  if (!props.module) return
  loading.value = true
  err.value = ''
  try {
    data.value = await fetchModuleOpsDetail(props.module)
    loaded.value = true
  } catch (e) {
    err.value = e.message || String(e)
    data.value = null
  } finally {
    loading.value = false
  }
}

async function toggle() {
  open.value = !open.value
  if (open.value && !loaded.value && !loading.value) {
    await load()
  }
}

watch(() => props.module, () => {
  loaded.value = false
  data.value = null
  if (open.value) load()
})

onMounted(() => {
  if (open.value) load()
})

defineExpose({ reload: load })
</script>

<template>
  <div class="mod-ops" :class="{ 'is-open': open }">
    <button type="button" class="mod-ops-toggle" @click="toggle">
      <span class="mod-ops-title">模块运维</span>
      <span v-if="data?.status" class="tag" :class="data.status === 'UP' ? 'tag-green' : 'tag-orange'">
        {{ data.status }}
      </span>
      <span class="mod-ops-hint muted">{{ open ? '收起' : '连接 / 探活（按需展开）' }}</span>
      <span class="mod-ops-chevron">{{ open ? '▾' : '▸' }}</span>
    </button>
    <div v-if="open" class="mod-ops-body">
      <div class="mod-ops-actions">
        <button type="button" class="btn btn-sm" :disabled="loading" @click="load">刷新</button>
      </div>
      <div v-if="err" class="mod-ops-err">{{ err }}</div>
      <div v-else-if="loading && !data" class="muted">加载中…</div>
      <template v-else-if="data">
        <div class="mod-ops-meta muted">
          {{ data.name }} · SoT {{ data.runtime?.portalSoT || '—' }}
        </div>
        <div v-for="d in data.deps || []" :key="d.component" class="mod-ops-dep">
          <div class="mod-ops-dep-t">
            <strong>{{ d.label || d.component }}</strong>
            <span class="tag" :class="d.status === 'UP' ? 'tag-green' : 'tag-orange'">{{ d.status }}</span>
          </div>
          <div class="mod-ops-dep-b">
            <span v-if="d.url"><code>{{ d.url }}</code></span>
            <span v-if="d.vaultPath" class="muted">Vault {{ d.vaultPath }}</span>
            <span v-if="d.health?.error" class="mod-ops-err">{{ d.health.error }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.mod-ops {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-1);
  margin-bottom: 12px;
  overflow: hidden;
}
.mod-ops-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
}
.mod-ops-title {
  font-weight: 600;
  font-size: 13px;
}
.mod-ops-hint {
  font-size: 11px;
  margin-left: auto;
}
.mod-ops-chevron {
  font-size: 12px;
  color: var(--text-3);
}
.mod-ops-body {
  padding: 0 12px 10px;
  border-top: 1px solid var(--border);
}
.mod-ops-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
.mod-ops-meta {
  font-size: 12px;
  margin: 6px 0 8px;
}
.mod-ops-dep {
  padding: 6px 0;
  border-top: 1px solid var(--border);
  font-size: 12px;
}
.mod-ops-dep-t {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mod-ops-dep-b {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
  color: var(--text-2);
}
.mod-ops-err {
  color: var(--danger);
  font-size: 12px;
}
.muted {
  color: var(--text-3);
}
</style>
