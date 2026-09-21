/**
 * 工作空间：对接 /lh/workspace/*，失败时回退演示数据
 */
import { computed, ref } from 'vue'
import {
  addWsMember,
  createWsSpace,
  fetchWsMembers,
  fetchWsOverview,
  fetchWsQuotas,
  fetchWsSpaces,
  removeWsMember,
  setWsCurrent,
} from '@/api/workspace'
import { useSession } from '@/composables/useSession'
import {
  SHARED_CATALOG,
  WORKSPACES,
  WS_KPIS,
  WS_QUOTA,
  membersOf,
  wsQuotaBarColor,
  wsQuotaStatusMeta,
} from '@/data/workspace'

const spaces = ref([])
const quotas = ref([])
const membersByWs = ref({})
const overview = ref(null)
const loading = ref(false)
const loaded = ref(false)
const usingMock = ref(false)
const lastError = ref(null)
let loadPromise = null

const ROLE_CLS = {
  Owner: 'tag-green',
  Developer: 'tag-blue',
  Operator: 'tag-gray',
  BusinessUser: 'tag-orange',
  SecurityOfficer: 'tag-red',
  ServiceAccount: 'tag-gray',
}

function roleCls(role) {
  return ROLE_CLS[role] || 'tag-gray'
}

function formatLast(v) {
  if (!v) return '—'
  const d = typeof v === 'string' ? v : new Date(v)
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return String(v).slice(0, 16).replace('T', ' ')
}

export function normalizeWsSpace(row) {
  if (!row) return null
  const code = row.wsCode || row.id
  return {
    id: code,
    wsCode: code,
    name: row.name,
    icon: row.icon || '🗂️',
    desc: row.detail || row.remark || '',
    detail: row.detail || '',
    members: Number(row.memberCount) || 0,
    tables: Number(row.assetCount) || 0,
    owner: (row.owners || '').split('·')[0]?.trim() || '—',
    owners: row.owners || '—',
    costCenter: row.costCenter || '—',
    gravitino: row.sharedCatalog || SHARED_CATALOG.gravitino,
    preferredSchemas: row.preferredSchemas || '—',
    icebergDb: row.preferredSchemas || '—',
    createdAt: row.createTime ? String(row.createTime).slice(0, 10) : '—',
    tags: Array.isArray(row.tags) ? row.tags : [],
    current: Boolean(row.current),
    storage: {
      used: Number(row.storageUsedTb) || 0,
      quota: Number(row.storageQuotaTb) || 1,
    },
    cu: {
      used: Number(row.cuUsed) || 0,
      quota: Number(row.cuQuota) || 200,
    },
    domain: row.domainCode || '—',
    role: row.myRole || '—',
    rg: row.trinoRg || '—',
    status: row.status || 'active',
    quotaStatus: row.quotaStatus || 'ok',
    raw: row,
  }
}

export function normalizeWsMember(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.displayName || row.subjectId,
    role: row.roleCode,
    roleCls: roleCls(row.roleCode),
    scope: row.scopeNote || '门户协作角色 · 非引擎 ACL',
    last: formatLast(row.lastLogin),
    action: row.roleCode === 'Owner' || row.roleCode === 'SecurityOfficer' ? 'audit' : row.roleCode === 'ServiceAccount' ? 'rotate' : 'remove',
    subjectId: row.subjectId,
    subjectType: row.subjectType,
    raw: row,
  }
}

export function normalizeWsQuota(row) {
  if (!row) return null
  return {
    ws: row.wsCode,
    storage: row.storageLabel || `${row.storageUsedTb}/${row.storageQuotaTb} TB`,
    sPct: Number(row.storagePct) || 0,
    cu: row.cuLabel || `${row.cuUsed}/${row.cuQuota}`,
    cPct: Number(row.cuPct) || 0,
    trino: row.trinoLabel || `${row.trinoUsed}/${row.trinoQuota}`,
    api: row.apiLabel || `${row.apiQpsUsed}/${row.apiQpsQuota}`,
    status: row.status || 'ok',
  }
}

function buildKpis(ov, list) {
  if (!ov) {
    return [
      { label: '工作空间总数', value: String(list.length), unit: '个', delta: '归属团队 · 非隔离租户', deltaCls: '' },
      { label: '当前团队资产', value: '—', unit: '张', delta: '—', deltaCls: '' },
      { label: '成员', value: '—', unit: '人', delta: '—', deltaCls: '' },
      { label: '成本告警', value: '0', unit: '个', delta: '—', deltaCls: '' },
    ]
  }
  const warn = Number(ov.quotaWarnCount) || 0
  return [
    { label: '工作空间总数', value: String(ov.spaceCount ?? list.length), unit: '个', delta: ov.domainHint || '归属团队 · 非隔离租户', deltaCls: '' },
    { label: '当前团队资产', value: String(ov.currentAssetCount ?? 0), unit: '张', delta: `当前 ${ov.currentWs || '—'}`, deltaCls: 'success' },
    { label: '成员', value: String(ov.memberCount ?? 0), unit: '人', delta: '门户协作角色', deltaCls: '' },
    { label: '成本告警', value: String(warn), unit: '个', delta: warn ? '有配额接近上限' : '全部正常', deltaCls: warn ? 'warn' : '' },
  ]
}

