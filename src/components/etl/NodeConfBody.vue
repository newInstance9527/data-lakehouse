<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SearchSelect from '@/components/common/SearchSelect.vue'
import MultiSearchSelect from '@/components/common/MultiSearchSelect.vue'
import SqlEditor from '@/components/etl/SqlEditor.vue'
import CleanFieldRules from '@/components/etl/CleanFieldRules.vue'
import ConditionBranchesEditor from '@/components/etl/ConditionBranchesEditor.vue'
import { fetchQualityRules } from '@/api/quality'
import { fetchPreviewSchema } from '@/api/datasource'
import { useDatasources } from '@/composables/useDatasources'
import { useAssets } from '@/composables/useAssets'
import { useStandards } from '@/composables/useStandards'
import { fieldsForTableName } from '@/utils/etlFields'
import {
  AUTO_CREATE_MODES,
  SCHEMA_FROM_OPTIONS,
  buildCreateDdlPreview,
} from '@/utils/etlAutoCreate'

const props = defineProps({
  type: { type: String, required: true },
  conf: { type: Object, required: true },
  upstreamFields: { type: Array, default: () => [] },
})
const emit = defineEmits(['patch', 'patch-many'])

const router = useRouter()

function goExportApply() {
  router.push({ path: '/export', query: { action: 'apply', from: 'etl' } })
}

function goApplyCenter() {
  router.push({ path: '/apply', query: { tab: 'export' } })
}

const { sources, dagSources, ensureTables, getSource, loadSources, loadDagUsableSources, loaded: dsLoaded } =
  useDatasources()
const { list: assetList } = useAssets()
const { fieldList, codeList, ensureLoaded: ensureStdLoaded, loaded: stdLoaded } = useStandards()

const DB_TYPES = ['MySQL', 'PostgreSQL', 'Oracle', 'SQLServer', 'MongoDB', 'TiDB', 'SQLite']
const STARTUP_MODES = [
  { value: 'initial', label: 'initial (快照+增量)' },
  { value: 'latest-offset', label: 'latest-offset (只增量)' },
  { value: 'timestamp', label: 'timestamp 指定时间' },
]

const dqRuleOptions = ref([])

onMounted(async () => {
  try {
    const page = await fetchQualityRules({}, { current: 1, size: 200 })
    dqRuleOptions.value = (page?.records || []).map((r) => ({
      id: r.id,
      label: `${r.ruleCode || r.id} · ${r.tableName || ''}${r.fieldName ? '.' + r.fieldName : ''}`,
      table: r.tableName,
    }))
  } catch {
    dqRuleOptions.value = []
  }
  if (props.type === 'mapping') {
    ensureStdLoaded()?.catch?.(() => {})
  }
  loadDagUsableSources().catch(() => {})
})

watch(
  () => props.type,
  (t) => {
    if (t === 'mapping') ensureStdLoaded()?.catch?.(() => {})
    if (t && (t === 'source' || String(t).startsWith('source_') || String(t).startsWith('sink_'))) {
      loadDagUsableSources().catch(() => {})
    }
  },
)

function set(key, val) {
  emit('patch', key, val)
}
function setMany(obj) {
  emit('patch-many', obj)
}
function setNested(parent, key, val) {
  emit('patch-many', { [parent]: { ...(props.conf[parent] || {}), [key]: val } })
}

/** Iceberg：演示名 prod_catalog/hive 自动改写为真实湖 catalog iceberg */
function onIcebergCatalogInput(raw) {
  const v = String(raw || '').trim()
  if (/^(prod_catalog|hive)$/i.test(v)) {
    set('catalog', 'iceberg')
    return
  }
  set('catalog', raw)
}

const icebergCatalogHint = computed(() => {
  if (props.type !== 'sink_iceberg') return ''
  const c = String(props.conf?.catalog || '').trim()
  if (/^(prod_catalog|hive)$/i.test(c)) {
    return '演示名已禁用：将改写为 iceberg（Trino/Grav 无此 catalog；autoCreate 只建 schema/表）'
  }
  if (!c || c === 'iceberg') return ''
  return '须为 Grav/Trino 已存在的湖 catalog（默认 iceberg）；autoCreate 不会新建 catalog'
})

const etlSourcePool = computed(() => {
  if (dagSources.value.length > 0) return dagSources.value
  return (sources.value || []).filter((s) => {
    const st = String(s.status || '').toLowerCase()
    if (st && st !== 'online') return false
    const raw = s.purposes ?? s.purpose ?? ''
    const p = typeof raw === 'string' ? raw : JSON.stringify(raw || [])
    if (!p || p === '[]' || p === 'null') return true
    return p.includes('ingest') || p.includes('export')
  })
})

