<script setup>
import { computed, ref, watch } from 'vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import { fetchKbEntry, rebuildKbIndex } from '@/api/ai'
import { KB_CATS } from '@/data/knowledge'
import { useToast } from '@/composables/useToast'
import { confirmDelete } from '@/composables/useConfirmDelete'

const props = defineProps({
  open: { type: Boolean, default: false },
  entryId: { type: String, default: '' },
  /** 是否允许编辑/删除 */
  canWrite: { type: Boolean, default: true },
})

const emit = defineEmits(['close', 'edit', 'deleted', 'updated'])
const { showToast } = useToast()

const loading = ref(false)
const rebuilding = ref(false)
const deleting = ref(false)
const loadError = ref('')
const detail = ref(null)

const CAT_LABEL = Object.fromEntries(KB_CATS.filter((c) => c.id !== 'all').map((c) => [c.id, c.name]))

const STATUS_LABEL = {
  ready: '已索引',
  indexing: '索引中',
  failed: '索引失败',
}

const INDEX_MODE_LABEL = {
  keyword: '关键词',
  hybrid: '混合（关键词+向量）',
  none: '未写入向量',
}

const chunks = computed(() => {
  const list = detail.value?.chunks
  if (!Array.isArray(list)) return []
  return [...list].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
})

const catLabel = computed(() => {
  const cat = detail.value?.cat
  return CAT_LABEL[cat] || cat || '—'
})

const statusLabel = computed(() => {
  const s = detail.value?.status
  return STATUS_LABEL[s] || s || '—'
})

const bodyText = computed(() => {
  const d = detail.value
  if (!d) return ''
  return String(d.body || d.desc || '').trim()
})

async function load() {
  const id = props.entryId
  if (!props.open || !id) return
  loading.value = true
  loadError.value = ''
  try {
    detail.value = await fetchKbEntry(id)
  } catch (e) {
    detail.value = null
    loadError.value = e?.message || '加载失败'
    showToast(loadError.value, 'warning')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.entryId],
  ([open]) => {
    if (open) load()
    else {
      detail.value = null
      loadError.value = ''
    }
  },
)

function close() {
  emit('close')
}

function onEdit() {
  if (!props.canWrite) {
    showToast('当前无编辑权限', 'warning')
    return
  }
  if (!detail.value?.id) {
    showToast(loading.value ? '条目加载中，请稍后再编辑' : '无法编辑：条目未加载', 'warning')
    return
  }
  emit('edit', detail.value)
}

async function onDelete() {
  if (!detail.value?.id || deleting.value) return
  const ok = await confirmDelete({
    title: `删除知识条目「${detail.value.title || detail.value.id}」`,
    message: '将删除条目及其分片索引，AI 引用将不再命中该文档。',
    confirmLabel: '确认删除',
  })
  if (!ok) return
  deleting.value = true
  try {
    emit('deleted', detail.value.id)
  } finally {
    deleting.value = false
  }
}

async function onRebuild() {
  if (!detail.value?.id || rebuilding.value) return
  rebuilding.value = true
  try {
    await rebuildKbIndex(detail.value.id)
    showToast('已触发重建索引', 'success')
    await load()
    emit('updated', detail.value)
  } catch (e) {
    showToast(e?.message || '重建索引失败', 'error')
  } finally {
    rebuilding.value = false
  }
}

function statusTagClass(status) {
  if (status === 'ready') return 'tag-green'
  if (status === 'failed') return 'tag-red'
  if (status === 'indexing') return 'tag-orange'
  return ''
}

defineExpose({ reload: load })
</script>

