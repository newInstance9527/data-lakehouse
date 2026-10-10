/**
 * BI 共享状态与动作（看板页 / 制作台共用）
 */
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useActionLock } from '@/composables/useActionLock'
import { useSession } from '@/composables/useSession'
import { useDeferredRefresh } from '@/composables/useDeferredRefresh'
import { filtersToQueryParams } from '@/api/metric'
import {
  fetchBiStatus,
  fetchBiProjection,
  fetchBiDatasets,
  fetchBiDashboards,
  projectBiDatasources,
  publishMetricDataset,
  syncBiDashboards,
  pinBiDashboard,
  openBiDatasetWithDims,
  fetchBiAuthoringEntry,
} from '@/api/bi'

export function useBiWorkbench(opts = {}) {
  /** 看板页观看中延迟刷新列表 */
  const watchingMode = !!opts.watchingMode
  const router = useRouter()
  const route = useRoute()
  const { showToast } = useToast()
  const { busy, run: runLocked } = useActionLock()
  const { currentWs } = useSession()

  const publishCode = ref('')
  const selectedDatasetId = ref('')
  const dimFilters = ref({ dims: {} })
  const loading = ref(false)
  const showPinnedOnly = ref(false)
  const boardQuery = ref('')
  const embedDashboardId = ref('')
  const embedReloadToken = ref(0)
  const pinModalOpen = ref(false)
  const pinTarget = ref(null)
  const pinMode = ref('pin')
  const showAdvanced = ref(false)
  const dimOpen = ref(false)

  const {
    data: biSnap,
    hasPending: hasBiPending,
    offer: offerBiSnap,
    applyPending: applyBiPending,
    discardPending: discardBiPending,
    reset: resetBiSnap,
  } = useDeferredRefresh({
    pauseWhen: () => watchingMode && !!embedDashboardId.value,
  })

  let softPollTimer = null

  const status = computed(() => biSnap.value?.status ?? null)
  const projection = computed(() => biSnap.value?.projection ?? [])
  const datasets = computed(() => biSnap.value?.datasets ?? [])
  const dashboards = computed(() => biSnap.value?.dashboards ?? [])

  const projecting = computed(() => busy('project'))
  const publishing = computed(() => busy('publish'))
  const syncingDash = computed(() => busy('syncDash'))
  const refreshingDims = computed(() => busy('openDims'))

  const healthOk = computed(() => {
    const h = String(status.value?.health?.status || '').toLowerCase()
    return h === 'up' || h === 'ok' || h === 'healthy'
  })
  const healthLabel = computed(() => {
    if (!status.value?.configured) return '未配置'
    const h = String(status.value?.health?.status || '').toLowerCase()
    if (h === 'up' || h === 'ok' || h === 'healthy') return '正常'
    if (h === 'down' || h === 'error' || h === 'skipped') return h === 'skipped' ? '未配置' : '异常'
    return status.value?.health?.status || '检测中'
  })
  const pending = computed(() =>
    (projection.value || []).filter((d) => d.projectable && d.syncState !== 'synced'),
  )
  const failed = computed(() => (projection.value || []).filter((d) => d.syncState === 'error'))
  const selectedDataset = computed(() =>
    (datasets.value || []).find((d) => d.id === selectedDatasetId.value),
  )
  const grainCols = computed(() => {
    const hint = selectedDataset.value?.filtersHint
    if (!hint) return null
    try {
      const o = typeof hint === 'string' ? JSON.parse(hint) : hint
      return Array.isArray(o?.dimKeys) ? o.dimKeys : null
    } catch {
      return null
    }
  })
  const myBoards = computed(() => (dashboards.value || []).filter((d) => d.pinned))
  const activeBoard = computed(() =>
    (dashboards.value || []).find((x) => x.id === embedDashboardId.value),
  )
  const embedTitle = computed(() => activeBoard.value?.title || activeBoard.value?.slug || '')
  const filteredDashboards = computed(() => {
    const q = boardQuery.value.trim().toLowerCase()
    let list = dashboards.value || []
    if (q) {
      list = list.filter((d) => {
        const t = `${d.title || ''} ${d.slug || ''} ${d.metricCodes || ''}`.toLowerCase()
        return t.includes(q)
      })
    }
    return list
  })
  const needsSetup = computed(
    () => !loading.value && !(dashboards.value || []).length && !(datasets.value || []).length,
  )
  const studioReady = computed(() => {
    const connOk = (projection.value || []).some((d) => d.syncState === 'synced')
    const dataOk = (datasets.value || []).length > 0
    const boardOk = (dashboards.value || []).some((d) => d.syncState !== 'revoked')
    return { connOk, dataOk, boardOk }
  })

  const pinFields = [
    {
      key: 'metricCodes',
      label: '关联业务指标',
      type: 'text',
      placeholder: '多个用逗号分隔，如 M-销售额,M-订单量',
      hint: '关联后按您的权限安全看数；维度筛选时也会优先打开这块看板',
    },
  ]
  const pinInitial = computed(() => ({
    metricCodes:
      pinTarget.value?.metricCodes ||
      selectedDataset.value?.metricCode ||
      String(publishCode.value || '').trim() ||
      '',
  }))
  const pinModalTitle = computed(() =>
    pinMode.value === 'edit' ? '设置关联指标' : '收藏到「我的看板」',
  )
  const pinModalSubmit = computed(() => (pinMode.value === 'edit' ? '保存' : '收藏'))

  function syncStateLabel(s) {
    const m = {
      synced: '就绪',
      pending: '待接通',
      error: '异常',
      revoked: '已失效',
      stale: '有更新',
    }
    return m[s] || s || '—'
  }
  function syncStateClass(s) {
    if (s === 'synced') return 'bi-pill ok'
    if (s === 'error' || s === 'revoked') return 'bi-pill bad'
    if (s === 'stale' || s === 'pending') return 'bi-pill warn'
    return 'bi-pill'
  }
  function boardStatusLabel(d) {
    if (!d) return ''
    if (d.syncState === 'revoked') return '已失效'
    if (d.canEmbed === false) return '需开通权限'
    if (d.pinned) return '我的'
    return '可观看'
  }
  function friendlyEmbedBlock(d) {
    const r = String(d?.embedBlockReason || '')
    if (!r) return '暂时无法观看：请先收藏并关联您有权查看的业务指标'
    if (/metricCodes|未关联/i.test(r)) return '请先为看板关联业务指标'
    if (/查询权|SELECT|无权/i.test(r)) return '您还没有相关指标的查看权限，请先申请'
    return r
      .replace(/metricCodes/g, '业务指标')
      .replace(/SELECT/g, '查看权限')
      .replace(/Guest Token/g, '看数会话')
  }
  function matchDatasetByCode(dsList, code) {
    const c = String(code || '').trim()
    if (!c) return null
    return (dsList || []).find((d) => d.metricCode === c) || null
  }

  function syncLocalSelection(snap) {
    const ds = snap?.datasets || []
    const dash = snap?.dashboards || []
    const byCode = matchDatasetByCode(ds, publishCode.value)
    if (byCode) {
      selectedDatasetId.value = byCode.id
    } else if (!selectedDatasetId.value || !ds.some((d) => d.id === selectedDatasetId.value)) {
      selectedDatasetId.value = ds[0]?.id || ''
    }
    if (!embedDashboardId.value) {
      const pinned = dash.find((d) => d.pinned && d.syncState !== 'revoked')
      const first = dash.find((d) => d.syncState !== 'revoked')
      if (pinned || first) embedDashboardId.value = (pinned || first).id
    } else if (!dash.some((d) => d.id === embedDashboardId.value)) {
      const pinned = dash.find((d) => d.pinned && d.syncState !== 'revoked')
      const first = dash.find((d) => d.syncState !== 'revoked')
      embedDashboardId.value = (pinned || first)?.id || ''
    }
  }

  async function reload(options = {}) {
    const force = !!options.force
    loading.value = true
    try {
      const [st, proj, ds, dash] = await Promise.all([
        fetchBiStatus(),
        fetchBiProjection(),
        fetchBiDatasets(currentWs.value),
        fetchBiDashboards(currentWs.value, { pinnedOnly: showPinnedOnly.value }),
      ])
      const snap = {
        status: st,
        projection: proj || [],
        datasets: ds || [],
        dashboards: dash || [],
      }
      if (offerBiSnap(snap, { force }) === 'applied') {
        syncLocalSelection(snap)
      }
    } catch (e) {
      showToast(e?.message || '加载失败，请稍后重试', 'warning')
    } finally {
      loading.value = false
    }
  }

  function confirmBiRefresh() {
    if (!applyBiPending()) return
    syncLocalSelection(biSnap.value)
    showToast('列表已更新', 'success')
  }

  async function projectAll() {
    await runLocked('project', async () => {
      try {
        const r = await projectBiDatasources([])
        const fail = r?.failed ?? 0
        showToast(
          `数据通道：成功 ${r?.projected ?? 0}，失败 ${fail}，跳过 ${r?.skipped ?? 0}`,
          fail > 0 || r?.ok === false ? 'warning' : 'success',
        )
        await reload({ force: true })
      } catch (e) {
        showToast(e?.message || '接通失败', 'warning')
      }
    })
  }

  async function projectOne(dsId) {
    await runLocked('project', async () => {
      try {
        const r = await projectBiDatasources([dsId])
        showToast(
          r?.ok === false ? `接通失败：${r?.results?.[0]?.message || ''}` : '已接通',
          r?.ok === false ? 'warning' : 'success',
        )
        await reload({ force: true })
      } catch (e) {
        showToast(e?.message || '接通失败', 'warning')
      }
    })
  }

  async function doPublish(forceCode) {
    const code = String(
      forceCode || publishCode.value || selectedDataset.value?.metricCode || '',
    ).trim()
    if (!code) {
      showToast('请先填写业务指标编码', 'info')
      return
    }
    await runLocked('publish', async () => {
      try {
        const r = await publishMetricDataset({
          metricCode: code,
          ws: currentWs.value,
          params: filtersToQueryParams(dimFilters.value),
        })
        showToast(`「${code}」已接入，可去建图`, 'success')
        await reload({ force: true })
        if (r?.id) selectedDatasetId.value = r.id
      } catch (e) {
        showToast(e?.message || '发布失败', 'warning')
      }
    })
  }

  async function republishStale(d) {
    if (!d?.metricCode) return
    publishCode.value = d.metricCode
    selectedDatasetId.value = d.id || selectedDatasetId.value
    await doPublish(d.metricCode)
  }

  async function refreshDimsAndEmbed() {
    const id = selectedDatasetId.value
    const code = String(publishCode.value || '').trim()
    if (!id && !code) {
      showToast('请先选择一个已接入的指标', 'info')
      return
    }
    await runLocked('openDims', async () => {
      try {
        const r = await openBiDatasetWithDims({
          id: id || undefined,
          metricCode: code || undefined,
          ws: currentWs.value,
          filters: dimFilters.value,
        })
        showToast('已按当前维度更新', 'success')
        if (r?.suggestedDashboardId) {
          embedDashboardId.value = r.suggestedDashboardId
        }
        embedReloadToken.value += 1
        dimOpen.value = false
        await reload({ force: true })
        if (route.path !== '/bi') {
          await router.push({
            path: '/bi',
            query: r?.suggestedDashboardId
              ? { dashboardId: r.suggestedDashboardId }
              : undefined,
          })
        }
      } catch (e) {
        showToast(e?.message || '按维更新失败', 'warning')
      }
    })
  }

  async function syncDash() {
    await runLocked('syncDash', async () => {
      try {
        const r = await syncBiDashboards(currentWs.value)
        if (r?.ok === false) {
          showToast(r?.message || '同步失败', 'warning')
        } else {
          const n = r?.upserted ?? 0
          showToast(n > 0 ? `已同步 ${n} 块看板` : '看板列表已是最新', 'success')
        }
        await reload({ force: true })
      } catch (e) {
        showToast(e?.message || '同步看板失败', 'warning')
      }
    })
  }

  function openPinModal(d, mode = 'pin') {
    pinMode.value = mode
    pinTarget.value = d
    pinModalOpen.value = true
  }

  async function toggleUnpin(d) {
    try {
      await pinBiDashboard({
        id: d.id,
        pinned: false,
        metricCodes: d.metricCodes,
        ws: currentWs.value,
      })
      showToast('已取消收藏', 'success')
      await reload({ force: true })
    } catch (e) {
      showToast(e?.message || '操作失败', 'warning')
    }
  }

  async function submitPin(form) {
    const d = pinTarget.value
    if (!d) return
    try {
      await pinBiDashboard({
        id: d.id,
        pinned: true,
        metricCodes: String(form?.metricCodes || '').trim(),
        ws: currentWs.value,
      })
      pinModalOpen.value = false
      pinTarget.value = null
      showToast(pinMode.value === 'edit' ? '关联已更新' : '已收藏', 'success')
      await reload({ force: true })
    } catch (e) {
      showToast(e?.message || '操作失败', 'warning')
    }
  }

  async function goAuthoring(kind, id) {
    try {
      const r = await fetchBiAuthoringEntry({ kind, id })
      if (!r?.ok || !r?.url) {
        showToast(r?.message || '建图需管理员开通统一登录', 'warning')
        return
      }
      window.location.assign(r.url)
    } catch (e) {
      showToast(e?.message || '暂时无法进入建图', 'warning')
    }
  }

  function goAuthorDataset(d) {
    const sid = d?.supersetDatasetId
    if (!sid) {
      showToast('该指标尚未接入分析服务', 'warning')
      return
    }
    goAuthoring('dataset', String(sid))
  }

  function viewEmbedded(d) {
    if (d.syncState === 'revoked') {
      showToast('看板已失效，请到制作台同步后再看', 'warning')
      return
    }
    if (d.canEmbed === false) {
      showToast(friendlyEmbedBlock(d), 'warning')
      return
    }
    embedDashboardId.value = d.id
  }

  function copyShareLink(d) {
    const id = d?.id
    if (!id) return
    const url = `${window.location.origin}/bi?dashboardId=${encodeURIComponent(id)}`
    navigator.clipboard?.writeText(url).then(
      () => showToast('已复制门户看数链接', 'success'),
      () => showToast(url, 'info'),
    )
  }

  function bootstrapFromRoute() {
    const code = route.query.metricCode || route.query.q
    if (code) {
      publishCode.value = String(code)
      const hit = matchDatasetByCode(datasets.value, code)
      if (hit) selectedDatasetId.value = hit.id
    }
    if (route.query.dims) {
      try {
        const dims = JSON.parse(String(route.query.dims))
        if (dims && typeof dims === 'object') {
          dimFilters.value = { dims }
          dimOpen.value = true
        }
      } catch {
        /* ignore */
      }
    }
    if (route.query.dashboardId) {
      embedDashboardId.value = String(route.query.dashboardId)
    }
  }

  onMounted(async () => {
    // 旧 ?tab=publish|connect 深链 → 制作台
    const tab = String(route.query.tab || '')
    if (route.path === '/bi' && (tab === 'publish' || tab === 'filter' || tab === 'connect' || tab === 'setup')) {
      const q = { ...route.query }
      delete q.tab
      await router.replace({ path: '/bi/studio', query: q })
      return
    }

    await reload({ force: true })
    bootstrapFromRoute()
    if (route.query.openDataset === '1') {
      const hit = matchDatasetByCode(datasets.value, publishCode.value)
      if (hit) selectedDatasetId.value = hit.id
      await refreshDimsAndEmbed()
    }
    softPollTimer = setInterval(() => {
      reload({ force: false }).catch(() => {})
    }, 90_000)
  })
  onUnmounted(() => {
    if (softPollTimer) {
      clearInterval(softPollTimer)
      softPollTimer = null
    }
  })
  watch(currentWs, () => {
    resetBiSnap()
    reload({ force: true })
  })
  watch(showPinnedOnly, () => reload({ force: true }))

  // reactive 包裹后模板里 wb.xxx 自动解包 ref
  return reactive({
    router,
    route,
    currentWs,
    showToast,
    publishCode,
    selectedDatasetId,
    dimFilters,
    loading,
    showPinnedOnly,
    boardQuery,
    embedDashboardId,
    embedReloadToken,
    pinModalOpen,
    pinTarget,
    pinMode,
    showAdvanced,
    dimOpen,
    biSnap,
    hasBiPending,
    discardBiPending,
    status,
    projection,
    datasets,
    dashboards,
    projecting,
    publishing,
    syncingDash,
    refreshingDims,
    healthOk,
    healthLabel,
    pending,
    failed,
    selectedDataset,
    grainCols,
    myBoards,
    activeBoard,
    embedTitle,
    filteredDashboards,
    needsSetup,
    studioReady,
    pinFields,
    pinInitial,
    pinModalTitle,
    pinModalSubmit,
    syncStateLabel,
    syncStateClass,
    boardStatusLabel,
    friendlyEmbedBlock,
    reload,
    confirmBiRefresh,
    projectAll,
    projectOne,
    doPublish,
    republishStale,
    refreshDimsAndEmbed,
    syncDash,
    openPinModal,
    toggleUnpin,
    submitPin,
    goAuthoring,
    goAuthorDataset,
    viewEmbedded,
    copyShareLink,
  })
}
