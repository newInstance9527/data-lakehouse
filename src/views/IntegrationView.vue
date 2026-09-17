<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import DagPalette from '@/components/etl/DagPalette.vue'
import DagCanvas from '@/components/etl/DagCanvas.vue'
import DagConfigPanel from '@/components/etl/DagConfigPanel.vue'
import TaskRunsDrawer from '@/components/etl/TaskRunsDrawer.vue'
import { useEtl } from '@/composables/useEtl'
import { useToast } from '@/composables/useToast'
import { useDatasources } from '@/composables/useDatasources'
import { useAssets } from '@/composables/useAssets'
import { pageGuideOf } from '@/data/pageGuides'
import { TASK_STATUS_META } from '@/data/etl'
import {
  resolveSourceTableFields,
  resolveTargetTableFields,
  resolveUpstreamFields,
} from '@/utils/etlFields'

const { showToast } = useToast()
const guide = pageGuideOf('integration')
const canvasRef = ref(null)
const { getSource } = useDatasources()
const { findAsset } = useAssets()

const {
  taskList,
  current,
  currentId,
  selNodeId,
  selEdgeIdx,
  connectFrom,
  selectedNode,
  selectTask,
  selectNode,
  selectEdge,
  clearSelection,
  createTask,
  updateTaskMeta,
  addNode,
  moveNode,
  patchNode,
  removeNode,
  beginConnect,
  completeConnect,
  cancelConnect,
  removeEdge,
  validateCurrent,
  trialRun,
  openRunsTab,
  clearForceCfgTab,
  forceCfgTab,
} = useEtl()

const taskKw = ref('')
const runsDrawerOpen = ref(false)

const leftWidth = ref(loadNum('etl-left-w', 220))
const rightWidth = ref(loadNum('etl-right-w', 300))
const leftCollapsed = ref(loadBool('etl-left-c', false))
const rightCollapsed = ref(loadBool('etl-right-c', false))
const paletteCollapsed = ref(loadBool('etl-palette-c', false))

const fieldCtx = computed(() => ({ getSource, findAsset }))

const upstreamFields = computed(() => {
  if (!current.value || !selectedNode.value) return []
  return resolveUpstreamFields(selectedNode.value.id, current.value, fieldCtx.value)
})

const sourceFields = computed(() => {
  if (!selectedNode.value) return []
  return resolveSourceTableFields(selectedNode.value, fieldCtx.value)
})

const targetFields = computed(() => {
  if (!selectedNode.value) return []
  return resolveTargetTableFields(selectedNode.value, fieldCtx.value)
})

const filteredTasks = computed(() => {
  const q = taskKw.value.trim().toLowerCase()
  if (!q) return taskList.value
  return taskList.value.filter((t) =>
    `${t.name} ${t.desc} ${t.owner} ${t.engine}`.toLowerCase().includes(q),
  )
})

function loadNum(key, def) {
  try {
    const n = Number(localStorage.getItem(key))
    return n && n >= 160 ? n : def
  } catch {
    return def
  }
}
function loadBool(key, def) {
  try {
    const v = localStorage.getItem(key)
    if (v == null) return def
    return v === '1'
  } catch {
    return def
  }
}
function save(key, val) {
  try {
    localStorage.setItem(key, String(val))
  } catch {
    /* ignore */
  }
}

function toggleLeft() {
  leftCollapsed.value = !leftCollapsed.value
  save('etl-left-c', leftCollapsed.value ? '1' : '0')
}
function toggleRight() {
  rightCollapsed.value = !rightCollapsed.value
  save('etl-right-c', rightCollapsed.value ? '1' : '0')
}
function togglePalette() {
  paletteCollapsed.value = !paletteCollapsed.value
  save('etl-palette-c', paletteCollapsed.value ? '1' : '0')
}

function startResize(side, e) {
  e.preventDefault()
  const startX = e.clientX
  const startW = side === 'left' ? leftWidth.value : rightWidth.value
  const onMove = (ev) => {
    if (side === 'left') {
      leftWidth.value = Math.min(420, Math.max(180, startW + (ev.clientX - startX)))
    } else {
      rightWidth.value = Math.min(520, Math.max(240, startW - (ev.clientX - startX)))
    }
  }
  const onUp = () => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    if (side === 'left') save('etl-left-w', leftWidth.value)
    else save('etl-right-w', rightWidth.value)
  }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onNewTask() {
  const t = createTask()
  showToast(`✅ 已创建任务 ${t.name}`, 'success')
}

