<script setup>
import { computed } from 'vue'
import { RUN_STATUS_META, latestNodeLogs } from '@/utils/etlRuns'

const props = defineProps({
  task: { type: Object, default: null },
  node: { type: Object, default: null },
})

const pack = computed(() => latestNodeLogs(props.task, props.node?.id))

function levelClass(level) {
  if (level === 'ERROR') return 'err'
  if (level === 'WARN') return 'warn'
  return ''
}

function statusMeta(st) {
  if (st === 'blocked') return RUN_STATUS_META.ERROR
  if (st === 'running') return RUN_STATUS_META.RUNNING
  if (st === 'pending') return RUN_STATUS_META.PENDING
  if (st === 'ERROR' || st === 'SUCCESS' || st === 'RUNNING') return RUN_STATUS_META[st]
  return RUN_STATUS_META.SUCCESS
}
</script>

<template>
  <div class="nel">
    <div class="nel-head">
      <span class="form-label" style="margin: 0">节点执行日志</span>
      <span v-if="pack.run" class="form-hint">run: {{ pack.run }}</span>
      <span class="tag" :class="statusMeta(pack.status).tag">{{ statusMeta(pack.status).label }}</span>
    </div>
    <div v-if="pack.start" class="form-hint">{{ pack.start }} → {{ pack.end || '—' }} · {{ pack.duration || '—' }}</div>
    <div class="nel-lines">
      <div v-for="(line, i) in pack.lines" :key="i" class="nel-line" :class="levelClass(line.level)">
        <span class="nel-t">{{ line.t }}</span>
        <span class="nel-lv">{{ line.level }}</span>
        <span class="nel-msg">{{ line.msg }}</span>
      </div>
      <div v-if="!pack.lines?.length" class="form-hint">暂无日志</div>
    </div>
  </div>
</template>

<style scoped>
.nel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.nel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.nel-lines {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  background: #0f172a0a;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  max-height: 220px;
  overflow: auto;
}
.nel-line {
  display: grid;
  grid-template-columns: 72px 48px 1fr;
  gap: 6px;
}
.nel-line.err {
  color: #cf1322;
}
.nel-line.warn {
  color: #d48806;
}
.nel-t {
  color: var(--text-3);
}
.nel-lv {
  font-weight: 700;
}
</style>
