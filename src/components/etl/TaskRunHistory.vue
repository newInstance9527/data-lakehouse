<script setup>
import { computed, ref, watch } from 'vue'
import { RUN_STATUS_META, buildRunDetail } from '@/utils/etlRuns'

const props = defineProps({
  task: { type: Object, default: null },
})

const emit = defineEmits(['select-run', 'rerun', 'open-full'])

const kw = ref('')
const activeRun = ref('')

const logs = computed(() => props.task?.logs || [])

const filtered = computed(() => {
  const q = kw.value.trim().toLowerCase()
  if (!q) return logs.value
  return logs.value.filter((l) =>
    `${l.run} ${l.status} ${l.note} ${l.trigger || ''}`.toLowerCase().includes(q),
  )
})

const detail = computed(() => {
  const row = logs.value.find((l) => l.run === activeRun.value) || filtered.value[0]
  if (!row) return null
  return buildRunDetail(props.task, row)
})

const summary = computed(() => {
  const list = logs.value
  const ok = list.filter((l) => l.status === 'SUCCESS').length
  const err = list.filter((l) => l.status === 'ERROR').length
  return { total: list.length, ok, err }
})

watch(
  () => props.task?.id,
  () => {
    activeRun.value = props.task?.logs?.[0]?.run || ''
  },
  { immediate: true },
)

watch(detail, (d) => {
  if (d) emit('select-run', d)
})

function openRun(run) {
  activeRun.value = run
}

function statusMeta(st) {
  return RUN_STATUS_META[st] || RUN_STATUS_META.PENDING
}
</script>

<template>
  <div class="run-panel">
    <div class="run-toolbar">
      <input v-model="kw" class="input input-sm" placeholder="检索 run…" />
      <button type="button" class="btn btn-sm btn-primary" @click="emit('rerun')">▶ 试跑</button>
    </div>

    <div class="run-summary">
      <span>共 {{ summary.total }} 次</span>
      <span class="ok">成功 {{ summary.ok }}</span>
      <span class="err">失败 {{ summary.err }}</span>
      <button type="button" class="btn-link" @click="emit('open-full')">完整界面 →</button>
    </div>

    <div v-if="!filtered.length" class="form-hint" style="padding: 16px 0; text-align: center">暂无执行记录</div>

    <div v-else class="run-list">
      <button
        v-for="l in filtered"
        :key="l.run"
        type="button"
        class="run-row"
        :class="{ active: (activeRun || filtered[0]?.run) === l.run }"
        @click="openRun(l.run)"
      >
        <div class="run-row-top">
          <code class="run-id">{{ l.run }}</code>
          <span class="tag" :class="statusMeta(l.status).tag">{{ statusMeta(l.status).label }}</span>
        </div>
        <div class="run-row-meta">
          <span>{{ l.start }}</span>
          <span>·</span>
          <span>{{ l.duration }}</span>
          <span>·</span>
          <span>{{ l.trigger || 'cron' }}</span>
        </div>
        <div class="run-row-note">{{ l.note }}</div>
      </button>
    </div>

    <template v-if="detail">
      <div class="sec-title">快览 · {{ detail.run }}</div>
      <div class="run-kv">
        <div><b>状态</b> <span class="tag" :class="statusMeta(detail.status).tag">{{ statusMeta(detail.status).label }}</span></div>
        <div><b>行数</b> {{ detail.metrics?.rowsIn }} → {{ detail.metrics?.rowsOut }}</div>
        <div><b>节点</b> {{ detail.metrics?.doneNodes }}/{{ detail.metrics?.totalNodes }} · 失败 {{ detail.metrics?.failNode }}</div>
      </div>
      <button type="button" class="btn btn-sm" style="width: 100%; margin-top: 4px" @click="emit('open-full')">
        打开完整执行详情（时间线 / 三态日志）
      </button>
    </template>
  </div>
</template>

<style scoped>
.run-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.run-toolbar {
  display: flex;
  gap: 6px;
}
.run-toolbar .input {
  flex: 1;
}
.run-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: var(--text-2);
}
.run-summary .ok { color: #52c41a; }
.run-summary .err { color: #f5222d; }
.btn-link {
  border: none;
  background: none;
  color: var(--primary, #1890ff);
  cursor: pointer;
  padding: 0;
  font-size: 11px;
  margin-left: auto;
}
.run-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 280px;
  overflow: auto;
}
.run-row {
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--bg-2, #f7f8fa);
  cursor: pointer;
}
.run-row.active {
  border-color: var(--primary, #1890ff);
  background: rgba(24, 144, 255, 0.06);
}
.run-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.run-id {
  font-size: 11px;
}
.run-row-meta {
  font-size: 10px;
  color: var(--text-3);
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.run-row-note {
  font-size: 11px;
  color: var(--text-2);
  margin-top: 2px;
}
.sec-title {
  margin: 10px 0 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
}
.run-kv {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-2);
}
</style>