function onAddNode(type) {
  if (!current.value) {
    showToast('请先选择或新建任务', 'warning')
    return
  }
  const n = addNode(type)
  if (n) showToast(`＋ 已添加「${n.name}」`, 'success')
}

function onDropType(type, pos) {
  if (!current.value) {
    showToast('请先选择或新建任务', 'warning')
    return
  }
  const n = addNode(type, pos)
  if (n) showToast(`＋ 已添加「${n.name}」`, 'success')
}

function onBeginConnect(id) {
  beginConnect(id)
  showToast('连线中：点击目标节点输入端口', 'info')
}

function onCompleteConnect(toId) {
  const ok = completeConnect(toId)
  showToast(ok ? '✓ 已连线' : '连线失败（可能已存在）', ok ? 'success' : 'warning')
}

function onDeleteNode(id) {
  removeNode(id)
  showToast('已删除节点', 'success')
}

function onDeleteEdge(idx) {
  removeEdge(idx)
  showToast('已删除连线', 'success')
}

function onValidate() {
  const r = validateCurrent()
  showToast(r.messages[0], r.ok ? 'success' : 'warning')
  if (!r.ok && r.messages.length > 1) {
    r.messages.slice(1).forEach((m) => showToast(m, 'warning'))
  }
}

function onSave() {
  if (!current.value) return
  showToast(`💾 已保存 ${current.value.name}（演示 · 会话内有效）`, 'success')
}

function onTrialRun() {
  if (!current.value) return
  const row = trialRun()
  if (row) showToast(`▶ 已提交试跑 ${row.run}`, 'success')
}

function onOpenRuns() {
  if (!current.value) return
  runsDrawerOpen.value = true
  openRunsTab()
}

function onSelectRunNode(nodeId) {
  if (!nodeId) return
  selectNode(nodeId)
}

function onPublish() {
  if (!current.value) return
  updateTaskMeta({ status: 'prod', ver: bumpVer(current.value.ver) })
  showToast(`🚀 已发布 ${current.value.name}`, 'success')
}

function bumpVer(v) {
  const m = String(v || 'v0.1').match(/v?(\d+)\.(\d+)/)
  if (!m) return 'v1.0'
  return `v${m[1]}.${Number(m[2]) + 1}`
}

function statusMeta(st) {
  return TASK_STATUS_META[st] || TASK_STATUS_META.draft
}

