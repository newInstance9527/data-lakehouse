<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import { formatSql } from '@/utils/sqlFormat'
import {
  DEV_ENGINES,
  DEV_ENVS,
  DEV_KPIS,
  DEV_RELEASES,
  DEV_TREE,
  lintTagClass,
  releaseTagClass,
  statusTagClass,
  udfsForEngine,
} from '@/data/develop'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('develop')

const tree = ref(
  DEV_TREE.map((n) => ({
    ...n,
    open: n.type === 'folder' ? !!n.open : undefined,
    engine: n.type === 'file' ? n.engine || 'spark' : undefined,
  })),
)

const files = computed(() => tree.value.filter((n) => n.type === 'file'))
const activeId = ref(files.value.find((f) => f.name === 'gmv_by_channel_7d.sql')?.id || files.value[0]?.id || '')
const sqlText = ref('')
const env = ref('TEST')
const engine = ref('spark')
const dirty = ref(false)

const activeFile = computed(() => files.value.find((f) => f.id === activeId.value) || null)
const engineLabel = computed(
  () => DEV_ENGINES.find((e) => e.value === engine.value)?.label || engine.value,
)

const visibleUdfs = computed(() => udfsForEngine(engine.value))

watch(
  activeFile,
  (f) => {
    if (!f) return
    sqlText.value = f.sql || ''
    env.value = f.env || 'TEST'
    engine.value = f.engine || 'spark'
    dirty.value = false
  },
  { immediate: true },
)

const treeNodes = computed(() => {
  const nodes = tree.value
  const closed = new Set(nodes.filter((n) => n.type === 'folder' && !n.open).map((n) => n.id))
  return nodes.filter((n) => n.type === 'folder' || !closed.has(n.folder))
})

function toggleFolder(node) {
  if (node.type !== 'folder') return
  node.open = !node.open
}

function selectFile(node) {
  if (node.type !== 'file') return
  if (dirty.value && !window.confirm('当前脚本有未保存修改，切换将丢弃，继续？')) return
  activeId.value = node.id
}

function onSqlInput(e) {
  sqlText.value = e.target.value
  dirty.value = true
}

function onFormat() {
  sqlText.value = formatSql(sqlText.value)
  dirty.value = true
  showToast('✅ 已格式化 SQL', 'success')
}

function onSave() {
  const f = activeFile.value
  if (!f) return
  f.sql = sqlText.value
  f.env = env.value
  f.engine = engine.value
  f.editedAt = '刚刚'
  dirty.value = false
  showToast(`💾 已自动保存 ${f.name}`, 'success')
}

function onTrialRun() {
  const f = activeFile.value
  if (f) {
    f.env = env.value
    f.engine = engine.value
  }
  const runId = `run-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`
  showToast(
    `▶ 已在 ${env.value} · ${engineLabel.value} 提交试跑 ${f?.name || ''} · ${runId}`,
    'info',
  )
}

function onSubmitPublish() {
  const f = activeFile.value
  if (f) {
    f.env = env.value
    f.engine = engine.value
  }
  showToast(
    `🚀 已推到发布单：上版-${env.value}-${engine.value}-${f?.name || 'script'} ${f?.version || ''}`,
    'success',
  )
  router.push({
    path: '/publish',
    query: {
      script: f?.name || '',
      engine: engine.value,
      env: env.value,
    },
  })
}

function onNewScript() {
  const id = `script_${Date.now()}`
  const name = `untitled_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.sql`
  const folder = tree.value.find((n) => n.type === 'folder' && n.open) || tree.value.find((n) => n.type === 'folder')
  if (folder) folder.open = true
  const file = {
    id,
    type: 'file',
    folder: folder?.id || 'folder_trade',
    name,
    lang: 'SQL',
    status: 'DRAFT',
    badge: '',
    version: 'v1',
    author: '张明',
    editedAt: '刚刚',
    links: '—',
    env: 'TEST',
    engine: engine.value || 'spark',
    lint: [{ label: '新建脚本 · 待检查', tone: 'warn' }],
    sql: `-- ${name}\nSELECT 1;\n`,
  }
  const idx = tree.value.findIndex((n) => n.id === folder?.id)
  tree.value.splice(idx >= 0 ? idx + 1 : tree.value.length, 0, file)
  activeId.value = id
  showToast(`已新建脚本 ${name}`, 'success')
}

function insertUdf(u) {
  const snippet = u.snippet || u.name
  const el = document.getElementById('devSqlArea')
  if (el && typeof el.selectionStart === 'number') {
    const start = el.selectionStart
    const end = el.selectionEnd
    const v = sqlText.value || ''
    sqlText.value = `${v.slice(0, start)}${snippet}${v.slice(end)}`
    dirty.value = true
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + snippet.length
      el.selectionStart = el.selectionEnd = pos
    })
  } else {
    sqlText.value = `${sqlText.value || ''}${snippet}`
    dirty.value = true
  }
  showToast(`已插入 UDF：${u.name}`, 'success')
}

