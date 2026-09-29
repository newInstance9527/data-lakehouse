<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** pending = 待投影；failed = 投影失败 */
  mode: { type: String, default: 'pending' },
  items: { type: Array, default: () => [] },
  projecting: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'project-all', 'project-one'])

const isFailed = computed(() => props.mode === 'failed')
const expandedErr = ref({})

watch(
  () => props.open,
  (v) => {
    if (!v) expandedErr.value = {}
  },
)

const title = computed(() =>
  isFailed.value ? `重试失败 (${props.items.length})` : `投影待同步源 (${props.items.length})`,
)

const subtitle = computed(() =>
  isFailed.value
    ? '以下数据源投影到接口服务失败，可单条或全部重试；按最近同步时间倒序'
    : '以下可投影数据源尚未同步到接口服务，可单条或全部投影；按最近同步时间倒序',
)

const primaryLabel = computed(() =>
  isFailed.value ? `全部重试失败项 (${props.items.length})` : `全部投影 (${props.items.length})`,
)

const sortedItems = computed(() => {
  const list = [...(props.items || [])]
  const ts = (v) => {
    if (!v) return 0
    const t = new Date(v).getTime()
    return Number.isFinite(t) ? t : 0
  }
  list.sort((a, b) => ts(b.lastSyncAt) - ts(a.lastSyncAt))
  return list
})

function syncStateLabel(d) {
  const s = (d?.syncState || '').toLowerCase()
  if (s === 'error') return '失败'
  if (s === 'synced') return '已投影'
  if (s === 'stale') return '待刷新'
  if (s === 'never' || !s) return '未投影'
  return d.syncState || '—'
}

function formatTime(v) {
  if (!v) return '—'
  if (typeof v === 'string') {
    const s = v.replace('T', ' ')
    return s.length > 19 ? s.slice(0, 19) : s
  }
  try {
    const d = v instanceof Date ? v : new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return String(v)
  }
}

function rowKey(d, i) {
  return String(d.id || d.dsCode || i)
}

function toggleErr(key) {
  expandedErr.value = { ...expandedErr.value, [key]: !expandedErr.value[key] }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-mask" @click.self="emit('close')">
      <div
        class="modal proj-sync-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div class="modal-hd">
          <div>
            <div class="modal-title">{{ title }}</div>
            <div class="tip">{{ subtitle }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="emit('close')">✕</button>
        </div>
        <div class="modal-bd">
          <div v-if="!sortedItems.length" class="proj-empty tip">暂无相关数据源</div>
          <div v-else class="proj-table-wrap">
            <table class="table proj-table">
              <thead>
                <tr>
                  <th>名称 / 编码</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th v-if="isFailed">错误信息</th>
                  <th>最近同步</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(d, i) in sortedItems" :key="rowKey(d, i)">
                  <td>
                    <div class="proj-name">{{ d.name || d.dsCode || d.id || '—' }}</div>
                    <div class="tip proj-id">{{ d.dsCode || d.id }}</div>
                  </td>
                  <td>{{ d.type || '—' }}</td>
                  <td>
                    <span
                      class="tag"
                      :class="isFailed || d.syncState === 'error' ? 'tag-red' : 'tag-orange'"
                    >
                      {{ syncStateLabel(d) }}
                    </span>
                  </td>
                  <td v-if="isFailed" class="proj-err">
                    <template v-if="d.lastError">
                      <button
                        type="button"
                        class="btn-link err-toggle"
                        @click="toggleErr(rowKey(d, i))"
                      >
                        {{ expandedErr[rowKey(d, i)] ? '收起' : '展开' }}
                      </button>
                      <div
                        class="err-text"
                        :class="{ open: expandedErr[rowKey(d, i)] }"
                        :title="d.lastError"
                      >
                        {{ d.lastError }}
                      </div>
                    </template>
                    <span v-else class="tip">未知错误</span>
                  </td>
                  <td class="proj-time">{{ formatTime(d.lastSyncAt) }}</td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-sm"
                      :disabled="projecting || !d.id"
                      @click="emit('project-one', d)"
                    >
                      {{ isFailed ? '重试' : '投影' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="emit('close')">关闭</button>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="projecting || !sortedItems.length"
            @click="emit('project-all')"
          >
            {{ projecting ? '处理中…' : primaryLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
}
.proj-sync-modal {
  width: min(860px, 94vw);
  max-height: min(80vh, 720px);
  display: flex;
  flex-direction: column;
  background: var(--bg, #fff);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
.modal-hd,
.modal-ft {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border, #eee);
  flex-shrink: 0;
}
.modal-ft {
  border-bottom: none;
  border-top: 1px solid var(--border, #eee);
  gap: 8px;
  justify-content: flex-end;
}
.modal-title {
  font-weight: 600;
}
.modal-bd {
  padding: 12px 16px 16px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.proj-empty {
  padding: 24px;
  text-align: center;
}
.proj-table-wrap {
  overflow-x: auto;
}
.proj-table {
  width: 100%;
  font-size: 12px;
}
.proj-name {
  font-weight: 600;
}
.proj-id {
  margin-top: 2px;
  font-family: monospace;
  font-size: 11px;
}
.proj-err {
  max-width: 260px;
}
.err-toggle {
  font-size: 11px;
  padding: 0;
  margin-bottom: 4px;
  background: none;
  border: none;
  color: var(--primary, #1e6fff);
  cursor: pointer;
}
.err-text {
  max-height: 1.4em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--danger, #c0392b);
  font-size: 11px;
}
.err-text.open {
  max-height: none;
  white-space: pre-wrap;
  word-break: break-word;
}
.proj-time {
  white-space: nowrap;
  font-size: 11px;
  color: var(--text-2, #64748b);
}
</style>
