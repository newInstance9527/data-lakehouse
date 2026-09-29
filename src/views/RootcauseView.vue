<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useWsListScope } from '@/composables/useWsListScope'
import { pageGuideOf } from '@/data/pageGuides'
import { rcMetricStyle, rcRowClass, rcStepContentClass } from '@/data/rootcause'
import {
  fetchObsRootcauseAlerts,
  postObsRootcauseAnalyze,
  postObsRootcauseConclusion,
  postObsRootcauseRemediate,
} from '@/api/observability'

const router = useRouter()
const { showToast } = useToast()
const { listWsParams, watchListScope } = useWsListScope()
const guide = pageGuideOf('rootcause')

const loading = ref(false)
const loadError = ref('')
const source = ref('empty')
const message = ref('')
const alertOptions = ref([])
const alertId = ref('')
const steps = ref([])
const evidence = ref([])
const actions = ref([])
const longTerm = ref([])

const hasFocus = computed(() => alertOptions.value.length > 0)

async function loadAlerts() {
  const page = await fetchObsRootcauseAlerts(listWsParams())
  alertOptions.value = Array.isArray(page?.records) ? page.records : []
  if (!alertOptions.value.find((o) => o.value === alertId.value)) {
    alertId.value = alertOptions.value[0]?.value || ''
  }
}

async function runAnalyze() {
  loading.value = true
  loadError.value = ''
  try {
    await loadAlerts()
    const body = {
      ...listWsParams(),
      alertId: alertId.value || undefined,
    }
    const r = await postObsRootcauseAnalyze(body)
    source.value = r?.source || 'empty'
    message.value = r?.message || ''
    steps.value = Array.isArray(r?.steps)
      ? r.steps.map((s) => ({
          num: s.num ?? s.n,
          title: s.title,
          alert: s.alert,
          conclusion: s.conclusion,
          content: Array.isArray(s.content)
            ? s.content
            : s.detail
              ? [s.detail]
              : [],
        }))
      : []
    evidence.value = Array.isArray(r?.evidence) ? r.evidence : []
    actions.value = Array.isArray(r?.actions) ? r.actions : []
    longTerm.value = Array.isArray(r?.longTerm) ? r.longTerm : []
  } catch (e) {
    loadError.value = e?.message || '根因 API 加载失败'
    source.value = 'empty'
    message.value = ''
    steps.value = []
    evidence.value = []
    actions.value = []
    longTerm.value = []
    showToast(loadError.value, 'warning')
  } finally {
    loading.value = false
  }
}

function goLinktrace() {
  router.push('/linktrace')
}

function exportReport() {
  showToast('功能待接后端 · 无证据时不可导出演示报告', 'info')
}

async function dispatchTicket() {
  try {
    const r = await postObsRootcauseConclusion({
      ...listWsParams(),
      alertId: alertId.value || undefined,
      summary: message.value || undefined,
    })
    showToast(r?.summary || '结论已生成 · 可转 AI diagnose', 'success')
    if (r?.ai?.path) {
      showToast(`AI 钩子 ${r.ai.path} · intent=${r.ai.intent}`, 'info')
    }
  } catch (e) {
    showToast(e?.message || '结论接口失败', 'warning')
  }
}

function onEvidenceAction(row) {
  const a = row.action
  if (!a) return
  if (a.type === 'route') {
    router.push(a.query ? { path: a.path, query: a.query } : a.path)
    return
  }
  if (a.type === 'toast') {
    showToast(a.message || '功能待接后端', a.level || 'info')
  }
}

async function runAction() {
  try {
    const r = await postObsRootcauseRemediate({
      ...listWsParams(),
      alertId: alertId.value || undefined,
    })
    if (r?.backfill) {
      showToast(`补数已提交 · ${r.backfill.runId || ''}`, 'success')
    } else {
      showToast(r?.backfillHint || '处置已登记（须 dagId+markValue 才触发补数）', 'info')
    }
  } catch (e) {
    showToast(e?.message || '处置失败', 'warning')
  }
}

