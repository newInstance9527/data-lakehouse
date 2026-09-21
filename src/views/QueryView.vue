<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import MonacoSqlEditor from '@/components/query/MonacoSqlEditor.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import { formatSql } from '@/utils/sqlFormat'
import {
  ADHOC_SCAN_LIMIT_BYTES,
  cancelQuery,
  detectParamNamesLocal,
  execQuery,
  execQueryStream,
  explainQuery,
  exportQueryAudit,
  fetchQueryHistory,
  fetchSchemaTree,
  fetchTableColumns,
  formatScanBytes,
  saveQueryDataset,
} from '@/api/query'
import {
  QUERY_CATALOG,
  QUERY_HISTORY,
  QUERY_TABS_SEED,
  RESULT_COLUMNS,
  buildDemoResultRows,
} from '@/data/query'

const { showToast } = useToast()
const guide = pageGuideOf('query')
const route = useRoute()
const router = useRouter()

const editorRef = ref(null)
const catalog = reactive([])
const catalogDegraded = ref(false)
const catalogQuery = ref('')
const tabs = ref(QUERY_TABS_SEED.map((t) => ({ ...t })))
const activeTabId = ref(tabs.value[0]?.id || '')
const running = ref(false)
const showResult = ref(false)
const resultRows = ref([])
const resultColumns = ref(RESULT_COLUMNS.map((c) => ({ ...c })))
const activeTableId = ref('')
const history = ref([])
const sqlParams = reactive({})
const progressStages = ref([])
const usedSelection = ref(false)
const showChart = ref(false)
const chartDimKey = ref('')
const chartMetricKey = ref('')
const lastMeta = ref({
  queryId: '',
  trinoQueryId: '',
  trinoUiUrl: '',
  status: '',
  statusLabel: '',
  duration: '—',
  scan: '—',
  scanBytes: null,
  scanLimitBytes: ADHOC_SCAN_LIMIT_BYTES,
  scanOverLimit: false,
  maskCols: [],
  authHint: '',
  message: '',
  stages: [],
})
const apiOnline = ref(false)
let abortCtrl = null

const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) || null)
const sqlText = computed({
  get: () => activeTab.value?.sql || '',
  set: (v) => {
    if (activeTab.value) activeTab.value.sql = v
  },
})

const scanOk = computed(() => {
  const b = lastMeta.value.scanBytes
  const lim = lastMeta.value.scanLimitBytes || ADHOC_SCAN_LIMIT_BYTES
  if (b == null) return true
  return Number(b) <= Number(lim) && !lastMeta.value.scanOverLimit
})

const paramNames = computed(() => detectParamNamesLocal(sqlText.value))

/** 解析单元格数值（兼容千分位 / ¥ / 普通数字字符串） */
function parseCellNumber(v) {
  if (v == null || v === '') return NaN
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  if (typeof v !== 'string') return NaN
  const s = v.trim().replace(/^[¥$€]\s*/, '').replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN
  return Number(s)
}

function formatChartValue(n) {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1000) return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}

const chartableCols = computed(() =>
  resultColumns.value.filter((c) => {
    if (c.masked) return false
    return resultRows.value.some((r) => !Number.isNaN(parseCellNumber(r[c.key])))
  }),
)

const chartBars = computed(() => {
  if (!resultRows.value.length) return []
  const dim =
    chartDimKey.value ||
    resultColumns.value.find((c) => !c.masked && c.key !== chartMetricKey.value)?.key
  const metric = chartMetricKey.value || chartableCols.value[0]?.key
  if (!dim || !metric) return []
  const agg = new Map()
  for (const r of resultRows.value) {
    const k = String(r[dim] ?? '—')
    const n = parseCellNumber(r[metric])
    if (Number.isNaN(n)) continue
    agg.set(k, (agg.get(k) || 0) + n)
  }
  const items = [...agg.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 12)
  const max = Math.max(...items.map(([, v]) => Math.abs(v)), 1)
  return items.map(([label, value]) => ({
    label,
    value,
    display: formatChartValue(value),
    pct: Math.max(2, Math.round((Math.abs(value) / max) * 100)),
  }))
})

watch(
  paramNames,
  (names) => {
    const keep = new Set(names)
    Object.keys(sqlParams).forEach((k) => {
      if (!keep.has(k)) delete sqlParams[k]
    })
    names.forEach((n) => {
      if (!(n in sqlParams)) sqlParams[n] = ''
    })
  },
  { immediate: true },
)

function pickChartDefaults() {
  const dim =
    resultColumns.value.find((c) => !c.masked && !chartableCols.value.some((m) => m.key === c.key))
    || resultColumns.value.find((c) => !c.masked)
  chartDimKey.value = dim?.key || ''
  chartMetricKey.value = chartableCols.value[0]?.key || ''
  if (!chartableCols.value.length) showChart.value = false
}

watch(
  () => [resultColumns.value.map((c) => c.key).join(','), resultRows.value.length],
  () => {
    if (!resultColumns.value.length) return
    pickChartDefaults()
  },
)

function buildParamsPayload() {
  const names = paramNames.value
  if (!names.length) return undefined
  const out = {}
  for (const n of names) {
    out[n] = sqlParams[n]
  }
  return out
}

function resolveExecSql() {
  const selected = editorRef.value?.getSelectedOrAll?.() ?? sqlText.value
  const full = sqlText.value || ''
  const sel = String(selected || '').trim()
  const all = String(full || '').trim()
  usedSelection.value = !!(sel && sel !== all && sel.length < all.length)
  return sel || all
}

function asDatabases(tree) {
  const out = []
  for (const node of tree || []) {
    const children = node.children || []
    const groups = children.filter((c) => c && c.type !== 'table' && c.type !== 'column')
    if (groups.length) {
      for (const g of groups) out.push({ ...g, type: 'database' })
    } else {
      out.push({ ...node, type: 'database' })
    }
  }
  return out
}

