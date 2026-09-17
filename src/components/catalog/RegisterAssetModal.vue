<script setup>
import { computed, reactive, watch } from 'vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import {
  ASSET_DOMAINS,
  ASSET_LAYERS,
  ASSET_LEVELS,
  buildAssetIdentity,
} from '@/data/assetMeta'
import { useDatasources } from '@/composables/useDatasources'
import { resolveTables } from '@/utils/schemaList'
import { getAssetFields } from '@/utils/fieldSchema'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  presetSourceId: { type: String, default: '' },
  presetSourceName: { type: String, default: '' },
})
const emit = defineEmits(['close', 'submit'])

const { showToast } = useToast()
const { sources, getSource, ensureTables } = useDatasources()

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
  owner: '李明',
  bizOwner: '',
  level: '内部',
})

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

const tableSelectOptions = computed(() =>
  allTables.value.map((t) => ({
    value: t.name,
    label: t.name,
    sub: t.cnName || t.comment || '',
    cnName: t.cnName || '',
    comment: t.comment || '',
  })),
)

const selectedTable = computed(() =>
  allTables.value.find((t) => t.name === form.tableName) || null,
)

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
    owner: '李明',
    bizOwner: '',
    level: '内部',
  })
  if (preset?.id) ensureTables(preset.id)
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
    if (id) ensureTables(id)
  },
)

watch(
  () => form.tableName,
  (name) => {
    if (!name || !selectedSource.value) return
    const t = selectedTable.value
    applyIdentity()
    if (t) {
      form.cnName = t.cnName || form.cnName
      form.desc =
        t.comment || form.desc || `${t.cnName || name} · 自 ${selectedSource.value.name} 注册`
    }
  },
)

watch([() => form.layer, () => form.domain], () => {
  if (form.tableName) applyIdentity()
})

function applyIdentity() {
  const s = selectedSource.value
  if (!s || !form.tableName) return
  const ident = buildAssetIdentity(form.layer, form.domain, form.tableName, s.database)
  form.id = ident.id
  form.key = ident.key
  form.name = ident.name
}

function close() {
  emit('close')
}

function defaultEngine(type) {
  if (/ClickHouse/i.test(type)) return 'ClickHouse'
  if (/Hive|Iceberg|Delta|Trino/i.test(type)) return 'Iceberg'
  if (/Kafka|Pulsar/i.test(type)) return type
  return 'Iceberg'
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
  if (!form.layer) {
    showToast('请选择分层', 'warning')
    return
  }
  if (!form.domain) {
    showToast('请选择业务域', 'warning')
    return
  }
  applyIdentity()
  const s = selectedSource.value
  const t = selectedTable.value
  const fields = getAssetFields(
    { id: form.id, key: form.key, name: form.name, tableName: form.tableName },
    s.type,
  )
  emit('submit', {
    id: form.id,
    key: form.key,
    name: form.name,
    layer: form.layer,
    domain: form.domain,
    desc: form.desc || form.cnName || form.tableName,
    owner: form.owner,
    bizOwner: form.bizOwner || form.owner,
    level: form.level,
    engine: defaultEngine(s.type),
    partitions: form.layer === 'dim' ? '无·小表广播' : 'dt 按天',
    cols: fields.length,
    sourceId: s.id,
    sourceName: s.name,
    sourceType: s.type,
    tableName: form.tableName,
    cnName: form.cnName || t?.cnName || '',
    encoding: t?.encoding || '',
    fields,
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
              <label class="form-field wide">
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
              </label>
              <label class="form-field wide">
                <span class="form-label"><span class="req">*</span>表</span>
                <SearchSelect
                  v-model="form.tableName"
                  :options="tableSelectOptions"
                  value-key="value"
                  label-key="label"
                  sub-key="sub"
                  :search-keys="['cnName', 'comment']"
                  :disabled="!form.sourceId"
                  :placeholder="form.sourceId ? '搜索并选择表' : '请先选择数据源'"
                  :empty-text="form.sourceId ? '无匹配表，请先到数据源同步表清单' : '请先选择数据源'"
                />
              </label>
            </div>
            <div v-if="selectedSource" class="form-hint" style="margin-top: 8px">
              {{ selectedSource.id }} · {{ selectedSource.host }}:{{ selectedSource.port }}
              · 表清单 {{ allTables.length }} 项
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
                <input v-model="form.id" class="input" style="width: 100%" placeholder="自动生成，可改" />
              </label>
              <label class="form-field">
                <span class="form-label">物理名 / Key</span>
                <input v-model="form.key" class="input" style="width: 100%" placeholder="如 ods_trade.s_order" />
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
                <input v-model="form.owner" class="input" style="width: 100%" />
              </label>
              <label class="form-field">
                <span class="form-label">业务 Owner</span>
                <input v-model="form.bizOwner" class="input" style="width: 100%" placeholder="可选" />
              </label>
              <label class="form-field wide">
                <span class="form-label">描述</span>
                <textarea v-model="form.desc" class="textarea" rows="2" placeholder="资产用途说明" />
              </label>
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
