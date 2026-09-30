/**
 * 存储趋势分册（对接 /lh/lifecycle/storage/* · doc/存储趋势.md）
 * API 失败：null/[] + lastError；无 create 种子。
 */
import { computed, ref } from 'vue'
import {
  exportLcStorageReport,
  fetchLcRuns,
  fetchLcStorageAdvice,
  fetchLcStorageBuckets,
  fetchLcStorageShowback,
  fetchLcStorageSummary,
  fetchLcStorageTableDetail,
  fetchLcStorageTables,
  fetchLcStorageTrend,
} from '@/api/lifecycle'
import {
  buildDetailCurveChart,
  buildDualLineChart,
  stBarHeight,
  stGrowthCls,
  triggerBase64Download,
  triggerBlobDownload,
} from '@/data/storageTrend'
import { resolveWs } from '@/utils/ws'

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

const EMPTY_KPIS = [
  { icon: '💾', color: 'blue', value: '—', unit: '', label: '物理占用', trend: '—' },
  { icon: '📊', color: 'green', value: '—', unit: '', label: '活跃量', trend: '—' },
  { icon: '♻️', color: 'orange', value: '—', unit: '', label: '可回收', trend: '—' },
  { icon: '📈', color: 'purple', value: '—', unit: '', label: '净增', trend: '—' },
  { icon: '⏳', color: 'red', value: '—', unit: '天', label: '最紧桶 TTF(p95)', trend: '—' },
]

