<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { DEFAULT_PAGE_SIZE } from '@/config/pagination'
import {
  orgTree,
  addOrg,
  editOrg,
  deleteOrgs,
  detailOrg,
  pageUsers,
  detailUser,
  editUser,
  userPositionSelector,
} from '@/api/sys'
import { listOrgPersons, addOrgPerson, editOrgPerson, deleteOrgPerson } from '@/api/orgPerson'

const { showToast } = useToast()

const treeLoading = ref(false)
const treeNodes = ref([])
const selectedId = ref('')
const selectedNode = ref(null)
const collapsed = ref(new Set())

const membersLoading = ref(false)
const sysUsers = ref([])
const sysUserTotal = ref(0)
const sysUserPage = ref(1)
const sysUserPageSize = ref(DEFAULT_PAGE_SIZE)
const persons = ref([])
const memberKw = ref('')

const {
  page: personPage,
  pageSize: personPageSize,
  total: personTotal,
  totalPages: personTotalPages,
  paged: personPaged,
  pageNums: personPageNums,
  goPage: goPersonPage,
  resetPage: resetPersonPage,
} = usePager(persons)

const sysUserTotalPages = computed(() =>
  Math.max(1, Math.ceil((Number(sysUserTotal.value) || 0) / sysUserPageSize.value) || 1),
)
const sysUserPageNums = computed(() => {
  const tot = sysUserTotalPages.value
  const cur = sysUserPage.value
  const nums = []
  const push = (n) => {
    if (!nums.includes(n) && n >= 1 && n <= tot) nums.push(n)
  }
  push(1)
  for (let i = cur - 1; i <= cur + 1; i++) push(i)
  push(tot)
  return nums.sort((a, b) => a - b)
})

const orgFormOpen = ref(false)
const orgFormMode = ref('add')
const orgForm = reactive({
  id: '',
  parentId: '0',
  name: '',
  code: '',
  category: 'DEPT',
  sortCode: 99,
})

const attachOpen = ref(false)
const attach = reactive({ userId: '', positionId: '' })
const attachCandidates = ref([])
const attachPositions = ref([])
const attachKw = ref('')

const personFormOpen = ref(false)
const personFormMode = ref('add')
const personForm = reactive({
  id: '',
  orgId: '',
  name: '',
  phone: '',
  email: '',
  jobTitle: '',
  remark: '',
  status: 'active',
})

const flatRows = computed(() => {
  const rows = []
  walkVisible(treeNodes.value, 0, rows)
  return rows
})

const flatParentOptions = computed(() => {
  const acc = [{ id: '0', label: '（根）' }]
  flattenAll(treeNodes.value, acc, 0)
  return acc
})

onMounted(() => loadTree())

watch(selectedId, () => {
  sysUserPage.value = 1
  resetPersonPage()
  if (selectedId.value) loadMembers()
  else {
    sysUsers.value = []
    sysUserTotal.value = 0
    persons.value = []
  }
})

async function loadSysUsersOnly() {
  if (!selectedId.value) return
  try {
    const userPage = await pageUsers({
      current: sysUserPage.value,
      size: sysUserPageSize.value,
      orgId: selectedId.value,
      searchKey: memberKw.value || undefined,
      searchIncludeChild: true,
    })
    sysUsers.value = userPage?.records || []
    sysUserTotal.value = Number(userPage?.total || 0)
  } catch (e) {
    showToast(e.message || '加载系统用户失败', 'error')
    sysUsers.value = []
    sysUserTotal.value = 0
  }
}

function onSysUserGo(p) {
  sysUserPage.value = Math.min(sysUserTotalPages.value, Math.max(1, Number(p) || 1))
  loadSysUsersOnly()
}

function onSysUserPageSize(n) {
  sysUserPageSize.value = n
  sysUserPage.value = 1
  loadSysUsersOnly()
}

function searchMembers() {
  sysUserPage.value = 1
  resetPersonPage()
  loadMembers()
}

