<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { useActionLock } from '@/composables/useActionLock'
import {
  pageUsers,
  detailUser,
  addUser,
  editUser,
  deleteUsers,
  enableUser,
  disableUser,
  resetUserPassword,
  ownUserRoles,
  grantUserRoles,
  userOrgTree,
  userPositionSelector,
  userRoleSelector,
} from '@/api/sys'

const { showToast } = useToast()
const { busy, run: runLocked } = useActionLock()
const kw = ref('')
const status = ref('')
const loading = ref(false)
const rows = ref([])
const totalRemote = ref(0)
const page = ref(1)
const pageSize = ref(20)

const formOpen = ref(false)
const formMode = ref('add')
const form = reactive({
  id: '',
  account: '',
  name: '',
  orgId: '',
  positionId: '',
  gender: '男',
  phone: '',
  email: '',
})
const orgOptions = ref([])
const positionOptions = ref([])
const roleGrantOpen = ref(false)
const roleGrantUserId = ref('')
const roleGrantUserName = ref('')
const allRoles = ref([])
const selectedRoleIds = ref([])

const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = reactive({
  id: '',
  account: '',
  name: '',
  orgId: '',
  orgName: '',
  positionId: '',
  positionName: '',
  userStatus: '',
  phone: '',
  email: '',
  roles: [],
})

const displayRows = computed(() => rows.value)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRemote.value / pageSize.value)))
const pageNums = computed(() => {
  const t = totalPages.value
  const c = page.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  return [...new Set([1, t, c, c - 1, c + 1].filter((n) => n >= 1 && n <= t))].sort((a, b) => a - b)
})

onMounted(async () => {
  await Promise.all([load(), loadOrgs(), loadRoles()])
})

async function load() {
  loading.value = true
  try {
    const pageData = await pageUsers({
      current: page.value,
      size: pageSize.value,
      searchKey: kw.value || undefined,
      userStatus: status.value || undefined,
    })
    rows.value = pageData?.records || []
    totalRemote.value = Number(pageData?.total || 0)
  } catch (e) {
    showToast(e.message || '加载用户失败', 'error')
  } finally {
    loading.value = false
  }
}

async function loadOrgs() {
  try {
    const tree = await userOrgTree()
    orgOptions.value = flattenOrg(tree)
  } catch {
    orgOptions.value = []
  }
}

async function loadRoles() {
  try {
    const list = await userRoleSelector()
    allRoles.value = Array.isArray(list) ? list : list?.records || []
  } catch {
    allRoles.value = []
  }
}

function flattenOrg(nodes, acc = [], depth = 0) {
  if (!Array.isArray(nodes)) return acc
  for (const n of nodes) {
    const id = n.id || n.value
    const label = n.name || n.label || n.title || id
    if (id) acc.push({ id, label: `${'—'.repeat(depth)}${label}` })
    if (n.children?.length) flattenOrg(n.children, acc, depth + 1)
  }
  return acc
}

async function onOrgChange() {
  form.positionId = ''
  if (!form.orgId) {
    positionOptions.value = []
    return
  }
  try {
    const list = await userPositionSelector(form.orgId)
    positionOptions.value = Array.isArray(list) ? list : []
  } catch {
    positionOptions.value = []
  }
}

function openAdd() {
  formMode.value = 'add'
  Object.assign(form, {
    id: '',
    account: '',
    name: '',
    orgId: orgOptions.value[0]?.id || '',
    positionId: '',
    gender: '男',
    phone: '',
    email: '',
  })
  onOrgChange()
  formOpen.value = true
}

async function openEdit(row) {
  formMode.value = 'edit'
  Object.assign(form, {
    id: row.id,
    account: row.account,
    name: row.name,
    orgId: row.orgId,
    positionId: row.positionId,
    gender: row.gender || '男',
    phone: row.phone || '',
    email: row.email || '',
  })
  await onOrgChange()
  form.positionId = row.positionId
  formOpen.value = true
}

async function saveForm() {
  if (!form.account || !form.name || !form.orgId || !form.positionId) {
    showToast('请填写账号、姓名、组织、职位', 'warning')
    return
  }
  await runLocked('save', async () => {
    try {
      if (formMode.value === 'add') {
        await addUser({ ...form })
        showToast('用户已创建', 'success')
      } else {
        await editUser({ ...form })
        showToast('用户已保存', 'success')
      }
      formOpen.value = false
      await load()
    } catch (e) {
      showToast(e.message || '保存失败', 'error')
    }
  })
}

async function remove(row) {
  if (!confirm(`确认删除用户 ${row.account}？`)) return
  try {
    await deleteUsers([row.id])
    showToast('已删除', 'success')
    await load()
  } catch (e) {
    showToast(e.message || '删除失败', 'error')
  }
}

async function toggleStatus(row) {
  try {
    if (row.userStatus === 'ENABLE') await disableUser(row.id)
    else await enableUser(row.id)
    showToast('状态已更新', 'success')
    await load()
  } catch (e) {
    showToast(e.message || '操作失败', 'error')
  }
}

