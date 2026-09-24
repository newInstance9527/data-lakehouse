/**
 * 工作空间：对接 /lh/workspace/*（禁止 Fail→Mock）
 */
import { computed, ref } from 'vue'
import {
  addWsMember,
  addWsTag,
  createWsSpace,
  deleteWsSpace,
  fetchWsCurrent,
  fetchWsMembers,
  fetchWsOverview,
  fetchWsQuota,
  fetchWsQuotas,
  fetchWsSpaces,
  removeWsMember,
  removeWsTag,
  setWsCurrent,
  syncWsGitRemote,
  updateWsQuota,
} from '@/api/workspace'
import { useSession } from '@/composables/useSession'
import { switchWsWithMemberGuard } from '@/composables/useWsSwitch'
import { SHARED_CATALOG, wsQuotaBarColor, wsQuotaStatusMeta } from '@/data/workspace'
import { workspaceUserById } from '@/data/workspaceUsers'

const spaces = ref([])
const quotas = ref([])
const membersByWs = ref({})
const overview = ref(null)
const loading = ref(false)
const loaded = ref(false)
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
    gitRemoteUrl: row.gitRemoteUrlDisplay || row.gitRemoteUrl || '',
    gitRemoteUrlDisplay: row.gitRemoteUrlDisplay || row.gitRemoteUrl || '',
    gitRemoteCustom: Boolean(row.gitRemoteCustom),
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
    myRole: row.myRole || null,
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
    action:
      row.roleCode === 'Owner' || row.roleCode === 'SecurityOfficer'
        ? 'audit'
        : row.roleCode === 'ServiceAccount'
          ? 'rotate'
          : 'remove',
    subjectId: row.subjectId,
    subjectType: row.subjectType,
    raw: row,
  }
}