async function loadMembers() {
  if (!selectedId.value) return
  membersLoading.value = true
  try {
    const [userPage, personList] = await Promise.all([
      pageUsers({
        current: sysUserPage.value,
        size: sysUserPageSize.value,
        orgId: selectedId.value,
        searchKey: memberKw.value || undefined,
        searchIncludeChild: true,
      }),
      listOrgPersons(selectedId.value, memberKw.value || undefined, true),
    ])
    sysUsers.value = userPage?.records || []
    sysUserTotal.value = Number(userPage?.total || 0)
    persons.value = Array.isArray(personList) ? personList : []
    resetPersonPage()
  } catch (e) {
    showToast(e.message || '加载成员失败', 'error')
    sysUsers.value = []
    sysUserTotal.value = 0
    persons.value = []
  } finally {
    membersLoading.value = false
  }
}

function walkVisible(nodes, depth, rows) {
  if (!Array.isArray(nodes)) return
  for (const n of nodes) {
    const id = n.id
    const kids = Array.isArray(n.children) ? n.children : []
    rows.push({ node: n, depth, hasChildren: kids.length > 0 })
    if (kids.length && !collapsed.value.has(String(id))) {
      walkVisible(kids, depth + 1, rows)
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

function randomCode() {
  return `org_${Math.random().toString(36).slice(2, 10)}`
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

function findNode(nodes, id) {
  if (!Array.isArray(nodes)) return null
  for (const n of nodes) {
    if (String(n.id) === String(id)) return n
    const c = findNode(n.children, id)
    if (c) return c
  }
  return null
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

function openAddRoot() {
  orgFormMode.value = 'add'
  Object.assign(orgForm, {
    id: '',
    parentId: '0',
    name: '',
    code: randomCode(),
    category: 'COMPANY',
    sortCode: 99,
  })
  orgFormOpen.value = true
}

function openAddChild() {
  if (!selectedId.value) {
    showToast('请先选择上级部门', 'warning')
    return
  }
  orgFormMode.value = 'add'
  Object.assign(orgForm, {
    id: '',
    parentId: selectedId.value,
    name: '',
    code: randomCode(),
    category: 'DEPT',
    sortCode: 99,
  })
  orgFormOpen.value = true
}

async function openEditOrg() {
  if (!selectedId.value) {
    showToast('请先选择部门', 'warning')
    return
  }
  try {
    const n = await detailOrg(selectedId.value)
    orgFormMode.value = 'edit'
    Object.assign(orgForm, {
      id: n.id,
      parentId: n.parentId || '0',
      name: n.name || '',
      code: n.code || '',
      category: n.category || 'DEPT',
      sortCode: n.sortCode ?? 99,
    })
    orgFormOpen.value = true
  } catch (e) {
    showToast(e.message || '加载部门详情失败', 'error')
  }
}

async function saveOrg() {
  if (!orgForm.name || !orgForm.code || !orgForm.parentId) {
    showToast('请填写名称、编码、上级', 'warning')
    return
  }
  try {
    const body = {
      parentId: orgForm.parentId,
      name: orgForm.name,
      code: orgForm.code,
      category: orgForm.category,
      sortCode: orgForm.sortCode,
    }
    const expandParentId = orgFormMode.value === 'add' ? orgForm.parentId : ''
    if (orgFormMode.value === 'add') {
      await addOrg(body)
      showToast('部门已创建', 'success')
    } else {
      await editOrg({ ...body, id: orgForm.id })
      showToast('部门已保存', 'success')
    }
    orgFormOpen.value = false
    // 新建子部门后展开父节点，避免仍折叠时看起来「目录里没有」
    if (expandParentId && expandParentId !== '0') {
      collapsed.value.delete(String(expandParentId))
      collapsed.value = new Set(collapsed.value)
    }
    await loadTree()
  } catch (e) {
    showToast(e.message || '保存失败', 'error')
  }
}

async function removeOrg() {
  if (!selectedId.value) return
  if (!confirm(`确认删除部门「${selectedNode.value?.name || selectedId.value}」？有子部门或成员时会失败。`)) return
  try {
    await deleteOrgs([selectedId.value])
    showToast('已删除', 'success')
    selectedId.value = ''
    selectedNode.value = null
    await loadTree()
  } catch (e) {
    showToast(e.message || '删除失败', 'error')
  }
}

async function openAttach() {
  if (!selectedId.value) {
    showToast('请先选择部门', 'warning')
    return
  }
  attach.userId = ''
  attach.positionId = ''
  attachKw.value = ''
  attachOpen.value = true
  await loadAttachCandidates()
  await loadAttachPositions()
}

async function loadAttachCandidates() {
  try {
    const page = await pageUsers({
      current: 1,
      size: 50,
      searchKey: attachKw.value || undefined,
    })
    attachCandidates.value = (page?.records || []).filter((u) => String(u.orgId) !== String(selectedId.value))
  } catch {
    attachCandidates.value = []
  }
}

async function loadAttachPositions() {
  try {
    const list = await userPositionSelector(selectedId.value)
    attachPositions.value = Array.isArray(list) ? list : []
  } catch {
    attachPositions.value = []
  }
}

async function saveAttach() {
  if (!attach.userId) {
    showToast('请选择用户', 'warning')
    return
  }
  try {
    const detail = await detailUser(attach.userId)
    const positionId = attach.positionId || detail.positionId || undefined
    await editUser({
      id: detail.id,
      account: detail.account,
      name: detail.name,
      orgId: selectedId.value,
      positionId,
      gender: detail.gender || '男',
      phone: detail.phone || '',
      email: detail.email || '',
      positionJson: detail.positionJson || undefined,
    })
    showToast(attach.positionId ? '已挂到主部门并更新职位' : '已挂到主部门', 'success')
    attachOpen.value = false
    await loadMembers()
  } catch (e) {
    showToast(e.message || '挂接失败', 'error')
  }
}

function openAddPerson() {
  if (!selectedId.value) {
    showToast('请先选择部门', 'warning')
    return
  }
  personFormMode.value = 'add'
  Object.assign(personForm, {
    id: '',
    orgId: selectedId.value,
    name: '',
    phone: '',
    email: '',
    jobTitle: '',
    remark: '',
    status: 'active',
  })
  personFormOpen.value = true
}

function openEditPerson(row) {
  personFormMode.value = 'edit'
  Object.assign(personForm, {
    id: row.id,
    orgId: row.orgId || selectedId.value,
    name: row.name || '',
    phone: row.phone || '',
    email: row.email || '',
    jobTitle: row.jobTitle || '',
    remark: row.remark || '',
    status: row.status || 'active',
  })
  personFormOpen.value = true
}

async function savePerson() {
  if (!personForm.name || !personForm.orgId) {
    showToast('请填写姓名', 'warning')
    return
  }
  try {
    const body = {
      orgId: personForm.orgId,
      name: personForm.name,
      phone: personForm.phone || undefined,
      email: personForm.email || undefined,
      jobTitle: personForm.jobTitle || undefined,
      remark: personForm.remark || undefined,
      status: personForm.status,
    }
    if (personFormMode.value === 'add') await addOrgPerson(body)
    else await editOrgPerson(personForm.id, body)
    showToast('人员已保存', 'success')
    personFormOpen.value = false
    await loadMembers()
  } catch (e) {
    showToast(e.message || '保存失败', 'error')
  }
}

async function removePerson(row) {
  if (!confirm(`确认移除非系统人员「${row.name}」？`)) return
  try {
    await deleteOrgPerson(row.id)
    showToast('已移除', 'success')
    await loadMembers()
  } catch (e) {
    showToast(e.message || '删除失败', 'error')
  }
}
</script>

<template>
  <div class="sys-page org-page">
    <PageHeader
      page-id="sys-org" title="部门管理" subtitle="组织树 · 挂系统用户主部门 · 非系统人员档案">
      <button type="button" class="btn btn-sm" :disabled="treeLoading" @click="loadTree">↻ 刷新树</button>
      <button type="button" class="btn btn-sm" @click="openAddRoot">＋ 根组织</button>
      <button type="button" class="btn btn-sm btn-primary" @click="openAddChild">＋ 子部门</button>
    </PageHeader>

    <div class="org-layout">
      <aside class="org-tree card">
        <div class="card-body tree-toolbar">
          <button type="button" class="btn-link" :disabled="!selectedId" @click="openEditOrg">编辑</button>
          <button type="button" class="btn-link danger" :disabled="!selectedId" @click="removeOrg">删除</button>
        </div>
        <div class="card-body tree-body">
          <p v-if="treeLoading" class="empty">加载中…</p>
          <p v-else-if="!flatRows.length" class="empty">暂无部门，请先新建根组织</p>
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

      <section class="org-main card">
        <div class="card-body toolbar">
          <strong>{{ selectedNode?.name || '未选择部门' }}</strong>
          <span v-if="selectedNode" class="muted">{{ selectedNode.category }} · {{ selectedNode.code }}</span>
          <input
            v-model="memberKw"
            class="input input-sm"
            placeholder="搜索成员"
            :disabled="!selectedId"
            @keyup.enter="searchMembers"
          />
          <button type="button" class="btn btn-sm" :disabled="!selectedId || membersLoading" @click="searchMembers">
            查询
          </button>
          <button type="button" class="btn btn-sm btn-primary" :disabled="!selectedId" @click="openAttach">
            挂系统用户
          </button>
          <button type="button" class="btn btn-sm" :disabled="!selectedId" @click="openAddPerson">
            ＋ 非系统人员
          </button>
        </div>

        <div class="card-body" style="padding-top: 0">
          <h4 class="sec-title">系统用户（本部门及下级 · 主部门）· 共 {{ sysUserTotal }} 条</h4>
          <table class="table">
            <thead>
              <tr>
                <th>账号</th>
                <th>姓名</th>
                <th>所属部门</th>
                <th>职位</th>
                <th>手机</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="membersLoading">
                <td colspan="6" class="empty">加载中…</td>
              </tr>
              <tr v-else-if="!selectedId">
                <td colspan="6" class="empty">请选择左侧部门</td>
              </tr>
              <tr v-else-if="!sysUsers.length">
                <td colspan="6" class="empty">暂无系统用户</td>
              </tr>
              <tr v-for="u in sysUsers" :key="u.id">
                <td><code>{{ u.account }}</code></td>
                <td>{{ u.name }}</td>
                <td style="font-size: 12px">{{ u.orgName || '—' }}</td>
                <td style="font-size: 12px">{{ u.positionName || '—' }}</td>
                <td>{{ u.phone || '—' }}</td>
                <td>
                  <span class="tag" :class="u.userStatus === 'ENABLE' ? 'tag-green' : 'tag-gray'">
                    {{ u.userStatus === 'ENABLE' ? '启用' : '停用' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <ListPager
            v-model:page="sysUserPage"
            v-model:page-size="sysUserPageSize"
            :total="sysUserTotal"
            :total-pages="sysUserTotalPages"
            :page-nums="sysUserPageNums"
            :page-count="sysUsers.length"
            @go="onSysUserGo"
            @update:page-size="onSysUserPageSize"
          />

          <h4 class="sec-title">非系统人员（本部门及下级）· 共 {{ personTotal }} 条</h4>
          <table class="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>所属部门</th>
                <th>手机</th>
                <th>邮箱</th>
                <th>职务</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!selectedId">
                <td colspan="6" class="empty">请选择左侧部门</td>
              </tr>
              <tr v-else-if="!personTotal">
                <td colspan="6" class="empty">暂无非系统人员</td>
              </tr>
              <tr v-for="p in personPaged" :key="p.id">
                <td>{{ p.name }}</td>
                <td style="font-size: 12px">{{ p.orgName || '—' }}</td>
                <td>{{ p.phone || '—' }}</td>
                <td>{{ p.email || '—' }}</td>
                <td>{{ p.jobTitle || '—' }}</td>
                <td class="ops">
                  <button type="button" class="btn-link" @click="openEditPerson(p)">编辑</button>
                  <button type="button" class="btn-link danger" @click="removePerson(p)">移除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <ListPager
            v-model:page="personPage"
            v-model:page-size="personPageSize"
            :total="personTotal"
            :total-pages="personTotalPages"
            :page-nums="personPageNums"
            :page-count="personPaged.length"
            @go="goPersonPage"
          />
        </div>
      </section>
    </div>

    <div v-if="orgFormOpen" class="modal-mask" @click.self="orgFormOpen = false">
      <div class="modal">
        <div class="modal-hd">{{ orgFormMode === 'add' ? '新建部门' : '编辑部门' }}</div>
        <div class="modal-bd form-grid">
          <label>
            上级
            <select v-model="orgForm.parentId" class="select">
              <option v-for="o in flatParentOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </label>
          <label>名称<input v-model="orgForm.name" class="input" /></label>
          <label>编码<input v-model="orgForm.code" class="input" /></label>
          <label>
            分类
            <select v-model="orgForm.category" class="select">
              <option value="COMPANY">公司</option>
              <option value="DEPT">部门</option>
            </select>
          </label>
          <label>排序<input v-model.number="orgForm.sortCode" type="number" class="input" /></label>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="orgFormOpen = false">取消</button>
          <button type="button" class="btn btn-sm btn-primary" @click="saveOrg">保存</button>
        </div>
      </div>
    </div>

    <div v-if="attachOpen" class="modal-mask" @click.self="attachOpen = false">
      <div class="modal">
        <div class="modal-hd">挂系统用户 · 设为主部门</div>
        <div class="modal-bd form-grid">
          <label>
            搜索用户
            <div class="row-inline">
              <input v-model="attachKw" class="input" placeholder="账号/姓名" @keyup.enter="loadAttachCandidates" />
              <button type="button" class="btn btn-sm" @click="loadAttachCandidates">搜</button>
            </div>
          </label>
          <label>
            用户
            <select v-model="attach.userId" class="select">
              <option value="" disabled>请选择</option>
              <option v-for="u in attachCandidates" :key="u.id" :value="u.id">
                {{ u.name }}（{{ u.account }}）· 当前 {{ u.orgName || u.orgId || '—' }}
              </option>
            </select>
          </label>
          <label>
            职位（可选）
            <select v-model="attach.positionId" class="select">
              <option value="">不改职位 · 保留原岗</option>
              <option v-for="p in attachPositions" :key="p.id || p.value" :value="p.id || p.value">
                {{ p.name || p.label || p.id }}
              </option>
            </select>
          </label>
          <p class="hint">挂主部门只需选人；职位可稍后在用户管理或职位管理中调整。</p>
          <p v-if="!attachPositions.length" class="hint">
            该部门下暂无职位。需要定岗时请先到
            <a href="#/sys/position">职位管理</a>
            新建。
          </p>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="attachOpen = false">取消</button>
          <button type="button" class="btn btn-sm btn-primary" @click="saveAttach">确认挂接</button>
        </div>
      </div>
    </div>

    <div v-if="personFormOpen" class="modal-mask" @click.self="personFormOpen = false">
      <div class="modal">
        <div class="modal-hd">{{ personFormMode === 'add' ? '非系统人员' : '编辑非系统人员' }}</div>
        <div class="modal-bd form-grid">
          <label>姓名<input v-model="personForm.name" class="input" /></label>
          <label>手机<input v-model="personForm.phone" class="input" /></label>
          <label>邮箱<input v-model="personForm.email" class="input" /></label>
          <label>职务<input v-model="personForm.jobTitle" class="input" /></label>
          <label>备注<input v-model="personForm.remark" class="input" /></label>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="personFormOpen = false">取消</button>
          <button type="button" class="btn btn-sm btn-primary" @click="savePerson">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.org-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) 1fr;
  gap: 12px;
  align-items: start;
}
.org-tree {
  max-height: calc(100vh - 160px);
  overflow: auto;
}
.tree-toolbar {
  display: flex;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
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
.sec-title {
  margin: 16px 0 8px;
  font-size: 13px;
  color: var(--text-2);
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
.hint {
  font-size: 12px;
  color: var(--text-3);
  margin: 0;
}
.row-inline {
  display: flex;
  gap: 8px;
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
  .org-layout {
    grid-template-columns: 1fr;
  }
}
</style>
