<script setup>
/**
 * 全局悬浮 AI 助手 · FAB + 可拖拽 / 可缩放对话面板
 * 复用 /lh/ai/chat · models；附件仅文本描述回退（后端无多模态字段）
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useSession } from '@/composables/useSession'
import {
  DRAG_THRESHOLD,
  FAB_SIZE,
  useGlobalAiFab,
} from '@/composables/useGlobalAiFab'
import { handleAiSqlAction, openQueryWithSql } from '@/composables/useAiSqlActions'

const router = useRouter()
const { showToast } = useToast()
const { currentWs } = useSession()

const fab = useGlobalAiFab()
const {
  open,
  pos,
  size,
  sessionId,
  messages,
  sending,
  visibleModelOptions,
  selectedModelId,
  hasImageInput,
  loadModels,
  preferVisionModel,
  clearChat,
  stop,
  send,
  confirmRunSql,
  persistPos,
  persistSize,
  clampPosInto,
} = fab

const inputText = ref('')
const pendingFiles = ref([])
const chatBody = ref(null)
const panelEl = ref(null)
const fileInput = ref(null)

const ws = computed(() => currentWs.value || 'default')

function syncImageInputFlag() {
  const hasImg = pendingFiles.value.some(
    (x) => x?.kind?.startsWith('image/') || x?.file?.type?.startsWith('image/'),
  )
  const turnedOn = hasImg && !hasImageInput.value
  hasImageInput.value = hasImg
  if (turnedOn) {
    const r = preferVisionModel()
    if (r.warn) showToast(r.warn, 'warning')
    else if (r.info) showToast(r.info, 'info')
  }
}

let dragState = null
let resizeObserver = null

onMounted(async () => {
  clampPosInto(pos.value)
  await loadModels()
  window.addEventListener('resize', onWinResize)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (!panelEl.value || !open.value) return
      const r = panelEl.value.getBoundingClientRect()
      size.value = { width: Math.round(r.width), height: Math.round(r.height) }
      persistSize()
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWinResize)
  resizeObserver?.disconnect()
  stopDragListeners()
  revokePreviewUrls(pendingFiles.value)
  stop()
})

watch(open, async (v) => {
  if (v) {
    await nextTick()
    if (panelEl.value && resizeObserver) resizeObserver.observe(panelEl.value)
    scrollBottom()
  } else if (panelEl.value && resizeObserver) {
    resizeObserver.unobserve(panelEl.value)
  }
})

watch(
  () => messages.value.length,
  () => scrollBottom(),
)

function onWinResize() {
  clampPosInto(pos.value)
  persistPos()
}

function scrollBottom() {
  nextTick(() => {
    const el = chatBody.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

const panelStyle = computed(() => {
  const w = size.value.width
  const h = size.value.height
  let left = pos.value.left + FAB_SIZE - w
  let top = pos.value.top - h - 12
  if (typeof window !== 'undefined') {
    left = Math.min(Math.max(8, left), window.innerWidth - w - 8)
    if (top < 8) top = Math.min(pos.value.top + FAB_SIZE + 12, window.innerHeight - h - 8)
    top = Math.max(8, top)
  }
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${w}px`,
    height: `${h}px`,
  }
})

function onFabPointerDown(e) {
  if (e.button != null && e.button !== 0) return
  e.preventDefault()
  dragState = {
    startX: e.clientX,
    startY: e.clientY,
    origLeft: pos.value.left,
    origTop: pos.value.top,
    moved: false,
    pointerId: e.pointerId,
  }
  e.currentTarget?.setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onFabPointerMove)
  window.addEventListener('pointerup', onFabPointerUp)
  window.addEventListener('pointercancel', onFabPointerUp)
}

function onFabPointerMove(e) {
  if (!dragState) return
  const dx = e.clientX - dragState.startX
  const dy = e.clientY - dragState.startY
  if (!dragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
  dragState.moved = true
  clampPosInto({
    left: dragState.origLeft + dx,
    top: dragState.origTop + dy,
  })
}

function onFabPointerUp() {
  if (!dragState) return
  const wasDrag = dragState.moved
  stopDragListeners()
  if (wasDrag) {
    persistPos()
  } else {
    open.value = !open.value
  }
  dragState = null
}

function stopDragListeners() {
  window.removeEventListener('pointermove', onFabPointerMove)
  window.removeEventListener('pointerup', onFabPointerUp)
  window.removeEventListener('pointercancel', onFabPointerUp)
}

function closePanel() {
  open.value = false
}

function goFullPage() {
  open.value = false
  router.push('/aiassistant')
}

function onClear() {
  if (!messages.value.length) return
  if (!confirm('清空悬浮助手当前对话？')) return
  clearChat()
  showToast('已清空', 'success')
}

function pickFiles() {
  fileInput.value?.click()
}

function revokePreviewUrls(list) {
  ;(list || []).forEach((item) => {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
}

function addFiles(fileList) {
  const incoming = Array.from(fileList || [])
  if (!incoming.length) return
  const next = [...pendingFiles.value]
  for (const f of incoming) {
    if (next.length >= 8) break
    const item = { file: f, name: f.name || 'clipboard-image', kind: f.type || '' }
    if (f.type?.startsWith('image/')) {
      try {
        item.previewUrl = URL.createObjectURL(f)
      } catch {
        /* ignore */
      }
    }
    next.push(item)
  }
  pendingFiles.value = next
  syncImageInputFlag()
}

