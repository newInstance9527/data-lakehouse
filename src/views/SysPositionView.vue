<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { DEFAULT_PAGE_SIZE } from '@/config/pagination'
import {
  orgTree,
  pagePositions,
  addPosition,
  editPosition,
  deletePositions,
} from '@/api/sys'

const CATEGORY_LABEL = {
  HIGH: '高层',
  MIDDLE: '中层',
  LOW: '基层',
}

const { showToast } = useToast()

const treeLoading = ref(false)
const treeNodes = ref([])
const selectedId = ref('')
const selectedNode = ref(null)
const collapsed = ref(new Set())

const listLoading = ref(false)
const rows = ref([])
const totalRemote = ref(0)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const kw = ref('')

const formOpen = ref(false)
const formMode = ref('add')
const form = reactive({
  id: '',
  orgId: '',
  name: '',
  code: '',
  category: 'MIDDLE',
  sortCode: 99,
})

const totalPages = computed(() => Math.max(1, Math.ceil(totalRemote.value / pageSize.value)))
const pageNums = computed(() => {
  const tot = totalPages.value
  const cur = page.value
  const nums = []
  const push = (n) => {
    if (!nums.includes(n) && n >= 1 && n <= tot) nums.push(n)
  }
  push(1)
  for (let i = cur - 1; i <= cur + 1; i++) push(i)
  push(tot)
  return nums.sort((a, b) => a - b)
})

const flatRows = computed(() => {
  const out = []
  walkVisible(treeNodes.value, 0, out)
  return out
})

const flatOrgOptions = computed(() => {
  const acc = []
  flattenAll(treeNodes.value, acc, 0)
  return acc
})

onMounted(() => loadTree())

watch(selectedId, () => {
  page.value = 1
  if (selectedId.value) loadList()
  else {
    rows.value = []
    totalRemote.value = 0
  }
})

function walkVisible(nodes, depth, out) {
  if (!Array.isArray(nodes)) return
  for (const n of nodes) {
    const kids = Array.isArray(n.children) ? n.children : []
    out.push({ node: n, depth, hasChildren: kids.length > 0 })
    if (kids.length && !collapsed.value.has(String(n.id))) {
      walkVisible(kids, depth + 1, out)
    }
  }
}

function flattenAll(nodes, acc, depth) {
  if (!Array.isArray(nodes)) return
  for (const n of nodes) {
    const id = n.id || n.value
    const label = n.name || n.label || n.title || id
    if (id) acc.push({ id, label: `${'—'.repeat(depth)}${label}` })
    if (n.children?.length) flattenAll(n.children, acc, depth + 1)
  }
}

function findNode(nodes, id) {
  if (!Array.isArray(nodes)) return null
  for (const n of nodes) {
    if (String(n.id) === String(id)) return n
    const c = findNode(n.children, id)
    if (c) return c
  }
  return null
}

function randomCode() {
  return `pos_${Math.random().toString(36).slice(2, 10)}`
}

function categoryLabel(c) {
  return CATEGORY_LABEL[c] || c || '—'
}

async function loadTree() {
  treeLoading.value = true
  try {
    const data = await orgTree({ searchKey: '' })
    treeNodes.value = Array.isArray(data) ? data : []
    if (!selectedId.value && treeNodes.value.length) {
      selectNode(treeNodes.value[0])
    } else if (selectedId.value) {
      selectedNode.value = findNode(treeNodes.value, selectedId.value)
    }
  } catch (e) {
    showToast(e.message || '加载部门树失败', 'error')
    treeNodes.value = []
  } finally {
    treeLoading.value = false
  }
}

function selectNode(node) {
  selectedId.value = node?.id || ''
  selectedNode.value = node
}

function toggleCollapse(id) {
  const sid = String(id)
  if (collapsed.value.has(sid)) collapsed.value.delete(sid)
  else collapsed.value.add(sid)
  collapsed.value = new Set(collapsed.value)
}

