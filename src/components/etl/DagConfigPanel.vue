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
})

const emit = defineEmits([
  'update-task',
  'update-node',
  'delete-node',
  'delete-edge',
  'trial-run',
  'clear-force-tab',
  'open-runs',
])

const { fieldList } = useStandards()
const manualTab = ref(null)

const tab = computed(() => {
  if (props.forceTab === 'runs') return 'runs'
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
    if (props.node) manualTab.value = 'node'
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
  if (props.targetFields.length) return props.targetFields
  const std = fieldList.value.map((f) => ({ name: f.name, cn: f.desc, type: f.type }))
  return std.length ? std : props.upstreamFields
})

const cronIsCustom = computed(() => {
  if (!props.task) return false
  return !CRON_PRESETS.some((c) => c.value !== 'custom' && c.value === props.task.cron)
})

function patchTask(key, val) {
  emit('update-task', { [key]: val })
}

function patchNodeField(key, val) {
  if (!props.node) return
  emit('update-node', props.node.id, { [key]: val })
}

function patchConf(key, val) {
  if (!props.node) return
  emit('update-node', props.node.id, { conf: { [key]: val } })
}

function patchConfMany(obj) {
  if (!props.node) return
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
        <label class="form-field">
          <span class="form-label">任务名</span>
          <input class="input" :value="task.name" @input="patchTask('name', $event.target.value)" />
        </label>
        <label class="form-field">
          <span class="form-label">描述</span>
          <textarea class="textarea" rows="2" :value="task.desc" @input="patchTask('desc', $event.target.value)" />
        </label>
        <label class="form-field">
          <span class="form-label">调度 Cron</span>
          <select class="select" :value="cronIsCustom ? 'custom' : task.cron" @change="onCronPreset($event.target.value)">
            <option v-for="c in CRON_PRESETS" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
          <input class="input" style="margin-top: 6px" :value="task.cron" placeholder="0 2 * * *" @input="patchTask('cron', $event.target.value)" />
        </label>
        <div class="form-grid-2">
          <label class="form-field">
            <span class="form-label">SLA</span>
            <select class="select" :value="task.sla" @change="patchTask('sla', $event.target.value)">
              <option>04:00</option><option>06:00</option><option>06:30</option><option>08:00</option><option>12:00</option>
            </select>
          </label>
          <label class="form-field">
            <span class="form-label">环境</span>
            <select class="select" :value="task.env" @change="patchTask('env', $event.target.value)">
              <option value="dev">dev</option><option value="test">test</option><option value="prod">prod</option>
            </select>
          </label>
          <label class="form-field">
            <span class="form-label">主引擎</span>
            <select class="select" :value="task.engine" @change="patchTask('engine', $event.target.value)">
              <option v-for="e in ENGINES" :key="e" :value="e">{{ e }}</option>
            </select>
            <div class="form-hint">任务级默认运行时；仅 SQL 计算等节点可覆盖。</div>
          </label>
          <label class="form-field">
            <span class="form-label">状态</span>
            <select class="select" :value="task.status" @change="patchTask('status', $event.target.value)">
              <option v-for="(m, k) in TASK_STATUS_META" :key="k" :value="k">{{ m.label }}</option>
            </select>
          </label>
        </div>
        <label class="form-field">
          <span class="form-label">负责人</span>
          <input class="input" :value="task.owner" @input="patchTask('owner', $event.target.value)" />
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
      </div>

      <div v-show="tab === 'node'" class="dag-cfg-body">
        <div v-if="!node" class="dag-config-empty">点击画布节点进行配置</div>
        <template v-else>
          <div class="dag-cfg-node-head">
            <span class="tag" :style="{ borderColor: nodeDef?.color, color: nodeDef?.color }">{{ nodeDef?.label || node.type }}</span>
            <code style="font-size: 11px; color: var(--text-3)">{{ node.id }}</code>
          </div>
          <label class="form-field">
            <span class="form-label">节点名称</span>
            <input class="input" :value="node.name" @input="patchNodeField('name', $event.target.value)" />
          </label>
          <label class="form-field">
            <span class="form-label">节点说明</span>
            <input class="input" :value="node.meta" @input="patchNodeField('meta', $event.target.value)" placeholder="点击配置" />
          </label>
          <label class="form-field">
            <span class="form-label">执行状态</span>
            <select class="select" :value="node.status || 'pending'" @change="patchNodeField('status', $event.target.value)">
              <option v-for="(m, k) in NODE_STATUS_META" :key="k" :value="k">{{ m.label }}</option>
            </select>
          </label>

          <NodeConfBody
            :type="node.type"
            :conf="conf"
            :upstream-fields="upstreamFields"
            @patch="patchConf"
            @patch-many="patchConfMany"
          />

          <div v-if="showFieldMap" class="sec-title" style="margin-top: 14px">字段映射</div>
          <div v-if="showFieldMap && String(node.type).startsWith('sink_')" class="form-hint">
            将上游输出写入目标表：请先配置目标表，再做 upstream → 目标列映射。
          </div>
          <FieldMapEditor
            v-if="showFieldMap"
            style="margin-top: 8px"
            :model-value="conf.fieldMaps || conf.mapList || []"
            :src-fields="mapSrcFields"
            :dst-fields="mapDstFields"
            src-label="上游字段"
            :dst-label="String(node.type).startsWith('sink_') ? '目标表字段' : '标准/目标字段'"
            @update:model-value="onFieldMaps"
            @auto-map="onAutoMap"
          />

          <NodeExecLog :task="task" :node="node" />

          <button type="button" class="btn btn-sm" style="margin-top: 12px; color: var(--danger)" @click="emit('delete-node', node.id)">
            删除节点
          </button>
        </template>
      </div>

      <div v-show="tab === 'edge'" class="dag-cfg-body">
        <div v-if="edgeIdx == null" class="dag-config-empty">点击画布连线进行操作</div>
        <template v-else>
          <div class="form-hint">已选连线 #{{ edgeIdx + 1 }}：{{ task.edges[edgeIdx]?.from }} → {{ task.edges[edgeIdx]?.to }}</div>
          <button type="button" class="btn btn-sm" style="margin-top: 12px; color: var(--danger)" @click="emit('delete-edge', edgeIdx)">
            删除连线
          </button>
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
</style>
