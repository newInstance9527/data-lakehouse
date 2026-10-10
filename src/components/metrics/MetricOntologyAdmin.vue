<script setup>
/**
 * 修饰词 / 维度主数据维护（独立菜单页共用）
 * 应用方式：
 * - 修饰词：新建「衍生」指标时多选「业务限定」→ 编译写入版本快照；复合公式可选 WHERE（同 DSL）
 * - 维度：新建「衍生」时多选「统计粒度」→ GROUP BY；试跑/就绪指标/BI 用 filters.dims 切片
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useSession } from '@/composables/useSession'
import { useToast } from '@/composables/useToast'
import {
  loadQualifierAdminList,
  loadDimAdminList,
  addQualifierMaster,
  saveQualifierMaster,
  retireQualifier,
  addDimMaster,
  saveDimMaster,
  retireDim,
  ensureMetricQualifierOptions,
  ensureMetricDimOptions,
} from '@/data/metricOntology'
import { fetchMetricDimMembers } from '@/api/metric'
import { fetchAssetPage, fetchAssetSchema } from '@/api/catalog'
import { useDomains } from '@/composables/useDomains'

const props = defineProps({
  /** qualifier | dim */
  mode: { type: String, required: true },
})

const { currentWs } = useSession()
const { showToast } = useToast()
const { ensureDomains, domainSelectOptions } = useDomains()

const isQualifier = computed(() => props.mode === 'qualifier')
const editCode = ref('')
const list = ref([])
const busy = ref(false)
const qForm = ref({ code: '', name: '', exprDsl: '', domainCode: '' })
const dForm = ref(emptyDimForm())
const dimMemberPreview = ref(null)
const dimMemberPreviewBusy = ref(false)
const dimAssetOpts = ref([])
const dimAssetBusy = ref(false)
const dimColOpts = ref([])
const dimManualFqn = ref(false)
const domainOpts = ref([])

function emptyDimForm() {
  return {
    code: '',
    name: '',
    columnName: '',
    grainRole: 'biz',
    domainCode: '',
    factTable: '',
    bizProcess: '',
    dimTable: '',
    memberCodeCol: '',
    memberNameCol: '',
    parentCodeCol: '',
  }
}

function normalizeDimFqn(vo) {
  const om = String(vo?.omFqn || '').trim()
  if (om) return om
  const obj = String(vo?.objectName || vo?.tableName || '').trim()
  if (!obj) return ''
  if (/^(iceberg|hive)\./i.test(obj)) return obj
  if (obj.split('.').filter(Boolean).length >= 2) return `iceberg.${obj}`
  return `iceberg.dim.${obj}`
}

function isDimLayerFqn(fqn) {
  return /^(iceberg|hive)\.dim\.[A-Za-z_][A-Za-z0-9_]*$/i.test(String(fqn || '').trim())
}

async function loadDimAssetOpts() {
  dimAssetBusy.value = true
  try {
    const page = await fetchAssetPage(
      { layer: 'dim', ws: currentWs.value || 'default' },
      { current: 1, size: 200 },
    )
    const rows = page?.records || page?.rows || []
    dimAssetOpts.value = rows
      .map((a) => {
        const fqn = normalizeDimFqn(a)
        if (!isDimLayerFqn(fqn)) return null
        return {
          id: a.id,
          fqn,
          label: `${fqn}${a.name ? ` · ${a.name}` : ''}`,
        }
      })
      .filter(Boolean)
  } catch {
    dimAssetOpts.value = []
  } finally {
    dimAssetBusy.value = false
  }
}

async function onPickDimAsset(assetId) {
  const hit = dimAssetOpts.value.find((o) => String(o.id) === String(assetId))
  if (!hit) return
  dimManualFqn.value = false
  dForm.value.dimTable = hit.fqn
  dimColOpts.value = []
  try {
    const schema = await fetchAssetSchema(hit.id)
    const cols = Array.isArray(schema?.columns) ? schema.columns : []
    dimColOpts.value = cols
      .map((c) => String(c.name || c.columnName || c.field || '').trim())
      .filter(Boolean)
    if (dimColOpts.value.length && !dForm.value.memberCodeCol) {
      const guess =
        dimColOpts.value.find((c) => /code$/i.test(c)) ||
        dimColOpts.value.find((c) => c === dForm.value.columnName) ||
        dimColOpts.value[0]
      if (guess) dForm.value.memberCodeCol = guess
      if (!dForm.value.memberNameCol) {
        const nameGuess = dimColOpts.value.find((c) => /name|label|title/i.test(c))
        if (nameGuess) dForm.value.memberNameCol = nameGuess
      }
    }
  } catch {
    dimColOpts.value = []
  }
}