async function resetPwd(row) {
  try {
    await resetUserPassword(row.id)
    showToast('密码已重置', 'success')
  } catch (e) {
    showToast(e.message || '重置失败', 'error')
  }
}

async function openDetail(row) {
  detailOpen.value = true
  detailLoading.value = true
  Object.assign(detail, {
    id: row.id,
    account: row.account,
    name: row.name,
    orgId: row.orgId || '',
    orgName: row.orgName || '',
    positionId: row.positionId || '',
    positionName: row.positionName || '',
    userStatus: row.userStatus || '',
    phone: row.phone || '',
    email: row.email || '',
    roles: [],
  })
  try {
    const [full, ownedIds] = await Promise.all([
      detailUser(row.id).catch(() => null),
      ownUserRoles(row.id).catch(() => []),
    ])
    if (full) {
      Object.assign(detail, {
        orgId: full.orgId || detail.orgId,
        orgName: full.orgName || detail.orgName,
        positionId: full.positionId || detail.positionId,
        positionName: full.positionName || detail.positionName,
        phone: full.phone || detail.phone,
        email: full.email || detail.email,
        userStatus: full.userStatus || detail.userStatus,
      })
    }
    const idSet = new Set((Array.isArray(ownedIds) ? ownedIds : []).map(String))
    detail.roles = allRoles.value.filter((r) => idSet.has(String(r.id)))
  } finally {
    detailLoading.value = false
  }
}

async function openRoleGrant(row) {
  roleGrantUserId.value = row.id
  roleGrantUserName.value = row.name || row.account
  try {
    const owned = await ownUserRoles(row.id)
    selectedRoleIds.value = Array.isArray(owned) ? owned.map(String) : []
  } catch {
    selectedRoleIds.value = []
  }
  roleGrantOpen.value = true
}

function toggleRole(id) {
  const sid = String(id)
  if (selectedRoleIds.value.includes(sid)) {
    selectedRoleIds.value = selectedRoleIds.value.filter((x) => x !== sid)
  } else {
    selectedRoleIds.value = [...selectedRoleIds.value, sid]
  }
}

async function saveRoleGrant() {
  await runLocked('grant', async () => {
  await _saveRoleGrantBody()
  })
}
async function _saveRoleGrantBody() {
  try {
    await grantUserRoles(roleGrantUserId.value, selectedRoleIds.value)
    showToast('角色已授权', 'success')
    roleGrantOpen.value = false
  } catch (e) {
    showToast(e.message || '授权失败', 'error')
  }
}

function goPage(p) {
  page.value = p
  load()
}

function onPageSize() {
  page.value = 1
  load()
}
</script>