function showUdfDetail(u) {
  showToast(`🔧 ${u.name} · ${u.engine} · ${u.ver} · ${u.uses}`, 'info')
}

function onKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = e.target
    const start = el.selectionStart
    const end = el.selectionEnd
    const v = sqlText.value || ''
    sqlText.value = `${v.slice(0, start)}  ${v.slice(end)}`
    dirty.value = true
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2
    })
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    onSave()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    onTrialRun()
  }
}
</script>

<template>
  <div class="develop-page">
    <PageHeader
      title="数据开发 / SQL 工作台"
      subtitle="Spark / Flink 为主 · Trino 校验 · 任务打包 · 版本对比 · 审批上版"
      :guide-title="guide.title"
      :guide="guide"
    >
      <button class="btn btn-sm" @click="onSave">💾 自动保存</button>
      <button class="btn btn-sm" @click="onTrialRun">▶ 试跑({{ engineLabel }} · {{ env }})</button>
      <button class="btn btn-sm btn-primary" @click="onSubmitPublish">🚀 提交上版 →</button>
    </PageHeader>

    <div class="kpi-grid dev-kpi">
      <div v-for="(k, i) in DEV_KPIS" :key="i" class="kpi-card">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-delta" :class="{ success: k.tone === 'ok' }">{{ k.delta }}</div>
      </div>
    </div>

    <div class="dev-layout">
      <!-- 资源树 -->
      <aside class="card dev-tree-card">
        <div class="card-header">
          <div class="card-title">🗂️ 开发资源树</div>
          <span class="dev-ws">ws_trade</span>
        </div>
        <div class="dev-tree">
          <button
            v-for="n in treeNodes"
            :key="n.id"
            type="button"
            class="dev-tree-node"
            :class="{
              folder: n.type === 'folder',
              active: n.type === 'file' && n.id === activeId,
              file: n.type === 'file',
            }"
            @click="n.type === 'folder' ? toggleFolder(n) : selectFile(n)"
          >
            <template v-if="n.type === 'folder'">
              <span>{{ n.open ? '▼' : '▶' }}</span>
              <span>📁 {{ n.name }}</span>
            </template>
            <template v-else>
              <span class="dev-indent">📄 {{ n.name }}</span>
              <span v-if="n.badge" class="dt-badge">{{ n.badge }}</span>
            </template>
          </button>
        </div>
        <div class="dev-tree-foot">
          <button class="btn btn-sm" style="width: 100%" @click="onNewScript">＋ 新建 SQL 脚本</button>
        </div>
      </aside>

      <!-- 编辑器 -->
      <section class="card dev-editor-card">
        <div class="dev-editor-bar">
          <div class="dev-file-meta">
            <div class="dev-file-name">📄 {{ activeFile?.name || '未选择脚本' }}</div>
            <span v-if="activeFile" class="tag tag-gray">{{ activeFile.lang }}</span>
            <span v-if="activeFile" class="tag" :class="statusTagClass(activeFile.status)">
              {{ activeFile.status }}
            </span>
            <span v-if="dirty" class="tag tag-orange">未保存</span>
          </div>
          <div class="dev-editor-actions">
            <label class="dev-ctl">
              <span>引擎</span>
              <select v-model="engine" class="select input-sm" style="width: 148px" @change="dirty = true">
                <option v-for="e in DEV_ENGINES" :key="e.value" :value="e.value">{{ e.label }}</option>
              </select>
            </label>
            <label class="dev-ctl">
              <span>环境</span>
              <select v-model="env" class="select input-sm" style="width: 120px" @change="dirty = true">
                <option
                  v-for="e in DEV_ENVS"
                  :key="e.value"
                  :value="e.value"
                  :disabled="e.disabled"
                >
                  {{ e.label }}
                </option>
              </select>
            </label>
            <button class="btn btn-sm" @click="onFormat">⚙️ 格式化</button>
            <button class="btn btn-sm" @click="onSubmitPublish">🚀 提交上版</button>
          </div>
        </div>

        <textarea
          id="devSqlArea"
          class="dev-sql"
          spellcheck="false"
          :value="sqlText"
          @input="onSqlInput"
          @keydown="onKeydown"
        />

        <div class="dev-code-head">
          <span>🔗 关联资产：{{ activeFile?.links || '—' }} · 引擎 {{ engineLabel }}</span>
          <span>{{ activeFile?.version || '' }} · {{ activeFile?.author || '' }} · {{ activeFile?.editedAt || '' }}</span>
        </div>

        <div class="dev-lint">
          <div class="dev-lint-title">✅ 代码检查结果（DolphinScheduler Linter）</div>
          <div class="dev-lint-tags">
            <span
              v-for="(c, i) in activeFile?.lint || []"
              :key="i"
              class="tag"
              :class="lintTagClass(c.tone)"
            >{{ c.label }}</span>
            <span v-if="!activeFile?.lint?.length" class="muted">暂无检查项</span>
          </div>
        </div>
      </section>

      <!-- 右侧 UDF + 发布 -->
      <aside class="dev-side">
        <div class="card" style="margin-bottom: 14px">
          <div class="card-header">
            <div class="card-title">🧩 可用 UDF 一览</div>
            <span class="tag tag-gray">{{ engineLabel }}</span>
          </div>
          <div class="udf-grid">
            <button
              v-for="u in visibleUdfs"
              :key="u.name"
              type="button"
              class="udf-card"
              @click="insertUdf(u)"
              @dblclick="showUdfDetail(u)"
            >
              <div class="udf-name">{{ u.name }}</div>
              <div class="udf-desc">{{ u.desc }}</div>
              <div class="udf-meta">
                <span class="tag tag-blue">{{ u.engine }}</span>
                <span class="tag tag-gray">{{ u.ver }}</span>
              </div>
              <div class="udf-uses">↗ {{ u.uses }}</div>
            </button>
            <div v-if="!visibleUdfs.length" class="muted" style="padding: 12px; font-size: 12px">
              当前引擎暂无登记 UDF
            </div>
          </div>
        </div>

      
      </aside>
    </div>
  </div>
