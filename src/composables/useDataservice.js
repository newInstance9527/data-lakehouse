/**
 * 数据服务中心：接 /lh/dataapi；失败时保留本地种子便于演示
 */
import { computed, ref } from 'vue'
import {
  buildDataapi,
  fetchDataapiApis,
  fetchDataapiDetail,
  fetchDataapiKeys,
  fetchDataapiOverview,
  fetchDataapiRoutes,
  publishDataapi,
  syncDataapiApisix,
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

function mapOverview(ov) {
  if (!ov) return DS_KPIS.map((k) => ({ ...k }))
  return [
    {
      label: '已发布 API',
      value: String(ov.publishedApis ?? 0),
      unit: '个',
      delta: ov.draftApis ? `草稿 ${ov.draftApis}` : '—',
      deltaCls: '',
    },
    {
      label: '近 24h 调用量',
      value: ov.calls24h != null ? String(ov.calls24h) : '—',
      unit: '',
      delta: ov.callsNote || '待接 APISIX 审计',
      deltaCls: '',
    },
    {
      label: '平均延迟',
      value: ov.avgLatencyMs != null ? String(ov.avgLatencyMs) : '—',
      unit: ov.avgLatencyMs != null ? 'ms' : '',
      delta: '',
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

export function useDataservice() {
  async function ensureLoaded(force = false) {
    if (loaded.value && !force) return
    loading.value = true
    try {
      const [list, ov, routePack, keyList] = await Promise.all([
        fetchDataapiApis({}).catch(() => null),
        fetchDataapiOverview().catch(() => null),
        fetchDataapiRoutes().catch(() => null),
        fetchDataapiKeys().catch(() => null),
      ])
      if (Array.isArray(list) && list.length) {
        apis.value = list
        degraded.value = false
      } else if (Array.isArray(list)) {
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
      if (Array.isArray(keyList) && keyList.length) {
        subs.value = keyList
      }
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
      const d = await fetchDataapiDetail(row.id, true)
      return { ...row, ...d }
    } catch {
      return row
    }
  }

  async function runTrial(form) {
    return trialDataapi({
      sql: form.sql,
      method: form.method,
      params: form.params,
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
    if (!binding?.id) {
      throw new Error(buildRes?.sqlrest?.message || '构建失败')
    }
    const pub = await publishDataapi(binding.id)
    await ensureLoaded(true)
    return { build: buildRes, publish: pub, binding: pub?.binding || binding }
  }

  async function runSyncApisix() {
    const r = await syncDataapiApisix()
    await ensureLoaded(true)
    return r
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
    ensureLoaded,
    openDetail,
    runTrial,
    runBuildAndPublish,
    runSyncApisix,
  }
}
