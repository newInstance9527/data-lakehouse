/**
 * 数据质量（对接 /lh/quality）
 */
import { computed, ref } from 'vue'
import {
  createQualityTicket,
  fetchQualityGold,
  fetchQualityOverview,
  fetchQualityRules,
  fetchQualityTrend,
  fetchQualityTypeDist,
  upsertQualityRule,
} from '@/api/quality'

const overview = ref(null)
const trend = ref([])
const typeDist = ref([])
const gold = ref([])
const rules = ref([])
const loading = ref(false)
const loaded = ref(false)
const lastError = ref(null)
let loadPromise = null

const LEVEL_GRADIENT = {
  技术: 'linear-gradient(90deg,#5cdbd3,#00c48c)',
  标准: 'linear-gradient(90deg,#82aaff,#1e6fff)',
  业务: 'linear-gradient(90deg,#ea9bff,#722ed1)',
  时效: 'linear-gradient(90deg,#ffc069,#ffa940)',
}

function fmtNum(n) {
  if (n == null || n === '') return '—'
  const x = Number(n)
  if (Number.isNaN(x)) return String(n)
  return x.toLocaleString('en-US')
}

function normalizeRule(row) {
  if (!row) return null
  const okPct = row.okPct != null ? Number(row.okPct) : row.pass === false ? 0 : 100
  const displayId =
    row.ruleCode && row.tableName
      ? `${String(row.tableName).split('.').pop()}.${row.fieldName ? `${row.fieldName}.` : ''}${row.ruleCode}`
      : row.id
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
    raw: row,
  }
}

function buildMetrics(ov) {
  if (!ov) return []
  const avg = Number(ov.avgScore ?? 0)
  const passRate = Number(ov.passRate ?? 0)
  const goldCount = Number(ov.goldCount ?? 0)
  const blockCount = Number(ov.blockCount ?? 0)
  return [
    {
      title: '平均质量分',
      value: String(avg),
      unit: '分',
      ringPct: avg,
      ringColor: '#00c48c',
      ringText: `${Math.round(avg)}%`,
      sub: `规则 ${ov.ruleCount ?? 0} · 运行 ${ov.runCount ?? 0}`,
      subSuccess: true,
    },
    {
      title: '规则通过率',
      value: String(passRate),
      unit: '%',
      ringPct: passRate,
      ringColor: '#1e6fff',
      ringText: `${Math.round(passRate)}%`,
      sub: `共执行 ${ov.runCount ?? 0} 次 · 失败 ${ov.failCount ?? 0} 次`,
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
  const trendPoints = computed(() => buildTrendPoints(trend.value))
  const typeDistView = computed(() => normalizeTypeDist(typeDist.value))
  const goldTables = computed(() => normalizeGold(gold.value))
  const ruleList = computed(() => rules.value)
  const ruleTotal = computed(() => rules.value.length)

  async function loadAll(range = '30') {
    loading.value = true
    lastError.value = null
    try {
      const [ov, tr, td, g, page] = await Promise.all([
        fetchQualityOverview({ range }),
        fetchQualityTrend({ range }),
        fetchQualityTypeDist(),
        fetchQualityGold({ limit: 5 }),
        fetchQualityRules({}, { current: 1, size: 200 }),
      ])
      overview.value = ov
      trend.value = tr || []
      typeDist.value = td || []
      gold.value = g || []
      rules.value = (page?.records || []).map(normalizeRule).filter(Boolean)
      loaded.value = true
      return { overview: ov, rules: rules.value }
    } catch (e) {
      lastError.value = e
      console.error('[quality] load failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function ensureLoaded(range = '30') {
    if (loaded.value || loading.value || loadPromise) return loadPromise
    loadPromise = loadAll(range)
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
    const saved = await upsertQualityRule({
      ruleCode: name,
      ruleType: form.rtype,
      scope: form.scope || (field ? 'field' : 'table'),
      tableName: table,
      fieldName: field,
      exprText: form.expr || `${form.rtype} · 待配置`,
      severity: form.sev,
    })
    const row = normalizeRule(saved)
    const idx = rules.value.findIndex((r) => r.id === row.id)
    if (idx >= 0) rules.value[idx] = row
    else rules.value.unshift(row)
    try {
      overview.value = await fetchQualityOverview({})
      typeDist.value = await fetchQualityTypeDist()
    } catch {
      /* ignore */
    }
    return row
  }

  async function openTicket(ruleId, remark) {
    return createQualityTicket({ ruleId, remark })
  }

  return {
    overview,
    metrics,
    trendPoints,
    typeDistView,
    goldTables,
    ruleList,
    ruleTotal,
    loading,
    loaded,
    lastError,
    ensureLoaded,
    loadAll,
    reloadByRange,
    createRule,
    openTicket,
  }
}
