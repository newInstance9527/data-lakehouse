<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import SqlEditor from '@/components/etl/SqlEditor.vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import { useToast } from '@/composables/useToast'
import { useDataservice } from '@/composables/useDataservice'
import {
  fetchMetaTables,
  fetchMetaViews,
  fetchMetaColumns,
} from '@/api/datasource.js'
import { parseDataapiParams, fetchSqlrestOptions, buildDataapi, publishDataapi, gatewayProbe } from '@/api/dataapi.js'
import { createApplyTicket, pageMyTickets } from '@/api/apply.js'
import { compileMetric, fetchMetricList } from '@/api/metric.js'
import { fetchAssetPage, fetchAssetSchema, fetchAssetSources } from '@/api/catalog.js'
import { bindTableKeyOf } from '@/data/metricBindAssets.js'
import {
  applyPgParamTextCasts,
  isDialectSample,
  isPostgresFamily,
  normalizeSqlContext,
  quoteIdent,
  quoteQualified,
  resolveSqlDialect,
  sqlHasTrailingLimit,
  sqlNeedsPgParamTextCast,
} from '@/utils/sqlDialect'
import { FIELD_TRANSFORM_OPTIONS, mapResponseRow } from '@/data/apiBuild.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  editId: { type: String, default: '' },
})
const emit = defineEmits(['close', 'publish'])

const { showToast } = useToast()
const { sqlrestDs, ensureLoaded, openDetail, runTrial, embed } = useDataservice()

const TAB_IDS = [
  { id: 'sql', label: 'SQL配置' },
  { id: 'iface', label: '接口配置' },
  { id: 'output', label: '出参格式' },
  { id: 'cache', label: '缓存配置' },
  { id: 'auth', label: '认证配置' },
  { id: 'alarm', label: '告警配置' },
  { id: 'flow', label: '流量控制' },
]

const tab = ref('sql')
const paramSide = ref('in')
const saving = ref(false)
const testing = ref(false)
const publishing = ref(false)
const dirty = ref(false)
const debugOpen = ref(false)
const DEBUG_WIDTH_KEY = 'dataservice-api-debug-width'
const DEBUG_WIDTH_DEFAULT = 320
const DEBUG_WIDTH_MIN = 240
const DEBUG_WIDTH_MAX = 560
const debugWidth = ref(DEBUG_WIDTH_DEFAULT)
const debugDragging = ref(false)
const wbBodyRef = ref(null)
const moreOpen = ref(false)
const options = ref({
  namingStrategies: [],
  typeFormats: [],
  completions: [],
  modules: [],
  authGroups: [],
  defaultModuleId: 1,
  defaultGroupId: 1,
})

function loadDebugWidth() {
  try {
    const saved = Number(localStorage.getItem(DEBUG_WIDTH_KEY))
    if (Number.isFinite(saved) && saved > 0) {
      debugWidth.value = Math.min(DEBUG_WIDTH_MAX, Math.max(DEBUG_WIDTH_MIN, Math.round(saved)))
    } else {
      debugWidth.value = DEBUG_WIDTH_DEFAULT
    }
  } catch {
    debugWidth.value = DEBUG_WIDTH_DEFAULT
  }
}

function clampDebugWidth(w) {
  return Math.min(DEBUG_WIDTH_MAX, Math.max(DEBUG_WIDTH_MIN, Math.round(w)))
}

function saveDebugWidth() {
  try {
    localStorage.setItem(DEBUG_WIDTH_KEY, String(debugWidth.value))
  } catch {
    /* ignore */
  }
}

function onDebugResizeMove(e) {
  if (!debugDragging.value) return
  const el = wbBodyRef.value
  const right = el ? el.getBoundingClientRect().right : window.innerWidth
  debugWidth.value = clampDebugWidth(right - e.clientX)
}

function stopDebugResize() {
  if (!debugDragging.value) return
  debugDragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onDebugResizeMove)
  window.removeEventListener('mouseup', stopDebugResize)
  saveDebugWidth()
}

function startDebugResize(e) {
  e.preventDefault()
  debugDragging.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onDebugResizeMove)
  window.addEventListener('mouseup', stopDebugResize)
}

loadDebugWidth()

const form = reactive(emptyForm())
/** 各引擎独立窗口列表 + 激活 key，切换时互不覆盖 */
const engineWindowStash = reactive({ SQL: null, GROOVY: null })
const objectNodes = ref([])
const metaLoading = ref(false)
const sqlEditorRef = ref(null)

/** D9/F3：从指标 / 资产生成 SQL 模板 */
const tplOpen = ref(false)
const tplKind = ref('metric') // metric | asset
const tplLoading = ref(false)
const tplApplying = ref(false)
const tplOptions = ref([])
const tplSelected = ref('')
const tplPreview = ref('')
const tplHint = ref('')
const tplPortalDsId = ref('')

const projectedDs = computed(() =>
  (sqlrestDs.value || []).filter((d) => d.projected || d.sqlrestDatasourceId),
)

const dsOptions = computed(() =>
  projectedDs.value.map((d) => ({
    id: d.id,
    label: `[${d.sqlrestDatasourceId || '?'}] ${d.name || d.dsCode || d.id}`,
    sqlrestId: d.sqlrestDatasourceId,
  })),
)

const selectedDs = computed(() =>
  projectedDs.value.find((d) => d.id === form.datasourceId) || null,
)

const sqlDialect = computed(() =>
  resolveSqlDialect(selectedDs.value?.sqlrestType || selectedDs.value?.type),
)

const isPgDialect = computed(() => isPostgresFamily(sqlDialect.value))

/** PG：当前 SQL 含 concat/LIKE 且存在未加 ::cast 的 #{param} */
const pgNeedsTextCast = computed(() => {
  if (!isPgDialect.value || form.engine !== 'SQL') return false
  return contextListOf().some((s) => sqlNeedsPgParamTextCast(s))
})

watch(
  () => props.open,
  async (v) => {
    if (!v) return
    await ensureLoaded(true)
    Object.assign(form, emptyForm())
    engineWindowStash.SQL = null
    engineWindowStash.GROOVY = null
    objectNodes.value = []
    tab.value = 'sql'
    dirty.value = false
    debugOpen.value = false
    moreOpen.value = false
    closeTplPicker()
    try {
      options.value = { ...options.value, ...((await fetchSqlrestOptions()) || {}) }
      if (form.moduleId == null && options.value.defaultModuleId != null) {
        form.moduleId = options.value.defaultModuleId
      }
      if (form.groupId == null && options.value.defaultGroupId != null) {
        form.groupId = options.value.defaultGroupId
      }
    } catch {
      /* soft */
    }
    if (props.editId) {
      await loadEdit(props.editId)
    }
  },
)

watch(
  () => props.editId,
  async (id) => {
    if (!props.open || !id) return
    await loadEdit(id)
  },
)

function onDocClickMore(e) {
  if (!moreOpen.value) return
  const el = e?.target?.closest?.('.wb-more')
  if (!el) moreOpen.value = false
}
watch(moreOpen, (v) => {
  if (v) document.addEventListener('click', onDocClickMore, true)
  else document.removeEventListener('click', onDocClickMore, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClickMore, true)
  stopDebugResize()
})

watch(
  () => form.datasourceId,
  async (id) => {
    objectNodes.value = []
    if (!id || !props.open) return
    await loadObjects(id)
  },
)

function emptyForm() {
  return {
    id: '',
    name: '',
    description: '',
    path: '/api/',
    method: 'GET',
    contentType: 'application/x-www-form-urlencoded',
    datasourceId: '',
    moduleId: null,
    groupId: null,
    engine: 'SQL',
    sqlWindows: [{ key: 'w1', title: 'SQL窗口(1)', sql: 'SELECT 1 AS ok' }],
    activeSqlKey: 'w1',
    open: true,
    alarm: false,
    timeout: 300,
    namingStrategy: 'CAMEL_CASE',
    useSystemFormat: true,
    typeFormatValues: {},
    cacheKeyType: 'NONE',
    cacheKeyExpr: '',
    cacheExpireSeconds: 300,
    flowStatus: false,
    flowGrade: 1,
    flowCount: 5,
    qps: 100,
    burst: 200,
    owner: '',
    domain: '',
    params: [],
    outputs: [],
    publishTicketNo: '',
    publishTicketStatus: '',
    publishTicketRemark: '',
    sourceKind: 'sql',
    sourceRef: '',
    tested: false,
    testResult: null,
    probeResult: null,
  }
}

const activeSql = computed({
  get() {
    const w = form.sqlWindows.find((x) => x.key === form.activeSqlKey) || form.sqlWindows[0]
    return w?.sql || ''
  },
  set(v) {
    const w = form.sqlWindows.find((x) => x.key === form.activeSqlKey) || form.sqlWindows[0]
    if (w) w.sql = v
    dirty.value = true
  },
})

function addSqlWindow() {
  const n = form.sqlWindows.length + 1
  const key = `w${Date.now()}`
  const prefix = windowTitlePrefix(form.engine)
  form.sqlWindows.push({ key, title: `${prefix}(${n})`, sql: '' })
  form.activeSqlKey = key
  dirty.value = true
}

function removeSqlWindow(key) {
  if (form.sqlWindows.length <= 1) {
    showToast('至少保留一个窗口', 'warning')
    return
  }
  form.sqlWindows = form.sqlWindows.filter((w) => w.key !== key)
  if (form.activeSqlKey === key) form.activeSqlKey = form.sqlWindows[0].key
  dirty.value = true
}

function contextListOf({ trial = false } = {}) {
  // 调试：只用当前窗口，避免其它窗口残片（如单独的 LIMIT）被一并执行
  if (trial) {
    const cur = String(activeSql.value || '').trim()
    if (cur) {
      const n = normalizeSqlContext(cur)
      if (n) return [n]
    }
  }
  return form.sqlWindows
    .map((w) => normalizeSqlContext(w.sql || ''))
    .filter((s) => String(s).trim())
}

async function loadEdit(id) {
  try {
    const d = await openDetail({ id })
    if (!d) return
    form.id = d.id
    form.name = d.name || ''
    form.path = d.path || d.publicPath || '/api/'
    form.method = d.method || 'GET'
    form.description = d.description || d.desc || ''
    form.datasourceId = d.portalDsId || d.datasourceId || ''
    form.engine = d.sqlrest?.engine || d.engine || 'SQL'
    form.sourceKind = d.sourceKind || 'sql'
    form.sourceRef = d.sourceRef || ''
    form.qps = d.qpsLimit || d.qps || 100
    form.burst = d.burstLimit || d.burst || 200
    form.owner = d.ownerUser || d.owner || ''
    form.domain = d.domainCode || d.domain || ''
    const sr = d.sqlrest || {}
    if (Array.isArray(sr.sqlList) && sr.sqlList.length) {
      form.sqlWindows = sr.sqlList.map((s, i) => ({
        key: `w${i + 1}`,
        title: `SQL窗口(${i + 1})`,
        sql: s.sqlText || s || '',
      }))
      form.activeSqlKey = form.sqlWindows[0].key
    } else if (d.sql) {
      form.sqlWindows = [{ key: 'w1', title: 'SQL窗口(1)', sql: d.sql }]
      form.activeSqlKey = 'w1'
    }
    retitleWindows()
    engineWindowStash.SQL = null
    engineWindowStash.GROOVY = null
    stashEngineWindows(form.engine)
    form.publishTicketNo = d.publishTicketNo || ''
    form.publishTicketStatus = ''
    if (Array.isArray(sr.params)) {
      form.params = sr.params.map((p) => ({
        name: p.name,
        type: normalizePortalParamType(p.type),
        location: p.location || '',
        required: !!p.required,
        isArray: !!p.isArray,
        defaultValue: p.defaultValue ?? '',
        example: '',
        desc: p.remark || '',
      }))
    }
    if (sr.namingStrategy) form.namingStrategy = sr.namingStrategy
    if (sr.cacheKeyType) form.cacheKeyType = sr.cacheKeyType
    if (sr.cacheKeyExpr != null) form.cacheKeyExpr = sr.cacheKeyExpr
    if (sr.cacheExpireSeconds != null) form.cacheExpireSeconds = sr.cacheExpireSeconds
    if (sr.flowStatus != null) form.flowStatus = !!sr.flowStatus
    if (sr.flowGrade != null) form.flowGrade = sr.flowGrade
    if (sr.flowCount != null) form.flowCount = sr.flowCount
    if (sr.open != null) form.open = !!sr.open
    form.alarm = !!sr.alarm
    if (sr.timeout != null) form.timeout = Number(sr.timeout) || 300
    const fm = sr.formatMap
    if (Array.isArray(fm)) {
      const sys = fm.find((x) => x.key === 'USE_SYSTEM_RESPONSE_FORMAT')
      if (sys) form.useSystemFormat = String(sys.value) !== 'false'
      form.typeFormatValues = {}
      for (const row of fm) {
        if (!row?.key || row.key === 'USE_SYSTEM_RESPONSE_FORMAT') continue
        const key = normalizeFormatKey(row.key)
        if (!key) continue
        form.typeFormatValues[key] = row.value ?? ''
      }
    }
    const fromResp = Array.isArray(d.responses) ? d.responses : []
    const fromOut = Array.isArray(sr.outputs) ? sr.outputs : Array.isArray(d.outputs) ? d.outputs : []
    const rawOut = fromResp.length ? fromResp : fromOut
    form.outputs = rawOut.map((o) => normalizeOutputRow(o))
    if (sr.moduleId != null) form.moduleId = sr.moduleId
    else if (d.moduleId != null) form.moduleId = d.moduleId
    if (sr.groupId != null) form.groupId = sr.groupId
    else if (d.groupId != null) form.groupId = d.groupId
    dirty.value = false
  } catch (e) {
    showToast(`加载失败：${e?.message || e}`, 'warning')
  }
}

