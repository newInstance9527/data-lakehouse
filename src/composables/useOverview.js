/**
 * 总览仪表盘：复用各模块 page/kpi/overview 接口做轻量聚合。
 * 无后端能力的模块（数据服务调用量）标记 unavailable，由视图隐藏或「暂无」。
 */
import { computed, ref, watch } from 'vue'
import { pageMyTickets, pagePendingTickets } from '@/api/apply'
import { fetchAssetPage, sensitivityToLevel } from '@/api/catalog'
import { fetchDatasourceKpi, fetchDatasourcePage } from '@/api/datasource'
import { fetchEtlDags, fetchEtlRuns } from '@/api/etl'
import { fetchLineageFields } from '@/api/lineage'
import { fetchMetricOverview } from '@/api/metric'
import { fetchDataapiOverview } from '@/api/dataapi.js'
import { fetchQualityGold, fetchQualityOverview, fetchQualityTrend } from '@/api/quality'
import { fetchStdNamings, fetchStdOverview } from '@/api/standard'
import { layerMeta } from '@/data/assetMeta'

/** 总览时间范围 → 质量 API range */
const RANGE_TO_QUALITY = {
  '1d': '1',
  '7d': '7',
  '30d': '30',
  q: '30',
}

function pageTotal(page) {
  if (!page) return 0
  const t = page.total ?? page.totalRows
  return t != null ? Number(t) : (page.records || []).length
}

