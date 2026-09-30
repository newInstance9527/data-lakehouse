<script setup>
import { computed, ref, watch } from 'vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import { fetchDataapiOpenapi } from '@/api/dataapi'
import { useToast } from '@/composables/useToast'
import {
  apiDocToHtmlDocument,
  apiDocToMarkdown,
  buildApiDocModel,
  downloadApiDoc,
  downloadJson,
} from '@/utils/apiDocExport'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 门户 API 详情卡（含 params / responses） */
  detail: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const { showToast } = useToast()
const loading = ref(false)
const openapi = ref(null)
const previewMode = ref('html') // html | markdown
const loadError = ref('')

const model = computed(() => buildApiDocModel(props.detail || {}, openapi.value))
const markdown = computed(() => apiDocToMarkdown(model.value))
const htmlDoc = computed(() => apiDocToHtmlDocument(model.value))
const htmlPreviewSrc = computed(() => {
  // srcdoc 预览完整 HTML 文档
  return htmlDoc.value
})

watch(
  () => [props.open, props.detail?.id],
  async ([open, id]) => {
    if (!open) return
    loadError.value = ''
    openapi.value = null
    if (!id) {
      // 无 id 仍可用 detail 生成文档
      return
    }
    loading.value = true
    try {
      openapi.value = await fetchDataapiOpenapi({ id })
    } catch (e) {
      loadError.value = e?.message || String(e)
      // 仍可用 detail 降级生成
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

function close() {
  emit('close')
}

function fileBase() {
  const d = props.detail || {}
  return `${d.method || 'API'}_${(d.path || d.name || 'doc').replace(/[\\/:*?"<>|]+/g, '_')}`
}

function onDownload(fmt) {
  try {
    downloadApiDoc(model.value, fmt, { basename: fileBase() })
    const label = { html: 'HTML', word: 'Word', markdown: 'Markdown' }[fmt] || fmt
    showToast(`已下载 ${label} 文档`, 'success')
  } catch (e) {
    showToast(`下载失败：${e?.message || e}`, 'warning')
  }
}

function onDownloadOpenapi() {
  try {
    if (!openapi.value) {
      showToast('OpenAPI 尚未加载，请稍后重试', 'warning')
      return
    }
    downloadJson(openapi.value, `${fileBase()}.openapi.json`)
    showToast('已下载 OpenAPI JSON', 'success')
  } catch (e) {
    showToast(`下载失败：${e?.message || e}`, 'warning')
  }
}
</script>

<template>
  <AppDrawer
    :open="open"
    storage-key="dataservice-api-doc-width"
    :default-width="720"
    @close="close"
  >
    <div v-if="detail" class="drawer-body api-doc-drawer">
      <div class="detail-head">
        <div>
          <div class="detail-title">API 文档</div>
          <div class="tip">
            <span class="ac-method" :class="detail.method">{{ detail.method }}</span>
            {{ detail.name || detail.path }}
          </div>
        </div>
        <button type="button" class="btn btn-sm" @click="close">✕</button>
      </div>

      <div class="api-doc-toolbar">
        <div class="api-doc-preview-tabs">
          <button
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-primary': previewMode === 'html' }"
            @click="previewMode = 'html'"
          >
            HTML 预览
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-primary': previewMode === 'markdown' }"
            @click="previewMode = 'markdown'"
          >
            Markdown
          </button>
        </div>
        <div class="api-doc-downloads">
          <button type="button" class="btn btn-sm btn-primary" :disabled="loading" @click="onDownload('html')">
            下载 HTML
          </button>
          <button type="button" class="btn btn-sm" :disabled="loading" @click="onDownload('word')">
            下载 Word
          </button>
          <button type="button" class="btn btn-sm" :disabled="loading" @click="onDownload('markdown')">
            下载 Markdown
          </button>
          <button type="button" class="btn btn-sm" :disabled="loading || !openapi" @click="onDownloadOpenapi">
            OpenAPI JSON
          </button>
        </div>
      </div>

      <p v-if="loading" class="tip">正在加载 OpenAPI 规格…</p>
      <p v-else-if="loadError" class="tip api-doc-warn">
        OpenAPI 拉取失败（{{ loadError }}），已用详情字段生成文档
      </p>

      <div class="api-doc-preview">
        <iframe
          v-if="previewMode === 'html'"
          class="api-doc-iframe"
          title="API 文档预览"
          :srcdoc="htmlPreviewSrc"
        />
        <pre v-else class="api-doc-md">{{ markdown }}</pre>
      </div>
    </div>
  </AppDrawer>
</template>

<style scoped>
.api-doc-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.api-doc-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.api-doc-preview-tabs,
.api-doc-downloads {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.api-doc-preview {
  flex: 1;
  min-height: 360px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-1);
}
.api-doc-iframe {
  width: 100%;
  height: min(70vh, 720px);
  border: 0;
  background: #fff;
}
.api-doc-md {
  margin: 0;
  padding: 14px 16px;
  height: min(70vh, 720px);
  overflow: auto;
  font-size: 12px;
  line-height: 1.55;
  font-family: ui-monospace, Consolas, Monaco, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}
.api-doc-warn {
  color: var(--warning, #d48806);
}
.detail-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.detail-title {
  font-size: 16px;
  font-weight: 650;
}
.ac-method {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 6px;
}
</style>
