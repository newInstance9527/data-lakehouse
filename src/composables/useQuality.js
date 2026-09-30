/**
 * 数据质量（对接 /lh/quality）
 */
import { computed, ref } from 'vue'
import {
  createQualityTicket,
  deleteQualityGate,
  fetchQualityGates,
  fetchQualityGold,
  fetchQualityOverview,
  fetchQualityRules,
  fetchQualityRuns,
  fetchQualityTrend,
  fetchQualityTypeDist,
  syncQualityOm,
  upsertQualityGate,
  upsertQualityRule,
} from '@/api/quality'
import { resolveWs } from '@/utils/ws'
import { fetchAllPages } from '@/utils/pageFetch'
import { metricBindMetaOf } from '@/data/metricBindAssets'

const overview = ref(null)
const trend = ref([])
const typeDist = ref([])
const gold = ref([])
const rules = ref([])
const gates = ref([])
const loading = ref(false)
const loaded = ref(false)
const loadedWs = ref('')
const lastError = ref(null)
let loadPromise = null

const LEVEL_GRADIENT = {
  技术: 'linear-gradient(90deg,#5cdbd3,#059669)',
  标准: 'linear-gradient(90deg,#93c5fd,#2f6fed)',
  业务: 'linear-gradient(90deg,#c4b5fd,#7c3aed)',
  时效: 'linear-gradient(90deg,#ffc069,#d97706)',
}

function fmtNum(n) {
  if (n == null || n === '') return '—'
  const x = Number(n)
  if (Number.isNaN(x)) return String(n)
  return x.toLocaleString('en-US')
}

function isStreamJob(jobRunId, message) {
  const j = String(jobRunId || '')
  const m = String(message || '')
  return /^stream:/i.test(j) || /stream\s*probe/i.test(m)
}

function normalizeRule(row) {
  if (!row) return null
  const okPct = row.okPct != null ? Number(row.okPct) : row.pass === false ? 0 : 100
  const displayId =
    row.ruleCode && row.tableName
      ? `${String(row.tableName).split('.').pop()}.${row.fieldName ? `${row.fieldName}.` : ''}${row.ruleCode}`
      : row.id
  const jobRunId = row.jobRunId || ''
  return {
    id: row.id,
    displayId,
    ruleCode: row.ruleCode,
    assetId: row.assetId || '',
    table: row.tableName || row.table || '',
    field: row.fieldName || row.field || '',
    scope: row.scope || (row.fieldName ? 'field' : 'table'),
    layer: row.layer || '',
    level: row.ruleLevel || row.level || '技术',
    type: row.ruleType || row.type || '',
    expr: row.exprText || row.expr || '',
    pass: row.pass !== false && row.pass !== 0,
    ok: okPct,
    fail: Math.max(0, 100 - okPct),
    okRows: fmtNum(row.okRows),
    failRows: fmtNum(row.failRows),
    status: row.statusText || row.status || '—',
    alert: !!row.blocked,
    severity: row.severity,
    omTestFqn: row.omTestFqn || '',
    stdCodeSetId: row.stdCodeSetId || '',
    jobRunId,
    stream: isStreamJob(jobRunId, row.message),
    raw: row,
  }
}

function normalizeGate(row) {
  if (!row) return null
  return {
    id: row.id,
    layer: row.layer || '',
    tableName: row.tableName || '',
    assetId: row.assetId || '',
    minScore: row.minScore != null ? Number(row.minScore) : 95,
    blockOnFail: row.blockOnFail !== false && row.blockOnFail !== 0,
    raw: row,
  }
}

