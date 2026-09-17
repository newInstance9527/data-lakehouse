<script setup>
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  LC_COMPACTION,
  LC_JOBS,
  LC_KPIS,
  LC_ORPHAN,
  LC_SNAPSHOT_POLICIES,
  LC_STAGES,
  LC_STORAGE,
  lcJobStatusMeta,
} from '@/data/lifecycle'
import { LC_COMPLIANCE_PREVIEW, complianceTypeCls } from '@/data/compliance'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('lifecycle')

function runLifecycleNow() {
  showToast('▶ 生命周期日作业已提交 · 全表扫描 · 预计 25min', 'success')
}

function showStorageTrend() {
  router.push('/lifecycle/storage')
}

function openComplianceDelete() {
  router.push({ path: '/compliance', query: { create: '1' } })
}

function goCompliance() {
  router.push('/compliance')
}

function expireSnapshot(table) {
  showToast(`快照过期任务已触发 · ${table}`, 'success')
}

function runCompaction(table) {
  showToast(`⚡ 小文件合并作业已提交 · ${table}`, 'success')
}

function scanOrphans() {
  showToast('🔍 孤儿文件扫描已启动 · 标记未被 snapshot 引用的文件', 'info')
}

function goCatalog(table) {
  router.push({ path: '/catalog', query: { q: table } })
}
</script>

<template>
  <div class="lc-page">
    <PageHeader
      title="生命周期与小文件治理"
      subtitle="冷热分层 · 快照过期 · 小文件合并 · 孤儿清理 · 分区过期 · 归档恢复 · 合规删除"
      :guide="guide"
    >
      <button class="btn btn-sm" type="button" @click="runLifecycleNow">▶ 立即执行</button>
      <button class="btn btn-sm btn-primary" type="button" @click="openComplianceDelete">🗑️ 合规删除</button>
    </PageHeader>

    <div class="kpi-grid lc-kpi">
      <div v-for="(k, i) in LC_KPIS" :key="i" class="kpi-card" :class="k.color">
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
          <div v-for="s in LC_STAGES" :key="s.id" class="ls-col" :class="s.id">
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
          <div class="card-title">⚙️ 生命周期日作业 <span class="tip">· 每日 02:00 · DS 编排</span></div>
          <span class="tag tag-green">上次成功</span>
        </div>
        <div class="card-body lc-jobs">
          <div
            v-for="j in LC_JOBS"
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
          <div class="card-title">📊 各表存储与策略 <span class="tip">· 分层 / 快照 / 合并策略</span></div>
          <button type="button" class="btn btn-sm" @click="showStorageTrend">增速趋势 →</button>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>表</th>
                <th>层</th>
                <th>存储</th>
                <th>文件数</th>
                <th>策略</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in LC_STORAGE" :key="row.table">
                <td>
                  <button type="button" class="btn-link" @click="goCatalog(row.table)">{{ row.table }}</button>
                </td>
                <td><span class="tag tag-blue" style="font-size: 10px">{{ row.layer }}</span></td>
                <td><b>{{ row.size }}</b></td>
                <td style="font-size: 11px">{{ row.files }}</td>
                <td><span class="tag tag-gray" style="font-size: 10px">{{ row.policy }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
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
            <tr v-for="t in LC_COMPLIANCE_PREVIEW" :key="t.id">
              <td>
                <button type="button" class="btn-link" @click="goCompliance">
                  <code>{{ t.id }}</code>
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

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📸 快照过期策略 · §32.1 <span class="tip">· 每表可配</span></div>
          <button type="button" class="btn btn-sm" @click="() => showToast('＋ 新建快照策略（演示）', 'info')">＋ 新建策略</button>
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
              <tr v-for="p in LC_SNAPSHOT_POLICIES" :key="p.table">
                <td><code>{{ p.table }}</code></td>
                <td>{{ p.keepCount }}</td>
                <td>
                  <span v-if="p.daysTag" class="tag tag-red">{{ p.keepDays }} 天</span>
                  <template v-else>{{ p.keepDays }} 天</template>
                </td>
                <td>{{ p.minSnapshots }}</td>
                <td>
                  <button type="button" class="btn-link btn-sm" @click="expireSnapshot(p.table)">立即过期</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="lc-footnote">安全：先 expire（逻辑删）→ 24h 观察 → remove_orphan_files（物理删）</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🧹 小文件合并 · §32.2 <span class="tip">· compaction SLA</span></div>
          <span class="tag tag-orange">2 表超阈值</span>
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
              <tr v-for="c in LC_COMPACTION" :key="c.table">
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
                    @click="runCompaction(c.table)"
                  >⚡ 合并</button>
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
        <div class="card-title">🗑️ 孤儿文件清理 · §32.3 <span class="tip">· 快照过期 +72h 后物理删</span></div>
        <button type="button" class="btn btn-sm" @click="scanOrphans">🔍 扫描孤儿</button>
      </div>
      <div class="card-body lc-orphan">
        <div class="lc-orphan-tags">
          <span class="tag tag-green">最近清理 09-03 03:15</span>
          <span class="tag tag-blue">回收 64GB</span>
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
            <tr v-for="o in LC_ORPHAN" :key="o.bucket">
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
</style>