watch(alertId, () => {
  if (alertId.value) runAnalyze()
})

onMounted(runAnalyze)
watchListScope(runAnalyze)
</script>

<template>
  <div class="rc-page">
    <PageHeader
      page-id="rootcause"
      title="根因分析台"
      subtitle="血缘 × 任务状态 × 质量 × 组件监控 · 四者对齐才能不靠猜"
      :guide="guide"
    >
      <select
        v-if="hasFocus"
        v-model="alertId"
        class="select input-sm rc-alert-select"
      >
        <option v-for="o in alertOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <span v-else class="tip rc-no-alert">暂无告警焦点</span>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="runAnalyze">
        {{ loading ? '分析中…' : '↻ 重新分析' }}
      </button>
      <button type="button" class="btn btn-sm" @click="goLinktrace">🧵 查本次 span 瀑布</button>
      <button type="button" class="btn btn-sm" @click="exportReport">📄 导出报告</button>
      <button type="button" class="btn btn-sm btn-primary" @click="dispatchTicket">
        📋 派发根因工单
      </button>
    </PageHeader>

    <p class="tip rc-banner">
      无血缘 × 任务 × 质量 × 链路证据时为空态，不加载演示故事线。
    </p>
    <p v-if="loadError" class="tip rc-banner warn">加载失败：{{ loadError }}</p>
    <p v-else-if="message" class="tip rc-banner">{{ message }}</p>

    <div class="rootcause-flow">
      <div class="rc-flow-head">
        <span>🧭 根因推进：</span>
        <span class="rc-flow-sub">血缘向上 × 任务状态 × 质量规则 × 组件延迟 四维叠加</span>
      </div>
      <div v-if="!steps.length" class="rc-empty">
        暂无推进步骤 · 空态合法。有真实告警后由 analyze 返回证据链（不回落 ads_gmv 演示）。
      </div>
      <div v-else class="rc-steps">
        <div
          v-for="s in steps"
          :key="s.num"
          class="rc-step"
          :class="{ alert: s.alert, conclusion: s.conclusion }"
        >
          <div class="rc-step-num">{{ s.num }}</div>
          <div class="rc-step-title">{{ s.title }}</div>
          <div class="rc-step-content" :class="rcStepContentClass(s)">
            <template v-for="(line, li) in s.content || []" :key="li">
              <br v-if="li > 0" />{{ line }}
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 rc-grid">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔬 根因详情证据链 <span class="tip">· 每一步都可下钻</span></div>
        </div>
        <div class="card-body rc-table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>层级</th>
                <th>对象</th>
                <th>异常现象</th>
                <th>指标值</th>
                <th>SLA / 阈值</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!evidence.length">
                <td colspan="6" class="rc-empty-cell">暂无证据行 · 空列表合法</td>
              </tr>
              <tr v-for="(row, i) in evidence" :key="i" :class="rcRowClass(row.rowTone)">
                <td>
                  <span class="tag" :class="row.layerTag">{{ row.layer }}</span>
                </td>
                <td class="rc-obj">{{ row.object }}</td>
                <td>{{ row.symptom }}</td>
                <td :style="rcMetricStyle(row.metricTone)">{{ row.metric }}</td>
                <td>{{ row.sla }}</td>
                <td>
                  <button
                    v-if="row.actionLabel"
                    type="button"
                    class="btn-link btn-sm"
                    @click="onEvidenceAction(row)"
                  >
                    {{ row.actionLabel }}
                  </button>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">💡 平台建议 & 一键修复</div>
        </div>
        <div class="card-body">
          <div v-if="!actions.length" class="rc-empty-cell">
            暂无处置建议 · 接通 remediate API 前不伪造成功
          </div>
          <div
            v-for="a in actions"
            :key="a.id"
            class="rc-suggest"
            :class="`tone-${a.tone || 'primary'}`"
          >
            <div class="rc-suggest-title">{{ a.title }}</div>
            <div class="rc-suggest-body">{{ a.body }}</div>
            <button
              type="button"
              class="btn btn-sm"
              :class="a.btnClass"
              @click="runAction(a)"
            >
              {{ a.btnText || '执行' }}
            </button>
          </div>

          <div class="rc-longterm">
            <div class="rc-longterm-title">📝 事后改进方向（长期）</div>
            <ul v-if="longTerm.length">
              <li v-for="(item, i) in longTerm" :key="i">{{ item }}</li>
            </ul>
            <p v-else class="tip">暂无长期改进条目</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rc-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-2);
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.5;
}
.rc-banner.warn {
  background: var(--warning-light);
  color: var(--text-1);
}
.rc-banner code {
  font-size: 11px;
}
.rc-alert-select {
  max-width: 280px;
}
.rc-no-alert {
  font-size: 12px;
  align-self: center;
}
.rc-empty,
.rc-empty-cell {
  text-align: center;
  color: var(--text-3);
  padding: 20px;
  font-size: 12px;
  line-height: 1.6;
}
.rc-empty-cell {
  padding: 24px !important;
}
.muted {
  color: var(--text-3);
}

