<script setup>
import { computed, reactive, ref, watch } from 'vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import {
  ASSET_DOMAINS,
  ASSET_LAYERS,
  ASSET_LEVELS,
  buildAssetIdentity,
} from '@/data/assetMeta'
import { fetchAssetPage } from '@/api/catalog'
import { useDatasources } from '@/composables/useDatasources'
import { useSession } from '@/composables/useSession'
import { resolveTables } from '@/utils/schemaList'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  presetSourceId: { type: String, default: '' },
  presetSourceName: { type: String, default: '' },
})
const emit = defineEmits(['close', 'submit'])

const { showToast } = useToast()
const { sources, getSource, ensureTables } = useDatasources()
const { user } = useSession()

const form = reactive({
  sourceId: '',
  tableName: '',
  layer: 'ods',
  domain: 'trade',
  key: '',
  id: '',
  name: '',
  cnName: '',
  desc: '',
  owner: '',
  bizOwner: '',
  level: '内部',
})

/** 用户改过资产 ID / Key 后，不再被自动规则覆盖 */
const identityTouched = ref(false)
/** 当前数据源已注册为资产的源对象名（小写） */
const registeredNames = ref(new Set())
const registeredLoading = ref(false)

const sourceSelectOptions = computed(() =>
  [...sources.value]
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((s) => ({
      value: s.id,
      label: s.name,
      sub: s.type,
      host: `${s.host}:${s.port}`,
      id: s.id,
    })),
)

const selectedSource = computed(() => getSource(form.sourceId))

const allTables = computed(() => {
  const s = selectedSource.value
  if (!s) return []
  return Array.isArray(s.tables) && s.tables.length ? s.tables : resolveTables(s)
})

const availableTables = computed(() =>
  allTables.value.filter((t) => !registeredNames.value.has(String(t.name || '').toLowerCase())),
)

const registeredCount = computed(() =>
  allTables.value.filter((t) => registeredNames.value.has(String(t.name || '').toLowerCase())).length,
)

const tableSelectOptions = computed(() =>
  availableTables.value.map((t) => ({
    value: t.name,
    label: t.name,
    sub: t.cnName || t.comment || '',
    cnName: t.cnName || '',
    comment: t.comment || '',
  })),
)

const tableEmptyText = computed(() => {
  if (!form.sourceId) return '请先选择数据源'
  if (registeredLoading.value) return '加载已注册资产…'
  if (!allTables.value.length) return '无匹配表，请先到数据源同步表清单'
  if (!availableTables.value.length) return '该数据源表均已注册为资产'
  return '无匹配表'
})

const selectedTable = computed(() =>
  availableTables.value.find((t) => t.name === form.tableName) || null,
)

function seedRegisteredFromSource(dsId) {
  const s = getSource(dsId)
  const linked = Array.isArray(s?.linkedAssets) ? s.linkedAssets : []
  const names = new Set()
  linked.forEach((a) => {
    const n = String(a?.objectName || a?.tableName || '').trim()
    if (n) names.add(n.toLowerCase())
  })
  registeredNames.value = names
}

async function loadRegisteredObjects(dsId) {
  if (!dsId) {
    registeredNames.value = new Set()
    return
  }
  seedRegisteredFromSource(dsId)
  registeredLoading.value = true
  try {
    const page = await fetchAssetPage({ dsId }, { current: 1, size: 500 })
    const names = new Set(registeredNames.value)
    ;(page?.records || []).forEach((row) => {
      const n = String(row?.objectName || row?.tableName || '').trim()
      if (n) names.add(n.toLowerCase())
    })
    registeredNames.value = names
    if (form.tableName && names.has(String(form.tableName).toLowerCase())) {
      form.tableName = ''
      form.key = ''
      form.id = ''
      form.name = ''
      form.cnName = ''
    }
  } catch (e) {
    console.warn('[catalog] load registered objects failed', e)
  } finally {
    registeredLoading.value = false
  }
}

