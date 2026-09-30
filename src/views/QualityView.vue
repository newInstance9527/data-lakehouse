<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import ListPager from '@/components/common/ListPager.vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { useQuality } from '@/composables/useQuality'
import { useSession } from '@/composables/useSession'
import { QUALITY_RULE_FORM } from '@/data/createForms'
import {
  ensureMetricBindTables,
  invalidateMetricBindTables,
  metricBindMetaOf,
  metricBindTableOptions,
  warmMetricBindAssets,
} from '@/data/metricBindAssets'
import { pageGuideOf } from '@/data/pageGuides'
import { catalogAsset, catalogSearch, lineageField, standardDetect } from '@/utils/moduleLinks'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('quality')

const range = ref('30')
const layerFilter = ref('')
const ruleKw = ref(String(route.query.q || ''))
const createOpen = ref(false)
const busy = ref(false)
const gateBusy = ref(false)
const gateForm = reactive({
  id: '',
  layer: 'DWD',
  tableName: '',
  assetId: '',
  minScore: 95,
  blockOnFail: true,
})

const gateTableOptions = computed(() => metricBindTableOptions())

function onGateTableChange(v) {
  gateForm.tableName = v || ''
  const meta = metricBindMetaOf(v)
  gateForm.assetId = meta?.assetId || ''
}

const {
  metrics,
  omSummary,
  streamSummary,
  trendPoints,
  typeDistView,
  goldTables,
  ruleList,
  ruleTotal,
  gateList,
  loading,
  reloadByRange,
  createRule,
  saveGate,
  removeGate,
  loadRuleRuns,
  openTicket,
  syncOm,
} = useQuality()

const { currentWs } = useSession()

const runsOpen = ref(false)
const runsBusy = ref(false)
const runsRule = ref(null)
const runsList = ref([])
const runsTotal = ref(0)

const filteredRules = computed(() => {
  let list = ruleList.value
  const layer = layerFilter.value
  if (layer) list = list.filter((r) => r.layer === layer)
  const kw = ruleKw.value.trim().toLowerCase()
  if (kw) {
    list = list.filter((r) => {
      const blob = `${r.table || ''} ${r.field || ''} ${r.ruleCode || ''} ${r.displayId || ''} ${r.stdCodeSetId || ''}`.toLowerCase()
      return blob.includes(kw)
    })
  }
  return list
})

const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(filteredRules)

watch(layerFilter, () => resetPage())
watch(ruleKw, () => resetPage())

watch(
  () => route.query.q,
  (v) => {
    if (v != null) ruleKw.value = String(v)
  },
)

watch(range, async (v) => {
  busy.value = true
  try {
    await reloadByRange(v)
    resetPage()
  } catch (e) {
    showToast(`加载失败：${e.message || e}`, 'error')
  } finally {
    busy.value = false
  }
})

onMounted(async () => {
  if (route.query.q != null) ruleKw.value = String(route.query.q)
  busy.value = true
  try {
    await Promise.all([reloadByRange(range.value), ensureMetricBindTables().catch(() => {})])
  } catch (e) {
    showToast(`质量数据加载失败：${e.message || e}`, 'error')
  } finally {
    busy.value = false
  }
})

watch(currentWs, async () => {
  busy.value = true
  try {
    invalidateMetricBindTables()
    await Promise.all([reloadByRange(range.value), ensureMetricBindTables({ force: true }).catch(() => {})])
    resetPage()
  } catch (e) {
    showToast(`质量数据加载失败：${e.message || e}`, 'error')
  } finally {
    busy.value = false
  }
})

function newRule() {
  createOpen.value = true
  warmMetricBindAssets().catch(() => {})
}

async function onCreateRule(payload) {
  try {
    const row = await createRule(payload)
    createOpen.value = false
    if (layerFilter.value && row.layer && row.layer !== layerFilter.value) {
      layerFilter.value = ''
    }
    resetPage()
    const bindTip = row.field ? `${row.table}.${row.field}` : `${row.table}（整表）`
    const stdTip = row.stdCodeSetId ? ` · 码值集 ${row.stdCodeSetId}` : ''
    showToast(`质量规则已创建：${row.ruleCode || row.displayId} · 绑定 ${bindTip}${stdTip}`, 'success')
  } catch (e) {
    showToast(`创建失败：${e.message || e}`, 'error')
  }
}

