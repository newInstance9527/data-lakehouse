<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
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
  fetchSecVaultHealth,
  fetchSecRouteWhitelist,
} from '@/api/security'

const router = useRouter()
const { showToast } = useToast()
const { currentWs, showAll, listWsParams, watchListScope } = useWsListScope()
const guide = pageGuideOf('security')

const loading = ref(false)
const overview = ref(null)
const classification = ref([])
const masks = ref([])
const grants = ref([])
const auditRows = ref([])
const saItems = ref([])
const vaultItems = ref([])
const pathAllow = ref(SEC_PATH_ALLOW)
const pathForbid = ref(SEC_PATH_FORBID)
const auditHint = ref('')

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
      fetchSecSa(),
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
    vaultItems.value = Array.isArray(vault?.items) ? vault.items : []
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
  showToast('作业 SA 管理 P1（表未建）', 'info')
}

function newPermissionApply() {
  router.push('/apply')
}

function registerSa() {
  showToast('注册 SA 待接后端（P1）', 'info')
}

function rotateVault() {
  showToast('Vault 轮换待接后端（P1）', 'info')
}

onMounted(loadBoard)
watchListScope(() => loadBoard())
</script>

<template>
  <div class="sec-page">
    <PageHeader
      title="数据安全与权限中心"
      subtitle="Gravitino 统一裁决 · Trino 动态脱敏 · OIDC 人机分身份"
      :guide="guide"
    >
      <label class="ws-mine-chk" title="默认跟随顶栏当前空间；勾选后查看全部归属">
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

    <p class="tip sec-banner">KPI/列表接 `/lh/sec/*`；无数据为空态，不造假行。</p>

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
          <div class="card-title">🎭 动态脱敏策略（Trino 查询侧）</div>
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
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔑 作业服务账号（SA）</div>
          <button type="button" class="btn btn-sm" @click="registerSa">＋ 注册 SA</button>
        </div>
        <div class="card-body">
          <div v-if="!saItems.length" class="tip">暂无服务账号（P0 合法空）</div>
          <div class="sec-footnote">铁律：一个 SA 对应一个作业域 · 禁止人持有 SA 凭证 · 作业下线自动回收</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🔐 Vault 凭证轮换</div>
        </div>
        <div class="card-body">
          <div v-if="!vaultItems.length" class="tip">暂无轮换台账（P0 合法空）</div>
          <div class="sec-vault-action">
            <button type="button" class="btn btn-sm btn-primary" @click="rotateVault">⚡ 立即轮换</button>
          </div>
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
  padding-top: 8px;
  font-size: 11px;
  color: var(--text-3);
  border-top: 1px solid var(--border);
}
.sec-vault-action {
  margin-top: 12px;
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
