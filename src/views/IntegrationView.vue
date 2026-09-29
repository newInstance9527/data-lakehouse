<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import DagPalette from '@/components/etl/DagPalette.vue'
import DagCanvas from '@/components/etl/DagCanvas.vue'
import DagConfigPanel from '@/components/etl/DagConfigPanel.vue'
import TaskRunsDrawer from '@/components/etl/TaskRunsDrawer.vue'
import { useEtl } from '@/composables/useEtl'
import { useToast } from '@/composables/useToast'
import { useDatasources } from '@/composables/useDatasources'
import { useAssets } from '@/composables/useAssets'
import { useDsSchema } from '@/composables/useDsSchema'
import { useSession, isNeedOwnerApplyError } from '@/composables/useSession'
import { pageGuideOf } from '@/data/pageGuides'
import { TASK_STATUS_META } from '@/data/etl'
import {
  resolveSourceTableFields,
  resolveTargetTableFields,
  resolveUpstreamFields,
} from '@/utils/etlFields'
import { useRouter } from 'vue-router'
import { confirmDelete } from '@/composables/useConfirmDelete'
import { useActionLock } from '@/composables/useActionLock'
import { displayUser } from '@/utils/displayUser'

const { showToast } = useToast()
const router = useRouter()
const { busy, run: runLocked } = useActionLock()
const guide = pageGuideOf('integration')
const canvasRef = ref(null)
const { getSource, loadSources } = useDatasources()
const { findAsset } = useAssets()
const { ensureSchema, getDsFields, schemaRev } = useDsSchema()
const { canEditEtl, canDeleteEtl, refreshManageGrant, currentWs } = useSession()

function toastNeedApply(e) {
  if (isNeedOwnerApplyError(e)) {
    showToast(e.message || '非拥有者不可操作，请前往申请中心', 'warning')
    goApplyManageEtl()
    return true
  }
  return false
}

function assertEditOrGuide(action = '编辑') {
  if (canEditCurrent.value) return true
  showToast(`无${action}权，请申请操作权限`, 'warning')
  goApplyManageEtl()
  return false
}

function goApplyManageEtl() {
  const t = current.value
  if (!t) return
  router.push({
    path: '/apply',
    query: {
      type: 'manage',
      resourceType: 'etl',
      resourceId: t.id,
      name: t.name || t.dagCode || '',
    },
  })
}

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
  publishCurrent,
  saveCurrent,
  refreshRuns,
  loadList,
  loading,
  saving,
  lastError,
  openRunsTab,
  clearForceCfgTab,
  forceCfgTab,
  setScheduleStatus,
  backfillCurrent,
  deleteCurrent,
} = useEtl()

const canEditCurrent = computed(() => canEditEtl(current.value))
const canDeleteCurrent = computed(() => canDeleteEtl(current.value))
const needApplyOps = computed(() => !!current.value && !canEditCurrent.value && !canDeleteCurrent.value)
const actionBusy = computed(
  () =>
    busy('save') ||
    busy('trial') ||
    busy('publish') ||
    busy('delete') ||
    busy('backfill') ||
    busy('status'),
)

const taskKw = ref('')
const runsDrawerOpen = ref(false)

async function reloadEtlList() {
  await loadList({ ws: currentWs.value || 'default' })
}

const leftWidth = ref(loadNum('etl-left-w', 220))
const rightWidth = ref(loadNum('etl-right-w', 300))
const leftCollapsed = ref(loadBool('etl-left-c', false))
const rightCollapsed = ref(loadBool('etl-right-c', false))
const paletteCollapsed = ref(loadBool('etl-palette-c', false))

const fieldCtx = computed(() => ({
  getSource,
  findAsset,
  getDsFields,
  // schemaRev 变化时强制重算上游字段
  _schemaRev: schemaRev.value,
}))

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