function seedCatalogFallback() {
  const tree = asDatabases(structuredClone(QUERY_CATALOG))
  calmLargeSchemas(tree)
  catalog.splice(0, catalog.length, ...tree)
  catalogDegraded.value = true
}

function nodeBlob(node) {
  const cols = (node.columns || []).map((c) => `${c.name || ''} ${c.comment || ''}`).join(' ')
  return `${node.name || ''} ${node.fqn || ''} ${node.hint || ''} ${node.engine || ''} ${cols}`.toLowerCase()
}

function branchHit(node, q) {
  if (!q) return true
  if (nodeBlob(node).includes(q)) return true
  return (node.children || []).some((c) => branchHit(c, q))
}

function showNode(node, ancestorHit) {
  const q = catalogQuery.value.trim().toLowerCase()
  if (!q || ancestorHit) return true
  return branchHit(node, q)
}

function isOpen(node) {
  const q = catalogQuery.value.trim().toLowerCase()
  if (!q) return !!node.open
  if (node.type === 'table') {
    const colHit = (node.columns || []).some((c) =>
      `${c.name || ''} ${c.comment || ''}`.toLowerCase().includes(q),
    )
    return !!node.open || colHit
  }
  return !!node.open || branchHit(node, q)
}

const visibleTableCount = computed(() => {
  const q = catalogQuery.value.trim().toLowerCase()
  let n = 0
  for (const db of catalog) {
    if (db.locked) continue
    for (const tb of db.children || []) {
      if (tb.type && tb.type !== 'table') continue
      if (!q || branchHit(tb, q) || nodeBlob(db).includes(q)) n += 1
    }
  }
  return n
})

async function ensureColumns(table) {
  if (!table?.fqn) return
  if (table.columnsLoaded || table.columnsLoading) return
  if (Array.isArray(table.columns) && table.columns.length && !table.columnsLazy) {
    table.columnsLoaded = true
    return
  }
  table.columnsLoading = true
  try {
    const res = await fetchTableColumns(table.fqn, table.assetId)
    table.columns = Array.isArray(res?.columns) ? res.columns : []
    if (res?.comment) table.comment = res.comment
    table.columnsLoaded = true
  } catch {
    table.columns = Array.isArray(table.columns) ? table.columns : []
    table.columnsLoaded = true
    table.columnsError = true
  } finally {
    table.columnsLoading = false
  }
}

function calmLargeSchemas(nodes) {
  for (const db of nodes || []) {
    const tables = (db.children || []).filter((c) => !c.type || c.type === 'table')
    if (tables.length > 12) db.open = false
  }
}

function ancestorHit(node) {
  const q = catalogQuery.value.trim().toLowerCase()
  return !!q && nodeBlob(node).includes(q)
}

const TABLE_PAGE = 24

function listedTables(sch, hit) {
  const all = (sch.children || []).filter((tb) => showNode(tb, hit))
  if (sch.showAll || all.length <= TABLE_PAGE) return all
  return all.slice(0, TABLE_PAGE)
}

function hiddenTableCount(sch, hit) {
  const all = (sch.children || []).filter((tb) => showNode(tb, hit))
  if (sch.showAll || all.length <= TABLE_PAGE) return 0
  return all.length - TABLE_PAGE
}

async function loadSchemaTree() {
  try {
    const tree = await fetchSchemaTree()
    if (Array.isArray(tree)) {
      const dbs = asDatabases(tree)
      calmLargeSchemas(dbs)
      catalog.splice(0, catalog.length, ...dbs)
      catalogDegraded.value = false
      apiOnline.value = true
      return
    }
  } catch {
    /* fallback */
  }
  seedCatalogFallback()
  apiOnline.value = false
}

async function loadHistory() {
  try {
    const list = await fetchQueryHistory({ limit: 30, mineOnly: true })
    if (Array.isArray(list)) {
      history.value = list
      apiOnline.value = true
      return
    }
  } catch {
    /* fallback */
  }
  if (!history.value.length) history.value = [...QUERY_HISTORY]
}

function applyDeepLink() {
  const q = route.query || {}
  const sql = typeof q.sql === 'string' ? q.sql : ''
  const fqn = typeof q.fqn === 'string' ? q.fqn : ''
  if (sql) {
    const id = `tab_deep_${Date.now()}`
    tabs.value.push({
      id,
      name: 'draft_from_link.sql',
      closable: true,
      sql,
    })
    activeTabId.value = id
    showToast('已从深链载入 SQL 草稿（未自动执行）', 'info')
    return
  }
  if (fqn) {
    const sample = `SELECT *\nFROM ${fqn}\nWHERE dt >= date_add('day', -7, current_date)\nLIMIT 100;`
    const id = `tab_fqn_${Date.now()}`
    tabs.value.push({
      id,
      name: `${fqn.split('.').pop() || 'query'}.sql`,
      closable: true,
      sql: sample,
    })
    activeTabId.value = id
    activeTableId.value = fqn.replace(/\./g, '_')
    showToast(`已预插表 ${fqn}（未自动执行）`, 'info')
  }
}

watch(
  () => [route.query.sql, route.query.fqn],
  () => applyDeepLink(),
)

onMounted(async () => {
  await Promise.all([loadSchemaTree(), loadHistory()])
  applyDeepLink()
})

function goApplyRead(node) {
  showToast('未授权，前往申请读权限', 'warning')
  router.push({
    path: '/apply',
    query: {
      type: 'table',
      assetId: node.assetId || '',
      name: node.name || '',
      assetCode: node.assetCode || node.name || '',
      privilege: 'SELECT',
    },
  })
}

function toggleNode(node) {
  if (node.locked) {
    goApplyRead(node)
    return
  }
  if (node.type === 'database' || node.type === 'catalog' || node.type === 'schema') {
    node.open = !node.open
  }
}