async function onOpenTicket() {
  const firstFail = filteredRules.value.find((r) => !r.pass)
  try {
    const ticket = await openTicket(firstFail?.id, firstFail ? `失败规则 ${firstFail.displayId}` : '质量巡检')
    showToast(`质量工单已登记 · ${ticket.ticketId || ''}`, 'success')
  } catch (e) {
    showToast(`开工单失败：${e.message || e}`, 'error')
  }
}

async function onSyncOm() {
  busy.value = true
  try {
    const r = await syncOm()
    const synced = r?.testSynced ?? 0
    const fail = r?.failed ?? 0
    const tip = r?.hint || '已同步'
    if (r?.ok === false) {
      showToast(`元数据同步降级：${tip}`, 'warning')
    } else {
      showToast(`元数据同步完成 · 投影 ${synced} · 失败 ${fail} · ${tip}`, 'success')
    }
  } catch (e) {
    showToast(`元数据同步失败：${e.message || e}`, 'error')
  } finally {
    busy.value = false
  }
}

function editGate(g) {
  gateForm.id = g.id || ''
  gateForm.layer = g.layer || ''
  gateForm.tableName = g.tableName || ''
  gateForm.assetId = g.assetId || ''
  gateForm.minScore = g.minScore ?? 95
  gateForm.blockOnFail = g.blockOnFail !== false
}

function resetGateForm() {
  gateForm.id = ''
  gateForm.layer = 'DWD'
  gateForm.tableName = ''
  gateForm.assetId = ''
  gateForm.minScore = 95
  gateForm.blockOnFail = true
}

async function onSaveGate() {
  if (!gateForm.layer && !String(gateForm.tableName || '').trim() && !gateForm.assetId) {
    showToast('请填写层级或表名（表名可选，整层仅填层级）', 'warning')
    return
  }
  gateBusy.value = true
  try {
    const row = await saveGate({ ...gateForm })
    showToast(`门禁已保存 · ${row.layer || row.tableName || row.id} ≥ ${row.minScore}`, 'success')
    resetGateForm()
  } catch (e) {
    showToast(`门禁保存失败：${e.message || e}`, 'error')
  } finally {
    gateBusy.value = false
  }
}

async function onDeleteGate(g) {
  if (!g?.id) return
  if (!window.confirm(`删除门禁 ${g.layer || ''} ${g.tableName || ''}？`)) return
  gateBusy.value = true
  try {
    await removeGate(g.id)
    if (gateForm.id === g.id) resetGateForm()
    showToast('门禁已删除', 'success')
  } catch (e) {
    showToast(`删除失败：${e.message || e}`, 'error')
  } finally {
    gateBusy.value = false
  }
}

async function openRuns(rule) {
  runsRule.value = rule
  runsOpen.value = true
  runsBusy.value = true
  runsList.value = []
  try {
    const page = await loadRuleRuns(rule.id, { current: 1, size: 30 })
    runsList.value = page.records || []
    runsTotal.value = page.total || 0
  } catch (e) {
    showToast(`加载运行历史失败：${e.message || e}`, 'error')
  } finally {
    runsBusy.value = false
  }
}

function closeRuns() {
  runsOpen.value = false
  runsRule.value = null
  runsList.value = []
}

function goStdDetect(rule) {
  const q = rule.stdCodeSetId || rule.field || rule.table || ''
  router.push(standardDetect(q))
}

function fmtRunAt(v) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString()
  } catch {
    return String(v)
  }
}

function viewTable(rule) {
  if (rule.assetId) {
    router.push(catalogAsset(rule.assetId))
    return
  }
  const key = rule.table?.split('.').pop() || rule.table
  router.push(catalogSearch(key))
}

function viewGold(row) {
  router.push(catalogSearch(row.assetKey || row.table))
}

function goLineage(rule) {
  const focus = rule.table || ''
  router.push(lineageField(focus, rule.field || undefined))
}

function ringDash(pct) {
  const n = Math.min(100, Math.max(0, pct))
  return `${(n * 0.942).toFixed(1)} 100`
}

function fmtStreamAt(v) {
  if (!v) return ''
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString()
  } catch {
    return String(v)
  }
}