export function useStorageTrend() {
  const loading = ref(false)
  const loaded = ref(false)
  const loadedWs = ref('')
  const lastError = ref(null)
  const range = ref('30d')
  const tableFilter = ref('anomaly')

  const summary = ref(null)
  const trend = ref(null)
  const tablesPage = ref(null)
  const buckets = ref([])
  const bucketsMeta = ref(null)
  const advice = ref([])
  const showback = ref(null)

  const detailOpen = ref(false)
  const detailLoading = ref(false)
  const detailData = ref(null)
  const detailError = ref(null)

  const kpis = computed(() => {
    const s = summary.value
    if (!s) return EMPTY_KPIS
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
    if (!list?.length) return []
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
    if (!series?.length) return []
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
    if (!buckets.value.length) return []
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
    if (!list?.length) return []
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
    if (!advice.value.length) return []
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
    if (!list?.length) return []
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
      storageCost: r.storageCostLabel || (r.storageCost != null ? `¥${Number(r.storageCost).toFixed(2)}` : '—'),
      owner: r.owner || '—',
      warn: r.status === 'QUOTA_WARN',
    }))
  })

  const showbackCostNote = computed(() => {
    const sb = showback.value
    if (!sb) return null
    const rate = sb.rates?.storagePerTbMonth
    const total = sb.totalStorageCost
    const parts = []
    if (rate != null) parts.push(`单价 ¥${rate}/TB·月`)
    if (total != null) parts.push(`合计 ${typeof total === 'number' ? `¥${total.toFixed(2)}` : total}`)
    if (sb.note) parts.push(String(sb.note).split('；')[0])
    return parts.length ? parts.join(' · ') : null
  })

  const collectBanner = computed(() => {
    const s = summary.value
    if (!s) return null
    const bucketSrc = bucketsMeta.value?.source
    const src = bucketSrc && String(bucketSrc).startsWith('vm:')
      ? `${s.source || 'profile'} · buckets ${bucketSrc}`
      : s.source
    return {
      status: s.collectStatus || 'STALE',
      collectedAt: s.collectedAt,
      source: src,
      caliberNote: s.caliberNote,
      bucketsSource: bucketSrc || null,
    }
  })

  const forecastMeta = computed(() => {
    const f = trend.value?.forecast
    if (!f) return null
    const tight = summary.value?.tightestBucket
    let capacityBytes = f.capacityBytes ?? f.capacity_bytes ?? null
    if (capacityBytes == null && tight?.capacityBytes != null) {
      capacityBytes = tight.capacityBytes
    }
    if (capacityBytes == null && buckets.value.length) {
      const sum = buckets.value.reduce((acc, b) => acc + n(b.capacityBytes), 0)
      if (sum > 0) capacityBytes = sum
    }
    return {
      available: !!f.available,
      p50DaysToFull: f.p50DaysToFull,
      p95DaysToFull: f.p95DaysToFull,
      reason: f.reason,
      note: f.note,
      capacityBytes,
      capacityTb: capacityBytes != null ? n(capacityBytes) / 1024 ** 4 : null,
    }
  })

  const dualChart = computed(() => buildDualLineChart(daily.value, forecastMeta.value))

  const chartFoot = computed(() => {
    const list = daily.value
    if (!list.length) return { start: '—', end: '—', delta: '—', gap: '—' }
    const first = list[0]
    const last = list[list.length - 1]
    const deltaTb = n(last.total) - n(first.total)
    const gapTb = Math.max(0, n(last.total) - n(last.active))
    const sign = deltaTb >= 0 ? '+' : ''
    const fc = forecastMeta.value
    let delta = `Δ ${sign}${(deltaTb * 1024).toFixed(0)} GB / ${range.value}`
    if (fc?.available) {
      delta += ` · TTF p95 ${fc.p95DaysToFull ?? '—'}d`
    } else if (fc?.note) {
      delta += ` · ${String(fc.note).slice(0, 24)}`
    }
    return {
      start: `${first.total} TB`,
      end: `${last.total} TB`,
      gap: `缺口 ${gapTb.toFixed(2)} TB`,
      delta,
    }
  })

  const detailCurve = computed(() => {
    const curve = detailData.value?.curve
    if (!curve?.length) return null
    return buildDetailCurveChart(curve)
  })

  async function loadAll(wsIn) {
    loading.value = true
    lastError.value = null
    const ws = resolveWs(wsIn)
    const r = range.value
    if (loadedWs.value && loadedWs.value !== ws) {
      summary.value = null
      trend.value = null
      tablesPage.value = null
      buckets.value = []
      bucketsMeta.value = null
      advice.value = []
      showback.value = null
      loaded.value = false
    }
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
      buckets.value = Array.isArray(bucks)
        ? bucks
        : bucks?.list || []
      bucketsMeta.value = Array.isArray(bucks)
        ? { source: bucks.length ? String(bucks[0]?.source || '') : 'legacy-list', list: bucks }
        : bucks && typeof bucks === 'object'
          ? bucks
          : { source: 'empty', list: [] }
      advice.value = adv || []
      showback.value = sb
      loaded.value = true
      loadedWs.value = ws
      return { summary: sum, trend: tr, tables, buckets: bucks, advice: adv, showback: sb }
    } catch (e) {
      lastError.value = e
      console.error('[storage-trend] load failed', e)
      summary.value = null
      trend.value = null
      tablesPage.value = null
      buckets.value = []
      bucketsMeta.value = null
      advice.value = []
      showback.value = null
      loaded.value = true
      throw e
    } finally {
      loading.value = false
    }
  }

  async function setRange(next, wsIn) {
    range.value = next
    return loadAll(wsIn)
  }

  async function setTableFilter(next, wsIn) {
    const ws = resolveWs(wsIn)
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

  function closeDetail() {
    detailOpen.value = false
    detailData.value = null
    detailError.value = null
  }

  async function openDetail(fqtn, ws) {
    if (!fqtn) return
    detailOpen.value = true
    detailLoading.value = true
    detailError.value = null
    detailData.value = null
    try {
      const detail = await fetchLcStorageTableDetail(fqtn, ws, '90d')
      let recentRuns = []
      try {
        const page = await fetchLcRuns({
          ws: ws || detail?.ws,
          tableFqn: fqtn,
          current: 1,
          size: 3,
        })
        const list = page?.records || page?.list || page?.rows || (Array.isArray(page) ? page : [])
        recentRuns = (list || []).slice(0, 3).map((r) => ({
          id: r.id || r.runId,
          runId: r.runId || r.id,
          kind: r.kind || r.action || r.jobKind || '—',
          status: r.status || '—',
          startedAt: r.startedAt || r.createTime || r.createdAt || '—',
          finishedAt: r.finishedAt || r.endTime || null,
        }))
      } catch {
        recentRuns = []
      }
      const row = detail?.row || {}
      detailData.value = {
        ...detail,
        fqtn: detail?.fqtn || fqtn,
        row,
        snapshotCount: row.snapshotCount ?? detail?.snapshotCount,
        oldestSnapshotAgeDays:
          row.oldestSnapshotAgeDays ?? detail?.oldestSnapshotAgeDays ?? null,
        partitionHint: detail?.partitionHint || {
          partitionCount: row.partitionCount,
          note: '分区数来自表画像',
        },
        recentRuns,
      }
    } catch (e) {
      detailError.value = e
      console.error('[storage-trend] table detail failed', e)
    } finally {
      detailLoading.value = false
    }
  }

  function buildClientReportCsv() {
    const lines = []
    const s = summary.value
    lines.push('section,key,value')
    lines.push(`meta,range,${range.value}`)
    lines.push(`meta,exportedAt,${new Date().toISOString()}`)
    if (s) {
      lines.push(`kpi,physicalBytes,${s.physicalBytes ?? ''}`)
      lines.push(`kpi,activeBytes,${s.activeBytes ?? ''}`)
      lines.push(`kpi,reclaimableBytes,${s.reclaimableBytes ?? ''}`)
      lines.push(`kpi,reclaimablePct,${s.reclaimablePct ?? ''}`)
      lines.push(`kpi,netGrowthBytes,${s.netGrowthBytes ?? ''}`)
      lines.push(`kpi,tightestBucket,${s.tightestBucket?.bucket ?? ''}`)
      lines.push(`kpi,daysToFullP95,${s.tightestBucket?.daysToFullP95 ?? ''}`)
    }
    for (const l of layers.value) {
      lines.push(`layer,${l.layer},${l.size} / ${l.growth}`)
    }
    for (const b of capacityRows.value) {
      lines.push(`bucket,${b.label},${b.pct}% / ${b.cap}`)
    }
    for (const a of adviceCards.value) {
      lines.push(`advice,${a.pri},${JSON.stringify(a.title)}`)
    }
    lines.push('table,fqtn,ws,layer,active,total,reclaimable,growth,reason')
    for (const r of tableRows.value) {
      lines.push(
        [
          'table',
          r.table,
          r.ws,
          r.layer,
          r.active,
          r.total,
          r.reclaimable,
          r.growth,
          r.reason,
        ]
          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
    }
    return `\ufeff${lines.join('\n')}`
  }

  async function downloadReport(ws) {
    const filename = `storage-report-${range.value}-${Date.now()}.csv`
    try {
      const res = await exportLcStorageReport({
        ws,
        range: range.value,
        format: 'csv',
      })
      if (typeof res === 'string') {
        triggerBlobDownload(new Blob(['\ufeff' + res], { type: 'text/csv;charset=utf-8' }), filename)
        return { source: 'api-text' }
      }
      if (res?.downloadUrl) {
        const a = document.createElement('a')
        a.href = res.downloadUrl
        a.download = res.fileName || filename
        a.target = '_blank'
        a.rel = 'noopener'
        a.click()
        return { source: 'api-url' }
      }
      if (res?.contentBase64 || res?.content) {
        if (res.contentBase64) {
          triggerBase64Download(
            res.contentBase64,
            res.fileName || filename,
            res.contentType || 'text/csv;charset=utf-8',
          )
        } else {
          triggerBlobDownload(
            new Blob(['\ufeff' + String(res.content)], { type: 'text/csv;charset=utf-8' }),
            res.fileName || filename,
          )
        }
        return { source: 'api-content' }
      }
      if (res?.csv) {
        triggerBlobDownload(
          new Blob(['\ufeff' + String(res.csv)], { type: 'text/csv;charset=utf-8' }),
          res.fileName || filename,
        )
        return { source: 'api-csv' }
      }
      // 未知 JSON 形状：落本地拼装
      triggerBlobDownload(
        new Blob([buildClientReportCsv()], { type: 'text/csv;charset=utf-8' }),
        filename,
      )
      return { source: 'client-fallback', note: 'API 未返回可下载字段' }
    } catch (e) {
      triggerBlobDownload(
        new Blob([buildClientReportCsv()], { type: 'text/csv;charset=utf-8' }),
        filename,
      )
      return { source: 'client-fallback', error: e }
    }
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
    bucketsMeta,
    advice,
    kpis,
    daily,
    layers,
    capacityRows,
    topGrowth,
    adviceCards,
    tableRows,
    showbackRows,
    showbackCostNote,
    collectBanner,
    chartFoot,
    forecastMeta,
    dualChart,
    detailOpen,
    detailLoading,
    detailData,
    detailError,
    detailCurve,
    loadAll,
    setRange,
    setTableFilter,
    openDetail,
    closeDetail,
    downloadReport,
    lifecycleQuery,
    humanBytes,
    stBarHeight,
    stGrowthCls,
  }
}
