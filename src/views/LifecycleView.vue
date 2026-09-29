<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useLifecycle } from '@/composables/useLifecycle'
import { pageGuideOf } from '@/data/pageGuides'
import { complianceTypeCls } from '@/data/compliance'

const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const guide = pageGuideOf('lifecycle')

const {
  loading,
  actionBusy,
  lastError,
  liveKpis,
  jobSteps,
  storageRows,
  snapshotPolicies,
  compactionRows,
  stages,
  reclaimAxes,
  archiveCandidates,
  compliancePreview,
  orphanRows,
  jobsLatest,
  loadBoard,
  runNow,
  compactTable,
  expireTable,
  orphanScan,
  savePolicy,
  syncRun,
  lcJobStatusMeta,
} = useLifecycle()

const archiveSectionEl = ref(null)

const policyFormOpen = ref(false)
const policyForm = ref({
  tableFqn: '',
  keepCount: 20,
  keepDays: 7,
  minSnapshots: 5,
  compactLevel: 'L2',
  orphanOlderDays: 7,
  orphanSafetyHours: 72,
  layer: 'DWD',
})

const pendingDeepLink = ref(null)

onMounted(async () => {
  try {
    await loadBoard()
  } catch (e) {
    showToast(`生命周期加载失败：${e.message || e}`, 'error')
  }
  // 存储趋势深链：?table=&action=&from=storage-trend&adviceId=
  const q = route.query || {}
  if (q.from === 'storage-trend' && q.table && (q.action === 'compact' || q.action === 'expire')) {
    pendingDeepLink.value = {
      table: String(q.table),
      action: String(q.action),
      adviceId: q.adviceId ? String(q.adviceId) : '',
    }
  }
  if (q.focus === 'archive' || q.action === 'archive') {
    await nextTick()
    archiveSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

function goExportExpire() {
  router.push({ path: '/export', query: { focus: 'expire' } })
}

function onKpiClick(k) {
  if (!k?.clickable) return
  if (k.focus === 'archive') {
    archiveSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    router.replace({ path: '/lifecycle', query: { ...route.query, focus: 'archive' } })
  } else if (k.focus === 'compliance') {
    goCompliance()
  }
}

async function confirmDeepLink() {
  const p = pendingDeepLink.value
  if (!p) return
  pendingDeepLink.value = null
  if (p.action === 'compact') await onRunCompaction(p.table, p.adviceId)
  else if (p.action === 'expire') await onExpireSnapshot(p.table, p.adviceId)
  router.replace({ path: '/lifecycle', query: {} })
}

function dismissDeepLink() {
  pendingDeepLink.value = null
  router.replace({ path: '/lifecycle', query: {} })
}

async function runLifecycleNow() {
  try {
    const run = await runNow()
    const mid = run.dsTaskId || run.runId || ''
    showToast(
      `▶ 日作业已提交 · ${run.status}${mid ? ' · ' + mid : ''}${run.errorMsg ? ' · ' + run.errorMsg : ''}`,
      run.status === 'failed' ? 'warning' : 'success',
    )
    if (run.runId && run.status === 'running') {
      // 主路径：DS notify 推送回调；此处 sync 仅作失败/未配 callback 时的软兜底
      setTimeout(async () => {
        try {
          const s = await syncRun(run.runId)
          showToast(`↻ 状态兜底同步 · ${s.status} · ${s.dsTaskId || ''}`, 'info')
        } catch {
          /* ignore */
        }
      }, 15000)
    }
  } catch (e) {
    showToast(`提交失败：${e.message || e}`, 'error')
  }
}

function showStorageTrend() {
  router.push('/lifecycle/storage')
}

function openComplianceDelete() {
  router.push({ path: '/compliance', query: { create: '1' } })
}

function goCompliance(ticket) {
  const q = {}
  if (ticket?.reqNo || ticket?.id) q.reqNo = ticket.reqNo || ticket.id
  if (ticket?.reqId) q.reqId = ticket.reqId
  router.push({ path: '/compliance', query: q })
}

async function onExpireSnapshot(table, adviceId) {
  try {
    const run = await expireTable(table, undefined, adviceId || undefined)
    showToast(
      `快照过期已提交 · ${table} · ${run.status} · ${run.dsTaskId || run.runId}`,
      run.status === 'failed' ? 'warning' : 'success',
    )
    if (run.runId && run.status === 'running') {
      setTimeout(async () => {
        try {
          await syncRun(run.runId)
        } catch {
          /* ignore */
        }
      }, 15000)
    }
  } catch (e) {
    showToast(`过期失败：${e.message || e}`, 'error')
  }
}

async function onRunCompaction(table, adviceId) {
  try {
    const run = await compactTable(table, undefined, adviceId || undefined)
    showToast(
      `⚡ 合并已提交 · ${table} · ${run.status} · ${run.dsTaskId || run.runId}`,
      run.status === 'failed' ? 'warning' : 'success',
    )
    if (run.runId && run.status === 'running') {
      setTimeout(async () => {
        try {
          await syncRun(run.runId)
        } catch {
          /* ignore */
        }
      }, 15000)
    }
  } catch (e) {
    showToast(`合并失败：${e.message || e}`, 'error')
  }
}

async function onScanOrphans() {
  try {
    const res = await orphanScan()
    showToast(
      `🔍 孤儿扫描（预演）已提交 · ${res.processInstanceId || res.dsTaskId || res.runId}${res.degraded ? '（降级）' : ''}`,
      res.degraded ? 'warning' : 'info',
    )
  } catch (e) {
    showToast(`扫描失败：${e.message || e}`, 'error')
  }
}

function goCatalog(table) {
  router.push({ path: '/catalog', query: { q: table } })
}

function openPolicyForm() {
  policyForm.value = {
    tableFqn: '',
    keepCount: 20,
    keepDays: 7,
    minSnapshots: 5,
    compactLevel: 'L2',
    orphanOlderDays: 7,
    orphanSafetyHours: 72,
    layer: 'DWD',
  }
  policyFormOpen.value = true
}

async function submitPolicy() {
  const tableFqn = policyForm.value.tableFqn.trim()
  if (!tableFqn) {
    showToast('请填写表 FQN', 'warning')
    return
  }
  try {
    await savePolicy({ ...policyForm.value, tableFqn })
    policyFormOpen.value = false
    showToast(`已保存策略 · ${tableFqn}`, 'success')
  } catch (e) {
    showToast(`保存失败：${e.message || e}`, 'error')
  }
}
</script>

<template>
  <div class="lc-page">
    <PageHeader
      page-id="lifecycle"
      title="生命周期与小文件治理"
      subtitle="冷热分层 · 快照过期 · 小文件合并 · 孤儿清理 · 分区过期 · 归档恢复 · 合规删除"
      :guide="guide"
    >
      <button class="btn btn-sm" type="button" :disabled="actionBusy || loading" @click="runLifecycleNow">
        ▶ 立即执行
      </button>
      <button class="btn btn-sm btn-primary" type="button" @click="openComplianceDelete">🗑️ 合规删除</button>
    </PageHeader>

    <div v-if="pendingDeepLink" class="lc-banner deep">
      来自存储趋势：对
      <code>{{ pendingDeepLink.table }}</code>
      执行
      <b>{{ pendingDeepLink.action === 'compact' ? '小文件合并' : '快照过期' }}</b>
      ？将提交调度工单并留痕。
      <button type="button" class="btn btn-sm btn-primary" :disabled="actionBusy" @click="confirmDeepLink">
        确认执行
      </button>
      <button type="button" class="btn btn-sm" @click="dismissDeepLink">取消</button>
    </div>

    <p v-if="lastError && !loading" class="lc-banner">
      加载失败：{{ lastError.message || lastError }}
    </p>

    <div class="kpi-grid lc-kpi">
      <div
        v-for="(k, i) in liveKpis"
        :key="i"
        class="kpi-card"
        :class="[k.color, k.clickable ? 'clickable' : '']"
        @click="onKpiClick(k)"
      >
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="k.trendDown ? 'down' : 'up'">{{ k.trend }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">🌡️ 冷热分层策略 <span class="tip">· 按分区年龄自动迁移</span></div>
      </div>
      <div class="card-body lc-stages-wrap">
        <div class="lifecycle-stage">
          <div v-for="s in stages" :key="s.id" class="ls-col" :class="s.id">
            <div class="ls-icon">{{ s.icon }}</div>
            <div class="ls-title">{{ s.title }}</div>
            <div class="ls-engine">{{ s.engine }}</div>
            <div class="ls-retention">{{ s.retention }}</div>
            <div class="ls-size">{{ s.size }}</div>
            <div class="ls-pct">{{ s.pct }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 lc-grid-top">
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚙️ 生命周期日作业 <span class="tip">· 每日 02:00 · 调度编排</span></div>
          <span class="tag" :class="jobsLatest?.status === 'success' ? 'tag-green' : 'tag-blue'">
            {{ jobsLatest?.status === 'success' ? '上次成功' : jobsLatest?.status || '—' }}
          </span>
        </div>
        <div class="card-body lc-jobs">
          <div
            v-for="j in jobSteps"
            :key="j.step"
            class="lifecycle-job"
            :class="lcJobStatusMeta(j.status).cls"
          >
            <div class="lj-step">{{ j.step }}</div>
            <div class="lj-main">
              <div class="lj-desc">{{ j.desc }}</div>
              <div class="lj-detail">{{ j.detail }}</div>
            </div>
            <div class="lj-duration">{{ j.duration }}</div>
            <span class="tag" :class="lcJobStatusMeta(j.status).tag" style="font-size: 10px">
              {{ lcJobStatusMeta(j.status).label }}
            </span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 各表存储与策略 <span class="tip">· 物理口径 / 增速同源 storage/tables</span></div>
          <button type="button" class="btn btn-sm" @click="showStorageTrend">增速趋势 →</button>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>表</th>
                <th>层</th>
                <th>存储（物理）</th>
                <th>增速</th>
                <th>文件数</th>
                <th>策略</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in storageRows" :key="row.table">
                <td>
                  <button type="button" class="btn-link" @click="goCatalog(row.table)">{{ row.table }}</button>
                </td>
                <td><span class="tag tag-blue" style="font-size: 10px">{{ row.layer }}</span></td>
                <td><b>{{ row.size }}</b></td>
                <td style="font-size: 11px" :style="row.status === 'warn' ? { color: 'var(--danger, #c0392b)' } : {}">{{ row.growth }}</td>
                <td style="font-size: 11px">{{ row.files }}</td>
                <td><span class="tag tag-gray" style="font-size: 10px">{{ row.policy }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div ref="archiveSectionEl" class="card lc-archive">
      <div class="card-header">
        <div class="card-title">
          🗄️ 湖内分区归档候选
          <span class="tip">· 湖表分区过期 → 冷存储；≠ 出湖授权到期</span>
        </div>
        <div class="lc-comp-acts">
          <button type="button" class="btn btn-sm" @click="goExportExpire">
            出湖到期回收
            <template v-if="reclaimAxes?.exportExpireReclaim?.expiringSoon != null">
              （{{ reclaimAxes.exportExpireReclaim.expiringSoon }}）
            </template>
            →
          </button>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <p class="tip lc-reclaim-note">
          {{ reclaimAxes?.lakePartitionArchive?.note || '分区过期候选 SoT 在本页；出湖到期停作业走 /export，不双写 gov_lc_*。' }}
        </p>
        <table class="table">
          <thead>
            <tr>
              <th>表</th>
              <th>层</th>
              <th>过期天数</th>
              <th>状态</th>
              <th>冷桶前缀</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!archiveCandidates.length">
              <td colspan="5" class="tip" style="text-align:center;padding:16px">
                暂无分区过期策略（空列表合法）
              </td>
            </tr>
            <tr v-for="r in archiveCandidates" :key="r.table">
              <td>
                <button type="button" class="btn-link" @click="goCatalog(r.table)">
                  <code>{{ r.table }}</code>
                </button>
              </td>
              <td><span class="tag tag-blue" style="font-size: 10px">{{ r.layer }}</span></td>
              <td>{{ r.days }}</td>
              <td><span class="tag tag-gray" style="font-size: 10px">{{ r.status }}</span></td>
              <td style="font-size: 11px">{{ r.coldBucket || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card lc-compliance">
      <div class="card-header">
        <div class="card-title">🗑️ 合规删除工单 <span class="tip">· 被遗忘权 / 错误数据擦除 · 不可逆</span></div>
        <div class="lc-comp-acts">
          <span class="tag tag-orange">待办预览</span>
          <button type="button" class="btn btn-sm" @click="goCompliance">工单管理 →</button>
          <button type="button" class="btn btn-sm btn-primary" @click="openComplianceDelete">＋ 创建</button>
        </div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>工单</th>
              <th>主体</th>
              <th>类型</th>
              <th>血缘影响</th>
              <th>审批</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!compliancePreview.length">
              <td colspan="6" class="tip" style="text-align:center;padding:16px">
                暂无待办合规工单（空列表合法）
              </td>
            </tr>
            <tr v-for="t in compliancePreview" :key="t.reqId || t.id">
              <td>
                <button type="button" class="btn-link" @click="goCompliance(t)">
                  <code>{{ t.id || t.reqNo }}</code>
                </button>
              </td>
              <td>{{ t.subject }}</td>
              <td><span class="tag" :class="complianceTypeCls(t.type)">{{ t.type }}</span></td>
              <td>{{ t.impact }}</td>
              <td>
                {{ t.approval }}
                <span v-if="t.approvalPending" class="tag tag-orange">待签</span>
              </td>
              <td><span class="tag" :class="t.statusCls">{{ t.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="policyFormOpen" class="card">
      <div class="card-header">
        <div class="card-title">＋ 新建 / 更新快照策略</div>
        <button type="button" class="btn btn-sm" @click="policyFormOpen = false">取消</button>
      </div>
      <div class="card-body lc-policy-form">
        <label>
          <span>表 FQN</span>
          <input v-model="policyForm.tableFqn" class="input" placeholder="ods_trade.s_order" />
        </label>
        <label>
          <span>保留快照数</span>
          <input v-model.number="policyForm.keepCount" class="input" type="number" min="1" />
        </label>
        <label>
          <span>保留天数</span>
          <input v-model.number="policyForm.keepDays" class="input" type="number" min="1" />
        </label>
        <label>
          <span>最小快照</span>
          <input v-model.number="policyForm.minSnapshots" class="input" type="number" min="1" />
        </label>
        <label>
          <span>合并等级</span>
          <select v-model="policyForm.compactLevel" class="select">
            <option value="L1">L1</option>
            <option value="L2">L2</option>
            <option value="L3">L3</option>
          </select>
        </label>
        <label>
          <span>分层</span>
          <select v-model="policyForm.layer" class="select">
            <option value="ODS">ODS</option>
            <option value="DWD">DWD</option>
            <option value="DWS">DWS</option>
            <option value="ADS">ADS</option>
          </select>
        </label>
        <button type="button" class="btn btn-sm btn-primary" :disabled="actionBusy" @click="submitPolicy">
          保存
        </button>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📸 快照过期策略 <span class="tip">· 每表可配</span></div>
          <button type="button" class="btn btn-sm" @click="openPolicyForm">＋ 新建策略</button>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>表</th>
                <th>保留快照数</th>
                <th>保留天数</th>
                <th>最小快照</th>
                <th>动作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in snapshotPolicies" :key="p.table">
                <td><code>{{ p.table }}</code></td>
                <td>{{ p.keepCount }}</td>
                <td>
                  <span v-if="p.daysTag" class="tag tag-red">{{ p.keepDays }} 天</span>
                  <template v-else>{{ p.keepDays }} 天</template>
                </td>
                <td>{{ p.minSnapshots }}</td>
                <td>
                  <button
                    type="button"
                    class="btn-link btn-sm"
                    :disabled="actionBusy"
                    @click="onExpireSnapshot(p.table)"
                  >
                    立即过期
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="lc-footnote">安全：先 expire（逻辑删）→ 24h 观察 → remove_orphan_files（物理删）</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🧹 小文件合并 <span class="tip">· 合并 SLA</span></div>
          <span class="tag tag-orange">{{ compactionRows.filter((c) => !c.ok).length }} 表超阈值</span>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>表</th>
                <th>等级</th>
                <th>文件数</th>
                <th>平均大小</th>
                <th>SLA</th>
                <th>动作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in compactionRows" :key="c.table">
                <td><code>{{ c.table }}</code></td>
                <td><span class="tag" :class="c.levelCls">{{ c.level }}</span></td>
                <td>
                  <b :style="{ color: !c.ok ? 'var(--danger)' : undefined }">{{ c.files }}</b>
                </td>
                <td>{{ c.avgSize }}</td>
                <td>{{ c.sla }}</td>
                <td>
                  <button
                    v-if="!c.ok"
                    type="button"
                    class="btn btn-sm btn-primary lc-compact-btn"
                    :disabled="actionBusy"
                    @click="onRunCompaction(c.table)"
                  >
                    ⚡ 合并
                  </button>
                  <span v-else class="tag tag-green">✓ 达标</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="lc-footnote">阈值：单分区文件数 &gt; 50 或平均 &lt; 32MB 触发</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">🗑️ 孤儿文件清理 <span class="tip">· 快照过期 +72h 后物理删</span></div>
        <button type="button" class="btn btn-sm" :disabled="actionBusy" @click="onScanOrphans">
          🔍 扫描孤儿
        </button>
      </div>
      <div class="card-body lc-orphan">
        <div class="lc-orphan-tags">
          <span class="tag tag-green">dry-run 默认开启</span>
          <span class="tag tag-blue">older_than ≥ 7 天</span>
        </div>
        <table class="table lc-orphan-table">
          <thead>
            <tr>
              <th>桶</th>
              <th>孤儿文件</th>
              <th>回收空间</th>
              <th>安全窗口</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in orphanRows" :key="o.bucket">
              <td>{{ o.bucket }}</td>
              <td>{{ o.files }}</td>
              <td>{{ o.space }}</td>
              <td>{{ o.window }}</td>
              <td><span class="tag" :class="o.statusCls">{{ o.status }}</span></td>
            </tr>
          </tbody>
        </table>
        <div class="lc-orphan-warn">⚠ 禁止与快照过期同窗口执行，防止「快照刚过期→文件被删→回滚失败」</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lc-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .lc-kpi { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .lc-kpi { grid-template-columns: repeat(2, 1fr); }
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.lc-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--warning);
  background: var(--warning-light, #fff7e6);
  border-radius: 6px;
}
.lc-banner.deep {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--text-1);
  background: #e6f4ff;
  border: 1px solid #91caff;
}

.lc-grid-top { margin-top: 16px; }
.lc-page .card { margin-top: 16px; }
.lc-page .grid-2 .card { margin-top: 16px; }

.lc-stages-wrap { padding: 14px; }

.lifecycle-stage {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
@media (max-width: 900px) {
  .lifecycle-stage { grid-template-columns: repeat(2, 1fr); }
}
.ls-col {
  text-align: center;
  padding: 14px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
}
.ls-col.hot { background: linear-gradient(180deg, #fff2e8 0%, #fff 100%); }
.ls-col.warm { background: linear-gradient(180deg, #e6f7ff 0%, #fff 100%); }
.ls-col.cold { background: linear-gradient(180deg, #f0f5ff 0%, #fff 100%); }
.ls-col.archive { background: linear-gradient(180deg, #fafafa 0%, #fff 100%); }
.ls-icon { font-size: 22px; }
.ls-title { font-weight: 600; margin-top: 4px; font-size: 13px; }
.ls-engine, .ls-retention { font-size: 11px; color: var(--text-3); margin-top: 4px; }
.ls-size { font-size: 15px; font-weight: 700; margin-top: 8px; }
.ls-pct { font-size: 11px; color: var(--text-2); margin-top: 4px; }

.lc-jobs { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.lifecycle-job {
  display: grid;
  grid-template-columns: 28px 1fr auto auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #fff;
}
.lifecycle-job.success { border-left: 3px solid var(--success); }
.lifecycle-job.warn { border-left: 3px solid var(--warning); }
.lifecycle-job.failed { border-left: 3px solid var(--danger); }
.lj-step {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}
.lj-desc { font-weight: 600; color: var(--text-1); font-size: 13px; }
.lj-detail { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.lj-duration { font-size: 11px; color: var(--text-3); text-align: right; }

.lc-compliance { border-color: var(--danger); }
.lc-kpi .kpi-card.clickable {
  cursor: pointer;
}
.lc-kpi .kpi-card.clickable:hover {
  outline: 1px solid var(--primary, #1e6fff);
}
.lc-reclaim-note { margin: 0; padding: 10px 14px; border-bottom: 1px solid var(--border); }
.lc-comp-acts {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lc-footnote {
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-3);
  border-top: 1px solid var(--border);
}

.lc-compact-btn { padding: 2px 8px; font-size: 11px; }

.lc-orphan { font-size: 12px; line-height: 1.8; }
.lc-orphan-tags { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.lc-orphan-table { font-size: 11px; }
.lc-orphan-warn {
  margin-top: 8px;
  padding: 8px;
  background: var(--danger-light);
  border-radius: 6px;
  color: var(--danger);
  font-size: 11px;
}

.lc-policy-form {
  display: grid;
  grid-template-columns: 1.4fr repeat(4, 0.7fr) 0.7fr auto;
  gap: 10px;
  align-items: end;
}
.lc-policy-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-3);
  font-weight: 600;
}
@media (max-width: 1100px) {
  .lc-policy-form { grid-template-columns: 1fr 1fr; }
}
</style>
