<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSizeSelect from '@/components/common/PageSizeSelect.vue'
import { useDatasources } from '@/composables/useDatasources'
import { useToast } from '@/composables/useToast'
import { enrichTableMeta } from '@/utils/schemaList'
import { endpointOf, statusMeta } from '@/data/datasources'
import { pageGuideOf } from '@/data/pageGuides'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const tablesGuide = pageGuideOf('source-tables')
const {
  getSource,
  loadSources,
  ensureTables,
  syncTables,
  addTable,
  removeTable,
  patchTable,
} = useDatasources()

const sourceId = computed(() => String(route.params.id || ''))
const source = computed(() => getSource(sourceId.value))

const kw = ref('')
const page = ref(1)
const pageSize = ref(10)
const syncing = ref(false)
const showAdd = ref(false)
const draft = reactive({
  name: '',
  cnName: '',
  comment: '',
  encoding: 'utf8mb4',
  engine: '',
})

onMounted(async () => {
  if (!getSource(sourceId.value)) {
    try {
      await loadSources()
    } catch (e) {
      showToast(`加载失败：${e.message || e}`, 'error')
    }
  }
  if (sourceId.value && getSource(sourceId.value)) {
    try {
      await ensureTables(sourceId.value)
    } catch (e) {
      showToast(`加载表清单失败：${e.message || e}`, 'error')
    }
  }
})

watch(
  sourceId,
  async (id) => {
    if (id && getSource(id)) {
      try {
        await ensureTables(id)
      } catch (e) {
        showToast(`加载表清单失败：${e.message || e}`, 'error')
      }
    }
  },
)

watch([kw, pageSize], () => {
  page.value = 1
})

const tables = computed(() => {
  const s = source.value
  if (!s) return []
  return Array.isArray(s.tables) ? s.tables : []
})

const filtered = computed(() => {
  const q = kw.value.trim().toLowerCase()
  if (!q) return tables.value
  return tables.value.filter((t) =>
    `${t.name} ${t.cnName} ${t.comment} ${t.encoding} ${t.engine}`
      .toLowerCase()
      .includes(q),
  )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))

const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const pageNums = computed(() => {
  const total = totalPages.value
  const cur = page.value
  const nums = []
  const push = (n) => {
    if (!nums.includes(n) && n >= 1 && n <= total) nums.push(n)
  }
  push(1)
  for (let i = cur - 1; i <= cur + 1; i++) push(i)
  push(total)
  return nums.sort((a, b) => a - b)
})

function goBack() {
  router.push('/datasource')
}

function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
}

async function onSync() {
  if (!source.value) return
  syncing.value = true
  showToast(`🔄 正在同步 ${source.value.name} 表清单…`, 'info')
  try {
    const before = tables.value.length
    await syncTables(source.value.id)
    const after = getSource(source.value.id)?.tables?.length || 0
    showToast(`✅ 同步完成 · 新增 ${Math.max(0, after - before)} 张 · 共 ${after} 张`, 'success')
  } catch (e) {
    showToast(`同步失败：${e.message || e}`, 'error')
  } finally {
    syncing.value = false
  }
}

function openAdd() {
  draft.name = ''
  draft.cnName = ''
  draft.comment = ''
  draft.encoding = 'utf8mb4'
  draft.engine = ''
  showAdd.value = true
}

async function submitAdd() {
  const name = draft.name.trim()
  if (!name) {
    showToast('请填写表名', 'warning')
    return
  }
  const item = enrichTableMeta(name, source.value?.type, {
    cnName: draft.cnName.trim() || undefined,
    comment: draft.comment.trim() || undefined,
    encoding: draft.encoding.trim() || undefined,
    engine: draft.engine.trim() || undefined,
  })
  try {
    const res = await addTable(source.value.id, item)
    if (!res.ok) {
      showToast('表名已存在', 'warning')
      return
    }
    showAdd.value = false
    showToast(`✅ 已添加 ${name}`, 'success')
  } catch (e) {
    showToast(`添加失败：${e.message || e}`, 'error')
  }
}

async function onRemove(name) {
  try {
    await removeTable(source.value.id, name)
    showToast(`已移除 ${name}`, 'info')
  } catch (e) {
    showToast(`删除失败：${e.message || e}`, 'error')
  }
}

function onPatch(row, key, e) {
  const val = e.target.value
  patchTable(source.value.id, row.name, { [key]: val }).catch((err) => {
    showToast(`保存失败：${err.message || err}`, 'error')
  })
}

function fmtRows(n) {
  if (n == null) return '—'
  if (n >= 10000) return (n / 10000).toFixed(1) + ' 万'
  return String(n)
}
</script>