function numQuality(v) {
  if (v == null || v === '' || v === '—') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mapRunStatus(st) {
  const s = String(st || '').toLowerCase()
  if (s === 'success' || s === 'done') return 'success'
  if (s === 'failed' || s === 'error') return 'failed'
  if (s === 'blocked') return 'blocked'
  if (s === 'running' || s === 'submitted' || s === 'pending') return 'running'
  return 'other'
}

export function useOverview() {
  const loading = ref(false)
  const loaded = ref(false)
  const lastError = ref(null)
  const range = ref('30d')

  const dsStats = ref({ total: 0, online: 0, warn: 0, paused: 0, types: 0, healthPct: 0 })
  const assetStats = ref({
    total: 0,
    sampleSize: 0,
    byLayer: {},
    gold: 0,
    sensitive: 0,
    domains: 0,
  })
  const etlStats = ref({
    total: 0,
    prod: 0,
    draft: 0,
    paused: 0,
    other: 0,
    runTotal: 0,
    runSuccess: 0,
    runFailed: 0,
    runBlocked: 0,
    runRunning: 0,
  })
  const qualityStats = ref({
    avg: 0,
    passRate: 0,
    high: 0,
    mid: 0,
    low: 0,
    blocked: 0,
    goldCount: 0,
    ruleCount: 0,
    runCount: 0,
    hasBucket: false,
  })
  const qualityTrend = ref({ labels: [], values: [], min: 0, max: 0 })
  const stdStats = ref({
    fields: 0,
    codes: 0,
    namings: 0,
    mappings: 0,
    okPct: 0,
    warn: 0,
  })
  const lineageStats = ref({
    tables: 0,
    tableEdges: 0,
    fieldEdges: 0,
    explicit: 0,
    inferred: 0,
    tasks: 0,
  })
  const applyStats = ref({ pending: 0, mine: 0 })
  const metricStats = ref({
    total: 0,
    atom: 0,
    derive: 0,
    composite: 0,
    active: 0,
  })
  const serviceStats = ref({
    calls24h: null,
    avgLatencyMs: null,
    published: 0,
    draft: 0,
    sqlrestOnline: null,
    sqlrestTotal: null,
    loaded: false,
  })

  /** 无真实后端/统计能力的区块 */
  const availability = computed(() => ({
    datasource: true,
    assets: true,
    etl: true,
    quality: true,
    qualityTrend: true,
    lineage: true,
    standard: true,
    apply: true,
    metrics: true,
    serviceCalls: serviceStats.value.loaded,
    apiPublish: serviceStats.value.loaded,
  }))

  async function loadAll(rangeKey = range.value) {
    loading.value = true
    lastError.value = null
    const qRange = RANGE_TO_QUALITY[rangeKey] || '30'
    try {
      const results = await Promise.allSettled([
        fetchDatasourceKpi(),
        fetchDatasourcePage({}, { current: 1, size: 500 }),
        fetchAssetPage({}, { current: 1, size: 500 }),
        fetchEtlDags({}, { current: 1, size: 200 }),
        fetchEtlRuns({ current: 1, size: 100 }),
        fetchQualityOverview({ range: qRange }),
        fetchQualityTrend({ range: qRange }),
        fetchQualityGold({ limit: 50 }),
        fetchStdOverview(),
        fetchStdNamings({}, { current: 1, size: 1 }),
        fetchLineageFields({}, { current: 1, size: 500 }),
        pagePendingTickets({ current: 1, size: 1 }),
        pageMyTickets({ current: 1, size: 1 }),
        fetchMetricOverview(),
        fetchDataapiOverview().catch(() => null),
      ])

      const val = (i) => (results[i].status === 'fulfilled' ? results[i].value : null)
      const errFirst = results.find((r) => r.status === 'rejected')
      if (errFirst?.status === 'rejected') {
        lastError.value = errFirst.reason
      }

      // 数据源
      const kpi = val(0)
      const dsPage = val(1)
      const dsRows = dsPage?.records || []
      if (kpi) {
        const total = Number(kpi.total) || 0
        const online = Number(kpi.online) || 0
        const warn = Number(kpi.warn) || 0
        const paused = Number(kpi.paused) || 0
        dsStats.value = {
          total,
          online,
          warn,
          paused,
          types: Number(kpi.typeCount) || 0,
          healthPct: total ? Math.round((online / total) * 1000) / 10 : 0,
        }
      } else if (dsRows.length || dsPage) {
        const online = dsRows.filter((s) => s.status === 'online').length
        const warn = dsRows.filter((s) => s.status === 'warn').length
        const paused = dsRows.filter((s) => s.status === 'paused').length
        const total = pageTotal(dsPage) || dsRows.length
        dsStats.value = {
          total,
          online,
          warn,
          paused,
          types: new Set(dsRows.map((s) => s.type).filter(Boolean)).size,
          healthPct: total ? Math.round((online / Math.max(dsRows.length, 1)) * 1000) / 10 : 0,
        }
      }

      // 资产
      const assetPage = val(2)
      const assets = assetPage?.records || []
      const byLayer = {}
      let gold = 0
      let sensitive = 0
      const domains = new Set()
      const qScores = []
      assets.forEach((a) => {
        const hit = layerMeta(a.layer)
        const layer =
          a.layerLabel ||
          (hit && hit.value === a.layer ? hit.label : null) ||
          a.layer ||
          '其他'
        byLayer[layer] = (byLayer[layer] || 0) + 1
        if (a.isGold) gold += 1
        const level = sensitivityToLevel(a.sensitivity) || a.level || ''
        if (level === '敏感' || level === '机密') sensitive += 1
        const d = a.domainCode || a.domain
        if (d) domains.add(d)
        const qs = numQuality(a.qualityScore ?? a.quality ?? a.extras?.quality?.score)
        if (qs != null) qScores.push(qs)
      })
      assetStats.value = {
        total: pageTotal(assetPage) || assets.length,
        sampleSize: assets.length,
        byLayer,
        gold,
        sensitive,
        domains: domains.size,
      }

      // ETL
      const dagPage = val(3)
      const dags = dagPage?.records || []
      const prod = dags.filter((t) => t.status === 'prod').length
      const draft = dags.filter((t) => t.status === 'draft').length
      const paused = dags.filter((t) => t.status === 'paused').length
      const runPage = val(4)
      const runs = runPage?.records || []
      let runSuccess = 0
      let runFailed = 0
      let runBlocked = 0
      let runRunning = 0
      runs.forEach((r) => {
        const st = mapRunStatus(r.status)
        if (st === 'success') runSuccess += 1
        else if (st === 'failed') runFailed += 1
        else if (st === 'blocked') runBlocked += 1
        else if (st === 'running') runRunning += 1
      })
      etlStats.value = {
        total: pageTotal(dagPage) || dags.length,
        prod,
        draft,
        paused,
        other: Math.max(0, dags.length - prod - draft - paused),
        runTotal: pageTotal(runPage) || runs.length,
        runSuccess,
        runFailed,
        runBlocked,
        runRunning,
      }

      // 质量
      const qOv = val(5)
      const qTrend = val(6) || []
      const qGold = val(7) || []
      let high = 0
      let mid = 0
      let low = 0
      if (qScores.length) {
        high = qScores.filter((v) => v >= 95).length
        mid = qScores.filter((v) => v >= 80 && v < 95).length
        low = qScores.filter((v) => v < 80).length
      } else if (Array.isArray(qGold) && qGold.length) {
        qGold.forEach((g) => {
          const s = Number(g.score) || 0
          if (s >= 95) high += 1
          else if (s >= 80) mid += 1
          else low += 1
        })
      }
      qualityStats.value = {
        avg: Number(qOv?.avgScore ?? 0),
        passRate: Number(qOv?.passRate ?? 0),
        high,
        mid,
        low,
        blocked: Number(qOv?.blockCount ?? 0),
        goldCount: Number(qOv?.goldCount ?? gold),
        ruleCount: Number(qOv?.ruleCount ?? 0),
        runCount: Number(qOv?.runCount ?? 0),
        hasBucket: high + mid + low > 0,
      }

      const trendRows = Array.isArray(qTrend) ? qTrend : []
      const values = trendRows.map((d) => Number(d.score ?? 0))
      const labels = trendRows.map((d) => {
        const day = String(d.day || '')
        return day.length >= 10 ? day.slice(5) : day
      })
      if (Number(qOv?.runCount ?? 0) > 0 && values.length) {
        qualityTrend.value = {
          labels,
          values,
          min: Math.min(...values),
          max: Math.max(...values),
        }
      } else {
        qualityTrend.value = { labels: [], values: [], min: 0, max: 0 }
      }

      // 标准
      const stdOv = val(8)
      const namingPage = val(9)
      stdStats.value = {
        fields: Number(stdOv?.fieldCount ?? 0),
        codes: Number(stdOv?.codeCount ?? 0),
        namings: pageTotal(namingPage),
        mappings: Number(stdOv?.mappingCount ?? 0),
        okPct: Number(stdOv?.complianceRate ?? 0),
        warn: Number(stdOv?.pendingFixCount ?? 0),
      }

      // 血缘
      const linPage = val(10)
      const edges = linPage?.records || []
      const tableSet = new Set()
      let explicit = 0
      let inferred = 0
      edges.forEach((e) => {
        if (e.fromTable) tableSet.add(e.fromTable)
        if (e.toTable) tableSet.add(e.toTable)
        if (String(e.confidence || 'explicit') === 'explicit') explicit += 1
        else inferred += 1
      })
      lineageStats.value = {
        tables: tableSet.size,
        tableEdges: 0,
        fieldEdges: pageTotal(linPage) || edges.length,
        explicit,
        inferred,
        tasks: 0,
      }

      // 申请单
      const pendingPage = val(11)
      const minePage = val(12)
      applyStats.value = {
        pending: pageTotal(pendingPage),
        mine: pageTotal(minePage),
      }

      // 指标
      const metOv = val(13)
      if (metOv) {
        metricStats.value = {
          total: Number(metOv.total ?? 0),
          atom: Number(metOv.atomCount ?? 0),
          derive: Number(metOv.deriveCount ?? 0),
          composite: Number(metOv.compositeCount ?? 0),
          active: Number(metOv.activeCount ?? 0),
        }
      }

      // 数据服务 overview（含 callStats 富化）
      const dsOv = val(14)
      if (dsOv) {
        serviceStats.value = {
          calls24h: dsOv.calls24h != null ? Number(dsOv.calls24h) : null,
          avgLatencyMs: dsOv.avgLatencyMs != null ? Number(dsOv.avgLatencyMs) : null,
          published: Number(dsOv.publishedApis ?? 0),
          draft: Number(dsOv.draftApis ?? 0),
          sqlrestOnline: dsOv.sqlrestOnline != null ? Number(dsOv.sqlrestOnline) : null,
          sqlrestTotal: dsOv.sqlrestTotal != null ? Number(dsOv.sqlrestTotal) : null,
          loaded: true,
        }
      } else {
        serviceStats.value = {
          calls24h: null,
          avgLatencyMs: null,
          published: 0,
          draft: 0,
          sqlrestOnline: null,
          sqlrestTotal: null,
          loaded: false,
        }
      }

      loaded.value = true
    } catch (e) {
      lastError.value = e
      console.error('[overview] load failed', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    return loadAll(range.value)
  }

  watch(range, (v) => {
    loadAll(v).catch(() => {})
  })

  return {
    loading,
    loaded,
    lastError,
    range,
    dsStats,
    assetStats,
    etlStats,
    qualityStats,
    qualityTrend,
    stdStats,
    lineageStats,
    applyStats,
    metricStats,
    serviceStats,
    availability,
    loadAll,
    refresh,
  }
}