/** 收集当前任务中源节点 / 选中节点相关的 dsId，预拉表字段 */
function collectDsIdsForFields() {
  const t = current.value
  if (!t?.nodes?.length) return []
  const ids = new Set()
  const sel = selectedNode.value
  if (sel?.conf?.dsId) ids.add(sel.conf.dsId)
  // 选中节点的直接上游源
  if (sel) {
    ;(t.edges || [])
      .filter((e) => String(e.to) === String(sel.id))
      .forEach((e) => {
        const p = t.nodes.find((n) => String(n.id) === String(e.from))
        if (p?.conf?.dsId) ids.add(p.conf.dsId)
      })
  }
  // 全部 source 节点（保证下游字段可推导）
  t.nodes.forEach((n) => {
    if (String(n.type || '').startsWith('source') && n.conf?.dsId) ids.add(n.conf.dsId)
  })
  return [...ids]
}

watch(
  () => [currentId.value, selNodeId.value, current.value?.edges?.length, current.value?.nodes?.map((n) => n.conf?.dsId).join(',')],
  async () => {
    const ids = collectDsIdsForFields()
    await Promise.all(ids.map((id) => ensureSchema(id)))
  },
  { immediate: true },
)

watch(
  () => current.value?.id,
  async (id) => {
    if (!id) return
    await refreshManageGrant('etl', id, current.value)
  },
  { immediate: true },
)