function resetForm() {
  const preset =
    (props.presetSourceId && getSource(props.presetSourceId)) ||
    (props.presetSourceName &&
      sources.value.find(
        (s) => s.name === props.presetSourceName || s.id === props.presetSourceName,
      ))
  Object.assign(form, {
    sourceId: preset?.id || '',
    tableName: '',
    layer: 'ods',
    domain: 'trade',
    key: '',
    id: '',
    name: '',
    cnName: '',
    desc: '',
    owner: user.value?.id || '',
    bizOwner: '',
    level: '内部',
  })
  identityTouched.value = false
  registeredNames.value = new Set()
  if (preset?.id) {
    ensureTables(preset.id)
    loadRegisteredObjects(preset.id)
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) resetForm()
  },
)

watch(
  () => form.sourceId,
  (id, prev) => {
    if (!props.open || id === prev) return
    form.tableName = ''
    form.cnName = ''
    form.desc = ''
    form.key = ''
    form.id = ''
    form.name = ''
    identityTouched.value = false
    if (id) {
      ensureTables(id)
      loadRegisteredObjects(id)
    } else {
      registeredNames.value = new Set()
    }
  },
)

watch(
  () => form.tableName,
  (name) => {
    if (!name || !selectedSource.value) return
    const t = selectedTable.value
    identityTouched.value = false
    applyIdentity()
    if (t) {
      form.cnName = t.cnName || form.cnName
      form.desc =
        t.comment || form.desc || `${t.cnName || name} · 自 ${selectedSource.value.name} 注册`
    }
  },
)

watch([() => form.layer, () => form.domain], () => {
  if (form.tableName && !identityTouched.value) applyIdentity()
})

function applyIdentity() {
  const s = selectedSource.value
  if (!s || !form.tableName) return
  const ident = buildAssetIdentity(form.layer, form.domain, form.tableName, {
    database: s.database,
    dsCode: s.dsCode,
    dsId: s.id,
    dsName: s.name,
  })
  form.id = ident.id
  form.key = ident.key
  form.name = ident.name
}

function onIdInput() {
  identityTouched.value = true
  // 与 Key 同源，避免只改 ID 时仍提交旧 Key
  form.key = form.id
}

function onKeyInput() {
  identityTouched.value = true
  form.id = String(form.key || '').replace(/\./g, '_')
}

function close() {
  emit('close')
}

function defaultEngine(type) {
  const t = String(type || '').trim()
  if (!t) return ''
  if (/ClickHouse/i.test(t)) return 'ClickHouse'
  if (/Iceberg|Delta/i.test(t)) return 'Iceberg'
  if (/Hive/i.test(t)) return 'Hive'
  if (/Trino/i.test(t)) return 'Trino'
  // RDB / MQ / 对象存储等：用源类型本身，禁止一律写成 Iceberg
  return t
}