function onKey(e) {
  if (e.key === 'Escape') cancelConnect()
  if (
    (e.key === 'Delete' || e.key === 'Backspace') &&
    !(e.target instanceof HTMLInputElement) &&
    !(e.target instanceof HTMLTextAreaElement) &&
    !(e.target instanceof HTMLSelectElement)
  ) {
    if (selNodeId.value) onDeleteNode(selNodeId.value)
    else if (selEdgeIdx.value != null) onDeleteEdge(selEdgeIdx.value)
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="etl-page">
    <PageHeader
      title="🛠️ ETL 编排"
      subtitle="Flink / Spark / DataX · DAG 画布 · 入湖清洗出湖"
      :guide-title="guide.title"
      :guide="guide"
    >
      <button class="btn btn-sm" :disabled="!current" @click="onValidate">校验</button>
      <button class="btn btn-sm" :disabled="!current" @click="onSave">保存</button>
      <button class="btn btn-sm" :disabled="!current" @click="onTrialRun">▶ 试跑</button>
      <button class="btn btn-sm" :disabled="!current" @click="onOpenRuns">执行记录</button>
      <button class="btn btn-sm" :disabled="!current" @click="onPublish">发布</button>
      <button class="btn btn-sm btn-primary" @click="onNewTask">＋ 新建任务</button>
    </PageHeader>

    <div class="dag-layout">
      <!-- 左：任务列表 -->
      <aside
        class="dag-col dag-tasks"
        :class="{ collapsed: leftCollapsed }"
        :style="leftCollapsed ? undefined : { width: leftWidth + 'px', flex: `0 0 ${leftWidth}px` }"
      >
        <div class="dag-col-head">
          <span>任务</span>
          <button type="button" class="btn btn-sm dag-collapse-btn" title="折叠" @click="toggleLeft">⟨</button>
        </div>
        <input v-model="taskKw" class="input input-sm" style="margin: 0 10px 8px; width: calc(100% - 20px)" placeholder="搜索任务…" />
        <div class="dag-task-list">
          <button
            v-for="t in filteredTasks"
            :key="t.id"
            type="button"
            class="dag-task-item"
            :class="{ active: t.id === currentId }"
            @click="selectTask(t.id)"
          >
            <div class="dti-name">{{ t.name }}</div>
            <div class="dti-desc">{{ t.desc }}</div>
            <div class="dti-meta">
              <span class="tag" :class="statusMeta(t.status).tag" style="font-size: 10px">{{ statusMeta(t.status).label }}</span>
              <span>{{ t.engine }}</span>
              <span>{{ t.cron }}</span>
            </div>
          </button>
          <div v-if="!filteredTasks.length" class="dag-config-empty">无匹配任务</div>
        </div>
      </aside>
      <button
        v-if="leftCollapsed"
        type="button"
        class="dag-rail"
        title="展开任务栏"
        @click="toggleLeft"
      >任务 ⟩</button>
      <div
        v-else
        class="dag-resizer"
        title="拖拽调整宽度"
        @mousedown="startResize('left', $event)"
      />

      <!-- 中：算子 + 画布 -->
      <section class="dag-col dag-main">
        <div class="dag-topbar">
          <div class="dag-topbar-info">
            <div class="dag-title">{{ current?.name || '未选择任务' }}</div>
            <div v-if="current" class="dag-meta">
              {{ current.env }} · {{ current.engine }} · {{ current.owner }} · SLA {{ current.sla }}
            </div>
          </div>
          <div class="dag-topbar-actions">
            <button class="btn btn-sm" title="算子面板" @click="togglePalette">
              {{ paletteCollapsed ? '展开算子' : '折叠算子' }}
            </button>
            <button class="btn btn-sm" title="缩小" @click="canvasRef?.zoomBy(-0.1)">－</button>
            <button class="btn btn-sm" title="复位视图" @click="canvasRef?.resetView()">复位</button>
            <button class="btn btn-sm" title="放大" @click="canvasRef?.zoomBy(0.1)">＋</button>
            <button
              class="btn btn-sm"
              :disabled="!selNodeId"
              @click="selNodeId && onDeleteNode(selNodeId)"
            >删除节点</button>
          </div>
        </div>
        <div class="dag-workspace" :class="{ 'palette-collapsed': paletteCollapsed }">
          <DagPalette v-show="!paletteCollapsed" class="dag-side-palette" @add="onAddNode" />
          <DagCanvas
            ref="canvasRef"
            :nodes="current?.nodes || []"
            :edges="current?.edges || []"
            :selected-id="selNodeId"
            :selected-edge-idx="selEdgeIdx"
            :connect-from="connectFrom"
            @select-node="selectNode"
            @select-edge="selectEdge"
            @clear="clearSelection"
            @move="moveNode"
            @drop-type="onDropType"
            @begin-connect="onBeginConnect"
            @complete-connect="onCompleteConnect"
            @cancel-connect="cancelConnect"
          />
        </div>
      </section>

      <div
        v-if="!rightCollapsed"
        class="dag-resizer"
        title="拖拽调整宽度"
        @mousedown="startResize('right', $event)"
      />
      <button
        v-if="rightCollapsed"
        type="button"
        class="dag-rail"
        title="展开配置栏"
        @click="toggleRight"
      >⟨ 配置</button>

      <!-- 右：配置 -->
      <aside
        class="dag-col dag-cfg"
        :class="{ collapsed: rightCollapsed }"
        :style="rightCollapsed ? undefined : { width: rightWidth + 'px', flex: `0 0 ${rightWidth}px` }"
      >
        <div class="dag-col-head">
          <button type="button" class="btn btn-sm dag-collapse-btn" title="折叠" @click="toggleRight">⟩</button>
          <span>配置</span>
        </div>
        <DagConfigPanel
          :task="current"
          :node="selectedNode"
          :edge-idx="selEdgeIdx"
          :upstream-fields="upstreamFields"
          :source-fields="sourceFields"
          :target-fields="targetFields"
          :force-tab="forceCfgTab"
          @update-task="updateTaskMeta"
          @update-node="patchNode"
          @delete-node="onDeleteNode"
          @delete-edge="onDeleteEdge"
          @trial-run="onTrialRun"
          @clear-force-tab="clearForceCfgTab"
          @open-runs="onOpenRuns"
        />
      </aside>
    </div>

    <TaskRunsDrawer
      :open="runsDrawerOpen"
      :task="current"
      @close="runsDrawerOpen = false"
      @rerun="onTrialRun"
      @select-node="onSelectRunNode"
    />
  </div>
</template>