const trendTitle = computed(() => {
  if (range.value === '7') return '7 日'
  if (range.value === '1') return '今日'
  return '30 日'
})

const trendAxisLabels = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return []
  const step = Math.max(1, Math.floor(pts.length / 8))
  return pts.map((p, i) => (i % step === 0 || i === pts.length - 1 ? (p.day || '').slice(5) : ''))
})
</script>

<template>
  <div class="qual-page">
    <PageHeader
      page-id="quality"
      title="数据质量中心"
      subtitle="流批双模校验 · 质量门禁阻断 DAG · 结果回写资产目录"
      :guide="guide"
    >
      <select v-model="range" class="select input-sm" :disabled="busy || loading">
        <option value="30">近30天</option>
        <option value="7">近7天</option>
        <option value="1">今日</option>
      </select>
      <button type="button" class="btn btn-sm" :disabled="busy || loading" @click="onSyncOm">同步元数据</button>
      <button type="button" class="btn btn-sm btn-primary" @click="newRule">+ 新建规则</button>
    </PageHeader>

    <p class="tip qual-banner">KPI / 规则 / 门禁接质量服务；无数据为空态，不加载演示行。新建规则绑表来自资产目录。</p>

    <CreateFormModal
      :open="createOpen"
      v-bind="QUALITY_RULE_FORM"
      @close="createOpen = false"
      @submit="onCreateRule"
    />

    <div v-if="loading && !metrics.length" class="qual-empty">加载中…</div>

    <div class="quality-metrics-row">
      <div v-for="(m, i) in metrics" :key="i" class="quality-metric-card">
        <div class="qmc-chart">
          <svg viewBox="0 0 36 36" width="70" height="70">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#f0f3f8" stroke-width="4" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              :stroke="m.ringColor"
              stroke-width="4"
              :stroke-dasharray="ringDash(m.ringPct)"
              transform="rotate(-90 18 18)"
              stroke-linecap="round"
            />
            <text x="18" y="21" text-anchor="middle" font-size="11" font-weight="700" :fill="m.ringColor">
              {{ m.ringText }}
            </text>
          </svg>
        </div>
        <div class="qmc-info">
          <div class="qmc-title">{{ m.title }}</div>
          <div class="qmc-value">
            {{ m.value }} <span class="qmc-unit">{{ m.unit }}</span>
          </div>
          <div class="qmc-sub" :class="{ danger: m.subDanger, success: m.subSuccess }">{{ m.sub }}</div>
        </div>
      </div>
    </div>

    <div class="qual-om-strip" :class="{ down: !omSummary.available }">
      <div class="qual-om-title">外部质量画像 · Profiler / Test</div>
      <div class="qual-om-body">
        <template v-if="omSummary.available">
          <span>抽样表 {{ omSummary.sampledTables }}</span>
          <span>Profile 可达 {{ omSummary.profileOk }}</span>
          <span>Test {{ omSummary.testPass }}/{{ omSummary.testTotal }}
            <template v-if="omSummary.testPassRate != null">（{{ omSummary.testPassRate }}%）</template>
          </span>
          <span v-if="omSummary.testFail">失败 {{ omSummary.testFail }}</span>
        </template>
        <span v-else class="qual-om-hint">{{ omSummary.hint || '外部质量不可达，仅门户运行记录' }}</span>
        <span v-if="omSummary.available && omSummary.hint" class="qual-om-hint">{{ omSummary.hint }}</span>
      </div>
    </div>

    <div class="qual-om-strip" :class="{ down: streamSummary.runCount === 0 }">
      <div class="qual-om-title">流式探针</div>
      <div class="qual-om-body">
        <template v-if="streamSummary.runCount > 0">
          <span>近窗 {{ streamSummary.runCount }} 次</span>
          <span>通过 {{ streamSummary.passCount }}</span>
          <span :class="{ 'qual-om-danger': streamSummary.failCount > 0 }">失败 {{ streamSummary.failCount }}</span>
          <span v-if="streamSummary.lastAt" class="qual-om-hint">最近 {{ fmtStreamAt(streamSummary.lastAt) }}</span>
        </template>
        <span v-else class="qual-om-hint">{{ streamSummary.hint || '近窗无流式回调' }}</span>
      </div>
    </div>

    <div class="grid grid-2 qual-charts">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📈 质量分 {{ trendTitle }}趋势 <span class="tip">（按平均质量分 + 每日阻断次数）</span></div>
          <div class="qual-tags">
            <span class="tag tag-green">质量分</span>
            <span class="tag tag-red">阻断次数</span>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!trendPoints.length" class="qual-empty qual-empty-chart">暂无趋势数据</div>
          <div v-else class="quality-trend-chart">
            <div
              v-for="(d, i) in trendPoints"
              :key="i"
              class="qtc-col"
              :title="`${d.day || ''} ${d.v}分 · 阻断 ${d.blockCount ?? 0}`"
            >
              <div class="qtc-bar-wrap">
                <div class="qtc-bar" :class="d.cls" :style="{ height: `${d.h}%` }" />
              </div>
              <div class="qtc-label">{{ d.v }}</div>
            </div>
          </div>
          <div v-if="trendAxisLabels.length" class="qual-trend-axis">
            <span v-for="(lb, li) in trendAxisLabels" :key="li">{{ lb }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🏷️ 规则类型分布</div>
          <span class="tag">共 {{ ruleTotal }} 条规则</span>
        </div>
        <div class="card-body">
          <div v-if="!typeDistView.length" class="qual-empty qual-empty-sm">暂无分布</div>
          <div v-else class="qual-dist">
            <div v-for="t in typeDistView" :key="t.label" class="qual-dist-row">
              <div class="qual-dist-head">
                <span class="qual-dist-label">{{ t.label }}</span>
                <span class="qual-dist-meta"><b>{{ t.count }}</b> 条 · {{ t.pct }}%</span>
              </div>
              <div class="progress">
                <div class="progress-bar" :style="{ width: `${t.pct}%`, background: t.gradient }" />
              </div>
            </div>
          </div>

          <div class="qual-gold">
            <div class="qual-gold-title">🏆 Top 质量最优表</div>
            <div v-if="!goldTables.length" class="qual-empty qual-empty-xs">暂无黄金表</div>
            <div v-else class="qual-gold-list">
              <div v-for="g in goldTables" :key="g.table" class="qual-gold-row" @click="viewGold(g)">
                <span class="qual-gold-score">{{ g.score }}</span>
                <span class="qual-gold-name" :title="g.table">{{ g.table }}</span>
                <span class="tag tag-green">黄金</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card qual-gates-card">
      <div class="card-header">
        <div class="card-title">🚧 质量门禁 <span class="tip">· gov_dq_gate · 发布 / DAG 读取</span></div>
        <span class="tag">{{ gateList.length }} 条</span>
      </div>
      <div class="card-body">
        <div class="qual-gate-form">
          <select v-model="gateForm.layer" class="select input-sm">
            <option value="">层级（可选）</option>
            <option value="ODS">ODS</option>
            <option value="DWD">DWD</option>
            <option value="DWS">DWS</option>
            <option value="ADS">ADS</option>
          </select>
          <SearchSelect
            class="qual-gate-table-select"
            :model-value="gateForm.tableName"
            :options="gateTableOptions"
            sub-key="sub"
            allow-custom
            placeholder="表名（可选，空=整层）"
            @update:model-value="onGateTableChange"
          />
          <input
            v-model.number="gateForm.minScore"
            type="number"
            min="0"
            max="100"
            step="1"
            class="input input-sm qual-gate-score"
            title="最低质量分"
          />
          <label class="qual-gate-check">
            <input v-model="gateForm.blockOnFail" type="checkbox" />
            失败阻断
          </label>
          <button type="button" class="btn btn-sm btn-primary" :disabled="gateBusy" @click="onSaveGate">
            {{ gateForm.id ? '更新门禁' : '新增门禁' }}
          </button>
          <button v-if="gateForm.id" type="button" class="btn btn-sm" :disabled="gateBusy" @click="resetGateForm">取消编辑</button>
        </div>
        <div v-if="!gateList.length" class="qual-empty qual-empty-sm">暂无门禁，发布默认跳过或按层兜底</div>
        <div v-else class="qual-gate-list">
          <div v-for="g in gateList" :key="g.id" class="qual-gate-row">
            <span class="tag tag-blue">{{ g.layer || '—' }}</span>
            <code class="qual-gate-table">{{ g.tableName || '（整层）' }}</code>
            <span class="qual-gate-min">≥ {{ g.minScore }}</span>
            <span class="tag" :class="g.blockOnFail ? 'tag-red' : 'tag-gray'">{{ g.blockOnFail ? '阻断' : '仅告警' }}</span>
            <div class="qual-gate-actions">
              <button type="button" class="btn btn-sm" @click="editGate(g)">编辑</button>
              <button type="button" class="btn btn-sm" :disabled="gateBusy" @click="onDeleteGate(g)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">⚠️ 活跃异常规则<span class="tip"> · 数据来自质量中心</span></div>
        <div class="qual-tags">
          <input v-model="ruleKw" class="input input-sm qual-rule-kw" placeholder="表 / 字段 / 规则…" />
          <select v-model="layerFilter" class="select input-sm">
            <option value="">全部层级</option>
            <option value="ODS">ODS</option>
            <option value="DWD">DWD</option>
            <option value="DWS">DWS</option>
            <option value="ADS">ADS</option>
          </select>
          <button type="button" class="btn btn-sm" @click="onOpenTicket">📋 开工单</button>
        </div>
      </div>
      <div class="card-body qual-rules">
        <div v-if="!paged.length" class="qual-empty">当前筛选无规则</div>
        <div
          v-for="r in paged"
          :key="r.id"
          class="rule-card"
          :class="{ fail: !r.pass }"
        >
          <div class="rule-header">
            <div class="rule-name">
              <span class="tag" :class="r.pass ? 'tag-green' : 'tag-red'">{{ r.pass ? '✓ 通过' : '✗ 失败' }}</span>
              <span class="rule-id">{{ r.displayId || r.id }}</span>
              <span class="tag tag-blue">{{ r.level }}</span>
              <span class="tag tag-purple">{{ r.type }}</span>
              <span v-if="r.stream" class="tag tag-blue" title="最近运行为流式探针">流</span>
              <span v-if="r.stdCodeSetId" class="tag tag-blue" :title="r.stdCodeSetId">码值 {{ r.stdCodeSetId }}</span>
              <span v-if="r.omTestFqn" class="tag tag-blue" :title="r.omTestFqn">外部 Test</span>
              <span v-if="r.alert" class="tag tag-red">· 已阻断 DAG</span>
            </div>
            <div class="rule-status">{{ r.status }}</div>
          </div>
          <div class="rule-body">{{ r.expr }}</div>
          <div class="rule-meta">
            <span>📊 表：<code>{{ r.table }}</code></span>
            <span v-if="r.field"> · 字段：<code>{{ r.field }}</code></span>
            <span v-else> · <span class="tag tag-gray rule-meta-tag">表级</span></span>
          </div>
          <div class="rule-result-bar">
            <div class="rule-result-stats">
              <div class="progress rule-progress">
                <div class="progress-bar" :style="{ width: `${r.ok}%`, background: 'linear-gradient(90deg,var(--success) 0%, #5cdbd3 100%)' }" />
              </div>
              <span class="rule-pass-count">✓ {{ r.okRows }}</span>
              <span class="rule-fail-count">✗ {{ r.failRows }}</span>
            </div>
            <div class="rule-result-actions">
              <button type="button" class="btn btn-sm" @click="viewTable(r)">查看表 →</button>
              <button type="button" class="btn btn-sm" @click="openRuns(r)">运行历史</button>
              <button
                v-if="r.stdCodeSetId || r.type === '枚举' || (r.type && String(r.type).includes('码值'))"
                type="button"
                class="btn btn-sm"
                @click="goStdDetect(r)"
              >标准检测</button>
              <button
                v-if="!r.pass"
                type="button"
                class="btn btn-sm btn-primary"
                @click="goLineage(r)"
              >上溯血缘</button>
            </div>
          </div>
        </div>
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

    <div v-if="runsOpen" class="qual-runs-mask" @click.self="closeRuns">
      <div class="qual-runs-drawer" role="dialog" aria-label="运行历史">
        <div class="qual-runs-head">
          <div>
            <div class="qual-runs-title">运行历史</div>
            <div class="qual-om-hint">{{ runsRule?.displayId || runsRule?.id }} · 共 {{ runsTotal }} 条</div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeRuns">关闭</button>
        </div>
        <div v-if="runsBusy" class="qual-empty">加载中…</div>
        <div v-else-if="!runsList.length" class="qual-empty">暂无运行记录</div>
        <div v-else class="qual-runs-list">
          <div v-for="run in runsList" :key="run.id" class="qual-runs-row">
            <span class="tag" :class="run.pass ? 'tag-green' : 'tag-red'">{{ run.pass ? '通过' : '失败' }}</span>
            <span v-if="run.blocked" class="tag tag-red">阻断</span>
            <span v-if="String(run.jobRunId || '').startsWith('stream:')" class="tag tag-blue">流</span>
            <span class="qual-runs-pct">{{ run.okPct != null ? `${run.okPct}%` : '—' }}</span>
            <code class="qual-runs-job">{{ run.jobRunId || '—' }}</code>
            <span class="qual-om-hint">{{ fmtRunAt(run.ranAt) }}</span>
            <div class="qual-runs-msg">{{ run.message || '' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qual-page {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

/* 全局 .card { overflow:hidden } 会裁切换行后的标签/按钮 */
.qual-page :deep(.card),
.qual-page .card {
  overflow: visible;
  min-width: 0;
}

.qual-page :deep(.card-header),
.qual-page .card-header {
  align-items: flex-start;
  gap: 10px 12px;
  padding: 14px 18px;
}

.qual-page :deep(.card-body),
.qual-page .card-body {
  padding: 16px 18px;
}

.qual-empty {
  color: var(--text-3);
  text-align: center;
  padding: 28px 12px;
  line-height: 1.5;
}
.qual-empty-chart { padding: 36px 12px; min-height: 120px; display: flex; align-items: center; justify-content: center; }
.qual-empty-sm { padding: 16px 0; }
.qual-empty-xs { padding: 10px 0; }

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.qual-banner {
  margin: 0 0 14px;
  line-height: 1.55;
}

.quality-metrics-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .quality-metrics-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .quality-metrics-row { grid-template-columns: 1fr; }
}

.quality-metric-card {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 16px 18px;
  min-height: 92px;
  min-width: 0;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.qmc-chart { flex-shrink: 0; line-height: 0; }
.qmc-info { min-width: 0; flex: 1; }
.qmc-title { font-size: 12px; color: var(--text-3); line-height: 1.35; }
.qmc-value {
  font-size: 22px;
  font-weight: 700;
  margin-top: 4px;
  line-height: 1.2;
  word-break: break-word;
}
.qmc-unit { font-size: 13px; color: var(--text-3); font-weight: 400; }
.qmc-sub {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 6px;
  line-height: 1.4;
  word-break: break-word;
}
.qmc-sub.success { color: var(--success); }
.qmc-sub.danger { color: var(--danger); }

.qual-om-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px 18px;
  margin: 0 0 10px;
  padding: 12px 16px;
  background: #f7f9fc;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.45;
  min-width: 0;
}
.qual-om-strip + .qual-charts {
  margin-top: 6px;
}
.qual-om-strip.down {
  background: #fafafa;
  color: var(--text-3);
}
.qual-om-title {
  font-weight: 600;
  color: var(--text-1);
  flex: 0 1 auto;
}
.qual-om-body {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: baseline;
  flex: 1 1 220px;
  min-width: 0;
}
.qual-om-hint {
  color: var(--text-3);
  word-break: break-word;
}
.qual-om-danger {
  color: var(--danger);
}

.qual-gates-card { margin-bottom: 16px; }
.qual-gate-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.qual-gate-table-select {
  min-width: 200px;
  flex: 1 1 240px;
}
.qual-gate-score {
  width: 88px;
  flex: 0 0 auto;
}
.qual-gate-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}
.qual-gate-list { display: flex; flex-direction: column; gap: 10px; }
.qual-gate-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  min-width: 0;
}
.qual-gate-table {
  font-size: 12px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 120px;
}
.qual-gate-min { flex: 0 0 auto; color: var(--text-2); }
.qual-gate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}