export function normalizeWsQuota(row) {
  if (!row) return null
  const tokenQuota = row.aiTokenQuota != null ? Number(row.aiTokenQuota) : null
  const costQuota = row.aiCostQuota != null ? Number(row.aiCostQuota) : null
  const tokenUsed = Number(row.aiTokenUsed) || 0
  const costUsed = Number(row.aiCostUsed) || 0
  const limitTok = tokenQuota != null && tokenQuota > 0
  const limitCost = costQuota != null && costQuota > 0
  const tokenRemaining =
    row.aiTokenRemaining != null
      ? Number(row.aiTokenRemaining)
      : limitTok
        ? Math.max(0, tokenQuota - tokenUsed)
        : null
  const costRemaining =
    row.aiCostRemaining != null
      ? Number(row.aiCostRemaining)
      : limitCost
        ? Math.max(0, costQuota - costUsed)
        : null
  return {
    ws: row.wsCode,
    storage: row.storageLabel || `${row.storageUsedTb}/${row.storageQuotaTb} TB`,
    sPct: Number(row.storagePct) || 0,
    cu: row.cuLabel || `${row.cuUsed}/${row.cuQuota}`,
    cPct: Number(row.cuPct) || 0,
    trino: row.trinoLabel || `${row.trinoUsed}/${row.trinoQuota}`,
    api: row.apiLabel || `${row.apiQpsUsed}/${row.apiQpsQuota}`,
    aiTokenQuota: limitTok ? tokenQuota : null,
    aiTokenUsed: tokenUsed,
    aiTokenRemaining: tokenRemaining,
    aiToken: row.aiTokenLabel || (limitTok ? `${tokenUsed}/${tokenQuota}` : `${tokenUsed}/不限`),
    aiTokenPct: Number(row.aiTokenPct) || 0,
    aiCostQuota: limitCost ? costQuota : null,
    aiCostUsed: costUsed,
    aiCostRemaining: costRemaining,
    aiCost: row.aiCostLabel || (limitCost ? `${costUsed}/${costQuota}` : `${costUsed}/不限`),
    aiCostPct: Number(row.aiCostPct) || 0,
    aiLimited: row.aiLimited != null
      ? Boolean(row.aiLimited)
      : limitTok || limitCost,
    status: row.status || 'ok',
    raw: row,
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

async function applyLiveData() {
  const [ov, list, qlist, cur] = await Promise.all([
    fetchWsOverview(),
    fetchWsSpaces(),
    fetchWsQuotas(),
    fetchWsCurrent().catch(() => null),
  ])
  overview.value = ov
  spaces.value = (list || []).map(normalizeWsSpace).filter(Boolean)
  quotas.value = (qlist || []).map(normalizeWsQuota).filter(Boolean)
  return { ov, cur }
}

export function useWorkspace() {
  const { setCurrentWs, currentWs } = useSession()

  const kpis = computed(() => buildKpis(overview.value, spaces.value))

  async function ensureLoaded(force = false) {
    if (loaded.value && !force) return
    if (loadPromise && !force) return loadPromise
    loading.value = true
    lastError.value = null
    loadPromise = (async () => {
      try {
        const { ov, cur } = await applyLiveData()
        const wsCode =
          cur?.wsCode ||
          spaces.value.find((s) => s.current)?.id ||
          ov?.currentWs ||
          null
        if (wsCode) setCurrentWs(wsCode)
        loaded.value = true
      } catch (e) {
        lastError.value = e
        spaces.value = []
        quotas.value = []
        overview.value = null
        loaded.value = true
        throw e
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()
    return loadPromise
  }

  async function loadMembers(wsCode) {
    if (!wsCode) return []
    try {
      const raw = await fetchWsMembers(wsCode)
      const list = (raw || []).map(normalizeWsMember).filter(Boolean)
      membersByWs.value = { ...membersByWs.value, [wsCode]: list }
      return list
    } catch (e) {
      lastError.value = e
      throw e
    }
  }

  async function switchCurrent(wsCode) {
    const hit = spaces.value.find((s) => s.id === wsCode || s.wsCode === wsCode)
    await switchWsWithMemberGuard(wsCode, { label: hit?.name || wsCode })
    setCurrentWs(wsCode)
    spaces.value = spaces.value.map((s) => ({ ...s, current: s.id === wsCode }))
    try {
      overview.value = await fetchWsOverview()
    } catch {
      /* ignore refresh */
    }
  }

  async function createSpace(payload) {
    const quotasMap = {
      '小(存储2TB·CU400)': { storageQuotaTb: 2, cuQuota: 400 },
      '中(存储4TB·CU800)': { storageQuotaTb: 4, cuQuota: 800 },
      '大(存储8TB·CU2000)': { storageQuotaTb: 8, cuQuota: 2000 },
    }
    const q = quotasMap[payload.res] || quotasMap['中(存储4TB·CU800)']
    const rawMembers = Array.isArray(payload.members)
      ? payload.members
      : String(payload.members || '')
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
    const members = rawMembers.map((idOrName) => {
      const hit = workspaceUserById(idOrName)
      const subjectId = hit?.value || String(idOrName)
      const displayName = hit?.name || hit?.label || String(idOrName)
      return {
        subjectType: 'user',
        subjectId,
        displayName,
        roleCode: 'Developer',
        scopeNote: '可登记/开发 · 读数需申请',
      }
    })
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

  /**
   * 删除空间（软删）。若删的是当前上下文，先切到 default。
   */
  async function deleteSpace(wsCode) {
    if (!wsCode) throw new Error('缺少空间编码')
    if (wsCode === 'default') throw new Error('默认空间不可删除')
    const wasCurrent = currentWs.value === wsCode
    await deleteWsSpace(wsCode)
    if (wasCurrent) {
      try {
        await setWsCurrent('default')
        setCurrentWs('default')
      } catch {
        setCurrentWs('default')
      }
    }
    delete membersByWs.value[wsCode]
    await ensureLoaded(true)
  }

  async function inviteMember(wsCode, payload) {
    const hit = workspaceUserById(payload.subjectId)
    const body = {
      subjectType: 'user',
      subjectId: String(payload.subjectId || '').trim(),
      displayName: hit?.name || hit?.label || String(payload.subjectId || '').trim(),
      roleCode: payload.roleCode || 'Developer',
      scopeNote: undefined,
    }
    const m = await addWsMember(wsCode, body)
    await loadMembers(wsCode)
    await ensureLoaded(true)
    return normalizeWsMember(m)
  }

  async function dropMember(wsCode, memberId) {
    await removeWsMember(wsCode, memberId)
    await loadMembers(wsCode)
    await ensureLoaded(true)
  }

  async function syncGitRemote(wsCode) {
    const row = await syncWsGitRemote(wsCode)
    await ensureLoaded(true)
    return normalizeWsSpace(row)
  }

  /** 追加展示标签；成功后刷新列表中的 tags */
  async function addTag(wsCode, payload) {
    if (!wsCode) throw new Error('缺少空间编码')
    const text = String(payload?.text || '').trim()
    if (!text) throw new Error('请输入标签文案')
    const row = await addWsTag(wsCode, {
      text,
      cls: payload?.cls || 'tag-blue',
    })
    const normalized = normalizeWsSpace(row)
    patchSpaceTags(wsCode, normalized?.tags)
    return normalized
  }

  async function removeTag(wsCode, text) {
    if (!wsCode) throw new Error('缺少空间编码')
    const t = String(text || '').trim()
    if (!t) throw new Error('请指定要移除的标签')
    const row = await removeWsTag(wsCode, t)
    const normalized = normalizeWsSpace(row)
    patchSpaceTags(wsCode, normalized?.tags)
    return normalized
  }

  function patchSpaceTags(wsCode, tags) {
    const idx = spaces.value.findIndex((s) => s.id === wsCode)
    if (idx < 0) return
    const next = spaces.value.slice()
    next[idx] = { ...next[idx], tags: Array.isArray(tags) ? tags : [] }
    spaces.value = next
  }

  /** 刷新单个空间配额（今日 AI 用量实时汇总，无本地缓存） */
  async function refreshQuota(wsCode) {
    if (!wsCode) return null
    const raw = await fetchWsQuota(wsCode)
    const normalized = normalizeWsQuota(raw)
    if (!normalized) return null
    const idx = quotas.value.findIndex((q) => q.ws === wsCode)
    if (idx >= 0) {
      const next = quotas.value.slice()
      next[idx] = normalized
      quotas.value = next
    } else {
      quotas.value = [...quotas.value, normalized]
    }
    return normalized
  }

  /**
   * 更新配额（Owner/超管）。payload 字段省略=不改；AI 传 0=不限。
   */
  async function updateQuota(wsCode, payload) {
    if (!wsCode) throw new Error('缺少空间编码')
    const raw = await updateWsQuota(wsCode, payload || {})
    const normalized = normalizeWsQuota(raw)
    const idx = quotas.value.findIndex((q) => q.ws === wsCode)
    if (normalized) {
      if (idx >= 0) {
        const next = quotas.value.slice()
        next[idx] = normalized
        quotas.value = next
      } else {
        quotas.value = [...quotas.value, normalized]
      }
    }
    return normalized
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
    lastError,
    currentWs,
    sharedCatalog: SHARED_CATALOG,
    wsQuotaBarColor,
    wsQuotaStatusMeta,
    ensureLoaded,
    loadMembers,
    switchCurrent,
    createSpace,
    deleteSpace,
    inviteMember,
    dropMember,
    syncGitRemote,
    addTag,
    removeTag,
    refreshQuota,
    updateQuota,
    membersOfWs,
    quotaOfWs,
  }
}