function onFileChange(e) {
  addFiles(e.target.files)
  e.target.value = ''
}

function removePending(i) {
  const item = pendingFiles.value[i]
  if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
  pendingFiles.value = pendingFiles.value.filter((_, idx) => idx !== i)
  syncImageInputFlag()
}

function onPaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  const files = []
  for (const it of items) {
    if (it.kind === 'file') {
      const f = it.getAsFile()
      if (f) files.push(f)
    }
  }
  if (!files.length) return
  e.preventDefault()
  addFiles(files)
  showToast(`已粘贴 ${files.length} 个附件`, 'info')
}

async function onSend() {
  const text = inputText.value
  const files = pendingFiles.value.map((x) => x.file).filter(Boolean)
  if ((!text.trim() && !files.length) || sending.value) return
  inputText.value = ''
  revokePreviewUrls(pendingFiles.value)
  pendingFiles.value = []
  hasImageInput.value = false
  const res = await send({ text, ws: ws.value, attachments: files })
  if (res?.error) {
    const msg = res.error?.message || '发送失败'
    showToast(msg, /配额|用尽|quota/i.test(msg) ? 'warning' : 'error')
  }
  scrollBottom()
}

async function onAction(act) {
  await handleAiSqlAction(act, {
    router,
    messages,
    showToast,
    confirmRunSql,
    sessionId: sessionId.value,
    ws: ws.value,
  })
  scrollBottom()
}