async function toggleTableCols(table, e) {
  e?.stopPropagation()
  if (!table) return
  if (table.locked) {
    goApplyRead(table)
    return
  }
  table.open = !table.open
  if (table.open) await ensureColumns(table)
}

function insertTable(table) {
  if (!table) return
  if (table.locked) {
    goApplyRead(table)
    return
  }
  if (table.runnable === false || !table.sampleSql) {
    showToast('未挂接查询引擎，不能插入 SQL', 'warning')
    return
  }
  activeTableId.value = table.id
  sqlText.value = table.sampleSql
  showToast(`已插入表：${table.name || table.assetCode || ''}`, 'success')
}

function insertColumn(table, col) {
  const name = col?.name
  if (!name) return
  activeTableId.value = table?.id || activeTableId.value
  editorRef.value?.insertText?.(name)
  showToast(`已插入列 ${name}`, 'success')
}

function selectTab(id) {
  activeTabId.value = id
}

function closeTab(id, e) {
  e?.stopPropagation()
  if (tabs.value.length <= 1) {
    showToast('至少保留一个查询页签', 'warning')
    return
  }
  const idx = tabs.value.findIndex((t) => t.id === id)
  tabs.value.splice(idx, 1)
  if (activeTabId.value === id) {
    activeTabId.value = tabs.value[Math.max(0, idx - 1)].id
  }
}

function addTab() {
  const id = `tab_${Date.now()}`
  const name = `unsaved_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.sql`
  tabs.value.push({
    id,
    name,
    closable: true,
    sql: '-- 新建查询\nSELECT 1;\n',
  })
  activeTabId.value = id
}

function onFormat() {
  sqlText.value = formatSql(sqlText.value)
  showToast('SQL 已格式化', 'success')
}

