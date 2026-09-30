<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { useActionLock } from '@/composables/useActionLock'
import { DEFAULT_PAGE_SIZE } from '@/config/pagination'
import {
  pageRoles,
  addRole,
  editRole,
  deleteRoles,
  ownRoleResource,
  grantRoleResource,
  roleResourceTree,
} from '@/api/sys'

const { showToast } = useToast()
const { busy, run: runLocked } = useActionLock()
const kw = ref('')
const loading = ref(false)
const rows = ref([])
const totalRemote = ref(0)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

const formOpen = ref(false)
const formMode = ref('add')
const form = reactive({
  id: '',
  name: '',
  code: '',
  category: 'GLOBAL',
  sortCode: 99,
  orgId: '',
})

const grantOpen = ref(false)
const grantRole = ref(null)
const resourceModules = ref([])
const checkedMenuIds = ref(new Set())

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

onMounted(load)

async function load() {
  loading.value = true
  try {
    const pageData = await pageRoles({
      current: page.value,
      size: pageSize.value,
      searchKey: kw.value || undefined,
    })
    rows.value = pageData?.records || []
    totalRemote.value = Number(pageData?.total || 0)
  } catch (e) {
    showToast(e.message || '加载角色失败', 'error')
  } finally {
    loading.value = false
  }
}

function goPage(p) {
  page.value = Math.min(totalPages.value, Math.max(1, Number(p) || 1))
  load()
}

function onPageSize(n) {
  pageSize.value = n
  page.value = 1
  load()
}

function search() {
  page.value = 1
  load()
}

function openAdd() {
  formMode.value = 'add'
  Object.assign(form, { id: '', name: '', code: '', category: 'GLOBAL', sortCode: 99, orgId: '' })
  formOpen.value = true
}

function openEdit(row) {
  formMode.value = 'edit'
  Object.assign(form, {
    id: row.id,
    name: row.name,
    code: row.code,
    category: row.category || 'GLOBAL',
    sortCode: row.sortCode ?? 99,
    orgId: row.orgId || '',
  })
  formOpen.value = true
}

async function saveForm() {
  if (!form.name || !form.code) {
    showToast('请填写名称与编码', 'warning')
    return
  }
  await runLocked('save', async () => {
    try {
      if (formMode.value === 'add') await addRole({ ...form })
      else await editRole({ ...form })
      showToast('角色已保存', 'success')
      formOpen.value = false
      await load()
    } catch (e) {
      showToast(e.message || '保存失败', 'error')
    }
  })
}

async function remove(row) {
  if (!confirm(`确认删除角色 ${row.name}？`)) return
  try {
    await deleteRoles([row.id])
    showToast('已删除', 'success')
    await load()
  } catch (e) {
    showToast(e.message || '删除失败', 'error')
  }
}

async function openGrant(row) {
  grantRole.value = row
  checkedMenuIds.value = new Set()
  try {
    const [tree, owned] = await Promise.all([roleResourceTree(), ownRoleResource(row.id)])
    resourceModules.value = Array.isArray(tree) ? tree : []
    const list = owned?.grantInfoList || []
    checkedMenuIds.value = new Set(list.map((x) => String(x.menuId)))
  } catch (e) {
    showToast(e.message || '加载授权树失败', 'error')
    resourceModules.value = []
  }
  grantOpen.value = true
}

function isChecked(id) {
  return checkedMenuIds.value.has(String(id))
}

function toggleMenu(id) {
  const sid = String(id)
  const next = new Set(checkedMenuIds.value)
  if (next.has(sid)) next.delete(sid)
  else next.add(sid)
  checkedMenuIds.value = next
}

async function saveGrant() {
  if (!grantRole.value) return
  const grantInfoList = [...checkedMenuIds.value].map((menuId) => ({
    menuId,
    buttonInfo: [],
  }))
  try {
    await grantRoleResource(grantRole.value.id, grantInfoList)
    showToast('菜单授权已保存', 'success')
    grantOpen.value = false
  } catch (e) {
    showToast(e.message || '授权失败', 'error')
  }
}

const flatMenus = computed(() => {
  const out = []
  for (const mod of resourceModules.value) {
    out.push({ type: 'module', id: mod.id, title: mod.title })
    for (const m of mod.menu || []) {
      out.push({
        type: 'menu',
        id: m.id,
        title: m.title,
        parentName: m.parentName,
        module: mod.title,
      })
    }
  }
  return out
})
</script>

