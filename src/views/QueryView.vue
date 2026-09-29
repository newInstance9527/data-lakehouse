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
  HARD_SCAN_LIMIT_BYTES,
  cancelQuery,
  detectParamNamesLocal,
  execQuery,
  execQueryStream,
  explainQuery,
  exportQueryAudit,
  fetchQueryGovOverview,
  fetchQueryHistory,
  fetchQueryScripts,
  fetchSchemaTree,
  fetchTableColumns,
  formatScanBytes,
  saveQueryDataset,
  saveQueryScript,
} from '@/api/query'
import { useSession } from '@/composables/useSession'
import { RESULT_COLUMNS } from '@/data/query'

const { showToast } = useToast()
const { currentWs } = useSession()
const guide = pageGuideOf('query')
const route = useRoute()
const router = useRouter()

const editorRef = ref(null)
const catalog = reactive([])
const catalogDegraded = ref(false)
const catalogQuery = ref('')
const catWidth = ref(Number(localStorage.getItem('lh.query.catWidth')) || 300)
const catResizing = ref(false)
const savedScripts = ref([])
function blankQueryTab() {
  return {
    id: 'tab_query_1',
    name: '查询 1',
    closable: true,
    sql: '',
    savedId: '',
  }
}

const tabs = ref([blankQueryTab()])
const activeTabId = ref(tabs.value[0].id)
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
  maskSource: '',
  maskDegraded: false,
  maskMessage: '',
  rowFilterApplied: false,
  rowFilterSource: '',
  rowFilterDegraded: false,
  rowFilterMessage: '',
  rowFilterPredicates: [],
  authHint: '',
  message: '',
  stages: [],
})
const apiOnline = ref(false)
const elevateScan = ref(false)
const elevateAllowed = ref(false)
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
  for (const ds of catalog) {
    for (const sch of ds.children || []) {
      for (const tb of sch.children || []) {
        if (tb.type && tb.type !== 'table') continue
        if (!q || branchHit(tb, q) || nodeBlob(sch).includes(q) || nodeBlob(ds).includes(q)) n += 1
      }
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
  for (const ds of nodes || []) {
    for (const sch of ds.children || []) {
      if ((sch.children || []).length > 12) sch.open = false
    }
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
    const tree = await fetchSchemaTree(currentWs.value || 'default')
    if (Array.isArray(tree)) {
      calmLargeSchemas(tree)
      catalog.splice(0, catalog.length, ...tree)
      catalogDegraded.value = false
      apiOnline.value = true
      return
    }
    catalog.splice(0, catalog.length)
    catalogDegraded.value = false
  } catch (e) {
    catalog.splice(0, catalog.length)
    catalogDegraded.value = true
    apiOnline.value = false
    showToast(e?.message || 'Schema 树拉取失败', 'warning')
  }
}

async function loadHistory() {
  try {
    const list = await fetchQueryHistory({
      limit: 30,
      mineOnly: true,
      ws: currentWs.value || 'default',
    })
    if (Array.isArray(list)) {
      history.value = list
      apiOnline.value = true
      return
    }
    history.value = []
  } catch (e) {
    history.value = []
    showToast(e?.message || '查询历史拉取失败', 'warning')
  }
}

let appliedLinkKey = ''

function applyDeepLink() {
  const q = route.query || {}
  const sql = typeof q.sql === 'string' ? q.sql : ''
  const fqn = typeof q.fqn === 'string' ? q.fqn : ''
  if (!sql && !fqn) return
  const key = sql ? `sql:${sql}` : `fqn:${fqn}`
  if (key === appliedLinkKey) return
  appliedLinkKey = key

  const content = sql
    ? sql
    : `SELECT *\nFROM ${fqn}\nWHERE dt >= date_add('day', -7, current_date)\nLIMIT 100`
  const name = sql ? 'draft_from_link.sql' : `${fqn.split('.').pop() || 'query'}.sql`
  const only = tabs.value.length === 1 ? tabs.value[0] : null
  if (only && !String(only.sql || '').trim()) {
    only.sql = content
    only.name = name
    activeTabId.value = only.id
  } else {
    const id = `tab_link_${Date.now()}`
    tabs.value.push({
      id,
      name,
      closable: true,
      sql: content,
    })
    activeTabId.value = id
  }
  if (fqn && !sql) activeTableId.value = fqn.replace(/\./g, '_')
  showToast(sql ? '已从深链载入 SQL 草稿（未自动执行）' : `已预插表 ${fqn}（未自动执行）`, 'info')
}

watch(
  () => [route.query.sql, route.query.fqn],
  () => applyDeepLink(),
)

onMounted(async () => {
  await Promise.all([loadSchemaTree(), loadHistory(), loadSavedScripts(), loadElevateStatus()])
  applyDeepLink()
})

async function loadElevateStatus() {
  try {
    const ov = await fetchQueryGovOverview()
    elevateAllowed.value = !!ov?.scanElevateAllowed
    if (elevateAllowed.value) elevateScan.value = false
  } catch {
    elevateAllowed.value = false
  }
}

watch(currentWs, () => {
  Promise.all([loadSchemaTree(), loadHistory(), loadSavedScripts()]).catch(() => {})
})

function onCatResizeStart(e) {
  e.preventDefault()
  catResizing.value = true
  const startX = e.clientX
  const startW = catWidth.value
  const onMove = (ev) => {
    const next = Math.min(520, Math.max(220, startW + (ev.clientX - startX)))
    catWidth.value = next
  }
  const onUp = () => {
    catResizing.value = false
    localStorage.setItem('lh.query.catWidth', String(catWidth.value))
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function toggleNode(node) {
  if (node.type === 'datasource' || node.type === 'catalog' || node.type === 'schema') {
    node.open = !node.open
  }
}

async function toggleTableCols(table, e) {
  e?.stopPropagation()
  if (!table) return
  table.open = !table.open
  if (table.open) await ensureColumns(table)
}

/** Trino /v1/statement 不接受结尾分号；只去掉末尾一个，不拆多语句。 */
function withoutTrailingSemicolon(sql) {
  const s = String(sql ?? '').trim()
  if (s.endsWith(';')) return s.slice(0, -1).trim()
  return s
}

function insertTable(table) {
  if (!table?.sampleSql || table.runnable === false) {
    showToast(table?.message || '无法插入：未进入即席查询面或无权限', 'warning')
    return
  }
  activeTableId.value = table.id
  sqlText.value = withoutTrailingSemicolon(table.sampleSql)
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
      ws: currentWs.value || 'default',
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
        ws: currentWs.value || 'default',
        queryId: lastMeta.value.queryId,
        sql: sqlText.value,
        columns: cols,
        rows: resultRows.value.slice(0, 200),
        scanBytes: lastMeta.value.scanBytes,
      })
      apiOnline.value = true
      const storage = data?.sampleStorage === 'object' ? '对象存储' : '门户降级'
      const uriHint = data?.sampleUri ? ` · ${data.sampleUri}` : ''
      showToast(
        `已保存数据集 ${data?.name || name}（${data?.rowCount ?? Math.min(resultRows.value.length, 200)} 行抽样 · ${storage}${uriHint}）`,
        data?.sampleDegraded ? 'warning' : 'success',
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
      ws: currentWs.value || 'default',
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
      showToast('EXPLAIN 完成，可打开查询引擎控制台查看详情', 'success')
    } else {
      showToast('EXPLAIN 完成', 'success')
    }
  } catch (e) {
    showToast(e?.message || 'EXPLAIN 失败', 'error')
  } finally {
    running.value = false
  }
}