function onBubbleClick(e, msg) {
  const t = e.target
  if (t?.classList?.contains('ai-inline-btn') || t?.dataset?.openSql) {
    const sql = msg?.actions?.find((a) => a.sql)?.sql
    if (sql) openQueryWithSql(router, sql)
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="gai-root" aria-live="polite">
      <div
        v-show="open"
        ref="panelEl"
        class="gai-panel"
        :style="panelStyle"
        role="dialog"
        aria-label="AI 助手"
      >
        <header class="gai-head">
          <div class="gai-head-main">
            <span class="gai-title">AI 助手</span>
            <span class="gai-ws">ws={{ ws }}</span>
          </div>
          <select
            v-model="selectedModelId"
            class="select input-sm gai-model"
            :title="hasImageInput ? '带图时优先视觉模型；留空则路由默认' : '留空则按场景路由'"
          >
            <option value="">路由默认</option>
            <option v-for="m in visibleModelOptions" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
          <span v-if="hasImageInput" class="gai-vision-tag" title="检测到图片，已筛选视觉能力模型">视觉</span>
          <button type="button" class="gai-icon-btn" title="完整助手页" @click="goFullPage">↗</button>
          <button type="button" class="gai-icon-btn" title="清空" @click="onClear">🧹</button>
          <button type="button" class="gai-icon-btn" title="关闭" @click="closePanel">✕</button>
        </header>

        <div ref="chatBody" class="gai-body">
          <div v-if="!messages.length" class="gai-empty tip">
            问数据问题、写 SQL、查手册… 支持粘贴图片 / 上传文件（文本通道描述回退）
          </div>
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="gai-msg"
            :class="msg.role"
          >
            <div class="gai-bubble" @click="onBubbleClick($event, msg)">
              <div v-if="msg.html" v-html="msg.html" />
              <template v-else>{{ msg.text }}</template>
              <div
                v-if="msg.role === 'assistant' && msg.citations?.length"
                class="gai-cite-footer"
              >
                <span class="gai-cite-label">引用</span>
                <button
                  v-for="(c, ci) in msg.citations.filter((x) => x.type === 'knowledge' || x.entryId).slice(0, 5)"
                  :key="ci"
                  type="button"
                  class="gai-cite-chip"
                  @click.stop="router.push(c.href || (c.entryId ? `/knowledge?entry=${c.entryId}` : '/knowledge'))"
                >
                  {{ c.title || c.entryId || '条目' }}
                </button>
              </div>
              <div v-if="msg.previews?.length" class="gai-previews">
                <span v-for="(p, pi) in msg.previews" :key="pi" class="gai-chip">
                  <img v-if="p.url" :src="p.url" :alt="p.name" class="gai-thumb" />
                  <span>{{ p.name }}</span>
                </span>
              </div>
              <div v-if="msg.actions?.length" class="gai-msg-actions">
                <button
                  v-for="(act, ai) in msg.actions"
                  :key="ai"
                  type="button"
                  class="btn btn-sm"
                  :class="act.type === 'run_sql' ? 'btn-primary' : ''"
                  @click.stop="onAction(act)"
                >
                  {{ act.label || act.type }}
                </button>
              </div>
            </div>
          </div>
          <div v-if="sending" class="gai-msg assistant">
            <div class="gai-bubble gai-thinking">思考中…</div>
          </div>
        </div>

        <div v-if="pendingFiles.length" class="gai-pending">
          <span
            v-for="(item, i) in pendingFiles"
            :key="i"
            class="gai-chip"
          >
            <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.name" class="gai-thumb" />
            <span class="gai-chip-name">{{ item.name || 'image' }}</span>
            <button type="button" class="gai-chip-x" @click="removePending(i)">×</button>
          </span>
        </div>

        <div class="gai-input">
          <button type="button" class="gai-icon-btn" title="上传文件" @click="pickFiles">📎</button>
          <input
            ref="fileInput"
            type="file"
            class="gai-file"
            multiple
            accept="image/*,.txt,.md,.json,.csv,.sql,.log,.xml,.yml,.yaml,.js,.ts,.py,.java,.vue"
            @change="onFileChange"
          />
          <textarea
            v-model="inputText"
            rows="2"
            placeholder="输入问题，或粘贴图片…"
            @keydown.enter.exact.prevent="onSend"
            @paste="onPaste"
          />
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="sending"
            @click="onSend"
          >
            发送
          </button>
        </div>
        <div class="gai-resize-hint" title="拖拽右下角缩放" />
      </div>

      <button
        type="button"
        class="gai-fab"
        :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
        :title="open ? '关闭助手' : '打开 AI 助手（可拖动）'"
        :aria-expanded="open"
        @pointerdown="onFabPointerDown"
      >
        <span class="gai-fab-ico">{{ open ? '✕' : '🤖' }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.gai-root {
  pointer-events: none;
}
.gai-fab,
.gai-panel {
  pointer-events: auto;
}

.gai-fab {
  position: fixed;
  z-index: 1200;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--primary);
  color: #fff;
  box-shadow: var(--shadow-md);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  touch-action: none;
  transition: box-shadow 0.15s, background 0.15s;
}
.gai-fab:hover {
  background: var(--primary-dark);
  box-shadow: var(--shadow-lg);
}
.gai-fab:active {
  cursor: grabbing;
}
.gai-fab-ico {
  font-size: 20px;
  line-height: 1;
}

.gai-panel {
  position: fixed;
  z-index: 1190;
  display: flex;
  flex-direction: column;
  min-width: 300px;
  min-height: 320px;
  max-width: min(720px, calc(100vw - 16px));
  max-height: min(800px, calc(100vh - 16px));
  resize: both;
  overflow: hidden;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.gai-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-2);
  flex-shrink: 0;
}
.gai-head-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-right: 4px;
}
.gai-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.gai-ws {
  font-size: 10px;
  color: var(--text-3);
}
.gai-model {
  flex: 1;
  min-width: 0;
  max-width: 160px;
  font-size: 12px;
  padding: 2px 6px;
}
.gai-vision-tag {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 500;
}
.gai-icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  flex-shrink: 0;
}
.gai-icon-btn:hover {
  border-color: var(--border);
  color: var(--primary);
  background: var(--bg-1);
}

