/**
 * 数据服务中心：治理壳 — SQLREST Manager 构建（SQL/Groovy）+ 门户绑定/APISIX
 */
import { computed, ref } from 'vue'
import {
  buildDataapi,
  fetchDataapiApis,
  fetchDataapiDetail,
  fetchDataapiEmbedUrl,
  fetchDataapiKeys,
  fetchDataapiOverview,
  fetchDataapiRoutes,
  fetchDataapiWorkbench,
  fetchListForSqlrest,
  projectToSqlrest,
  publishDataapi,
  registerDataapi,
  syncDataapiApisix,
  syncFromSqlrest,
  trialDataapi,
} from '@/api/dataapi.js'
import {
  API_CALL_RANK,
  API_LIST,
  APISIX_ROUTES,
  DS_KPIS,
  SUB_LIST,
} from '@/data/dataservice'

const loaded = ref(false)
const loading = ref(false)
const degraded = ref(false)
const apis = ref(API_LIST.map((a) => ({ ...a })))
const routes = ref(APISIX_ROUTES.map((r) => ({ ...r })))
const subs = ref(SUB_LIST.map((s) => ({ ...s })))
const kpis = ref(DS_KPIS.map((k) => ({ ...k })))
const callRank = ref(API_CALL_RANK.map((r) => ({ ...r })))
const workbench = ref(null)
const sqlrestDs = ref([])
const embed = ref(null)

function mapOverview(ov) {
  if (!ov) return DS_KPIS.map((k) => ({ ...k }))
  return [
    {
      label: '门户已发布',
      value: String(ov.publishedApis ?? 0),
      unit: '个',
      delta: ov.draftApis ? `草稿 ${ov.draftApis}` : '—',
      deltaCls: '',
    },
    {
      label: 'SQLREST 接口',
      value: ov.sqlrestTotal != null ? String(ov.sqlrestTotal) : '—',
      unit: '个',
      delta: ov.sqlrestOnline != null ? `上线 ${ov.sqlrestOnline}` : '来自 Manager',
      deltaCls: '',
    },
    {
      label: 'SQLREST 数据源',
      value: ov.sqlrestDatasourceCount != null ? String(ov.sqlrestDatasourceCount) : '—',
      unit: '个',
      delta: '投影自数据源中心',
      deltaCls: '',
    },
    {
      label: '活动订阅方',
      value: String(ov.activeSubscribers ?? 0),
      unit: '个',
      delta: ov.pendingSubscribers ? `${ov.pendingSubscribers} 待审批` : '',
      deltaCls: ov.pendingSubscribers ? 'warn' : '',
    },
  ]
}

function mapTrendToRank(wb) {
  const top = wb?.topPath?.data
  if (Array.isArray(top) && top.length) {
    const max = Math.max(...top.map((t) => Number(t.total || t.count || 0)), 1)
    return top.slice(0, 8).map((t) => ({
      name: t.path || t.name || '—',
      calls: String(t.total ?? t.count ?? 0),
      pct: Math.round(((Number(t.total || t.count || 0) / max) * 100)),
    }))
  }
  return API_CALL_RANK.map((r) => ({ ...r }))
}