async function refreshList() {
  busy.value = true
  try {
    const ws = currentWs.value || 'default'
    list.value = isQualifier.value
      ? (await loadQualifierAdminList({ ws, status: 'active' })) || []
      : (await loadDimAdminList({ ws, status: 'active' })) || []
  } catch (e) {
    list.value = []
    showToast(e?.message || '加载失败', 'warning')
  } finally {
    busy.value = false
  }
}

function fillEdit(row) {
  if (!row?.code) return
  editCode.value = row.code
  if (isQualifier.value) {
    qForm.value = {
      code: row.code || '',
      name: row.name || '',
      exprDsl: row.exprDsl || '',
      domainCode: row.domainCode || '',
    }
  } else {
    dForm.value = {
      code: row.code || '',
      name: row.name || '',
      columnName: row.columnName || '',
      grainRole: row.grainRole || 'biz',
      domainCode: row.domainCode || '',
      factTable: row.factTable || '',
      bizProcess: row.bizProcess || '',
      dimTable: row.dimTable || '',
      memberCodeCol: row.memberCodeCol || '',
      memberNameCol: row.memberNameCol || '',
      parentCodeCol: row.parentCodeCol || '',
    }
  }
}

function clearEdit() {
  editCode.value = ''
  qForm.value = { code: '', name: '', exprDsl: '', domainCode: '' }
  dForm.value = emptyDimForm()
  dimMemberPreview.value = null
  dimColOpts.value = []
  dimManualFqn.value = false
}

async function submitSave() {
  const ws = currentWs.value || 'default'
  try {
    if (isQualifier.value) {
      const f = qForm.value
      if (!f.code?.trim() || !f.name?.trim() || !f.exprDsl?.trim()) {
        showToast('请填写编码、名称与限定条件', 'warning')
        return
      }
      if (editCode.value) {
        await saveQualifierMaster(editCode.value, { ...f, ws })
        showToast('修饰词已更新', 'success')
      } else {
        await addQualifierMaster({ ...f, ws })
        showToast('修饰词已创建', 'success')
      }
    } else {
      const f = dForm.value
      if (!f.code?.trim() || !f.name?.trim() || !f.columnName?.trim()) {
        showToast('请填写编码、名称与事实列', 'warning')
        return
      }
      if (editCode.value) {
        await saveDimMaster(editCode.value, { ...f, ws })
        showToast('维度已更新', 'success')
      } else {
        await addDimMaster({ ...f, ws })
        showToast('维度已创建', 'success')
      }
    }
    clearEdit()
    await refreshList()
    await ensureMetricQualifierOptions({ force: true })
    await ensureMetricDimOptions({ force: true })
  } catch (e) {
    showToast(e?.message || '保存失败', 'warning')
  }
}

async function previewDimMembers(row) {
  if (!row?.code) return
  if (!row.dimTable) {
    showToast('请先挂接 DIM 层表后再预览成员', 'warning')
    return
  }
  dimMemberPreviewBusy.value = true
  dimMemberPreview.value = null
  try {
    const res = await fetchMetricDimMembers(row.code, {
      ws: currentWs.value || 'default',
      limit: 50,
    })
    dimMemberPreview.value = {
      code: row.code,
      dimTable: res?.dimTable || row.dimTable,
      members: Array.isArray(res?.members) ? res.members : [],
      message: res?.message || '',
    }
  } catch (e) {
    showToast(e?.message || '预览成员失败', 'warning')
  } finally {
    dimMemberPreviewBusy.value = false
  }
}

async function onRetire(code) {
  if (!window.confirm(`停用 ${code}？已启用指标版本中的快照不受影响。`)) return
  try {
    const ws = currentWs.value || 'default'
    if (isQualifier.value) await retireQualifier(code, ws)
    else await retireDim(code, ws)
    showToast(`已停用 ${code}`, 'success')
    await refreshList()
  } catch (e) {
    showToast(e?.message || '停用失败', 'warning')
  }
}

onMounted(async () => {
  await ensureDomains()
  domainOpts.value = domainSelectOptions() || []
  await refreshList()
  if (!isQualifier.value) await loadDimAssetOpts()
})

watch(
  () => props.mode,
  async () => {
    clearEdit()
    await refreshList()
    if (!isQualifier.value) await loadDimAssetOpts()
  },
)

watch(currentWs, async () => {
  clearEdit()
  await refreshList()
  if (!isQualifier.value) await loadDimAssetOpts()
})
</script>