</template>

<style scoped>
.dev-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1100px) {
  .dev-kpi { grid-template-columns: repeat(2, 1fr); }
}
.kpi-delta {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-3);
}
.kpi-delta.success {
  color: var(--success);
}

.dev-layout {
  display: grid;
  grid-template-columns: 240px 1fr 320px;
  gap: 14px;
  align-items: start;
}
@media (max-width: 1280px) {
  .dev-layout {
    grid-template-columns: 220px 1fr;
  }
  .dev-side {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
}
@media (max-width: 900px) {
  .dev-layout { grid-template-columns: 1fr; }
  .dev-side { grid-template-columns: 1fr; }
}

.dev-tree-card {
  overflow: hidden;
}
.dev-ws {
  font-size: 11px;
  color: var(--text-3);
}
.dev-tree {
  padding: 6px 8px 10px;
  font-size: 12px;
  max-height: 420px;
  overflow: auto;
}
.dev-tree-node {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font: inherit;
  color: var(--text-2);
  cursor: pointer;
  text-align: left;
  line-height: 1.5;
}
.dev-tree-node.folder {
  font-weight: 600;
  color: var(--text-1);
}
.dev-tree-node.file:hover {
  background: var(--bg-2);
}
.dev-tree-node.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
}
.dev-indent {
  flex: 1;
  min-width: 0;
  padding-left: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dt-badge {
  margin-left: auto;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(245, 34, 45, 0.12);
  color: #cf1322;
  flex-shrink: 0;
}
.dev-tree-foot {
  padding: 10px;
  border-top: 1px dashed var(--border);
}

.dev-editor-card {
  overflow: hidden;
  min-width: 0;
}
.dev-editor-bar {
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.dev-file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.dev-file-name {
  font-weight: 600;
  font-size: 13px;
}
.dev-editor-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dev-ctl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-3);
  font-weight: 600;
}
.dev-sql {
  display: block;
  width: 100%;
  min-height: 300px;
  background: #0b1325;
  color: #c7d5ec;
  border: none;
  border-radius: 0;
  padding: 14px 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.7;
  resize: vertical;
  box-sizing: border-box;
  outline: none;
  tab-size: 2;
}
.dev-code-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 14px;
  background: var(--bg-2);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-3);
}
.dev-lint {
  padding: 10px 14px 14px;
  border-top: 1px dashed var(--border);
}
.dev-lint-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}
.dev-lint-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.muted {
  font-size: 12px;
  color: var(--text-3);
}

.udf-grid {
  padding: 10px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
  overflow: auto;
}
.udf-card {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.udf-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.udf-name {
  font-size: 12px;
  font-weight: 700;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  color: var(--text-1);
}
.udf-desc {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
  line-height: 1.4;
}
.udf-meta {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.udf-uses {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-4);
}

.dev-releases {
  padding: 10px 14px 14px;
  font-size: 12px;
}
.dev-rel {
  margin-bottom: 10px;
}
.dev-rel:last-child {
  margin-bottom: 0;
}
.dev-rel-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  line-height: 1.5;
}
.dev-rel-main .tag {
  margin-left: auto;
}
.dev-rel-sub {
  color: var(--text-3);
  font-size: 11px;
  margin-top: 2px;
}
</style>