/** 开发脚本路径只允许 ASCII；页签名「查询 1」不能直接当文件名 */
function scriptFileName(raw) {
  const base = String(raw || '').trim().replace(/\\/g, '/').split('/').pop() || ''
  const withExt = /\.sql$/i.test(base) ? base : base ? `${base}.sql` : ''
  if (/^[A-Za-z0-9][A-Za-z0-9_.-]*\.sql$/i.test(withExt) && !/^unsaved_/i.test(withExt)) {
    return withExt
  }
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  return `from_query_${stamp}.sql`
}

function onSaveAsDevelopDraft() {
  const sql = String(sqlText.value || '').trim()
  if (!sql) {
    showToast('当前无 SQL 可存为开发草稿', 'warning')
    return
  }
  const tab = activeTab.value
  const name = scriptFileName(tab?.name)
  router.push({
    path: '/develop',
    query: { importSql: sql, name },
  })
}

function onSaveSql() {
  const tab = activeTab.value
  if (!tab) return
  const sql = String(sqlText.value || '').trim()
  if (!sql) {
    showToast('当前无 SQL 可保存', 'warning')
    return
  }
  let name = tab.name
  if (/^unsaved_/i.test(name) || name.startsWith('untitled') || name.startsWith('draft_') || /^查询\s*\d+$/.test(name)) {
    const suggested = `query_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.sql`
    const input = window.prompt('保存脚本名称', suggested)
    if (!input) return
    name = input.endsWith('.sql') ? input : `${input}.sql`
  }
  saveQueryScript({
    id: tab.savedId || undefined,
    name,
    ws: currentWs.value || 'default',
    sql,
    engine: 'trino',
  })
    .then((row) => {
      tab.name = row?.name || name
      tab.savedId = row?.id || tab.savedId
      tab.savedAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      showToast(row?.message || `已保存脚本 ${tab.name}`, 'success')
      return loadSavedScripts()
    })
    .catch((e) => showToast(e?.message || '保存脚本失败', 'warning'))
}

