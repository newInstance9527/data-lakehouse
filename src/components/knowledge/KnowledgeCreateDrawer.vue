<script setup>
import { computed, reactive, ref, watch } from 'vue'
import AppDrawer from '@/components/common/AppDrawer.vue'
import { useToast } from '@/composables/useToast'
import {
  KB_CHUNK_SEPARATORS,
  KB_CHUNK_STRATEGIES,
  KB_EMBED_MODELS,
  KB_FORM_CATS,
  KB_UPLOAD_ACCEPT,
  KB_UPLOAD_EXT,
  estimateCharsFromFile,
  estimateChunkCount,
  formatFileSize,
} from '@/data/knowledge'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 编辑时传入条目详情（含 id / body / cat 等） */
  entry: { type: Object, default: null },
  /** workspace | platform */
  scope: { type: String, default: 'workspace' },
  /** 父组件入库/解析中 */
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'submit'])
const { showToast } = useToast()

const fileInput = ref(null)
const selectedFile = ref(null)
const dragOver = ref(false)
const chunkAdvanced = ref(true)

const isEdit = computed(() => !!props.entry?.id)

const form = reactive({
  title: '',
  cat: 'FAQ',
  rel: '',
  source: 'manual', // manual | upload
  body: '',
  fileName: '',
  fileSize: 0,
  estChars: 0,
  strategy: 'fixed',
  chunkSize: 500,
  overlap: 50,
  separator: '\n\n',
  customSep: '',
  embedModel: 'bge-small-zh',
})

function formCatFromApi(cat) {
  const hit = KB_FORM_CATS.find((c) => c.cat === cat)
  return hit?.value || 'FAQ'
}

function relFromEntry(entry) {
  const refs = entry?.refs
  if (refs && typeof refs === 'object') {
    return refs.note || refs.link || refs.metricCode || refs.asset || ''
  }
  if (typeof entry?.refsJson === 'string') {
    try {
      const o = JSON.parse(entry.refsJson)
      return o?.note || o?.link || ''
    } catch {
      return ''
    }
  }
  return ''
}