/** MySQL 系把 schema 参数当 catalog；PG/SQL Server/Oracle 由后端用连接上的默认 schema */
function metaSchemaArg(ds) {
  if (!ds) return ''
  const type = String(ds.type || '').toLowerCase()
  const db = String(ds.database || ds.databaseName || '').trim()
  if (['pg', 'postgres', 'postgresql', 'sqlserver', 'mssql', 'oracle'].some((t) => type === t || type.includes(t))) {
    return ''
  }
  return db
}

function asNameList(raw) {
  const list = Array.isArray(raw) ? raw : raw?.data || []
  return (list || []).map((t) => (typeof t === 'string' ? t : t.name)).filter(Boolean)
}

async function loadObjects(dsId) {
  metaLoading.value = true
  objectNodes.value = []
  const ds = projectedDs.value.find((d) => d.id === dsId) || null
  const schema = metaSchemaArg(ds)
  try {
    const [tables, views] = await Promise.all([
      fetchMetaTables(dsId, schema),
      fetchMetaViews(dsId, schema),
    ])
    const qualify = schema
    objectNodes.value = [
      {
        name: '表',
        kind: 'folder',
        expanded: true,
        children: asNameList(tables).map((name) => ({
          name,
          kind: 'table',
          schema: qualify,
          expanded: false,
          loading: false,
          children: null,
        })),
      },
      {
        name: '视图',
        kind: 'folder',
        expanded: false,
        children: asNameList(views).map((name) => ({
          name,
          kind: 'view',
          schema: qualify,
          expanded: false,
          loading: false,
          children: null,
        })),
      },
    ]
  } catch (e) {
    showToast(`加载表失败：${e?.message || e}`, 'warning')
    objectNodes.value = []
  } finally {
    metaLoading.value = false
  }
}

async function toggleTable(node) {
  if (node.kind !== 'table' && node.kind !== 'view') {
    node.expanded = !node.expanded
    return
  }
  if (node.expanded) {
    node.expanded = false
    return
  }
  node.expanded = true
  if (node.children) return
  node.loading = true
  try {
    const cols = await fetchMetaColumns(form.datasourceId, node.schema, node.name)
    const list = Array.isArray(cols) ? cols : cols?.data || []
    node.children = (list || []).map((c) => ({
      name: c.name,
      type: c.type,
      remarks: c.remarks || '',
      kind: 'column',
      schema: node.schema,
      table: node.name,
      sensitive: !!c.sensitive,
      maskedHint: c.maskedHint || '',
    }))
  } catch (e) {
    showToast(`加载列失败：${e?.message || e}`, 'warning')
    node.children = []
  } finally {
    node.loading = false
  }
}

const GROOVY_STUB = 'def rows = []\nreturn rows'
const SQL_STUB = 'SELECT 1 AS ok'

/** SQLREST 动态 SQL 补全模板；示例随当前数据源方言变化 */
const SQL_SNIPPETS = [
  {
    caption: 'foreach',
    value: '<foreach open="(" close=")" collection="" separator="," item="item" index="index">#{item}</foreach>',
  },
  { caption: 'if', value: '<if test="" ></if>' },
  { caption: 'where', value: '<where></where>' },
  {
    caption: 'trim',
    value: '<trim prefix="" suffix="" suffixesToOverride="" prefixesToOverride=""></trim>',
  },
]

const GROOVY_SNIPPETS = [
  { caption: '示例', value: `${GROOVY_STUB}\n` },
  { caption: 'def', value: 'def name = null' },
  { caption: 'if', value: 'if (condition) {\n    \n}' },
  { caption: 'each', value: 'list.each { item ->\n    \n}' },
  { caption: 'return', value: 'return result' },
]

const activeSnippets = computed(() => {
  if (form.engine === 'GROOVY') return GROOVY_SNIPPETS
  if (sqlDialect.value.sql === false) return []
  return [{ caption: '示例', value: sqlDialect.value.sample }, ...SQL_SNIPPETS]
})
const editorHint = computed(() => {
  if (form.engine === 'GROOVY') return 'Groovy 高亮 · Ctrl+Space 补全 · 格式化按花括号缩进'
  const d = sqlDialect.value
  if (d.sql === false) return `${d.label} · ${d.quoteHint}`
  const name = d.family ? `${d.label} · 按 ${d.family}` : d.label
  const pageTip = ' · SQLREST 自动分页，勿写末尾 LIMIT/分号'
  if (d.fallback && !selectedDs.value) return `未选数据源，暂按 ${d.label} · ${d.quoteHint}${pageTip}`
  if (d.fallback) return `${name}${d.raw ? `（${d.raw}）` : ''} · ${d.quoteHint}${pageTip}`
  return `${name} · ${d.quoteHint} · 支持表列自动补全 · Ctrl+Space · 双击表列插入${pageTip}`
})

watch(
  () => form.datasourceId,
  (id, prev) => {
    if (!id || id === prev || form.engine === 'GROOVY') return
    const cur = String(activeSql.value || '').trim()
    if (!cur || cur === SQL_STUB || isDialectSample(cur)) {
      activeSql.value = sqlDialect.value.sql === false || !sqlDialect.value.sample ? '' : `${sqlDialect.value.sample}\n`
      return
    }
    if (prev) {
      const d = sqlDialect.value
      showToast(
        d.sql === false
          ? `${d.label} 不是 SQL 数据源，已有语句不会自动删除`
          : `已切换 ${d.family ? `${d.label}（按 ${d.family}）` : d.label}。已有 SQL 不会自动改写，之后插入的表名按${d.quoteHint}`,
        'info',
      )
    }
  },
)

function windowTitlePrefix(engine) {
  return engine === 'GROOVY' ? 'Groovy窗口' : 'SQL窗口'
}

function cloneWindowState(windows, activeKey) {
  return {
    windows: (windows || []).map((w) => ({ key: w.key, title: w.title, sql: w.sql })),
    activeKey: activeKey || (windows?.[0]?.key ?? 'w1'),
  }
}

function defaultWindowState(engine) {
  const prefix = windowTitlePrefix(engine)
  const sql = engine === 'GROOVY' ? `${GROOVY_STUB}\n` : SQL_STUB
  return {
    windows: [{ key: 'w1', title: `${prefix}(1)`, sql }],
    activeKey: 'w1',
  }
}

function applyWindowState(state) {
  const s = state || defaultWindowState(form.engine)
  form.sqlWindows = s.windows.map((w) => ({ key: w.key, title: w.title, sql: w.sql }))
  const keys = new Set(form.sqlWindows.map((w) => w.key))
  form.activeSqlKey = keys.has(s.activeKey) ? s.activeKey : form.sqlWindows[0]?.key || 'w1'
}

function stashEngineWindows(engine = form.engine) {
  if (engine !== 'SQL' && engine !== 'GROOVY') return
  engineWindowStash[engine] = cloneWindowState(form.sqlWindows, form.activeSqlKey)
}

function retitleWindows() {
  const prefix = windowTitlePrefix(form.engine)
  form.sqlWindows.forEach((w, i) => {
    w.title = `${prefix}(${i + 1})`
  })
}

function onEngineChange(fromEngine) {
  if (fromEngine && fromEngine !== form.engine) {
    stashEngineWindows(fromEngine)
  }
  const saved = engineWindowStash[form.engine]
  applyWindowState(saved || defaultWindowState(form.engine))
  showToast(form.engine === 'GROOVY' ? '已切换 Groovy，请按脚本语法编写' : '已切换 SQL', 'info')
  markDirty()
}

function insertText(text) {
  const chunk = String(text || '')
  if (!chunk) return
  dirty.value = true
  tab.value = 'sql'
  if (sqlEditorRef.value?.insertText) {
    sqlEditorRef.value.insertText(chunk, { wrapSpace: true })
    return
  }
  // 兜底：无编辑器实例时追加
  const cur = activeSql.value || ''
  activeSql.value = cur + (cur && !cur.endsWith('\n') && !cur.endsWith(' ') ? ' ' : '') + chunk
}

function insertSnippet(snippet) {
  const cur = String(activeSql.value || '').trim()
  const blank = !cur || cur === SQL_STUB || cur === GROOVY_STUB
  if (snippet.caption === '示例' && blank) {
    activeSql.value = snippet.value.endsWith('\n') ? snippet.value : `${snippet.value}\n`
    dirty.value = true
    tab.value = 'sql'
    return
  }
  insertText(snippet.value)
}

function onDblclickNode(node) {
  const d = sqlDialect.value
  if (node.kind === 'table' || node.kind === 'view') {
    insertText(quoteQualified(node.schema, node.name, d))
  } else if (node.kind === 'column') {
    insertText(quoteIdentSafe(node.name))
  }
}

function quoteIdentSafe(name) {
  return quoteQualified('', name, sqlDialect.value)
}

function markDirty() {
  dirty.value = true
}

async function parseParams({ quiet = false } = {}) {
  try {
    const sql = contextListOf().join('\n')
    if (!String(sql || '').trim()) {
      if (!quiet) showToast('请先填写 SQL', 'warning')
      return
    }
    const res = await parseDataapiParams({ sql, engine: form.engine })
    let list = res?.params || []
    // SQLREST 不可达时本地兜底扫 #{name} / {{name}}
    if (!list.length) {
      list = localParsePlaceholders(sql)
    }
    if (!list.length) {
      if (!quiet) {
        showToast('语句中无 #{参数名} 占位符，无需入参；可直接试跑，或手写 WHERE id = #{id}', 'info')
      }
      return
    }
    const prev = new Map((form.params || []).map((p) => [p.name, p]))
    form.params = list.map((p) => {
      const old = prev.get(p.name)
      if (old) {
        return { ...old, type: normalizePortalParamType(old.type || p.type) }
      }
      return {
        name: p.name,
        type: normalizePortalParamType(p.type),
        location: form.method === 'GET' ? 'REQUEST_FORM' : 'REQUEST_BODY',
        required: !!p.required,
        isArray: !!p.isArray,
        defaultValue: '',
        example: '',
        desc: '',
      }
    })
    dirty.value = true
    if (!quiet) {
      showToast(`已解析 ${form.params.length} 个入参`, 'success')
      if (isPgDialect.value && pgNeedsTextCast.value) {
        showToast('PostgreSQL：concat/LIKE 中裸 #{param} 建议加 ::text（可用下方一键）', 'info')
      }
    }
  } catch (e) {
    if (!quiet) showToast(`解析失败：${e?.message || e}`, 'warning')
  }
}

/** 与 SQLREST 一致：只认 #{name}；兼容指标模板遗留的 {{name}} */
function localParsePlaceholders(sql) {
  const text = String(sql || '')
  const names = new Set()
  const re = /#\{([a-zA-Z_][\w.]*)\}|\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g
  let m
  while ((m = re.exec(text))) {
    const n = (m[1] || m[2] || '').replace(/\./g, '_')
    if (n) names.add(n)
  }
  return [...names].map((name) => ({
    name,
    type: 'string',
    required: false,
    isArray: false,
  }))
}

function addParam() {
  form.params.push({
    name: '',
    type: 'string',
    location: form.method === 'GET' ? 'REQUEST_FORM' : 'REQUEST_BODY',
    required: true,
    isArray: false,
    defaultValue: '',
    example: '',
    desc: '',
  })
  dirty.value = true
}

function addPageParams() {
  const exists = new Set((form.params || []).map((p) => p.name))
  const rows = [
    { name: 'page', type: 'int', defaultValue: '1', desc: '页码', example: '1' },
    { name: 'size', type: 'int', defaultValue: '20', desc: '每页条数', example: '20' },
  ]
  for (const row of rows) {
    if (exists.has(row.name)) continue
    form.params.push({
      ...row,
      location: 'REQUEST_FORM',
      required: false,
      isArray: false,
    })
  }
  dirty.value = true
  showToast('已添加分页参数 page / size', 'success')
}

