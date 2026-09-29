<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  createDomain,
  deleteDomain,
  disableDomain,
  enableDomain,
  fetchDomainList,
  fetchDomainUsage,
  updateDomain,
} from '@/api/domain'
import { useDomains } from '@/composables/useDomains'

const { showToast } = useToast()
const guide = pageGuideOf('domain')
const { ensureDomains } = useDomains()

const loading = ref(false)
const rows = ref([])
const kw = ref('')
const statusFilter = ref('')

const formOpen = ref(false)
const formMode = ref('add')
const form = reactive({
  domainCode: '',
  name: '',
  owner: '',
  sortNo: 100,
  remark: '',
  status: 'active',
})

const filtered = computed(() => {
  const q = kw.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (statusFilter.value && r.status !== statusFilter.value) return false
    if (!q) return true
    return `${r.domainCode} ${r.name} ${r.owner || ''} ${r.remark || ''}`
      .toLowerCase()
      .includes(q)
  })
})

onMounted(() => {
  loadList()
  ensureDomains(true)
})

async function loadList() {
  loading.value = true
  try {
    const list = await fetchDomainList({ status: statusFilter.value || undefined, q: kw.value || undefined })
    rows.value = Array.isArray(list) ? list : []
    // attach usage (best-effort)
    await Promise.all(
      rows.value.slice(0, 40).map(async (r) => {
        try {
          r.usage = await fetchDomainUsage(r.domainCode)
        } catch {
          r.usage = null
        }
      }),
    )
  } catch (e) {
    rows.value = []
    showToast(e?.message || '域列表加载失败', 'warning')
  } finally {
    loading.value = false
  }
}

function openAdd() {
  formMode.value = 'add'
  Object.assign(form, {
    domainCode: '',
    name: '',
    owner: '',
    sortNo: 100,
    remark: '',
    status: 'active',
  })
  formOpen.value = true
}

function openEdit(row) {
  formMode.value = 'edit'
  Object.assign(form, {
    domainCode: row.domainCode,
    name: row.name,
    owner: row.owner || '',
    sortNo: row.sortNo ?? 100,
    remark: row.remark || '',
    status: row.status || 'active',
  })
  formOpen.value = true
}

async function submitForm() {
  const code = form.domainCode.trim().toLowerCase()
  const name = form.name.trim()
  if (!code || !name) {
    showToast('编码与名称必填', 'warning')
    return
  }
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(code)) {
    showToast('编码须小写字母开头，仅含 a-z0-9_', 'warning')
    return
  }
  try {
    const body = {
      domainCode: code,
      name,
      owner: form.owner || undefined,
      sortNo: Number(form.sortNo) || 0,
      remark: form.remark || undefined,
      status: form.status,
    }
    if (formMode.value === 'add') {
      await createDomain(body)
      showToast('已新建数据域', 'success')
    } else {
      await updateDomain(code, body)
      showToast('已更新数据域', 'success')
    }
    formOpen.value = false
    await ensureDomains(true)
    await loadList()
  } catch (e) {
    showToast(e?.message || '保存失败', 'error')
  }
}

async function onDisable(row) {
  try {
    await disableDomain(row.domainCode)
    showToast(`已停用 ${row.name}`, 'success')
    await ensureDomains(true)
    await loadList()
  } catch (e) {
    showToast(e?.message || '停用失败（可能仍有引用）', 'warning')
  }
}

async function onEnable(row) {
  try {
    await enableDomain(row.domainCode)
    showToast(`已启用 ${row.name}`, 'success')
    await ensureDomains(true)
    await loadList()
  } catch (e) {
    showToast(e?.message || '启用失败', 'warning')
  }
}

async function onDelete(row) {
  if (!window.confirm(`软删数据域「${row.name}」？若仍被指标/资产/标准引用将失败。`)) return
  try {
    await deleteDomain(row.domainCode)
    showToast('已软删', 'success')
    await ensureDomains(true)
    await loadList()
  } catch (e) {
    showToast(e?.message || '删除失败', 'warning')
  }
}

