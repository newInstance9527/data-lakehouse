<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  RC_ACTIONS,
  RC_ALERT_OPTIONS,
  RC_EVIDENCE,
  RC_LONG_TERM,
  RC_STEPS,
} from '@/data/rootcause'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('rootcause')

const alertId = ref(RC_ALERT_OPTIONS[0].value)

function goLinktrace() {
  router.push('/linktrace')
}

function exportReport() {
  showToast('📄 根因分析报告导出中 · PDF · GMV对账失败 · CDC lag · CK缺数', 'success')
}

function dispatchTicket() {
  showToast('📋 根因工单已派发 · 挂表 owner 李明（演示）', 'success')
}

function onEvidenceAction(row) {
  const a = row.action
  if (!a) return
  if (a.type === 'route') {
    router.push(a.query ? { path: a.path, query: a.query } : a.path)
    return
  }
  if (a.type === 'toast') {
    showToast(a.message, a.level || 'info')
  }
}

function runAction(action) {
  showToast(action.toast, action.toastLevel || 'info')
}

function metricStyle(tone) {
  if (tone === 'danger') return { color: 'var(--danger)' }
  if (tone === 'warning') return { color: 'var(--warning)' }
  if (tone === 'muted') return { color: 'var(--text-2)' }
  return undefined
}

function rowClass(tone) {
  if (tone === 'danger') return 'row-danger'
  if (tone === 'warning') return 'row-warning'
  if (tone === 'muted') return 'row-muted'
  return ''
}

function stepContentClass(step) {
  return {
    'is-danger': step.contentTone === 'danger',
    'is-bold': step.contentBold,
  }
}
</script>

<template>
  <div class="rc-page">
    <PageHeader
      title="根因分析台 · 链路 H（P0）"
      subtitle="血缘 × 任务状态 × 质量 × 组件监控 · 四者对齐才能不靠猜"
      :guide="guide"
    >
      <select v-model="alertId" class="select input-sm rc-alert-select">
        <option v-for="o in RC_ALERT_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <button type="button" class="btn btn-sm" @click="goLinktrace">🧵 查本次 span 瀑布</button>
      <button type="button" class="btn btn-sm" @click="exportReport">📄 导出报告</button>
      <button type="button" class="btn btn-sm btn-primary" @click="dispatchTicket">
        📋 派发根因工单
      </button>
    </PageHeader>

    <div class="rootcause-flow">
      <div class="rc-flow-head">
        <span>🧭 根因推进：</span>
        <span class="rc-flow-sub">血缘向上 × 任务状态 × 质量规则 × 组件延迟 四维叠加</span>
      </div>
      <div class="rc-steps">
        <div
          v-for="s in RC_STEPS"
          :key="s.num"
          class="rc-step"
          :class="{ alert: s.alert, conclusion: s.conclusion }"
        >
          <div class="rc-step-num">{{ s.num }}</div>
          <div class="rc-step-title">{{ s.title }}</div>
          <div class="rc-step-content" :class="stepContentClass(s)">
            <template v-for="(line, li) in s.content" :key="li">
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
              <tr v-for="(row, i) in RC_EVIDENCE" :key="i" :class="rowClass(row.rowTone)">
                <td>
                  <span class="tag" :class="row.layerTag">{{ row.layer }}</span>
                </td>
                <td class="rc-obj">{{ row.object }}</td>
                <td>{{ row.symptom }}</td>
                <td :style="metricStyle(row.metricTone)">{{ row.metric }}</td>
                <td>{{ row.sla }}</td>
                <td>
                  <button type="button" class="btn-link btn-sm" @click="onEvidenceAction(row)">
                    {{ row.actionLabel }}
                  </button>
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
          <div
            v-for="a in RC_ACTIONS"
            :key="a.id"
            class="rc-suggest"
            :class="`tone-${a.tone}`"
          >
            <div class="rc-suggest-title">{{ a.title }}</div>
            <div class="rc-suggest-body">{{ a.body }}</div>
            <button
              type="button"
              class="btn btn-sm"
              :class="a.btnClass"
              @click="runAction(a)"
            >
              {{ a.btnText }}
            </button>
          </div>

          <div class="rc-longterm">
            <div class="rc-longterm-title">📝 事后改进方向（长期）</div>
            <ul>
              <li v-for="(item, i) in RC_LONG_TERM" :key="i">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rc-alert-select {
  max-width: 280px;
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