function addOutput() {
  form.outputs.push({ source: '', name: '', type: 'STRING', transform: 'none', remark: '' })
  paramSide.value = 'out'
  dirty.value = true
}

function stripIdentQuotes(name) {
  return String(name || '')
    .trim()
    .replace(/^["`\[(]+/, '')
    .replace(/["\`\])]+$/, '')
}

function normalizeOutputType(type) {
  const t = String(type || 'STRING').trim()
  const lower = t.toLowerCase()
  if (lower === 'string') return 'STRING'
  if (lower === 'int' || lower === 'integer' || lower === 'long') return 'LONG'
  if (lower === 'number' || lower === 'double' || lower === 'float') return 'DOUBLE'
  if (lower === 'date' || lower === 'datetime' || lower === 'timestamp') return 'DATE'
  if (lower === 'bool' || lower === 'boolean') return 'BOOLEAN'
  if (lower === 'object' || lower === 'array' || lower === 'json') return 'OBJECT'
  const upper = t.toUpperCase()
  const known = ['STRING', 'LONG', 'DOUBLE', 'DATE', 'BOOLEAN', 'OBJECT']
  return known.includes(upper) ? upper : 'STRING'
}

function normalizeOutputRow(o = {}) {
  const source = stripIdentQuotes(o.source || '')
  const nameRaw = String(o.name || '').trim()
  const name = nameRaw || applyNamingToOutputName(source)
  return {
    source: source || name,
    name,
    type: normalizeOutputType(o.type),
    transform: o.transform || 'none',
    remark: o.remark || o.desc || '',
  }
}

/** 出参名随命名策略：CAMEL_CASE 时 exe_status → exeStatus，与调试 JSON 一致 */
function applyNamingToOutputName(name) {
  const n = stripIdentQuotes(name)
  if (!n) return n
  const strat = String(form.namingStrategy || 'CAMEL_CASE').toUpperCase()
  if (strat === 'NONE') return n
  if (strat === 'SNAKE_CASE') {
    return n
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase()
  }
  // CAMEL_CASE（默认）
  return n
    .replace(/^[_\-\s]+/, '')
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join('')
}

/** JDBC / 方言类型 → SQLREST 出参类型 */
function mapColTypeToOutput(type) {
  const t = String(type || '').toUpperCase()
  if (!t) return 'STRING'
  if (/\b(BOOL|BIT)\b/.test(t)) return 'BOOLEAN'
  if (/\b(TIMESTAMPTZ|TIMESTAMP|DATETIME|DATE|TIME)\b/.test(t)) return 'DATE'
  if (/\b(INT|BIGINT|SMALLINT|TINYINT|SERIAL|LONG|INT8|INT4|INT2)\b/.test(t)) return 'LONG'
  if (/\b(FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL|NUMBER|MONEY)\b/.test(t)) return 'DOUBLE'
  if (/\b(JSON|JSONB|OBJECT|STRUCT|MAP|ARRAY)\b/.test(t)) return 'OBJECT'
  return 'STRING'
}

function selectListIsStar(body) {
  const t = String(body || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return false
  if (t === '*') return true
  // alias.* / "t".* / schema.table.*
  return /^([\w."`\[\]]+\s*\.\s*)?\*$/.test(t)
}

/** 解析 FROM 后首个表：schema.table 或 table（去掉引号与别名） */
function extractPrimaryFromTable(sql) {
  const m = String(sql || '').match(
    /\bfrom\b\s+([\s\S]+?)(?=\b(?:where|group\s+by|order\s+by|limit|having|join|left|right|inner|outer|full|cross|union|;)\b|$)/i,
  )
  if (!m) return null
  let raw = m[1].trim()
  // 去掉尾部逗号（多表 FROM a, b）只取第一段
  const first = raw.split(',')[0].trim()
  // 标识符序列：["schema"."table"] | schema.table | "table"
  const parts = []
  const re = /(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_\u4e00-\u9fa5][\w$]*))/g
  let hit
  while ((hit = re.exec(first)) && parts.length < 3) {
    const p = hit[1] || hit[2] || hit[3] || hit[4]
    if (!p) continue
    // 别名停：FROM table AS t / FROM table t
    if (parts.length >= 1 && /^(as)$/i.test(p)) break
    if (parts.length >= 1 && hit.index > 0) {
      const between = first.slice(0, hit.index)
      // 已有表名后的空白+标识 → 当别名丢弃
      if (/\s$/.test(between) || /\s/.test(between.slice(-1))) {
        // 若前面已是完整表，当前是别名
        if (parts.length >= 1 && !between.trim().endsWith('.')) break
      }
    }
    parts.push(p)
  }
  if (!parts.length) return null
  if (parts.length === 1) return { schema: '', table: parts[0] }
  // catalog.schema.table → 用末两段；schema.table → 两段
  if (parts.length >= 3) {
    return { schema: parts[parts.length - 2], table: parts[parts.length - 1] }
  }
  return { schema: parts[0], table: parts[1] }
}

function findLoadedTableNode(schema, table) {
  const tname = stripIdentQuotes(table)
  const sname = stripIdentQuotes(schema)
  for (const folder of objectNodes.value || []) {
    for (const node of folder.children || []) {
      if (node.kind !== 'table' && node.kind !== 'view') continue
      if (stripIdentQuotes(node.name) !== tname) continue
      if (sname && node.schema && stripIdentQuotes(node.schema) !== sname) continue
      return node
    }
  }
  return null
}

async function loadColumnsForTable(schema, table) {
  const node = findLoadedTableNode(schema, table)
  if (node?.children?.length) {
    return node.children.filter((c) => c.kind === 'column')
  }
  if (!form.datasourceId) return []
  // 优先用 SQL 解析出的 schema；否则当前数据源默认 schema
  const sch = schema || metaSchemaArg(selectedDs.value) || ''
  try {
    if (node && !node.children) {
      node.loading = true
    }
    const cols = await fetchMetaColumns(form.datasourceId, sch, table)
    const list = Array.isArray(cols) ? cols : cols?.data || []
    const mapped = (list || []).map((c) => ({
      name: c.name,
      type: c.type,
      remarks: c.remarks || '',
      kind: 'column',
      schema: sch,
      table,
      sensitive: !!c.sensitive,
      maskedHint: c.maskedHint || '',
    }))
    if (node) {
      node.children = mapped
      node.expanded = true
      node.loading = false
    }
    return mapped
  } catch (e) {
    if (node) node.loading = false
    throw e
  }
}

function applyOutputNames(colsOrNames, { sourceHint = '' } = {}) {
  const rows = (colsOrNames || [])
    .map((c) => {
      if (typeof c === 'string') {
        const source = stripIdentQuotes(c)
        if (!source) return null
        return {
          source,
          name: applyNamingToOutputName(source),
          type: 'STRING',
          transform: 'none',
          remark: '',
        }
      }
      const source = stripIdentQuotes(c.name || c.enName || '')
      if (!source) return null
      return {
        source,
        name: applyNamingToOutputName(source),
        type: mapColTypeToOutput(c.type || c.dataType),
        transform: 'none',
        remark: c.remarks || c.comment || '',
      }
    })
    .filter(Boolean)
  if (!rows.length) return false
  const prevBySource = new Map()
  const prevByName = new Map()
  for (const o of form.outputs || []) {
    if (o.source) prevBySource.set(String(o.source), o)
    if (o.name) prevByName.set(String(o.name), o)
  }
  form.outputs = rows.map((r) => {
    const prev = prevBySource.get(r.source) || prevByName.get(r.name) || prevByName.get(r.source)
    if (!prev) return r
    return {
      source: r.source,
      name: prev.name || r.name,
      type: prev.type || r.type,
      transform: prev.transform || 'none',
      remark: prev.remark || r.remark,
    }
  })
  paramSide.value = 'out'
  dirty.value = true
  showToast(
    sourceHint ? `已识别 ${rows.length} 个出参（${sourceHint}）` : `已识别 ${rows.length} 个出参`,
    'success',
  )
  return true
}

/** 按当前命名策略重写出参名（保留源列与转换） */
function syncOutputNamesToStrategy() {
  if (!form.outputs?.length) {
    showToast('暂无出参', 'warning')
    return
  }
  let n = 0
  form.outputs = form.outputs.map((o) => {
    const base = o.source || o.name
    const next = applyNamingToOutputName(base)
    if (next && next !== o.name) n += 1
    return { ...o, name: next || o.name }
  })
  dirty.value = true
  showToast(n ? `已按 ${form.namingStrategy || 'CAMEL_CASE'} 同步 ${n} 个出参名` : '出参名已与策略一致', 'success')
}

/** 将映射表中的改名/删列写回当前窗口 SELECT（类型转换仍仅预览） */
function applyOutputsToSql() {
  if (form.engine !== 'SQL') {
    showToast('仅 SQL 引擎可写回 SELECT 列别名', 'warning')
    return
  }
  const kept = (form.outputs || []).filter(
    (o) => o.transform !== 'drop' && String(o.source || o.name || '').trim(),
  )
  if (!kept.length) {
    showToast('请先配置映射表中非「丢弃」的字段', 'warning')
    return
  }
  const sql = String(activeSql.value || '')
  const m = sql.match(/^([\s\S]*?\bselect\b)([\s\S]+?)(\bfrom\b[\s\S]*)$/i)
  if (!m) {
    showToast('当前 SQL 无法改写 SELECT 列表', 'warning')
    return
  }
  if (selectListIsStar(m[2])) {
    showToast('SELECT * 请先「出参解析」再应用到 SQL，或手写列清单', 'warning')
    return
  }
  const d = sqlDialect.value
  const selectParts = kept.map((o) => {
    const src = stripIdentQuotes(o.source || o.name)
    const alias = String(o.name || applyNamingToOutputName(src)).trim()
    const srcExpr = /^[A-Za-z_\u4e00-\u9fa5][\w$]*$/.test(src) ? quoteIdent(src, d) : src
    if (!alias || alias === src) return srcExpr
    return `${srcExpr} AS ${quoteIdent(alias, d)}`
  })
  activeSql.value = `${m[1].replace(/\s+$/, '')} ${selectParts.join(', ')} ${m[3].replace(/^\s+/, '')}`
  form.outputs = form.outputs.map((o) => {
    if (o.transform === 'drop') return o
    const alias = String(o.name || '').trim()
    if (!alias) return o
    return {
      ...o,
      source: alias,
      transform: o.transform === 'alias' ? 'none' : o.transform,
    }
  })
  dirty.value = true
  showToast('已写回 SELECT 别名；分转元等转换仅调试预览生效', 'success')
}

function mappingFieldsForPreview() {
  return (form.outputs || [])
    .filter((o) => String(o.name || '').trim())
    .map((o) => ({
      source: String(o.source || o.name).trim(),
      name: String(o.name).trim(),
      type: o.type,
      transform: o.transform || 'none',
    }))
}

function shouldPreviewOutputMapping() {
  return mappingFieldsForPreview().length > 0
}

/** 调试样例按映射表投影/转换（不改变 Gateway 运行时） */
function applyMappingToSample(sample) {
  const fields = mappingFieldsForPreview()
  if (!fields.length || sample == null) return sample
  const mapRows = (rows) =>
    (rows || []).map((r) => (r && typeof r === 'object' && !Array.isArray(r) ? mapResponseRow(r, fields) : r))

  if (Array.isArray(sample)) return mapRows(sample)
  if (typeof sample !== 'object') return sample

  const out = { ...sample }
  if (Array.isArray(out.data)) {
    out.data = mapRows(out.data)
    out._mappingPreview = true
    return out
  }
  if (out.data && typeof out.data === 'object' && Array.isArray(out.data.data)) {
    out.data = { ...out.data, data: mapRows(out.data.data) }
    out._mappingPreview = true
    return out
  }
  if (out.data && typeof out.data === 'object' && !Array.isArray(out.data)) {
    const row = out.data
    const hit = fields.some((f) => f.source in row || f.name in row)
    if (hit) {
      out.data = mapResponseRow(row, fields)
      out._mappingPreview = true
    }
    return out
  }
  const hitTop = fields.some((f) => f.source in out || f.name in out)
  if (hitTop && !('ok' in out && 'sample' in out)) {
    return { ...mapResponseRow(out, fields), _mappingPreview: true }
  }
  return sample
}

async function inferOutputs() {
  const sql = String(activeSql.value || '')
  const m = sql.match(/\bselect\b([\s\S]+?)\bfrom\b/i)
  if (!m) {
    showToast('未识别到 SELECT 列，请手动添加出参', 'warning')
    return
  }
  const body = m[1].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')

  if (selectListIsStar(body)) {
    const ref = extractPrimaryFromTable(sql)
    if (!ref?.table) {
      showToast('SELECT * 未识别到 FROM 表名，请展开左侧表后重试或手动添加出参', 'warning')
      return
    }
    if (!form.datasourceId) {
      showToast('请先选择数据源，以便从元数据推断列', 'warning')
      return
    }
    try {
      const cols = await loadColumnsForTable(ref.schema, ref.table)
      if (!cols.length) {
        showToast(
          `表 ${ref.schema ? `${ref.schema}.` : ''}${ref.table} 暂无列元数据，请在左侧展开该表加载列后再解析`,
          'warning',
        )
        return
      }
      applyOutputNames(cols, {
        sourceHint: `元数据 ${ref.schema ? `${ref.schema}.` : ''}${ref.table}`,
      })
    } catch (e) {
      showToast(`推断列失败：${e?.message || e}`, 'warning')
    }
    return
  }

  const parts = []
  let depth = 0
  let buf = ''
  for (const ch of body) {
    if (ch === '(') depth += 1
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      parts.push(buf)
      buf = ''
    } else {
      buf += ch
    }
  }
  if (buf.trim()) parts.push(buf)
  const names = parts
    .map((part) => {
      const text = part.trim().replace(/[`"]/g, '')
      const alias = text.match(/\bas\s+([A-Za-z_][\w]*)$/i)
      if (alias) return alias[1]
      const ident = text.match(/([A-Za-z_][\w]*)$/)
      return ident ? ident[1] : ''
    })
    .filter(Boolean)
  if (!names.length) {
    showToast('未识别到出参列', 'warning')
    return
  }
  applyOutputNames(names)
}

function removeOutput(i) {
  form.outputs.splice(i, 1)
  dirty.value = true
}

function setEngine(engine) {
  if (form.engine === engine) return
  const from = form.engine
  form.engine = engine
  onEngineChange(from)
}

function removeParam(i) {
  form.params.splice(i, 1)
  dirty.value = true
}

const LOCATIONS = [
  { value: 'REQUEST_BODY', label: 'body' },
  { value: 'REQUEST_FORM', label: 'query' },
  { value: 'REQUEST_HEADER', label: 'header' },
]
const PARAM_TYPES = [
  { value: 'string', label: '字符串' },
  { value: 'int', label: '整数' },
  { value: 'number', label: '数值' },
  { value: 'date', label: '日期' },
  { value: 'bool', label: '布尔' },
]
const OUTPUT_TYPES = ['STRING', 'LONG', 'DOUBLE', 'DATE', 'BOOLEAN', 'OBJECT']

/** 门户入参类型；空/未知默认 string，保证 trial 透传 SQLREST STRING */
function normalizePortalParamType(type) {
  const t = String(type || 'string')
    .trim()
    .toLowerCase()
  if (!t) return 'string'
  if (t === 'long' || t === 'integer') return 'int'
  if (t === 'double' || t === 'float' || t === 'decimal') return 'number'
  if (t === 'boolean') return 'bool'
  if (t === 'timestamp' || t === 'datetime' || t === 'time') return 'date'
  if (PARAM_TYPES.some((x) => x.value === t)) return t
  return 'string'
}

function ensureParamTypes() {
  for (const p of form.params || []) {
    p.type = normalizePortalParamType(p.type)
  }
}

/** 用户确认后，对当前 SQL 窗口中 concat/LIKE 场景的裸占位符加 ::text */
function applyPgTextCastAssist() {
  if (!isPgDialect.value) return
  const next = applyPgParamTextCasts(activeSql.value)
  if (next === activeSql.value) {
    showToast('当前语句无需改写，或已含 :: 类型', 'info')
    return
  }
  activeSql.value = next
  dirty.value = true
  showToast('已为裸 #{param} 追加 ::text，请再试跑', 'success')
}

const DEFAULT_TYPE_FORMATS = [
  { key: 'DATE', value: 'yyyy-MM-dd', remark: 'DATE（日期）' },
  { key: 'LOCAL_DATE', value: 'yyyy-MM-dd', remark: 'LOCAL_DATE' },
  { key: 'TIME', value: 'HH:mm:ss', remark: 'TIME（时间）' },
  { key: 'LOCAL_DATE_TIME', value: 'yyyy-MM-dd HH:mm:ss', remark: 'LOCAL_DATE_TIME' },
  { key: 'TIMESTAMP', value: 'yyyy-MM-dd HH:mm:ss', remark: 'TIMESTAMP' },
  { key: 'BIG_DECIMAL', value: '6', remark: 'BIG_DECIMAL（小数位）' },
]

/** SQLREST DataTypeFormatEnum 合法键；历史 java.sql.* 类名映射过来 */
const FORMAT_ENUM_KEYS = new Set([
  'USE_SYSTEM_RESPONSE_FORMAT',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'LOCAL_DATE',
  'LOCAL_DATE_TIME',
  'BIG_DECIMAL',
])

const LEGACY_FORMAT_KEY_MAP = {
  'java.sql.Date': 'DATE',
  'java.sql.Time': 'TIME',
  'java.sql.Timestamp': 'TIMESTAMP',
  'java.time.LocalDate': 'LOCAL_DATE',
  'java.time.LocalDateTime': 'LOCAL_DATE_TIME',
  'java.math.BigDecimal': 'BIG_DECIMAL',
}

function normalizeFormatKey(raw) {
  const k = String(raw || '').trim()
  if (!k) return ''
  if (FORMAT_ENUM_KEYS.has(k)) return k
  if (LEGACY_FORMAT_KEY_MAP[k]) return LEGACY_FORMAT_KEY_MAP[k]
  const upper = k.toUpperCase().replace(/\./g, '_').replace(/^JAVA_SQL_/, '').replace(/^JAVA_TIME_/, '').replace(/^JAVA_MATH_/, '')
  if (FORMAT_ENUM_KEYS.has(upper)) return upper
  return ''
}

const pathPrefix = computed(() => {
  const gw = String(embed.value?.gateway || 'http://dev3.datagoo.cn:18091').replace(/\/$/, '')
  return `${gw}/api/`
})

const pathSuffix = computed({
  get() {
    return String(form.path || '').replace(/^\/?api\/?/, '')
  },
  set(v) {
    const s = String(v || '').replace(/^\/+/, '')
    form.path = `/api/${s}`
    dirty.value = true
  },
})

const typeFormatRows = computed(() => {
  const remote = options.value.typeFormats
  const rows = Array.isArray(remote) && remote.length ? remote : DEFAULT_TYPE_FORMATS
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const key = normalizeFormatKey(row.key || row.className || row.name || row.enum)
    if (!key || key === 'USE_SYSTEM_RESPONSE_FORMAT' || seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      label: row.remark || row.label || key,
      value: form.typeFormatValues[key] ?? row.value ?? row.format ?? '',
    })
  }
  // 远端若仍是旧类名且未映射出任何行，回落默认枚举
  if (!out.length) {
    return DEFAULT_TYPE_FORMATS.map((row) => ({
      key: row.key,
      label: row.remark,
      value: form.typeFormatValues[row.key] ?? row.value,
    }))
  }
  return out
})

/** 左侧已加载表名 +（已展开/缓存的）列名 → SqlEditor 补全；列用 table.col 便于匹配 */
const editorSuggests = computed(() => {
  const d = sqlDialect.value
  const list = []
  const seen = new Set()
  const push = (caption, insert) => {
    const key = `${caption}\0${insert}`
    if (!caption || seen.has(key)) return
    seen.add(key)
    list.push({ caption, insert })
  }
  for (const folder of objectNodes.value || []) {
    for (const tb of folder.children || []) {
      if (!tb?.name || (tb.kind !== 'table' && tb.kind !== 'view')) continue
      push(tb.name, quoteQualified(tb.schema, tb.name, d))
      // children === null 表示尚未拉列，只补表名
      if (!Array.isArray(tb.children)) continue
      for (const col of tb.children) {
        if (!col?.name || col.kind === 'folder') continue
        const colInsert = quoteIdent(col.name, d)
        push(`${tb.name}.${col.name}`, colInsert)
      }
    }
  }
  // SQLREST 远端 snippets（若有）
  for (const c of options.value.completions || []) {
    if (typeof c === 'string') push(c, c)
    else if (c?.caption || c?.insert) push(c.caption || c.insert, c.insert || c.caption)
  }
  return list
})

function setTypeFormat(key, value) {
  form.typeFormatValues[key] = value
  dirty.value = true
}

function formatMapOf() {
  const rows = [
    {
      key: 'USE_SYSTEM_RESPONSE_FORMAT',
      value: String(!!form.useSystemFormat),
      remark: 'Response format',
    },
  ]
  const seen = new Set(['USE_SYSTEM_RESPONSE_FORMAT'])
  for (const row of typeFormatRows.value) {
    const key = normalizeFormatKey(row.key)
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push({
      key,
      value: form.typeFormatValues[row.key] ?? form.typeFormatValues[key] ?? row.value ?? '',
      remark: row.label || key,
    })
  }
  return rows
}

function buildPayload() {
  const ctx = contextListOf()
  ensureParamTypes()
  return {
    id: form.id || undefined,
    name: form.name,
    publicPath: form.path?.startsWith('/') ? form.path : `/${form.path || 'api/custom'}`,
    method: form.method || 'GET',
    contentType: form.contentType,
    sourceKind: form.sourceKind || 'sql',
    sourceRef: form.sourceRef || undefined,
    portalDsId: form.datasourceId,
    dsId: form.datasourceId,
    sql: ctx[0] || '',
    contextList: ctx,
    engine: form.engine || 'SQL',
    params: (form.params || []).map((p) => ({
      ...p,
      type: normalizePortalParamType(p.type),
    })),
    outputs: (form.outputs || [])
      .filter((o) => String(o.name || '').trim() && o.transform !== 'drop')
      .map((o) => ({
        name: String(o.name).trim(),
        type: o.type || 'STRING',
        remark: o.remark || '',
      })),
    responses: (form.outputs || [])
      .filter((o) => String(o.name || o.source || '').trim())
      .map((o) => ({
        source: String(o.source || o.name).trim(),
        name: String(o.name || o.source).trim(),
        type: o.type || 'STRING',
        transform: o.transform || 'none',
        remark: o.remark || '',
      })),
    description: form.description || form.name,
    open: form.open,
    alarm: !!form.alarm,
    namingStrategy: form.namingStrategy,
    formatMap: formatMapOf(),
    responseFormat: form.useSystemFormat ? 'wrapped' : 'origin',
    moduleId: form.moduleId != null && form.moduleId !== '' ? Number(form.moduleId) || form.moduleId : undefined,
    groupId: form.groupId != null && form.groupId !== '' ? Number(form.groupId) || form.groupId : undefined,
    cacheKeyType: form.cacheKeyType,
    cacheKeyExpr: form.cacheKeyType === 'SpEL' ? form.cacheKeyExpr : '',
    cacheExpireSeconds: form.cacheKeyType === 'NONE' ? 0 : Number(form.cacheExpireSeconds) || 0,
    flowStatus: form.flowStatus,
    flowGrade: Number(form.flowGrade) || 1,
    flowCount: Number(form.flowCount) || 5,
    qpsLimit: Number(form.qps) || 100,
    burstLimit: Number(form.burst) || 200,
    ownerUser: form.owner,
    domainCode: form.domain,
  }
}

function validate() {
  if (!form.name?.trim()) return '请填写 API 名称'
  if (!form.path?.trim()) return '请填写路径'
  if (!form.datasourceId) return '请选择已投影且有权的数据源'
  if (!contextListOf().length) return '请至少填写一个 SQL 窗口'
  if (form.cacheKeyType === 'SpEL' && !String(form.cacheKeyExpr || '').trim()) return 'SpEL 缓存须填写表达式'
  if (form.flowStatus && Number(form.flowCount) < 1) return '开启流控时阈值须 ≥ 1'
  return ''
}

async function save() {
  const err = validate()
  if (err) {
    showToast(err, 'warning')
    return null
  }
  saving.value = true
  try {
    const res = await buildDataapi(buildPayload())
    const binding = res?.binding
    // 门户草稿落库即成功；SQLREST 失败用 degraded，不因 ok/sqlrest 失败丢掉 id
    if (binding?.id) form.id = binding.id
    if (!binding?.id) {
      throw new Error(res?.sqlrest?.message || res?.message || '保存失败：未返回绑定 id')
    }
    dirty.value = false
    if (res?.degraded || res?.sqlrestOk === false) {
      showToast(
        `草稿已保存（id=${binding.id}），但 SQLREST 同步失败：${res?.sqlrest?.message || binding.lastError || '请检查 Manager'}`,
        'warning',
      )
    } else {
      showToast(`已保存草稿${form.id ? ` · ${form.id.slice(-6)}` : ''}`, 'success')
    }
    return binding
  } catch (e) {
    showToast(`保存失败：${e?.message || e}`, 'warning')
    return null
  } finally {
    saving.value = false
  }
}

async function doDebug() {
  const err = validate()
  if (err) {
    showToast(err, 'warning')
    return
  }
  ensureParamTypes()
  testing.value = true
  debugOpen.value = true
  try {
    const rawActive = String(activeSql.value || '')
    const strippedLimit = form.engine === 'SQL' && sqlHasTrailingLimit(rawActive)
    const ctx = contextListOf({ trial: true })
    const res = await runTrial({
      ...form,
      sql: ctx[0],
      contextList: ctx,
      params: (form.params || []).map((p) => ({
        ...p,
        type: normalizePortalParamType(p.type),
      })),
      portalDsId: form.datasourceId,
      responseFormat: form.useSystemFormat ? 'wrapped' : 'origin',
    })
    const rawSample = res?.sample ?? res?.data?.answer ?? res?.data
    const mappedSample = shouldPreviewOutputMapping() ? applyMappingToSample(rawSample) : rawSample
    form.testResult = {
      ok: !!(res?.ok || rawSample != null),
      sample: mappedSample,
      mappingPreview: !!(mappedSample && mappedSample !== rawSample && mappedSample?._mappingPreview),
      logs: res?.logs,
      message: res?.message,
      hint: res?.hint,
      sqlPreview: res?.sqlPreview,
      contextCount: res?.contextCount ?? ctx.length,
      degraded: !!res?.degraded,
    }
    form.tested = form.testResult.ok
    if (strippedLimit) {
      showToast('已自动去掉末尾 LIMIT/分号（SQLREST 会自动分页）', 'info')
    }
    if (form.testResult.ok) {
      showToast('调试成功', 'success')
    } else {
      const failMsg = res?.message || ''
      showToast(`调试失败：${failMsg}`, 'warning')
      if (res?.hint) {
        showToast(res.hint, 'info')
      } else if (/could not determine data type/i.test(failMsg)) {
        showToast(
          'PostgreSQL：请将 concat/LIKE 中的 #{name} 改为 #{name}::text（可用「加 ::text」）',
          'info',
        )
      } else if (/syntax error at or near ["']?LIMIT/i.test(failMsg)) {
        showToast('请去掉末尾 LIMIT/分号；多窗口时确认当前窗口是完整 SELECT', 'info')
      }
    }
  } catch (e) {
    const msg = e?.message || String(e)
    form.testResult = { ok: false, message: msg }
    form.tested = false
    showToast(`调试失败：${msg}`, 'warning')
    if (/could not determine data type/i.test(msg) && isPgDialect.value) {
      showToast('PostgreSQL：请将 #{name} 改为 #{name}::text，或点「加 ::text」后再试', 'info')
    }
  } finally {
    testing.value = false
  }
}

async function submitPublishApply() {
  // 申请须有绑定 id：有未保存变更或无 id 时先落草稿（与审批无关）
  if (dirty.value || !form.id) {
    const binding = await save()
    if (!binding?.id && !form.id) return
  }
  const id = form.id
  try {
    const t = await createApplyTicket({
      ticketType: 'api_publish',
      title: `API 发布 · ${form.name || form.path}`,
      reason: form.description || '数据服务发布审批',
      apiBindingId: id,
      publicPath: form.path,
      method: form.method,
      expireLabel: '长期',
    })
    form.publishTicketNo = t?.ticketNo || t?.data?.ticketNo || form.publishTicketNo || ''
    form.publishTicketStatus = 'pending'
    showToast(
      form.publishTicketNo
        ? `已申请发布 ${form.publishTicketNo}（待审核）。通过后将自动上线，驳回则按意见重改`
        : '已提交发布申请，待审核通过后自动发布',
      'success',
    )
  } catch (e) {
    showToast(`提交申请失败：${e?.message || e}`, 'warning')
  }
}

async function refreshPublishTicket() {
  if (!form.id) {
    showToast('请先保存草稿', 'warning')
    return
  }
  try {
    const page = await pageMyTickets({ current: 1, size: 50, ticketType: 'api_publish' })
    const rows = page?.records || page?.rows || []
      const hit = rows.find((t) => {
      let payload = t.payload
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          payload = {}
        }
      }
      return payload?.apiBindingId === form.id || t.apiBindingId === form.id
    })
    if (!hit) {
      form.publishTicketStatus = ''
      showToast('尚未提交该 API 的发布申请', 'info')
      return
    }
    form.publishTicketNo = hit.ticketNo || form.publishTicketNo
    form.publishTicketStatus = hit.status || ''
    // 附带驳回原因便于提示
    if (hit.remark) form.publishTicketRemark = hit.remark
    else form.publishTicketRemark = ''
    if (hit.status === 'approved') {
      showToast(`发布单 ${hit.ticketNo} 已通过并应已自动上线；可用 Gateway 探针验证`, 'success')
    } else if (hit.status === 'pending') {
      showToast(`发布单 ${hit.ticketNo} 待审核（通过后自动发布）`, 'info')
    } else if (hit.status === 'rejected') {
      showToast(
        `发布单 ${hit.ticketNo} 已驳回${hit.remark ? `：${hit.remark}` : ''} · 请修改后重新「申请发布」`,
        'warning',
      )
    } else {
      showToast(`发布单 ${hit.ticketNo} 状态：${hit.status}`, 'warning')
    }
  } catch (e) {
    showToast(`查询申请失败：${e?.message || e}`, 'warning')
  }
}

async function saveAndPublish() {
  if (!form.tested) {
    showToast('发布前请先调试通过', 'warning')
    debugOpen.value = true
    return
  }
  publishing.value = true
  try {
    const binding = await save()
    if (!binding?.id) return
    if (binding.lastError || !binding.sqlrestApiId) {
      // detail card may not expose sqlrestApiId on binding from build response
    }
    if (form.publishTicketStatus === 'pending') {
      showToast('发布申请待审核中，通过后会自动上线；无需手动补发', 'warning')
      return
    }
    if (form.publishTicketStatus === 'rejected') {
      showToast('上一张发布单已驳回，请修改后重新「申请发布」', 'warning')
      return
    }
    const pub = await publishDataapi(binding.id, undefined, form.publishTicketNo || undefined)
    showToast(pub?.degraded ? `已发布（部分降级）` : '已发布', pub?.degraded ? 'warning' : 'success')
    emit('publish', pub?.binding || binding)
    close()
  } catch (e) {
    const msg = e?.message || String(e)
    if (/尚未通过审批|须先有已审批|发布须/.test(msg)) {
      showToast(`${msg}（可点「提交发布申请」或「刷新单号」）`, 'warning')
    } else {
      showToast(`发布失败：${msg}`, 'warning')
    }
  } finally {
    publishing.value = false
  }
}

async function doGatewayProbe() {
  try {
    debugOpen.value = true
    const res = await gatewayProbe(form.id ? { id: form.id } : { path: form.path, method: form.method })
    form.probeResult = res
    const detail = [res?.hint || res?.message, res?.suggestion].filter(Boolean).join(' · ')
    if (res?.ok) {
      showToast(`Gateway 探针成功 HTTP ${res.httpStatus} · ${res.latencyMs}ms`, 'success')
    } else {
      showToast(
        detail || `Gateway 探针失败${res?.httpStatus != null ? ` HTTP ${res.httpStatus}` : ''}`,
        'warning',
      )
    }
  } catch (e) {
    showToast(`Gateway 探针失败：${e?.message || e}`, 'warning')
  }
}

function close() {
  if (dirty.value && !confirm('有未保存变更，确认关闭？')) return
  emit('close')
}

function refreshMeta() {
  if (form.datasourceId) loadObjects(form.datasourceId)
}

/** 指标 {{dt}} → SQLREST #{dt}；dim.x → dim_x */
function toSqlrestPlaceholders(sql) {
  return String(sql || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => `#{${String(k).replace(/\./g, '_')}}`)
}

function closeTplPicker() {
  tplOpen.value = false
  tplLoading.value = false
  tplApplying.value = false
  tplOptions.value = []
  tplSelected.value = ''
  tplPreview.value = ''
  tplHint.value = ''
  tplPortalDsId.value = ''
}

async function openTplPicker(kind) {
  moreOpen.value = false
  tplKind.value = kind
  tplOpen.value = true
  tplSelected.value = ''
  tplPreview.value = ''
  tplHint.value =
    kind === 'metric'
      ? '编译口径 SQL（Trino）写入当前窗口；binding.sourceKind=metric。'
      : '按资产 schema 生成 SELECT 模板；binding.sourceKind=asset。'
  tplLoading.value = true
  try {
    if (kind === 'metric') {
      const page = await fetchMetricList({ status: 'active' }, { current: 1, size: 200 })
      const rows = page?.records || page?.rows || (Array.isArray(page) ? page : [])
      tplOptions.value = rows
        .map((m) => {
          const code = m.metricCode || m.code || m.id
          if (!code) return null
          const name = m.name || code
          const kindLabel = m.kind || m.type || ''
          return {
            value: code,
            label: `${code} · ${name}`,
            sub: [kindLabel, m.domain || m.domainCode, m.status].filter(Boolean).join(' · '),
            search: [code, name, kindLabel, m.domain, m.domainCode].filter(Boolean).join(' '),
            name,
            domain: m.domain || m.domainCode || '',
          }
        })
        .filter(Boolean)
    } else {
      const page = await fetchAssetPage({}, { current: 1, size: 300 })
      const rows = (page?.records || []).filter((r) => {
        const st = String(r.status || 'active').toLowerCase()
        return st !== 'archived' && st !== 'deleted'
      })
      tplOptions.value = rows
        .map((a) => {
          const id = a.id
          if (!id) return null
          const table = bindTableKeyOf(a)
          const code = a.assetCode || a.key || id
          const name = a.cnName || a.name || code
          return {
            value: id,
            label: `${code} · ${name}`,
            sub: [table, a.layer || a.layerLabel, a.domain || a.domainCode].filter(Boolean).join(' · '),
            search: [code, name, table, a.omFqn, a.objectName].filter(Boolean).join(' '),
            assetCode: code,
            name,
            table,
            objectName: a.objectName || table,
            domain: a.domain || a.domainCode || '',
          }
        })
        .filter(Boolean)
    }
    if (!tplOptions.value.length) {
      showToast(kind === 'metric' ? '暂无可用指标' : '暂无可用资产', 'warning')
    }
  } catch (e) {
    showToast(`加载失败：${e?.message || e}`, 'warning')
    tplOptions.value = []
  } finally {
    tplLoading.value = false
  }
}

async function onTplSelect(val) {
  tplSelected.value = val
  tplPreview.value = ''
  tplPortalDsId.value = ''
  if (!val) return
  tplLoading.value = true
  try {
    if (tplKind.value === 'metric') {
      const meta = await compileMetric({ metricCode: val, dialect: 'trino' })
      const sql = meta?.sqlText || meta?.sql || ''
      if (!sql) throw new Error('编译结果无 sqlText')
      tplPreview.value = toSqlrestPlaceholders(sql)
      const ver = meta?.ver ? ` · ${meta.ver}` : ''
      tplHint.value = `已编译 ${meta?.metricCode || val}${ver}（dialect=${meta?.dialect || 'trino'}）；占位符已转为 SQLREST #{…}`
    } else {
      const [schema, sources] = await Promise.all([
        fetchAssetSchema(val),
        fetchAssetSources(val).catch(() => []),
      ])
      const opt = tplOptions.value.find((o) => o.value === val)
      const cols = Array.isArray(schema?.columns) ? schema.columns : []
      const colNames = cols
        .map((c) => (typeof c === 'string' ? c : c?.name || c?.enName || ''))
        .filter(Boolean)
      const table =
        schema?.objectName ||
        schema?.qualifiedName ||
        opt?.objectName ||
        opt?.table ||
        'your_table'
      const d = sqlDialect.value
      const selectList = colNames.length
        ? colNames.map((n) => quoteIdent(n, d)).join(',\n  ')
        : '*'
      const fromPart = String(table).includes('.')
        ? String(table)
            .split('.')
            .map((p) => quoteIdent(p, d))
            .join('.')
        : quoteIdent(table, d)
      tplPreview.value = `SELECT\n  ${selectList}\nFROM ${fromPart}\nWHERE 1 = 1\nLIMIT #{limit}`
      const srcList = Array.isArray(sources) ? sources : sources?.data || []
      const primary = srcList.find((s) => s.linkRole === 'primary' || s.primary) || srcList[0]
      const dsId = primary?.dsId || primary?.datasourceId || ''
      if (dsId && projectedDs.value.some((x) => x.id === dsId)) {
        tplPortalDsId.value = dsId
        tplHint.value = `将写入 SQL 并绑定 sourceRef；可自动选中已投影源`
      } else if (schema?.hint) {
        tplHint.value = String(schema.hint)
      } else {
        tplHint.value = colNames.length
          ? `已生成 ${colNames.length} 列 SELECT；请确认数据源与方言`
          : '未取到列信息，已用 SELECT *；可先在资产中心 refresh'
      }
    }
  } catch (e) {
    showToast(`预览失败：${e?.message || e}`, 'warning')
    tplPreview.value = ''
  } finally {
    tplLoading.value = false
  }
}

async function applyTpl() {
  if (!tplSelected.value || !tplPreview.value) {
    showToast('请先选择并生成预览', 'warning')
    return
  }
  tplApplying.value = true
  try {
    const sql = tplPreview.value
    if (tplPortalDsId.value && projectedDs.value.some((x) => x.id === tplPortalDsId.value) && !form.datasourceId) {
      form.datasourceId = tplPortalDsId.value
    }
    if (form.engine !== 'SQL') setEngine('SQL')
    activeSql.value = sql.endsWith('\n') ? sql : `${sql}\n`
    tab.value = 'sql'
    if (tplKind.value === 'metric') {
      const opt = tplOptions.value.find((o) => o.value === tplSelected.value)
      form.sourceKind = 'metric'
      form.sourceRef = tplSelected.value
      if (!form.name?.trim()) form.name = opt?.name || tplSelected.value
      if (!form.path || form.path === '/api/') {
        form.path = `/api/metric/${String(tplSelected.value).toLowerCase()}`
      }
      if (opt?.domain && !form.domain) form.domain = opt.domain
    } else {
      const opt = tplOptions.value.find((o) => o.value === tplSelected.value)
      form.sourceKind = 'asset'
      form.sourceRef = opt?.assetCode || tplSelected.value
      if (!form.name?.trim()) form.name = opt?.name || form.sourceRef
      if (!form.path || form.path === '/api/') {
        const slug = String(form.sourceRef || 'asset')
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '_')
        form.path = `/api/asset/${slug}`
      }
      if (opt?.domain && !form.domain) form.domain = opt.domain
    }
    dirty.value = true
    closeTplPicker()
    showToast(
      form.sourceKind === 'metric'
        ? `已写入指标 SQL · sourceRef=${form.sourceRef}`
        : `已写入资产 SQL · sourceRef=${form.sourceRef}`,
      'success',
    )
    try {
      await parseParams({ quiet: true })
    } catch {
      /* soft */
    }
  } finally {
    tplApplying.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="wb-mask">
      <div class="wb">
        <header class="wb-header">
          <div>
            <div class="wb-title">构建 API{{ form.name ? ` · ${form.name}` : '' }}</div>
            <div class="wb-sub">
              元数据走平台 /lh/datasource/meta · 定义 SoT = SQLREST · 边缘默认 Gateway
              <template v-if="form.sourceKind && form.sourceKind !== 'sql'">
                · 来源 <code>{{ form.sourceKind }}</code>/<code>{{ form.sourceRef || '—' }}</code>
              </template>
            </div>
          </div>
          <div class="wb-actions">
            <div class="wb-more">
              <button type="button" class="btn btn-sm" @click.stop="moreOpen = !moreOpen">更多</button>
              <div v-if="moreOpen" class="wb-more-menu" @click.stop>
                <button type="button" class="wb-more-item" @click="openTplPicker('metric')">从指标生成 SQL</button>
                <button type="button" class="wb-more-item" @click="openTplPicker('asset')">从资产生成 SQL</button>
              </div>
            </div>
            <button type="button" class="btn btn-sm" @click="doGatewayProbe">Gateway 探针</button>
            <button type="button" class="btn btn-sm" @click="debugOpen = !debugOpen">调试</button>
            <button type="button" class="btn btn-sm btn-primary" :disabled="saving" @click="save">
              {{ saving ? '保存中…' : '保存' }}
            </button>
            <button type="button" class="btn btn-sm btn-primary" @click="submitPublishApply">申请发布</button>
            <button type="button" class="btn btn-sm" :disabled="publishing" :title="'异常补救：审批已通过但未上线时可用'" @click="saveAndPublish">
              {{ publishing ? '补发中…' : '手动补发' }}
            </button>
            <button type="button" class="btn btn-sm" @click="close">返回</button>
          </div>
        </header>

        <div
          ref="wbBodyRef"
          class="wb-body"
          :class="{ 'is-debug-dragging': debugDragging }"
          :style="debugOpen ? { '--wb-debug-w': debugWidth + 'px' } : undefined"
        >
          <aside class="wb-meta">
            <div class="meta-toolbar">
              <button type="button" class="btn btn-sm btn-primary" @click="refreshMeta">元数据查看</button>
            </div>
            <label class="meta-ds">
              <span>数据源</span>
              <select v-model="form.datasourceId" class="select" @change="markDirty">
                <option value="">选择已投影数据源</option>
                <option v-for="d in dsOptions" :key="d.id" :value="d.id">{{ d.label }}</option>
              </select>
            </label>
            <p v-if="!dsOptions.length" class="meta-empty">暂无已投影源。请先在数据源中心登记（登记会自动投影）。</p>
            <p v-else-if="selectedDs" class="meta-bound">
              当前库 <code>{{ selectedDs.database || selectedDs.databaseName || '连接默认' }}</code>
              · 方言 <code>{{ sqlDialect.family ? `${sqlDialect.label}（${sqlDialect.family}）` : sqlDialect.label }}</code>
            </p>
            <div v-if="metaLoading" class="meta-empty">加载表和视图…</div>
            <ul v-else-if="objectNodes.length" class="meta-tree">
              <li v-for="folder in objectNodes" :key="folder.name">
                <button type="button" class="meta-row folder" @click="folder.expanded = !folder.expanded">
                  <span>{{ folder.expanded ? '▾' : '▸' }}</span>
                  <span>{{ folder.name }}</span>
                  <span class="meta-hint">{{ (folder.children || []).length }}</span>
                </button>
                <ul v-if="folder.expanded" class="meta-children">
                  <li v-if="!(folder.children || []).length" class="meta-empty">暂无</li>
                  <li v-for="tb in folder.children || []" :key="tb.name">
                    <button
                      type="button"
                      class="meta-row"
                      @click="toggleTable(tb)"
                      @dblclick.stop="onDblclickNode(tb)"
                    >
                      <span>{{ tb.expanded ? '▾' : '▸' }}</span>
                      <span>{{ tb.name }}</span>
                      <span v-if="tb.loading" class="meta-hint">…</span>
                    </button>
                    <ul v-if="tb.expanded && tb.children" class="meta-children">
                      <li v-for="col in tb.children" :key="col.name">
                        <button
                          type="button"
                          class="meta-row col"
                          :class="{ 'is-sensitive': col.sensitive }"
                          :title="col.maskedHint || undefined"
                          @dblclick="onDblclickNode(col)"
                        >
                          {{ col.name }}<span class="meta-type">({{ col.type }})</span>
                          <span v-if="col.sensitive" class="meta-sensitive">敏感</span>
                        </button>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
            <p v-else-if="form.datasourceId" class="meta-empty">
              仅展示已入目录且有表读权限的对象
            </p>
          </aside>

          <main class="wb-main">
            <nav class="wb-tabs">
              <button
                v-for="t in TAB_IDS"
                :key="t.id"
                type="button"
                class="wb-tab"
                :class="{ active: tab === t.id }"
                @click="tab = t.id"
              >
                {{ t.label }}
              </button>
            </nav>

            <div v-show="tab === 'sql'" class="wb-panel sql-panel">
              <div class="sql-exec">
                <span class="exec-label">执行</span>
                <div class="seg">
                  <button type="button" :class="{ on: form.engine === 'SQL' }" @click="setEngine('SQL')">SQL语句</button>
                  <button type="button" :class="{ on: form.engine === 'GROOVY' }" @click="setEngine('GROOVY')">Groovy脚本</button>
                </div>
                <div class="stepper" title="调试超时（秒）">
                  <button type="button" @click="form.timeout = Math.max(1, Number(form.timeout) - 1); markDirty()">−</button>
                  <input v-model.number="form.timeout" class="input" type="number" min="1" @input="markDirty" />
                  <button type="button" @click="form.timeout = Number(form.timeout || 0) + 1; markDirty()">+</button>
                </div>
              </div>
              <div class="stmt-bar">
                <span class="exec-label">语句</span>
                <span v-if="form.engine === 'SQL'" class="dialect-tag" :title="sqlDialect.quoteHint">
                  {{ sqlDialect.family ? `${sqlDialect.label} · ${sqlDialect.family}` : sqlDialect.label }}
                </span>
                <button type="button" class="btn btn-sm btn-primary" @click="addSqlWindow">
                  {{ form.engine === 'GROOVY' ? '添加脚本窗口' : '添加SQL窗口' }}
                </button>
                <div class="dyn-tags">
                  <button
                    v-for="c in activeSnippets"
                    :key="c.caption"
                    type="button"
                    class="tag-btn"
                    :title="c.value"
                    @click="insertSnippet(c)"
                  >
                    {{ c.caption }}
                  </button>
                </div>
              </div>
              <div class="sql-tabs">
                <button
                  v-for="w in form.sqlWindows"
                  :key="w.key"
                  type="button"
                  class="sql-tab"
                  :class="{ active: form.activeSqlKey === w.key }"
                  @click="form.activeSqlKey = w.key"
                >
                  {{ w.title }}
                  <span v-if="form.sqlWindows.length > 1" class="sql-tab-x" @click.stop="removeSqlWindow(w.key)">×</span>
                </button>
              </div>
              <SqlEditor
                ref="sqlEditorRef"
                v-model="activeSql"
                compact
                :rows="10"
                default-editing
                :language="form.engine === 'GROOVY' ? 'groovy' : 'sql'"
                :dialect="selectedDs?.sqlrestType || selectedDs?.type || ''"
                :label="form.engine === 'GROOVY' ? 'Groovy' : '语句'"
                :placeholder="form.engine === 'GROOVY' ? '// groovy' : (sqlDialect.sql === false ? '此数据源不使用 SQL' : sqlDialect.sample)"
                :hint="editorHint"
                :suggests="editorSuggests"
              />
              <div class="param-split">
                <div class="param-side">
                  <button type="button" :class="{ on: paramSide === 'in' }" @click="paramSide = 'in'">入参</button>
                  <button type="button" :class="{ on: paramSide === 'out' }" @click="paramSide = 'out'">出参</button>
                </div>
                <div class="param-main">
                  <template v-if="paramSide === 'in'">
                    <div class="param-bar-actions">
                      <button type="button" class="btn btn-sm btn-primary" @click="parseParams()">入参解析</button>
                      <button type="button" class="btn btn-sm btn-primary" @click="addParam">添加入参</button>
                      <button type="button" class="btn btn-sm btn-primary" @click="addPageParams">分页参数</button>
                    </div>
                    <p class="tip param-parse-hint">从 SQL 中识别 <code>#{参数名}</code>（如 <code>WHERE id = #{id}</code>）。无占位符的固定 SQL 不会产生入参。</p>
                    <p v-if="isPgDialect" class="tip param-pg-hint">
                      PostgreSQL：<code>concat</code> / <code>LIKE</code> 中的绑定参数需显式类型，例如
                      <code>#{name}::text</code> 或 <code>CAST(#{name} AS text)</code>；入参类型请选「字符串」。
                      <button
                        v-if="pgNeedsTextCast"
                        type="button"
                        class="btn btn-sm"
                        @click="applyPgTextCastAssist"
                      >
                        一键加 ::text
                      </button>
                    </p>
                    <table class="data-table param-table">
                      <thead>
                        <tr>
                          <th>参数名</th>
                          <th>参数位置</th>
                          <th>参数类型</th>
                          <th>数组</th>
                          <th>必填</th>
                          <th>默认值</th>
                          <th>描述</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!form.params.length">
                          <td colspan="8" class="empty-cell">暂无入参 · 需要动态条件时写 #{name} 再点「入参解析」，或点「添加入参」</td>
                        </tr>
                        <tr v-for="(p, i) in form.params" :key="'p-' + i">
                          <td><input v-model="p.name" class="input" @input="markDirty" /></td>
                          <td>
                            <select v-model="p.location" class="select" @change="markDirty">
                              <option v-for="loc in LOCATIONS" :key="loc.value" :value="loc.value">{{ loc.label }}</option>
                            </select>
                          </td>
                          <td>
                            <select v-model="p.type" class="select" @change="markDirty">
                              <option v-for="tp in PARAM_TYPES" :key="tp.value" :value="tp.value">{{ tp.label }}</option>
                            </select>
                          </td>
                          <td class="center"><input v-model="p.isArray" type="checkbox" @change="markDirty" /></td>
                          <td class="center"><input v-model="p.required" type="checkbox" @change="markDirty" /></td>
                          <td><input v-model="p.defaultValue" class="input" @input="markDirty" /></td>
                          <td><input v-model="p.desc" class="input" @input="markDirty" /></td>
                          <td class="center">
                            <button type="button" class="icon-btn" title="删除" @click="removeParam(i)">🗑</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </template>
                  <template v-else>
                    <div class="param-bar-actions">
                      <button type="button" class="btn btn-sm btn-primary" @click="inferOutputs">出参解析</button>
                      <button type="button" class="btn btn-sm" @click="syncOutputNamesToStrategy">同步命名</button>
                      <button type="button" class="btn btn-sm" @click="applyOutputsToSql">应用到 SQL</button>
                      <button type="button" class="btn btn-sm btn-primary" @click="addOutput">添加出参</button>
                    </div>
                    <p class="tip param-parse-hint">
                      映射表：SQL 列 → 出参名 → 转换（可丢弃）。调试预览按此投影。改名/删列请点「应用到 SQL」写回
                      <code>AS</code> 后再保存发布，Gateway 才生效。分转元 / 类型强制等转换<strong>仅调试预览</strong>，运行时仍以 SQL 与 namingStrategy / formatMap 为准。
                      键名驼峰也可来自「出参格式 → 命名策略」；与源列不一致时点「同步命名」或重新「出参解析」。
                    </p>
                    <table class="data-table param-table resp-map-table">
                      <thead>
                        <tr>
                          <th>SQL 列</th>
                          <th>出参名</th>
                          <th>类型</th>
                          <th>转换</th>
                          <th>描述</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!form.outputs.length">
                          <td colspan="6" class="empty-cell">可从 SELECT 列解析；SELECT * 时按 FROM 表的元数据列推断</td>
                        </tr>
                        <tr v-for="(o, i) in form.outputs" :key="'o-' + i">
                          <td>
                            <input v-model="o.source" class="input" placeholder="exe_status" @input="markDirty" />
                          </td>
                          <td>
                            <input v-model="o.name" class="input" placeholder="exeStatus" @input="markDirty" />
                          </td>
                          <td>
                            <select v-model="o.type" class="select" @change="markDirty">
                              <option v-for="tp in OUTPUT_TYPES" :key="tp" :value="tp">{{ tp }}</option>
                            </select>
                          </td>
                          <td>
                            <select v-model="o.transform" class="select" @change="markDirty">
                              <option v-for="t in FIELD_TRANSFORM_OPTIONS" :key="t.value" :value="t.value">
                                {{ t.label }}
                              </option>
                            </select>
                          </td>
                          <td><input v-model="o.remark" class="input" @input="markDirty" /></td>
                          <td class="center">
                            <button type="button" class="icon-btn" title="删除" @click="removeOutput(i)">🗑</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </template>
                </div>
              </div>
            </div>

            <div v-show="tab === 'iface'" class="wb-panel form-grid">
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>路径</span>
                <div class="path-box">
                  <span class="path-prefix">{{ pathPrefix }}</span>
                  <input v-model="pathSuffix" class="input" placeholder="demo/list" />
                </div>
              </label>
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>方法</span>
                <select v-model="form.method" class="select" @change="markDirty">
                  <option value="">请选择</option>
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>DELETE</option>
                </select>
              </label>
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>名称</span>
                <input v-model="form.name" class="input" @input="markDirty" />
              </label>
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>类型</span>
                <select v-model="form.contentType" class="select" @change="markDirty">
                  <option value="">请选择</option>
                  <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                  <option value="application/json">application/json</option>
                </select>
              </label>
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>模块</span>
                <select v-model="form.moduleId" class="select" @change="markDirty">
                  <option
                    v-for="m in options.modules || []"
                    :key="'mod-' + m.id"
                    :value="m.id"
                  >
                    {{ m.name || m.id }}
                  </option>
                  <option
                    v-if="!(options.modules || []).length"
                    :value="options.defaultModuleId ?? 1"
                  >
                    默认模块 ({{ options.defaultModuleId ?? 1 }})
                  </option>
                </select>
              </label>
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>授权</span>
                <select v-model="form.groupId" class="select" @change="markDirty">
                  <option
                    v-for="g in options.authGroups || []"
                    :key="'grp-' + g.id"
                    :value="g.id"
                  >
                    {{ g.name || g.id }}
                  </option>
                  <option
                    v-if="!(options.authGroups || []).length"
                    :value="options.defaultGroupId ?? 1"
                  >
                    默认分组 ({{ options.defaultGroupId ?? 1 }})
                  </option>
                </select>
              </label>
              <label class="form-field wide">
                <span class="form-label">描述</span>
                <textarea v-model="form.description" class="input area" rows="4" @input="markDirty" />
              </label>
              <label class="form-field">
                <span class="form-label">负责人</span>
                <input v-model="form.owner" class="input" @input="markDirty" />
              </label>
              <label class="form-field">
                <span class="form-label">业务域</span>
                <input v-model="form.domain" class="input" @input="markDirty" />
              </label>
              <label class="form-field wide">
                <span class="form-label">发布单号（申请发布后自动回填）</span>
                <div class="ticket-row">
                  <input
                    v-model="form.publishTicketNo"
                    class="input"
                    placeholder="点「申请发布」自动回填"
                    @input="markDirty"
                  />
                  <button type="button" class="btn btn-sm" @click="refreshPublishTicket">刷新状态</button>
                </div>
                <p class="field-hint">
                  流程：① 保存 → ② 申请发布 → ③ 待审核 → ④ 通过后<strong>自动发布</strong>可调用 / 驳回则按意见重改再申请。
                  <template v-if="form.publishTicketStatus">
                    当前：<strong>{{ form.publishTicketStatus }}</strong>
                  </template>
                  <template v-if="form.publishTicketStatus === 'rejected' && form.publishTicketRemark">
                    · 驳回意见：{{ form.publishTicketRemark }}
                  </template>
                </p>
              </label>
              <p class="field-hint">
                模块 / 授权来自 SQLREST <code>module/listAll</code>、<code>group/listAll</code>；未拉到列表时回落
                <code>lh.sqlrest.default*</code>。路径前缀来自 Gateway。
              </p>
            </div>

            <div v-show="tab === 'output'" class="wb-panel format-panel">
              <label class="format-row">
                <span class="form-label">命名策略</span>
                <select v-model="form.namingStrategy" class="select" @change="markDirty">
                  <option v-for="n in options.namingStrategies || []" :key="n.key" :value="n.key">
                    [{{ n.key }}] {{ n.value || n.remark || '' }}
                  </option>
                  <option v-if="!(options.namingStrategies || []).length" value="CAMEL_CASE">[CAMEL_CASE] 属性名转换为驼峰命名</option>
                  <option v-if="!(options.namingStrategies || []).length" value="NONE">[NONE] 保持原名</option>
                  <option v-if="!(options.namingStrategies || []).length" value="SNAKE_CASE">[SNAKE_CASE] 下划线命名</option>
                </select>
              </label>
              <div class="format-block">
                <div class="form-label">数据格式</div>
                <div class="format-grid">
                  <label v-for="row in typeFormatRows" :key="row.key" class="format-item">
                    <span>{{ row.label }}</span>
                    <input
                      class="input"
                      :value="form.typeFormatValues[row.key] ?? row.value"
                      @input="setTypeFormat(row.key, $event.target.value)"
                    />
                  </label>
                </div>
              </div>
              <label class="format-row">
                <span class="form-label">响应格式：true = 返回 ResultEntity 格式，false = 只返回数据</span>
                <input
                  class="input format-bool"
                  :value="form.useSystemFormat ? 'true' : 'false'"
                  @change="form.useSystemFormat = $event.target.value !== 'false'; markDirty()"
                />
              </label>
            </div>

            <div v-show="tab === 'cache'" class="wb-panel">
              <label class="switch-row">
                <span>缓存方法</span>
                <select v-model="form.cacheKeyType" class="select cache-select" @change="markDirty">
                  <option value="NONE">禁用</option>
                  <option value="AUTO">AUTO</option>
                  <option value="SpEL">SpEL</option>
                </select>
              </label>
              <div v-if="form.cacheKeyType !== 'NONE'" class="form-grid cache-extra">
                <label v-if="form.cacheKeyType === 'SpEL'" class="form-field wide">
                  <span class="form-label">SpEL 表达式</span>
                  <input v-model="form.cacheKeyExpr" class="input" @input="markDirty" />
                </label>
                <label class="form-field">
                  <span class="form-label">过期秒数</span>
                  <input v-model.number="form.cacheExpireSeconds" class="input" type="number" min="0" @input="markDirty" />
                </label>
              </div>
            </div>

            <div v-show="tab === 'auth'" class="wb-panel">
              <div class="switch-row">
                <span>是否公开</span>
                <div class="sr-switch">
                  <span :class="{ on: !form.open }">关闭</span>
                  <button type="button" class="switch" :class="{ on: form.open }" @click="form.open = !form.open; markDirty()">
                    <i />
                  </button>
                  <span :class="{ on: form.open }">开启</span>
                </div>
              </div>
              <div class="auth-copy">
                <p class="field-hint">
                  <strong>SQLREST open</strong>：仅控制接口在 SQLREST 侧是否公开可见，<em>不等于</em>平台授权。
                </p>
                <p class="field-hint">
                  <strong>平台 ACL</strong>：谁能构建 / 发布 / 订阅由门户权限与申请中心工单决定（源级 grant、API Owner、订阅审批）。
                </p>
                <p class="field-hint">
                  <strong>调用鉴权</strong>：边缘仅 <strong>SQLREST Gateway</strong>；调用方持订阅签发的 API Key（Vault +
                  <code>dataapi_api_key_meta</code>）。本平台<strong>不做 APISIX</strong>，无独立网关路由配置页。
                </p>
                <p class="field-hint tip">订阅 Key：申请中心 →「API 订阅」工单审批通过后签发；可在数据服务 Key 列表查看元数据。</p>
              </div>
            </div>

            <div v-show="tab === 'alarm'" class="wb-panel">
              <div class="switch-row">
                <span>是否告警</span>
                <div class="sr-switch">
                  <span :class="{ on: !form.alarm }">关闭</span>
                  <button type="button" class="switch" :class="{ on: form.alarm }" @click="form.alarm = !form.alarm; markDirty()">
                    <i />
                  </button>
                  <span :class="{ on: form.alarm }">开启</span>
                </div>
              </div>
              <div class="auth-copy">
                <p class="field-hint">
                  本开关写入 SQLREST <code>assignment.alarm</code>，表示该接口是否参与 SQLREST 告警。
                </p>
                <p class="field-hint">
                  规则阈值、通知渠道等明细在 <strong>SQLREST Manager 告警配置</strong>中维护；门户不代理 APISIX / 第三方网关告警。
                </p>
                <p class="field-hint tip">运行面观测：Gateway 访问日志 + 后续调用大盘（E5）；与「是否告警」开关相互独立。</p>
              </div>
            </div>

            <div v-show="tab === 'flow'" class="wb-panel">
              <div class="switch-row">
                <span>是否控制流量</span>
                <div class="sr-switch">
                  <span :class="{ on: !form.flowStatus }">关闭</span>
                  <button
                    type="button"
                    class="switch"
                    :class="{ on: form.flowStatus }"
                    @click="form.flowStatus = !form.flowStatus; markDirty()"
                  >
                    <i />
                  </button>
                  <span :class="{ on: form.flowStatus }">开启</span>
                </div>
              </div>
              <div v-if="form.flowStatus" class="form-grid cache-extra">
                <label class="form-field">
                  <span class="form-label">流控等级</span>
                  <input v-model.number="form.flowGrade" class="input" type="number" min="1" @input="markDirty" />
                </label>
                <label class="form-field">
                  <span class="form-label">阈值</span>
                  <input v-model.number="form.flowCount" class="input" type="number" min="1" @input="markDirty" />
                </label>
                <label class="form-field">
                  <span class="form-label">边缘 QPS（Gateway）</span>
                  <input v-model.number="form.qps" class="input" type="number" min="1" @input="markDirty" />
                </label>
                <label class="form-field">
                  <span class="form-label">Burst</span>
                  <input v-model.number="form.burst" class="input" type="number" min="1" @input="markDirty" />
                </label>
              </div>
              <p class="field-hint">关闭时不启用 SQLREST 流控。边缘 QPS 写入绑定，由 Gateway / SQLREST 侧生效（不做 APISIX）。</p>
            </div>
          </main>

          <aside v-if="debugOpen" class="wb-debug">
            <div
              class="wb-debug-resizer"
              title="拖动调整宽度"
              @mousedown="startDebugResize"
            />
            <div class="debug-head">
              <strong>调试</strong>
              <button type="button" class="btn btn-sm" @click="doDebug" :disabled="testing">
                {{ testing ? '执行中…' : '▶ 执行' }}
              </button>
            </div>
            <p class="tip">{{ form.method }} {{ form.path }}</p>
            <div v-for="p in form.params" :key="'d-' + p.name" class="debug-param">
              <label>{{ p.name }}</label>
              <input v-model="p.example" class="input" placeholder="示例值" />
            </div>
            <p v-if="form.testResult?.mappingPreview" class="tip probe-hint">
              以下 sample 已按出参映射表投影/转换（仅调试预览；Gateway 需「应用到 SQL」或命名策略）
            </p>
            <pre v-if="form.testResult" class="sample-json">{{ JSON.stringify(form.testResult, null, 2) }}</pre>
            <p v-if="form.testResult?.hint" class="tip probe-hint">{{ form.testResult.hint }}</p>
            <pre v-if="form.testResult?.sqlPreview" class="sample-json sql-preview">{{ form.testResult.sqlPreview }}</pre>
            <div v-if="form.probeResult" class="probe-panel">
              <div class="probe-line">
                <span class="probe-k">探针</span>
                <code>{{ form.probeResult.method || form.method }}</code>
                <code class="probe-url">{{ form.probeResult.requestUrl || '—' }}</code>
              </div>
              <p v-if="form.probeResult.hint || form.probeResult.message" class="tip probe-hint">
                {{ form.probeResult.hint || form.probeResult.message }}
              </p>
              <p v-if="form.probeResult.suggestion" class="tip probe-suggest">
                建议：{{ form.probeResult.suggestion }}
              </p>
              <p v-if="form.probeResult.bindingState || form.probeResult.sqlrestOnline != null" class="tip">
                绑定 {{ form.probeResult.bindingState || '—' }}
                <template v-if="form.probeResult.sqlrestOnline != null">
                  · SQLREST {{ form.probeResult.sqlrestOnline ? 'online' : 'offline' }}
                </template>
                <template v-if="form.probeResult.httpStatus != null">
                  · HTTP {{ form.probeResult.httpStatus }} · {{ form.probeResult.latencyMs }}ms
                </template>
              </p>
              <pre class="sample-json">{{ JSON.stringify(form.probeResult, null, 2) }}</pre>
            </div>
          </aside>
        </div>
      </div>
    </div>

    <div v-if="tplOpen" class="tpl-mask" @click.self="closeTplPicker">
      <div class="tpl-modal" role="dialog" aria-modal="true">
        <div class="tpl-hd">
          <div>
            <div class="tpl-title">{{ tplKind === 'metric' ? '从指标生成 SQL' : '从资产生成 SQL' }}</div>
            <div class="tpl-sub">{{ tplHint }}</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeTplPicker">关闭</button>
        </div>
        <div class="tpl-bd">
          <label class="form-field">
            <span class="form-label">{{ tplKind === 'metric' ? '选择指标' : '选择资产' }}</span>
            <SearchSelect
              :model-value="tplSelected"
              :options="tplOptions"
              :placeholder="tplLoading ? '加载中…' : '搜索选择'"
              :disabled="tplLoading"
              search-keys="search,sub"
              @update:model-value="onTplSelect"
            />
          </label>
          <div v-if="tplPreview" class="tpl-preview">
            <div class="tpl-preview-label">SQL 预览</div>
            <pre>{{ tplPreview }}</pre>
          </div>
          <p v-else-if="tplLoading" class="tip">生成预览中…</p>
          <p v-else-if="form.sourceKind && form.sourceKind !== 'sql'" class="tip">
            当前绑定：{{ form.sourceKind }} / {{ form.sourceRef || '—' }}（应用后会覆盖）
          </p>
        </div>
        <div class="tpl-ft">
          <button type="button" class="btn btn-sm" @click="closeTplPicker">取消</button>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="tplApplying || !tplPreview"
            @click="applyTpl"
          >
            {{ tplApplying ? '写入中…' : '写入当前 SQL 窗口' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.wb-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  padding: 12px;
}
.wb {
  flex: 1;
  min-height: 0;
  background: var(--bg, #fff);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.wb-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.wb-title {
  font-size: 16px;
  font-weight: 600;
}
.wb-sub {
  font-size: 12px;
  color: var(--text-3, #94a3b8);
  margin-top: 2px;
}
.wb-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.wb-more {
  position: relative;
}
.wb-more-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  min-width: 168px;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  padding: 4px;
}
.wb-more-item {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text, #0f172a);
}
.wb-more-item:hover {
  background: var(--bg-2, #f1f5f9);
}
.auth-copy {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}
.auth-copy .field-hint {
  margin: 0;
  line-height: 1.5;
}
.auth-copy strong {
  font-weight: 600;
}
.tpl-mask {
  position: fixed;
  inset: 0;
  z-index: 1300;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.tpl-modal {
  width: min(640px, 100%);
  max-height: min(80vh, 720px);
  background: var(--bg, #fff);
  border-radius: 10px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tpl-hd,
.tpl-ft {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.tpl-ft {
  border-bottom: 0;
  border-top: 1px solid var(--border, #e5e7eb);
  justify-content: flex-end;
  align-items: center;
}
.tpl-title {
  font-size: 15px;
  font-weight: 600;
}
.tpl-sub {
  font-size: 12px;
  color: var(--text-3, #94a3b8);
  margin-top: 4px;
  line-height: 1.4;
}
.tpl-bd {
  padding: 12px 16px;
  overflow: auto;
  display: grid;
  gap: 12px;
}
.tpl-preview-label {
  font-size: 12px;
  color: var(--text-3, #94a3b8);
  margin-bottom: 6px;
}
.tpl-preview pre {
  margin: 0;
  padding: 10px;
  background: var(--bg-2, #f8fafc);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.45;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.wb-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 260px 1fr;
  grid-template-rows: 1fr;
}
.wb-body:has(.wb-debug) {
  grid-template-columns: 260px 1fr var(--wb-debug-w, 320px);
}
.wb-body.is-debug-dragging {
  cursor: col-resize;
  user-select: none;
}
.wb-meta {
  border-right: 1px solid var(--border, #e5e7eb);
  overflow: auto;
  padding: 10px;
  background: var(--bg-2, #f8fafc);
}
.meta-toolbar {
  margin-bottom: 8px;
}
.meta-ds {
  display: grid;
  gap: 4px;
  font-size: 12px;
  margin-bottom: 10px;
}
.meta-empty {
  font-size: 12px;
  color: var(--text-3, #94a3b8);
  padding: 8px 0;
}
.meta-bound {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-3, #94a3b8);
}
.meta-bound code {
  color: var(--text, #0f172a);
}
.meta-tree,
.meta-children {
  list-style: none;
  margin: 0;
  padding: 0;
}
.meta-children {
  padding-left: 12px;
}
.meta-row {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 4px 2px;
  font-size: 12px;
  cursor: pointer;
  color: inherit;
}
.meta-row:hover {
  background: color-mix(in srgb, var(--primary, #2563eb) 8%, transparent);
}
.meta-row.col {
  color: var(--text-2, #64748b);
}
.meta-row.col.is-sensitive {
  color: var(--warn, #b45309);
}
.meta-sensitive {
  margin-left: 6px;
  font-size: 10px;
  color: var(--warn, #b45309);
  opacity: 0.9;
}
.meta-type {
  margin-left: 4px;
  opacity: 0.7;
}
.meta-hint {
  opacity: 0.5;
}
.wb-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.wb-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.wb-tab {
  border: 0;
  background: transparent;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  color: var(--text-2, #64748b);
}
.wb-tab.active {
  background: color-mix(in srgb, var(--primary, #2563eb) 12%, transparent);
  color: var(--primary, #2563eb);
  font-weight: 600;
}
.wb-panel {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
}
.row-inline {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.dyn-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.sql-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.sql-tab {
  border: 1px solid var(--border, #e5e7eb);
  background: var(--bg, #fff);
  border-radius: 6px 6px 0 0;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.sql-tab.active {
  border-bottom-color: transparent;
  color: var(--primary, #2563eb);
  font-weight: 600;
}
.sql-tab-x {
  margin-left: 6px;
  opacity: 0.6;
}
.tag-btn {
  border: 1px solid var(--border, #e5e7eb);
  background: var(--bg, #fff);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}
.param-bar {
  margin: 10px 0 6px;
}
.param-bar-actions {
  display: flex;
  gap: 8px;
}
.param-table {
  width: 100%;
  font-size: 12px;
}
.empty-cell {
  text-align: center;
  color: var(--text-3, #94a3b8);
  padding: 16px !important;
}
.sql-exec,
.stmt-bar,
.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.exec-label {
  font-size: 13px;
  color: var(--text-2, #334155);
  min-width: 2em;
}
.dialect-tag {
  font-size: 12px;
  line-height: 1;
  padding: 3px 8px;
  border-radius: 999px;
  color: #1d4ed8;
  background: #dbeafe;
}
.seg {
  display: inline-flex;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}
.seg button {
  border: 0;
  background: #fff;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-2, #334155);
}
.seg button.on {
  background: var(--primary, #1677ff);
  color: #fff;
}
.stepper {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}
.stepper button {
  width: 28px;
  height: 28px;
  border: 0;
  background: #f8fafc;
  cursor: pointer;
}
.stepper input {
  width: 64px;
  border: 0;
  border-left: 1px solid var(--border, #e5e7eb);
  border-right: 1px solid var(--border, #e5e7eb);
  text-align: center;
  height: 28px;
}
.stmt-bar .dyn-tags {
  margin-left: auto;
}
.tag-btn {
  color: #5b4bdb;
  background: #f4f0ff;
  border-color: #ddd6fe;
}
.param-split {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  margin-top: 12px;
  min-height: 180px;
}
.param-side {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border, #e5e7eb);
}
.param-side button {
  border: 0;
  background: transparent;
  padding: 10px 8px;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-2, #64748b);
}
.param-side button.on {
  color: var(--primary, #1677ff);
  background: color-mix(in srgb, var(--primary, #1677ff) 8%, transparent);
  font-weight: 600;
}
.param-main {
  min-width: 0;
}
.center {
  text-align: center;
}
.icon-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
}
.path-box {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.path-prefix {
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-3, #64748b);
  white-space: nowrap;
  background: #f8fafc;
  align-self: stretch;
  display: flex;
  align-items: center;
}
.path-box .input {
  border: 0;
  border-radius: 0;
}
.req {
  color: #e11d48;
  margin-right: 2px;
}
.area {
  min-height: 88px;
  resize: vertical;
}
.format-panel {
  display: grid;
  gap: 16px;
  max-width: 720px;
}
.format-row,
.format-item {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
.format-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 8px;
}
.format-bool {
  max-width: 160px;
}
.cache-select {
  width: 220px;
}
.cache-extra {
  margin-top: 12px;
}
.sr-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-3, #94a3b8);
}
.sr-switch .on {
  color: var(--primary, #1677ff);
}
.switch {
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 0;
  background: #e5e7eb;
  position: relative;
  cursor: pointer;
  padding: 0;
}
.switch i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}
.switch.on {
  background: var(--primary, #1677ff);
}
.switch.on i {
  transform: translateX(16px);
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.ticket-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.ticket-row .input {
  flex: 1;
  min-width: 0;
}
.form-field.wide,
.form-field.check {
  grid-column: 1 / -1;
}
.form-field {
  display: grid;
  gap: 4px;
  font-size: 12px;
}
.form-field.check {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-label {
  color: var(--text-3, #94a3b8);
}
.field-hint {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--text-3, #94a3b8);
}
.wb-debug {
  position: relative;
  border-left: 1px solid var(--border, #e5e7eb);
  padding: 12px;
  overflow: auto;
  background: var(--bg-2, #f8fafc);
  min-width: 0;
}
.wb-debug-resizer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 2;
  touch-action: none;
}
.wb-debug-resizer::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 48px;
  border-radius: 1px;
  background: transparent;
  transition: background 0.15s;
}
.wb-debug-resizer:hover::after,
.wb-body.is-debug-dragging .wb-debug-resizer::after {
  background: var(--primary, #2563eb);
}
.debug-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.debug-param {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 12px;
}
.probe-panel {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}
.probe-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.probe-k {
  color: var(--text-3, #94a3b8);
}
.probe-url {
  word-break: break-all;
}
.probe-hint {
  color: var(--warning, #b45309);
}
.resp-map-table th:nth-child(4),
.resp-map-table td:nth-child(4) {
  min-width: 100px;
}
.probe-suggest {
  color: var(--text-2, #64748b);
}
.sample-json {
  margin-top: 10px;
  padding: 8px;
  background: var(--bg, #fff);
  border-radius: 6px;
  font-size: 11px;
  max-height: 360px;
  overflow: auto;
}
.sql-preview {
  max-height: 160px;
  white-space: pre-wrap;
  color: var(--text-2, #64748b);
}
.tip {
  font-size: 12px;
  color: var(--text-3, #94a3b8);
}
.param-pg-hint {
  margin: 6px 0 10px;
  line-height: 1.5;
}
.param-pg-hint .btn {
  margin-left: 8px;
  vertical-align: middle;
}
@media (max-width: 960px) {
  .wb-body,
  .wb-body:has(.wb-debug) {
    grid-template-columns: 1fr;
  }
  .wb-meta,
  .wb-debug {
    max-height: 220px;
  }
  .wb-debug-resizer {
    display: none;
  }
}
</style>