.gai-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-0);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.gai-empty {
  font-size: 12px;
  color: var(--text-3);
  padding: 12px 4px;
  line-height: 1.5;
}
.gai-msg {
  display: flex;
  max-width: 92%;
}
.gai-msg.user {
  margin-left: auto;
  flex-direction: row-reverse;
}
.gai-bubble {
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.55;
  background: var(--bg-1);
  border: 1px solid var(--border);
  color: var(--text-1);
  word-break: break-word;
}
.gai-msg.user .gai-bubble {
  background: var(--primary);
  color: #fff;
  border: none;
}
.gai-msg.assistant .gai-bubble {
  background: #fff;
  border-color: #d6e4ff;
}
.gai-msg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.gai-cite-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #d6e4ff;
}
.gai-cite-label {
  font-size: 10px;
  color: var(--text-3, #8c8c8c);
}
.gai-cite-chip {
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid #adc6ff;
  border-radius: 8px;
  background: #f0f5ff;
  color: #1d39c4;
  cursor: pointer;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gai-bubble :deep(.ai-inline-btn) {
  margin-top: 6px;
  font-size: 11px;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-2);
  cursor: pointer;
}
.gai-thinking {
  opacity: 0.7;
  font-style: italic;
}
.gai-bubble :deep(pre) {
  background: #1e2937;
  color: #e2e8f0;
  padding: 8px;
  border-radius: 6px;
  font-size: 11px;
  margin: 6px 0 0;
  overflow-x: auto;
}

.gai-pending {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  border-top: 1px solid var(--border);
  background: var(--bg-1);
  flex-shrink: 0;
}
.gai-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 140px;
  padding: 2px 6px;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-2);
  color: var(--text-2);
}
.gai-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gai-chip-x {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-3);
  padding: 0 2px;
  line-height: 1;
}
.gai-thumb {
  width: 22px;
  height: 22px;
  object-fit: cover;
  border-radius: 4px;
}
.gai-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.gai-msg.user .gai-chip {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.35);
  color: #fff;
}

.gai-input {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
  background: var(--bg-1);
  flex-shrink: 0;
}
.gai-input textarea {
  flex: 1;
  min-height: 40px;
  max-height: 96px;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  background: var(--bg-1);
  color: var(--text-1);
}
.gai-input textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-light);
}
.gai-file {
  display: none;
}
.gai-resize-hint {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 12px;
  height: 12px;
  pointer-events: none;
  background: linear-gradient(135deg, transparent 50%, var(--border-dark) 50%);
  border-radius: 0 0 6px 0;
  opacity: 0.7;
}
</style>