function applyMock() {
  usingMock.value = true
  spaces.value = WORKSPACES.map((w) => ({ ...w }))
  quotas.value = WS_QUOTA.map((q) => ({ ...q }))
  const mem = {}
  WORKSPACES.forEach((w) => {
    mem[w.id] = membersOf(w.id)
  })
  membersByWs.value = mem
  overview.value = null
}

export function useWorkspace() {
  const { setCurrentWs, currentWs } = useSession()

  const kpis = computed(() => (usingMock.value ? WS_KPIS : buildKpis(overview.value, spaces.value)))

  async function ensureLoaded(force = false) {
    if (loaded.value && !force) return
    if (loadPromise && !force) return loadPromise
    loading.value = true
    lastError.value = null
    loadPromise = (async () => {
      try {
        const [ov, list, qlist] = await Promise.all([
          fetchWsOverview(),
          fetchWsSpaces(),
          fetchWsQuotas(),
        ])
        overview.value = ov
        spaces.value = (list || []).map(normalizeWsSpace).filter(Boolean)
        quotas.value = (qlist || []).map(normalizeWsQuota).filter(Boolean)
        usingMock.value = false
        const cur = spaces.value.find((s) => s.current)?.id || ov?.currentWs
        if (cur) setCurrentWs(cur)
        loaded.value = true
      } catch (e) {
        lastError.value = e
        applyMock()
        loaded.value = true
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()
    return loadPromise
  }

  async function loadMembers(wsCode) {
    if (!wsCode) return []
    if (usingMock.value) {
      const list = membersOf(wsCode)
      membersByWs.value = { ...membersByWs.value, [wsCode]: list }
      return list
    }
    try {
      const raw = await fetchWsMembers(wsCode)
      const list = (raw || []).map(normalizeWsMember).filter(Boolean)
      membersByWs.value = { ...membersByWs.value, [wsCode]: list }
      return list
    } catch (e) {
      lastError.value = e
      return membersByWs.value[wsCode] || []
    }
  }

  async function switchCurrent(wsCode) {
    if (usingMock.value) {
      spaces.value = spaces.value.map((s) => ({ ...s, current: s.id === wsCode }))
      setCurrentWs(wsCode)
      return
    }
    await setWsCurrent(wsCode)
    setCurrentWs(wsCode)
    spaces.value = spaces.value.map((s) => ({ ...s, current: s.id === wsCode }))
    try {
      overview.value = await fetchWsOverview()
    } catch {
      /* ignore */
    }
  }

  async function createSpace(payload) {
    if (usingMock.value) {
      throw new Error('当前为演示数据，无法创建；请先启动后端并执行 Flyway V22')
    }
    const quotasMap = {
      '小(存储2TB·CU400)': { storageQuotaTb: 2, cuQuota: 400 },
      '中(存储4TB·CU800)': { storageQuotaTb: 4, cuQuota: 800 },
      '大(存储8TB·CU2000)': { storageQuotaTb: 8, cuQuota: 2000 },
    }
    const q = quotasMap[payload.res] || quotasMap['中(存储4TB·CU800)']
    const members = payload.members
      ? payload.members
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({
            subjectType: 'user',
            subjectId: name,
            displayName: name,
            roleCode: 'Developer',
            scopeNote: '可登记/开发 · 读数需申请',
          }))
      : []
    const created = await createWsSpace({
      name: payload.name,
      domainCode: payload.tpl === '自定义' ? '自定义' : payload.tpl,
      costCenter: payload.costCenter,
      trinoRg: payload.rg,
      storageQuotaTb: q.storageQuotaTb,
      cuQuota: q.cuQuota,
      members,
    })
    await ensureLoaded(true)
    return normalizeWsSpace(created)
  }

  async function inviteMember(wsCode, payload) {
    if (usingMock.value) return null
    const m = await addWsMember(wsCode, payload)
    await loadMembers(wsCode)
    await ensureLoaded(true)
    return normalizeWsMember(m)
  }

  async function dropMember(wsCode, memberId) {
    if (usingMock.value) return
    await removeWsMember(wsCode, memberId)
    await loadMembers(wsCode)
    await ensureLoaded(true)
  }

  function membersOfWs(wsCode) {
    return membersByWs.value[wsCode] || []
  }

  function quotaOfWs(wsCode) {
    return quotas.value.find((q) => q.ws === wsCode) || null
  }

  return {
    spaces,
    quotas,
    overview,
    kpis,
    loading,
    loaded,
    usingMock,
    lastError,
    currentWs,
    sharedCatalog: SHARED_CATALOG,
    wsQuotaBarColor,
    wsQuotaStatusMeta,
    ensureLoaded,
    loadMembers,
    switchCurrent,
    createSpace,
    inviteMember,
    dropMember,
    membersOfWs,
    quotaOfWs,
  }
}