function csvEscape(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function onExport() {
  if (!resultRows.value.length || !resultColumns.value.length) {
    showToast('暂无结果可导出', 'warning')
    return
  }
  const cols = resultColumns.value
  const header = cols.map((c) => csvEscape(c.label || c.key)).join(',')
  const lines = resultRows.value.map((r) =>
    cols.map((c) => csvEscape(r[c.key])).join(','),
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const filename = `query_result_masked_${lastMeta.value.queryId || Date.now()}.csv`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  try {
    await exportQueryAudit({
      queryId: lastMeta.value.queryId,
      rowCount: resultRows.value.length,
      ws: 'default',
    })
  } catch {
    /* 审计失败仍允许本地下载 */
  }
  showToast(`已导出脱敏 CSV：${filename}`, 'success')
  loadHistory()
}

function onSaveDataset() {
  if (!resultRows.value.length) {
    showToast('请先执行查询并取得结果再保存数据集', 'warning')
    return
  }
  const suggested = `query_result_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  const name = window.prompt('数据集名称（仅存 ≤200 行抽样）', suggested)
  if (!name) return
  ;(async () => {
    try {
      const cols = resultColumns.value.map((c) => ({
        key: c.key,
        label: c.label,
        masked: !!c.masked,
      }))
      const data = await saveQueryDataset({
        name: name.trim(),
        ws: 'default',
        queryId: lastMeta.value.queryId,
        sql: sqlText.value,
        columns: cols,
        rows: resultRows.value.slice(0, 200),
        scanBytes: lastMeta.value.scanBytes,
      })
      apiOnline.value = true
      showToast(
        `已保存数据集 ${data?.name || name}（${data?.rowCount ?? Math.min(resultRows.value.length, 200)} 行抽样）`,
        'success',
      )
    } catch (e) {
      showToast(e?.message || '保存数据集失败', 'error')
    }
  })()
}

async function onExplain() {
  const sql = resolveExecSql()
  if (!sql) {
    showToast('SQL 不能为空', 'warning')
    return
  }
  const missing = paramNames.value.filter((n) => !String(sqlParams[n] ?? '').trim())
  if (missing.length) {
    showToast(`请先填写参数: ${missing.join(', ')}`, 'warning')
    return
  }
  running.value = true
  progressStages.value = []
  try {
    const data = await explainQuery({
      sql,
      ws: 'default',
      maxRows: 500,
      params: buildParamsPayload(),
    })
    apiOnline.value = true
    if (data?.planText) {
      resultColumns.value = [{ key: 'plan', label: 'EXPLAIN', masked: false }]
      resultRows.value = String(data.planText)
        .split('\n')
        .filter((l) => l.length)
        .map((l) => ({ plan: l }))
      showResult.value = true
    } else {
      applyExecResult(data || {}, sql)
    }
    lastMeta.value.trinoUiUrl = data?.trinoUiUrl || lastMeta.value.trinoUiUrl || ''
    lastMeta.value.trinoQueryId = data?.trinoQueryId || lastMeta.value.trinoQueryId || ''
    lastMeta.value.statusLabel = 'EXPLAIN'
    if (data?.trinoUiUrl) {
      showToast('EXPLAIN 完成，可打开 Trino Web UI 查看详情', 'success')
    } else {
      showToast('EXPLAIN 完成', 'success')
    }
  } catch (e) {
    showToast(e?.message || 'EXPLAIN 失败', 'error')
  } finally {
    running.value = false
  }
}

function onSaveAsDevelopDraft() {
  const sql = String(sqlText.value || '').trim()
  if (!sql) {
    showToast('当前无 SQL 可存为开发草稿', 'warning')
    return
  }
  const tab = activeTab.value
  const name = tab?.name && !/^unsaved_/i.test(tab.name) ? tab.name : `from_query_${Date.now()}.sql`
  router.push({
    path: '/develop',
    query: { importSql: sql, name },
  })
}

function onSaveSql() {
  const tab = activeTab.value
  if (!tab) return
  if (/^unsaved_/i.test(tab.name) || tab.name.startsWith('untitled') || tab.name.startsWith('draft_')) {
    const suggested = `query_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.sql`
    const name = window.prompt('保存脚本名称', suggested)
    if (!name) return
    tab.name = name.endsWith('.sql') ? name : `${name}.sql`
  }
  tab.savedAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  showToast(`已保存脚本 ${tab.name}`, 'success')
}

function summarize(sql) {
  const one = String(sql || '').replace(/\s+/g, ' ').trim()
  return one.length > 56 ? `${one.slice(0, 56)}…` : one
}

function applyExecResult(data, sql) {
  const cols = Array.isArray(data.columnMeta) && data.columnMeta.length
    ? data.columnMeta.map((c) => ({
        key: c.key,
        label: c.label || c.key,
        masked: !!c.masked,
      }))
    : (data.columns || []).map((k) => ({ key: k, label: k, masked: (data.maskCols || []).includes(k) }))

  if (cols.length) resultColumns.value = cols
  resultRows.value = Array.isArray(data.rows) ? data.rows : []
  showResult.value = true

  lastMeta.value = {
    queryId: data.queryId || '',
    trinoQueryId: data.trinoQueryId || '',
    trinoUiUrl: data.trinoUiUrl || '',
    status: data.status || '',
    statusLabel: data.statusLabel || '',
    duration: data.duration || '—',
    scan: data.scan || formatScanBytes(data.scanBytes),
    scanBytes: data.scanBytes ?? null,
    scanLimitBytes: data.scanLimitBytes || ADHOC_SCAN_LIMIT_BYTES,
    scanOverLimit: !!data.scanOverLimit || data.status === 'blocked',
    maskCols: data.maskCols || [],
    authHint: data.authHint || '',
    message: data.message || '',
    stages: Array.isArray(data.stages) ? data.stages : progressStages.value.slice(),
  }

  if (Array.isArray(data.stages) && data.stages.length) {
    progressStages.value = data.stages
  }

  if (data.blocked || data.status === 'blocked') {
    showToast(data.message || data.statusLabel || '查询被治理拦截', 'warning')
    if (data.errorCode === 'ACCESS_DENIED' || data.applyHint) {
      const go = window.confirm('未授权访问表/列。是否前往申请中心申请 SELECT？')
      if (go) {
        router.push({
          path: '/apply',
          query: { type: 'table', privilege: 'SELECT' },
        })
      }
    }
    if (data.errorCode === 'CONCURRENCY_LIMIT') {
      showToast(
        `adhoc 并发已满 ${data.adhocConcurrent ?? '?'}/${data.adhocMaxConcurrent ?? 20}`,
        'warning',
      )
    }
  } else if (data.degraded || data.status === 'failed') {
    showToast(data.message || '查询失败', 'error')
  } else {
    const maskN = (data.maskCols || []).length
    showToast(
      `查询完成 query_id=${data.queryId || '—'}${maskN ? ` · 脱敏 ${maskN} 列` : ''} · Scan ${lastMeta.value.scan}`,
      'success',
    )
  }
}

async function runQueryDemo(sql) {
  const qid = `demo_${String(Date.now()).slice(-8)}`
  lastMeta.value.queryId = qid
  lastMeta.value.trinoQueryId = ''
  running.value = true
  showResult.value = true
  resultRows.value = []
  await new Promise((r) => setTimeout(r, 400))
  resultColumns.value = RESULT_COLUMNS.map((c) => ({ ...c }))
  resultRows.value = buildDemoResultRows()
  lastMeta.value = {
    queryId: qid,
    trinoQueryId: '',
    status: 'ok',
    statusLabel: '✓ · 脱敏 1列（演示）',
    duration: '2.48s',
    scan: '1.2 GB',
    scanBytes: 1.2 * 1024 * 1024 * 1024,
    scanLimitBytes: ADHOC_SCAN_LIMIT_BYTES,
    scanOverLimit: false,
    maskCols: ['buyer_mobile'],
    authHint: '演示模式',
    message: '',
  }
  running.value = false
  history.value.unshift({
    id: `h_${Date.now()}`,
    time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-'),
    user: '我',
    summary: summarize(sql),
    duration: '2.48s',
    scan: '1.2 GB',
    rows: String(resultRows.value.length),
    status: 'ok',
    statusLabel: '✓ · 脱敏 1列（演示）',
    tagClass: 'tag-green',
    sql,
  })
  showToast('演示模式：未连后端，结果为本地样例', 'info')
}

async function runQuery() {
  if (running.value) return
  const sql = resolveExecSql()
  if (!sql) {
    showToast('SQL 不能为空', 'warning')
    return
  }
  const selParams = detectParamNamesLocal(sql)
  const needFill = selParams.filter((n) => !String(sqlParams[n] ?? '').trim())
  if (needFill.length) {
    showToast(`请先填写参数: ${needFill.join(', ')}`, 'warning')
    return
  }

  running.value = true
  showResult.value = true
  resultRows.value = []
  progressStages.value = []
  lastMeta.value = {
    ...lastMeta.value,
    queryId: '',
    trinoQueryId: '',
    trinoUiUrl: '',
    status: 'running',
    statusLabel: usedSelection.value ? '执行选中语句…' : '执行中…',
    duration: '…',
    scan: '…',
    message: '',
    scanOverLimit: false,
    stages: [],
  }

  const payload = {
    sql,
    ws: 'default',
    maxRows: 1000,
    params: selParams.length ? Object.fromEntries(selParams.map((n) => [n, sqlParams[n]])) : undefined,
  }

  abortCtrl = new AbortController()
  try {
    let data
    try {
      data = await execQueryStream(payload, {
        signal: abortCtrl.signal,
        onProgress: (stage) => {
          if (!stage) return
          progressStages.value = [...progressStages.value, stage]
          const b = stage.scanBytes ?? stage.processedBytes
          if (b != null) {
            lastMeta.value.scan = formatScanBytes(b)
            lastMeta.value.scanBytes = Number(b)
          }
          const label = stage.phase || stage.stage || stage.state
          if (label) {
            lastMeta.value.statusLabel = `执行中 · ${label}`
          }
        },
      })
    } catch (streamErr) {
      if (streamErr?.name === 'AbortError') throw streamErr
      // SSE 不可用时回退普通 POST
      data = await execQuery(payload)
    }
    apiOnline.value = true
    applyExecResult(data || {}, sql)
    if (usedSelection.value) {
      showToast('已执行选中语句', 'info')
    }
    await loadHistory()
  } catch (e) {
    if (e?.name === 'AbortError') {
      lastMeta.value.status = 'cancelled'
      lastMeta.value.statusLabel = '已取消'
      showToast('已取消查询', 'info')
      return
    }
    const msg = e?.message || '执行失败'
    if (/网络|Failed to fetch|401|登录/i.test(msg) || !apiOnline.value) {
      await runQueryDemo(sql)
    } else {
      showResult.value = true
      lastMeta.value.status = 'failed'
      lastMeta.value.statusLabel = '失败'
      lastMeta.value.message = msg
      showToast(msg, 'error')
      if (/未授权|无权限|denied|Forbidden|ACCESS_DENIED/i.test(msg)) {
        const go = window.confirm('可能未授权。是否前往申请中心？')
        if (go) {
          router.push({ path: '/apply', query: { type: 'table', privilege: 'SELECT' } })
        }
      }
    }
  } finally {
    running.value = false
    abortCtrl = null
  }
}

async function onCancel() {
  if (!running.value && !lastMeta.value.queryId) return
  try {
    abortCtrl?.abort()
    await cancelQuery({
      queryId: lastMeta.value.queryId,
      trinoQueryId: lastMeta.value.trinoQueryId,
    })
    showToast('已取消查询', 'info')
    lastMeta.value.status = 'cancelled'
    lastMeta.value.statusLabel = '已取消'
    await loadHistory()
  } catch (e) {
    showToast(e?.message || '取消失败', 'error')
  } finally {
    running.value = false
  }
}

function loadHistoryRow(h) {
  if (!h?.sql) return
  sqlText.value = h.sql
  showToast('已加载历史 SQL 到编辑器', 'success')
}

function cellClass(col, row) {
  if (col.masked) return 'masked'
  const v = row[col.key]
  if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))) return 'mono num'
  return 'mono'
}
</script>

<template>
  <div class="query-page">
    <PageHeader
      title="即席 SQL 查询 · Trino"
      subtitle="经 Trino · Gravitino 鉴权 · 列级脱敏 · 行级过滤 · 扫描默认 ≤10GB（硬顶 50GB）"
      :guide-title="guide.title"
      :guide="guide"
    >
      <button class="btn btn-sm" @click="onSaveSql">保存脚本</button>
      <button class="btn btn-sm" @click="onSaveAsDevelopDraft">存为开发草稿</button>
      <button class="btn btn-sm" @click="onExport">导出 CSV（自动脱敏）</button>
      <button class="btn btn-sm" :disabled="!resultRows.length" @click="onSaveDataset">保存为数据集</button>
      <button class="btn btn-sm" :disabled="running" @click="onExplain">Explain</button>
      <button class="btn btn-sm" :disabled="!running && !lastMeta.queryId" @click="onCancel">取消</button>
      <button class="btn btn-sm btn-primary" :disabled="running" @click="runQuery">
        执行查询 (Ctrl+Enter)
      </button>
    </PageHeader>

    <div v-if="catalogDegraded || !apiOnline" class="banner-soft">
      {{ catalogDegraded ? 'Schema 树为降级/演示数据；' : '' }}
      {{ apiOnline ? '' : '后端未连通时执行将走本地演示结果。' }}
      限额：adhoc 默认 10GB / 硬顶 50GB。
    </div>

    <div class="query-layout">
      <aside class="card query-cat">
        <div class="card-header cat-head">
          <div class="card-title">目录</div>
          <span class="cat-count">{{ visibleTableCount }} 表</span>
        </div>
        <div class="cat-search">
          <input
            v-model="catalogQuery"
            type="search"
            class="cat-search-input"
            placeholder="搜索库、表、列"
            aria-label="搜索目录"
          />
        </div>
        <div class="cat-body">
          <div v-if="apiOnline && !catalog.length" class="cat-empty">当前工作空间还没有已登记的表</div>
          <template v-for="db in catalog" :key="db.id">
            <button
              v-if="showNode(db, false)"
              type="button"
              class="cat-node database"
              :class="{ locked: db.locked, open: isOpen(db) }"
              @click="toggleNode(db)"
            >
              <span class="cat-chev" :class="{ open: isOpen(db), locked: db.locked }" aria-hidden="true" />
              <span v-if="db.layer" class="layer-chip" :class="`layer-${String(db.layer).toLowerCase()}`">{{ db.layer }}</span>
              <span class="cat-label">
                <span class="cat-name">{{ db.name }}</span>
                <span v-if="db.hint" class="cat-hint">{{ db.hint }}</span>
              </span>
              <span v-if="db.locked" class="cat-lock">未授权</span>
              <span v-else class="cat-rows">{{ db.tableCount ?? (db.children || []).length }}</span>
            </button>
            <template v-if="isOpen(db) && !db.locked">
              <div
                v-for="tb in listedTables(db, ancestorHit(db))"
                :key="tb.id"
                class="cat-table-block"
                :class="{ active: tb.id === activeTableId }"
              >
                <div class="cat-node table" :class="{ locked: tb.locked }">
                  <button type="button" class="cat-chev-btn" :aria-expanded="!!isOpen(tb)" @click="toggleTableCols(tb, $event)">
                    <span class="cat-chev" :class="{ open: isOpen(tb), locked: tb.locked }" aria-hidden="true" />
                  </button>
                  <button type="button" class="cat-table-main" @click="insertTable(tb)">
                    <span v-if="tb.star" class="cat-star" title="常用">★</span>
                    <span class="cat-name">{{ tb.name }}</span>
                    <span v-if="tb.hint" class="cat-hint">{{ tb.hint }}</span>
                  </button>
                  <span v-if="tb.locked" class="cat-lock">未授权</span>
                  <span v-else-if="tb.runnable === false" class="cat-hint">未挂接</span>
                  <span v-if="tb.rows" class="cat-rows">{{ tb.rows }}</span>
                </div>
                <div v-if="isOpen(tb)" class="cat-cols">
                  <div v-if="tb.columnsLoading" class="cat-col empty">读取列…</div>
                  <div v-else-if="tb.columnsError && !(tb.columns || []).length" class="cat-col empty">列信息暂不可用</div>
                  <div v-else-if="!(tb.columns || []).length" class="cat-col empty">无列</div>
                  <button
                    v-for="col in tb.columns || []"
                    :key="col.name"
                    type="button"
                    class="cat-col"
                    :title="col.comment || col.type"
                    @click="insertColumn(tb, col)"
                  >
                    <span class="cat-col-name" :class="{ masked: col.masked }">{{ col.name }}</span>
                    <span class="cat-col-type">{{ col.type }}</span>
                    <span v-if="col.partition" class="col-flag part">分区</span>
                    <span v-if="col.masked" class="col-flag mask">脱敏</span>
                  </button>
                </div>
              </div>
              <button
                v-if="hiddenTableCount(db, ancestorHit(db))"
                type="button"
                class="cat-more"
                @click="db.showAll = true"
              >
                还有 {{ hiddenTableCount(db, ancestorHit(db)) }} 张表
              </button>
            </template>
          </template>
          <div v-if="catalogQuery.trim() && !visibleTableCount && !catalog.some((c) => c.locked && showNode(c, false))" class="cat-empty">
            没有匹配「{{ catalogQuery.trim() }}」的库表
          </div>
        </div>
        <div class="cat-foot">点表插入 SQL · 展开查看列 · 点列插入字段</div>
      </aside>

      <div class="query-main">
        <div class="sql-wrap">
          <div class="sql-toolbar">
            <div class="sql-tabs">
              <button
                v-for="t in tabs"
                :key="t.id"
                type="button"
                class="sql-tab"
                :class="{ active: t.id === activeTabId }"
                @click="selectTab(t.id)"
              >
                {{ t.name }}
                <span v-if="t.closable" class="sql-tab-x" @click="closeTab(t.id, $event)">✕</span>
              </button>
              <button type="button" class="sql-tab add" @click="addTab">+</button>
            </div>
          </div>

          <MonacoSqlEditor
            ref="editorRef"
            v-model="sqlText"
            :min-height="220"
            @run="runQuery"
            @save="onSaveSql"
          />

          <div v-if="paramNames.length" class="sql-params">
            <div class="sql-params-label">命名参数</div>
            <div class="sql-params-grid">
              <label v-for="n in paramNames" :key="n" class="sql-param">
                <span>:{{ n }}</span>
                <input v-model="sqlParams[n]" type="text" :placeholder="n" />
              </label>
            </div>
          </div>

          <div class="sql-status">
            <div>
              {{ lastMeta.authHint || 'Gravitino 鉴权 · 列脱敏 · 行级策略' }}
              <template v-if="lastMeta.queryId"> · query_id={{ lastMeta.queryId }}</template>
              <template v-if="usedSelection && running"> · 选中语句</template>
            </div>
            <div class="sql-status-acts">
              <button type="button" class="btn btn-sm sql-dark-btn" @click="onSaveSql">保存</button>
              <button type="button" class="btn btn-sm sql-dark-btn" @click="onFormat">格式化</button>
              <button type="button" class="btn btn-sm sql-dark-btn" :disabled="running" @click="onExplain">Explain</button>
              <button type="button" class="btn btn-sm sql-dark-btn" :disabled="!running" @click="onCancel">取消</button>
              <button type="button" class="btn btn-sm btn-primary" :disabled="running" @click="runQuery">
                执行 (Ctrl⏎)
              </button>
            </div>
          </div>
        </div>

        <div v-if="showResult" class="result-wrap">
          <div class="result-stat">
            <div class="result-stat-left">
              <span>
                状态：
                <b :class="running ? '' : lastMeta.scanOverLimit || lastMeta.status === 'failed' ? 'danger' : 'ok'">
                  {{ running ? '执行中…' : lastMeta.statusLabel || lastMeta.status || '—' }}
                </b>
              </span>
              <span>返回行：<b>{{ resultRows.length || '—' }} 行</b></span>
              <span>耗时：<b>{{ running ? '…' : lastMeta.duration }}</b></span>
              <span>
                Scan：<b :class="{ danger: !scanOk }">{{ running ? '…' : lastMeta.scan }}</b>
                ·
                <b :class="scanOk ? 'ok' : 'danger'">
                  {{ scanOk ? '符合限额 ≤ 10GB' : '超过限额（默认 10GB / 硬顶 50GB）' }}
                </b>
              </span>
            </div>
            <div class="result-stat-right">
              <span v-if="lastMeta.maskCols?.length" class="tag tag-orange">
                已脱敏 {{ lastMeta.maskCols.length }} 列
              </span>
              <span class="tag tag-blue">行级过滤生效</span>
              <a
                v-if="lastMeta.trinoUiUrl"
                class="btn btn-sm"
                :href="lastMeta.trinoUiUrl"
                target="_blank"
                rel="noopener noreferrer"
              >Trino Web UI</a>
              <button class="btn btn-sm" @click="onExport">导出 CSV（脱敏集）</button>
              <button class="btn btn-sm" :disabled="!resultRows.length" @click="onSaveDataset">存数据集</button>
              <button
                class="btn btn-sm"
                :disabled="!resultRows.length || !chartableCols.length"
                @click="showChart = !showChart"
              >
                {{ showChart ? '表格' : '简易图' }}
              </button>
            </div>
          </div>
          <div v-if="progressStages.length" class="result-stages">
            <span
              v-for="(s, i) in progressStages"
              :key="i"
              class="stage-chip"
            >
              {{ s.phase || s.stage || s.state || 'step' }}
              <template v-if="s.scanBytes != null"> · {{ formatScanBytes(s.scanBytes) }}</template>
            </span>
          </div>
          <div v-if="lastMeta.message" class="result-msg" :class="{ danger: !scanOk || lastMeta.status === 'failed' }">
            {{ lastMeta.message }}
          </div>
          <div v-if="showChart" class="result-chart">
            <div class="chart-controls">
              <label>
                维度
                <select v-model="chartDimKey">
                  <option v-for="c in resultColumns.filter((x) => !x.masked)" :key="c.key" :value="c.key">
                    {{ c.label || c.key }}
                  </option>
                </select>
              </label>
              <label>
                指标（求和）
                <select v-model="chartMetricKey">
                  <option v-for="c in chartableCols" :key="c.key" :value="c.key">
                    {{ c.label || c.key }}
                  </option>
                </select>
              </label>
              <span class="chart-hint">按维度聚合前 12 项 · 仅预览抽样结果</span>
            </div>
            <div v-if="chartBars.length" class="chart-bars">
              <div v-for="b in chartBars" :key="b.label" class="chart-row">
                <div class="chart-label" :title="b.label">{{ b.label }}</div>
                <div class="chart-track">
                  <div class="chart-fill" :style="{ width: `${b.pct}%` }" />
                </div>
                <div class="chart-val mono">{{ b.display }}</div>
              </div>
            </div>
            <div v-else class="chart-empty">
              当前结果无可汇总的数值列，或维度/指标组合无数据
            </div>
          </div>
          <div v-else class="result-table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th v-for="c in resultColumns" :key="c.key">
                    {{ c.label }}
                    <span v-if="c.masked" class="tag tag-orange" style="font-size: 10px; margin-left: 4px">脱敏</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in resultRows" :key="i" class="blink-row">
                  <td v-for="c in resultColumns" :key="c.key" :class="cellClass(c, r)">
                    {{ r[c.key] ?? '—' }}
                  </td>
                </tr>
                <tr v-if="running">
                  <td :colspan="Math.max(resultColumns.length, 1)" class="empty">查询执行中…</td>
                </tr>
                <tr v-else-if="!resultRows.length">
                  <td :colspan="Math.max(resultColumns.length, 1)" class="empty">无数据行</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <section class="card">
          <div class="card-header">
            <div class="card-title">近 {{ history.length }} 条查询历史</div>
            <button type="button" class="btn btn-sm" @click="loadHistory">刷新</button>
          </div>
          <div class="card-body" style="padding: 0; overflow: auto">
            <table class="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>用户</th>
                  <th>SQL 摘要</th>
                  <th>耗时</th>
                  <th>Scan</th>
                  <th>行数</th>
                  <th>状态/脱敏</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="h in history"
                  :key="h.id || h.queryId"
                  class="hist-row"
                  @click="loadHistoryRow(h)"
                >
                  <td>{{ h.time }}</td>
                  <td>{{ h.user }}</td>
                  <td><code>{{ h.summary }}</code></td>
                  <td>{{ h.duration }}</td>
                  <td :class="{ danger: h.scanDanger }">{{ h.scan }}</td>
                  <td>{{ h.rows }}</td>
                  <td><span class="tag" :class="h.tagClass">{{ h.statusLabel }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banner-soft {
  margin-bottom: 12px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.query-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 960px) {
  .query-layout { grid-template-columns: 1fr; }
}

.query-cat {
  position: sticky;
  top: 0;
  align-self: start;
  max-height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cat-head {
  gap: 8px;
}
.cat-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-4);
  font-weight: 500;
}
.cat-search {
  padding: 8px 10px 0;
}
.cat-search-input {
  width: 100%;
  box-sizing: border-box;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-2);
  color: var(--text-1);
  font: inherit;
  font-size: 12px;
  outline: none;
}
.cat-search-input:focus {
  border-color: var(--primary);
  background: var(--bg-1, #fff);
}
.cat-body {
  padding: 6px 6px 8px;
  font-size: 12px;
  overflow: auto;
  flex: 1;
}
.cat-node {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  font: inherit;
  color: var(--text-2);
  cursor: pointer;
  text-align: left;
  border-radius: 8px;
  padding: 5px 6px;
  line-height: 1.4;
  min-width: 0;
}
.cat-node:hover { background: var(--bg-2); }
.cat-node.database {
  font-weight: 600;
  color: var(--text-1);
  margin-top: 2px;
}
.cat-node.database.locked { color: var(--text-4); }
.cat-node.table {
  padding: 3px 4px 3px 18px;
  cursor: default;
}
.cat-node.table:hover { background: transparent; }
.cat-table-block {
  border-radius: 8px;
  margin: 1px 0;
}
.cat-table-block.active {
  background: var(--primary-light);
}
.cat-table-block.active .cat-name { color: var(--primary); font-weight: 600; }
.cat-chev {
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid var(--text-4);
  flex-shrink: 0;
  transition: transform 0.12s ease;
}
.cat-chev.open { transform: rotate(90deg); }
.cat-chev.locked {
  border: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--text-4);
  opacity: 0.7;
}
.cat-chev-btn {
  border: none;
  background: transparent;
  padding: 2px;
  display: inline-flex;
  cursor: pointer;
  border-radius: 4px;
}
.cat-chev-btn:hover { background: var(--bg-2); }
.cat-table-main {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: left;
  padding: 2px 0;
}
.cat-mark {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary);
}
.cat-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.cat-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-hint {
  color: var(--text-4);
  font-size: 10px;
  font-weight: 400;
  flex-shrink: 0;
}
.cat-engine,
.cat-lock {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  flex-shrink: 0;
  font-weight: 500;
}
.cat-engine {
  color: var(--text-3);
  background: var(--bg-2);
}
.cat-lock {
  color: #ad6800;
  background: rgba(250, 173, 20, 0.16);
}
.layer-chip {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;
  line-height: 1.5;
}
.layer-ods { color: #ad6800; background: rgba(250, 173, 20, 0.16); }
.layer-dwd { color: #0958d9; background: rgba(22, 119, 255, 0.12); }
.layer-dws { color: #08979c; background: rgba(19, 194, 194, 0.14); }
.layer-ads { color: #389e0d; background: rgba(82, 196, 26, 0.14); }
.layer-dim { color: #531dab; background: rgba(114, 46, 209, 0.12); }
.cat-star { color: #d48806; font-size: 11px; flex-shrink: 0; }
.cat-rows {
  color: var(--text-4);
  font-size: 11px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.cat-cols {
  margin: 0 6px 4px 42px;
  padding: 2px 0 4px;
  border-left: 1px dashed var(--border);
}
.cat-col {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 11px;
  color: var(--text-2);
  padding: 3px 8px;
  cursor: pointer;
  text-align: left;
  border-radius: 6px;
}
.cat-col:hover { background: var(--bg-2); }
.cat-col.empty {
  color: var(--text-4);
  cursor: default;
}
.cat-col.empty:hover { background: transparent; }
.cat-col-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-col-name.masked { color: #d46b08; }
.cat-col-type {
  margin-left: auto;
  color: var(--text-4);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  flex-shrink: 0;
}
.col-flag {
  font-size: 9px;
  padding: 0 4px;
  border-radius: 4px;
  flex-shrink: 0;
}
.col-flag.part { color: #0958d9; background: rgba(22, 119, 255, 0.1); }
.col-flag.mask { color: #d46b08; background: rgba(250, 140, 22, 0.14); }
.cat-foot {
  padding: 8px 12px;
  border-top: 1px dashed var(--border);
  font-size: 11px;
  color: var(--text-4);
}
.cat-more {
  margin: 2px 8px 8px 28px;
  border: none;
  background: transparent;
  color: var(--primary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
}
.cat-empty {
  padding: 16px 10px;
  text-align: center;
  color: var(--text-4);
  font-size: 12px;
}

.query-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.sql-wrap {
  background: #0f1a2e;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid #1a2744;
}
.sql-toolbar {
  padding: 10px 14px;
  background: #162240;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.sql-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.sql-tab {
  padding: 5px 12px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #98a5be;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
}
.sql-tab.active { background: var(--primary); color: #fff; }
.sql-tab.add { opacity: 0.6; }
.sql-tab-x { opacity: 0.7; font-size: 11px; }
.sql-status {
  padding: 10px 18px;
  background: #162240;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #6b7a99;
}
.sql-status-acts { display: flex; gap: 8px; }
.sql-dark-btn {
  background: #203050 !important;
  border-color: #2e4475 !important;
  color: #cfd6e4 !important;
}
.sql-params {
  padding: 10px 16px;
  background: #132038;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.sql-params-label {
  font-size: 11px;
  color: #6b7a99;
  margin-bottom: 8px;
}
.sql-params-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
}
.sql-param {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #98a5be;
}
.sql-param span {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  color: #7eb6ff;
  min-width: 4.5em;
}
.sql-param input {
  width: 140px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #2e4475;
  background: #0f1a2e;
  color: #e6ebf5;
  font: inherit;
}
.result-stages {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-2);
}
.stage-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--primary-light, #e8f0ff);
  color: var(--primary, #1e6fff);
}

.result-wrap {
  background: var(--bg-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  overflow: hidden;
}
.result-stat {
  padding: 10px 16px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
}
.result-stat-left {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  color: var(--text-2);
}
.result-stat-left b { color: var(--text-1); font-weight: 600; }
.ok { color: var(--success) !important; }
.danger { color: var(--danger) !important; font-weight: 600; }
.result-stat-right {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 11px;
}
.result-msg {
  padding: 8px 16px;
  font-size: 12px;
  background: var(--warning-light, #fff7e6);
  color: var(--text-2);
  border-bottom: 1px solid var(--border);
}
.result-msg.danger {
  background: #fff1f0;
  color: var(--danger);
}
.result-table-wrap {
  overflow: auto;
  max-height: 360px;
}
.result-chart {
  padding: 12px 16px 16px;
}
.chart-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-2);
  align-items: center;
}
.chart-hint {
  color: var(--text-4, #98a2b3);
  font-size: 11px;
}
.chart-empty {
  padding: 28px 12px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.chart-controls select {
  margin-left: 6px;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-1);
  color: var(--text-1);
  font: inherit;
}
.chart-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chart-row {
  display: grid;
  grid-template-columns: 96px 1fr 72px;
  gap: 10px;
  align-items: center;
}
.chart-label {
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chart-track {
  height: 10px;
  background: var(--bg-2);
  border-radius: 4px;
  overflow: hidden;
}
.chart-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 4px;
  transition: width 0.25s ease;
}
.chart-val {
  font-size: 12px;
  text-align: right;
  color: var(--text-1);
}
.mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
.num { text-align: right; font-weight: 600; }
.masked {
  background: repeating-linear-gradient(
    45deg,
    var(--warning-light),
    var(--warning-light) 4px,
    #fff0d6 4px,
    #fff0d6 8px
  );
  color: var(--warning);
  font-family: monospace;
  letter-spacing: 1px;
  font-weight: 500;
}
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 20px !important;
}
.hist-row { cursor: pointer; }
.hist-row:hover { background: var(--bg-2); }

@keyframes blink-in {
  from { background: rgba(30, 111, 255, 0.12); }
  to { background: transparent; }
}
.blink-row { animation: blink-in 0.6s ease; }
</style>
