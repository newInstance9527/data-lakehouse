<script setup>
import { computed, ref, watch } from 'vue'
import FieldMapEditor from '@/components/etl/FieldMapEditor.vue'
import NodeConfBody from '@/components/etl/NodeConfBody.vue'
import TaskRunHistory from '@/components/etl/TaskRunHistory.vue'
import NodeExecLog from '@/components/etl/NodeExecLog.vue'
import {
  CRON_PRESETS,
  ENGINES,
  NODE_STATUS_META,
  NODE_TYPES,
  TASK_STATUS_META,
} from '@/data/etl'
import { useStandards } from '@/composables/useStandards'
import { autoMapFields } from '@/utils/etlFields'

const props = defineProps({
  task: { type: Object, default: null },
  node: { type: Object, default: null },
  edgeIdx: { type: Number, default: null },
  upstreamFields: { type: Array, default: () => [] },
  sourceFields: { type: Array, default: () => [] },
  targetFields: { type: Array, default: () => [] },
  forceTab: { type: String, default: null },
  canManage: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update-task',
  'update-node',
  'delete-node',
  'delete-edge',
  'delete-task',
  'trial-run',
  'clear-force-tab',
  'open-runs',
  'set-status',
  'backfill',
])

const { fieldList, ensureLoaded: ensureStdLoaded, loaded: stdLoaded } = useStandards()
const manualTab = ref(null)
const bfMarkKey = ref('dt')
const bfMarkValue = ref('')

watch(
  () => props.node?.type,
  (t) => {
    if (t === 'mapping' || (t && String(t).startsWith('sink_'))) {
      ensureStdLoaded()?.catch?.(() => {})
    }
  },
  { immediate: true },
)

const tab = computed(() => {
  // 已选中节点时优先展示节点配置，避免 forceTab=runs 挡住
  if (props.node && manualTab.value === 'node') return 'node'
  if (props.forceTab === 'runs' && manualTab.value !== 'node' && manualTab.value !== 'task' && manualTab.value !== 'edge') {
    return 'runs'
  }
  if (manualTab.value) return manualTab.value
  if (props.node) return 'node'
  if (props.edgeIdx != null) return 'edge'
  return 'task'
})

function setTab(t) {
  manualTab.value = t
  if (t !== 'runs') emit('clear-force-tab')
}

watch(
  () => props.node?.id,
  () => {
    if (props.node) {
      manualTab.value = 'node'
      emit('clear-force-tab')
    }
  },
)

watch(
  () => props.edgeIdx,
  (v) => {
    if (v != null) manualTab.value = 'edge'
  },
)

watch(
  () => props.forceTab,
  (v) => {
    if (v === 'runs') manualTab.value = 'runs'
  },
)

const nodeDef = computed(() => (props.node ? NODE_TYPES[props.node.type] : null))
const conf = computed(() => props.node?.conf || {})

const showFieldMap = computed(() => {
  const t = props.node?.type || ''
  return t === 'mapping' || t.startsWith('sink_')
})

const mapSrcFields = computed(() => props.upstreamFields)

const mapDstFields = computed(() => {
  const t = props.node?.type || ''
  if (t.startsWith('sink_')) {
    if (props.targetFields.length) return props.targetFields
    return props.upstreamFields
  }
  // mapping：目标列优先标准字段
  const std = (fieldList.value || [])
    .filter((f) => f?.name)
    .map((f) => ({
      name: f.name,
      cn: f.desc || f.description || '',
      type: f.type || f.dataType || 'STRING',
    }))
  if (std.length) return std
  if (props.targetFields.length) return props.targetFields
  return props.upstreamFields
})

function seedMapsFromStd() {
  const std = mapDstFields.value
  if (!std.length) return
  const existing = new Set((conf.value.fieldMaps || conf.value.mapList || []).map((m) => m.dst || m.std))
  const add = std
    .filter((f) => !existing.has(f.name))
    .slice(0, 20)
    .map((f) => ({
      src: '',
      dst: f.name,
      transform: conf.value.strategy === '码值 CASE' ? '码值 CASE' : '直接映射',
    }))
  if (!add.length) return
  const cur = conf.value.fieldMaps || conf.value.mapList || []
  patchConf('fieldMaps', [...cur, ...add])
}

