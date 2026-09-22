/**
 * 存储趋势分册（对接 /lh/lifecycle/storage/* · doc/存储趋势.md）
 * 失败时回退 data/storageTrend 演示数据。
 */
import { computed, ref } from 'vue'
import {
  fetchLcStorageAdvice,
  fetchLcStorageBuckets,
  fetchLcStorageShowback,
  fetchLcStorageSummary,
  fetchLcStorageTables,
  fetchLcStorageTrend,
} from '@/api/lifecycle'
import {
  ST_ADVICE,
  ST_ANOMALIES,
  ST_CAPACITY,
  ST_DAILY,
  ST_KPIS,
  ST_LAYERS,
  ST_TOP_GROWTH,
  stBarHeight,
  stGrowthCls,
} from '@/data/storageTrend'

const LAYER_COLOR = {
  ODS: '#4d8dff',
  DWD: '#3dd68c',
  DWS: '#a78bfa',
  ADS: '#e6b450',
  DIM: '#94a3b8',
  OTHER: '#94a3b8',
  'DIM / 其它': '#94a3b8',
}

const BUCKET_GRADIENT = {
  ok: 'linear-gradient(90deg,#3dd68c,#4d8dff)',
  warn: 'linear-gradient(90deg,#e6b450,#f97316)',
  danger: 'linear-gradient(90deg,#ff7875,#cf1322)',
}

function n(v, d = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}