export function useDataservice() {
  async function ensureLoaded(force = false) {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const [list, ov, routePack, keyList, wb, dsList, emb] = await Promise.all([
        fetchDataapiApis({}).catch(() => null),
        fetchDataapiOverview().catch(() => null),
        fetchDataapiRoutes().catch(() => null),
        fetchDataapiKeys().catch(() => null),
        fetchDataapiWorkbench().catch(() => null),
        fetchListForSqlrest().catch(() => null),
        fetchDataapiEmbedUrl().catch(() => null),
      ])
      if (Array.isArray(list)) {
        apis.value = list
        degraded.value = false
      } else {
        degraded.value = true
      }
      if (ov) kpis.value = mapOverview(ov)
      if (routePack?.bindings?.length) {
        routes.value = routePack.bindings
      } else if (routePack?.apisix?.length) {
        routes.value = routePack.apisix.map((r) => ({
          path: r.path,
          upstream: r.upstream || 'APISIX → SQLREST',
          auth: r.auth || 'Token',
          rate: r.rate || '—',
          breaker: r.breaker || '—',
          meter: r.meter || '✓',
          status: r.status || 'ok',
          note: r.id || '',
        }))
      }
      if (Array.isArray(keyList) && keyList.length) subs.value = keyList
      if (wb) {
        workbench.value = wb
        callRank.value = mapTrendToRank(wb)
        if (wb.embed) embed.value = wb.embed
      }
      if (emb) embed.value = { ...(embed.value || {}), ...emb }
      if (Array.isArray(dsList)) sqlrestDs.value = dsList
      loaded.value = true
    } catch {
      degraded.value = true
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function openDetail(row) {
    if (!row?.id) return row
    try {
      return { ...row, ...(await fetchDataapiDetail(row.id, true)) }
    } catch {
      return row
    }
  }

  async function runTrial(form) {
    return trialDataapi({
      sql: form.sql,
      method: form.method,
      params: form.params,
      datasourceId: undefined,
      // portal ds → 后端投影
      ...{},
    })
  }

  async function runBuildAndPublish(form) {
    const sourceKind =
      form.srcType === '指标' ? 'metric' : form.srcType === '表' ? 'asset' : 'sql'
    const sourceRef =
      form.srcType === '指标' ? form.metricId : form.srcType === '表' ? form.tableKey : form.datasourceId
    const buildRes = await buildDataapi({
      name: form.name,
      publicPath: form.path?.startsWith('/') ? form.path : `/${form.path || 'api/custom'}`,
      method: form.method || 'GET',
      sourceKind,
      sourceRef,
      portalDsId: form.datasourceId || form.portalDsId,
      dsId: form.datasourceId || form.portalDsId,
      authMode: form.auth,
      qpsLimit: Number(form.qps) || 100,
      burstLimit: Number(form.burst) || 200,
      domainCode: form.domain,
      ownerUser: form.owner,
      publishEnv: form.publishEnv,
      sql: form.sql,
      params: form.params,
      responses: form.responses,
      responseFormat: form.responseFormat,
      responseShape: form.responseShape,
      description: form.desc || form.name,
    })
    const binding = buildRes?.binding
    if (!binding?.id) throw new Error(buildRes?.sqlrest?.message || '构建失败')
    const pub = await publishDataapi(binding.id)
    await ensureLoaded(true)
    return { build: buildRes, publish: pub, binding: pub?.binding || binding }
  }

  async function runSyncApisix() {
    const r = await syncDataapiApisix()
    await ensureLoaded(true)
    return r
  }

  async function runSyncFromSqlrest() {
    const r = await syncFromSqlrest()
    await ensureLoaded(true)
    return r
  }

  async function runProjectDs(ids = []) {
    const r = await projectToSqlrest(ids)
    await ensureLoaded(true)
    return r
  }

  async function runRegister(payload) {
    const r = await registerDataapi(payload)
    await ensureLoaded(true)
    return r
  }

  function openManager(kind = 'interfaceList') {
    const e = embed.value || {}
    const url = e[kind] || e.sqlrest || e.interfaceList
    if (url) window.open(url, '_blank', 'noopener')
    return url
  }

  return {
    loaded: computed(() => loaded.value),
    loading: computed(() => loading.value),
    degraded: computed(() => degraded.value),
    apis,
    routes,
    subs,
    kpis,
    callRank,
    workbench,
    sqlrestDs,
    embed,
    ensureLoaded,
    openDetail,
    runTrial,
    runBuildAndPublish,
    runSyncApisix,
    runSyncFromSqlrest,
    runProjectDs,
    runRegister,
    openManager,
  }
}