function buildMetrics(ov) {
  if (!ov) return []
  const empty = !!ov.empty || Number(ov.runCount ?? 0) === 0
  const avg = Number(ov.avgScore ?? 0)
  const passRate = Number(ov.passRate ?? 0)
  const goldCount = Number(ov.goldCount ?? 0)
  const blockCount = Number(ov.blockCount ?? 0)
  return [
    {
      title: '平均质量分',
      value: empty ? '—' : String(avg),
      unit: empty ? '' : '分',
      ringPct: empty ? 0 : avg,
      ringColor: '#00c48c',
      ringText: empty ? '暂无' : `${Math.round(avg)}%`,
      sub: empty ? '暂无质量运行' : `规则 ${ov.ruleCount ?? 0} · 运行 ${ov.runCount ?? 0}`,
      subSuccess: true,
    },
    {
      title: '规则通过率',
      value: empty ? '—' : String(passRate),
      unit: empty ? '' : '%',
      ringPct: empty ? 0 : passRate,
      ringColor: '#2f6fed',
      ringText: empty ? '暂无' : `${Math.round(passRate)}%`,
      sub: empty ? '暂无质量运行' : `共执行 ${ov.runCount ?? 0} 次 · 失败 ${ov.failCount ?? 0} 次`,
      subSuccess: false,
    },
    {
      title: '黄金数据集',
      value: String(goldCount),
      unit: '张',
      ringPct: Math.min(100, goldCount * 10),
      ringColor: '#722ed1',
      ringText: String(goldCount),
      sub: '质量≥95（按最近运行聚合）',
      subSuccess: false,
    },
    {
      title: '阻断 DAG',
      value: String(blockCount),
      unit: '次',
      ringPct: Math.min(100, blockCount * 10),
      ringColor: '#f5222d',
      ringText: String(blockCount),
      sub: blockCount ? '存在门禁阻断记录' : '近窗无阻断',
      subDanger: blockCount > 0,
      subSuccess: blockCount === 0,
    },
  ]
}

function buildTrendPoints(rows) {
  const list = Array.isArray(rows) ? rows : []
  return list.map((d) => {
    const v = Number(d.score ?? 0)
    const h = Math.max(4, Math.min(100, v))
    let cls = ''
    if (v < 90) cls = 'bad'
    else if (v < 95) cls = 'warn'
    return { v: Math.round(v), h, cls, day: d.day, blockCount: d.blockCount }
  })
}

function normalizeTypeDist(rows) {
  const list = Array.isArray(rows) ? rows : []
  return list.map((t) => ({
    label: t.label || '其他',
    count: t.count ?? 0,
    pct: Number(t.pct ?? 0),
    gradient: LEVEL_GRADIENT[t.label] || LEVEL_GRADIENT['技术'],
  }))
}

function normalizeGold(rows) {
  return (Array.isArray(rows) ? rows : []).map((g) => ({
    score: String(g.score ?? ''),
    table: g.table || '',
    assetKey: String(g.table || '')
      .split('.')
      .pop(),
    gold: g.gold !== false,
  }))
}

