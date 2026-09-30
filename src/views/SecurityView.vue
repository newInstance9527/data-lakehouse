<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useWsListScope } from '@/composables/useWsListScope'
import { pageGuideOf } from '@/data/pageGuides'
import { SEC_IRON_RULES, SEC_PATH_ALLOW, SEC_PATH_FORBID } from '@/data/security'
import {
  fetchSecOverview,
  fetchSecGrants,
  fetchSecMasks,
  fetchSecClassification,
  fetchSecAudit,
  fetchSecSa,
  registerSecSa,
  retireSecSa,
  fetchSecVaultHealth,
  rotateSecVault,
  fetchSecRouteWhitelist,
} from '@/api/security'

const router = useRouter()
const { showToast } = useToast()
const { currentWs, showAll, canShowAll, listWsParams, watchListScope } = useWsListScope()
const guide = pageGuideOf('security')

const loading = ref(false)
const overview = ref(null)
const classification = ref([])
const masks = ref([])
const grants = ref([])
const auditRows = ref([])
const saItems = ref([])
const saHint = ref('')
const saBusy = ref(false)
const saFormOpen = ref(false)
const saForm = ref({
  saName: '',
  domain: '',
  jobBind: '',
  privilegeScope: '',
  expireAt: '',
})
const vaultItems = ref([])
const vaultHint = ref('')
const vaultRotating = ref(false)
/** 当前正在轮换的 vaultPath；用于行内按钮文案 */
const vaultRotatingPath = ref('')
const vaultStatusText = ref('')
const pathAllow = ref(SEC_PATH_ALLOW)
const pathForbid = ref(SEC_PATH_FORBID)
const auditHint = ref('')

const {
  page: saPage,
  pageSize: saPageSize,
  total: saTotal,
  totalPages: saTotalPages,
  paged: saPaged,
  pageNums: saPageNums,
  goPage: goSaPage,
} = usePager(saItems)

const {
  page: vaultPage,
  pageSize: vaultPageSize,
  total: vaultTotal,
  totalPages: vaultTotalPages,
  paged: vaultPaged,
  pageNums: vaultPageNums,
  goPage: goVaultPage,
} = usePager(vaultItems)

const kpis = computed(() => {
  const o = overview.value || {}
  const dash = (v) => (v == null || v === '' ? '—' : String(v))
  return [
    {
      icon: '👥',
      color: 'blue',
      label: '平台用户',
      value: dash(o.userCount),
      unit: '',
      trend: o.userCount == null ? '可选指标未接' : '门户用户',
    },
    {
      icon: '🔐',
      color: 'purple',
      label: '活跃授权策略',
      value: dash(o.activeGrants),
      unit: '',
      trend: 'sec_auth_grant',
    },
    {
      icon: '🚫',
      color: 'orange',
      label: '敏感列/资产',
      value: `${dash(o.sensitiveColumns)}/${dash(o.sensitiveAssets)}`,
      unit: '',
      trend: 'mask · asset',
    },
    {
      icon: '📜',
      color: 'green',
      label: '审计日志(24h)',
      value: dash(o.auditLast24h),
      unit: '',
      trend: '出湖审计片段',
    },
  ]
})

async function loadBoard() {
  loading.value = true
  try {
    const base = listWsParams()
    const [ov, cls, maskPage, grantPage, auditPage, sa, vault, routes] = await Promise.all([
      fetchSecOverview(base),
      fetchSecClassification(base),
      fetchSecMasks({ ...base, current: 1, size: 20 }),
      fetchSecGrants({ ...base, current: 1, size: 20 }),
      fetchSecAudit({ ...base, current: 1, size: 20 }),
      fetchSecSa(base),
      fetchSecVaultHealth(),
      fetchSecRouteWhitelist().catch(() => null),
    ])
    overview.value = ov || {}
    classification.value = Array.isArray(cls?.items) ? cls.items : []
    masks.value = Array.isArray(maskPage?.records) ? maskPage.records : []
    grants.value = Array.isArray(grantPage?.records) ? grantPage.records : []
    auditRows.value = Array.isArray(auditPage?.records) ? auditPage.records : []
    auditHint.value = auditPage?.hint || ''
    saItems.value = Array.isArray(sa?.items) ? sa.items : []
    saHint.value = sa?.hint || ''
    vaultItems.value = Array.isArray(vault?.items) ? vault.items : []
    vaultHint.value = vault?.hint || ''
    if (routes?.allow?.length) {
      pathAllow.value = routes.allow.map((n, i) => ({
        icon: SEC_PATH_ALLOW[i]?.icon || '•',
        title: n.title,
        sub: n.sub,
      }))
    }
    if (routes?.forbid?.length) {
      pathForbid.value = routes.forbid.map((n, i) => ({
        icon: SEC_PATH_FORBID[i]?.icon || '•',
        title: n.title,
        sub: n.sub,
      }))
    }
  } catch (e) {
    showToast(e?.message || '安全中心加载失败', 'warning')
    overview.value = null
    classification.value = []
    masks.value = []
    grants.value = []
    auditRows.value = []
  } finally {
    loading.value = false
  }
}

