<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useWsListScope } from '@/composables/useWsListScope'
import { EXPORT_APPLY_FORM } from '@/data/createForms'
import { ensureMetricBindTables, metricBindMetaOf } from '@/data/metricBindAssets'
import { pageGuideOf } from '@/data/pageGuides'
import { EXPORT_FLOW, exportJobStatusMeta } from '@/data/export'
import { pushExportApply } from '@/composables/useApplyBoard'
import { fetchExportSummary, fetchExportJobs, fetchExportAudit } from '@/api/export'
import { tt, useLocale } from '@/composables/useLocale'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { locale } = useLocale()
const { user, currentWs, showAll, canShowAll, listWsParams, watchListScope } = useWsListScope()
const guide = pageGuideOf('export')

const createOpen = ref(false)
const loading = ref(false)
const jobs = ref([])
const summary = ref(null)
const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(jobs)

const kpis = computed(() => {
  void locale.value
  const s = summary.value || {}
  return [
    {
      icon: '📤',
      color: 'blue',
      value: String(s.activeJobs ?? '—'),
      unit: tt('个'),
      label: tt('活跃出湖作业'),
      trend: s.sinkCount != null ? `${tt('ETL 挂接')} ${s.sinkCount}` : tt('独立 SA'),
      trendUp: true,
    },
    {
      icon: '✅',
      color: 'green',
      value: String(s.approved ?? '—'),
      unit: tt('个'),
      label: tt('已审批'),
      trend: tt('含脱敏'),
      trendUp: true,
    },
    {
      icon: '⏳',
      color: 'orange',
      value: String(s.pending ?? '—'),
      unit: tt('个'),
      label: tt('待审批'),
      trend: tt('申请中心'),
      trendUp: false,
    },
    {
      icon: '🔄',
      color: 'purple',
      value: String(s.targets ?? '—'),
      unit: tt('个'),
      label: tt('回流目标'),
      trend: 'MySQL/Redis/ES',
      trendUp: true,
    },
    {
      icon: '⏰',
      color: 'red',
      value: String(s.expiringSoon ?? '—'),
      unit: tt('个'),
      label: tt('即将到期'),
      trend: tt('7 天内'),
      trendUp: false,
    },
  ]
})