export function humanBytes(bytes) {
  const b = n(bytes)
  if (b <= 0) return '0 B'
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(2)} TB`
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(0)} GB`
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`
  return `${Math.round(b / 1024)} KB`
}

function splitSize(bytes) {
  const label = humanBytes(bytes)
  const m = label.match(/^([\d.]+)\s*(\S+)$/)
  if (!m) return { value: '—', unit: '' }
  return { value: m[1], unit: m[2] }
}

function growthLabel(pct, range) {
  if (pct == null || pct === '') return '—'
  const x = n(pct)
  const sign = x > 0 ? '+' : ''
  return `${sign}${x.toFixed(1)}% / ${range || '30d'}`
}

function attrLabel(attr) {
  return (
    {
      small_file: '小文件膨胀',
      snapshot_bloat: '快照膨胀',
      business_growth: '业务增长',
      orphan: '孤儿文件',
      collect_fail: '采集异常',
    }[attr] || attr || '关注增长'
  )
}

function actionLabel(kind) {
  return (
    {
      compact: '去合并',
      expire: '去过期',
      archive: '去归档',
      orphan: '去孤儿清理',
      catalog: '看资产',
      lifecycle: '打开生命周期',
    }[kind] || '去执行'
  )
}

export function useStorageTrend() {
  const loading = ref(false)
  const loaded = ref(false)
  const lastError = ref(null)
  const range = ref('30d')
  const tableFilter = ref('anomaly')

  const summary = ref(null)
  const trend = ref(null)
  const tablesPage = ref(null)
  const buckets = ref([])
  const advice = ref([])
  const showback = ref(null)

  const kpis = computed(() => {
    const s = summary.value
    if (!s) return ST_KPIS
    const phys = splitSize(s.physicalBytes)
    const act = splitSize(s.activeBytes)
    const rec = splitSize(s.reclaimableBytes)
    const net = splitSize(s.netGrowthBytes)
    const tight = s.tightestBucket
    const ttf = tight?.daysToFullP95
    return [
      {
        icon: '💾',
        color: 'blue',
        value: phys.value,
        unit: phys.unit,
        label: '物理占用',
        trend: `口径 total · ${s.range || range.value}`,
      },
      {
        icon: '📊',
        color: 'green',
        value: act.value,
        unit: act.unit,
        label: '活跃量',
        trend: '口径 active',
      },
      {
        icon: '♻️',
        color: 'orange',
        value: rec.value,
        unit: rec.unit,
        label: '可回收',
        trend: `占比 ${s.reclaimablePct ?? '—'}%`,
        trendDown: n(s.reclaimablePct) > 15,
      },
      {
        icon: '📈',
        color: 'purple',
        value: net.value,
        unit: net.unit,
        label: `${s.range || range.value} 净增`,
        trend: n(s.netGrowthBytes) >= 0 ? '窗口净增长' : '窗口净下降',
      },
      {
        icon: '⏳',
        color: 'red',
        value: ttf != null ? String(ttf) : '—',
        unit: '天',
        label: '最紧桶 TTF(p95)',
        trend: tight?.bucket ? String(tight.bucket) : '样本不足则不出',
        trendDown: ttf != null && ttf < 45,
      },
    ]
  })

  const daily = computed(() => {
    const list = trend.value?.daily
    if (!list?.length) return ST_DAILY
    return list.map((d) => ({
      day: d.day || (d.date || '').slice(5),
      date: d.date,
      total: Number((n(d.totalBytes) / 1024 ** 4).toFixed(2)),
      active: Number((n(d.activeBytes) / 1024 ** 4).toFixed(2)),
      reclaimable: Number((n(d.reclaimableBytes) / 1024 ** 4).toFixed(2)),
      growth: '',
    }))
  })

  const layers = computed(() => {
    const series = trend.value?.series
    if (!series?.length) return ST_LAYERS
    return series.map((l) => ({
      layer: l.layer || l.key,
      size: humanBytes(l.activeBytes ?? l.totalBytes),
      growth: growthLabel(l.growthPct, range.value),
      pct: Math.max(1, Math.round(n(l.pct))),
      color: LAYER_COLOR[l.layer || l.key] || LAYER_COLOR.OTHER,
      note: humanBytes(l.netGrowthBytes || 0) + ' 净增',
    }))
  })

  const capacityRows = computed(() => {
    if (!buckets.value.length) return ST_CAPACITY
    return buckets.value.map((b) => {
      const alert = b.alert || 'ok'
      const used = humanBytes(b.usedBytes)
      const cap = humanBytes(b.capacityBytes)
      return {
        label: b.bucket,
        pct: Math.min(100, Math.round(n(b.usagePct))),
        used: used.replace(/\s*\S+$/, ''),
        cap: `${cap} · ${b.usagePct ?? '—'}% · TTF ${b.daysToFullP95 ?? '—'}d`,
        gradient: BUCKET_GRADIENT[alert] || BUCKET_GRADIENT.ok,
        alert,
        tier: b.tier,
      }
    })
  })

  const topGrowth = computed(() => {
    const list = tablesPage.value?.list
    if (!list?.length) return ST_TOP_GROWTH
    return [...list]
      .sort((a, b) => n(b.growthPct) - n(a.growthPct))
      .slice(0, 3)
      .map((a) => ({
        table: a.fqtn || a.tableFqn,
        growth: growthLabel(a.growthPct, range.value),
        tip: actionLabel(a.suggestedAction),
        danger: n(a.growthPct) >= 8 || a.anomaly,
      }))
  })

  const adviceCards = computed(() => {
    if (!advice.value.length) return ST_ADVICE
    return advice.value.map((a) => ({
      id: a.id,
      pri: a.priorityLabel || (a.priority === 1 ? 'P1' : 'P2'),
      priCls: a.priority === 1 ? 'tag-red' : 'tag-orange',
      title: a.fqtn
        ? `${a.fqtn} · ${actionLabel(a.kind)}`
        : `${actionLabel(a.kind)} · 预计回收 ${humanBytes(a.estReclaimBytes)}`,
      detail: `${humanBytes(a.estReclaimBytes)} · 置信 ${a.confidence || '—'} · ${a.reason || ''}`,
      act: a.kind || 'lifecycle',
      actLabel: '去生命周期执行 →',
      table: a.fqtn || '',
      adviceId: a.id,
      deepLink: a.deepLink,
    }))
  })

  const tableRows = computed(() => {
    const list = tablesPage.value?.list
    if (!list?.length) {
      return tableFilter.value === 'anomaly' || tableFilter.value === 'all'
        ? ST_ANOMALIES
        : []
    }
    return list.map((a) => {
      const kind = a.suggestedAction || 'catalog'
      return {
        table: a.fqtn || a.tableFqn,
        ws: a.ws || '—',
        layer: a.layer || '—',
        active: humanBytes(a.activeBytes),
        total: humanBytes(a.totalBytes),
        reclaimable: humanBytes(a.reclaimableBytes),
        growth: growthLabel(a.growthPct, range.value),
        netGrowth: humanBytes(a.netGrowthBytes),
        smallFile: a.smallFileRatio != null ? `${n(a.smallFileRatio).toFixed(0)}%` : '—',
        reason: attrLabel(a.attribution),
        status: a.anomaly ? 'warn' : 'ok',
        action: kind,
        actionLabel: actionLabel(kind),
        adviceId: null,
        deepLink: a.deepLink,
      }
    })
  })

  const showbackRows = computed(() => {
    const list = showback.value?.list
    if (!list?.length) return []
    return list.map((r) => ({
      ws: r.ws,
      active: humanBytes(r.activeBytes),
      total: humanBytes(r.totalBytes),
      quota: humanBytes(r.quotaBytes),
      quotaPct: r.quotaPct != null ? `${r.quotaPct}%` : '—',
      netGrowth: humanBytes(r.netGrowthBytes),
      owner: r.owner || '—',
      warn: r.status === 'QUOTA_WARN',
    }))
  })

  const collectBanner = computed(() => {
    const s = summary.value
    if (!s) return null
    return {
      status: s.collectStatus || 'STALE',
      collectedAt: s.collectedAt,
      source: s.source,
      caliberNote: s.caliberNote,
    }
  })

  const chartFoot = computed(() => {
    const list = daily.value
    if (!list.length) return { start: '—', end: '—', delta: '—' }
    const first = list[0]
    const last = list[list.length - 1]
    const deltaTb = n(last.total) - n(first.total)
    const sign = deltaTb >= 0 ? '+' : ''
    return {
      start: `${first.total} TB`,
      end: `${last.total} TB`,
      delta: `Δ ${sign}${(deltaTb * 1024).toFixed(0)} GB / ${range.value}`,
    }
  })

  async function loadAll(ws) {
    loading.value = true
    lastError.value = null
    const r = range.value
    try {
      const [sum, tr, tables, bucks, adv, sb] = await Promise.all([
        fetchLcStorageSummary(ws, r),
        fetchLcStorageTrend(ws, r),
        fetchLcStorageTables({
          ws,
          range: r,
          filter: tableFilter.value,
          sort: 'reclaimableBytes',
          order: 'desc',
          page: 1,
          size: 50,
        }),
        fetchLcStorageBuckets(ws),
        fetchLcStorageAdvice(ws),
        fetchLcStorageShowback(ws, r, 'ws').catch(() => null),
      ])
      summary.value = sum
      trend.value = tr
      tablesPage.value = tables
      buckets.value = bucks || []
      advice.value = adv || []
      showback.value = sb
      loaded.value = true
      return { summary: sum, trend: tr, tables, buckets: bucks, advice: adv, showback: sb }
    } catch (e) {
      lastError.value = e
      console.error('[storage-trend] load failed', e)
      summary.value = null
      trend.value = null
      tablesPage.value = null
      buckets.value = []
      advice.value = []
      showback.value = null
      loaded.value = true
      throw e
    } finally {
      loading.value = false
    }
  }

  async function setRange(next, ws) {
    range.value = next
    return loadAll(ws)
  }

  async function setTableFilter(next, ws) {
    tableFilter.value = next
    loading.value = true
    try {
      tablesPage.value = await fetchLcStorageTables({
        ws,
        range: range.value,
        filter: next,
        sort: 'reclaimableBytes',
        order: 'desc',
        page: 1,
        size: 50,
      })
    } finally {
      loading.value = false
    }
  }

  /** 深链参数：不在本页提交作业 */
  function lifecycleQuery(kind, table, adviceId) {
    const q = { from: 'storage-trend' }
    if (table) q.table = table
    if (kind && kind !== 'catalog' && kind !== 'lifecycle') q.action = kind
    if (adviceId) q.adviceId = adviceId
    return q
  }

  return {
    loading,
    loaded,
    lastError,
    range,
    tableFilter,
    summary,
    trend,
    tablesPage,
    buckets,
    advice,
    kpis,
    daily,
    layers,
    capacityRows,
    topGrowth,
    adviceCards,
    tableRows,
    showbackRows,
    collectBanner,
    chartFoot,
    loadAll,
    setRange,
    setTableFilter,
    lifecycleQuery,
    humanBytes,
    stBarHeight,
    stGrowthCls,
  }
}