function resetForm() {
  form.title = ''
  form.cat = 'FAQ'
  form.rel = ''
  form.source = 'manual'
  form.body = ''
  form.fileName = ''
  form.fileSize = 0
  form.estChars = 0
  form.strategy = 'fixed'
  form.chunkSize = 500
  form.overlap = 50
  form.separator = '\n\n'
  form.customSep = ''
  form.embedModel = 'bge-small-zh'
  chunkAdvanced.value = true
  dragOver.value = false
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function fillFromEntry(entry) {
  resetForm()
  if (!entry) return
  form.title = entry.title || ''
  form.cat = formCatFromApi(entry.cat)
  form.rel = relFromEntry(entry)
  form.source = entry.source === 'upload' ? 'upload' : 'manual'
  form.body = entry.body || entry.desc || ''
  form.fileName = entry.fileName || ''
  form.strategy = entry.strategy || 'fixed'
  form.chunkSize = entry.chunkSize ?? 500
  form.overlap = entry.overlap ?? 50
  const sep = entry.separator
  if (sep != null && sep !== '' && !KB_CHUNK_SEPARATORS.some((s) => s.value === sep && s.value !== 'custom')) {
    form.separator = 'custom'
    form.customSep = sep
  } else {
    form.separator = sep || '\n\n'
  }
  form.embedModel = entry.embedModelId || entry.embedModel || 'bge-small-zh'
  if (form.source === 'upload') chunkAdvanced.value = true
}

watch(
  () => [props.open, props.entry?.id],
  ([open]) => {
    if (!open) return
    if (props.entry?.id) fillFromEntry(props.entry)
    else resetForm()
  },
)

const contentChars = computed(() => {
  if (form.source === 'upload') return form.estChars
  return String(form.body || '').length
})

const estimatedChunks = computed(() =>
  estimateChunkCount(contentChars.value, form.chunkSize, form.overlap),
)

const showSeparator = computed(() => form.strategy === 'fixed')

function close() {
  emit('close')
}

function setSource(src) {
  form.source = src
  if (src === 'upload') chunkAdvanced.value = true
}

function pickFile() {
  fileInput.value?.click()
}

function applyFile(file) {
  if (!file) return
  const ext = String(file.name || '')
    .split('.')
    .pop()
    ?.toLowerCase()
  if (!ext || !KB_UPLOAD_EXT.has(ext)) {
    showToast('仅支持 pdf / docx / md / txt / html', 'warning')
    return
  }
  form.fileName = file.name
  form.fileSize = file.size || 0
  form.estChars = estimateCharsFromFile(file)
  selectedFile.value = file
  if (!form.title.trim()) {
    form.title = file.name.replace(/\.[^.]+$/, '')
  }
}

function onFileChange(e) {
  const file = e.target?.files?.[0]
  applyFile(file)
}

function onDrop(e) {
  e.preventDefault()
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  applyFile(file)
}

function clearFile() {
  form.fileName = ''
  form.fileSize = 0
  form.estChars = 0
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function validate() {
  if (!form.title.trim()) {
    showToast('请填写标题', 'warning')
    return false
  }
  if (form.source === 'manual') {
    if (!String(form.body || '').trim()) {
      showToast('请填写正文', 'warning')
      return false
    }
  } else if (!selectedFile.value && !isEdit.value) {
    showToast('请上传文档', 'warning')
    return false
  } else if (!selectedFile.value && isEdit.value && !form.fileName) {
    showToast('请上传文档', 'warning')
    return false
  }
  const size = Number(form.chunkSize) || 0
  const ov = Number(form.overlap) || 0
  if (size < 50) {
    showToast('分片大小至少 50', 'warning')
    return false
  }
  if (ov >= size) {
    showToast('重叠长度须小于分片大小', 'warning')
    return false
  }
  return true
}

function submit() {
  if (!validate() || props.saving) return
  const sep =
    form.separator === 'custom' ? form.customSep || '' : form.separator
  const isUpload = form.source === 'upload'
  if (isUpload && !selectedFile.value && !isEdit.value) {
    showToast('请上传文档', 'warning')
    return
  }
  if (isUpload && selectedFile.value) {
    // 走后端真实解析；禁止用文件名占位正文
    emit('submit', {
      id: props.entry?.id || undefined,
      title: form.title.trim(),
      cat: form.cat,
      rel: form.rel.trim(),
      source: 'upload',
      file: selectedFile.value,
      fileName: form.fileName || selectedFile.value.name,
      fileSize: form.fileSize,
      estChars: contentChars.value,
      strategy: form.strategy,
      chunkSize: Number(form.chunkSize) || 500,
      overlap: Number(form.overlap) || 0,
      separator: sep,
      embedModel: form.embedModel,
      chunks: estimatedChunks.value,
      scope: props.entry?.scope || props.scope || 'workspace',
    })
    return
  }
  // 手动录入，或编辑上传条目但未换文件（仅改分片/标题等）
  const body = form.source === 'manual' ? form.body.trim() : form.body.trim()
  if (form.source === 'upload' && !body) {
    showToast('请重新选择文档以解析正文，或改为手动录入', 'warning')
    return
  }
  emit('submit', {
    id: props.entry?.id || undefined,
    title: form.title.trim(),
    cat: form.cat,
    rel: form.rel.trim(),
    source: form.source,
    body,
    fileName: form.fileName || '',
    fileSize: form.fileSize,
    estChars: contentChars.value,
    strategy: form.strategy,
    chunkSize: Number(form.chunkSize) || 500,
    overlap: Number(form.overlap) || 0,
    separator: sep,
    embedModel: form.embedModel,
    chunks: estimatedChunks.value,
    scope: props.entry?.scope || props.scope || 'workspace',
  })
}
</script>

<template>
  <AppDrawer
    :open="open"
    :default-width="560"
    :min-width="440"
    storage-key="drawer-width-knowledge-create"
    @close="close"
  >
    <div class="drawer-header">
      <div style="flex: 1; min-width: 0">
        <div class="drawer-title">{{ isEdit ? '✎ 编辑知识条目' : '＋ 新建知识条目' }}</div>
        <div class="drawer-subtitle">
          {{ isEdit ? '修改正文或分片配置后将重新索引' : '短文本 / 文档上传 → 分片配置 → 入向量库' }}
        </div>
      </div>
      <button type="button" class="btn btn-sm" @click="close">✕</button>
    </div>

    <div class="drawer-body">
      <div class="detail-section-title">基础信息</div>
      <div class="kb-form-grid">
        <label class="form-field wide">
          <span class="form-label">标题 <em>*</em></span>
          <input v-model="form.title" class="input" placeholder="如 GMV 口径说明" />
        </label>
        <label class="form-field">
          <span class="form-label">分类</span>
          <select v-model="form.cat" class="input">
            <option v-for="c in KB_FORM_CATS" :key="c.value" :value="c.value">{{ c.value }}</option>
          </select>
        </label>
        <label class="form-field">
          <span class="form-label">关联资产/指标</span>
          <input v-model="form.rel" class="input" placeholder="逗号分隔，可选" />
        </label>
      </div>

      <div class="detail-section-title">内容来源</div>
      <div class="kb-source-tabs">
        <button
          type="button"
          class="kb-source-tab"
          :class="{ active: form.source === 'manual' }"
          @click="setSource('manual')"
        >
          ✍️ 手动录入
        </button>
        <button
          type="button"
          class="kb-source-tab"
          :class="{ active: form.source === 'upload' }"
          @click="setSource('upload')"
        >
          📄 文档上传
        </button>
      </div>

      <div v-if="form.source === 'manual'" class="kb-source-panel">
        <label class="form-field wide">
          <span class="form-label">正文 <em>*</em></span>
          <textarea
            v-model="form.body"
            class="input kb-body"
            rows="8"
            placeholder="粘贴 FAQ、术语定义、规范原文…"
          />
          <span class="kb-hint">{{ contentChars }} 字 · 预估 {{ estimatedChunks || 0 }} 分片</span>
        </label>
      </div>

      <div v-else class="kb-source-panel">
        <input
          ref="fileInput"
          type="file"
          class="kb-file-hidden"
          :accept="KB_UPLOAD_ACCEPT"
          @change="onFileChange"
        />
        <div
          class="kb-upload"
          :class="{ over: dragOver, has: !!form.fileName }"
          @click="pickFile"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop="onDrop"
        >
          <template v-if="!form.fileName">
            <div class="kb-upload-icon">📤</div>
            <div class="kb-upload-title">点击或拖拽文档到此处</div>
            <div class="kb-upload-sub">支持 pdf / docx / doc / md / txt / html · 服务端真实解析正文</div>
          </template>
          <template v-else>
            <div class="kb-upload-icon">📎</div>
            <div class="kb-upload-title">{{ form.fileName }}</div>
            <div class="kb-upload-sub">
              {{ formatFileSize(form.fileSize) }}
              <template v-if="selectedFile"> · 预估约 {{ form.estChars.toLocaleString() }} 字 · 提交后解析</template>
              <template v-else-if="isEdit"> · 未换文件则保留已解析正文</template>
              · 预估 {{ estimatedChunks }} 分片
            </div>
            <button type="button" class="btn btn-sm kb-clear-file" @click.stop="clearFile">清除</button>
          </template>
        </div>
      </div>

      <div class="detail-section-title kb-chunk-head">
        <span>分片与索引</span>
        <button type="button" class="btn-link" @click="chunkAdvanced = !chunkAdvanced">
          {{ chunkAdvanced ? '收起' : '展开配置' }}
        </button>
      </div>

      <div v-show="chunkAdvanced" class="kb-chunk-panel">
        <div class="kb-form-grid">
          <label class="form-field">
            <span class="form-label">分片策略</span>
            <select v-model="form.strategy" class="input">
              <option v-for="s in KB_CHUNK_STRATEGIES" :key="s.value" :value="s.value">
                {{ s.label }}
              </option>
            </select>
          </label>
          <label class="form-field">
            <span class="form-label">嵌入模型</span>
            <select v-model="form.embedModel" class="input">
              <option v-for="m in KB_EMBED_MODELS" :key="m.value" :value="m.value">
                {{ m.label }}
              </option>
            </select>
          </label>
          <label class="form-field">
            <span class="form-label">分片大小</span>
            <input v-model.number="form.chunkSize" class="input" type="number" min="50" step="50" />
          </label>
          <label class="form-field">
            <span class="form-label">重叠长度</span>
            <input v-model.number="form.overlap" class="input" type="number" min="0" step="10" />
          </label>
          <label v-if="showSeparator" class="form-field">
            <span class="form-label">分隔符</span>
            <select v-model="form.separator" class="input">
              <option v-for="s in KB_CHUNK_SEPARATORS" :key="s.value" :value="s.value">
                {{ s.label }}
              </option>
            </select>
          </label>
          <label v-if="showSeparator && form.separator === 'custom'" class="form-field">
            <span class="form-label">自定义分隔符</span>
            <input v-model="form.customSep" class="input" placeholder="如 ---" />
          </label>
        </div>
        <div class="kb-estimate">
          预估 <strong>{{ estimatedChunks || 0 }}</strong> 个分片
          · 策略 {{ KB_CHUNK_STRATEGIES.find((s) => s.value === form.strategy)?.label }}
          · {{ form.embedModel }}
        </div>
      </div>
    </div>

    <div class="kb-create-footer">
      <button type="button" class="btn btn-sm" @click="close">取消</button>
      <button type="button" class="btn btn-sm btn-primary" :disabled="saving" @click="submit">
        {{ saving ? '解析入库中…' : isEdit ? '保存并重新索引' : '创建并向量化' }}
      </button>
    </div>
  </AppDrawer>
</template>

<style scoped>
.kb-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
  margin: 10px 0 18px;
}
.kb-form-grid .wide {
  grid-column: 1 / -1;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.form-label {
  font-size: 12px;
  color: var(--text-2);
}
.form-label em {
  color: var(--danger);
  font-style: normal;
}

.kb-source-tabs {
  display: flex;
  gap: 8px;
  margin: 8px 0 12px;
}
.kb-source-tab {
  flex: 1;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text-2);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.kb-source-tab:hover,
.kb-source-tab.active {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}

.kb-source-panel {
  margin-bottom: 18px;
}
.kb-body {
  resize: vertical;
  min-height: 140px;
  font-family: inherit;
  line-height: 1.55;
}
.kb-hint {
  font-size: 11px;
  color: var(--text-3);
}

.kb-file-hidden {
  display: none;
}
.kb-upload {
  border: 1.5px dashed var(--border);
  border-radius: 10px;
  padding: 28px 16px;
  text-align: center;
  background: var(--bg-2);
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.kb-upload:hover,
.kb-upload.over {
  border-color: var(--primary);
  background: var(--primary-light);
}
.kb-upload.has {
  border-style: solid;
  background: var(--bg-1);
}
.kb-upload-icon {
  font-size: 28px;
  margin-bottom: 8px;
}
.kb-upload-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  word-break: break-all;
}
.kb-upload-sub {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-3);
}
.kb-clear-file {
  margin-top: 12px;
}

.kb-chunk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kb-chunk-panel {
  margin: 10px 0 8px;
}
.kb-estimate {
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-2);
}
.kb-estimate strong {
  color: var(--primary);
  font-size: 14px;
}

.kb-create-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-1);
}
</style>
