<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { usePublish } from '@/composables/usePublish'
import { useSession } from '@/composables/useSession'
import { pageGuideOf } from '@/data/pageGuides'
import {
  PUBLISH_ENV_STAGES,
  gateIcon,
  historyResultMeta,
} from '@/data/publish'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { currentWs } = useSession()
const guide = pageGuideOf('publish')
const { items, gateList, focus, focusId, refresh, publish, rollback, select } = usePublish()
const loadError = ref('')

const kpis = computed(() => {
  const list = items.value
  const review = list.filter((r) => r.status === 'IN_REVIEW').length
  const published = list.filter((r) => r.status === 'PUBLISHED').length
  const rolled = list.filter((r) => r.status === 'ROLLED_BACK').length
  const rejected = list.filter((r) => r.status === 'REJECTED').length
  return [
    { icon: '🧪', color: 'orange', value: String(review), unit: '单', label: '门禁中', trend: '静态检查 + 试跑' },
    { icon: '📦', color: 'green', value: String(published), unit: '单', label: '已发布', trend: 'Git tag + 调度投影' },
    { icon: '🔄', color: 'purple', value: String(rolled), unit: '单', label: '已回滚', trend: '指向更早 tag' },
    { icon: '✗', color: 'red', value: String(rejected), unit: '单', label: '未通过', trend: '不能标已发布' },
    { icon: '🚫', color: 'red', value: '0', unit: '次', label: '裸改生产', trend: '已禁用' },
  ]
})

const focusStatus = computed(() => items.value.find((r) => r.id === focusId.value)?.status || '')

async function load() {
  try {
    await refresh(currentWs.value || 'default')
    loadError.value = ''
    const id = typeof route.query.id === 'string' ? route.query.id : ''
    if (id) {
      const row = items.value.find((r) => r.id === id)
      if (row) select(row)
    }
  } catch (e) {
    loadError.value = e?.message || '发布单接口不可用'
    showToast(loadError.value, 'warning')
  }
}

function goDevelop() {
  router.push('/develop')
}

async function onPublish() {
  if (!focusId.value) return
  try {
    const row = await publish(focusId.value)
    showToast(`已发布 ${row.pkg} · ${row.tag}`, 'success')
  } catch (e) {
    showToast(e?.message || '发布失败', 'warning')
  }
}

async function onRollback() {
  if (!focusId.value) return
  if (!window.confirm('回滚会按上一 Git tag 重新投影调度，不会改调度器里的 SQL。继续？')) return
  try {
    const row = await rollback(focusId.value)
    showToast(`已回滚到 ${row.rolledToTag || row.tag}`, 'success')
  } catch (e) {
    showToast(e?.message || '回滚失败', 'warning')
  }
}

onMounted(load)
watch(currentWs, load)
watch(
  () => route.query.id,
  () => {
    const id = typeof route.query.id === 'string' ? route.query.id : ''
    if (!id) return
    const row = items.value.find((r) => r.id === id)
    if (row) select(row)
  },
)
</script>