const dsOptions = computed(() =>
  etlSourcePool.value.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.type})`,
  })),
)

const kafkaDsOptions = computed(() =>
  etlSourcePool.value
    .filter((s) => String(s.type || '').toLowerCase().includes('kafka') || s.category === 'mq')
    .map((s) => ({ value: s.id, label: `${s.name} (${s.type})` })),
)

const apiDsOptions = computed(() =>
  etlSourcePool.value
    .filter((s) => {
      const t = String(s.type || '').toLowerCase()
      const c = String(s.category || '').toLowerCase()
      return (
        c === 'api' ||
        t.includes('api') ||
        t.includes('http') ||
        t.includes('openapi') ||
        t.includes('rest')
      )
    })
    .map((s) => ({ value: s.id, label: `${s.name} (${s.type})` })),
)

const tableOptions = ref([])
/** 数据源预览列：[{ table, column, type }] */
const schemaColumns = ref([])
const schemaLoading = ref(false)

watch(
  () => props.conf?.dsId,
  async (id) => {
    if (!id) {
      tableOptions.value = []
      schemaColumns.value = []
      return
    }
    if (!dsLoaded.value) {
      try {
        await loadSources()
      } catch {
        /* soft-fail */
      }
    }
    try {
      const tables = await ensureTables(id)
      tableOptions.value = (Array.isArray(tables) ? tables : []).map((t) => ({
        value: t.name,
        label: t.name,
        sub: t.cnName || t.comment || '',
      }))
    } catch (e) {
      console.warn('[etl] load tables failed', e)
      tableOptions.value = []
    }
    schemaLoading.value = true
    try {
      const res = await fetchPreviewSchema(id)
      const cols = Array.isArray(res?.columns) ? res.columns : []
      schemaColumns.value = cols
        .filter((c) => c?.column || c?.name)
        .map((c) => ({
          table: c.table || '',
          column: c.column || c.name,
          type: c.type || '',
        }))
    } catch (e) {
      console.warn('[etl] previewSchema failed', e)
      schemaColumns.value = []
    } finally {
      schemaLoading.value = false
    }
  },
  { immediate: true },
)

const lakeTableOptions = computed(() =>
  (assetList.value || []).map((a) => ({
    value: a.key || a.name,
    label: a.key || a.name,
    sub: `${a.layerLabel || a.layer || ''} · ${a.domainLabel || ''}`,
  })),
)

const boundSource = computed(() => {
  const id = props.conf?.dsId
  if (!id) return null
  return getSource(id) || null
})

const dsBound = computed(() => !!props.conf?.dsId)

const transformEngine = computed(() => String(props.conf?.engine || 'spark').toLowerCase())
const showSparkResources = computed(() => transformEngine.value.includes('spark'))

const ruleIdSet = computed(() => new Set(props.conf?.ruleIds || []))

function toggleRuleId(id) {
  const cur = new Set(props.conf?.ruleIds || [])
  if (cur.has(id)) cur.delete(id)
  else cur.add(id)
  set('ruleIds', [...cur])
}

function typeLabel(t) {
  if (!t) return '—'
  const m = {
    mysql: 'MySQL',
    postgresql: 'PostgreSQL',
    postgres: 'PostgreSQL',
    oracle: 'Oracle',
    sqlserver: 'SQLServer',
    mongodb: 'MongoDB',
    tidb: 'TiDB',
    kafka: 'Kafka',
  }
  return m[String(t).toLowerCase()] || t
}

function resolvedEngineHint() {
  const mode = props.conf?.mode
  if (mode === 'cdc') return 'CDC 实时（由 mode=cdc 路由）'
  if (mode === 'batch') return '批抽取（由路由决定）'
  if (mode === 'incremental') return '批抽 + watermark 水位'
  return '随任务默认引擎'
}

function onBindDs(id) {
  if (!id) {
    set('dsId', '')
    return
  }
  const s = getSource(id)
  setMany({
    dsId: id,
    password: '',
    authPass: '',
    authToken: '',
    apiKey: '',
    accessKey: '',
    host: '',
    port: undefined,
    database: '',
    username: '',
    bootstrap: '',
    dbType: s ? typeLabel(s.type) : props.conf.dbType,
    baseUrl: s?.endpoint || s?.host || props.conf.baseUrl || '',
  })
  ensureTables(id).catch(() => {})
}

/** 解析数据源接口清单条目：`GET /order` / `/orders` / `GET /order (OpenAPI)` */
function parseApiInventoryEntry(raw) {
  const s = String(raw || '').trim()
  if (!s) return { path: '', method: '' }
  const cleaned = s.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const m = cleaned.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)/i)
  if (m) {
    let path = m[2]
    if (!path.startsWith('/') && !/^https?:/i.test(path)) path = `/${path}`
    return { method: m[1].toUpperCase(), path }
  }
  return { path: cleaned, method: '' }
}

function parseApiInventoryLines(raw) {
  return String(raw || '')
    .split(/[,;\n\r]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** source_api：绑定后从接口清单下拉，仍可自定义输入 */
const apiPathOptions = computed(() => {
  const seen = new Set()
  const out = []
  const push = (raw, subHint = '') => {
    const parsed = parseApiInventoryEntry(raw)
    const value = parsed.path || String(raw || '').trim()
    if (!value || seen.has(value)) return
    seen.add(value)
    out.push({
      value,
      label: value,
      sub: [parsed.method, subHint].filter(Boolean).join(' · '),
      method: parsed.method,
    })
  }
  for (const t of tableOptions.value || []) {
    push(t.value, t.sub || '')
  }
  if (!out.length && boundSource.value) {
    const schema = boundSource.value.schema || boundSource.value.schemaSummary || ''
    for (const line of parseApiInventoryLines(schema)) push(line)
  }
  return out
})

function onApiPathChange(v) {
  const raw = String(v || '').trim()
  const fromOpt = apiPathOptions.value.find((o) => o.value === raw)
  if (fromOpt?.method) {
    setMany({ path: raw, method: fromOpt.method })
    return
  }
  const parsed = parseApiInventoryEntry(raw)
  if (parsed.method && parsed.path) {
    setMany({ path: parsed.path, method: parsed.method })
  } else {
    set('path', raw)
  }
}

const selectedTables = computed(() => {
  const one =
    props.conf?.table ||
    props.conf?.src ||
    (Array.isArray(props.conf?.tables) ? props.conf.tables.filter(Boolean)[0] : '') ||
    ''
  return one ? [one] : []
})

const selectedTable = computed(() => selectedTables.value[0] || '')

function onTableChange(v) {
  const table = String(v || '').trim()
  setMany({
    table,
    src: table,
    tables: table ? [table] : [],
  })
}

function tableBase(name) {
  const s = String(name || '').trim()
  if (!s) return ''
  const parts = s.split('.')
  return parts[parts.length - 1].toLowerCase()
}

function parseFieldList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  return String(v || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinFieldList(list) {
  return (list || []).filter(Boolean).join(',')
}

/** 源节点：当前已选表的字段（预览 schema 优先，否则演示字段） */
const sourceFieldOptions = computed(() => {
  const tables = selectedTables.value.length
    ? selectedTables.value
    : [props.conf?.src, props.conf?.table].filter(Boolean)
  if (!tables.length) return []

  const bases = new Set(tables.map(tableBase).filter(Boolean))
  const fromApi = []
  const seen = new Set()
  schemaColumns.value.forEach((c) => {
    const col = c.column
    if (!col) return
    const tb = tableBase(c.table)
    if (bases.size && tb && !bases.has(tb)) return
    // 无 table 名时（非 JDBC 占位）也纳入
    if (bases.size && c.table && !tb) return
    const key = col.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    fromApi.push({
      value: col,
      label: col,
      sub: c.type || '',
      pk: false,
    })
  })
  if (fromApi.length) return fromApi

  const fallback = []
  tables.forEach((t) => {
    fieldsForTableName(t, boundSource.value?.type || props.conf?.dbType || 'MySQL').forEach((f) => {
      const key = String(f.name || '').toLowerCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      fallback.push({
        value: f.name,
        label: f.name,
        sub: [f.type, f.cn].filter(Boolean).join(' · '),
        pk: !!f.pk,
      })
    })
  })
  return fallback
})

/** Sink / 变换：上游输出字段 */
const upstreamFieldOptions = computed(() =>
  (props.upstreamFields || [])
    .filter((f) => f?.name)
    .map((f) => ({
      value: f.name,
      label: f.name,
      sub: [f.type, f.cn].filter(Boolean).join(' · '),
      pk: !!f.pk,
    })),
)

const selectedPk = computed(() => parseFieldList(props.conf?.pk))

function onPkChange(list) {
  set('pk', joinFieldList(list || []))
}

const selectedDedupKeys = computed(() =>
  parseFieldList(props.conf?.dedupKeys || props.conf?.rules?.dedupKeys),
)

function onDedupKeysChange(list) {
  set('dedupKeys', [...(list || [])].filter(Boolean))
}

const selectedOrderBy = computed(() => parseFieldList(props.conf?.orderBy))

function onOrderByChange(list) {
  set('orderBy', joinFieldList(list || []))
}

/** 主键/字段选择：源表字段优先，否则上游 */
const pkFieldOptions = computed(() =>
  sourceFieldOptions.value.length ? sourceFieldOptions.value : upstreamFieldOptions.value,
)

const autoCreateMode = computed(() => props.conf?.autoCreate || 'off')
const showAutoCreateDdl = computed(
  () =>
    ['sink_iceberg', 'sink_ck', 'sink_rdb'].includes(props.type) &&
    autoCreateMode.value === 'if_not_exists',
)

const ddlPreviewFields = computed(() => {
  const from = props.conf?.schemaFrom || 'upstream'
  if (from === 'mapping') {
    const maps = props.conf?.fieldMaps || props.conf?.mapList || []
    const cols = maps
      .filter((m) => m.dst || m.std)
      .map((m) => ({ name: m.dst || m.std, type: m.dstType || m.type || 'STRING', cn: m.dstCn || '' }))
    if (cols.length) return cols
  }
  return props.upstreamFields || []
})

const createDdlPreview = computed(() => {
  if (!showAutoCreateDdl.value) return ''
  return buildCreateDdlPreview(props.type, props.conf || {}, ddlPreviewFields.value)
})

const autoCreateHint = computed(() => {
  const m = AUTO_CREATE_MODES.find((x) => x.value === autoCreateMode.value)
  return m?.hint || ''
})

/** 数据标准字段（mapping 目标列 / stdRef） */
const stdFieldOptions = computed(() =>
  (fieldList.value || [])
    .filter((f) => f?.name)
    .map((f) => ({
      value: f.name,
      label: f.name,
      sub: [f.type || f.dataType, f.unit, f.desc || f.description, f.domain || f.domainCode]
        .filter(Boolean)
        .join(' · '),
    })),
)

/** 标准码值集 */
const stdCodeOptions = computed(() =>
  (codeList.value || [])
    .filter((c) => c?.id || c?.codeSetId)
    .map((c) => ({
      value: c.id || c.codeSetId,
      label: c.id || c.codeSetId,
      sub: [c.name, c.field || c.fieldName, c.count != null ? `${c.count} 项` : '']
        .filter(Boolean)
        .join(' · '),
    })),
)

function onStdFieldPick(v) {
  const name = String(v || '').trim()
  const hit = (fieldList.value || []).find((f) => f.name === name)
  const patch = { stdRef: name }
  // 若该字段已绑定码值集，且尚未选手动码值，可提示性带出
  if (hit && !props.conf?.codeSetId) {
    const bound = (codeList.value || []).find(
      (c) => (c.field || c.fieldName) === name,
    )
    if (bound) patch.codeSetId = bound.id || bound.codeSetId
  }
  setMany(patch)
}

function onCodeSetPick(v) {
  const id = String(v || '').trim()
  const hit = (codeList.value || []).find((c) => (c.id || c.codeSetId) === id)
  const patch = { codeSetId: id }
  // 码值绑定字段可作为 stdRef 补齐
  if (hit?.field || hit?.fieldName) {
    if (!props.conf?.stdRef) patch.stdRef = hit.field || hit.fieldName
  }
  setMany(patch)
}
</script>

<template>
  <!-- ===== source CDC ===== -->
  <template v-if="type === 'source'">
    <div class="sec-title">连接信息</div>
    <label class="form-field">
      <span class="form-label">绑定已有数据源</span>
      <select class="select" :value="conf.dsId || ''" @change="onBindDs($event.target.value)">
        <option value="">— 暂不绑定 / 手填（仅开发） —</option>
        <option v-for="o in dsOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <div class="form-hint">生产推荐绑定：节点只存 dsId，库类型/主机/账号密码以数据源中心为准，发布时 Vault 注入</div>
    </label>

    <div v-if="dsBound" class="ds-bound-card">
      <div class="ds-bound-title">已绑定 · 连接信息只读</div>
      <div class="ds-bound-grid">
        <div><span class="k">数据源</span>{{ boundSource?.name || conf.dsId }}</div>
        <div><span class="k">类型</span>{{ typeLabel(boundSource?.type) || conf.dbType || '—' }}</div>
        <div><span class="k">Host</span>{{ boundSource?.host || boundSource?.endpointHost || '（运行时解析）' }}</div>
        <div><span class="k">端口</span>{{ boundSource?.port || boundSource?.endpointPort || '—' }}</div>
        <div><span class="k">库名</span>{{ boundSource?.database || boundSource?.databaseName || '—' }}</div>
        <div><span class="k">账号</span>{{ boundSource?.user || boundSource?.username || '（Vault）' }}</div>
      </div>
      <div class="form-hint">无需在此重复填写；若要改连接请到「数据源管理」</div>
    </div>

    <div v-else class="form-grid-2">
      <label class="form-field">
        <span class="form-label">数据库类型</span>
        <select class="select" :value="conf.dbType" @change="set('dbType', $event.target.value)">
          <option v-for="t in DB_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">Host</span>
        <input class="input" :value="conf.host" @input="set('host', $event.target.value)" />
      </label>
      <label class="form-field">
        <span class="form-label">端口</span>
        <input class="input" type="number" :value="conf.port" @input="set('port', Number($event.target.value))" />
      </label>
      <label class="form-field">
        <span class="form-label">数据库名</span>
        <input class="input" :value="conf.database" @input="set('database', $event.target.value)" />
      </label>
      <label class="form-field">
        <span class="form-label">用户名</span>
        <input class="input" :value="conf.username" @input="set('username', $event.target.value)" />
      </label>
      <label class="form-field">
        <span class="form-label">密码</span>
        <input class="input" type="password" :value="conf.password" @input="set('password', $event.target.value)" placeholder="开发态可留空；生产请绑定数据源" />
      </label>
    </div>
    <div class="form-field">
      <span class="form-label">抽取表（单表）</span>
      <SearchSelect
        :model-value="selectedTable"
        :options="tableOptions"
        sub-key="sub"
        allow-custom
        placeholder="下拉搜索表名，可自定义 schema.table"
        empty-text="暂无表清单，可直接输入表名"
        @update:model-value="onTableChange"
      />
      <div class="form-hint">一节点只抽一张表；多表请拆成多个 source 节点</div>
      <div v-if="!dsBound" class="form-hint">建议先绑定数据源以加载表清单；也可直接自定义表名</div>
      <div v-else-if="!tableOptions.length" class="form-hint">该数据源暂无同步表，可自定义输入</div>
      <div v-else-if="schemaLoading" class="form-hint">正在加载表字段…</div>
    </div>
    <div class="form-field">
      <span class="form-label">主键字段</span>
      <MultiSearchSelect
        :model-value="selectedPk"
        :options="pkFieldOptions"
        sub-key="sub"
        allow-custom
        placeholder="下拉搜索字段，支持复合主键"
        empty-text="暂无字段，可自定义输入"
        @update:model-value="onPkChange"
      />
    </div>
    <label class="form-field">
      <span class="form-label">抽取模式</span>
      <select class="select" :value="conf.mode || 'cdc'" @change="set('mode', $event.target.value)">
        <option value="cdc">CDC 增量</option>
        <option value="batch">Batch 全量</option>
        <option value="incremental">水位增量</option>
      </select>
    </label>
    <div class="form-hint">运行引擎：{{ resolvedEngineHint() }} · 本节点只负责抽取，写出请接下游 sink</div>
    <div v-if="conf.mode === 'incremental'" class="form-grid-2">
      <label class="form-field">
        <span class="form-label">水位列</span>
        <SearchSelect
          :model-value="conf.watermarkColumn || conf.updatedAtField || ''"
          :options="sourceFieldOptions"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索水位列或自定义"
          @update:model-value="(v) => set('watermarkColumn', v)"
        />
      </label>
      <label class="form-field">
        <span class="form-label">水位键 mark_key</span>
        <input class="input" :value="conf.markKey" @input="set('markKey', $event.target.value)" placeholder="source:table:col" />
      </label>
    </div>
    <div v-if="conf.mode === 'cdc'" class="form-grid-2">
      <label class="form-field">
        <span class="form-label">启动模式</span>
        <select class="select" :value="conf.startupMode" @change="set('startupMode', $event.target.value)">
          <option v-for="m in STARTUP_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">时区</span>
        <input class="input" :value="conf.serverTimeZone" @input="set('serverTimeZone', $event.target.value)" />
      </label>
    </div>

    <details class="adv-fold">
      <summary>高级参数</summary>
      <div class="form-grid-2" style="margin-top: 8px">
        <label class="form-field">
          <span class="form-label">Slot / 日志名</span>
          <input class="input" :value="conf.slotName" @input="set('slotName', $event.target.value)" />
        </label>
        <label class="form-field">
          <span class="form-label">快照批量行数</span>
          <input class="input" type="number" :value="conf.snapshotPollSize" @input="set('snapshotPollSize', Number($event.target.value))" />
        </label>
        <label class="form-field">
          <span class="form-label">fetchSize</span>
          <input class="input" type="number" :value="conf.fetchSize" @input="set('fetchSize', Number($event.target.value))" />
        </label>
        <label class="form-field">
          <span class="form-label">连接超时(秒)</span>
          <input class="input" type="number" :value="conf.connectTimeout" @input="set('connectTimeout', Number($event.target.value))" />
        </label>
        <label class="form-field">
          <span class="form-label">失败重试</span>
          <input class="input" type="number" :value="conf.retry" @input="set('retry', Number($event.target.value))" />
        </label>
        <label class="form-field">
          <span class="form-label">DDL 容忍</span>
          <select class="select" :value="conf.ddlTolerance" @change="set('ddlTolerance', $event.target.value)">
            <option>error</option>
            <option>warn</option>
            <option>ignore</option>
          </select>
        </label>
        <label class="form-field">
          <span class="form-label">分片数</span>
          <input class="input" type="number" :value="conf.shardCount" @input="set('shardCount', Number($event.target.value))" />
        </label>
      </div>
      <div class="chk-group" style="margin-top: 8px">
        <label class="chk-item">
          <input type="checkbox" :checked="!!conf.includeSchemaChange" @change="set('includeSchemaChange', $event.target.checked)" />
          采集 DDL Schema 变更
        </label>
        <label class="chk-item">
          <input type="checkbox" :checked="!!conf.sharding" @change="set('sharding', $event.target.checked)" />
          分库分表合并
        </label>
      </div>
    </details>
  </template>

  <!-- ===== source_api ===== -->
  <template v-else-if="type === 'source_api'">
    <div class="sec-title">请求信息</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">Method</span>
        <select class="select" :value="conf.method" @change="set('method', $event.target.value)">
          <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">Content-Type</span>
        <select class="select" :value="conf.contentType" @change="set('contentType', $event.target.value)">
          <option>application/json</option>
          <option>application/x-www-form-urlencoded</option>
          <option>multipart/form-data</option>
          <option>text/plain</option>
        </select>
      </label>
    </div>
    <label class="form-field">
      <span class="form-label">绑定 API 数据源</span>
      <select class="select" :value="conf.dsId || ''" @change="onBindDs($event.target.value)">
        <option value="">— 暂不绑定 / 手填 —</option>
        <option v-for="o in (apiDsOptions.length ? apiDsOptions : dsOptions)" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <div class="form-hint">绑定后鉴权与 Base 由数据源中心维护；节点只配 path / 分页 / 字段抽取</div>
    </label>
    <div v-if="dsBound" class="ds-bound-card">
      <div class="ds-bound-title">已绑定 · {{ boundSource?.name || conf.dsId }}</div>
      <div class="form-hint">Base URL / Token 运行时解析，无需在节点填写密码</div>
    </div>
    <label v-if="!dsBound" class="form-field">
      <span class="form-label">Base URL</span>
      <input class="input" :value="conf.baseUrl" @input="set('baseUrl', $event.target.value)" />
    </label>
    <div class="form-field">
      <span class="form-label">接口 Path</span>
      <SearchSelect
        :model-value="conf.path || ''"
        :options="apiPathOptions"
        sub-key="sub"
        allow-custom
        placeholder="下拉选择或自定义 Path，如 /orders"
        empty-text="暂无接口清单，可直接输入 Path"
        @update:model-value="onApiPathChange"
      />
      <div v-if="dsBound && !apiPathOptions.length" class="form-hint">该数据源暂无接口清单，可自定义输入</div>
      <div v-else-if="dsBound" class="form-hint">来自数据源「接口清单」；也可自定义</div>
      <div v-else class="form-hint">可手填 Path；绑定 API 数据源后可从清单选择</div>
    </div>
    <label class="form-field">
      <span class="form-label">Body 模板</span>
      <textarea class="textarea mono" rows="3" :value="conf.bodyTemplate" @input="set('bodyTemplate', $event.target.value)" />
    </label>

    <div v-if="!dsBound" class="sec-title">鉴权（仅未绑定）</div>
    <template v-if="!dsBound">
      <label class="form-field">
        <span class="form-label">类型</span>
        <select class="select" :value="conf.authType" @change="set('authType', $event.target.value)">
          <option value="none">无</option>
          <option value="basic">Basic Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="apikey">API Key</option>
          <option value="oauth2">OAuth2 Client</option>
        </select>
      </label>
      <div v-if="conf.authType === 'basic'" class="form-grid-2">
        <label class="form-field"><span class="form-label">账号</span><input class="input" :value="conf.authUser" @input="set('authUser', $event.target.value)" /></label>
        <label class="form-field"><span class="form-label">密码</span><input class="input" type="password" :value="conf.authPass" @input="set('authPass', $event.target.value)" /></label>
      </div>
      <label v-if="conf.authType === 'bearer'" class="form-field">
        <span class="form-label">Token</span>
        <input class="input" type="password" :value="conf.authToken" @input="set('authToken', $event.target.value)" />
      </label>
      <div v-if="conf.authType === 'apikey'" class="form-grid-2">
        <label class="form-field"><span class="form-label">Header 名</span><input class="input" :value="conf.apiKeyHeader" @input="set('apiKeyHeader', $event.target.value)" /></label>
        <label class="form-field"><span class="form-label">Key</span><input class="input" :value="conf.apiKey" @input="set('apiKey', $event.target.value)" /></label>
      </div>
    </template>

    <div class="sec-title">分页 & 解析</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">分页方式</span>
        <select class="select" :value="conf.pagination" @change="set('pagination', $event.target.value)">
          <option value="page">page 页码</option>
          <option value="offset">offset 偏移</option>
          <option value="cursor">cursor（第三方原名）</option>
          <option value="none">不分页</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">每页数量</span><input class="input" type="number" :value="conf.pageSize" @input="set('pageSize', Number($event.target.value))" /></label>
      <label class="form-field">
        <span class="form-label">JSONPath</span>
        <input
          class="input"
          :value="conf.jsonPath"
          placeholder="$.data[*]"
          @input="set('jsonPath', $event.target.value)"
        />
        <div class="form-hint">
          从响应 JSON 中定位「记录数组」。常用：
          <code>$.data[*]</code>（列表在 data）、
          <code>$.data.list[*]</code>、
          <code>$.result.items[*]</code>、
          <code>$[*]</code>（根即为数组）。
          主键/增量字段填数组元素内的相对字段名（如 id、updated_at），勿再写完整路径。
        </div>
      </label>
      <label class="form-field">
        <span class="form-label">主键字段</span>
        <SearchSelect
          :model-value="conf.idField || ''"
          :options="upstreamFieldOptions"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索或自定义 JSON 字段"
          @update:model-value="(v) => set('idField', v)"
        />
      </label>
      <label class="form-field">
        <span class="form-label">增量字段</span>
        <SearchSelect
          :model-value="conf.updatedAtField || ''"
          :options="upstreamFieldOptions"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索或自定义 JSON 字段"
          @update:model-value="(v) => set('updatedAtField', v)"
        />
      </label>
    </div>
    <details class="adv-fold">
      <summary>高级：限流 / 重试</summary>
      <div class="form-grid-2" style="margin-top: 8px">
        <label class="form-field"><span class="form-label">限频 QPS</span><input class="input" type="number" :value="conf.rateLimitQps" @input="set('rateLimitQps', Number($event.target.value))" /></label>
        <label class="form-field"><span class="form-label">超时(秒)</span><input class="input" type="number" :value="conf.timeout" @input="set('timeout', Number($event.target.value))" /></label>
        <label class="form-field"><span class="form-label">重试次数</span><input class="input" type="number" :value="conf.retry" @input="set('retry', Number($event.target.value))" /></label>
        <label class="form-field">
          <span class="form-label">退避策略</span>
          <select class="select" :value="conf.backoff" @change="set('backoff', $event.target.value)">
            <option>fixed</option><option>exponential</option><option>jitter</option>
          </select>
        </label>
      </div>
    </details>
  </template>

  <!-- ===== source_file ===== -->
  <template v-else-if="type === 'source_file'">
    <div class="sec-title">存储位置</div>
    <label class="form-field">
      <span class="form-label">绑定对象存储 / 文件数据源</span>
      <select class="select" :value="conf.dsId || ''" @change="onBindDs($event.target.value)">
        <option value="">— 暂不绑定 / 手填 —</option>
        <option v-for="o in dsOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <div v-if="dsBound" class="ds-bound-card">
      <div class="ds-bound-title">已绑定 · {{ boundSource?.name || conf.dsId }}</div>
      <div class="form-hint">Endpoint / 密钥运行时解析；节点只配路径与格式</div>
    </div>
    <div v-else class="form-grid-2">
      <label class="form-field">
        <span class="form-label">存储类型</span>
        <select class="select" :value="conf.storageType" @change="set('storageType', $event.target.value)">
          <option>S3</option><option>HDFS</option><option>FTP</option><option>SFTP</option><option>LOCAL</option><option>OSS</option><option>COS</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">Endpoint</span><input class="input" :value="conf.endpoint" @input="set('endpoint', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Bucket</span><input class="input" :value="conf.bucket" @input="set('bucket', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Access Key</span><input class="input" :value="conf.accessKey" @input="set('accessKey', $event.target.value)" placeholder="开发态；生产请绑定 dsId" /></label>
    </div>
    <label class="form-field"><span class="form-label">基础路径</span><input class="input" :value="conf.basePath" @input="set('basePath', $event.target.value)" placeholder="/data/orders/2026/" /></label>
    <label class="form-field">
      <span class="form-label">文件匹配 (Glob)</span>
      <input
        class="input"
        :value="conf.filePattern"
        placeholder="*.csv.gz"
        @input="set('filePattern', $event.target.value)"
      />
      <div class="form-hint">
        相对「基础路径」的 Glob，选出本次要读的文件。常用：
        <code>*.csv</code>、<code>*.csv.gz</code>、<code>*.parquet</code>、
        <code>orders_*.csv</code>（前缀）、
        <code>**/*.json</code>（含子目录）、
        <code>{a,b}*.txt</code>（多前缀）。
        不要写盘符或完整 URL；路径放「基础路径」，此处只写文件名/相对模式。
      </div>
    </label>

    <div class="sec-title">文件格式</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">格式</span>
        <select class="select" :value="conf.format" @change="set('format', $event.target.value)">
          <option>csv</option><option>json</option><option>parquet</option><option>orc</option><option>xlsx</option><option>xml</option><option>txt</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">压缩</span>
        <select class="select" :value="conf.compression" @change="set('compression', $event.target.value)">
          <option>none</option><option>gzip</option><option>snappy</option><option>zip</option><option>zstd</option><option>lz4</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">编码</span>
        <select class="select" :value="conf.encoding" @change="set('encoding', $event.target.value)">
          <option>UTF-8</option><option>GBK</option><option>ISO-8859-1</option><option>UTF-16</option>
        </select>
      </label>
      <label v-if="conf.format === 'csv' || conf.format === 'txt'" class="form-field">
        <span class="form-label">分隔符</span>
        <input class="input" :value="conf.delimiter" @input="set('delimiter', $event.target.value)" />
      </label>
      <label class="form-field"><span class="form-label">跳过前 N 行</span><input class="input" type="number" :value="conf.skipRows" @input="set('skipRows', Number($event.target.value))" /></label>
    </div>
    <div class="chk-group">
      <label class="chk-item"><input type="checkbox" :checked="!!conf.headerLine" @change="set('headerLine', $event.target.checked)" /> 首行为表头</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.schemaInfer" @change="set('schemaInfer', $event.target.checked)" /> 自动推断 Schema</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.failOnCorrupt" @change="set('failOnCorrupt', $event.target.checked)" /> 损坏文件直接失败</label>
    </div>
    <div class="form-hint">本节点只读文件；落地/覆盖策略请在下游 sink_object / sink_iceberg 配置</div>
  </template>

  <!-- ===== clean ===== -->
  <template v-else-if="type === 'clean'">
    <div class="sec-title">预设与全局策略</div>
    <label class="form-field">
      <span class="form-label">清洗等级</span>
      <select class="select" :value="conf.preset" @change="set('preset', $event.target.value)">
        <option value="STANDARD">标准（按字段规则执行）</option>
        <option value="STRICT">严格（额外格式校验）</option>
        <option value="LOOSE">宽松（仅空白/大小写）</option>
        <option value="CUSTOM">自定义</option>
      </select>
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">跨字段去重</span>
        <select class="select" :value="String(!!conf.dedup)" @change="set('dedup', $event.target.value === 'true')">
          <option value="true">启用</option>
          <option value="false">关闭</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">去重保留</span>
        <select class="select" :value="conf.dedupKeep || 'latest'" @change="set('dedupKeep', $event.target.value)">
          <option value="latest">保留最新</option>
          <option value="earliest">保留最早</option>
        </select>
      </label>
    </div>
    <div v-if="conf.dedup" class="form-field">
      <span class="form-label">去重键</span>
      <MultiSearchSelect
        :model-value="selectedDedupKeys"
        :options="upstreamFieldOptions"
        sub-key="sub"
        allow-custom
        placeholder="下拉搜索上游字段，可自定义"
        empty-text="暂无上游字段：请先连线源节点，或自定义输入"
        @update:model-value="onDedupKeysChange"
      />
    </div>
    <div class="form-hint">引擎继承任务「主引擎」，清洗节点无需单独选引擎。</div>

    <div class="sec-title">字段级规则</div>
    <CleanFieldRules
      :model-value="conf.fieldRules || []"
      :fields="upstreamFields"
      @update:model-value="set('fieldRules', $event)"
    />
  </template>

  <!-- ===== transform ===== -->
  <template v-else-if="type === 'transform'">
    <div class="sec-title">SQL</div>
    <div v-if="upstreamFields.length" class="form-hint" style="margin-bottom: 6px">
      上游字段：
      <code v-for="f in upstreamFields.slice(0, 12)" :key="f.name" style="margin-right: 4px">{{ f.name }}</code>
    </div>
    <SqlEditor :model-value="conf.sql || ''" :rows="10" @update:model-value="set('sql', $event)" />
    <div class="sec-title">执行策略</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">引擎</span>
        <select class="select" :value="transformEngine" @change="set('engine', $event.target.value)">
          <option value="spark">spark</option>
          <option value="flink">flink</option>
          <option value="ds_sql">ds_sql</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">负载提示 hint</span>
        <select class="select" :value="conf.hint || ''" @change="set('hint', $event.target.value)">
          <option value="">无（跟随默认路由）</option>
          <option value="heavy_batch">heavy_batch → Spark</option>
          <option value="heterogeneous_sync">heterogeneous_sync → DataX</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">分区字段</span>
        <SearchSelect
          :model-value="conf.partitionBy || ''"
          :options="upstreamFieldOptions"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索字段或自定义"
          @update:model-value="(v) => set('partitionBy', v)"
        />
      </label>
      <label class="form-field"><span class="form-label">超时(秒)</span><input class="input" type="number" :value="conf.timeout" @input="set('timeout', Number($event.target.value))" /></label>
    </div>
    <details class="adv-fold">
      <summary>高级：方言 / 重试 / 资源{{ showSparkResources ? '（Spark）' : '' }}</summary>
      <div class="form-grid-2" style="margin-top: 8px">
        <label class="form-field">
          <span class="form-label">方言</span>
          <select class="select" :value="conf.dialect" @change="set('dialect', $event.target.value)">
            <option value="ansi">ANSI</option><option value="hive">Hive</option><option value="flink">Flink</option><option value="spark">Spark</option>
          </select>
        </label>
        <label class="form-field"><span class="form-label">失败重试</span><input class="input" type="number" :value="conf.retry" @input="set('retry', Number($event.target.value))" /></label>
        <label class="form-field">
          <span class="form-label">engine_override</span>
          <input class="input" :value="conf.engine_override" @input="set('engine_override', $event.target.value)" placeholder="强制引擎时填写" />
        </label>
        <label class="form-field">
          <span class="form-label">override_reason</span>
          <input class="input" :value="conf.override_reason" @input="set('override_reason', $event.target.value)" placeholder="强制覆盖须说明原因" />
        </label>
      </div>
      <div v-if="showSparkResources" class="form-grid-2" style="margin-top: 8px">
        <label class="form-field"><span class="form-label">队列</span><input class="input" :value="conf.resources?.queue" @input="setNested('resources', 'queue', $event.target.value)" /></label>
        <label class="form-field"><span class="form-label">Driver Mem</span><input class="input" :value="conf.resources?.driverMem" @input="setNested('resources', 'driverMem', $event.target.value)" /></label>
        <label class="form-field"><span class="form-label">Executor 数</span><input class="input" type="number" :value="conf.resources?.executorNum" @input="setNested('resources', 'executorNum', Number($event.target.value))" /></label>
        <label class="form-field"><span class="form-label">Executor Mem</span><input class="input" :value="conf.resources?.executorMem" @input="setNested('resources', 'executorMem', $event.target.value)" /></label>
        <label class="form-field">
          <span class="form-label">Cache</span>
          <select class="select" :value="conf.cacheLevel" @change="set('cacheLevel', $event.target.value)">
            <option>NONE</option><option>MEMORY</option><option>DISK</option><option>MEMORY_AND_DISK</option>
          </select>
        </label>
      </div>
    </details>
  </template>

  <!-- ===== mapping ===== -->
  <template v-else-if="type === 'mapping'">
    <div class="sec-title">映射策略与标准引用</div>
    <div class="form-hint">
      从数据标准选择字段/码值；下方「字段映射」目标列默认可选标准字段。发布后可回写 gov_std_mapping。
    </div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">默认策略</span>
        <select class="select" :value="conf.strategy" @change="set('strategy', $event.target.value)">
          <option>同名映射</option><option>显式映射</option><option>码值 CASE</option><option>表达式</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">标准字段 stdRef</span>
        <SearchSelect
          :model-value="conf.stdRef || ''"
          :options="stdFieldOptions"
          sub-key="sub"
          allow-custom
          :placeholder="stdLoaded ? '下拉搜索标准字段' : '加载标准字段中…'"
          empty-text="暂无标准字段，可自定义或先到「数据标准」登记"
          @update:model-value="onStdFieldPick"
        />
      </label>
      <label class="form-field">
        <span class="form-label">标准码值 codeSetId</span>
        <SearchSelect
          :model-value="conf.codeSetId || ''"
          :options="stdCodeOptions"
          sub-key="sub"
          allow-custom
          :placeholder="stdLoaded ? '下拉搜索码值集（如 STD-C0021）' : '加载标准码值中…'"
          empty-text="暂无码值集，可自定义"
          @update:model-value="onCodeSetPick"
        />
      </label>
    </div>
    <div v-if="conf.strategy === '码值 CASE' && !conf.codeSetId" class="form-hint">
      策略为「码值 CASE」时建议选择标准码值集，用于生成 CASE 映射
    </div>
    <details class="adv-fold">
      <summary>高级：重命名 / 类型转换</summary>
      <div class="form-grid-2" style="margin-top: 8px">
        <label class="form-field">
          <span class="form-label">重命名</span>
          <select class="select" :value="conf.autoRename" @change="set('autoRename', $event.target.value)">
            <option value="none">无</option>
            <option value="under2camel">下划线→驼峰</option>
            <option value="camel2under">驼峰→下划线</option>
          </select>
        </label>
        <label class="form-field"><span class="form-label">前缀</span><input class="input" :value="conf.addPrefix" @input="set('addPrefix', $event.target.value)" /></label>
        <label class="form-field"><span class="form-label">后缀</span><input class="input" :value="conf.addSuffix" @input="set('addSuffix', $event.target.value)" /></label>
      </div>
      <label class="chk-item" style="margin: 8px 0">
        <input type="checkbox" :checked="!!conf.castStringToVarchar" @change="set('castStringToVarchar', $event.target.checked)" />
        String → VARCHAR 强制转换
      </label>
    </details>
  </template>

  <!-- ===== quality ===== -->
  <template v-else-if="type === 'quality'">
    <div class="sec-title">门禁策略</div>
    <div class="chk-group">
      <label class="chk-item"><input type="checkbox" :checked="conf.blockOnFail !== false" @change="set('blockOnFail', $event.target.checked)" /> 失败阻断下游（推荐）</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.alertOwner" @change="set('alertOwner', $event.target.checked)" /> 通知负责人</label>
    </div>
    <div class="form-grid-2" style="margin-top: 8px">
      <label class="form-field"><span class="form-label">失败阈值</span><input class="input" type="number" step="0.01" :value="conf.threshold" @input="set('threshold', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">采样率</span><input class="input" type="number" step="0.01" :value="conf.sampleRatio" @input="set('sampleRatio', Number($event.target.value))" /></label>
    </div>

    <div class="sec-title">绑定质量规则（门户 SoT）</div>
    <div class="form-hint">优先勾选数据质量模块已发布规则；本地 JSON 仅作草稿兜底</div>
    <div v-if="dqRuleOptions.length" class="rule-pick">
      <label v-for="r in dqRuleOptions" :key="r.id" class="chk-item">
        <input type="checkbox" :checked="ruleIdSet.has(r.id)" @change="toggleRuleId(r.id)" />
        {{ r.label }}
      </label>
    </div>
    <div v-else class="form-hint">暂无门户规则，可稍后在数据质量模块创建，或展开下方草稿 JSON</div>

    <details class="adv-fold">
      <summary>高级：报告 / 草稿规则 JSON</summary>
      <div class="form-grid-2" style="margin-top: 8px">
        <label class="form-field"><span class="form-label">最大检测行</span><input class="input" type="number" :value="conf.maxRows" @input="set('maxRows', Number($event.target.value))" /></label>
        <label class="form-field">
          <span class="form-label">报告表</span>
          <SearchSelect
            :model-value="conf.reportTable || ''"
            :options="lakeTableOptions"
            sub-key="sub"
            allow-custom
            placeholder="下拉搜索资产表或自定义"
            @update:model-value="(v) => set('reportTable', v)"
          />
        </label>
      </div>
      <label class="chk-item" style="margin: 8px 0">
        <input type="checkbox" :checked="!!conf.outputReport" @change="set('outputReport', $event.target.checked)" /> 输出检测报告
      </label>
      <label class="form-field">
        <span class="form-label">草稿规则 JSON（无 ruleIds 时使用）</span>
        <textarea
          class="textarea mono"
          rows="5"
          :value="typeof conf.rules === 'string' ? conf.rules : JSON.stringify(conf.rules || [], null, 2)"
          @input="set('rules', $event.target.value)"
        />
      </label>
    </details>
  </template>

  <!-- ===== parallel ===== -->
  <template v-else-if="type === 'parallel'">
    <div class="sec-title">编排并行（DS 扇出）</div>
    <div class="form-hint">默认表示下游任务并行调度，不是行级 hash 分片；行级分片请用 Spark/Flink 作业内并行度</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">并行分支数</span><input class="input" type="number" :value="conf.parallelism" @input="set('parallelism', Number($event.target.value))" /></label>
      <label class="form-field">
        <span class="form-label">模式</span>
        <select class="select" :value="conf.mode || 'dag_fanout'" @change="set('mode', $event.target.value)">
          <option value="dag_fanout">dag_fanout（调度并行）</option>
          <option value="row_shard">row_shard（行分片，需引擎支持）</option>
        </select>
      </label>
    </div>
    <label class="chk-item"><input type="checkbox" :checked="!!conf.failFast" @change="set('failFast', $event.target.checked)" /> Fail Fast（一支失败即停）</label>
    <label class="form-field"><span class="form-label">分支标签（逗号）</span>
      <input class="input" :value="(conf.branchLabels || []).join(',')" @input="set('branchLabels', $event.target.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean))" />
    </label>
    <details v-if="(conf.mode || 'dag_fanout') === 'row_shard'" class="adv-fold">
      <summary>行分片参数</summary>
      <div class="form-grid-2" style="margin-top: 8px">
        <label class="form-field">
          <span class="form-label">策略</span>
          <select class="select" :value="conf.strategy" @change="set('strategy', $event.target.value)">
            <option value="hash">hash</option><option value="round_robin">round_robin</option><option value="key">key</option>
          </select>
        </label>
        <label class="form-field">
          <span class="form-label">分片键</span>
          <SearchSelect
            :model-value="conf.shardKey || ''"
            :options="upstreamFieldOptions"
            sub-key="sub"
            allow-custom
            placeholder="下拉搜索字段或自定义"
            @update:model-value="(v) => set('shardKey', v)"
          />
        </label>
      </div>
    </details>
  </template>

  <!-- ===== condition ===== -->
  <template v-else-if="type === 'condition'">
    <div class="sec-title">求值参数</div>
    <label class="form-field">
      <span class="form-label">总条件说明（可选）</span>
      <input class="input" :value="conf.cond" @input="set('cond', $event.target.value)" placeholder="如：按金额分档路由" />
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">NULL 处理</span>
        <select class="select" :value="conf.nullHandling" @change="set('nullHandling', $event.target.value)">
          <option value="as_false">视为 FALSE</option>
          <option value="as_true">视为 TRUE</option>
          <option value="exception">抛异常</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">默认分支</span>
        <select class="select" :value="conf.defaultBranch" @change="set('defaultBranch', $event.target.value)">
          <option
            v-for="(b, i) in (conf.branches || [])"
            :key="'br' + i"
            :value="'branch' + (i + 1)"
          >{{ b.label || ('分支' + (i + 1)) }}</option>
          <option value="fail">阻塞并告警</option>
          <option value="pass">跳过该节点</option>
        </select>
      </label>
    </div>
    <label class="chk-item" style="margin: 8px 0">
      <input type="checkbox" :checked="conf.evalOncePerRow !== false" @change="set('evalOncePerRow', $event.target.checked)" />
      每行按顺序匹配首个命中分支
    </label>

    <div class="sec-title">分支定义</div>
    <ConditionBranchesEditor
      :model-value="Array.isArray(conf.branches) ? conf.branches : []"
      :fields="upstreamFields"
      @update:model-value="set('branches', $event)"
    />
  </template>

  <!-- ===== union ===== -->
  <template v-else-if="type === 'union'">
    <div class="sec-title">合并 / UNION</div>
    <div class="form-hint">输入路数由画布入边决定，无需手填</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">策略</span>
        <select class="select" :value="conf.strategy" @change="set('strategy', $event.target.value)">
          <option>UNION ALL</option><option>UNION DISTINCT</option><option>INTERSECT</option><option>EXCEPT</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">缺列填充</span>
        <select class="select" :value="conf.missingColumnFill" @change="set('missingColumnFill', $event.target.value)">
          <option value="null">null</option><option value="default">default</option><option value="drop_row">drop_row</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">类型冲突</span>
        <select class="select" :value="conf.typeConflictPolicy" @change="set('typeConflictPolicy', $event.target.value)">
          <option value="wider_cast">wider_cast</option><option value="error">error</option><option value="drop_row">drop_row</option>
        </select>
      </label>
    </div>
    <div class="chk-group">
      <label class="chk-item"><input type="checkbox" :checked="!!conf.autoAlignColumns" @change="set('autoAlignColumns', $event.target.checked)" /> 自动对齐列</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.dedupAfter" @change="set('dedupAfter', $event.target.checked)" /> 合并后去重</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.allowEmptyBranch" @change="set('allowEmptyBranch', $event.target.checked)" /> 允许空分支</label>
    </div>
    <div v-if="conf.dedupAfter" class="form-field">
      <span class="form-label">去重键</span>
      <MultiSearchSelect
        :model-value="selectedDedupKeys"
        :options="upstreamFieldOptions"
        sub-key="sub"
        allow-custom
        placeholder="下拉搜索上游字段，可自定义"
        @update:model-value="onDedupKeysChange"
      />
    </div>
  </template>

  <!-- ===== sink_iceberg ===== -->
  <template v-else-if="type === 'sink_iceberg'">
    <div class="sec-title">湖表目标</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">Catalog</span>
        <input
          class="input"
          :value="conf.catalog"
          placeholder="iceberg"
          @input="onIcebergCatalogInput($event.target.value)"
        />
        <div v-if="icebergCatalogHint" class="form-hint warn">{{ icebergCatalogHint }}</div>
      </label>
      <label class="form-field"><span class="form-label">Database</span><input class="input" :value="conf.database" placeholder="ods" @input="set('database', $event.target.value)" /></label>
    </div>
    <label class="form-field">
      <span class="form-label">表</span>
      <SearchSelect
        :model-value="conf.table || ''"
        :options="lakeTableOptions"
        sub-key="sub"
        allow-custom
        placeholder="下拉搜索资产表或自定义"
        @update:model-value="(v) => set('table', v)"
      />
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">分区</span>
        <SearchSelect
          :model-value="conf.partition || ''"
          :options="upstreamFieldOptions"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索字段或自定义，如 dt"
          @update:model-value="(v) => set('partition', v)"
        />
      </label>
      <label class="form-field">
        <span class="form-label">分区变换</span>
        <select class="select" :value="conf.partitionTransform" @change="set('partitionTransform', $event.target.value)">
          <option>identity</option><option>year</option><option>month</option><option>day</option><option>hour</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">写入模式</span>
        <select class="select" :value="conf.writeMode" @change="set('writeMode', $event.target.value)">
          <option>append</option><option>overwrite</option><option>upsert</option><option>cdc</option>
        </select>
      </label>
      <div class="form-field">
        <span class="form-label">主键</span>
        <MultiSearchSelect
          :model-value="selectedPk"
          :options="upstreamFieldOptions"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索上游字段，支持复合主键"
          @update:model-value="onPkChange"
        />
      </div>
      <label class="form-field">
        <span class="form-label">压缩</span>
        <select class="select" :value="conf.compression" @change="set('compression', $event.target.value)">
          <option>zstd</option><option>snappy</option><option>gzip</option><option>none</option>
        </select>
      </label>
    </div>

    <div class="sec-title">受控自动建表</div>
    <label class="form-field">
      <span class="form-label">作业写账号 saRole</span>
      <input class="input" :value="conf.saRole || ''" @input="set('saRole', $event.target.value)" placeholder="job.trade.dwd_writer" />
      <div class="form-hint">须配置作业 SA（附录 B：job.*），禁止用人权限账号写湖</div>
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">autoCreate</span>
        <select class="select" :value="conf.autoCreate || 'off'" @change="set('autoCreate', $event.target.value)">
          <option v-for="m in AUTO_CREATE_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">Schema 来源</span>
        <select
          class="select"
          :value="conf.schemaFrom || 'upstream'"
          :disabled="(conf.autoCreate || 'off') === 'off'"
          @change="set('schemaFrom', $event.target.value)"
        >
          <option v-for="o in SCHEMA_FROM_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
    </div>
    <label class="chk-item" style="margin: 6px 0">
      <input
        type="checkbox"
        :checked="conf.registerAfterCreate !== false"
        :disabled="(conf.autoCreate || 'off') !== 'if_not_exists'"
        @change="set('registerAfterCreate', $event.target.checked)"
      />
      建表成功后登记 Grav / 资产（推荐）
    </label>
    <div class="form-hint">{{ autoCreateHint }}</div>
    <label v-if="showAutoCreateDdl" class="form-field">
      <span class="form-label">DDL 预览（只读）</span>
      <textarea class="textarea mono" rows="8" readonly :value="createDdlPreview" />
    </label>

    <details class="adv-fold">
      <summary>高级：Warehouse / 文件大小 / 表维护（建议独立生命周期作业）</summary>
      <div class="form-grid-2" style="margin-top: 8px">
        <label class="form-field"><span class="form-label">Warehouse</span><input class="input" :value="conf.warehouse" placeholder="s3a://warehouse/" @input="set('warehouse', $event.target.value)" /></label>
        <label class="form-field"><span class="form-label">目标文件大小(MB)</span><input class="input" type="number" :value="conf.fileSizeMb" @input="set('fileSizeMb', Number($event.target.value))" /></label>
      </div>
      <div class="chk-group" style="margin-top: 8px">
        <label class="chk-item"><input type="checkbox" :checked="!!conf.mergeOnRead" @change="set('mergeOnRead', $event.target.checked)" /> Merge on Read</label>
        <label class="chk-item"><input type="checkbox" :checked="!!conf.enableExpire" @change="set('enableExpire', $event.target.checked)" /> Expire Snapshots</label>
        <label class="chk-item"><input type="checkbox" :checked="!!conf.enableCompact" @change="set('enableCompact', $event.target.checked)" /> Compact</label>
        <label class="chk-item"><input type="checkbox" :checked="!!conf.enableVacuum" @change="set('enableVacuum', $event.target.checked)" /> Vacuum</label>
      </div>
    </details>
  </template>

  <!-- ===== sink_ck ===== -->
  <template v-else-if="type === 'sink_ck'">
    <div class="sec-title">ClickHouse 写出</div>
    <div class="form-hint">人对账走统一查询；此处仅作业服务账号写入。表已存在时以目标表为准</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">Database</span><input class="input" :value="conf.database" @input="set('database', $event.target.value)" /></label>
      <label class="form-field">
        <span class="form-label">表</span>
        <SearchSelect
          :model-value="conf.table || ''"
          :options="lakeTableOptions"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索或自定义表名"
          @update:model-value="(v) => set('table', v)"
        />
      </label>
      <label class="form-field"><span class="form-label">批次大小</span><input class="input" type="number" :value="conf.batchSize" @input="set('batchSize', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">Flush(ms)</span><input class="input" type="number" :value="conf.flushIntervalMs" @input="set('flushIntervalMs', Number($event.target.value))" /></label>
    </div>
    <div class="sec-title">受控自动建表</div>
    <label class="form-field">
      <span class="form-label">作业写账号 saRole</span>
      <input class="input" :value="conf.saRole || ''" @input="set('saRole', $event.target.value)" placeholder="job.trade.ads_ck_writer" />
      <div class="form-hint">须配置作业 SA（附录 B：job.*）</div>
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">autoCreate</span>
        <select class="select" :value="conf.autoCreate || 'off'" @change="set('autoCreate', $event.target.value)">
          <option v-for="m in AUTO_CREATE_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">Schema 来源</span>
        <select
          class="select"
          :value="conf.schemaFrom || 'upstream'"
          :disabled="(conf.autoCreate || 'off') === 'off'"
          @change="set('schemaFrom', $event.target.value)"
        >
          <option v-for="o in SCHEMA_FROM_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
    </div>
    <label class="chk-item" style="margin: 6px 0">
      <input
        type="checkbox"
        :checked="conf.registerAfterCreate !== false"
        :disabled="(conf.autoCreate || 'off') !== 'if_not_exists'"
        @change="set('registerAfterCreate', $event.target.checked)"
      />
      建表成功后登记资产目录（可选）
    </label>
    <div class="form-hint">{{ autoCreateHint }}</div>
    <label v-if="showAutoCreateDdl" class="form-field">
      <span class="form-label">DDL 预览（只读）</span>
      <textarea class="textarea mono" rows="8" readonly :value="createDdlPreview" />
    </label>

    <details class="adv-fold">
      <summary>高级：建表属性（ORDER BY / 分区 / TTL）</summary>
      <div class="form-grid-2" style="margin-top: 8px">
        <label class="form-field"><span class="form-label">Cluster</span><input class="input" :value="conf.cluster" @input="set('cluster', $event.target.value)" /></label>
        <label class="form-field"><span class="form-label">表引擎</span><input class="input" :value="conf.tableEngine || conf.engine" @input="set('tableEngine', $event.target.value)" placeholder="ReplacingMergeTree" /></label>
        <label class="form-field">
          <span class="form-label">版本列</span>
          <SearchSelect
            :model-value="conf.engineVerCol || ''"
            :options="upstreamFieldOptions"
            sub-key="sub"
            allow-custom
            placeholder="下拉搜索字段或自定义"
            @update:model-value="(v) => set('engineVerCol', v)"
          />
        </label>
        <div class="form-field">
          <span class="form-label">ORDER BY</span>
          <MultiSearchSelect
            :model-value="selectedOrderBy"
            :options="upstreamFieldOptions"
            sub-key="sub"
            allow-custom
            placeholder="下拉搜索字段，可多选"
            @update:model-value="onOrderByChange"
          />
        </div>
        <label class="form-field">
          <span class="form-label">PARTITION BY</span>
          <SearchSelect
            :model-value="conf.partitionBy || ''"
            :options="upstreamFieldOptions"
            sub-key="sub"
            allow-custom
            placeholder="下拉搜索字段或自定义"
            @update:model-value="(v) => set('partitionBy', v)"
          />
        </label>
        <label class="form-field"><span class="form-label">TTL 表达式</span><input class="input" :value="conf.ttlExpression" @input="set('ttlExpression', $event.target.value)" /></label>
      </div>
    </details>
  </template>

  <!-- ===== sink_kafka ===== -->
  <template v-else-if="type === 'sink_kafka'">
    <div class="sec-title">Kafka</div>
    <label class="form-field">
      <span class="form-label">绑定 Kafka 数据源</span>
      <select class="select" :value="conf.dsId || ''" @change="onBindDs($event.target.value)">
        <option value="">— 暂不绑定 / 手填 bootstrap —</option>
        <option v-for="o in (kafkaDsOptions.length ? kafkaDsOptions : dsOptions)" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <div v-if="dsBound" class="ds-bound-card">
      <div class="ds-bound-title">已绑定 · {{ boundSource?.name || conf.dsId }}</div>
      <div class="form-hint">Bootstrap 运行时解析</div>
    </div>
    <label v-else class="form-field"><span class="form-label">Bootstrap</span><input class="input" :value="conf.bootstrap" @input="set('bootstrap', $event.target.value)" /></label>
    <label class="form-field"><span class="form-label">Topic</span><input class="input" :value="conf.topic" @input="set('topic', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">Key 字段</span>
        <SearchSelect
          :model-value="conf.keyField || ''"
          :options="upstreamFieldOptions"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索字段或自定义"
          @update:model-value="(v) => set('keyField', v)"
        />
      </label>
      <label class="form-field">
        <span class="form-label">Value 格式</span>
        <select class="select" :value="conf.valueFormat" @change="set('valueFormat', $event.target.value)">
          <option>JSON</option><option>Avro</option><option>Protobuf</option><option>String</option>
        </select>
      </label>
    </div>
    <details class="adv-fold">
      <summary>高级：Producer</summary>
      <div class="form-grid-2" style="margin-top: 8px">
        <label class="form-field"><span class="form-label">acks</span><select class="select" :value="conf.acks" @change="set('acks', $event.target.value)"><option>all</option><option>1</option><option>0</option></select></label>
        <label class="form-field"><span class="form-label">压缩</span><select class="select" :value="conf.compression" @change="set('compression', $event.target.value)"><option>lz4</option><option>snappy</option><option>gzip</option><option>none</option></select></label>
        <label class="form-field"><span class="form-label">lingerMs</span><input class="input" type="number" :value="conf.lingerMs" @input="set('lingerMs', Number($event.target.value))" /></label>
        <label class="form-field"><span class="form-label">重试</span><input class="input" type="number" :value="conf.retries" @input="set('retries', Number($event.target.value))" /></label>
      </div>
      <label class="chk-item" style="margin-top: 8px"><input type="checkbox" :checked="!!conf.enableIdempotence" @change="set('enableIdempotence', $event.target.checked)" /> 幂等生产者</label>
    </details>
  </template>

  <!-- ===== sink_object ===== -->
  <template v-else-if="type === 'sink_object'">
    <div class="sec-title">对象存储</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">存储类型</span>
        <select class="select" :value="conf.storageType" @change="set('storageType', $event.target.value)">
          <option>S3</option><option>OSS</option><option>COS</option><option>MinIO</option><option>HDFS</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">Endpoint</span><input class="input" :value="conf.endpoint" @input="set('endpoint', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Bucket</span><input class="input" :value="conf.bucket" @input="set('bucket', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Region</span><input class="input" :value="conf.region" @input="set('region', $event.target.value)" /></label>
    </div>
    <label class="form-field"><span class="form-label">路径</span><input class="input" :value="conf.basePath" @input="set('basePath', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">格式</span><select class="select" :value="conf.format" @change="set('format', $event.target.value)"><option>parquet</option><option>orc</option><option>csv</option><option>json</option></select></label>
      <label class="form-field"><span class="form-label">压缩</span><select class="select" :value="conf.compression" @change="set('compression', $event.target.value)"><option>zstd</option><option>snappy</option><option>gzip</option><option>none</option></select></label>
      <label class="form-field"><span class="form-label">写入模式</span><select class="select" :value="conf.writeMode" @change="set('writeMode', $event.target.value)"><option>overwrite</option><option>append</option></select></label>
      <label class="form-field">
        <span class="form-label">分区</span>
        <SearchSelect
          :model-value="conf.partitionBy || ''"
          :options="upstreamFieldOptions"
          sub-key="sub"
          allow-custom
          placeholder="下拉搜索字段或自定义"
          @update:model-value="(v) => set('partitionBy', v)"
        />
      </label>
    </div>
  </template>

  <!-- ===== sink_ftp ===== -->
  <template v-else-if="type === 'sink_ftp'">
    <div class="sec-title">FTP/SFTP 出湖</div>
    <label class="form-field">
      <span class="form-label">出湖申请单号 ticketNo</span>
      <div class="ticket-no-row">
        <input
          class="input"
          :value="conf.ticketNo || ''"
          @input="set('ticketNo', $event.target.value)"
          placeholder="如 EXP-001（审批通过后回填）"
        />
        <button type="button" class="btn btn-sm btn-primary" @click="goExportApply">去申请</button>
      </div>
      <div class="form-hint">
        合规出湖必填，无单号将阻断校验/发布。
        流程：在「出湖与回流」或申请中心提交 → 审批通过签发 EXP-xxx → 填回此处（ETL 校验单号须已通过）。
        <button type="button" class="btn-link" @click="goExportApply">打开出湖申请</button>
        ·
        <button type="button" class="btn-link" @click="goApplyCenter">查看我的申请</button>
      </div>
    </label>
    <label class="form-field">
      <span class="form-label">绑定数据源</span>
      <select class="select" :value="conf.dsId || ''" @change="onBindDs($event.target.value)">
        <option value="">— 暂不绑定 / 手填 —</option>
        <option v-for="o in dsOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <div v-if="dsBound" class="ds-bound-card">
      <div class="ds-bound-title">已绑定 · {{ boundSource?.name || conf.dsId }}</div>
      <div class="form-hint">Host / 账号运行时解析</div>
    </div>
    <div v-else class="form-grid-2">
      <label class="form-field"><span class="form-label">协议</span><select class="select" :value="conf.protocol" @change="set('protocol', $event.target.value)"><option>SFTP</option><option>FTP</option><option>FTPS</option></select></label>
      <label class="form-field"><span class="form-label">Host</span><input class="input" :value="conf.host" @input="set('host', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">端口</span><input class="input" type="number" :value="conf.port" @input="set('port', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">用户</span><input class="input" :value="conf.user" @input="set('user', $event.target.value)" /></label>
    </div>
    <label class="form-field"><span class="form-label">远端目录</span><input class="input" :value="conf.remoteDir" @input="set('remoteDir', $event.target.value)" /></label>
    <label class="form-field"><span class="form-label">文件名</span><input class="input" :value="conf.fileName" @input="set('fileName', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">编码</span><input class="input" :value="conf.encoding" @input="set('encoding', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">加密</span><input class="input" :value="conf.encrypt" @input="set('encrypt', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">投递后</span><input class="input" :value="conf.afterPut" @input="set('afterPut', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">重试</span><input class="input" type="number" :value="conf.retry" @input="set('retry', Number($event.target.value))" /></label>
    </div>
  </template>

  <!-- ===== sink_rdb ===== -->
  <template v-else-if="type === 'sink_rdb'">
    <div class="sec-title">关系库出湖</div>
    <label class="form-field">
      <span class="form-label">出湖申请单号 ticketNo</span>
      <div class="ticket-no-row">
        <input
          class="input"
          :value="conf.ticketNo || ''"
          @input="set('ticketNo', $event.target.value)"
          placeholder="如 EXP-001（审批通过后回填）"
        />
        <button type="button" class="btn btn-sm btn-primary" @click="goExportApply">去申请</button>
      </div>
      <div class="form-hint">
        合规出湖必填，无单号将阻断校验/发布。
        流程：在「出湖与回流」或申请中心提交 → 审批通过签发 EXP-xxx → 填回此处（ETL 校验单号须已通过）。
        <button type="button" class="btn-link" @click="goExportApply">打开出湖申请</button>
        ·
        <button type="button" class="btn-link" @click="goApplyCenter">查看我的申请</button>
      </div>
    </label>
    <label class="form-field">
      <span class="form-label">绑定数据源</span>
      <select class="select" :value="conf.dsId || ''" @change="onBindDs($event.target.value)">
        <option value="">— 暂不绑定 / 手填 —</option>
        <option v-for="o in dsOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <div class="form-hint">绑定后库类型与连接由数据源中心解析；节点只配目标表与写入策略</div>
    </label>
    <div v-if="dsBound" class="ds-bound-card">
      <div class="ds-bound-title">已绑定 · 连接只读</div>
      <div class="ds-bound-grid">
        <div><span class="k">数据源</span>{{ boundSource?.name || conf.dsId }}</div>
        <div><span class="k">类型</span>{{ typeLabel(boundSource?.type) || '—' }}</div>
        <div><span class="k">Host</span>{{ boundSource?.host || '（运行时解析）' }}</div>
        <div><span class="k">库名</span>{{ boundSource?.database || '—' }}</div>
      </div>
    </div>
    <div class="form-grid-2">
      <label v-if="!dsBound" class="form-field">
        <span class="form-label">库类型</span>
        <select class="select" :value="conf.dbType" @change="set('dbType', $event.target.value)">
          <option v-for="t in DB_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">写入模式</span>
        <select class="select" :value="conf.writeMode" @change="set('writeMode', $event.target.value)">
          <option>replace</option><option>insert</option><option>update</option><option>upsert</option>
        </select>
      </label>
    </div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">Schema</span>
        <input
          class="input"
          :value="conf.schema || ''"
          @input="set('schema', $event.target.value)"
          placeholder="PostgreSQL 默认 public；可空"
        />
      </label>
      <label class="form-field">
        <span class="form-label">目标表</span>
        <SearchSelect
          :model-value="conf.table || ''"
          :options="tableOptions"
          sub-key="sub"
          allow-custom
          placeholder="表名或 schema.table，如 public.dev_log"
          @update:model-value="(v) => setMany({ table: v, tables: v ? [v] : [] })"
        />
      </label>
    </div>
    <div class="form-hint" style="margin-top: -4px; margin-bottom: 8px">
      存在性按绑定数据源 JDBC 校验（非 Grav）。PG 未填 schema 时按 <code>public</code>；也可在表名写 <code>public.dev_log</code>
    </div>
    <div v-if="conf.writeMode === 'upsert' || conf.writeMode === 'update'" class="form-field">
      <span class="form-label">主键字段</span>
      <MultiSearchSelect
        :model-value="selectedPk"
        :options="pkFieldOptions"
        sub-key="sub"
        allow-custom
        placeholder="下拉搜索字段，支持复合主键"
        @update:model-value="onPkChange"
      />
    </div>
    <div class="sec-title">受控自动建表</div>
    <label class="form-field">
      <span class="form-label">作业写账号 saRole</span>
      <input class="input" :value="conf.saRole || ''" @input="set('saRole', $event.target.value)" placeholder="job.ads_out_writer" />
      <div class="form-hint">出湖写库须用独立作业 SA</div>
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">autoCreate</span>
        <select class="select" :value="conf.autoCreate || 'off'" @change="set('autoCreate', $event.target.value)">
          <option v-for="m in AUTO_CREATE_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">Schema 来源</span>
        <select
          class="select"
          :value="conf.schemaFrom || 'upstream'"
          :disabled="(conf.autoCreate || 'off') === 'off'"
          @change="set('schemaFrom', $event.target.value)"
        >
          <option v-for="o in SCHEMA_FROM_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
    </div>
    <div class="form-hint">{{ autoCreateHint }}</div>
    <label v-if="showAutoCreateDdl" class="form-field">
      <span class="form-label">DDL 预览（只读）</span>
      <textarea class="textarea mono" rows="8" readonly :value="createDdlPreview" />
    </label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">批次大小</span><input class="input" type="number" :value="conf.batchSize" @input="set('batchSize', Number($event.target.value))" /></label>
    </div>
    <label class="form-field"><span class="form-label">Pre SQL</span><textarea class="textarea mono" rows="2" :value="conf.preSql" @input="set('preSql', $event.target.value)" /></label>
    <label class="form-field"><span class="form-label">Post SQL</span><textarea class="textarea mono" rows="2" :value="conf.postSql" @input="set('postSql', $event.target.value)" /></label>
  </template>

  <!-- ===== sink_search ===== -->
  <template v-else-if="type === 'sink_search'">
    <div class="sec-title">搜索引擎</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">引擎类型</span><select class="select" :value="conf.engineType || 'Elasticsearch'" @change="set('engineType', $event.target.value)"><option>Elasticsearch</option><option>OpenSearch</option><option>Solr</option></select></label>
      <label class="form-field"><span class="form-label">Index</span><input class="input" :value="conf.index" @input="set('index', $event.target.value)" /></label>
    </div>
    <div class="form-hint">写出运行时继承任务主引擎，无需在节点重复选择。</div>
  </template>

  <!-- ===== sink_bi ===== -->
  <template v-else-if="type === 'sink_bi'">
    <div class="sec-title">BI / 出湖推送</div>
    <label class="form-field">
      <span class="form-label">出湖申请单号 ticketNo</span>
      <div class="ticket-no-row">
        <input
          class="input"
          :value="conf.ticketNo || ''"
          @input="set('ticketNo', $event.target.value)"
          placeholder="如 EXP-001（审批通过后回填）"
        />
        <button type="button" class="btn btn-sm btn-primary" @click="goExportApply">去申请</button>
      </div>
      <div class="form-hint">
        合规出湖必填，无单号将阻断校验/发布。
        流程：在「出湖与回流」或申请中心提交 → 审批通过签发 EXP-xxx → 填回此处（ETL 校验单号须已通过）。
        <button type="button" class="btn-link" @click="goExportApply">打开出湖申请</button>
        ·
        <button type="button" class="btn-link" @click="goApplyCenter">查看我的申请</button>
      </div>
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">目标系统</span>
        <input class="input" :value="conf.targetSystem || conf.target || ''" @input="setMany({ targetSystem: $event.target.value, target: $event.target.value })" placeholder="Superset / FineBI / …" />
      </label>
      <label class="form-field">
        <span class="form-label">数据集</span>
        <input class="input" :value="conf.dataset || ''" @input="set('dataset', $event.target.value)" />
      </label>
      <label class="form-field">
        <span class="form-label">刷新模式</span>
        <select class="select" :value="conf.refreshMode || conf.refresh || 'incremental'" @change="setMany({ refreshMode: $event.target.value, refresh: $event.target.value })">
          <option value="incremental">incremental</option>
          <option value="full">full</option>
          <option value="streaming">streaming</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">工作空间</span>
        <input class="input" :value="conf.workspace || ''" @input="set('workspace', $event.target.value)" />
      </label>
    </div>
  </template>

  <div v-else class="form-hint">该节点类型暂无额外参数</div>
</template>

<style scoped>
.sec-title {
  margin: 14px 0 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border, #e5e7eb);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3, #8c8c8c);
  letter-spacing: 0.02em;
}
.sec-title:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}
.chk-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-2, #f7f8fa);
}
.chk-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.ds-bound-card {
  margin: 8px 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
}
.ds-bound-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2, #595959);
  margin-bottom: 8px;
}
.ds-bound-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  font-size: 12px;
  color: var(--text-1, #262626);
}
.ds-bound-grid .k {
  display: inline-block;
  min-width: 42px;
  margin-right: 6px;
  color: var(--text-3, #8c8c8c);
}
.adv-fold {
  margin-top: 12px;
  padding: 8px 10px;
  border: 1px dashed var(--border, #e5e7eb);
  border-radius: 8px;
  background: #fafbfc;
}
.adv-fold > summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2, #595959);
  list-style: none;
}
.adv-fold > summary::-webkit-details-marker {
  display: none;
}
.adv-fold > summary::before {
  content: '▸ ';
  color: var(--text-3);
}
.adv-fold[open] > summary::before {
  content: '▾ ';
}
.rule-pick {
  max-height: 180px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-2, #f7f8fa);
}
.table-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.table-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 12px;
  background: #e6f4ff;
  color: #0958d9;
  border: 1px solid #91caff;
}
.chip-x {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #0958d9;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}
.table-pick {
  max-height: 200px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-2, #f7f8fa);
  margin-bottom: 8px;
}
.table-pick .opt-sub {
  color: var(--text-3, #8c8c8c);
  font-size: 11px;
}
.table-custom-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.table-custom-row .input {
  flex: 1;
}
.ticket-no-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.ticket-no-row .input {
  flex: 1;
  min-width: 0;
}
.btn-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--primary, #1e6fff);
  cursor: pointer;
  font-size: inherit;
  text-decoration: underline;
}
.btn-link:hover {
  opacity: 0.85;
}
</style>