function exportAuditReport() {
  showToast(auditHint.value || '审计报告以当前列表为准；完整导出待扩展', 'info')
}

function manageServiceAccounts() {
  saFormOpen.value = true
  const el = document.getElementById('sec-sa-card')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function newPermissionApply() {
  router.push('/apply')
}

function openRegisterSa() {
  saForm.value = { saName: '', domain: '', jobBind: '', privilegeScope: '', expireAt: '' }
  saFormOpen.value = true
}

async function submitRegisterSa() {
  const name = String(saForm.value.saName || '').trim()
  if (!name) {
    showToast('请填写 SA 名称（job.domain.action）', 'warning')
    return
  }
  if (saBusy.value) return
  saBusy.value = true
  try {
    const row = await registerSecSa({
      ws: listWsParams().ws,
      saName: name,
      domain: saForm.value.domain || undefined,
      jobBind: saForm.value.jobBind || undefined,
      privilegeScope: saForm.value.privilegeScope || undefined,
      expireAt: saForm.value.expireAt || undefined,
    })
    showToast(`已注册 SA · ${row?.saName || name}`, 'success')
    saFormOpen.value = false
    await loadBoard()
  } catch (e) {
    showToast(e?.message || '注册 SA 失败', 'error')
  } finally {
    saBusy.value = false
  }
}

async function onRetireSa(row) {
  if (!row?.id) return
  if (!window.confirm(`退役作业 SA ${row.saName}？`)) return
  saBusy.value = true
  try {
    await retireSecSa(row.id)
    showToast(`已退役 ${row.saName}`, 'success')
    await loadBoard()
  } catch (e) {
    showToast(e?.message || '退役失败', 'error')
  } finally {
    saBusy.value = false
  }
}

function healthLabel(h) {
  if (h === 'expired') return '过期'
  if (h === 'warn') return '临近'
  if (h === 'missing') return '缺失'
  return '正常'
}

function pickUrgentVault() {
  return (
    vaultItems.value.find((v) => v.rotatable && (v.health === 'expired' || v.health === 'warn')) ||
    vaultItems.value.find((v) => v.rotatable) ||
    null
  )
}

async function rotateVault(item) {
  const target = item || pickUrgentVault()
  if (!target?.vaultPath) {
    showToast(vaultHint.value || '暂无可轮换凭证', 'info')
    return
  }
  if (target.rotatable === false) {
    showToast(target.kind === 'ai' ? 'AI Key 请到「AI 模型管理」轮换' : '该路径不可在此轮换', 'warning')
    return
  }
  if (vaultRotating.value) {
    showToast('已有轮换在执行中，请稍候', 'info')
    return
  }
  const label = target.bindLabel || target.vaultPath
  vaultRotating.value = true
  vaultRotatingPath.value = target.vaultPath
  vaultStatusText.value = `正在轮换 · ${label}…`
  showToast(`正在轮换 · ${label}…`, 'info', { duration: 8000 })
  try {
    const r = await rotateSecVault({ vaultPath: target.vaultPath })
    const modeTip =
      r?.mode === 'datasource'
        ? '已打 rotatedAt，并置数据源 binding stale'
        : r?.hint || '已打 rotatedAt（本地 Vault 标记轮换）'
    vaultStatusText.value = `轮换完成 · ${label}`
    showToast(`✓ 轮换完成 · ${label}：${modeTip}`, 'success', { duration: 6500 })
    try {
      await loadBoard()
    } catch (reloadErr) {
      showToast(`轮换已成功，但台账刷新失败：${reloadErr?.message || reloadErr}`, 'warning')
    }
  } catch (e) {
    vaultStatusText.value = `轮换失败 · ${label}`
    showToast(`✗ 轮换失败 · ${label}：${e?.message || e}`, 'error')
  } finally {
    vaultRotating.value = false
    vaultRotatingPath.value = ''
    window.setTimeout(() => {
      if (!vaultRotating.value) vaultStatusText.value = ''
    }, 4000)
  }
}

onMounted(loadBoard)
watchListScope(() => loadBoard())
</script>

<template>
  <div class="sec-page">
    <PageHeader
      page-id="security"
      title="数据安全与权限中心"
      subtitle="统一权限裁决 · 查询侧动态脱敏 · 人机分身份"
      :guide="guide"
    >
      <span class="acl-empty-hint" style="font-size:12px;color:var(--muted,#888);margin-right:8px">默认当前空间</span>
      <label v-if="canShowAll" class="ws-mine-chk" title="默认跟随顶栏当前空间；勾选后查看全部归属">
        <input v-model="showAll" type="checkbox" />
        查看全部
      </label>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="loadBoard">
        {{ loading ? '刷新中…' : '↻ 刷新' }}
      </button>
      <button type="button" class="btn btn-sm" @click="exportAuditReport">📋 权限审计报告</button>
      <button type="button" class="btn btn-sm" @click="manageServiceAccounts">🔑 作业 SA 管理</button>
      <button type="button" class="btn btn-sm btn-primary" @click="newPermissionApply">+ 新建权限申请</button>
    </PageHeader>

    <p class="tip sec-banner">KPI/列表接安全服务；无数据为空态，不造假行。</p>

    <div class="kpi-grid sec-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-trend">{{ k.trend }}</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏷️ 分级分类资产分布</div>
        </div>
        <div class="card-body">
          <div v-if="!classification.length" class="tip">暂无分级统计</div>
          <ul v-else class="sec-cls-list">
            <li v-for="(c, ci) in classification" :key="ci">
              <span>{{ c.sensitivity }}</span>
              <b>{{ c.count }}</b>
            </li>
          </ul>
          <div class="sec-iron">
            <div class="sec-iron-title">🚨 权限收敛铁律</div>
            <ul>
              <li v-for="(line, li) in SEC_IRON_RULES" :key="li">{{ line }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🎭 动态脱敏策略（查询侧）</div>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>资产</th>
                <th>列</th>
                <th>敏感度</th>
                <th>算法</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!masks.length">
                <td colspan="4" class="sec-empty">暂无脱敏策略</td>
              </tr>
              <tr v-for="m in masks" :key="m.id">
                <td><code>{{ m.gravAssetId || '—' }}</code></td>
                <td>{{ m.columnName || '—' }}</td>
                <td>{{ m.sensitivity || '—' }}</td>
                <td>{{ m.maskAlgo || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card sec-audit">
      <div class="card-header">
        <div class="card-title">📜 审计日志 · 高风险记录</div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>时间</th>
              <th>事件</th>
              <th>单号/资源</th>
              <th>风险</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!auditRows.length">
              <td colspan="4" class="sec-empty">{{ auditHint || '暂无审计日志' }}</td>
            </tr>
            <tr v-for="a in auditRows" :key="a.id">
              <td style="font-size: 11px">{{ a.time || '—' }}</td>
              <td>{{ a.eventType || '—' }}</td>
              <td><code>{{ a.ticketNo || a.src || '—' }}</code></td>
              <td>{{ a.risk || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">🔐 授权策略（sec_auth_grant）</div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>主体</th>
              <th>资源</th>
              <th>权限</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!grants.length">
              <td colspan="4" class="sec-empty">暂无授权策略</td>
            </tr>
            <tr v-for="g in grants" :key="g.id">
              <td>{{ g.subjectId || '—' }}</td>
              <td><code>{{ g.resourceId || g.assetId || '—' }}</code></td>
              <td>{{ g.privilege || '—' }}</td>
              <td>{{ g.status || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2">
      <div id="sec-sa-card" class="card">
        <div class="card-header">
          <div class="card-title">🔑 作业服务账号（SA）</div>
          <button type="button" class="btn btn-sm" :disabled="saBusy" @click="openRegisterSa">＋ 注册 SA</button>
        </div>
        <div class="card-body" style="padding: 0">
          <div v-if="saFormOpen" class="sec-sa-form">
            <div class="form-grid-2">
              <label class="form-field">
                <span class="form-label">SA 名称</span>
                <input v-model="saForm.saName" class="input input-sm" placeholder="job.trade.ods_writer" />
              </label>
              <label class="form-field">
                <span class="form-label">业务域</span>
                <input v-model="saForm.domain" class="input input-sm" placeholder="trade（可空，从名称推断）" />
              </label>
              <label class="form-field">
                <span class="form-label">绑定作业</span>
                <input v-model="saForm.jobBind" class="input input-sm" placeholder="批/流作业名，逗号分隔" />
              </label>
              <label class="form-field">
                <span class="form-label">权限范围</span>
                <input v-model="saForm.privilegeScope" class="input input-sm" placeholder="湖表写 / 加速层写 / 对象存储" />
              </label>
              <label class="form-field">
                <span class="form-label">有效期</span>
                <input v-model="saForm.expireAt" class="input input-sm" placeholder="yyyy-MM-dd（可空）" />
              </label>
            </div>
            <div class="sec-sa-form-actions">
              <button type="button" class="btn btn-sm btn-primary" :disabled="saBusy" @click="submitRegisterSa">
                {{ saBusy ? '提交中…' : '确认注册' }}
              </button>
              <button type="button" class="btn btn-sm" :disabled="saBusy" @click="saFormOpen = false">取消</button>
            </div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>SA</th>
                <th>域</th>
                <th>绑定</th>
                <th>状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!saItems.length">
                <td colspan="5" class="sec-empty">{{ saHint || '暂无服务账号' }}</td>
              </tr>
              <tr v-for="s in saPaged" :key="s.id">
                <td>
                  <div class="sec-vault-label">{{ s.saName }}</div>
                  <code class="sec-vault-path">{{ s.vaultPath }}</code>
                </td>
                <td>{{ s.domain || '—' }}</td>
                <td>{{ s.jobBind || '—' }}</td>
                <td>{{ s.status || '—' }}</td>
                <td>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :disabled="saBusy || s.status === 'retired'"
                    @click="onRetireSa(s)"
                  >
                    退役
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <ListPager
            v-model:page="saPage"
            v-model:page-size="saPageSize"
            :total="saTotal"
            :total-pages="saTotalPages"
            :page-nums="saPageNums"
            :page-count="saPaged.length"
            @go="goSaPage"
          />
          <div class="sec-footnote">铁律：一个 SA 对应一个作业域 · 禁止人持有 SA 凭证 · 凭证仅进 Vault</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🔐 Vault 凭证轮换</div>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="vaultRotating || !vaultItems.length"
            @click="rotateVault()"
          >
            {{ vaultRotating ? '轮换中…' : '⚡ 立即轮换' }}
          </button>
        </div>
        <div v-if="vaultStatusText" class="sec-vault-status" :class="{ busy: vaultRotating }">
          {{ vaultStatusText }}
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>绑定</th>
                <th>周期</th>
                <th>剩余</th>
                <th>状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!vaultItems.length">
                <td colspan="5" class="sec-empty">{{ vaultHint || '暂无轮换台账' }}</td>
              </tr>
              <tr v-for="v in vaultPaged" :key="v.vaultPath">
                <td>
                  <div class="sec-vault-label">{{ v.bindLabel || '—' }}</div>
                  <code class="sec-vault-path">{{ v.vaultPath }}</code>
                </td>
                <td>{{ v.rotateDays != null ? `${v.rotateDays}d` : '—' }}</td>
                <td>{{ v.remainingDays != null ? `${v.remainingDays}d` : '—' }}</td>
                <td>
                  <span class="sec-health" :class="v.health || 'ok'">{{ healthLabel(v.health) }}</span>
                </td>
                <td>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :disabled="vaultRotating || v.rotatable === false"
                    @click="rotateVault(v)"
                  >
                    {{ vaultRotatingPath === v.vaultPath ? '轮换中…' : '轮换' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <ListPager
            v-model:page="vaultPage"
            v-model:page-size="vaultPageSize"
            :total="vaultTotal"
            :total-pages="vaultTotalPages"
            :page-nums="vaultPageNums"
            :page-count="vaultPaged.length"
            @go="goVaultPage"
          />
          <div v-if="vaultHint && vaultItems.length" class="sec-footnote">{{ vaultHint }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">🛣️ 查询路径示意</div>
      </div>
      <div class="card-body sec-path-body">
        <div class="grid grid-2">
          <div>
            <div class="sec-path-title ok">✓ 允许路径</div>
            <div class="flow-chain sec-flow">
              <template v-for="(n, ni) in pathAllow" :key="ni">
                <div v-if="ni > 0" class="flow-arrow">↓</div>
                <div class="flow-node sec-node-ok">
                  <div class="fn-icon">{{ n.icon }}</div>
                  <div class="fn-title">{{ n.title }}</div>
                  <div v-if="n.sub" class="fn-sub">{{ n.sub }}</div>
                </div>
              </template>
            </div>
          </div>
          <div>
            <div class="sec-path-title bad">✗ 禁止路径</div>
            <div class="flow-chain sec-flow">
              <template v-for="(n, ni) in pathForbid" :key="ni">
                <div v-if="ni > 0" class="flow-arrow bad">🚫</div>
                <div class="flow-node sec-node-bad">
                  <div class="fn-icon">{{ n.icon }}</div>
                  <div class="fn-title">{{ n.title }}</div>
                  <div class="fn-sub bad">{{ n.sub }}</div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sec-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1000px) {
  .sec-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}
.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}
.sec-banner {
  margin: -4px 0 12px;
}
.sec-page .card {
  margin-top: 16px;
}
.sec-page .grid-2 .card {
  margin-top: 16px;
}
.sec-cls-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
}
.sec-cls-list li {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.sec-iron {
  margin-top: 16px;
  padding: 14px;
  background: var(--danger-light);
  border-radius: 8px;
  border: 1px solid #ffa39e;
}
.sec-iron-title {
  font-weight: 600;
  color: var(--danger);
  margin-bottom: 8px;
}
.sec-iron ul {
  padding-left: 18px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.8;
  margin: 0;
}
.sec-audit {
  margin-top: 16px;
}
.sec-empty {
  text-align: center;
  color: var(--text-3);
  padding: 24px;
}
.sec-footnote {
  margin-top: 12px;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-3);
  border-top: 1px solid var(--border);
}
.sec-vault-label {
  font-size: 13px;
  font-weight: 500;
}
.sec-vault-path {
  display: block;
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
  word-break: break-all;
}
.sec-vault-status {
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text-2);
  background: var(--bg-2, #f5f7fa);
  border-bottom: 1px solid var(--border);
}
.sec-vault-status.busy {
  color: var(--primary, #1e6fff);
  font-weight: 500;
}
.sec-sa-form {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-2, #f5f7fa);
}
.sec-sa-form .form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.sec-sa-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.sec-health {
  font-size: 12px;
  font-weight: 600;
}
.sec-health.ok {
  color: var(--success);
}
.sec-health.warn {
  color: var(--warning, #d48806);
}
.sec-health.expired,
.sec-health.missing {
  color: var(--danger);
}
.sec-path-body {
  padding: 14px;
}
.sec-path-title {
  font-weight: 600;
  margin-bottom: 10px;
}
.sec-path-title.ok {
  color: var(--success);
}
.sec-path-title.bad {
  color: var(--danger);
}
.sec-flow {
  padding: 4px;
  flex-direction: column;
  align-items: stretch;
}
.flow-chain {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.flow-arrow {
  text-align: center;
  color: var(--text-3);
  width: 100%;
}
.flow-arrow.bad {
  color: var(--danger);
}
.flow-node {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  background: var(--bg-2);
}
.sec-node-ok {
  border-color: #b7eb8f;
}
.sec-node-bad {
  border-color: #ffa39e;
}
.fn-icon {
  font-size: 18px;
}
.fn-title {
  font-weight: 600;
  font-size: 13px;
}
.fn-sub {
  font-size: 11px;
  color: var(--text-3);
}
.fn-sub.bad {
  color: var(--danger);
}
</style>