async function loadSavedScripts() {
  try {
    savedScripts.value = (await fetchQueryScripts({ ws: currentWs.value || 'default', limit: 30 })) || []
  } catch {
    savedScripts.value = []
  }
}

function openSavedScript(row) {
  if (!row?.sql) return
  const id = `tab_saved_${row.id || Date.now()}`
  tabs.value.push({
    id,
    name: row.name || 'saved.sql',
    closable: true,
    sql: row.sql,
    savedId: row.id || '',
  })
  activeTabId.value = id
  showToast(`已打开 ${row.name}`, 'success')
}

function summarize(sql) {
  const one = String(sql || '').replace(/\s+/g, ' ').trim()
  return one.length > 56 ? `${one.slice(0, 56)}…` : one
}

/** 在目录树中按 id / assetId / fqn 找表节点 */
function findTableNode(idOrFqn) {
  const q = String(idOrFqn || '').trim()
  if (!q) return null
  for (const ds of catalog) {
    for (const sch of ds.children || []) {
      for (const tb of sch.children || []) {
        if (!tb || tb.type !== 'table') continue
        if (
          tb.id === q ||
          tb.assetId === q ||
          tb.fqn === q ||
          tb.queryFqn === q ||
          tb.gravFqn === q
        ) {
          return tb
        }
      }
    }
  }
  return null
}

/** 从 SQL 提取 catalog.schema.table */
function parseFqnsFromSql(sql) {
  const re =
    /(?:from|join)\s+(?:"([^"]+)"|`([^`]+)`|([A-Za-z_][\w$]*))\s*\.\s*(?:"([^"]+)"|`([^`]+)`|([A-Za-z_][\w$]*))\s*\.\s*(?:"([^"]+)"|`([^`]+)`|([A-Za-z_][\w$]*))/gi
  const out = []
  let m
  while ((m = re.exec(String(sql || '')))) {
    const cat = m[1] || m[2] || m[3]
    const sch = m[4] || m[5] || m[6]
    const tbl = m[7] || m[8] || m[9]
    if (cat && sch && tbl) out.push(`${cat}.${sch}.${tbl}`)
  }
  return out
}

/** 即席 → 申请中心：优先当前选中表，否则解析 SQL 中的表 */
function resolveApplyTableContext(sql) {
  const active = findTableNode(activeTableId.value)
  if (active) {
    return {
      assetId: active.assetId || (String(active.id || '').match(/^\d+$/) ? active.id : '') || '',
      assetCode: active.assetCode || '',
      name: active.hint || active.name || '',
      fqn: active.queryFqn || active.fqn || '',
    }
  }
  const fqns = parseFqnsFromSql(sql || sqlText.value)
  for (const fqn of fqns) {
    const node = findTableNode(fqn)
    if (node) {
      return {
        assetId: node.assetId || (String(node.id || '').match(/^\d+$/) ? node.id : '') || '',
        assetCode: node.assetCode || '',
        name: node.hint || node.name || '',
        fqn: node.queryFqn || node.fqn || fqn,
      }
    }
  }
  if (fqns[0]) {
    const parts = fqns[0].split('.')
    return {
      assetId: '',
      assetCode: parts[parts.length - 1] || '',
      name: parts[parts.length - 1] || fqns[0],
      fqn: fqns[0],
    }
  }
  return null
}

