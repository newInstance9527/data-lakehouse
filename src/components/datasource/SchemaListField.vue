<script setup>
import { computed, ref, watch } from 'vue'
import {
  joinSchemaList,
  mockSyncItems,
  parseSchemaList,
} from '@/utils/schemaList'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '表清单' },
  canSync: { type: Boolean, default: false },
  placeholder: { type: String, default: '输入名称后添加' },
  sourceType: { type: String, default: 'MySQL' },
  fieldName: { type: String, default: 'schema' },
  seed: { type: String, default: '' },
  /** 抽屉场景：已连接，默认可同步 */
  alwaysSyncable: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'sync'])

const { showToast } = useToast()
const draft = ref('')
const items = ref(parseSchemaList(props.modelValue))
const syncing = ref(false)

watch(
  () => props.modelValue,
  (v) => {
    const next = parseSchemaList(v)
    const cur = items.value.join('\0')
    if (next.join('\0') !== cur) items.value = next
  },
)

const syncEnabled = computed(() => props.alwaysSyncable || props.canSync)

function commit(next) {
  items.value = next
  emit('update:modelValue', joinSchemaList(next))
}

function addItem() {
  const name = draft.value.trim()
  if (!name) {
    showToast('请输入清单项名称', 'warning')
    return
  }
  if (items.value.includes(name)) {
    showToast('该项已存在', 'warning')
    return
  }
  commit([...items.value, name])
  draft.value = ''
}

function removeItem(idx) {
  const next = items.value.slice()
  next.splice(idx, 1)
  commit(next)
}

function onDraftKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addItem()
  }
}

function syncList() {
  if (!syncEnabled.value) {
    showToast('请先测试连通性后再同步', 'warning')
    return
  }
  syncing.value = true
  showToast(`🔄 正在同步${props.label}…`, 'info')
  setTimeout(() => {
    const mocked = mockSyncItems(props.sourceType, props.fieldName, props.seed)
    const merged = [...items.value]
    mocked.forEach((x) => {
      if (!merged.includes(x)) merged.push(x)
    })
    commit(merged)
    syncing.value = false
    showToast(`✅ 已同步 ${mocked.length} 项 · 当前共 ${merged.length} 项`, 'success')
    emit('sync', joinSchemaList(merged))
  }, 500)
}
</script>

<template>
  <div class="schema-list-field">
    <div class="schema-list-toolbar">
      <span class="schema-list-count">共 {{ items.length }} 项</span>
      <button
        type="button"
        class="btn btn-sm"
        :disabled="!syncEnabled || syncing"
        @click="syncList"
      >
        {{ syncing ? '同步中…' : '🔄 同步清单' }}
      </button>
    </div>

    <div class="schema-list-add">
      <input
        v-model="draft"
        class="input"
        :placeholder="placeholder"
        @keydown="onDraftKey"
      />
      <button type="button" class="btn btn-sm" @click="addItem">＋ 添加</button>
    </div>

    <div v-if="!items.length" class="schema-list-empty">
      未同步，可手动添加或{{ alwaysSyncable ? '' : '先测通后' }}点击「同步清单」
    </div>
    <ul v-else class="schema-list">
      <li v-for="(item, idx) in items" :key="item + idx" class="schema-list-row">
        <span class="schema-list-name">{{ item }}</span>
        <button type="button" class="btn-link btn-sm" @click="removeItem(idx)">删除</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.schema-list-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.schema-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.schema-list-count {
  font-size: 11px;
  color: var(--text-3);
}
.schema-list-add {
  display: flex;
  gap: 8px;
  align-items: center;
}
.schema-list-add .input {
  flex: 1;
  min-width: 0;
}
.schema-list-empty {
  padding: 14px 12px;
  font-size: 12px;
  color: var(--text-3);
  background: var(--bg-2);
  border-radius: 6px;
  border: 1px dashed var(--border);
}
.schema-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  max-height: 220px;
  overflow: auto;
  background: #fff;
}
.schema-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
}
.schema-list-row:last-child {
  border-bottom: none;
}
.schema-list-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--text-1);
  word-break: break-all;
}
</style>