.rootcause-flow {
  background: var(--bg-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  padding: 20px;
  margin-bottom: 20px;
}
.rc-flow-head {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 14px;
  color: var(--text-2);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rc-flow-sub {
  color: var(--text-3);
  font-weight: 400;
}

.rc-steps {
  display: flex;
  align-items: stretch;
  gap: 0;
}
.rc-step {
  flex: 1;
  position: relative;
  padding: 14px;
  border: 1px solid var(--border);
  margin-right: -1px;
  background: var(--bg-1);
}
.rc-step:first-child {
  border-radius: 8px 0 0 8px;
}
.rc-step:last-child {
  border-radius: 0 8px 8px 0;
  margin-right: 0;
}
.rc-step.alert {
  border-color: var(--danger);
  background: var(--danger-light);
  z-index: 2;
}
.rc-step.conclusion {
  border-color: var(--warning);
  background: var(--warning-light);
  z-index: 2;
}
.rc-step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}
.rc-step.alert .rc-step-num {
  background: var(--danger);
  color: #fff;
}
.rc-step.conclusion .rc-step-num {
  background: var(--warning);
  color: #fff;
}
.rc-step-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
.rc-step-content {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.6;
}
.rc-step-content.is-danger {
  color: var(--danger);
  font-weight: 600;
}
.rc-step-content.is-bold {
  font-weight: 600;
}

.rc-table-wrap {
  padding: 0;
  overflow-x: auto;
}
.rc-obj {
  font-weight: 500;
}
.row-danger {
  background: var(--danger-light);
}
.row-warning {
  background: var(--warning-light);
}
.row-muted {
  background: var(--bg-2);
}

.rc-suggest {
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
}
.rc-suggest.tone-primary {
  background: var(--primary-light);
  border: 1px solid #bfd5ff;
}
.rc-suggest.tone-warning {
  background: var(--warning-light);
  border: 1px solid #ffd591;
}
.rc-suggest.tone-success {
  background: var(--success-light);
  border: 1px solid #b7ebd4;
}
.rc-suggest-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.tone-primary .rc-suggest-title {
  color: var(--primary-dark);
}
.tone-warning .rc-suggest-title {
  color: #d48806;
}
.tone-success .rc-suggest-title {
  color: #00a676;
}
.rc-suggest-body {
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 10px;
  line-height: 1.6;
}

.rc-longterm {
  padding: 12px 14px;
  background: var(--bg-2);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.rc-longterm-title {
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 6px;
}
.rc-longterm ul {
  padding-left: 18px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.8;
  margin: 0;
}

@media (max-width: 1200px) {
  .rc-steps {
    flex-direction: column;
  }
  .rc-step {
    margin-right: 0;
    margin-bottom: -1px;
  }
  .rc-step:first-child {
    border-radius: 8px 8px 0 0;
  }
  .rc-step:last-child {
    border-radius: 0 0 8px 8px;
    margin-bottom: 0;
  }
}
</style>
