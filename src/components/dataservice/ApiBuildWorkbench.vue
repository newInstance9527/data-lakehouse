<script setup>
import { computed, reactive, ref, watch } from 'vue'
import SqlEditor from '@/components/etl/SqlEditor.vue'
import { useToast } from '@/composables/useToast'
import { useDataservice } from '@/composables/useDataservice'
import {
  fetchMetaTables,
  fetchMetaViews,
  fetchMetaColumns,
} from '@/api/datasource.js'
import { parseDataapiParams, fetchSqlrestOptions, buildDataapi, publishDataapi, gatewayProbe } from '@/api/dataapi.js'
import { createApplyTicket } from '@/api/apply.js'
import { isDialectSample, quoteQualified, resolveSqlDialect } from '@/utils/sqlDialect'

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
const options = ref({ namingStrategies: [], typeFormats: [], completions: [] })

const form = reactive(emptyForm())
const objectNodes = ref([])
const metaLoading = ref(false)

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

watch(
  () => props.open,
  async (v) => {
    if (!v) return
    await ensureLoaded(true)
    Object.assign(form, emptyForm())
    objectNodes.value = []
    tab.value = 'sql'
    dirty.value = false
    debugOpen.value = false
    try {
      options.value = (await fetchSqlrestOptions()) || options.value
    } catch {
      /* soft */
    }
    if (props.editId) {
      await loadEdit(props.editId)
    }
  },
)

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
  const prefix = form.engine === 'GROOVY' ? 'Groovy窗口' : 'SQL窗口'
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

