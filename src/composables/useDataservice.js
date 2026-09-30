/**
 * 数据服务中心：治理壳 — SQLREST Manager 构建（SQL/Groovy）+ 门户绑定 + Gateway
 */
import { computed, ref } from 'vue'
import {
  buildDataapi,
  fetchDataapiApis,
  fetchDataapiDetail,
  fetchDataapiEmbedUrl,
  fetchDataapiKeys,
  fetchDataapiOverview,
  fetchDataapiOpenapi,
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
import { pageMyTickets } from '@/api/apply.js'
import {
  defaultSqlrestEmbed,
} from '@/data/dataservice'
import { resolveWs } from '@/utils/ws'
import { formatDateTime } from '@/utils/datetime'

const loaded = ref(false)
const loadedWs = ref('')
const loading = ref(false)
const degraded = ref(false)
const apis = ref([])
const routes = ref([])
/** 门户订阅 Key（/lh/dataapi/keys） */
const subs = ref([])
const apiKeys = ref([])
/** 待发布：已保存且有 api_publish 工单、尚未上线（pending / rejected） */
const pendingPublish = ref([])
const kpis = ref([])
const callRank = ref([])
const callTrend = ref([])
const workbench = ref(null)
const sqlrestDs = ref([])
/** 默认对齐部署台账；后端 embedUrl / workbench 成功后覆盖 */
const embed = ref(defaultSqlrestEmbed())

function parseTicketPayload(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function mapPendingPublish(tickets, apiList) {
  const byId = new Map((apiList || []).map((a) => [a.id, a]))
  const rows = []
  for (const t of tickets || []) {
    const status = t.status || 'pending'
    if (status !== 'pending' && status !== 'rejected') continue
    const payload = parseTicketPayload(t.payload)
    const bindingId = payload.apiBindingId || t.apiBindingId
    const api = bindingId ? byId.get(bindingId) : null
    const path = payload.publicPath || payload.path || api?.path || t.title || '—'
    const method = String(payload.method || api?.method || 'GET').toUpperCase()
    rows.push({
      id: bindingId || t.id,
      bindingId: bindingId || '',
      ticketId: t.id,
      ticketNo: t.ticketNo || t.id,
      status,
      remark: t.remark || '',
      method,
      path,
      name: api?.name || path,
      state: api?.state || (status === 'pending' ? 'draft' : 'draft'),
      purpose: t.reason || payload.purpose || '',
      createTime: formatDateTime(t.createTime, { empty: '' }),
      statusLabel:
        status === 'pending' ? '待审·待发布' : status === 'rejected' ? '已驳回·待重改' : status,
      statusCls: status === 'rejected' ? 'tag-red' : 'tag-orange',
    })
  }
  return rows
}

function mapKeyRow(k) {
  const hint = k.keyHint || ''
  const appKey = k.appKey || '—'
  const maskedKey =
    appKey && appKey !== '—' && appKey.length > 8
      ? `${appKey.slice(0, 4)}····${appKey.slice(-4)}`
      : appKey
  const statusRaw = k.status || '—'
  const statusLabel = statusRaw === 'active' ? '有效' : statusRaw === 'pending' ? '待生效' : statusRaw
  return {
    id: k.id,
    name: k.name || k.app || '—',
    app: k.app || k.name || '—',
    appKey,
    appKeyMasked: maskedKey,
    keyHint: hint,
    api: k.api || '—',
    apiName: k.apiName || '',
    method: k.method || '—',
    bindingId: k.bindingId || '',
    user: k.applicantName || k.user || k.applicant || '—',
    applicant: k.applicantName || k.user || k.applicant || '—',
    applicantId: k.applicant || '',
    applicantName: k.applicantName || '',
    description: k.description || (k.api ? `${k.api} · ${k.qps || k.qpsLimit || '—'} QPS` : '—'),
    status: statusLabel,
    statusRaw,
    cls: k.cls || (statusRaw === 'active' ? 'tag-green' : 'tag-orange'),
    qps: k.qps ?? k.qpsLimit ?? '—',
    ticketId: k.ticketId || '',
    ticketNo: k.ticketNo || '',
    expireAt: formatDateTime(k.expireAt, { empty: '' }),
    createTime: formatDateTime(k.createTime, { empty: '' }),
    remark: k.remark || '',
  }
}

/** API 卡片/详情上的时间字段统一格式 */
function mapApiTimes(row) {
  if (!row || typeof row !== 'object') return row
  return {
    ...row,
    publishedAt: formatDateTime(row.publishedAt, { empty: '' }),
    createTime: formatDateTime(row.createTime, { empty: '' }),
    updateTime: formatDateTime(row.updateTime, { empty: '' }),
  }
}

function mapOverview(ov) {
  if (!ov) {
    return [
      { label: '门户已发布', value: '—', unit: '个', delta: '未加载', deltaCls: '' },
      { label: '近 24h 调用', value: '—', unit: '次', delta: '', deltaCls: '' },
      { label: '接口目录', value: '—', unit: '个', delta: '', deltaCls: '' },
      { label: '活动订阅方', value: '—', unit: '个', delta: '', deltaCls: '' },
    ]
  }
  const calls = ov.calls24h
  const latency = ov.avgLatencyMs
  return [
    {
      label: '门户已发布',
      value: String(ov.publishedApis ?? 0),
      unit: '个',
      delta: ov.draftApis ? `草稿 ${ov.draftApis}` : '—',
      deltaCls: '',
    },
    {
      label: '近 24h 调用',
      value: calls != null ? String(calls) : '—',
      unit: '次',
      delta:
        latency != null
          ? `均延迟 ${Math.round(Number(latency))} ms`
          : ov.callsNote || '调用概览',
      deltaCls: '',
    },
    {
      label: '接口目录',
      value: ov.sqlrestTotal != null ? String(ov.sqlrestTotal) : '—',
      unit: '个',
      delta: ov.sqlrestOnline != null ? `上线 ${ov.sqlrestOnline}` : '来自接口服务',
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
  const top = wb?.callStats?.topPath || wb?.topPath?.data
  if (Array.isArray(top) && top.length) {
    const max = Math.max(...top.map((t) => Number(t.calls || t.total || t.count || 0)), 1)
    return top.slice(0, 8).map((t) => ({
      name: t.path || t.name || '—',
      calls: String(t.calls ?? t.total ?? t.count ?? 0),
      pct: Math.round((Number(t.calls || t.total || t.count || 0) / max) * 100),
    }))
  }
  return []
}

function mapCallTrend(wb) {
  const trend = wb?.callStats?.trend || wb?.trend?.data
  if (!Array.isArray(trend) || !trend.length) return []
  const max = Math.max(...trend.map((t) => Number(t.calls || 0)), 1)
  return trend.map((t) => ({
    day: t.day || t.date || '—',
    calls: Number(t.calls || 0),
    pct: Math.round((Number(t.calls || 0) / max) * 100),
    latencyMs: t.latencyMs != null ? Number(t.latencyMs) : null,
  }))
}

export function useDataservice() {
  async function ensureLoaded(force = false) {
    const ws = resolveWs()
    if (loaded.value && loadedWs.value === ws && !force) return
    loading.value = true
    try {
      if (loadedWs.value && loadedWs.value !== ws) {
        apis.value = []
        routes.value = []
        apiKeys.value = []
        subs.value = []
        pendingPublish.value = []
        kpis.value = []
        callRank.value = []
        callTrend.value = []
        sqlrestDs.value = []
      }
      const [list, ov, routePack, keyList, wb, dsList, emb, pubTickets] = await Promise.all([
        fetchDataapiApis({ ws }).catch(() => null),
        fetchDataapiOverview(ws).catch(() => null),
        fetchDataapiRoutes().catch(() => null),
        fetchDataapiKeys(ws).catch(() => null),
        fetchDataapiWorkbench(ws).catch(() => null),
        fetchListForSqlrest().catch(() => null),
        fetchDataapiEmbedUrl().catch(() => null),
        pageMyTickets({ current: 1, size: 100, ticketType: 'api_publish', ws }).catch(() => null),
      ])
      if (Array.isArray(list)) {
        apis.value = list.map(mapApiTimes)
        degraded.value = false
      } else {
        apis.value = []
        degraded.value = true
      }
      kpis.value = mapOverview(ov)
      if (routePack?.bindings?.length) {
        routes.value = routePack.bindings
      } else if (routePack?.apisix?.length) {
        routes.value = routePack.apisix.map((r) => ({
          path: r.path,
          upstream: r.upstream || '网关 → 接口服务',
          auth: r.auth || 'Token',
          rate: r.rate || '—',
          breaker: r.breaker || '—',
          meter: r.meter || '✓',
          status: r.status || 'ok',
          note: r.id || '',
        }))
      } else {
        routes.value = []
      }
      apiKeys.value = Array.isArray(keyList) ? keyList.map(mapKeyRow) : []
      if (wb) {
        workbench.value = wb
        callRank.value = mapTrendToRank(wb)
        callTrend.value = mapCallTrend(wb)
        if (wb.embed) embed.value = { ...defaultSqlrestEmbed(), ...wb.embed }
      }
      subs.value = apiKeys.value
      const ticketRows = pubTickets?.records || pubTickets?.rows || (Array.isArray(pubTickets) ? pubTickets : [])
      pendingPublish.value = mapPendingPublish(ticketRows, apis.value)
      if (emb) embed.value = { ...defaultSqlrestEmbed(), ...(embed.value || {}), ...emb }
      // 后端未返回时仍保留部署台账默认地址，避免「未配置」
      if (!embed.value?.sqlrest) embed.value = defaultSqlrestEmbed()
      if (Array.isArray(dsList)) sqlrestDs.value = dsList
      loaded.value = true
      loadedWs.value = ws
    } catch {
      degraded.value = true
      if (!embed.value?.sqlrest) embed.value = defaultSqlrestEmbed()
      loaded.value = true
      loadedWs.value = ws
    } finally {
      loading.value = false
    }
  }

  async function openDetail(row) {
    if (!row?.id) return row
    try {
      return mapApiTimes({ ...row, ...(await fetchDataapiDetail(row.id, true)) })
    } catch {
      return mapApiTimes(row)
    }
  }

  async function runTrial(form) {
    return trialDataapi({
      sql: form.sql,
      method: form.method,
      params: form.params,
      portalDsId: form.datasourceId || form.portalDsId,
      dsId: form.datasourceId || form.portalDsId,
      engine: form.engine || 'SQL',
      namingStrategy: form.namingStrategy,
      formatMap: form.formatMap,
      contextList: form.contextList,
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
      engine: form.engine || 'SQL',
      params: form.params,
      responses: form.responses,
      responseFormat: form.responseFormat,
      responseShape: form.responseShape,
      description: form.desc || form.description || form.name,
      open: form.open,
      namingStrategy: form.namingStrategy,
      formatMap: form.formatMap,
      cacheKeyType: form.cacheKeyType,
      cacheKeyExpr: form.cacheKeyExpr,
      cacheExpireSeconds: form.cacheExpireSeconds,
      flowStatus: form.flowStatus,
      flowGrade: form.flowGrade,
      flowCount: form.flowCount,
      contextList: form.contextList,
      contentType: form.contentType,
      ws: resolveWs(form.ws),
    })
    const binding = buildRes?.binding
    if (!binding?.id) throw new Error(buildRes?.sqlrest?.message || '构建失败（接口服务）')
    if (buildRes?.ok === false) {
      throw new Error(buildRes?.sqlrest?.message || binding.lastError || '接口服务创建/更新失败')
    }
    const pub = await publishDataapi(binding.id, resolveWs())
    await ensureLoaded(true)
    return { build: buildRes, publish: pub, binding: pub?.binding || binding }
  }

  async function runSyncApisix() {
    const r = await syncDataapiApisix(resolveWs())
    await ensureLoaded(true)
    return r
  }

  async function runSyncFromSqlrest() {
    const r = await syncFromSqlrest(resolveWs())
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

  async function exportOpenapi({ id, filename } = {}) {
    const doc = await fetchDataapiOpenapi({ id, ws: resolveWs() })
    if (!doc || typeof doc !== 'object') throw new Error('OpenAPI 为空')
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || (id ? `openapi-${id}.json` : `openapi-dataapi-${Date.now()}.json`)
    a.click()
    URL.revokeObjectURL(url)
    return doc
  }

  return {
    loaded: computed(() => loaded.value),
    loading: computed(() => loading.value),
    degraded: computed(() => degraded.value),
    apis,
    routes,
    subs,
    apiKeys,
    pendingPublish,
    kpis,
    callRank,
    callTrend,
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
    exportOpenapi,
  }
}
