/**
 * 生命周期主台 + 存储趋势（对接 /lh/lifecycle）
 * API 失败：空/null + lastError；空策略保持空态（不自动写示例）。
 */
import { computed, ref } from 'vue'
import {
  fetchLcJobsLatest,
  fetchLcOverview,
  fetchLcPolicies,
  fetchLcArchiveCandidates,
  fetchLcStorageTables,
  fetchLcStorageTrend,
  runLcJobsNow,
  scanLcOrphan,
  syncLcRun,
  triggerLcCompact,
  triggerLcExpire,
  upsertLcPolicy,
} from '@/api/lifecycle'
import { fetchDelRequests, fetchDelSummary } from '@/api/compliance'
import { LC_STAGES, lcJobStatusMeta } from '@/data/lifecycle'
import { complianceTypeCls } from '@/data/compliance'
import { resolveWs } from '@/utils/ws'

const loading = ref(false)
const loaded = ref(false)
const loadedWs = ref('')
const lastError = ref(null)
const actionBusy = ref(false)

const overview = ref(null)
const jobsLatest = ref(null)
const policies = ref([])
const topStorage = ref([])
const orphanRows = ref([])
const lastOrphanScan = ref(null)
const storageTrend = ref(null)
const compliancePreviewRows = ref([])
const archiveCandidateRows = ref([])

let loadPromise = null

const LAYER_COLOR = {
  ODS: '#4d8dff',
  DWD: '#3dd68c',
  DWS: '#a78bfa',
  ADS: '#e6b450',
  OTHER: '#94a3b8',
  'DIM / 其它': '#94a3b8',
}

function n(v, d = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}

/** 可读容量 */
export function humanSizeSimple(bytes) {
  const b = n(bytes)
  if (b <= 0) return '0 B'
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(1)} TB`
  if (b >= 1024 ** 3) return `${Math.round(b / 1024 ** 3)} GB`
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`
  return `${Math.round(b / 1024)} KB`
}