function usageText(u) {
  if (!u) return '—'
  const t = u.total ?? (u.metricCount || 0) + (u.assetCount || 0) + (u.standardFieldCount || 0)
  return `${t}（指标 ${u.metricCount ?? 0} · 资产 ${u.assetCount ?? 0} · 标准 ${u.standardFieldCount ?? 0}）`
}
</script>

<template>
  <div class="domain-page">
    <PageHeader
      page-id="domain"
      title="数据域管理"
      subtitle="业务域字典 · 供指标中心 / 资产目录 / 数据标准共用"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" :disabled="loading" @click="loadList">
        {{ loading ? '…' : '刷新' }}
      </button>
      <button type="button" class="btn btn-sm btn-primary" @click="openAdd">＋ 新建域</button>
    </PageHeader>

    <p class="tip domain-banner">
      编码 <code>domain_code</code> 小写唯一；商品域规范码 <code>goods</code>（历史
      <code>product</code> 读路径兼容）。停用后下拉不再出现。
    </p>

    <div class="card">
      <div class="card-header">
        <div class="card-title">域列表</div>
        <div class="domain-filters">
          <input v-model="kw" class="input input-sm" placeholder="搜索编码 / 名称…" @keyup.enter="loadList" />
          <select v-model="statusFilter" class="select input-sm" @change="loadList">
            <option value="">全部状态</option>
            <option value="active">启用</option>
            <option value="disabled">停用</option>
          </select>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>编码</th>
              <th>名称</th>
              <th>排序</th>
              <th>状态</th>
              <th>引用</th>
              <th>负责人</th>
              <th style="width: 220px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filtered.length">
              <td colspan="7" class="tip" style="padding: 16px">
                {{ loading ? '加载中…' : '暂无数据域 · 空列表合法' }}
              </td>
            </tr>
            <tr v-for="r in filtered" :key="r.domainCode">
              <td><code>{{ r.domainCode }}</code></td>
              <td><b>{{ r.name }}</b></td>
              <td>{{ r.sortNo ?? '—' }}</td>
              <td>
                <span class="tag" :class="r.status === 'active' ? 'tag-green' : 'tag-gray'">
                  {{ r.status === 'active' ? '启用' : '停用' }}
                </span>
              </td>
              <td style="font-size: 11px">{{ usageText(r.usage) }}</td>
              <td>{{ r.owner || '—' }}</td>
              <td>
                <button type="button" class="btn btn-sm" @click="openEdit(r)">编辑</button>
                <button
                  v-if="r.status === 'active'"
                  type="button"
                  class="btn btn-sm"
                  @click="onDisable(r)"
                >
                  停用
                </button>
                <button v-else type="button" class="btn btn-sm" @click="onEnable(r)">启用</button>
                <button type="button" class="btn btn-sm" style="color: var(--danger)" @click="onDelete(r)">
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="formOpen" class="domain-modal-mask" @click.self="formOpen = false">
      <div class="domain-modal card">
        <div class="card-header">
          <div class="card-title">{{ formMode === 'add' ? '新建数据域' : '编辑数据域' }}</div>
          <button type="button" class="btn btn-sm" @click="formOpen = false">关闭</button>
        </div>
        <div class="card-body domain-form">
          <label>
            编码
            <input
              v-model="form.domainCode"
              class="input"
              :disabled="formMode === 'edit'"
              placeholder="如 trade"
            />
          </label>
          <label>
            名称
            <input v-model="form.name" class="input" placeholder="如 交易域" />
          </label>
          <label>
            排序
            <input v-model.number="form.sortNo" class="input" type="number" />
          </label>
          <label>
            负责人
            <input v-model="form.owner" class="input" placeholder="可选" />
          </label>
          <label class="wide">
            备注
            <input v-model="form.remark" class="input" placeholder="可选" />
          </label>
          <div class="domain-form-actions">
            <button type="button" class="btn" @click="formOpen = false">取消</button>
            <button type="button" class="btn btn-primary" @click="submitForm">保存</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.domain-banner {
  margin: 0 0 12px;
}
.domain-filters {
  display: flex;
  gap: 8px;
  align-items: center;
}
.domain-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.domain-modal {
  width: min(480px, 100%);
  max-height: 90vh;
  overflow: auto;
}
.domain-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.domain-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-2);
}
.domain-form label.wide {
  grid-column: 1 / -1;
}
.domain-form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