function contextListOf() {
  return form.sqlWindows.map((w) => w.sql || '').filter((s) => String(s).trim())
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
    form.publishTicketNo = d.publishTicketNo || ''
    if (Array.isArray(sr.params)) {
      form.params = sr.params.map((p) => ({
        name: p.name,
        type: String(p.type || 'STRING').toLowerCase(),
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
      for (const row of fm) {
        if (!row?.key || row.key === 'USE_SYSTEM_RESPONSE_FORMAT') continue
        form.typeFormatValues[row.key] = row.value ?? ''
      }
    }
    form.outputs = (Array.isArray(sr.outputs) ? sr.outputs : Array.isArray(d.outputs) ? d.outputs : []).map((o) => ({
      name: o.name || '',
      type: o.type || 'STRING',
      remark: o.remark || o.desc || '',
    }))
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
  if (d.fallback && !selectedDs.value) return `未选数据源，暂按 ${d.label} · ${d.quoteHint}`
  if (d.fallback) return `${name}${d.raw ? `（${d.raw}）` : ''} · ${d.quoteHint}`
  return `${name} · ${d.quoteHint} · Ctrl+Space 补全 · Ctrl+Shift+F 格式化 · 双击表列按当前方言插入`
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

function retitleWindows() {
  const prefix = form.engine === 'GROOVY' ? 'Groovy窗口' : 'SQL窗口'
  form.sqlWindows.forEach((w, i) => {
    w.title = `${prefix}(${i + 1})`
  })
}

function onEngineChange() {
  const cur = String(activeSql.value || '').trim()
  if (form.engine === 'GROOVY' && (!cur || cur === SQL_STUB)) {
    activeSql.value = `${GROOVY_STUB}\n`
  } else if (form.engine === 'SQL' && (!cur || cur === GROOVY_STUB)) {
    activeSql.value = SQL_STUB
  } else {
    showToast(form.engine === 'GROOVY' ? '已切换 Groovy，请按脚本语法编写' : '已切换 SQL', 'info')
  }
  retitleWindows()
  markDirty()
}

function insertText(text) {
  activeSql.value = (activeSql.value || '') + (activeSql.value?.endsWith('\n') || !activeSql.value ? '' : '\n') + text
  dirty.value = true
  tab.value = 'sql'
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

async function parseParams() {
  try {
    const sql = contextListOf().join('\n')
    const res = await parseDataapiParams({ sql, engine: form.engine })
    const list = res?.params || []
    if (!list.length) {
      showToast('未解析到入参', 'warning')
      return
    }
    const prev = new Map((form.params || []).map((p) => [p.name, p]))
    form.params = list.map((p) => {
      const old = prev.get(p.name)
      return (
        old || {
          name: p.name,
          type: p.type || 'string',
          location: form.method === 'GET' ? 'REQUEST_FORM' : 'REQUEST_BODY',
          required: !!p.required,
          isArray: !!p.isArray,
          defaultValue: '',
          example: '',
          desc: '',
        }
      )
    })
    dirty.value = true
    showToast(`已解析 ${form.params.length} 个入参`, 'success')
  } catch (e) {
    showToast(`解析失败：${e?.message || e}`, 'warning')
  }
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
  form.outputs.push({ name: '', type: 'STRING', remark: '' })
  paramSide.value = 'out'
  dirty.value = true
}

function inferOutputs() {
  const sql = String(activeSql.value || '')
  const m = sql.match(/\bselect\b([\s\S]+?)\bfrom\b/i)
  if (!m) {
    showToast('未识别到 SELECT 列，请手动添加出参', 'warning')
    return
  }
  const body = m[1].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
  if (body.includes('*')) {
    showToast('SELECT * 无法推断列，请手动添加出参', 'warning')
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
      const text = part.trim().replace(/`/g, '')
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
  const prev = new Map((form.outputs || []).map((o) => [o.name, o]))
  form.outputs = names.map((name) => prev.get(name) || { name, type: 'STRING', remark: '' })
  paramSide.value = 'out'
  dirty.value = true
  showToast(`已识别 ${names.length} 个出参`, 'success')
}

function removeOutput(i) {
  form.outputs.splice(i, 1)
  dirty.value = true
}

function setEngine(engine) {
  if (form.engine === engine) return
  form.engine = engine
  onEngineChange()
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
const DEFAULT_TYPE_FORMATS = [
  { key: 'java.sql.Date', value: 'yyyy-MM-dd', remark: 'java.sql.Date' },
  { key: 'java.time.LocalDate', value: 'yyyy-MM-dd', remark: 'java.time.LocalDate' },
  { key: 'java.sql.Time', value: 'HH:mm:ss', remark: 'java.sql.Time' },
  { key: 'java.time.LocalDateTime', value: 'yyyy-MM-dd HH:mm:ss', remark: 'java.time.LocalDateTime' },
  { key: 'java.sql.Timestamp', value: 'yyyy-MM-dd HH:mm:ss', remark: 'java.sql.Timestamp' },
  { key: 'java.math.BigDecimal', value: '6', remark: 'java.math.BigDecimal' },
]

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
  return rows
    .map((row) => {
      const key = row.key || row.className || row.name
      if (!key) return null
      return {
        key,
        label: row.remark || row.className || row.label || key,
        value: form.typeFormatValues[key] ?? row.value ?? row.format ?? '',
      }
    })
    .filter(Boolean)
})

const editorSuggests = computed(() => {
  const list = []
  for (const folder of objectNodes.value || []) {
    for (const tb of folder.children || []) {
      if (!tb?.name || tb.kind === 'folder') continue
      const qualified = quoteQualified(tb.schema, tb.name, sqlDialect.value)
      list.push({ caption: tb.name, insert: qualified })
      for (const col of tb.children || []) {
        if (col?.name) list.push({ caption: col.name, insert: quoteQualified('', col.name, sqlDialect.value) })
      }
    }
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
  for (const row of typeFormatRows.value) {
    rows.push({
      key: row.key,
      value: form.typeFormatValues[row.key] ?? row.value ?? '',
      remark: row.label,
    })
  }
  return rows
}

function buildPayload() {
  const ctx = contextListOf()
  return {
    id: form.id || undefined,
    name: form.name,
    publicPath: form.path?.startsWith('/') ? form.path : `/${form.path || 'api/custom'}`,
    method: form.method || 'GET',
    contentType: form.contentType,
    sourceKind: 'sql',
    portalDsId: form.datasourceId,
    dsId: form.datasourceId,
    sql: ctx[0] || '',
    contextList: ctx,
    engine: form.engine || 'SQL',
    params: form.params,
    outputs: (form.outputs || []).filter((o) => String(o.name || '').trim()).map((o) => ({
      name: String(o.name).trim(),
      type: o.type || 'STRING',
      remark: o.remark || '',
    })),
    description: form.description || form.name,
    open: form.open,
    alarm: !!form.alarm,
    namingStrategy: form.namingStrategy,
    formatMap: formatMapOf(),
    responseFormat: form.useSystemFormat ? 'wrapped' : 'origin',
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
    if (res?.ok === false) {
      throw new Error(res?.sqlrest?.message || res?.binding?.lastError || '保存失败')
    }
    const binding = res?.binding
    if (binding?.id) form.id = binding.id
    dirty.value = false
    showToast(res?.degraded ? `已保存（降级）：${res?.sqlrest?.message || ''}` : '已保存草稿', res?.degraded ? 'warning' : 'success')
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
  testing.value = true
  debugOpen.value = true
  try {
    const ctx = contextListOf()
    const res = await runTrial({
      ...form,
      sql: ctx[0],
      contextList: ctx,
      portalDsId: form.datasourceId,
      responseFormat: form.useSystemFormat ? 'wrapped' : 'origin',
    })
    form.testResult = {
      ok: !!(res?.ok || res?.sample != null),
      sample: res?.sample ?? res?.data?.answer ?? res?.data,
      logs: res?.logs,
      message: res?.message,
      degraded: !!res?.degraded,
    }
    form.tested = form.testResult.ok
    showToast(form.testResult.ok ? '调试成功' : `调试失败：${res?.message || ''}`, form.testResult.ok ? 'success' : 'warning')
  } catch (e) {
    form.testResult = { ok: false, message: e?.message || String(e) }
    form.tested = false
    showToast(`调试失败：${e?.message || e}`, 'warning')
  } finally {
    testing.value = false
  }
}

async function submitPublishApply() {
  const binding = form.id ? { id: form.id } : await save()
  if (!binding?.id && !form.id) return
  const id = form.id || binding.id
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
    form.publishTicketNo = t?.ticketNo || t?.data?.ticketNo || ''
    showToast(form.publishTicketNo ? `已提交发布申请 ${form.publishTicketNo}` : '已提交发布申请，请到申请中心审批', 'success')
  } catch (e) {
    showToast(`提交申请失败：${e?.message || e}`, 'warning')
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
    const pub = await publishDataapi(binding.id, undefined, form.publishTicketNo || undefined)
    showToast(pub?.degraded ? `已发布（部分降级）` : '已发布', pub?.degraded ? 'warning' : 'success')
    emit('publish', pub?.binding || binding)
    close()
  } catch (e) {
    showToast(`发布失败：${e?.message || e}`, 'warning')
  } finally {
    publishing.value = false
  }
}

async function doGatewayProbe() {
  try {
    const res = await gatewayProbe(form.id ? { id: form.id } : { path: form.path, method: form.method })
    form.probeResult = res
    showToast(res?.ok ? `Gateway 探针 HTTP ${res.httpStatus} · ${res.latencyMs}ms` : `探针失败：${res?.message || res?.httpStatus}`, res?.ok ? 'success' : 'warning')
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
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="wb-mask">
      <div class="wb">
        <header class="wb-header">
          <div>
            <div class="wb-title">构建 API{{ form.name ? ` · ${form.name}` : '' }}</div>
            <div class="wb-sub">元数据走平台 /lh/datasource/meta · 定义 SoT = SQLREST · 边缘默认 Gateway</div>
          </div>
          <div class="wb-actions">
            <button type="button" class="btn btn-sm" @click="doGatewayProbe">Gateway 探针</button>
            <button type="button" class="btn btn-sm" @click="debugOpen = !debugOpen">调试</button>
            <button type="button" class="btn btn-sm btn-primary" :disabled="saving" @click="save">
              {{ saving ? '保存中…' : '保存' }}
            </button>
            <button type="button" class="btn btn-sm" @click="submitPublishApply">提交发布申请</button>
            <button type="button" class="btn btn-sm" :disabled="publishing" @click="saveAndPublish">
              {{ publishing ? '发布中…' : '发布' }}
            </button>
            <button type="button" class="btn btn-sm" @click="close">返回</button>
          </div>
        </header>

        <div class="wb-body">
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
                        <button type="button" class="meta-row col" @dblclick="onDblclickNode(col)">
                          {{ col.name }}<span class="meta-type">({{ col.type }})</span>
                        </button>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
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
                      <button type="button" class="btn btn-sm btn-primary" @click="parseParams">入参解析</button>
                      <button type="button" class="btn btn-sm btn-primary" @click="addParam">添加入参</button>
                      <button type="button" class="btn btn-sm btn-primary" @click="addPageParams">分页参数</button>
                    </div>
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
                          <td colspan="8" class="empty-cell">请输入语句并点击「入参解析」</td>
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
                      <button type="button" class="btn btn-sm btn-primary" @click="addOutput">添加出参</button>
                    </div>
                    <table class="data-table param-table">
                      <thead>
                        <tr>
                          <th>参数名</th>
                          <th>参数类型</th>
                          <th>描述</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="!form.outputs.length">
                          <td colspan="4" class="empty-cell">可从 SELECT 列解析，或手动添加出参</td>
                        </tr>
                        <tr v-for="(o, i) in form.outputs" :key="'o-' + i">
                          <td><input v-model="o.name" class="input" @input="markDirty" /></td>
                          <td>
                            <select v-model="o.type" class="select" @change="markDirty">
                              <option v-for="tp in OUTPUT_TYPES" :key="tp" :value="tp">{{ tp }}</option>
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
                <select class="select" disabled>
                  <option>默认模块</option>
                </select>
              </label>
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>授权</span>
                <select class="select" disabled>
                  <option>默认分组</option>
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
                <span class="form-label">发布审批单号（API-xxx）</span>
                <input
                  v-model="form.publishTicketNo"
                  class="input"
                  placeholder="提交发布申请后回填；lh.dataapi.require-publish-ticket=true 时必填"
                  @input="markDirty"
                />
              </label>
              <p class="field-hint">模块与授权分组沿用平台 SQLREST 默认配置。路径前缀来自 Gateway。</p>
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
              <p class="field-hint">公开对应 SQLREST open，不等于平台授权。调用仍走 Gateway / 平台 ACL。</p>
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
              <p class="field-hint">告警开关写入 SQLREST assignment.alarm。规则明细仍在 SQLREST 告警配置中维护。</p>
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
                  <span class="form-label">边缘 QPS（apisix 时）</span>
                  <input v-model.number="form.qps" class="input" type="number" min="1" @input="markDirty" />
                </label>
                <label class="form-field">
                  <span class="form-label">Burst</span>
                  <input v-model.number="form.burst" class="input" type="number" min="1" @input="markDirty" />
                </label>
              </div>
              <p class="field-hint">关闭时不启用 SQLREST 流控。边缘 QPS 仅在 edgeMode=apisix 或 both 时生效。</p>
            </div>
          </main>

          <aside v-if="debugOpen" class="wb-debug">
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
            <pre v-if="form.testResult" class="sample-json">{{ JSON.stringify(form.testResult, null, 2) }}</pre>
            <pre v-if="form.probeResult" class="sample-json">{{ JSON.stringify(form.probeResult, null, 2) }}</pre>
          </aside>
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
}
.wb-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 260px 1fr;
  grid-template-rows: 1fr;
}
.wb-body:has(.wb-debug) {
  grid-template-columns: 260px 1fr 320px;
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
  border-left: 1px solid var(--border, #e5e7eb);
  padding: 12px;
  overflow: auto;
  background: var(--bg-2, #f8fafc);
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
.sample-json {
  margin-top: 10px;
  padding: 8px;
  background: var(--bg, #fff);
  border-radius: 6px;
  font-size: 11px;
  max-height: 360px;
  overflow: auto;
}
.tip {
  font-size: 12px;
  color: var(--text-3, #94a3b8);
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
}
</style>