export function useQuality() {
  const metrics = computed(() => buildMetrics(overview.value))
  const omSummary = computed(() => {
    const om = overview.value?.om
    if (!om || typeof om !== 'object') {
      return { available: false, hint: '暂无 OM 摘要' }
    }
    return {
      available: !!om.available,
      health: om.health || '',
      sampledTables: Number(om.sampledTables ?? 0),
      profileOk: Number(om.profileOk ?? 0),
      testTotal: Number(om.testTotal ?? 0),
      testPass: Number(om.testPass ?? 0),
      testFail: Number(om.testFail ?? 0),
      testPassRate: om.testPassRate != null ? Number(om.testPassRate) : null,
      hint: om.hint || '',
      notes: Array.isArray(om.notes) ? om.notes : [],
    }
  })
  const streamSummary = computed(() => {
    const s = overview.value?.stream
    if (!s || typeof s !== 'object') {
      return { runCount: 0, failCount: 0, passCount: 0, lastAt: null, hint: '暂无流式摘要' }
    }
    return {
      runCount: Number(s.runCount ?? 0),
      failCount: Number(s.failCount ?? 0),
      passCount: Number(s.passCount ?? 0),
      lastAt: s.lastAt || null,
      hint: s.hint || '',
    }
  })
  const trendPoints = computed(() => buildTrendPoints(trend.value))
  const typeDistView = computed(() => normalizeTypeDist(typeDist.value))
  const goldTables = computed(() => normalizeGold(gold.value))
  const ruleList = computed(() => rules.value)
  const ruleTotal = computed(() => rules.value.length)
  const gateList = computed(() => gates.value)

  async function loadAll(range = '30', ws) {
    loading.value = true
    lastError.value = null
    try {
      const workspace = resolveWs(ws)
      if (loadedWs.value && loadedWs.value !== workspace) {
        rules.value = []
        gates.value = []
        overview.value = null
      }
      const q = { ws: workspace, range }
      const [ov, tr, td, g, ruleRecords, gt] = await Promise.all([
        fetchQualityOverview(q),
        fetchQualityTrend(q),
        fetchQualityTypeDist({ ws: workspace }),
        fetchQualityGold({ ws: workspace, limit: 5 }),
        fetchAllPages(({ current, size }) => fetchQualityRules(q, { current, size })),
        fetchQualityGates({ ws: workspace }),
      ])
      overview.value = ov
      trend.value = tr || []
      typeDist.value = td || []
      gold.value = g || []
      rules.value = ruleRecords.map(normalizeRule).filter(Boolean)
      gates.value = (Array.isArray(gt) ? gt : []).map(normalizeGate).filter(Boolean)
      loaded.value = true
      loadedWs.value = workspace
      return { overview: ov, rules: rules.value, gates: gates.value }
    } catch (e) {
      lastError.value = e
      console.error('[quality] load failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function ensureLoaded(range = '30', force = false) {
    const ws = resolveWs()
    if (!force && loaded.value && loadedWs.value === ws) return loadPromise
    if (loading.value && loadPromise && !force) return loadPromise
    loadPromise = loadAll(range, ws)
      .catch(() => {})
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  async function reloadByRange(range) {
    return loadAll(range)
  }

  async function createRule(form) {
    const name = String(form.name || '')
      .replace(/\s+/g, '_')
      .toUpperCase()
    const table = form.table
    const field = form.scope === 'field' ? form.field || '' : ''
    let stdCodeSetId = form.stdCodeSetId || ''
    let expr = form.expr || `${form.rtype} · 待配置`
    if (!stdCodeSetId && form.rtype === '枚举' && /^codeSet\s*=/i.test(String(expr).trim())) {
      stdCodeSetId = String(expr).replace(/^codeSet\s*=\s*/i, '').trim()
    }
    const meta = metricBindMetaOf(table)
    const saved = await upsertQualityRule({
      ruleCode: name,
      ruleType: form.rtype,
      scope: form.scope || (field ? 'field' : 'table'),
      tableName: table,
      fieldName: field,
      exprText: expr,
      severity: form.sev,
      stdCodeSetId: stdCodeSetId || undefined,
      assetId: form.assetId || meta?.assetId || undefined,
      ws: resolveWs(form.ws),
    })
    const row = normalizeRule(saved)
    const idx = rules.value.findIndex((r) => r.id === row.id)
    if (idx >= 0) rules.value[idx] = row
    else rules.value.unshift(row)
    try {
      const workspace = resolveWs(form.ws)
      overview.value = await fetchQualityOverview({ ws: workspace })
      typeDist.value = await fetchQualityTypeDist({ ws: workspace })
    } catch {
      /* ignore */
    }
    return row
  }

  async function saveGate(form) {
    const tableName = String(form.tableName || form.table || '').trim()
    const meta = tableName ? metricBindMetaOf(tableName) : null
    const saved = await upsertQualityGate({
      id: form.id,
      ws: resolveWs(form.ws),
      layer: form.layer || '',
      tableName,
      assetId: form.assetId || meta?.assetId || '',
      minScore: form.minScore != null && form.minScore !== '' ? Number(form.minScore) : 95,
      blockOnFail: form.blockOnFail !== false && form.blockOnFail !== 'false',
    })
    const row = normalizeGate(saved)
    const idx = gates.value.findIndex((g) => g.id === row.id)
    if (idx >= 0) gates.value[idx] = row
    else gates.value.unshift(row)
    return row
  }

  async function removeGate(id) {
    await deleteQualityGate(id)
    gates.value = gates.value.filter((g) => g.id !== id)
  }

  async function loadRuleRuns(ruleId, { current = 1, size = 20 } = {}) {
    if (!ruleId) return { records: [], total: 0 }
    const page = await fetchQualityRuns(ruleId, {
      ws: resolveWs(),
      current,
      size,
    })
    return {
      records: page?.records || [],
      total: Number(page?.total ?? page?.records?.length ?? 0),
    }
  }

  async function openTicket(ruleId, remark) {
    return createQualityTicket({ ruleId, remark })
  }

  async function syncOm() {
    const workspace = resolveWs()
    const r = await syncQualityOm({ ws: workspace })
    try {
      overview.value = await fetchQualityOverview({ ws: workspace })
      const ruleRecords = await fetchAllPages(({ current, size }) =>
        fetchQualityRules({ ws: workspace }, { current, size }),
      )
      rules.value = ruleRecords.map(normalizeRule).filter(Boolean)
    } catch {
      /* ignore refresh */
    }
    return r
  }

  return {
    overview,
    metrics,
    omSummary,
    streamSummary,
    trendPoints,
    typeDistView,
    goldTables,
    ruleList,
    ruleTotal,
    gateList,
    loading,
    loaded,
    lastError,
    ensureLoaded,
    loadAll,
    reloadByRange,
    createRule,
    saveGate,
    removeGate,
    loadRuleRuns,
    openTicket,
    syncOm,
  }
}