const cronIsCustom = computed(() => {
  if (!props.task) return false
  return !CRON_PRESETS.some((c) => c.value !== 'custom' && c.value === props.task.cron)
})

function patchTask(key, val) {
  if (!props.canManage) return
  if (key === 'status') {
    emit('set-status', val)
    return
  }
  emit('update-task', { [key]: val })
}

function submitBackfill() {
  if (!props.canManage) return
  emit('backfill', {
    markKey: bfMarkKey.value?.trim(),
    markValue: bfMarkValue.value?.trim(),
  })
}

function patchNodeField(key, val) {
  if (!props.canManage || !props.node) return
  emit('update-node', props.node.id, { [key]: val })
}

function patchConf(key, val) {
  if (!props.canManage || !props.node) return
  emit('update-node', props.node.id, { conf: { [key]: val } })
}

function patchConfMany(obj) {
  if (!props.canManage || !props.node) return
  emit('update-node', props.node.id, { conf: obj })
}

function onCronPreset(v) {
  if (v === 'custom') return
  patchTask('cron', v)
}

function onFieldMaps(v) {
  patchConf('fieldMaps', v)
}

function onAutoMap() {
  patchConf('fieldMaps', autoMapFields(mapSrcFields.value, mapDstFields.value))
}
</script>

<template>
  <div class="dag-config">
    <div v-if="!task" class="dag-config-empty">请选择左侧任务</div>

    <template v-else>
      <div class="dag-cfg-tabs">
        <button type="button" class="std-tab" :class="{ active: tab === 'task' }" @click="setTab('task')">任务</button>
        <button type="button" class="std-tab" :class="{ active: tab === 'node' }" @click="setTab('node')">节点</button>
        <button type="button" class="std-tab" :class="{ active: tab === 'edge' }" @click="setTab('edge')">连线</button>
        <button type="button" class="std-tab" :class="{ active: tab === 'runs' }" @click="setTab('runs')">
          执行
          <span v-if="task.logs?.length" class="run-count">{{ task.logs.length }}</span>
        </button>
      </div>

      <div v-show="tab === 'task'" class="dag-cfg-body">
        <div v-if="!canManage" class="form-hint" style="margin-bottom: 10px">
          无编辑权：配置只读。可申请操作权限后改配置 / 补数 / 启停。
        </div>
        <label class="form-field">
          <span class="form-label">任务名</span>
          <input class="input" :value="task.name" :disabled="!canManage" @input="patchTask('name', $event.target.value)" />
        </label>
        <label class="form-field">
          <span class="form-label">描述</span>
          <textarea class="textarea" rows="2" :value="task.desc" :disabled="!canManage" @input="patchTask('desc', $event.target.value)" />
        </label>
        <label class="form-field">
          <span class="form-label">调度 Cron</span>
          <select class="select" :value="cronIsCustom ? 'custom' : task.cron" :disabled="!canManage" @change="onCronPreset($event.target.value)">
            <option v-for="c in CRON_PRESETS" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
          <input class="input" style="margin-top: 6px" :value="task.cron" placeholder="0 2 * * *" :disabled="!canManage" @input="patchTask('cron', $event.target.value)" />
        </label>
        <div class="form-grid-2">
          <label class="form-field">
            <span class="form-label">SLA</span>
            <select class="select" :value="task.sla" :disabled="!canManage" @change="patchTask('sla', $event.target.value)">
              <option>04:00</option><option>06:00</option><option>06:30</option><option>08:00</option><option>12:00</option>
            </select>
          </label>
          <label class="form-field">
            <span class="form-label">环境</span>
            <select class="select" :value="task.env" :disabled="!canManage" @change="patchTask('env', $event.target.value)">
              <option value="dev">dev</option><option value="test">test</option><option value="prod">prod</option>
            </select>
          </label>
          <label class="form-field">
            <span class="form-label">主引擎</span>
            <select class="select" :value="task.engine" :disabled="!canManage" @change="patchTask('engine', $event.target.value)">
              <option v-for="e in ENGINES" :key="e" :value="e">{{ e }}</option>
            </select>
            <div class="form-hint">任务级默认运行时；仅 SQL 计算等节点可覆盖。</div>
          </label>
          <label class="form-field">
            <span class="form-label">状态</span>
            <select class="select" :value="task.status" :disabled="!canManage" @change="patchTask('status', $event.target.value)">
              <option v-for="(m, k) in TASK_STATUS_META" :key="k" :value="k">{{ m.label }}</option>
            </select>
            <div class="form-hint">prod / paused 会同步 DS 流程上线/下线</div>
          </label>
        </div>
        <label class="form-field">
          <span class="form-label">负责人</span>
          <input class="input" :value="task.owner" :disabled="!canManage" @input="patchTask('owner', $event.target.value)" />
          <div v-if="task.ownerName" class="form-hint">{{ task.ownerName }}</div>
        </label>
        <div class="form-hint">节点 {{ task.nodes?.length || 0 }} · 连线 {{ task.edges?.length || 0 }} · 版本 {{ task.ver }}</div>
        <div class="form-hint" style="margin-top: 8px">
          最近执行：
          <template v-if="task.logs?.[0]">
            <code>{{ task.logs[0].run }}</code> · {{ task.logs[0].status }} ·
            <button type="button" class="btn-link" @click="emit('open-runs')">完整记录</button>
          </template>
          <template v-else>暂无记录</template>
        </div>

        <div class="sec-title" style="margin-top: 14px">补数（水位）</div>
        <template v-if="canManage">
          <div class="form-grid-2">
            <label class="form-field">
              <span class="form-label">mark_key</span>
              <input v-model="bfMarkKey" class="input" placeholder="dt" />
            </label>
            <label class="form-field">
              <span class="form-label">mark_value</span>
              <input v-model="bfMarkValue" class="input" placeholder="2026-09-18" />
            </label>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            style="margin-top: 6px"
            :disabled="!task || (task.status !== 'prod' && task.status !== 'paused')"
            @click="submitBackfill"
          >🔧 发起补数</button>
          <div class="form-hint">仅 prod/paused 可补；写水位并触发 DS 实例，生成带 run_id 的执行记录</div>
        </template>
        <div v-else class="form-hint">无编辑权不可补数</div>

        <div class="sec-title" style="margin-top: 18px">危险操作</div>
        <button
          v-if="canDelete"
          type="button"
          class="btn btn-sm"
          style="color: var(--danger)"
          :disabled="!task"
          @click="emit('delete-task')"
        >删除任务</button>
        <div v-if="canDelete" class="form-hint">软删任务与图配置；运行中不可删；须输入 delete 确认</div>
        <div v-else class="form-hint">无删除权不可删除，请申请操作权限</div>
      </div>

      <div v-show="tab === 'node'" class="dag-cfg-body">
        <div v-if="!node" class="dag-config-empty">点击画布节点进行配置</div>
        <template v-else>
          <div v-if="!canManage" class="form-hint" style="margin-bottom: 10px">无编辑权：节点配置只读</div>
          <div class="dag-cfg-node-head">
            <span class="tag" :style="{ borderColor: nodeDef?.color, color: nodeDef?.color }">{{ nodeDef?.label || node.type }}</span>
            <code style="font-size: 11px; color: var(--text-3)">{{ node.id }}</code>
          </div>
          <label class="form-field">
            <span class="form-label">节点名称</span>
            <input class="input" :value="node.name" :disabled="!canManage" @input="patchNodeField('name', $event.target.value)" />
          </label>
          <label class="form-field">
            <span class="form-label">节点说明</span>
            <input class="input" :value="node.meta" :disabled="!canManage" @input="patchNodeField('meta', $event.target.value)" placeholder="点击配置" />
          </label>
          <label class="form-field">
            <span class="form-label">执行状态</span>
            <select class="select" :value="node.status || 'pending'" :disabled="!canManage" @change="patchNodeField('status', $event.target.value)">
              <option v-for="(m, k) in NODE_STATUS_META" :key="k" :value="k">{{ m.label }}</option>
            </select>
          </label>

          <div :class="{ 'dag-cfg-readonly': !canManage }">
            <NodeConfBody
              :type="node.type"
              :conf="conf"
              :upstream-fields="upstreamFields"
              @patch="patchConf"
              @patch-many="patchConfMany"
            />
          </div>

          <div v-if="showFieldMap" class="sec-title" style="margin-top: 14px">字段映射</div>
          <div v-if="showFieldMap && canManage && node.type === 'mapping'" class="form-hint">
            目标列来自<strong>数据标准字段</strong>；可先选节点上的 stdRef/码值，再点「带入标准字段」补齐映射行。
            <button
              type="button"
              class="btn btn-sm"
              style="margin-left: 8px"
              :disabled="!stdLoaded || !mapDstFields.length"
              @click="seedMapsFromStd"
            >带入标准字段</button>
          </div>
          <div v-if="showFieldMap && canManage && String(node.type).startsWith('sink_')" class="form-hint">
            将上游输出写入目标表：请先配置目标表，再做 upstream → 目标列映射。
          </div>
          <div v-if="showFieldMap && canManage && !mapSrcFields.length" class="form-hint" style="color: #d48806">
            暂无上游字段：请确认①源节点已选<strong>表</strong>并连线到本节点；②数据源已同步表清单；③保存后重新点开本节点。
          </div>
          <FieldMapEditor
            v-if="showFieldMap && canManage"
            style="margin-top: 8px"
            :model-value="conf.fieldMaps || conf.mapList || []"
            :src-fields="mapSrcFields"
            :dst-fields="mapDstFields"
            src-label="上游字段"
            :dst-label="String(node.type).startsWith('sink_') ? '目标表字段' : '标准字段'"
            @update:model-value="onFieldMaps"
            @auto-map="onAutoMap"
          />
          <div v-else-if="showFieldMap" class="form-hint" style="margin-top: 8px">
            映射行 {{ (conf.fieldMaps || conf.mapList || []).length }}（只读）
          </div>

          <NodeExecLog :task="task" :node="node" />

          <button
            v-if="canManage"
            type="button"
            class="btn btn-sm"
            style="margin-top: 12px; color: var(--danger)"
            @click="emit('delete-node', node.id)"
          >
            删除节点
          </button>
        </template>
      </div>

      <div v-show="tab === 'edge'" class="dag-cfg-body">
        <div v-if="edgeIdx == null" class="dag-config-empty">点击画布连线进行操作</div>
        <template v-else>
          <div class="form-hint">已选连线 #{{ edgeIdx + 1 }}：{{ task.edges[edgeIdx]?.from }} → {{ task.edges[edgeIdx]?.to }}</div>
          <button
            v-if="canManage"
            type="button"
            class="btn btn-sm"
            style="margin-top: 12px; color: var(--danger)"
            @click="emit('delete-edge', edgeIdx)"
          >
            删除连线
          </button>
          <div v-else class="form-hint" style="margin-top: 12px">无编辑权不可删连线</div>
        </template>
      </div>

      <div v-show="tab === 'runs'" class="dag-cfg-body">
        <TaskRunHistory
          :task="task"
          @rerun="emit('trial-run')"
          @open-full="emit('open-runs')"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.sec-title {
  margin: 14px 0 4px;
  padding-top: 10px;
  border-top: 1px solid var(--border, #e5e7eb);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3, #8c8c8c);
}
.dag-cfg-tabs .std-tab {
  border: none;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.run-count {
  font-size: 10px;
  background: var(--bg-2, #f0f0f0);
  color: var(--text-2);
  border-radius: 8px;
  padding: 0 5px;
  line-height: 16px;
}
.btn-link {
  border: none;
  background: none;
  color: var(--primary, #1890ff);
  cursor: pointer;
  padding: 0;
  font-size: inherit;
}
.dag-cfg-readonly {
  pointer-events: none;
  opacity: 0.72;
}
</style>