<template>
  <div v-if="!source" class="card">
    <div class="card-body" style="padding: 40px; text-align: center; color: var(--text-3)">
      未找到数据源
      <div style="margin-top: 12px">
        <button class="btn btn-sm btn-primary" @click="goBack">返回数据源</button>
      </div>
    </div>
  </div>

  <div v-else>
    <PageHeader
      :title="`📋 表清单 · ${source.name}`"
      :subtitle="`${source.id} · ${source.type} · ${endpointOf(source)} · ${statusMeta(source.status).label}`"
      :guide-title="tablesGuide.title"
      :guide="tablesGuide"
    >
      <button class="btn btn-sm" @click="goBack">← 返回数据源</button>
      <button class="btn btn-sm" :disabled="syncing" @click="onSync">
        {{ syncing ? '同步中…' : '🔄 同步清单' }}
      </button>
      <button class="btn btn-sm btn-primary" @click="openAdd">＋ 手动添加</button>
    </PageHeader>

    <div class="ds-filters">
      <input
        v-model="kw"
        class="input"
        style="width: 320px"
        placeholder="搜索表名 / 中文名 / 注释 / 编码…"
      />
      <span class="tag tag-blue">筛选 {{ filtered.length }} / 共 {{ tables.length }}</span>
    </div>

    <div class="card">
      <div class="card-body" style="padding: 0">
        <div v-if="!filtered.length" class="ds-empty">暂无表清单，可同步或手动添加</div>
        <div v-else style="overflow: auto">
          <table class="std-table tbl-meta">
            <thead>
              <tr>
                <th style="width: 18%">表名</th>
                <th style="width: 12%">中文名</th>
                <th>注释</th>
                <th style="width: 9%">编码</th>
                <th style="width: 10%">引擎</th>
                <th style="width: 9%">行数</th>
                <th style="width: 12%">同步时间</th>
                <th style="width: 7%">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in paged" :key="row.name">
                <td>
                  <code class="tbl-name">{{ row.name }}</code>
                </td>
                <td>
                  <input
                    class="input input-sm tbl-edit"
                    :value="row.cnName"
                    @change="onPatch(row, 'cnName', $event)"
                  />
                </td>
                <td>
                  <input
                    class="input input-sm tbl-edit"
                    :value="row.comment"
                    @change="onPatch(row, 'comment', $event)"
                  />
                </td>
                <td>
                  <input
                    class="input input-sm tbl-edit"
                    :value="row.encoding"
                    @change="onPatch(row, 'encoding', $event)"
                  />
                </td>
                <td>
                  <input
                    class="input input-sm tbl-edit"
                    :value="row.engine"
                    @change="onPatch(row, 'engine', $event)"
                  />
                </td>
                <td style="color: var(--text-2)">{{ fmtRows(row.rowCount) }}</td>
                <td style="font-size: 11px; color: var(--text-3)">{{ row.syncedAt || '—' }}</td>
                <td>
                  <button class="btn-link btn-sm" @click="onRemove(row.name)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="filtered.length"
          class="ds-pager"
          style="margin: 0; padding: 12px 16px; border-top: 1px solid var(--border)"
        >
          <div class="ds-pager-info">
            第 {{ page }} / {{ totalPages }} 页 · 本页 {{ paged.length }} 条 · 共 {{ filtered.length }} 条
          </div>
          <div class="ds-pager-controls">
            <PageSizeSelect v-model="pageSize" />
            <button class="btn btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
            <template v-for="(n, i) in pageNums" :key="n">
              <span v-if="i > 0 && n - pageNums[i - 1] > 1" class="ds-pager-ellipsis">…</span>
              <button
                class="btn btn-sm"
                :class="{ 'btn-primary': n === page }"
                @click="goPage(n)"
              >{{ n }}</button>
            </template>
            <button class="btn btn-sm" :disabled="page >= totalPages" @click="goPage(page + 1)">下一页</button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showAdd" class="modal-mask" @click.self="showAdd = false">
        <div class="modal" style="width: 480px">
          <div class="modal-header">
            <div class="modal-title">＋ 手动添加表</div>
            <button class="btn btn-sm" @click="showAdd = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid" style="grid-template-columns: 1fr">
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>表名</span>
                <input v-model="draft.name" class="input" placeholder="如 s_order / public.user_info" />
              </label>
              <label class="form-field">
                <span class="form-label">中文名</span>
                <input v-model="draft.cnName" class="input" placeholder="如 订单表" />
              </label>
              <label class="form-field">
                <span class="form-label">注释</span>
                <input v-model="draft.comment" class="input" placeholder="业务说明" />
              </label>
              <label class="form-field">
                <span class="form-label">编码</span>
                <input v-model="draft.encoding" class="input" placeholder="utf8mb4" />
              </label>
              <label class="form-field">
                <span class="form-label">引擎</span>
                <input v-model="draft.engine" class="input" placeholder="InnoDB" />
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <span style="flex: 1" />
            <button class="btn btn-sm" @click="showAdd = false">取消</button>
            <button class="btn btn-sm btn-primary" @click="submitAdd">添加</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tbl-meta th,
.tbl-meta td {
  vertical-align: middle;
}
.tbl-name {
  font-size: 12px;
  background: var(--bg-2);
  padding: 2px 6px;
  border-radius: 4px;
}
.tbl-edit {
  width: 100%;
  min-width: 0;
  font-size: 12px;
  padding: 4px 8px;
}
</style>
