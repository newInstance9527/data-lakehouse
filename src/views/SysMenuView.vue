<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { menuTree, addMenu, editMenu, deleteMenus, menuModuleSelector } from '@/api/sys'

const { showToast } = useToast()
const loading = ref(false)
const tree = ref([])
const modules = ref([])
const collapsed = ref(new Set())

const formOpen = ref(false)
const formMode = ref('add')
const form = reactive({
  id: '',
  parentId: '0',
  title: '',
  menuType: 'MENU',
  module: '',
  path: '',
  name: '',
  component: '',
  icon: '',
  sortCode: 99,
  visible: 'TRUE',
})

onMounted(async () => {
  await Promise.all([loadModules(), load()])
})

async function loadModules() {
  try {
    const list = await menuModuleSelector()
    modules.value = Array.isArray(list) ? list : []
    if (!form.module && modules.value[0]) form.module = modules.value[0].id || modules.value[0].value || ''
  } catch {
    modules.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const data = await menuTree({})
    tree.value = Array.isArray(data) ? data : []
  } catch (e) {
    showToast(e.message || '加载菜单失败', 'error')
  } finally {
    loading.value = false
  }
}

const flatRows = computed(() => {
  const out = []
  const walk = (nodes, depth, parentHidden) => {
    if (!Array.isArray(nodes)) return
    for (const n of nodes) {
      const hidden = parentHidden || collapsed.value.has(String(n.parentId || ''))
      if (!hidden) {
        out.push({ ...n, _depth: depth, _hasKids: !!(n.children && n.children.length) })
      }
      const kidsHidden = hidden || collapsed.value.has(String(n.id))
      walk(n.children || [], depth + 1, kidsHidden)
    }
  }
  walk(tree.value, 0, false)
  return out
})

function toggle(id) {
  const sid = String(id)
  const next = new Set(collapsed.value)
  if (next.has(sid)) next.delete(sid)
  else next.add(sid)
  collapsed.value = next
}

function openAdd(parent) {
  formMode.value = 'add'
  Object.assign(form, {
    id: '',
    parentId: parent?.id || '0',
    title: '',
    menuType: 'MENU',
    module: parent?.module || modules.value[0]?.id || modules.value[0]?.value || form.module,
    path: '',
    name: '',
    component: '',
    icon: '',
    sortCode: 99,
    visible: 'TRUE',
  })
  formOpen.value = true
}

function openEdit(n) {
  formMode.value = 'edit'
  Object.assign(form, {
    id: n.id,
    parentId: n.parentId || '0',
    title: n.title || '',
    menuType: n.menuType || 'MENU',
    module: n.module || '',
    path: n.path || '',
    name: n.name || '',
    component: n.component || '',
    icon: n.icon || '',
    sortCode: n.sortCode ?? 99,
    visible: n.visible || 'TRUE',
  })
  formOpen.value = true
}

async function saveForm() {
  if (!form.title || !form.path || !form.module) {
    showToast('请填写标题、路径、模块', 'warning')
    return
  }
  try {
    if (formMode.value === 'add') await addMenu({ ...form })
    else await editMenu({ ...form })
    showToast('菜单已保存', 'success')
    formOpen.value = false
    await load()
  } catch (e) {
    showToast(e.message || '保存失败', 'error')
  }
}

async function remove(n) {
  if (!confirm(`确认删除菜单「${n.title || n.name}」？`)) return
  try {
    await deleteMenus([n.id])
    showToast('已删除', 'success')
    await load()
  } catch (e) {
    showToast(e.message || '删除失败', 'error')
  }
}
</script>

<template>
  <div class="sys-page">
    <PageHeader title="菜单管理" subtitle="资源树 · 增删改 · 对接 /sys/menu">
      <button type="button" class="btn btn-sm btn-primary" @click="openAdd(null)">＋ 新建根菜单</button>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="load">↻ 刷新</button>
    </PageHeader>

    <div class="card">
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>标题</th>
              <th>路径</th>
              <th>类型</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="4" class="empty">加载中…</td>
            </tr>
            <tr v-else-if="!flatRows.length">
              <td colspan="4" class="empty">暂无菜单</td>
            </tr>
            <tr v-for="n in flatRows" :key="n.id">
              <td>
                <span :style="{ paddingLeft: n._depth * 16 + 'px' }" class="title-cell">
                  <button
                    v-if="n._hasKids"
                    type="button"
                    class="exp"
                    @click="toggle(n.id)"
                  >
                    {{ collapsed.has(String(n.id)) ? '▸' : '▾' }}
                  </button>
                  <span v-else class="exp-sp" />
                  {{ n.title || n.name }}
                </span>
              </td>
              <td><code>{{ n.path || '—' }}</code></td>
              <td><span class="tag tag-gray">{{ n.menuType || 'MENU' }}</span></td>
              <td class="ops">
                <button type="button" class="btn-link" @click="openAdd(n)">子菜单</button>
                <button type="button" class="btn-link" @click="openEdit(n)">编辑</button>
                <button type="button" class="btn-link danger" @click="remove(n)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="formOpen" class="modal-mask" @click.self="formOpen = false">
      <div class="modal">
        <div class="modal-hd">{{ formMode === 'add' ? '新建菜单' : '编辑菜单' }}</div>
        <div class="modal-bd form-grid">
          <label>标题<input v-model="form.title" class="input" /></label>
          <label>
            类型
            <select v-model="form.menuType" class="select">
              <option value="MENU">MENU</option>
              <option value="BUTTON">BUTTON</option>
            </select>
          </label>
          <label>
            模块
            <select v-model="form.module" class="select">
              <option v-for="m in modules" :key="m.id || m.value" :value="m.id || m.value">
                {{ m.title || m.name || m.id }}
              </option>
            </select>
          </label>
          <label>路径<input v-model="form.path" class="input" placeholder="/sys/users" /></label>
          <label>别名<input v-model="form.name" class="input" placeholder="sys-users" /></label>
          <label>组件<input v-model="form.component" class="input" /></label>
          <label>图标<input v-model="form.icon" class="input" /></label>
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
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 24px;
}
.title-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.exp {
  border: none;
  background: transparent;
  cursor: pointer;
  width: 18px;
}
.exp-sp {
  display: inline-block;
  width: 18px;
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
  width: min(520px, 92vw);
  max-height: 85vh;
  overflow: auto;
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
</style>