function submit() {
  if (!form.sourceId) {
    showToast('请选择数据源', 'warning')
    return
  }
  if (!form.tableName) {
    showToast('请选择表', 'warning')
    return
  }
  if (registeredNames.value.has(String(form.tableName).toLowerCase())) {
    showToast('该表已注册为资产，请选择其它表', 'warning')
    return
  }
  if (!form.layer) {
    showToast('请选择分层', 'warning')
    return
  }
  if (!form.domain) {
    showToast('请选择业务域', 'warning')
    return
  }
  // 未手动改过身份时再补一次；已改过则保留用户输入
  if (!identityTouched.value) applyIdentity()
  if (!form.id?.trim() && !form.key?.trim()) {
    showToast('请填写资产 ID 或物理名', 'warning')
    return
  }
  const s = selectedSource.value
  const t = selectedTable.value
  emit('submit', {
    id: form.id,
    key: form.key,
    name: form.name,
    layer: form.layer,
    domain: form.domain,
    desc: form.desc || form.cnName || form.tableName,
    owner: form.owner,
    bizOwner: form.bizOwner,
    level: form.level,
    engine: defaultEngine(s.type),
    sourceId: s.id,
    sourceName: s.name,
    sourceType: s.type,
    tableName: form.tableName,
    cnName: form.cnName || t?.cnName || '',
    encoding: t?.encoding || '',
  })
  close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-mask" @click.self="close">
      <div class="modal" style="width: 640px">
        <div class="modal-header">
          <div>
            <div class="modal-title">＋ 注册新资产</div>
            <div class="modal-sub">选数据源 → 选表 → 分层 / 业务域 → 补全信息 → 入目录</div>
          </div>
          <button class="btn btn-sm" @click="close">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-section">
            <div class="form-section-title">1. 选择数据源与表</div>
            <div class="form-grid">
              <div class="form-field wide">
                <span class="form-label"><span class="req">*</span>数据源</span>
                <SearchSelect
                  v-model="form.sourceId"
                  :options="sourceSelectOptions"
                  value-key="value"
                  label-key="label"
                  sub-key="sub"
                  :search-keys="['host', 'id']"
                  placeholder="搜索并选择数据源"
                />
              </div>
              <div class="form-field wide">
                <span class="form-label"><span class="req">*</span>表</span>
                <SearchSelect
                  v-model="form.tableName"
                  :options="tableSelectOptions"
                  value-key="value"
                  label-key="label"
                  sub-key="sub"
                  :search-keys="['cnName', 'comment']"
                  :disabled="!form.sourceId || registeredLoading"
                  :placeholder="form.sourceId ? '搜索并选择未注册表' : '请先选择数据源'"
                  :empty-text="tableEmptyText"
                />
              </div>
            </div>
            <div v-if="selectedSource" class="form-hint" style="margin-top: 8px">
              {{ selectedSource.id }} · {{ selectedSource.type }} · {{ selectedSource.host }}:{{ selectedSource.port }}
              · 可选 {{ availableTables.length }} / 清单 {{ allTables.length }}
              <template v-if="registeredCount"> · 已过滤已注册 {{ registeredCount }}</template>
              <template v-if="registeredLoading"> · 同步中…</template>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">2. 分层与业务域</div>
            <div class="form-grid">
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>数据分层</span>
                <select v-model="form.layer" class="select" style="width: 100%">
                  <option v-for="l in ASSET_LAYERS" :key="l.value" :value="l.value">
                    {{ l.full }}
                  </option>
                </select>
              </label>
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>业务域</span>
                <select v-model="form.domain" class="select" style="width: 100%">
                  <option v-for="d in ASSET_DOMAINS" :key="d.value" :value="d.value">
                    {{ d.label }}
                  </option>
                </select>
              </label>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">3. 资产信息</div>
            <div class="form-grid">
              <label class="form-field">
                <span class="form-label">资产 ID</span>
                <input
                  v-model="form.id"
                  class="input"
                  style="width: 100%"
                  placeholder="自动生成，可改"
                  @input="onIdInput"
                />
              </label>
              <label class="form-field">
                <span class="form-label">物理名 / Key</span>
                <input
                  v-model="form.key"
                  class="input"
                  style="width: 100%"
                  placeholder="如 ods_mysql_trade.dev_log"
                  @input="onKeyInput"
                />
              </label>
              <label class="form-field">
                <span class="form-label">中文名</span>
                <input v-model="form.cnName" class="input" style="width: 100%" placeholder="如 订单表" />
              </label>
              <label class="form-field">
                <span class="form-label">安全等级</span>
                <select v-model="form.level" class="select" style="width: 100%">
                  <option v-for="lv in ASSET_LEVELS" :key="lv.value" :value="lv.value">
                    {{ lv.value }}
                  </option>
                </select>
              </label>
              <label class="form-field">
                <span class="form-label">技术 Owner</span>
                <input
                  v-model="form.owner"
                  class="input"
                  style="width: 100%"
                  placeholder="默认当前用户；可改删/预览的技术负责人"
                />
              </label>
              <label class="form-field">
                <span class="form-label">业务 Owner</span>
                <input
                  v-model="form.bizOwner"
                  class="input"
                  style="width: 100%"
                  placeholder="可选；业务负责人，同样计拥有者"
                />
              </label>
              <label class="form-field wide">
                <span class="form-label">描述</span>
                <textarea v-model="form.desc" class="textarea" rows="2" placeholder="资产用途说明" />
              </label>
            </div>
            <div class="form-hint" style="margin-top: 8px">
              编码规则含数据源段，跨源同表名不会冲突；手动修改 ID / Key 后提交将按你填写的值入库。
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <span v-if="form.key" class="tag tag-blue">将注册：{{ form.key }}</span>
          <span style="flex: 1" />
          <button class="btn btn-sm" @click="close">取消</button>
          <button class="btn btn-sm btn-primary" @click="submit">注册入库</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