.qual-charts {
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 16px;
  align-items: stretch;
}
@media (max-width: 960px) {
  .qual-charts { grid-template-columns: 1fr; }
}

.qual-tags {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
}
.qual-rule-kw {
  width: 180px;
  max-width: 100%;
  flex: 1 1 140px;
}

.quality-trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  min-height: 132px;
  height: 132px;
  padding-top: 8px;
  overflow-x: auto;
  overflow-y: hidden;
}
.qtc-col {
  flex: 1 1 0;
  min-width: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.qtc-bar-wrap {
  width: 100%;
  height: 100px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.qtc-bar {
  width: 70%;
  min-width: 4px;
  min-height: 4px;
  border-radius: 3px 3px 0 0;
  background: var(--success);
}
.qtc-bar.warn { background: var(--warning); }
.qtc-bar.bad { background: var(--danger); }
.qtc-label {
  font-size: 9px;
  color: var(--text-4);
  margin-top: 4px;
  line-height: 1.2;
}

.qual-trend-axis {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-top: 10px;
  font-size: 10px;
  color: var(--text-3);
  text-align: center;
  line-height: 1.3;
}
.qual-trend-axis span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qual-dist { display: flex; flex-direction: column; gap: 14px; }
.qual-dist-row { min-width: 0; }
.qual-dist-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  margin-bottom: 6px;
  line-height: 1.35;
}
.qual-dist-label { min-width: 0; word-break: break-word; }
.qual-dist-meta { flex-shrink: 0; color: var(--text-2); }

.qual-gold {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px dashed var(--border);
}
.qual-gold-title { font-size: 12px; font-weight: 600; margin-bottom: 12px; }
.qual-gold-list { display: flex; flex-direction: column; gap: 8px; }
.qual-gold-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--success-light);
  border-radius: 6px;
  cursor: pointer;
  min-width: 0;
}
.qual-gold-score {
  font-weight: 700;
  color: var(--success);
  flex: 0 0 36px;
  text-align: right;
}
.qual-gold-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qual-rules { display: flex; flex-direction: column; gap: 14px; }
.rule-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  background: #fff;
  min-width: 0;
  overflow: visible;
}
.rule-card.fail { border-color: #ffccc7; background: #fffafa; }
.rule-header {
  display: flex;
  justify-content: space-between;
  gap: 10px 14px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.rule-name {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  min-width: 0;
  flex: 1 1 240px;
}
.rule-id {
  font-weight: 600;
  font-size: 13px;
  word-break: break-word;
}
.rule-status {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.4;
  max-width: 100%;
  flex: 0 1 auto;
  word-break: break-word;
}
.rule-body {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
  word-break: break-word;
}
.rule-meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
  word-break: break-word;
}
.rule-meta code { word-break: break-all; }
.rule-meta-tag { font-size: 10px; }

.rule-result-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  margin-top: 12px;
}
.rule-result-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 1 1 200px;
  min-width: 0;
}
.rule-progress {
  flex: 1 1 120px;
  min-width: 100px;
  height: 6px;
}
.rule-pass-count { font-size: 11px; color: var(--success); white-space: nowrap; }
.rule-fail-count { font-size: 11px; color: var(--danger); white-space: nowrap; }
.rule-result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  flex: 0 1 auto;
}
.rule-result-actions .btn { flex-shrink: 0; }

.qual-runs-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 40;
  display: flex;
  justify-content: flex-end;
}
.qual-runs-drawer {
  width: min(480px, 100%);
  height: 100%;
  background: #fff;
  border-left: 1px solid var(--border);
  padding: 18px 20px;
  overflow: auto;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}
.qual-runs-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.qual-runs-title { font-size: 16px; font-weight: 700; line-height: 1.3; }
.qual-runs-list { display: flex; flex-direction: column; gap: 10px; }
.qual-runs-row {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  font-size: 12px;
  min-width: 0;
}
.qual-runs-pct { font-weight: 600; }
.qual-runs-job {
  font-size: 11px;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 120px;
}
.qual-runs-msg {
  width: 100%;
  color: var(--text-3);
  word-break: break-word;
  line-height: 1.45;
  margin-top: 2px;
}

@media (max-width: 640px) {
  .qual-gate-actions { margin-left: 0; width: 100%; }
  .qual-rule-kw { width: 100%; flex-basis: 100%; }
  .rule-result-stats,
  .rule-result-actions { flex-basis: 100%; }
}
</style>