async function loadList() {
  if (!selectedId.value) return
  listLoading.value = true
  try {
    const pageData = await pagePositions({
      current: page.value,
      size: pageSize.value,
      orgId: selectedId.value,
      searchKey: kw.value || undefined,
      searchIncludeChild: true,
    })
    rows.value = pageData?.records || []
    totalRemote.value = Number(pageData?.total || 0)
  } catch (e) {
    showToast(e.message || '加载职位失败', 'error')
    rows.value = []
    totalRemote.value = 0
  } finally {
    listLoading.value = false
  }
}

function goPage(p) {
  page.value = Math.min(totalPages.value, Math.max(1, Number(p) || 1))
  loadList()
}

function onPageSize(n) {
  pageSize.value = n
  page.value = 1
  loadList()
}

function searchList() {
  page.value = 1
  loadList()
}

function openAdd() {
  if (!selectedId.value) {
    showToast('请先选择所属部门', 'warning')
    return
  }
  formMode.value = 'add'
  Object.assign(form, {
    id: '',
    orgId: selectedId.value,
    name: '',
    code: randomCode(),
    category: 'MIDDLE',
    sortCode: 99,
  })
  formOpen.value = true
}

function openEdit(row) {
  formMode.value = 'edit'
  Object.assign(form, {
    id: row.id,
    orgId: row.orgId || selectedId.value,
    name: row.name || '',
    code: row.code || '',
    category: row.category || 'MIDDLE',
    sortCode: row.sortCode ?? 99,
  })
  formOpen.value = true
}

async function saveForm() {
  if (!form.name || !form.code || !form.orgId) {
    showToast('请填写名称、编码与所属部门', 'warning')
    return
  }
  const body = {
    orgId: form.orgId,
    name: form.name,
    code: form.code,
    category: form.category || 'MIDDLE',
    sortCode: form.sortCode ?? 99,
  }
  try {
    if (formMode.value === 'add') await addPosition(body)
    else await editPosition({ id: form.id, ...body })
    showToast('职位已保存', 'success')
    formOpen.value = false
    await loadList()
  } catch (e) {
    showToast(e.message || '保存失败', 'error')
  }
}

async function remove(row) {
  if (!confirm(`确认删除职位「${row.name}」？`)) return
  try {
    await deletePositions([row.id])
    showToast('已删除', 'success')
    await loadList()
  } catch (e) {
    showToast(e.message || '删除失败', 'error')
  }
}
</script>