const filteredTasks = computed(() => {
  const q = taskKw.value.trim().toLowerCase()
  if (!q) return taskList.value
  return taskList.value.filter((t) =>
    `${t.name} ${t.desc} ${t.dagCode} ${t.ownerName || ''} ${t.owner} ${t.engine}`.toLowerCase().includes(q),
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

async function onNewTask() {
  try {
    const t = await createTask({ ws: currentWs.value || 'default' })
    showToast(`✅ 已创建任务 ${t.name}`, 'success')
  } catch (e) {
    showToast(e.message || '创建失败', 'error')
  }
}

function onAddNode(type) {
  if (!current.value) {
    showToast('请先选择或新建任务', 'warning')
    return
  }
  if (!assertEditOrGuide('编辑图')) return
  const n = addNode(type)
  if (n) showToast(`＋ 已添加「${n.name}」`, 'success')
}

function onDropType(type, pos) {
  if (!current.value) {
    showToast('请先选择或新建任务', 'warning')
    return
  }
  if (!assertEditOrGuide('编辑图')) return
  const n = addNode(type, pos)
  if (n) showToast(`＋ 已添加「${n.name}」`, 'success')
}

function onBeginConnect(id) {
  if (!assertEditOrGuide('编辑图')) return
  beginConnect(id)
  showToast('连线中：点击目标节点完成', 'info')
}

function onCompleteConnect(toId) {
  if (!assertEditOrGuide('编辑图')) {
    cancelConnect()
    return
  }
  const ok = completeConnect(toId)
  showToast(ok ? '✓ 已连线' : '连线失败（可能已存在）', ok ? 'success' : 'warning')
}

function onMoveNode(id, x, y) {
  if (!assertEditOrGuide('编辑图')) return
  // DagCanvas emit('move', id, x, y)；兼容旧调用传 { x, y }
  if (x != null && typeof x === 'object') {
    moveNode(id, x.x, x.y)
    return
  }
  moveNode(id, x, y)
}

function onUpdateTask(patch) {
  if (!assertEditOrGuide()) return
  updateTaskMeta(patch)
}

function onUpdateNode(id, patch) {
  if (!assertEditOrGuide()) return
  patchNode(id, patch)
}

function onDeleteNode(id) {
  if (!assertEditOrGuide('编辑图')) return
  removeNode(id)
  showToast('已删除节点', 'success')
}

function onDeleteEdge(idx) {
  if (!assertEditOrGuide('编辑图')) return
  removeEdge(idx)
  showToast('已删除连线', 'success')
}

async function onValidate() {
  const r = await validateCurrent()
  if (r.ok) {
    showToast(r.messages[0] || '校验通过', 'success')
    return
  }
  const head = r.summary || '校验未通过'
  const body = (r.messages || []).slice(0, 12).join('\n')
  showToast(body ? `${head}\n${body}` : head, 'error', { duration: 10000 })
}

async function onSave() {
  if (!current.value) return
  if (!assertEditOrGuide('保存')) return
  await runLocked('save', async () => {
    try {
      await saveCurrent()
      showToast(`💾 已保存 ${current.value.name}`, 'success')
    } catch (e) {
      if (!toastNeedApply(e)) showToast(e.message || '保存失败', 'error')
    }
  })
}

async function onTrialRun() {
  if (!current.value) return
  if (!assertEditOrGuide('试跑')) return
  await runLocked('trial', async () => {
    try {
      const row = await trialRun()
      if (row) {
        const failed = row.rawStatus === 'failed'
        const qBlocked = !!row.quality?.blocked
        const qOk = row.quality?.qualityRunOk
        const dsMsg =
          row.dsStart?.message ||
          row.ds?.message ||
          row.message ||
          row.rawMessage ||
          ''
        let tip = ''
        // DS/引擎错误优先；勿把「已提交但校验误报」盖成质量门禁
        if (failed && dsMsg) tip = String(dsMsg).slice(0, 160)
        else if (qBlocked) tip = '质量门禁已阻断'
        else if (failed) tip = '试跑失败'
        else if (qOk != null) tip = `质量 runs ${qOk}`
        const ol = row.openLineage?.olOk != null ? ` · OL ${row.openLineage.olOk}` : ''
        showToast(
          `▶ ${failed || qBlocked ? '试跑失败' : '已提交试跑'} ${row.run}${tip ? ' · ' + tip : ''}${ol}`,
          failed || qBlocked ? 'warning' : 'success',
          { duration: failed || qBlocked ? 10000 : 4000 },
        )
        if ((failed || qBlocked) && row.alert?.opsPath) {
          showToast(`告警已登记 · 运维入口 ${row.alert.opsPath}`, 'warning')
        }
        runsDrawerOpen.value = true
      }
    } catch (e) {
      if (!toastNeedApply(e)) showToast(e.message || '试跑失败', 'error')
    }
  })
}

async function onSetStatus(status) {
  if (!current.value) return
  if (!assertEditOrGuide('变更状态')) return
  await runLocked('status', async () => {
    try {
      const r = await setScheduleStatus(status)
      const deg = r?.dsSchedule?.degraded
      const label =
        status === 'paused' ? '已暂停' : status === 'prod' ? '已恢复/上线' : status === 'draft' ? '已标为草稿' : status
      const synced = status === 'prod' || status === 'paused'
      showToast(
        synced
          ? deg
            ? `${label}（门户已更新；调度同步降级）`
            : `${label} · 调度已同步`
          : label,
        deg ? 'warning' : 'success',
      )
    } catch (e) {
      if (!toastNeedApply(e)) showToast(e.message || '状态变更失败', 'error')
    }
  })
}

async function onBackfill({ markKey, markValue } = {}) {
  if (!current.value) return
  if (!assertEditOrGuide('补数')) return
  await runLocked('backfill', async () => {
    try {
      const resp = await runBackfillWithGate(markKey, markValue)
      showToast(
        `🔧 补数已提交 ${resp?.markKey}=${resp?.markValue} · ${resp?.runId || ''}`,
        resp?.ds?.degraded ? 'warning' : 'success',
      )
      if (resp?.complianceGate?.acknowledged) {
        showToast('已确认合规补数门禁（命中已删分区）', 'warning')
      }
      if (resp?.opsPath) {
        showToast(`运维入口 ${resp.opsPath}`, 'info')
      }
      runsDrawerOpen.value = true
    } catch (e) {
      if (!toastNeedApply(e)) showToast(e.message || '补数失败', 'error')
    }
  })
}

/** E7：命中已删分区时提示回填合规请求号后重试 */
async function runBackfillWithGate(markKey, markValue, confirmReqNo) {
  try {
    return await backfillCurrent({ markKey, markValue, confirmReqNo })
  } catch (e) {
    if (!isComplianceBackfillGateError(e) || confirmReqNo) throw e
    const suggested = suggestDelReqNo(e.message)
    const typed = window.prompt(
      `${e.message}\n\n请回填合规请求号以二次确认补数：`,
      suggested,
    )
    if (!typed?.trim()) throw e
    return backfillCurrent({ markKey, markValue, confirmReqNo: typed.trim() })
  }
}

function isComplianceBackfillGateError(e) {
  return /须二次确认|confirmReqNo|已删分区/.test(e?.message || '')
}

function suggestDelReqNo(msg) {
  const m = /(DEL-\d{4}-\d+)/.exec(msg || '')
  return m ? m[1] : ''
}

async function onOpenRuns() {
  if (!current.value) return
  runsDrawerOpen.value = true
  openRunsTab()
  try {
    await refreshRuns(current.value.id)
  } catch {
    /* ignore */
  }
}

function onSelectRunNode(nodeId) {
  if (!nodeId) return
  selectNode(nodeId)
}

async function onPublish() {
  if (!current.value) return
  if (!assertEditOrGuide('发布')) return
  await runLocked('publish', async () => {
    try {
      const resp = await publishCurrent()
      const wf = resp?.dsWorkflowCode || current.value.dsWorkflowCode || ''
      const se = resp?.sideEffects || {}
      const mapN = se.stdMappingOk != null ? `映射${se.stdMappingOk}` : ''
      const linN = se.lineageOk != null ? `血缘${se.lineageOk}` : ''
      const dqN = se.qualityRunOk != null ? `质量${se.qualityRunOk}` : ''
      const vaultN = se.vault?.injected != null ? `Vault${se.vault.injected}` : ''
      const sinkN = se.sinkTarget?.created != null ? `建表${se.sinkTarget.created}` : ''
      const side = [mapN, linN, dqN, vaultN, sinkN].filter(Boolean).join('·')
      const tip = resp?.degraded
        ? `（调度降级，已登记 ${wf}）`
        : [wf && `→ ${wf}`, side, se.qualityGateBlocked ? '⚠质量阻断' : ''].filter(Boolean).join(' ')
      showToast(`🚀 已发布 ${current.value.name} ${current.value.ver} ${tip}`.trim(), se.qualityGateBlocked ? 'warning' : 'success')
    } catch (e) {
      if (!toastNeedApply(e)) showToast(e.message || '发布失败', 'error')
    }
  })
}

async function onDeleteTask() {
  const t = current.value
  if (!t) return
  if (!canDeleteCurrent.value) {
    showToast('无删除权，请申请操作权限', 'warning')
    goApplyManageEtl()
    return
  }
  const running = (t.logs || []).some((l) => {
    const s = String(l.status || '').toUpperCase()
    return s === 'RUNNING' || s === 'SUBMITTED' || s === 'PENDING'
  })
  if (running) {
    showToast('任务运行中，请等待完成后再删除', 'warning')
    return
  }
  const ok = await confirmDelete({
    title: `删除 ETL 任务「${t.name || t.dagCode}」`,
    message: '将软删任务与图配置，运行记录保留；运行中任务不可删。',
    confirmLabel: '确认删除',
  })
  if (!ok) return
  await runLocked('delete', async () => {
    try {
      const resp = await deleteCurrent()
      const deg = resp?.dsSchedule?.degraded
      showToast(deg ? '已删除（调度下线同步降级）' : '已删除任务', deg ? 'warning' : 'success')
    } catch (e) {
      if (!toastNeedApply(e)) showToast(e.message || '删除失败', 'error')
    }
  })
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

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  try {
    await Promise.all([reloadEtlList(), loadSources().catch(() => {})])
    if (lastError.value) {
      showToast(lastError.value.message || 'ETL 列表加载失败', 'warning')
    }
  } catch (e) {
    showToast(e.message || 'ETL 列表加载失败', 'error')
  }
})
watch(currentWs, () => {
  reloadEtlList().catch(() => {})
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="etl-page">
    <PageHeader
      page-id="integration"
      title="🛠️ ETL 编排"
      subtitle="多引擎编排入湖清洗出湖 · 画布配置 · 试跑与发布"
      :guide-title="guide.title"
      :guide="guide"
    >
      <span v-if="loading || saving || actionBusy" class="etl-busy">{{ saving || busy('save') ? '保存中…' : actionBusy ? '处理中…' : '加载中…' }}</span>
      <button class="btn btn-sm" :disabled="!current || saving || actionBusy" @click="onValidate">校验</button>
      <button v-if="canEditCurrent" class="btn btn-sm" :disabled="!current || saving || actionBusy" @click="onSave">保存</button>
      <button v-if="canEditCurrent" class="btn btn-sm" :disabled="!current || saving || actionBusy" @click="onTrialRun">▶ 试跑</button>
      <button class="btn btn-sm" :disabled="!current" @click="onOpenRuns">执行记录</button>
      <button v-if="canEditCurrent" class="btn btn-sm" :disabled="!current || saving || actionBusy" @click="onPublish">发布</button>
      <button v-if="canDeleteCurrent" class="btn btn-sm" :disabled="!current || saving || actionBusy" style="color: var(--danger)" @click="onDeleteTask">删除</button>
      <button v-if="needApplyOps" class="btn btn-sm" @click="goApplyManageEtl">🔐 申请操作权限</button>
      <button class="btn btn-sm btn-primary" :disabled="saving || actionBusy" @click="onNewTask">＋ 新建任务</button>
    </PageHeader>

    <div
      v-if="current?.lastValidate && current.lastValidate.ok === false"
      class="etl-validate-banner"
      role="alert"
    >
      <div class="etl-validate-banner__title">
        {{ current.lastValidate.summary || '校验未通过' }}
      </div>
      <ul class="etl-validate-banner__list">
        <li v-for="(m, i) in (current.lastValidate.messages || []).slice(0, 12)" :key="i">{{ m }}</li>
      </ul>
    </div>

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
            <div class="dti-desc">{{ t.dagCode || t.desc }}</div>
            <div class="dti-meta">
              <span class="tag" :class="statusMeta(t.status).tag" style="font-size: 10px">{{ statusMeta(t.status).label }}</span>
              <span>{{ t.engine }}</span>
              <span>{{ t.cron }}</span>
            </div>
          </button>
          <div v-if="loading && !filteredTasks.length" class="dag-config-empty">加载任务中…</div>
          <div v-else-if="!filteredTasks.length" class="dag-config-empty">无匹配任务 · 可新建或刷新列表</div>
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
              {{ current.env }} · {{ current.engine }} · {{ displayUser(current.ownerName, current.owner) }} · SLA {{ current.sla }}
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
              v-if="canEditCurrent"
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
            @move="onMoveNode"
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
          :can-manage="canEditCurrent"
          :can-delete="canDeleteCurrent"
          @update-task="onUpdateTask"
          @update-node="onUpdateNode"
          @delete-node="onDeleteNode"
          @delete-edge="onDeleteEdge"
          @trial-run="onTrialRun"
          @clear-force-tab="clearForceCfgTab"
          @open-runs="onOpenRuns"
          @set-status="onSetStatus"
          @backfill="onBackfill"
          @delete-task="onDeleteTask"
        />
      </aside>
    </div>

    <TaskRunsDrawer
      :open="runsDrawerOpen"
      :task="current"
      @close="runsDrawerOpen = false"
      @rerun="onTrialRun"
      @select-node="onSelectRunNode"
      @refresh-runs="() => current && refreshRuns(current.id)"
    />
  </div>
</template>