<template>
  <AppDrawer
    :open="open && !!entryId"
    :default-width="640"
    :min-width="460"
    storage-key="drawer-width-knowledge-detail"
    @close="close"
  >
    <div class="drawer-header">
      <div style="flex: 1; min-width: 0">
        <div class="drawer-title">
          {{ loading ? '加载中…' : detail?.title || '知识条目' }}
        </div>
        <div class="drawer-subtitle">
          <template v-if="detail">
            {{ catLabel }} · {{ statusLabel }}
            <template v-if="detail.indexMode">
              · {{ INDEX_MODE_LABEL[detail.indexMode] || detail.indexMode }}
            </template>
          </template>
          <template v-else-if="entryId">{{ entryId }}</template>
        </div>
      </div>
      <div class="kb-detail-actions">
        <button
          v-if="detail && canWrite"
          type="button"
          class="btn btn-sm btn-primary"
          @click="onEdit"
        >✎ 编辑</button>
        <button
          v-if="detail && canWrite"
          type="button"
          class="btn btn-sm"
          style="color: var(--danger)"
          :disabled="deleting"
          @click="onDelete"
        >删除</button>
        <button type="button" class="btn btn-sm" @click="close">✕</button>
      </div>
    </div>

    <div class="drawer-body">
      <p v-if="loadError" class="kb-detail-tip warn">{{ loadError }}</p>
      <template v-else-if="loading && !detail">
        <p class="kb-detail-tip">加载条目详情…</p>
      </template>
      <template v-else-if="detail">
        <div class="detail-section-title">概览</div>
        <div class="info-grid kb-detail-meta">
          <div>
            <div class="info-label">分类</div>
            <div class="info-value">{{ catLabel }}</div>
          </div>
          <div>
            <div class="info-label">状态</div>
            <div class="info-value">
              <span class="tag" :class="statusTagClass(detail.status)">{{ statusLabel }}</span>
            </div>
          </div>
          <div>
            <div class="info-label">索引模式</div>
            <div class="info-value">
              {{ detail.indexMode ? (INDEX_MODE_LABEL[detail.indexMode] || detail.indexMode) : '—' }}
            </div>
          </div>
          <div>
            <div class="info-label">来源</div>
            <div class="info-value">
              {{ detail.source === 'upload' ? `文档 ${detail.fileName || ''}`.trim() : '手动录入' }}
            </div>
          </div>
          <div>
            <div class="info-label">分片数</div>
            <div class="info-value">{{ detail.chunkCount ?? chunks.length }}</div>
          </div>
          <div>
            <div class="info-label">引用次数</div>
            <div class="info-value">{{ detail.citeCnt ?? 0 }}</div>
          </div>
        </div>

        <p v-if="detail.indexError" class="kb-detail-tip warn">
          索引错误：{{ detail.indexError }}
        </p>

        <div class="detail-section-title kb-body-head">
          <span>正文</span>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="rebuilding"
            @click="onRebuild"
          >
            {{ rebuilding ? '重建中…' : '重建索引' }}
          </button>
        </div>
        <div class="kb-detail-body">
          <pre v-if="bodyText" class="kb-detail-pre">{{ bodyText }}</pre>
          <p v-else class="kb-detail-tip">暂无正文</p>
        </div>

        <div class="detail-section-title kb-chunk-head">
          <span>分片分段</span>
          <span class="kb-chunk-count">{{ chunks.length }} 片</span>
        </div>

        <div v-if="!chunks.length" class="kb-chunk-empty">
          <p class="kb-detail-tip">尚无分片，可重建索引</p>
        </div>
        <div v-else class="kb-chunk-list">
          <div v-for="c in chunks" :key="c.id || `ord-${c.ordinal}`" class="kb-chunk-item">
            <div class="kb-chunk-bar">
              <span class="kb-chunk-ord">#{{ c.ordinal ?? '—' }}</span>
              <span class="kb-chunk-tok">≈ {{ c.tokenEst ?? '—' }} tokens</span>
            </div>
            <pre class="kb-chunk-text">{{ c.text || '（空）' }}</pre>
          </div>
        </div>
      </template>
    </div>
  </AppDrawer>
</template>

<style scoped>
.kb-scope-tag {
  display: inline-block;
  margin-right: 6px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--primary-light);
  color: var(--primary);
  vertical-align: middle;
}
.kb-detail-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.kb-detail-meta {
  margin: 10px 0 18px;
}
.kb-detail-tip {
  font-size: 12px;
  color: var(--text-3);
  margin: 0 0 12px;
}
.kb-detail-tip.warn {
  color: var(--danger);
}
.kb-detail-body {
  margin: 10px 0 20px;
}
.kb-detail-pre {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-2);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  color: var(--text-1);
  max-height: 280px;
  overflow: auto;
}
.kb-body-head,
.kb-chunk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}
.kb-chunk-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
}
.kb-chunk-empty {
  margin-top: 10px;
  padding: 16px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--bg-2);
  text-align: center;
}
.kb-chunk-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.kb-chunk-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-1);
  overflow: hidden;
}
.kb-chunk-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-3);
}
.kb-chunk-ord {
  font-weight: 600;
  color: var(--primary);
}
.kb-chunk-text {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  color: var(--text-1);
  max-height: 160px;
  overflow: auto;
}
</style>
