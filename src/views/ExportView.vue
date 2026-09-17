<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { EXPORT_APPLY_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import { EXPORT_FLOW, EXPORT_JOBS, EXPORT_KPIS, exportJobStatusMeta } from '@/data/export'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('export')

const createOpen = ref(false)
const jobs = ref(EXPORT_JOBS.map((j) => ({ ...j })))
const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(jobs)

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

function onExportApply(payload) {
  const id = `EXP-${String(100 + jobs.value.length + 1).padStart(3, '0')}`
  const expire = formatExpire(payload)
  const shortTable = String(payload.table || '')
    .replace(/^(ads|dwd|dws)\./, '')
    .replace(/^[\w]+\./, '')
  jobs.value.unshift({
    job: id,
    src: shortTable || payload.table,
    target: payload.target,
    purpose: payload.purpose.slice(0, 40),
    freq: '待审批',
    mask: '待配置',
    expire,
    status: 'warn',
  })
  resetPage()
  showToast(`✅ 出湖申请已提交：${id} · ${payload.table} → ${payload.target} · ${expire}`, 'success')
}

function exportAudit() {
  showToast('📋 出湖审计报告导出中 · CSV（时间/目标/表/行数/审批人/用途）', 'success')
}

function goApply() {
  router.push('/apply')
}

function go(path) {
  router.push(path)
}

function goCatalog(src) {
  router.push({ path: '/catalog', query: { q: src } })
}
</script>

<template>
  <div class="exp-page">
    <PageHeader
      title="出湖与回流"
      subtitle="申请→审批→脱敏→出湖→审计→到期回收 · 独立 SA · 禁止私下灌库"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="newExportApply">＋ 出湖申请</button>
      <button type="button" class="btn btn-sm" @click="exportAudit">📋 出湖审计</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goApply">🔗 申请审批</button>
    </PageHeader>

    <CreateFormModal
      :open="createOpen"
      v-bind="EXPORT_APPLY_FORM"
      @close="createOpen = false"
      @submit="onExportApply"
    />

    <div class="kpi-grid exp-kpi">
      <div v-for="(k, i) in EXPORT_KPIS" :key="i" class="kpi-card" :class="k.color">
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
            <div class="flow-node">
              <div class="fn-icon">{{ node.icon }}</div>
              <div class="fn-title">{{ node.title }}</div>
              <div class="fn-sub">{{ node.sub }}</div>
            </div>
          </template>
        </div>
        <p class="exp-note">
          <b class="text-danger">禁止：</b>分析师个人从 Trino 导出后私下灌生产库。回流作业用<b>独立 SA</b>。
        </p>
      </div>
    </div>

    <div class="card exp-jobs">
      <div class="card-header">
        <div class="card-title">📋 活跃出湖作业</div>
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
            </tr>
          </thead>
          <tbody>
            <tr v-if="!paged.length">
              <td colspan="8" style="text-align: center; color: var(--text-3); padding: 24px">暂无作业</td>
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
                <span v-if="j.mask === '无'" class="muted">无</span>
                <span v-else class="tag tag-purple" style="font-size: 10px">{{ j.mask }}</span>
              </td>
              <td style="font-size: 11px">{{ j.expire }}</td>
              <td>
                <span class="tag" :class="exportJobStatusMeta(j.status).tag" style="font-size: 10px">
                  {{ exportJobStatusMeta(j.status).label }}
                </span>
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
          <button type="button" class="btn-link" @click="go('/apply')">申请审批</button>
          <span>→</span>
          <button type="button" class="btn-link" @click="go('/security')">安全脱敏</button>
          <span>→</span>
          <button type="button" class="btn-link" @click="go('/catalog')">ADS 资产</button>
          <span>→</span>
          <button type="button" class="btn-link" @click="go('/lifecycle')">到期回收</button>
        </div>
        <p class="exp-example">
          示例：业务方申请 <code>ads_gmv_board</code> 回流到 MySQL → 审批通过 → DS 作业脱敏后写出 → Gravitino
          记录出库审计 → 到期停作业 + 通知下游删除副本。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
