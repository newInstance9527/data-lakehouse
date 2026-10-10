<script setup>
/**
 * 看板/报表维筛选：filters.dims ≡ params.dims；空=不切片；多选=IN
 */
import { computed, onMounted, ref, watch } from 'vue'
import MultiSearchSelect from '@/components/common/MultiSearchSelect.vue'
import { fetchMetricDimMembers, fetchMetricDimOptions } from '@/api/metric'
import { resolveWs } from '@/utils/ws'

const props = defineProps({
  modelValue: { type: Object, default: () => ({ dims: {} }) },
  ws: { type: String, default: '' },
  /** 非空时仅展示这些事实列（指标 grain）；空=全部已挂接 DIM */
  columnFilter: { type: Array, default: null },
})
const emit = defineEmits(['update:modelValue', 'change'])

const loading = ref(false)
const allDimDefs = ref([])
/** dimCode → { members, tree, flatOptions } */
const memberCache = ref({})

const dimDefs = computed(() => {
  const all = allDimDefs.value
  const filter = Array.isArray(props.columnFilter) ? props.columnFilter.map(String) : null
  if (!filter || !filter.length) return all
  const allow = new Set(filter)
  return all.filter((d) => allow.has(String(d.value || '')))
})

const dimsModel = computed({
  get() {
    return props.modelValue?.dims && typeof props.modelValue.dims === 'object'
      ? props.modelValue.dims
      : {}
  },
  set(next) {
    const payload = { dims: next || {} }
    emit('update:modelValue', payload)
    emit('change', payload)
  },
})

function flattenTree(nodes, depth = 0, acc = []) {
  if (!Array.isArray(nodes)) return acc
  for (const n of nodes) {
    const code = String(n.code || '').trim()
    if (!code) continue
    const pad = depth > 0 ? `${'·· '.repeat(depth)}` : ''
    acc.push({
      code,
      name: n.name || code,
      label: `${pad}${n.name || code}（${code}）`,
      depth,
    })
    if (Array.isArray(n.children) && n.children.length) {
      flattenTree(n.children, depth + 1, acc)
    }
  }
  return acc
}

function flatOptionsFromMembers(members) {
  return (members || []).map((m) => ({
    code: m.code,
    name: m.name || m.code,
    label: `${m.name || m.code}（${m.code}）`,
    depth: 0,
  }))
}

async function loadDefs() {
  loading.value = true
  try {
    const rows = await fetchMetricDimOptions({ ws: resolveWs(props.ws) })
    allDimDefs.value = (Array.isArray(rows) ? rows : []).filter(
      (r) => r.dimStatus === 'bound' && r.dimTable && r.value,
    )
  } catch {
    allDimDefs.value = []
  } finally {
    loading.value = false
  }
}

async function ensureMembers(def) {
  if (!def?.code) return
  if (memberCache.value[def.code]?.loaded) return
  memberCache.value = {
    ...memberCache.value,
    [def.code]: { loading: true, loaded: false, members: [], tree: [], flatOptions: [] },
  }
  try {
    const res = await fetchMetricDimMembers(def.code, {
      ws: resolveWs(props.ws),
      limit: 500,
    })
    const members = Array.isArray(res?.members) ? res.members : []
    const tree = Array.isArray(res?.tree) ? res.tree : []
    const flatOptions = tree.length ? flattenTree(tree) : flatOptionsFromMembers(members)
    memberCache.value = {
      ...memberCache.value,
      [def.code]: { loading: false, loaded: true, members, tree, flatOptions },
    }
  } catch (e) {
    memberCache.value = {
      ...memberCache.value,
      [def.code]: {
        loading: false,
        loaded: true,
        members: [],
        tree: [],
        flatOptions: [],
        message: e?.message || '加载失败',
      },
    }
  }
}

/** 统一为 string[]；兼容历史单值 */
function selectedList(columnName) {
  const raw = dimsModel.value[columnName]
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) return raw.map(String).filter((s) => s.trim())
  return [String(raw)]
}

function onMultiPick(columnName, codes) {
  const next = { ...dimsModel.value }
  const list = (codes || []).map(String).filter((s) => s.trim())
  if (!list.length) delete next[columnName]
  else if (list.length === 1) next[columnName] = list[0]
  else next[columnName] = list
  dimsModel.value = next
}

function optionsOf(def) {
  return (memberCache.value[def.code]?.flatOptions || []).map((m) => ({
    value: m.code,
    label: m.label,
    code: m.code,
  }))
}

watch(
  () => props.ws,
  () => {
    memberCache.value = {}
    loadDefs().then(() => Promise.all(dimDefs.value.map((d) => ensureMembers(d))))
  },
)

watch(
  dimDefs,
  (list) => {
    Promise.all((list || []).map((d) => ensureMembers(d)))
  },
  { deep: true },
)

onMounted(async () => {
  await loadDefs()
  await Promise.all(dimDefs.value.map((d) => ensureMembers(d)))
})
</script>

<template>
  <div class="met-dim-filter-bar">
    <div v-if="loading" class="tip">加载维度…</div>
    <div v-else-if="!dimDefs.length" class="tip">
      <template v-if="columnFilter?.length">
        当前指标粒度无可筛选的已挂接 DIM（或尚未绑定维表）。
      </template>
      <template v-else>
        暂无已挂接 DIM 层的业务维。请到侧栏「维度库」绑定 iceberg.dim.* 后筛选。
      </template>
    </div>
    <div v-else class="met-dim-filter-row">
      <label
        v-for="d in dimDefs"
        :key="d.code"
        class="met-dim-filter-item tip"
        @focusin="ensureMembers(d)"
      >
        <span>
          {{ d.name || d.value }}
          <span class="met-dim-multi-hint">可多选</span>
        </span>
        <MultiSearchSelect
          :model-value="selectedList(d.value)"
          :options="optionsOf(d)"
          value-key="value"
          label-key="label"
          placeholder="全部（不切片）"
          search-placeholder="搜索成员…"
          empty-text="无成员"
          :max="50"
          @update:model-value="(v) => onMultiPick(d.value, v)"
        />
        <span v-if="memberCache[d.code]?.tree?.length" class="met-dim-tree-tag">树</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.met-dim-filter-bar {
  margin-bottom: 10px;
}
.met-dim-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: flex-end;
}
.met-dim-filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  min-width: 12rem;
  max-width: 20rem;
}
.met-dim-multi-hint {
  margin-left: 4px;
  font-size: 10px;
  color: var(--text-3);
  font-weight: 400;
}
.met-dim-tree-tag {
  position: absolute;
  right: 0;
  top: 0;
  font-size: 10px;
  color: var(--text-3);
}
</style>