<template>
  <div class="pub-page">
    <PageHeader
      title="环境与发布管理"
      subtitle="dev / stg / prod 三环境隔离 · Git 为源 · 发布门禁 · 回滚 · 禁止裸改生产 SQL"
      :guide-title="guide.title"
      :guide="guide"
    >
      <button class="btn btn-sm" @click="goDevelop">＋ 从脚本提交</button>
      <button class="btn btn-sm" :disabled="!focusId || focusStatus === 'PUBLISHED'" @click="onPublish">发布</button>
      <button class="btn btn-sm" :disabled="!focusId" @click="onRollback">回滚上一 tag</button>
      <button class="btn btn-sm btn-primary" @click="goDevelop">🔗 数据开发</button>
    </PageHeader>

    <div v-if="loadError" class="banner-soft">{{ loadError }}</div>

    <div class="kpi-grid pub-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend up">{{ k.trend }}</div>
      </div>
    </div>

    <!-- 三环境隔离 -->
    <div class="card" style="margin-top: 0; margin-bottom: 16px">
      <div class="card-header">
        <div class="card-title">
          🌐 三环境隔离
          <span class="tip">· Catalog 前缀 · 数据脱敏 · 禁止跨环境</span>
        </div>
      </div>
      <div class="card-body" style="padding: 14px">
        <div class="env-pipeline">
          <template v-for="(s, i) in PUBLISH_ENV_STAGES" :key="s.id">
            <div class="env-stage" :class="s.id">
              <div class="es-icon">{{ s.icon }}</div>
              <div class="es-name">{{ s.name }}</div>
              <div class="es-prefix">{{ s.prefix }}</div>
              <div class="es-count">{{ s.lines[0] }}</div>
              <div class="es-count" :class="s.tone">{{ s.lines[1] }}</div>
            </div>
            <div v-if="i < PUBLISH_ENV_STAGES.length - 1" class="env-arrow">→</div>
          </template>
        </div>
      </div>
    </div>

    <!-- 门禁 + 发布记录 -->
    <div class="pub-grid">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            🚦 发布门禁 · <code>{{ focus }}</code>
          </div>
          <span class="tag" :class="focusStatus === 'PUBLISHED' ? 'tag-green' : focusStatus === 'REJECTED' ? 'tag-red' : 'tag-orange'">
            {{ focusStatus || '无发布单' }}
          </span>
        </div>
        <div class="card-body" style="padding: 0">
          <div
            v-for="g in gateList"
            :key="g.step"
            class="gate-step"
            :class="g.status"
          >
            <div class="gs-icon">{{ gateIcon(g.status) }}</div>
            <div>
              <div class="gs-name">{{ g.name }}</div>
              <div class="gs-detail">{{ g.detail }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">📜 最近发布记录</div>
        </div>
        <div class="card-body" style="padding: 0; overflow: auto">
          <table class="table">
            <thead>
              <tr>
                <th>发布包</th>
                <th>Git Tag</th>
                <th>环境</th>
                <th>结果</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="h in items"
                :key="h.id"
                :class="{ active: h.id === focusId }"
                @click="select(h)"
              >
                <td><code class="pkg">{{ h.pkg }}</code></td>
                <td><code>{{ h.tag }}</code></td>
                <td><span class="tag tag-blue">{{ h.env }}</span></td>
                <td>
                  <span class="tag" :class="historyResultMeta(h.result).cls">
                    {{ historyResultMeta(h.result).label }}
                  </span>
                </td>
                <td class="time">{{ h.time }}</td>
              </tr>
              <tr v-if="!items.length">
                <td colspan="5" class="time">还没有发布单。在数据开发里保存并试跑后点「提交上版」。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 回滚策略 -->
    <div class="card pub-rollback">
      <div class="card-header">
        <div class="card-title">🔄 回滚策略</div>
      </div>
      <div class="card-body pub-rollback-body">
        <div><b>回滚 = 指向上一 Git tag</b>，禁止在调度器里热改 SQL。</div>
        <div><b>dev 环境禁止连生产 MinIO 桶</b>；抽样脱敏用静态脱敏作业从 prod 拉（需申请单）。</div>
        <div><b>统一门户（SSO）聚合</b>：目录（OM）、申请、Superset、Trino、DS、Flink、夜莺。不做第二个调度器。</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pub-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .pub-kpi { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .pub-kpi { grid-template-columns: repeat(2, 1fr); }
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.pub-form {
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 0.8fr 0.8fr auto;
  gap: 10px;
  align-items: end;
}
.pub-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-3);
  font-weight: 600;
}
@media (max-width: 1100px) {
  .pub-form { grid-template-columns: 1fr 1fr; }
}

.env-pipeline {
  display: flex;
  gap: 0;
  align-items: stretch;
}
.env-stage {
  flex: 1;
  padding: 14px 12px;
  text-align: center;
  border: 1px solid var(--border);
  position: relative;
}
.env-stage + .env-stage {
  border-left: none;
}
.env-stage.dev { background: linear-gradient(180deg, #f0f5ff 0%, #fff 100%); }
.env-stage.stg { background: linear-gradient(180deg, #fff7e6 0%, #fff 100%); }
.env-stage.prod { background: linear-gradient(180deg, #f6ffed 0%, #fff 100%); }
.es-icon { font-size: 24px; }
.es-name { font-size: 14px; font-weight: 600; margin-top: 4px; }
.es-prefix {
  font-size: 11px;
  color: var(--text-3);
  font-family: ui-monospace, Menlo, Consolas, monospace;
  margin-top: 2px;
}
.es-count { font-size: 11px; color: var(--text-2); margin-top: 6px; }
.es-count.primary { color: var(--primary); }
.es-count.warning { color: var(--warning); }
.es-count.success { color: var(--success); }
.env-arrow {
  align-self: center;
  color: var(--text-4);
  font-size: 20px;
  padding: 0 4px;
  flex-shrink: 0;
}
@media (max-width: 800px) {
  .env-pipeline { flex-direction: column; gap: 8px; }
  .env-stage + .env-stage { border-left: 1px solid var(--border); }
  .env-arrow { transform: rotate(90deg); padding: 0; }
}

.pub-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 960px) {
  .pub-grid { grid-template-columns: 1fr; }
}

.gate-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.gate-step:last-child { border-bottom: none; }
.gs-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  background: var(--bg-2);
  color: var(--text-3);
}
.gate-step.pass .gs-icon { background: var(--success); color: #fff; }
.gate-step.fail .gs-icon { background: var(--danger); color: #fff; }
.gate-step.wait .gs-icon { background: var(--bg-2); color: var(--text-3); }
.gate-step.run .gs-icon { background: var(--primary); color: #fff; }
.gs-name { font-weight: 600; color: var(--text-1); }
.gs-detail { font-size: 11px; color: var(--text-3); margin-top: 2px; }

.pkg {
  font-size: 11px;
  font-weight: 600;
}
.time {
  font-size: 11px;
  color: var(--text-3);
}

.pub-rollback {
  border-color: var(--primary);
}
.pub-rollback-body {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.9;
}
.pub-rollback-body b {
  color: var(--text-1);
}
.pub-rollback-body > div + div {
  margin-top: 6px;
}
</style>