function goApplySelect(sql) {
  const ctx = resolveApplyTableContext(sql)
  const query = { type: 'perm', privilege: 'SELECT', from: 'query' }
  if (ctx?.assetId) query.assetId = ctx.assetId
  if (ctx?.assetCode) query.assetCode = ctx.assetCode
  if (ctx?.name) query.name = ctx.name
  if (ctx?.fqn) query.fqn = ctx.fqn
  router.push({ path: '/apply', query })
}

function goApplyElevate() {
  router.push({
    path: '/apply',
    query: {
      type: 'scan_elevate',
      from: 'query',
      purpose: '即席查询需抬升扫描限额至平台硬顶 50GB',
    },
  })
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
    maskSource: data.maskSource || '',
    maskDegraded: !!data.maskDegraded,
    maskMessage: data.maskMessage || '',
    rowFilterApplied: !!data.rowFilterApplied,
    rowFilterSource: data.rowFilterSource || '',
    rowFilterDegraded: !!data.rowFilterDegraded,
    rowFilterMessage: data.rowFilterMessage || '',
    rowFilterPredicates: Array.isArray(data.rowFilterPredicates) ? data.rowFilterPredicates : [],
    elevated: !!data.elevated,
    authHint: data.authHint || '',
    message: data.message || '',
    stages: Array.isArray(data.stages) ? data.stages : progressStages.value.slice(),
  }
  if (data.elevatedAllowed != null) {
    elevateAllowed.value = !!data.elevatedAllowed
  }

  if (Array.isArray(data.stages) && data.stages.length) {
    progressStages.value = data.stages
  }

  if (data.blocked || data.status === 'blocked') {
    showToast(data.message || data.statusLabel || '查询被治理拦截', 'warning')
    if (data.errorCode === 'IMPERSONATION_DENIED') {
      showToast(
        '代执行未开通：服务账号无法冒充映射主体。请联系管理员开通身份代执行（与申请 SELECT 无关）',
        'warning',
      )
    } else if (data.errorCode === 'ELEVATE_DENIED') {
      const go = window.confirm(
        '扫描抬额（硬顶 50GB）须先经申请中心审批。是否前往申请？',
      )
      if (go) goApplyElevate()
    } else if (data.errorCode === 'ACCESS_DENIED' || data.applyHint) {
      const go = window.confirm('未授权访问表/列。是否前往申请中心申请 SELECT？')
      if (go) goApplySelect(sql)
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
    const maskNote = maskN
      ? ` · 脱敏 ${maskN} 列(${data.maskSource || 'policy'})`
      : (data.maskDegraded ? ' · 无引擎 mask 策略' : '')
    const rfN = Array.isArray(data.rowFilterPredicates) ? data.rowFilterPredicates.length : 0
    const rfNote = data.rowFilterApplied
      ? ` · 行级 ${rfN} 表`
      : (data.rowFilterDegraded ? ' · 无行级策略' : '')
    showToast(
      `查询完成 query_id=${data.queryId || '—'}${maskNote}${rfNote} · Scan ${lastMeta.value.scan}`,
      'success',
    )
  }
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
    ws: currentWs.value || 'default',
    maxRows: 1000,
    elevated: !!elevateScan.value,
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
      // 已收到 error 事件就不要再打一遍普通 POST，否则按钮会一直停在执行中
      if (streamErr?.sse) throw streamErr
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
    showResult.value = true
    lastMeta.value.status = 'failed'
    lastMeta.value.statusLabel = '失败'
    lastMeta.value.message = msg
    resultRows.value = []
    showToast(msg, 'error')
    if (/cannot impersonate|IMPERSONATION/i.test(msg)) {
      showToast('代执行未开通（无法冒充映射主体），请联系管理员开通身份代执行', 'warning')
    } else if (/未授权|无权限|denied|Forbidden|ACCESS_DENIED/i.test(msg)) {
      const go = window.confirm('可能未授权。是否前往申请中心？')
      if (go) goApplySelect(sql)
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
      page-id="query"
      title="即席 SQL 查询"
      subtitle="选表即查 · 权限与脱敏自动生效 · 扫描限额保护"
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

    <div v-if="catalogDegraded" class="banner-soft">
      Schema 树拉取失败，目录为空；请检查后端连通后刷新。限额：adhoc 默认 10GB / 硬顶 50GB。
    </div>

    <div class="banner-soft query-elevate-bar">
      扫描限额：默认 ≤10GB · 硬顶 50GB（须审批抬额）
      <label class="query-elevate">
        <input v-model="elevateScan" type="checkbox" />
        抬额至硬顶 {{ formatScanBytes(HARD_SCAN_LIMIT_BYTES) }}
        <template v-if="elevateAllowed">（已授权）</template>
        <template v-else>
          （未授权 ·
          <button type="button" class="btn-link" @click.prevent="goApplyElevate">去申请</button>）
        </template>
      </label>
    </div>

    <div class="query-layout" :class="{ resizing: catResizing }" :style="{ '--cat-w': catWidth + 'px' }">
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
            placeholder="搜索数据源、schema、表、列"
            aria-label="搜索目录"
          />
        </div>
        <div class="cat-body">
          <div v-if="apiOnline && !catalog.length" class="cat-empty">
            暂无可用表：需为资产拥有者（或已获 SELECT），且已挂接元数据指针并进入查询面（默认仅
            <code>iceberg</code>）。关系库等登记 catalog <code>ds_*</code> 不会出现在即席目录——请登记湖表资产。
          </div>
          <template v-for="ds in catalog" :key="ds.id">
            <button
              v-if="showNode(ds, false)"
              type="button"
              class="cat-node datasource"
              :class="{ open: isOpen(ds) }"
              @click="toggleNode(ds)"
            >
              <span class="cat-chev" :class="{ open: isOpen(ds) }" aria-hidden="true" />
              <span class="cat-mark cat">源</span>
              <span class="cat-label">
                <span class="cat-name">{{ ds.name }}</span>
              </span>
              <span v-if="ds.engine" class="cat-engine">{{ ds.engine }}</span>
              <span class="cat-rows">{{ ds.tableCount ?? 0 }}</span>
            </button>
            <template v-if="isOpen(ds)">
              <template v-for="sch in ds.children || []" :key="sch.id">
                <button
                  v-if="showNode(sch, ancestorHit(ds))"
                  type="button"
                  class="cat-node schema"
                  :class="{ open: isOpen(sch) }"
                  @click="toggleNode(sch)"
                >
                  <span class="cat-chev" :class="{ open: isOpen(sch) }" aria-hidden="true" />
                  <span class="cat-label">
                    <span class="cat-name">{{ sch.name }}</span>
                  </span>
                  <span class="cat-rows">{{ sch.tableCount ?? (sch.children || []).length }}</span>
                </button>
                <template v-if="isOpen(sch)">
                  <div
                    v-for="tb in listedTables(sch, ancestorHit(ds) || ancestorHit(sch))"
                    :key="tb.id"
                    class="cat-table-block"
                    :class="{ active: tb.id === activeTableId }"
                  >
                    <div class="cat-node table">
                      <button type="button" class="cat-chev-btn" :aria-expanded="!!isOpen(tb)" @click="toggleTableCols(tb, $event)">
                        <span class="cat-chev" :class="{ open: isOpen(tb) }" aria-hidden="true" />
                      </button>
                      <button type="button" class="cat-table-main" @click="insertTable(tb)">
                        <span v-if="tb.star" class="cat-star" title="常用">★</span>
                        <span class="cat-name">{{ tb.name }}</span>
                        <span v-if="tb.hint" class="cat-hint">{{ tb.hint }}</span>
                      </button>
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
                    v-if="hiddenTableCount(sch, ancestorHit(ds) || ancestorHit(sch))"
                    type="button"
                    class="cat-more"
                    @click="sch.showAll = true"
                  >
                    还有 {{ hiddenTableCount(sch, ancestorHit(ds) || ancestorHit(sch)) }} 张表
                  </button>
                </template>
              </template>
            </template>
          </template>
          <div v-if="catalogQuery.trim() && !visibleTableCount" class="cat-empty">
            没有匹配「{{ catalogQuery.trim() }}」的库表
          </div>
        </div>
        <div class="cat-foot">仅展示已授权 / 拥有者可用表 · 点表插入 SQL · 展开看列</div>
        <div
          class="cat-resizer"
          title="拖动调整宽度"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整目录宽度"
          @mousedown="onCatResizeStart"
        />
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
              {{ lastMeta.authHint || '统一鉴权 · 列脱敏 · 行级策略' }}
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
                <template v-if="lastMeta.maskSource"> · {{ lastMeta.maskSource }}</template>
              </span>
              <span
                v-else-if="lastMeta.maskDegraded"
                class="tag tag-orange"
                :title="lastMeta.maskMessage || '无列级脱敏策略，结果可能含明文敏感列'"
              >策略降级 · 无引擎脱敏</span>
              <span
                v-if="lastMeta.rowFilterApplied"
                class="tag tag-blue"
                :title="lastMeta.rowFilterMessage || '已注入 sec_auth_grant.row_filter'"
              >
                行级过滤生效
                <template v-if="lastMeta.rowFilterPredicates?.length">
                  · {{ lastMeta.rowFilterPredicates.length }} 表
                </template>
                <template v-if="lastMeta.rowFilterSource"> · {{ lastMeta.rowFilterSource }}</template>
              </span>
              <span
                v-else-if="lastMeta.rowFilterDegraded"
                class="tag tag-orange"
                :title="lastMeta.rowFilterMessage || '无生效的行级策略，查询未强制过滤'"
              >策略降级 · 无行级过滤</span>
              <a
                v-if="lastMeta.trinoUiUrl"
                class="btn btn-sm"
                :href="lastMeta.trinoUiUrl"
                target="_blank"
                rel="noopener noreferrer"
              >查询控制台</a>
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
                  <td :colspan="Math.max(resultColumns.length, 1)" class="empty">
                    {{ lastMeta.status === 'failed' ? lastMeta.message || '查询失败' : '无数据行' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <section class="card">
          <div class="card-header">
            <div class="card-title">已保存脚本 {{ savedScripts.length }}</div>
            <button type="button" class="btn btn-sm" @click="loadSavedScripts">刷新</button>
          </div>
          <div class="card-body" style="padding: 0; overflow: auto">
            <table class="table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>摘要</th>
                  <th>更新</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!savedScripts.length">
                  <td colspan="3" class="empty">暂无保存脚本 · 点「保存脚本」写入 cp_query_saved</td>
                </tr>
                <tr
                  v-for="s in savedScripts"
                  :key="s.id"
                  class="hist-row"
                  @click="openSavedScript(s)"
                >
                  <td>{{ s.name }}</td>
                  <td><code>{{ s.sqlSummary || '—' }}</code></td>
                  <td>{{ s.updateTime || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <div class="card-title">近 {{ history.length }} 条查询历史</div>
            <div style="display: flex; gap: 8px; align-items: center">
              <button type="button" class="btn btn-sm" @click="loadHistory">刷新</button>
            </div>
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
  grid-template-columns: var(--cat-w, 300px) 1fr;
  gap: 16px;
  align-items: start;
}
.query-layout.resizing {
  cursor: col-resize;
  user-select: none;
}
@media (max-width: 960px) {
  .query-layout { grid-template-columns: 1fr; }
  .cat-resizer { display: none; }
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
.cat-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 2;
}
.cat-resizer::after {
  content: '';
  position: absolute;
  top: 12px;
  bottom: 12px;
  right: 2px;
  width: 2px;
  border-radius: 1px;
  background: transparent;
  transition: background 0.12s ease;
}
.cat-resizer:hover::after,
.query-layout.resizing .cat-resizer::after {
  background: var(--primary);
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
.cat-node.datasource {
  font-weight: 600;
  color: var(--text-1);
  margin-top: 2px;
}
.cat-node.schema { padding-left: 10px; }
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
.query-elevate-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.query-elevate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
.query-elevate .btn-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--primary);
  cursor: pointer;
  font-size: inherit;
}
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