onMounted(async () => {
  if (route.query.action === 'apply') {
    createOpen.value = true
  }
  await Promise.all([loadBoard(), ensureMetricBindTables({ force: true }).catch(() => {})])
  if (route.query.focus === 'expire') {
    document.getElementById('exp-expire-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

watchListScope(() => loadBoard())

async function loadBoard() {
  loading.value = true
  try {
    const params = listWsParams()
    const [sum, list] = await Promise.all([
      fetchExportSummary(params),
      fetchExportJobs(params),
    ])
    summary.value = sum || {}
    jobs.value = (Array.isArray(list) ? list : []).map(normalizeJob)
    resetPage()
  } catch (e) {
    showToast(`出湖运营台加载失败：${e.message || e}`, 'warning')
  } finally {
    loading.value = false
  }
}

function normalizeJob(row) {
  return {
    job: row.job || row.ticketNo || '—',
    ticketNo: row.ticketNo || row.job,
    ticketId: row.ticketId,
    src: row.src || '—',
    target: row.target || '—',
    purpose: String(row.purpose || '').slice(0, 40) || '—',
    freq: row.freq || '—',
    mask: row.mask || '待配置',
    expire: row.expire || '长期',
    status: row.status || 'ok',
    ticketStatus: row.ticketStatus || '',
    dagCode: row.dagCode,
    nodeKey: row.nodeKey,
  }
}

function statusLabel(j) {
  if (j.ticketStatus === 'pending') return { tag: 'tag-orange', label: '待审批' }
  if (j.ticketStatus === 'rejected' || j.ticketStatus === 'cancelled') {
    return { tag: 'tag-red', label: '已驳回' }
  }
  return exportJobStatusMeta(j.status)
}

function newExportApply() {
  createOpen.value = true
}

function formatExpire(payload) {
  if (payload.expire === '自定义') {
    const days = Number(payload.expireDays) || 0
    return days > 0 ? `${days}天` : '自定义'
  }
  return payload.expire || '30天'
}

async function onExportApply(payload) {
  const expire = formatExpire(payload)
  const meta = metricBindMetaOf(payload.table)
  try {
    const result = await pushExportApply({
      table: payload.table,
      purpose: payload.purpose,
      target: payload.target,
      expire,
      applicant: '我',
      assetId: meta?.assetId,
    })
    const ticketNo = result.ticketNo
    createOpen.value = false
    showToast(
      `✅ 出湖申请已提交：${ticketNo} · 已进入申请中心待审批；通过后将单号填回 ETL ticketNo`,
      'success',
      { duration: 8000 },
    )
    if (route.query.from === 'etl') {
      try {
        navigator.clipboard?.writeText?.(ticketNo)
        showToast(`已复制单号 ${ticketNo}（审批通过后方可用于发布）`, 'info')
      } catch {
        /* ignore */
      }
    }
    await loadBoard()
  } catch (e) {
    showToast(e?.message || '出湖申请提交失败', 'danger')
  }
}

async function exportAudit() {
  try {
    const data = await fetchExportAudit(listWsParams())
    const lines = Array.isArray(data?.lines) ? data.lines : []
    if (!lines.length) {
      showToast(data?.hint || '暂无出湖审计记录', 'info')
      return
    }
    const header = ['time', 'ticketNo', 'src', 'target', 'purpose', 'approver', 'status', 'dagCode']
    const csv = [
      header.join(','),
      ...lines.map((l) =>
        header
          .map((k) => `"${String(l[k] ?? '').replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export-audit-${currentWs.value || 'all'}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`📋 已导出审计摘要 ${lines.length} 条（${data?.source === 'gov_export_audit' ? '正式落库' : 'soft 回落'}）`, 'success')
  } catch (e) {
    showToast(`审计导出失败：${e.message || e}`, 'error')
  }
}

function goApply() {
  router.push({ path: '/apply', query: { tab: 'export' } })
}

function go(path) {
  router.push(path)
}

function goExpireFocus() {
  router.replace({ path: '/export', query: { focus: 'expire' } })
  document.getElementById('exp-expire-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function goCatalog(src) {
  router.push({ path: '/catalog', query: { q: src } })
}

function goEtl(j) {
  if (j.dagCode) {
    router.push({ path: '/integration', query: { dag: j.dagCode } })
  } else if (j.dagId) {
    router.push({ path: '/integration', query: { dagId: j.dagId } })
  } else {
    router.push('/integration')
  }
}
</script>

<template>
  <div class="exp-page">
    <PageHeader
      page-id="export"
      title="出湖与回流"
      subtitle="申请→审批→脱敏→出湖→审计→到期回收 · 独立 SA · 禁止私下灌库"
      :guide="guide"
    >
      <span class="acl-empty-hint" style="font-size:12px;color:var(--muted,#888);margin-right:8px">默认当前空间</span>
      <label v-if="canShowAll" class="ws-mine-chk" :title="tt('默认跟随顶栏当前空间；勾选后查看全部归属')">
        <input v-model="showAll" type="checkbox" />
        {{ tt('查看全部') }}
      </label>
      <button type="button" class="btn btn-sm" @click="newExportApply">{{ tt('＋ 出湖申请') }}</button>
      <button type="button" class="btn btn-sm" @click="exportAudit">{{ tt('📋 出湖审计') }}</button>
      <button type="button" class="btn btn-sm" @click="loadBoard" :disabled="loading">
        {{ loading ? tt('刷新中…') : tt('↻ 刷新') }}
      </button>
      <button type="button" class="btn btn-sm btn-primary" @click="goApply">{{ tt('🔗 申请审批') }}</button>
    </PageHeader>

    <CreateFormModal
      :open="createOpen"
      v-bind="EXPORT_APPLY_FORM"
      @close="createOpen = false"
      @submit="onExportApply"
    />

    <p class="tip exp-banner">
      作业 / KPI 接出湖服务；无数据为空态，不加载演示作业。出湖申请源表来自资产目录。
    </p>

    <div class="kpi-grid exp-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="k.trendUp ? 'up' : 'down'">{{ k.trend }}</div>
      </div>
    </div>

    <div class="card exp-flow-card">
      <div class="card-header">
        <div class="card-title">🔗 出湖链路 J <span class="tip">· 申请 → 审批 → 脱敏 → 出湖 → 审计 → 回收</span></div>
      </div>
      <div class="card-body">
        <div class="flow-chain exp-flow">
          <template v-for="(node, ni) in EXPORT_FLOW" :key="ni">
            <div v-if="ni > 0" class="flow-arrow">→</div>
            <button
              v-if="node.focus === 'expire'"
              type="button"
              class="flow-node flow-node-btn"
              @click="goExpireFocus"
            >
              <div class="fn-icon">{{ node.icon }}</div>
              <div class="fn-title">{{ node.title }}</div>
              <div class="fn-sub">{{ node.sub }}</div>
            </button>
            <div v-else class="flow-node">
              <div class="fn-icon">{{ node.icon }}</div>
              <div class="fn-title">{{ node.title }}</div>
              <div class="fn-sub">{{ node.sub }}</div>
            </div>
          </template>
        </div>
        <p class="exp-note">
          <b class="text-danger">禁止：</b>分析师个人从即席查询导出后私下灌生产库。回流作业用<b>独立服务账号</b>。
        </p>
      </div>
    </div>

    <div id="exp-expire-anchor" class="card exp-jobs">
      <div class="card-header">
        <div class="card-title">📋 活跃出湖作业 <span class="tip">· 到期回收=停 DAG + 通知删副本（非湖内分区归档）</span></div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>作业</th>
              <th>源表</th>
              <th>目标</th>
              <th>用途</th>
              <th>频率</th>
              <th>脱敏</th>
              <th>到期</th>
              <th>状态</th>
              <th>ETL</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !paged.length">
              <td colspan="9" style="text-align: center; color: var(--text-3); padding: 24px">加载中…</td>
            </tr>
            <tr v-else-if="!paged.length">
              <td colspan="9" style="text-align: center; color: var(--text-3); padding: 24px">
                暂无出湖作业。请先提交出湖申请，或在 ETL 出湖 sink 填入已审批 EXP
              </td>
            </tr>
            <tr v-for="j in paged" :key="j.job">
              <td><code class="exp-job-id">{{ j.job }}</code></td>
              <td>
                <button type="button" class="btn-link" @click="goCatalog(j.src)">{{ j.src }}</button>
              </td>
              <td style="font-size: 11px">{{ j.target }}</td>
              <td style="font-size: 11px">{{ j.purpose }}</td>
              <td style="font-size: 11px">{{ j.freq }}</td>
              <td>
                <span v-if="j.mask === '无' || j.mask === '待配置'" class="muted">{{ j.mask }}</span>
                <span v-else class="tag tag-purple" style="font-size: 10px">{{ j.mask }}</span>
              </td>
              <td style="font-size: 11px">{{ j.expire }}</td>
              <td>
                <span class="tag" :class="statusLabel(j).tag" style="font-size: 10px">
                  {{ statusLabel(j).label }}
                </span>
              </td>
              <td>
                <button
                  v-if="j.dagCode"
                  type="button"
                  class="btn-link"
                  style="font-size: 11px"
                  @click="goEtl(j)"
                >
                  {{ j.dagCode }}
                </button>
                <span v-else class="muted" style="font-size: 11px">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <ListPager
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="total"
          :total-pages="totalPages"
          :page-nums="pageNums"
          :page-count="paged.length"
          @go="goPage"
        />
      </div>
    </div>

    <div class="card exp-links">
      <div class="card-header">
        <div class="card-title">🔗 出湖回流 × 平台串联</div>
      </div>
      <div class="card-body exp-link-body">
        <div class="exp-link-row">
          <button type="button" class="btn-link" @click="goApply">申请审批</button>
          <span>→</span>
          <button type="button" class="btn-link" @click="go('/security')">安全脱敏</button>
          <span>→</span>
          <button type="button" class="btn-link" @click="go('/catalog')">ADS 资产</button>
          <span>→</span>
          <button type="button" class="btn-link" @click="goExpireFocus">出湖到期回收</button>
          <span class="muted">·</span>
          <button type="button" class="btn-link" @click="go('/lifecycle?focus=archive')">湖内分区归档</button>
        </div>
        <p class="exp-example">
          示例：业务方在资产目录选表申请回流到 MySQL → 审批签发 EXP → ETL sink 回填 ticketNo 并脱敏写出 →
          <code>gov_export_audit</code> 落库 → <b>到期停作业 + 通知下游删除副本</b>（出湖回收）。
          湖内分区过期/冷存储迁移见生命周期「归档候选」，两套语义不双写。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exp-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-2, #f5f7fa);
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.5;
}
.exp-banner code {
  font-size: 11px;
}
.exp-kpi {
  grid-template-columns: repeat(5, 1fr);
}
.exp-flow-card,
.exp-jobs {
  margin-top: 16px;
}
.flow-chain {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.exp-flow {
  padding: 4px;
}
.flow-arrow {
  color: var(--text-3);
  font-size: 12px;
}
.flow-node {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
  min-width: 88px;
}
.flow-node-btn {
  background: var(--bg, #fff);
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.flow-node-btn:hover {
  border-color: var(--primary, #1e6fff);
}
.fn-icon {
  font-size: 20px;
}
.fn-title {
  font-weight: 600;
  font-size: 13px;
  margin-top: 4px;
}
.fn-sub {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}
.exp-note {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.8;
}
.text-danger {
  color: var(--danger);
}
.muted {
  color: var(--text-3);
}
.exp-job-id {
  font-size: 11px;
  font-weight: 600;
}
.exp-links {
  margin-top: 16px;
  border-color: var(--primary);
}
.exp-link-body {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.9;
}
.exp-link-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.exp-example {
  margin-top: 8px;
  color: var(--text-3);
  font-size: 12px;
}
.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}
@media (max-width: 1100px) {
  .exp-kpi {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 720px) {
  .exp-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