function avgSizeLabel(bytes) {
  const b = n(bytes)
  if (b <= 0) return '—'
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(0)}GB`
  return `${Math.round(b / 1024 ** 2)}MB`
}

function growthLabel(pct) {
  if (pct == null || pct === '') return '—'
  const x = n(pct)
  const sign = x > 0 ? '+' : ''
  return `${sign}${x.toFixed(1)}%`
}

function levelCls(level) {
  if (level === 'L1') return 'tag-red'
  if (level === 'L2') return 'tag-orange'
  return 'tag-blue'
}

const EMPTY_LC_KPIS = [
  { icon: '💾', color: 'blue', value: '—', unit: 'TB', label: '总存储', trend: '—' },
  { icon: '🧹', color: 'green', value: '—', unit: 'GB', label: '本月清理', trend: '—' },
  { icon: '📦', color: 'purple', value: '—', unit: '次', label: '本月合并成功', trend: '—' },
  { icon: '🗄️', color: 'orange', value: '—', unit: '分区', label: '归档候选', trend: '—' },
  { icon: '⚠️', color: 'red', value: '—', unit: '项', label: '合规删除待审', trend: '—' },
]

const EMPTY_ST_KPIS = [
  { icon: '💾', color: 'blue', value: '—', unit: '', label: '物理口径', trend: '—' },
  { icon: '🔥', color: 'orange', value: '—', unit: '', label: 'ODS 层', trend: '—' },
  { icon: '💧', color: 'green', value: '—', unit: '', label: 'DWD 层', trend: '—' },
  { icon: '📦', color: 'purple', value: '—', unit: '', label: 'DWS 层', trend: '—' },
  { icon: '📊', color: 'red', value: '—', unit: '', label: 'ADS 层', trend: '—' },
]

async function applyBoard(ws) {
  const [ov, jobs, tablesPage, pols, trend, delSummary, delPage, archives] = await Promise.all([
    fetchLcOverview(ws),
    fetchLcJobsLatest(ws),
    fetchLcStorageTables({
      ws,
      range: '30d',
      sort: 'totalBytes',
      order: 'desc',
      page: 1,
      size: 20,
    }),
    fetchLcPolicies(ws),
    fetchLcStorageTrend(ws, '30d').catch(() => null),
    fetchDelSummary(ws).catch(() => null),
    fetchDelRequests({ ws, current: 1, size: 10 }).catch(() => null),
    fetchLcArchiveCandidates(ws).catch(() => []),
  ])
  overview.value = ov
  if (delSummary && overview.value) {
    overview.value = {
      ...overview.value,
      compliancePending: delSummary.open ?? delSummary.pendingApproval ?? overview.value.compliancePending,
      complianceSummary: delSummary,
    }
  }
  jobsLatest.value = jobs
  const list = Array.isArray(tablesPage)
    ? tablesPage
    : tablesPage?.list || tablesPage?.records || []
  topStorage.value = list.map((r) => ({
    ...r,
    tableFqn: r.fqtn || r.tableFqn,
    sizeLabel: humanSizeSimple(r.totalBytes ?? r.activeBytes ?? r.sizeBytes),
    growth7dPct: r.growthPct ?? r.growth7dPct,
  }))
  policies.value = pols || []
  storageTrend.value = trend
  const openStatuses = new Set([
    'assessing',
    'pending_approval',
    'scheduled',
    'executing',
    'verifying',
    'partial_failed',
    'on_hold',
    'restricted',
  ])
  const records = delPage?.records || []
  compliancePreviewRows.value = records
    .filter((r) => openStatuses.has(String(r.status || '').toLowerCase()))
    .slice(0, 10)
    .map((r) => ({
      id: r.reqNo || r.id,
      reqId: r.id,
      reqNo: r.reqNo,
      subject: r.subjectMasked || r.subject || '—',
      type: r.reqType || r.type,
      impact: r.scopeLabel || r.impact || '—',
      approval: r.status === 'pending_approval' ? '待审批' : r.statusLabel || r.status || '—',
      approvalPending: r.status === 'pending_approval' || r.status === 'assessing',
      status: r.statusLabel || r.status,
      statusCls: r.status === 'pending_approval' ? 'tag-orange' : 'tag-gray',
    }))
  archiveCandidateRows.value = Array.isArray(archives) ? archives : []
  return { overview: ov, jobs, top: list, policies: pols, trend, compliance: compliancePreviewRows.value, archives }
}

export function useLifecycle() {
  const liveKpis = computed(() => {
    const ov = overview.value
    if (!ov) return EMPTY_LC_KPIS
    const hot = ov.hotWarmCold || {}
    const reclaim = ov.reclaimableBytes != null ? humanSizeSimple(ov.reclaimableBytes) : null
    const active = ov.activeBytes != null ? humanSizeSimple(ov.activeBytes) : null
    const caliberHint =
      ov.storageCaliber === 'physical' || reclaim
        ? `物理口径${active ? ` · 活跃 ${active}` : ''}${reclaim ? ` · 可回收 ${reclaim}` : ''}`
        : `热 ${hot.hotTb ?? '—'} / 温 ${hot.warmTb ?? '—'} / 冷 ${hot.coldTb ?? '—'}`
    return [
      {
        icon: '💾',
        color: 'blue',
        value: String(ov.totalStorageTb ?? '—'),
        unit: 'TB',
        label: '总存储',
        trend: caliberHint,
      },
      {
        icon: '🧹',
        color: 'green',
        value: String(ov.monthCleanedGb ?? '—'),
        unit: 'GB',
        label: '本月清理',
        trend: '快照 + 孤儿 + 归档',
      },
      {
        icon: '📦',
        color: 'purple',
        value: String(ov.compactSuccessCount ?? 0),
        unit: '次',
        label: '本月合并成功',
        trend: ov.warnTableCount ? `${ov.warnTableCount} 表告警` : '达标',
      },
      {
        icon: '🗄️',
        color: 'orange',
        value: String(ov.archiveCandidatePartitions ?? 0),
        unit: ov.archiveUnit === 'tables' ? '表' : '分区',
        label: '归档候选',
        trend: ov.archiveCandidateTables
          ? `湖内分区 · ${ov.archiveCandidateTables} 表`
          : '湖内分区过期',
        clickable: true,
        focus: 'archive',
      },
      {
        icon: '⚠️',
        color: 'red',
        value: String(ov.compliancePending ?? ov.complianceSummary?.open ?? 0),
        unit: '项',
        label: '合规删除待审',
        trend: ov.complianceSummary
          ? `待批 ${ov.complianceSummary.pendingApproval ?? 0} · 执行中 ${ov.complianceSummary.executing ?? 0}`
          : '见合规工单',
        trendDown: n(ov.compliancePending) > 0,
        clickable: true,
        focus: 'compliance',
      },
    ]
  })

  const reclaimAxes = computed(() => overview.value?.reclaimAxes || null)

  const archiveCandidates = computed(() =>
    (archiveCandidateRows.value || []).map((r) => ({
      table: r.tableFqn || r.table,
      layer: r.layer || '—',
      days: r.partitionExpireDays ?? '—',
      status: r.status || '—',
      hint: r.hint || '',
      coldBucket: r.coldBucketPrefix || '',
    })),
  )

  const jobSteps = computed(() => {
    const steps = jobsLatest.value?.steps
    if (!steps?.length) return []
    return steps.map((s) => ({
      step: s.step,
      name: s.name,
      desc: s.desc || s.name,
      detail: s.detail || '',
      duration:
        s.duration ||
        (s.durationSec != null ? `${Math.round(s.durationSec / 60)} min` : '—'),
      status: s.status || 'success',
    }))
  })

  const storageRows = computed(() => {
    if (!topStorage.value.length) return []
    return topStorage.value.map((r) => ({
      table: r.fqtn || r.tableFqn,
      layer: r.layer || '—',
      size: r.sizeLabel || humanSizeSimple(r.totalBytes ?? r.activeBytes ?? r.sizeBytes),
      files: r.fileCount ?? '—',
      policy: r.policyLabel || '—',
      status: r.anomaly ? 'warn' : r.status || 'ok',
      growth: growthLabel(r.growthPct ?? r.growth7dPct),
    }))
  })

  const snapshotPolicies = computed(() => {
    if (!policies.value.length) return []
    return policies.value.map((p) => ({
      table: p.tableFqn,
      keepCount: p.keepCount,
      keepDays: p.keepDays,
      minSnapshots: p.minSnapshots,
      daysTag: n(p.keepDays) <= 3 ? 'tag-red' : '',
      compactLevel: p.compactLevel,
      orphanOlderDays: p.orphanOlderDays,
    }))
  })

  const compactionRows = computed(() => {
    if (!policies.value.length && !topStorage.value.length) return []
    const byTable = new Map(topStorage.value.map((s) => [s.tableFqn, s]))
    const rows = policies.value.length
      ? policies.value
      : topStorage.value.map((s) => ({ tableFqn: s.tableFqn, compactLevel: 'L2' }))
    return rows.map((p) => {
      const st = byTable.get(p.tableFqn) || byTable.get(String(p.tableFqn).split('.').pop())
      const level = p.compactLevel || 'L2'
      const files = st?.fileCount ?? 0
      const avg = st?.avgFileBytes ?? 0
      const ok = !(files > 50 || (avg > 0 && avg < 32 * 1024 * 1024))
      const sla = level === 'L1' ? '15min' : level === 'L2' ? '1h' : '日批'
      return {
        table: p.tableFqn,
        level,
        levelCls: levelCls(level),
        files: files || '—',
        avgSize: avg ? avgSizeLabel(avg) : '—',
        sla,
        ok,
      }
    })
  })

  const stages = computed(() => LC_STAGES)
  const compliancePreview = computed(() => compliancePreviewRows.value || [])

  const trendKpis = computed(() => {
    const tr = storageTrend.value
    if (!tr) return EMPTY_ST_KPIS
    const series = tr.series?.length ? tr.series : tr.layers || []
    const find = (name) =>
      series.find((l) => String(l.layer || l.key || '').toUpperCase() === name)
    const ods = find('ODS')
    const dwd = find('DWD')
    const dws = find('DWS')
    const ads = find('ADS')
    const totalBytes = tr.daily?.length
      ? tr.daily[tr.daily.length - 1]?.totalBytes ?? tr.totalBytes
      : tr.totalBytes
    const rangeLabel = tr.range || `${tr.days || 30}d`
    const sizeOf = (row) => row?.activeBytes ?? row?.sizeBytes ?? row?.totalBytes
    return [
      {
        icon: '💾',
        color: 'blue',
        value: humanSizeSimple(totalBytes).replace(/ TB| GB| MB/, ''),
        unit: humanSizeSimple(totalBytes).includes('TB') ? 'TB' : 'GB',
        label: `${rangeLabel} 物理口径`,
        trend: `总存储 ${humanSizeSimple(totalBytes)}`,
      },
      {
        icon: '🔥',
        color: 'orange',
        value: ods ? humanSizeSimple(sizeOf(ods)).replace(/ TB| GB/, '') : '—',
        unit: ods && n(sizeOf(ods)) >= 1024 ** 4 ? 'TB' : 'GB',
        label: 'ODS 层',
        trend: '入湖主路径',
      },
      {
        icon: '💧',
        color: 'green',
        value: dwd ? humanSizeSimple(sizeOf(dwd)).replace(/ TB| GB/, '') : '—',
        unit: dwd && n(sizeOf(dwd)) >= 1024 ** 4 ? 'TB' : 'GB',
        label: 'DWD 层',
        trend: '明细主力',
      },
      {
        icon: '📦',
        color: 'purple',
        value: dws ? String(Math.round(n(sizeOf(dws)) / 1024 ** 3)) : '—',
        unit: 'GB',
        label: 'DWS 层',
        trend: '汇总',
      },
      {
        icon: '📊',
        color: 'red',
        value: ads ? String(Math.round(n(sizeOf(ads)) / 1024 ** 3)) : '—',
        unit: 'GB',
        label: 'ADS 层',
        trend: '看板 / CK',
        trendDown: true,
      },
    ]
  })

  const trendLayers = computed(() => {
    const series = storageTrend.value?.series?.length
      ? storageTrend.value.series
      : storageTrend.value?.layers
    if (!series?.length) return []
    return series.map((l) => ({
      layer: l.layer || l.key,
      size: humanSizeSimple(l.activeBytes ?? l.sizeBytes ?? l.totalBytes),
      growth: l.growthPct != null ? growthLabel(l.growthPct) : '—',
      pct: Math.max(1, Math.round(n(l.pct))),
      color: LAYER_COLOR[l.layer || l.key] || LAYER_COLOR.OTHER,
      note: '',
    }))
  })

  const trendDaily = computed(() => {
    const daily = storageTrend.value?.daily
    if (!daily?.length) return []
    return daily.map((d) => {
      if (d.day || d.date) {
        return {
          day: d.day || String(d.date).slice(5),
          total: Number((n(d.totalBytes) / 1024 ** 4).toFixed(2)),
          growth: '',
        }
      }
      const now = Date.now()
      const day = new Date(now + n(d.offsetDays) * 86400000)
      const mm = String(day.getMonth() + 1).padStart(2, '0')
      const dd = String(day.getDate()).padStart(2, '0')
      return {
        day: `${mm}-${dd}`,
        total: Number((n(d.totalBytes) / 1024 ** 4).toFixed(2)),
        growth: '',
      }
    })
  })

  const trendAnomalies = computed(() => {
    const list = storageTrend.value?.anomalies
    if (!list?.length) return []
    return list.map((a) => {
      const advice =
        a.advice === 'expire' || a.suggestedAction === 'expire'
          ? 'expire'
          : a.advice === 'compact' || a.suggestedAction === 'compact'
            ? 'compact'
            : 'catalog'
      const growth = a.growthPct ?? a.growth7dPct
      return {
        table: a.fqtn || a.tableFqn,
        layer: a.layer || '—',
        size: humanSizeSimple(a.activeBytes ?? a.sizeBytes),
        growth: growthLabel(growth),
        reason:
          advice === 'compact'
            ? '小文件/文件数超阈'
            : advice === 'expire'
              ? '增速偏高 · 建议快照治理'
              : '关注增长',
        status: n(growth) >= 5 || a.anomaly ? 'warn' : 'ok',
        action: advice,
        actionLabel: advice === 'compact' ? '去合并' : advice === 'expire' ? '去过期' : '看资产',
      }
    })
  })

  const trendAdvice = computed(() => {
    const anomalies = trendAnomalies.value.filter((a) => a.status === 'warn').slice(0, 3)
    if (!anomalies.length) return []
    return anomalies.map((a, i) => ({
      pri: i === 0 ? 'P1' : 'P2',
      priCls: i === 0 ? 'tag-red' : 'tag-orange',
      title: `${a.table} · ${a.actionLabel}`,
      detail: `${a.growth} · ${a.reason}`,
      act: a.action,
      actLabel: a.actionLabel,
      table: a.table,
    }))
  })

  const trendTopGrowth = computed(() => {
    const list = storageTrend.value?.anomalies
    if (!list?.length) return []
    return list.slice(0, 3).map((a) => ({
      table: a.fqtn || a.tableFqn,
      growth: growthLabel(a.growthPct ?? a.growth7dPct),
      tip: (a.suggestedAction || a.advice) === 'compact'
        ? '建议合并'
        : (a.suggestedAction || a.advice) === 'expire'
          ? '建议过期'
          : '关注',
      danger: n(a.growthPct ?? a.growth7dPct) >= 8,
    }))
  })

  function ensureLoaded() {
    const ws = resolveWs()
    if (loaded.value && loadedWs.value === ws) return loadPromise
    if (loading.value && loadPromise) return loadPromise
    loadPromise = loadBoard(ws)
      .catch(() => {})
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  async function loadBoard(wsIn) {
    loading.value = true
    lastError.value = null
    const ws = resolveWs(wsIn)
    if (loadedWs.value && loadedWs.value !== ws) {
      overview.value = null
      jobsLatest.value = null
      policies.value = []
      topStorage.value = []
      orphanRows.value = []
      storageTrend.value = null
      compliancePreviewRows.value = []
      archiveCandidateRows.value = []
      loaded.value = false
    }
    try {
      const result = await applyBoard(ws)
      loaded.value = true
      loadedWs.value = ws
      return result
    } catch (e) {
      lastError.value = e
      console.error('[lifecycle] load failed', e)
      overview.value = null
      jobsLatest.value = null
      policies.value = []
      topStorage.value = []
      orphanRows.value = []
      storageTrend.value = null
      compliancePreviewRows.value = []
      archiveCandidateRows.value = []
      loaded.value = true
      throw e
    } finally {
      loading.value = false
    }
  }

  async function loadTrend(wsIn, rangeOrDays = '30d') {
    const ws = resolveWs(wsIn)
    storageTrend.value = await fetchLcStorageTrend(ws, rangeOrDays)
    return storageTrend.value
  }

  async function runNow(wsIn) {
    const ws = resolveWs(wsIn)
    actionBusy.value = true
    try {
      const run = await runLcJobsNow({ ws })
      await loadBoard(ws)
      return run
    } finally {
      actionBusy.value = false
    }
  }

  async function compactTable(tableFqn, wsIn, adviceId) {
    const ws = resolveWs(wsIn)
    actionBusy.value = true
    try {
      return await triggerLcCompact({ tableFqn, ws, adviceId })
    } finally {
      actionBusy.value = false
    }
  }

  async function expireTable(tableFqn, wsIn, adviceId) {
    const ws = resolveWs(wsIn)
    actionBusy.value = true
    try {
      return await triggerLcExpire({ tableFqn, ws, adviceId })
    } finally {
      actionBusy.value = false
    }
  }

  async function syncRun(runId) {
    return syncLcRun(runId)
  }

  async function orphanScan(wsIn, bucket) {
    const ws = resolveWs(wsIn)
    actionBusy.value = true
    try {
      const res = await scanLcOrphan({ ws, bucket, dryRun: true })
      lastOrphanScan.value = res
      orphanRows.value = (res.buckets || []).map((b) => ({
        bucket: b.bucket,
        files: `${b.candidateCount} 个`,
        space: humanSizeSimple(b.bytes),
        window: b.windowOk ? '+72h ✓' : '等待中',
        status: b.status || (b.windowOk ? '已扫描' : '+48h'),
        statusCls: b.windowOk ? 'tag-green' : 'tag-orange',
      }))
      return res
    } finally {
      actionBusy.value = false
    }
  }

  async function savePolicy(payload) {
    actionBusy.value = true
    try {
      const saved = await upsertLcPolicy(payload)
      const idx = policies.value.findIndex((p) => p.tableFqn === saved.tableFqn)
      if (idx >= 0) policies.value[idx] = saved
      else policies.value.push(saved)
      return saved
    } finally {
      actionBusy.value = false
    }
  }

  return {
    loading,
    loaded,
    loadedWs,
    lastError,
    actionBusy,
    overview,
    jobsLatest,
    policies,
    topStorage,
    orphanRows,
    lastOrphanScan,
    storageTrend,
    liveKpis,
    jobSteps,
    storageRows,
    snapshotPolicies,
    compactionRows,
    stages,
    reclaimAxes,
    archiveCandidates,
    compliancePreview,
    complianceTypeCls,
    trendKpis,
    trendLayers,
    trendDaily,
    trendAnomalies,
    trendAdvice,
    trendTopGrowth,
    capacity: [],
    ensureLoaded,
    loadBoard,
    loadTrend,
    runNow,
    compactTable,
    expireTable,
    orphanScan,
    savePolicy,
    syncRun,
    lcJobStatusMeta,
  }
}