<template>
  <div class="sys-page">
    <PageHeader
      page-id="sys-roles"
      title="角色管理"
      subtitle="角色 CRUD · 菜单授权 · 数据范围模板（见数据权限）· 治理角色 V51"
    >
      <button type="button" class="btn btn-sm btn-primary" @click="openAdd">＋ 新建角色</button>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="load">↻ 刷新</button>
    </PageHeader>

    <div class="card data-scope-templates" style="margin-bottom: 12px">
      <div class="card-body">
        <div style="font-weight: 600; margin-bottom: 6px">门户数据范围模板（L1，非引擎 ACL）</div>
        <p style="margin: 0 0 8px; color: var(--muted, #666); font-size: 13px">
          菜单授权管「进不进页」；下列模板说明行可见范围。跨空间「查看全部」仅 superAdmin / dataOps / bizAdmin，服务端硬门禁。
          明细见仓库 <code>doc/数据权限.md</code>。
        </p>
        <table class="table" style="margin: 0">
          <thead>
            <tr><th>模板</th><th>适用角色编码示例</th><th>可见范围</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>仅本人</td>
              <td><code>dataAnalyst</code> 等</td>
              <td>个人对象（脚本/查询史/Key/草稿）仅自己；共建对象看当前工作空间</td>
            </tr>
            <tr>
              <td>本空间</td>
              <td><code>dataSteward</code> / 空间成员</td>
              <td>当前 ws 共建对象 + 本人私有对象；无 scope=all</td>
            </tr>
            <tr>
              <td>全站巡检</td>
              <td><code>superAdmin</code> / <code>dataOps</code> / <code>bizAdmin</code></td>
              <td>可勾选「查看全部」（scope=all）；含他人私有对象巡检</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-body toolbar">
        <input v-model="kw" class="input input-sm" placeholder="角色名/编码" @keyup.enter="search" />
        <button type="button" class="btn btn-sm" @click="search">查询</button>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>名称</th>
              <th>编码</th>
              <th>分类</th>
              <th>排序</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="empty">加载中…</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="5" class="empty">暂无角色</td>
            </tr>
            <tr v-for="r in rows" :key="r.id">
              <td>{{ r.name }}</td>
              <td><code>{{ r.code }}</code></td>
              <td>{{ r.category }}</td>
              <td>{{ r.sortCode }}</td>
              <td class="ops">
                <button type="button" class="btn-link" @click="openEdit(r)">编辑</button>
                <button type="button" class="btn-link" @click="openGrant(r)">菜单授权</button>
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
    </div>

    <div v-if="formOpen" class="modal-mask" @click.self="formOpen = false">
      <div class="modal">
        <div class="modal-hd">{{ formMode === 'add' ? '新建角色' : '编辑角色' }}</div>
        <div class="modal-bd form-grid">
          <label>名称<input v-model="form.name" class="input" /></label>
          <label>编码<input v-model="form.code" class="input" :disabled="formMode === 'edit'" /></label>
          <label>
            分类
            <select v-model="form.category" class="select">
              <option value="GLOBAL">GLOBAL</option>
              <option value="ORG">ORG</option>
            </select>
          </label>
          <label>排序<input v-model.number="form.sortCode" type="number" class="input" /></label>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="formOpen = false">取消</button>
          <button type="button" class="btn btn-sm btn-primary" :disabled="busy('save')" @click="saveForm">{{ busy('save') ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>

    <div v-if="grantOpen" class="modal-mask" @click.self="grantOpen = false">
      <div class="modal wide">
        <div class="modal-hd">角色菜单授权 · {{ grantRole?.name }}</div>
        <div class="modal-bd grant-list">
          <template v-for="item in flatMenus" :key="item.type + item.id">
            <div v-if="item.type === 'module'" class="mod-title">{{ item.title }}</div>
            <label v-else class="menu-item">
              <input type="checkbox" :checked="isChecked(item.id)" @change="toggleMenu(item.id)" />
              <span>{{ item.title }}</span>
              <span class="muted">{{ item.parentName || '' }}</span>
            </label>
          </template>
          <p v-if="!flatMenus.length" class="empty">暂无菜单资源</p>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="grantOpen = false">取消</button>
          <button type="button" class="btn btn-sm btn-primary" :disabled="busy('grant')" @click="saveGrant">{{ busy('grant') ? '保存中…' : '保存授权' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
}
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 24px;
}
.ops {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
}
.modal.wide {
  width: min(640px, 94vw);
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
}
.grant-list {
  display: grid;
  gap: 6px;
  max-height: 55vh;
  overflow: auto;
}
.mod-title {
  font-weight: 600;
  margin-top: 8px;
  color: var(--text-1);
}
.menu-item {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  padding-left: 8px;
}
.muted {
  color: var(--text-3);
  font-size: 11px;
}
</style>