<template>
  <div class="sys-page pos-page">
    <PageHeader
      page-id="sys-position"
      title="职位管理"
      subtitle="选父部门可汇总本级及下级职位 · /sys/position · 用户挂职见 positionSelector"
    >
      <button type="button" class="btn btn-sm" :disabled="treeLoading" @click="loadTree">↻ 刷新树</button>
      <button type="button" class="btn btn-sm btn-primary" :disabled="!selectedId" @click="openAdd">
        ＋ 新建职位
      </button>
    </PageHeader>

    <div class="pos-layout">
      <aside class="pos-tree card">
        <div class="card-body tree-body">
          <p v-if="treeLoading" class="empty">加载中…</p>
          <p v-else-if="!flatRows.length" class="empty">暂无部门，请先到部门管理建树</p>
          <div v-else class="tree-list">
            <div
              v-for="row in flatRows"
              :key="row.node.id"
              class="tree-row"
              :class="{ active: String(selectedId) === String(row.node.id) }"
              :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
              @click="selectNode(row.node)"
            >
              <button
                v-if="row.hasChildren"
                type="button"
                class="tree-caret"
                @click.stop="toggleCollapse(row.node.id)"
              >
                {{ collapsed.has(String(row.node.id)) ? '▸' : '▾' }}
              </button>
              <span v-else class="tree-caret spacer" />
              <span class="tree-label">{{ row.node.name || row.node.id }}</span>
            </div>
          </div>
        </div>
      </aside>

      <section class="pos-main card">
        <div class="card-body toolbar">
          <strong>{{ selectedNode?.name || '未选择部门' }}</strong>
          <span v-if="selectedNode" class="muted">本部门及下级 · {{ selectedNode.category }} · {{ selectedNode.code }}</span>
          <input
            v-model="kw"
            class="input input-sm"
            placeholder="职位名称"
            :disabled="!selectedId"
            @keyup.enter="searchList"
          />
          <button type="button" class="btn btn-sm" :disabled="!selectedId || listLoading" @click="searchList">
            查询
          </button>
        </div>

        <div class="card-body" style="padding-top: 0">
          <table class="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>所属部门</th>
                <th>编码</th>
                <th>分类</th>
                <th>排序</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="listLoading">
                <td colspan="6" class="empty">加载中…</td>
              </tr>
              <tr v-else-if="!selectedId">
                <td colspan="6" class="empty">请选择左侧部门</td>
              </tr>
              <tr v-else-if="!rows.length">
                <td colspan="6" class="empty">本部门及下级暂无职位</td>
              </tr>
              <tr v-for="r in rows" :key="r.id">
                <td>{{ r.name }}</td>
                <td style="font-size: 12px">{{ r.orgName || '—' }}</td>
                <td><code>{{ r.code }}</code></td>
                <td>{{ categoryLabel(r.category) }}</td>
                <td>{{ r.sortCode }}</td>
                <td class="ops">
                  <button type="button" class="btn-link" @click="openEdit(r)">编辑</button>
                  <button type="button" class="btn-link danger" @click="remove(r)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <ListPager
            v-model:page="page"
            v-model:page-size="pageSize"
            :total="totalRemote"
            :total-pages="totalPages"
            :page-nums="pageNums"
            :page-count="rows.length"
            @go="goPage"
            @update:page-size="onPageSize"
          />
        </div>
      </section>
    </div>

    <div v-if="formOpen" class="modal-mask" @click.self="formOpen = false">
      <div class="modal">
        <div class="modal-hd">{{ formMode === 'add' ? '新建职位' : '编辑职位' }}</div>
        <div class="modal-bd form-grid">
          <label>
            所属部门
            <select v-model="form.orgId" class="select">
              <option v-for="o in flatOrgOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </label>
          <label>名称<input v-model="form.name" class="input" /></label>
          <label>
            编码
            <input v-model="form.code" class="input" :disabled="formMode === 'edit'" />
          </label>
          <label>
            分类
            <select v-model="form.category" class="select">
              <option value="HIGH">高层</option>
              <option value="MIDDLE">中层</option>
              <option value="LOW">基层</option>
            </select>
          </label>
          <label>排序<input v-model.number="form.sortCode" type="number" class="input" /></label>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="formOpen = false">取消</button>
          <button type="button" class="btn btn-sm btn-primary" @click="saveForm">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pos-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 12px;
  align-items: start;
}
.pos-tree {
  max-height: calc(100vh - 160px);
  overflow: auto;
}
.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.tree-row:hover {
  background: var(--bg-2, #f5f5f5);
}
.tree-row.active {
  background: var(--primary-soft, #e8f1ff);
  color: var(--primary, #1a5fb4);
  font-weight: 600;
}
.tree-caret {
  border: none;
  background: transparent;
  width: 18px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.tree-caret.spacer {
  visibility: hidden;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.muted {
  color: var(--text-3);
  font-size: 12px;
}
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 20px;
}
.ops {
  display: flex;
  gap: 8px;
}
.danger {
  color: var(--danger);
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: var(--card, #fff);
  border-radius: 10px;
  width: min(480px, 92vw);
  max-height: 85vh;
  overflow: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-hd {
  padding: 14px 16px;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}
.modal-bd {
  padding: 16px;
}
.modal-ft {
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border);
}
.form-grid {
  display: grid;
  gap: 10px;
}
.form-grid label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--text-2);
}
@media (max-width: 800px) {
  .pos-layout {
    grid-template-columns: 1fr;
  }
}
</style>