<template>
  <div class="sys-page">
    <PageHeader
      page-id="sys-users"
      title="用户管理"
      subtitle="账号 · 主部门 · 职位 · 角色授权（/sys/user）；演示账号见部门管理文档"
    >
      <button type="button" class="btn btn-sm btn-primary" @click="openAdd">＋ 新建用户</button>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="load">↻ 刷新</button>
    </PageHeader>

    <div class="card">
      <div class="card-body toolbar">
        <input v-model="kw" class="input input-sm" placeholder="账号/姓名" @keyup.enter="page = 1; load()" />
        <select v-model="status" class="select input-sm" @change="page = 1; load()">
          <option value="">全部状态</option>
          <option value="ENABLE">启用</option>
          <option value="DISABLED">停用</option>
        </select>
        <button type="button" class="btn btn-sm" @click="page = 1; load()">查询</button>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名</th>
              <th>主部门</th>
              <th>职位</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="empty">加载中…</td>
            </tr>
            <tr v-else-if="!displayRows.length">
              <td colspan="6" class="empty">暂无用户</td>
            </tr>
            <tr v-for="r in displayRows" :key="r.id">
              <td><code>{{ r.account }}</code></td>
              <td>{{ r.name }}</td>
              <td style="font-size: 12px">{{ r.orgName || r.orgId || '—' }}</td>
              <td style="font-size: 12px">{{ r.positionName || '—' }}</td>
              <td>
                <span class="tag" :class="r.userStatus === 'ENABLE' ? 'tag-green' : 'tag-gray'">
                  {{ r.userStatus === 'ENABLE' ? '启用' : '停用' }}
                </span>
              </td>
              <td class="ops">
                <button type="button" class="btn-link" @click="openDetail(r)">详情</button>
                <button type="button" class="btn-link" @click="openEdit(r)">编辑</button>
                <button type="button" class="btn-link" @click="toggleStatus(r)">
                  {{ r.userStatus === 'ENABLE' ? '停用' : '启用' }}
                </button>
                <button type="button" class="btn-link" @click="resetPwd(r)">重置密码</button>
                <button type="button" class="btn-link" @click="openRoleGrant(r)">授角色</button>
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
          :page-count="displayRows.length"
          @go="goPage"
          @update:page-size="onPageSize"
        />
      </div>
    </div>

    <div v-if="formOpen" class="modal-mask" @click.self="formOpen = false">
      <div class="modal">
        <div class="modal-hd">{{ formMode === 'add' ? '新建用户' : '编辑用户' }}</div>
        <div class="modal-bd form-grid">
          <label>账号<input v-model="form.account" class="input" :disabled="formMode === 'edit'" /></label>
          <label>姓名<input v-model="form.name" class="input" /></label>
          <label>
            组织
            <select v-model="form.orgId" class="select" @change="onOrgChange">
              <option v-for="o in orgOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </label>
          <label>
            职位
            <select v-model="form.positionId" class="select">
              <option value="" disabled>请选择</option>
              <option v-for="p in positionOptions" :key="p.id || p.value" :value="p.id || p.value">
                {{ p.name || p.label || p.id }}
              </option>
            </select>
          </label>
          <p v-if="form.orgId && !positionOptions.length" class="hint">
            该组织下暂无职位，请先到
            <a href="#/sys/position">职位管理</a>
            维护。
          </p>
          <label>手机<input v-model="form.phone" class="input" /></label>
          <label>邮箱<input v-model="form.email" class="input" /></label>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="formOpen = false">取消</button>
          <button type="button" class="btn btn-sm btn-primary" :disabled="busy('save')" @click="saveForm">{{ busy('save') ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <div v-if="detailOpen" class="modal-mask" @click.self="detailOpen = false">
      <div class="modal">
        <div class="modal-hd">用户详情 · {{ detail.name || detail.account }}</div>
        <div class="modal-bd detail-grid">
          <p v-if="detailLoading" class="empty">加载中…</p>
          <template v-else>
            <div><span class="lbl">账号</span><code>{{ detail.account }}</code></div>
            <div><span class="lbl">姓名</span>{{ detail.name }}</div>
            <div><span class="lbl">主部门</span>{{ detail.orgName || detail.orgId || '—' }}</div>
            <div><span class="lbl">职位</span>{{ detail.positionName || '—' }}</div>
            <div><span class="lbl">状态</span>{{ detail.userStatus === 'ENABLE' ? '启用' : '停用' }}</div>
            <div><span class="lbl">手机</span>{{ detail.phone || '—' }}</div>
            <div><span class="lbl">邮箱</span>{{ detail.email || '—' }}</div>
            <div class="roles-block">
              <span class="lbl">已授角色</span>
              <div v-if="detail.roles.length" class="role-chips">
                <span v-for="role in detail.roles" :key="role.id" class="tag tag-green">
                  {{ role.name }} <code>{{ role.code }}</code>
                </span>
              </div>
              <span v-else class="muted">暂无角色</span>
            </div>
          </template>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="detailOpen = false">关闭</button>
          <button
            type="button"
            class="btn btn-sm"
            @click="detailOpen = false; openEdit({ id: detail.id, account: detail.account, name: detail.name, orgId: detail.orgId, positionId: detail.positionId, phone: detail.phone, email: detail.email })"
          >
            编辑部门职位
          </button>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            @click="detailOpen = false; openRoleGrant({ id: detail.id, name: detail.name, account: detail.account })"
          >
            授角色
          </button>
        </div>
      </div>
    </div>

    <div v-if="roleGrantOpen" class="modal-mask" @click.self="roleGrantOpen = false">
      <div class="modal">
        <div class="modal-hd">授予角色 · {{ roleGrantUserName }}</div>
        <div class="modal-bd role-list">
          <label v-for="role in allRoles" :key="role.id" class="role-item">
            <input
              type="checkbox"
              :checked="selectedRoleIds.includes(String(role.id))"
              @change="toggleRole(role.id)"
            />
            <span>{{ role.name }} <code>{{ role.code }}</code></span>
          </label>
          <p v-if="!allRoles.length" class="empty">暂无角色，请先在角色管理创建</p>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="roleGrantOpen = false">取消</button>
          <button type="button" class="btn btn-sm btn-primary" :disabled="busy('grant')" @click="saveRoleGrant">{{ busy('grant') ? '保存中…' : '保存授权' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 24px;
}
.ops {
  display: flex;
  flex-wrap: wrap;
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
  width: min(520px, 92vw);
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
.hint {
  font-size: 12px;
  color: var(--text-3);
  margin: 0;
}
.role-list {
  display: grid;
  gap: 8px;
}
.role-item {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}
.detail-grid {
  display: grid;
  gap: 10px;
  font-size: 13px;
}
.detail-grid .lbl {
  display: inline-block;
  min-width: 64px;
  color: var(--text-3);
  font-size: 12px;
  margin-right: 8px;
}
.roles-block {
  display: grid;
  gap: 6px;
}
.role-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.muted {
  color: var(--text-3);
  font-size: 12px;
}
</style>