<template>
  <div class="mo-admin">
    <div class="card mo-howto">
      <div class="ds-step-t">如何应用</div>
      <template v-if="isQualifier">
        <ol class="mo-steps tip">
          <li>在此维护可复用的业务限定（白名单条件，如「支付成功」）。</li>
          <li>
            到
            <router-link to="/metrics/catalog">指标目录</router-link>
            新建「衍生」指标时，在<strong>业务限定</strong>中多选本库条目。
          </li>
          <li>保存/编译后写入该版本快照；改主数据<strong>不会</strong>改写已启用版本。</li>
          <li>复合指标公式里也可写 WHERE（同一套 DSL）。</li>
        </ol>
      </template>
      <template v-else>
        <ol class="mo-steps tip">
          <li>在此登记统计粒度列，并可挂接湖仓 DIM 层表（成员权威）。</li>
          <li>
            新建「衍生」指标时在<strong>统计粒度</strong>中多选 → 编译为 GROUP BY。
          </li>
          <li>
            试跑、就绪指标、BI 维筛选通过
            <code>filters.dims</code>
            按成员切片（省略=不切片）。
          </li>
        </ol>
      </template>
    </div>

    <div class="card mo-form">
      <div class="ds-step-t">{{ editCode ? '编辑' : '新建' }}{{ isQualifier ? '修饰词' : '维度' }}</div>

      <template v-if="isQualifier">
        <div class="mo-grid">
          <label>
            <span>编码 <em>必填 · 输入</em></span>
            <input
              v-model="qForm.code"
              class="input"
              :disabled="!!editCode"
              placeholder="如 Q_PAY_OK"
            />
          </label>
          <label>
            <span>名称 <em>必填 · 输入</em></span>
            <input v-model="qForm.name" class="input" placeholder="如 支付成功" />
          </label>
          <label class="wide">
            <span>限定条件（DSL） <em>必填 · 输入</em></span>
            <input
              v-model="qForm.exprDsl"
              class="input"
              placeholder="pay_status = 'SUCCESS'"
            />
            <span class="tip">允许 = != IN BETWEEN LIKE IS NULL；禁止子查询与分号</span>
          </label>
          <label>
            <span>业务域 <em>可选 · 选择</em></span>
            <select v-model="qForm.domainCode" class="input">
              <option value="">不限</option>
              <option v-for="o in domainOpts" :key="o.value" :value="o.value">
                {{ o.label || o.value }}
              </option>
            </select>
          </label>
        </div>
      </template>
      <template v-else>
        <div class="mo-grid">
          <label>
            <span>编码 <em>必填 · 输入</em></span>
            <input
              v-model="dForm.code"
              class="input"
              :disabled="!!editCode"
              placeholder="如 DIM_CHANNEL"
            />
          </label>
          <label>
            <span>名称 <em>必填 · 输入</em></span>
            <input v-model="dForm.name" class="input" placeholder="如 渠道" />
          </label>
          <label>
            <span>事实列名 <em>必填 · 输入</em></span>
            <input v-model="dForm.columnName" class="input" placeholder="channel_code" />
            <span class="tip">事实表上的维度列，编译进粒度</span>
          </label>
          <label>
            <span>角色 <em>必填 · 选择</em></span>
            <select v-model="dForm.grainRole" class="input">
              <option value="biz">业务维 biz</option>
              <option value="time">时间维 time</option>
            </select>
          </label>
          <label class="wide">
            <span>DIM 层表 <em>推荐 · 选择资产</em></span>
            <select
              v-if="!dimManualFqn"
              class="input"
              :disabled="dimAssetBusy"
              :value="dimAssetOpts.find((o) => o.fqn === dForm.dimTable)?.id || ''"
              @change="onPickDimAsset($event.target.value)"
            >
              <option value="">{{ dimAssetBusy ? '加载中…' : '从资产目录选 layer=dim' }}</option>
              <option v-for="o in dimAssetOpts" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <input
              v-else
              v-model="dForm.dimTable"
              class="input"
              placeholder="iceberg.dim.dim_channel"
            />
            <span class="tip mo-inline">
              <router-link to="/catalog">去登记 DIM 表</router-link>
              <button type="button" class="btn-link" @click="dimManualFqn = !dimManualFqn">
                {{ dimManualFqn ? '改选资产' : '手填 FQN' }}
              </button>
              <button type="button" class="btn-link" :disabled="dimAssetBusy" @click="loadDimAssetOpts">
                刷新
              </button>
            </span>
          </label>
          <label>
            <span>成员编码列 <em>可选 · 选择/输入</em></span>
            <select v-if="dimColOpts.length" v-model="dForm.memberCodeCol" class="input">
              <option value="">默认=事实列</option>
              <option v-for="c in dimColOpts" :key="'c-' + c" :value="c">{{ c }}</option>
            </select>
            <input v-else v-model="dForm.memberCodeCol" class="input" placeholder="默认=事实列" />
          </label>
          <label>
            <span>成员名称列 <em>可选 · 选择/输入</em></span>
            <select v-if="dimColOpts.length" v-model="dForm.memberNameCol" class="input">
              <option value="">默认 name</option>
              <option v-for="c in dimColOpts" :key="'n-' + c" :value="c">{{ c }}</option>
            </select>
            <input v-else v-model="dForm.memberNameCol" class="input" placeholder="默认 name" />
          </label>
          <label>
            <span>父编码列 <em>可选 · 选择/输入</em></span>
            <select v-if="dimColOpts.length" v-model="dForm.parentCodeCol" class="input">
              <option value="">无</option>
              <option v-for="c in dimColOpts" :key="'p-' + c" :value="c">{{ c }}</option>
            </select>
            <input v-else v-model="dForm.parentCodeCol" class="input" placeholder="可选" />
          </label>
          <label>
            <span>业务域 <em>可选 · 选择</em></span>
            <select v-model="dForm.domainCode" class="input">
              <option value="">不限</option>
              <option v-for="o in domainOpts" :key="o.value" :value="o.value">
                {{ o.label || o.value }}
              </option>
            </select>
          </label>
          <label class="wide">
            <span>说明 <em>可选 · 输入</em></span>
            <input v-model="dForm.bizProcess" class="input" placeholder="业务过程说明（可选）" />
          </label>
        </div>
      </template>

      <div class="mo-actions">
        <button type="button" class="btn btn-sm btn-primary" @click="submitSave">
          {{ editCode ? '保存修改' : '创建' }}
        </button>
        <button v-if="editCode" type="button" class="btn btn-sm" @click="clearEdit">取消编辑</button>
        <button type="button" class="btn btn-sm" :disabled="busy" @click="refreshList">刷新列表</button>
      </div>
    </div>

    <div class="card mo-list">
      <div class="ds-step-t">已启用列表</div>
      <div v-if="busy" class="tip">加载中…</div>
      <div v-else-if="!list.length" class="tip">暂无数据，请用上方表单创建。</div>
      <ul v-else class="mo-rows">
        <li v-for="row in list" :key="row.code">
          <div>
            <strong>{{ row.code }}</strong> · {{ row.name }}
            <div class="tip">
              <template v-if="isQualifier">{{ row.exprDsl }} → {{ row.exprSql }}</template>
              <template v-else>
                列 {{ row.columnName }} · {{ row.grainRole }}
                <template v-if="row.dimTable"> · {{ row.dimTable }}</template>
                <template v-if="row.dimStatus === 'bound'"> · 已挂接</template>
              </template>
            </div>
          </div>
          <div class="mo-row-acts">
            <button type="button" class="btn btn-sm" @click="fillEdit(row)">编辑</button>
            <button
              v-if="!isQualifier && row.dimTable"
              type="button"
              class="btn btn-sm"
              :disabled="dimMemberPreviewBusy"
              @click="previewDimMembers(row)"
            >
              预览成员
            </button>
            <button type="button" class="btn btn-sm" @click="onRetire(row.code)">停用</button>
          </div>
        </li>
      </ul>
      <div v-if="!isQualifier && dimMemberPreview" class="mo-preview tip">
        <strong>成员预览 · {{ dimMemberPreview.code }}</strong>
        <p>{{ dimMemberPreview.dimTable }}</p>
        <p v-if="dimMemberPreview.message">{{ dimMemberPreview.message }}</p>
        <ul v-if="dimMemberPreview.members?.length">
          <li v-for="m in dimMemberPreview.members.slice(0, 30)" :key="m.code">
            {{ m.name || m.code }}（{{ m.code }}）
          </li>
        </ul>
        <p v-else>无成员行</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mo-admin {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.mo-howto,
.mo-form,
.mo-list {
  padding: 16px 18px;
}
.mo-steps {
  margin: 8px 0 0;
  padding-left: 1.2rem;
  line-height: 1.6;
}
.mo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
  margin-top: 12px;
}
.mo-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
}
.mo-grid label.wide {
  grid-column: 1 / -1;
}
.mo-grid label em {
  font-style: normal;
  font-weight: 400;
  color: var(--text-3, #999);
  font-size: 11px;
  margin-left: 6px;
}
.mo-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 4px;
}
.mo-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.mo-rows {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mo-rows li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.mo-row-acts {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.mo-preview {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-2, #f7f8fa);
  border-radius: 8px;
}
@media (max-width: 720px) {
  .mo-grid {
    grid-template-columns: 1fr;
  }
}
</style>
