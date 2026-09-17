<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { usePublish } from '@/composables/usePublish'
import { pageGuideOf } from '@/data/pageGuides'
import {
  PUBLISH_ENV_STAGES,
  PUBLISH_KPIS,
  PUBLISH_LOG_SNIPPETS,
  gateIcon,
  historyResultMeta,
} from '@/data/publish'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('publish')
const { items, gateList, focus, addRelease } = usePublish()

const creating = ref(false)
const form = ref({ name: '', script: '', engine: 'spark', env: 'stg' })

function openCreate() {
  creating.value = true
  form.value = { name: '', script: '', engine: 'spark', env: 'stg' }
}

function submitCreate() {
  const name = form.value.name.trim()
  if (!name) {
    showToast('请填写发布包名称', 'warning')
    return
  }
  const row = addRelease({ ...form.value, name })
  creating.value = false
  showToast(`已创建发布 ${row.pkg} → ${row.env}`, 'success')
}

function showHistoryModal() {
  const lines = PUBLISH_LOG_SNIPPETS.map((s) => `• ${s}`).join('\n')
  showToast(`📜 近期发布：\n${lines}`, 'info')
}

function goDevelop() {
  router.push('/develop')
}

function ingestFromDevelop() {
  const q = route.query || {}
  if (!q.script && !q.from) return
  const script = String(q.script || q.from || '')
  const engine = String(q.engine || 'spark')
  const env = String(q.env || 'stg').toLowerCase()
  const name = `v23-${script.replace(/\.sql$/i, '') || 'script'}`
  const exists = items.value.find((r) => r.pkg.includes(script.replace(/\.sql$/i, '')) && r.result === '门禁中')
  if (exists) return
  addRelease({
    name,
    script: script || 'untitled.sql',
    engine,
    env: env === 'prod' ? 'stg' : env,
  })
  showToast(`已从数据开发接入发布单 ${name}`, 'success')
}

watch(
  () => `${route.query.script || ''}|${route.query.engine || ''}|${route.query.env || ''}`,
  () => {
    if (!route.query.script && !route.query.from) return
    ingestFromDevelop()
  },
  { immediate: true },
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
      <button class="btn btn-sm" @click="openCreate">＋ 新建发布</button>
      <button class="btn btn-sm" @click="showHistoryModal">📜 发布记录</button>
      <button class="btn btn-sm btn-primary" @click="goDevelop">🔗 数据开发</button>
    </PageHeader>

    <div class="kpi-grid pub-kpi">
      <div v-for="(k, i) in PUBLISH_KPIS" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend up">{{ k.trend }}</div>
      </div>
    </div>

    <div v-if="creating" class="card" style="margin-bottom: 16px">
      <div class="card-header">
        <div class="card-title">新建发布</div>
        <button class="btn btn-sm" @click="creating = false">取消</button>
      </div>
      <div class="card-body pub-form">
        <label>
          <span>发布包</span>
          <input v-model="form.name" class="input" placeholder="例如 v24-dwd-order-clean" />
        </label>
        <label>
          <span>脚本</span>
          <input v-model="form.script" class="input" placeholder="dwd_order_detail_clean.sql" />
        </label>
        <label>
          <span>引擎</span>
          <select v-model="form.engine" class="select">
            <option value="spark">Spark SQL</option>
            <option value="flink">Flink SQL</option>
            <option value="trino">Trino（校验）</option>
          </select>
        </label>
        <label>
          <span>目标环境</span>
          <select v-model="form.env" class="select">
            <option value="dev">dev</option>
            <option value="stg">stg</option>
            <option disabled value="prod">prod（须门禁通过）</option>
          </select>
        </label>
        <button class="btn btn-sm btn-primary" @click="submitCreate">创建</button>
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
          <span class="tag tag-orange">门禁检查中</span>
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
              <tr v-for="(h, i) in items" :key="i">
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
