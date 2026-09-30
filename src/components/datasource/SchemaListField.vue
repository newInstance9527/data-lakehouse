<script setup>
import { computed, ref, watch } from 'vue'
import {
  formatHttpApiEntry,
  HTTP_API_METHODS,
  isHttpApiInventory,
  isPathLikeInventory,
  joinSchemaList,
  parseHttpApiEntry,
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
  /**
   * 真实同步：返回名称数组（或 { names/tables/schema }）
   * 未提供时禁用「同步清单」（避免再生成 mock 假表）
   */
  discover: { type: Function, default: null },
})

const emit = defineEmits(['update:modelValue', 'sync'])

const { showToast } = useToast()
const draft = ref('')
const draftMethod = ref('GET')
const listOpts = computed(() => ({
  sourceType: props.sourceType,
  fieldName: props.fieldName,
  label: props.label,
  pathLike: isPathLikeInventory(props.sourceType, props.fieldName, props.label),
}))
const httpApiMode = computed(() =>
  isHttpApiInventory(props.sourceType, props.fieldName, props.label),
)
const items = ref(parseSchemaList(props.modelValue, listOpts.value))
const syncing = ref(false)

watch(
  () => props.modelValue,
  (v) => {
    const next = parseSchemaList(v, listOpts.value)
    const cur = items.value.join('\0')
    if (next.join('\0') !== cur) items.value = next
  },
)

watch(
  () => [props.sourceType, props.fieldName, props.label],
  () => {
    const next = parseSchemaList(props.modelValue, listOpts.value)
    const cur = items.value.join('\0')
    if (next.join('\0') !== cur) items.value = next
  },
)

const syncEnabled = computed(
  () => !!props.discover && (props.alwaysSyncable || props.canSync),
)

const pathPlaceholder = computed(() => {
  if (httpApiMode.value) return '/api/users 或粘贴 GET /api/users'
  return props.placeholder
})

function commit(next) {
  items.value = next
  emit('update:modelValue', joinSchemaList(next, listOpts.value))
}

function normalizeIncomingNames(rawNames) {
  if (!httpApiMode.value) return rawNames
  return rawNames
    .map((n) => {
      const parsed = parseHttpApiEntry(n)
      if (parsed.method) return formatHttpApiEntry(parsed.method, parsed.path)
      // 纯 path：用当前下拉方法补齐
      return formatHttpApiEntry(draftMethod.value, parsed.path || n)
    })
    .filter(Boolean)
}

function addItem() {
  const raw = draft.value.trim()
  if (!raw) {
    showToast(httpApiMode.value ? '请输入接口 Path' : '请输入清单项名称', 'warning')
    return
  }
  let names
  if (httpApiMode.value) {
    // 支持一次粘贴多条：GET /a, POST /b；单条则带上所选方法
    const parts = parseSchemaList(raw, listOpts.value)
    if (parts.length > 1) {
      names = normalizeIncomingNames(parts)
    } else {
      const one = formatHttpApiEntry(draftMethod.value, raw)
      names = one ? [one] : []
    }
  } else if (listOpts.value.pathLike) {
    names = parseSchemaList(raw, listOpts.value)
  } else {
    names = [raw]
  }
  if (!names.length) {
    showToast(httpApiMode.value ? '请输入接口 Path' : '请输入清单项名称', 'warning')
    return
  }
  const next = [...items.value]
  let added = 0
  for (const name of names) {
    if (next.includes(name)) continue
    next.push(name)
    added += 1
  }
  if (!added) {
    showToast(names.length === 1 ? '该项已存在' : '这些项均已存在', 'warning')
    return
  }
  commit(next)
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

function entryParts(item) {
  return parseHttpApiEntry(item)
}

function normalizeDiscoverResult(res) {
  if (Array.isArray(res)) {
    return res.map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean)
  }
  if (Array.isArray(res?.names)) return res.names.filter(Boolean)
  if (Array.isArray(res?.tables)) {
    return res.tables.map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
  }
  if (typeof res?.schema === 'string') return parseSchemaList(res.schema, listOpts.value)
  return []
}

async function syncList() {
  if (!props.discover) {
    showToast('请先测试连通性后再同步真实表清单', 'warning')
    return
  }
  if (!syncEnabled.value) {
    showToast('请先测试连通性后再同步', 'warning')
    return
  }
  syncing.value = true
  showToast(`🔄 正在同步${props.label}…`, 'info')
  try {
    const res = await props.discover()
    let names = normalizeDiscoverResult(res)
    if (httpApiMode.value) {
      names = names.map((n) => {
        const p = parseHttpApiEntry(n)
        return p.method
          ? formatHttpApiEntry(p.method, p.path)
          : formatHttpApiEntry('GET', p.path || n)
      })
    }
    commit(names)
    showToast(`✅ 已同步 ${names.length} 项（源端真实表）`, 'success')
    emit('sync', joinSchemaList(names, listOpts.value))
  } catch (e) {
    showToast(`同步失败：${e?.message || e}`, 'error')
  } finally {
    syncing.value = false
  }
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
      <select
        v-if="httpApiMode"
        v-model="draftMethod"
        class="select schema-list-method"
        title="请求方式"
      >
        <option v-for="m in HTTP_API_METHODS" :key="m" :value="m">{{ m }}</option>
      </select>
      <input
        v-model="draft"
        class="input"
        :placeholder="pathPlaceholder"
        @keydown="onDraftKey"
      />
      <button type="button" class="btn btn-sm" @click="addItem">＋ 添加</button>
    </div>

    <div v-if="!items.length" class="schema-list-empty">
      <template v-if="httpApiMode">
        未同步，可选择请求方式并填写 Path 添加；也支持粘贴
        <code>GET /a, POST /b</code>
      </template>
      <template v-else>
        未同步，可手动添加或{{ alwaysSyncable ? '' : '先测通后' }}点击「同步清单」拉取源端真实表
      </template>
    </div>
    <ul v-else class="schema-list">
      <li v-for="(item, idx) in items" :key="item + idx" class="schema-list-row">
        <span class="schema-list-name">
          <template v-if="httpApiMode && entryParts(item).method">
            <span class="schema-list-verb">{{ entryParts(item).method }}</span>
            <span>{{ entryParts(item).path }}</span>
          </template>
          <template v-else>{{ item }}</template>
        </span>
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
.schema-list-method {
  width: 108px;
  flex-shrink: 0;
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
.schema-list-empty code {
  font-size: 11px;
  color: var(--text-2);
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
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.schema-list-verb {
  display: inline-block;
  min-width: 3.2em;
  font-weight: 600;
  font-size: 11px;
  color: var(--primary, #1890ff);
  flex-shrink: 0;
}
</style>
