<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useWsListScope } from '@/composables/useWsListScope'
import { useActionLock } from '@/composables/useActionLock'
import { pageGuideOf } from '@/data/pageGuides'
import DevelopSqlEditor from '@/components/develop/DevelopSqlEditor.vue'
import { resolveEngineDialect } from '@/utils/engineSqlDialect'
import { formatEngineSql } from '@/utils/sqlFormat'
import {
  commitScript,
  createRelease,
  createScript,
  fetchReleasePrecheck,
  fetchScriptContent,
  fetchScriptKpis,
  fetchScriptRuns,
  fetchScriptRun,
  fetchScriptTree,
  fetchUdfs,
  runScript,
} from '@/api/compute'
import { DEV_ENGINES, DEV_ENVS, lintTagClass, statusTagClass } from '@/data/develop'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { currentWs, showAll, listWsParams, watchListScope } = useWsListScope()
const { busy, run: runLocked } = useActionLock()
const guide = pageGuideOf('develop')

const trialing = computed(() => busy('trial'))
const saving = computed(() => busy('save'))
const submitting = computed(() => busy('submit'))
const creating = computed(() => busy('create'))
const tree = ref([])
const kpis = ref([])
const udfs = ref([])
const runs = ref([])
const trialResult = ref(null)
const resultTab = ref('table')
const wsLabel = ref('default')
const loadError = ref('')
const activeId = ref('')
const sqlText = ref('')
const env = ref('TEST')
const engine = ref('spark')
const dirty = ref(false)

const files = computed(() => tree.value.filter((n) => n.type === 'file'))
const activeFile = computed(() => files.value.find((f) => f.id === activeId.value) || null)
const engineLabel = computed(
  () => DEV_ENGINES.find((e) => e.value === engine.value)?.label || engine.value,
)

const treeNodes = computed(() => {
  const nodes = tree.value
  const closed = new Set(nodes.filter((n) => n.type === 'folder' && !n.open).map((n) => n.id))
  return nodes.filter((n) => n.type === 'folder' || !closed.has(n.folder))
})

function applyLoaded(file) {
  if (!file) return
  const idx = tree.value.findIndex((n) => n.id === file.id)
  if (idx >= 0) tree.value[idx] = { ...tree.value[idx], ...file, type: 'file' }
  sqlText.value = file.sql || ''
  env.value = file.env || 'TEST'
  engine.value = file.engine || 'spark'
  dirty.value = false
}

async function loadRuns(id) {
  if (!id) {
    runs.value = []
    return
  }
  try {
    runs.value = (await fetchScriptRuns(id)) || []
  } catch {
    runs.value = []
  }
}

async function loadUdfs() {
  try {
    udfs.value = (await fetchUdfs(engine.value)) || []
  } catch {
    udfs.value = []
  }
}

async function loadBoard() {
  const params = listWsParams()
  const wsForLabel = params.ws || '全部'
  wsLabel.value = wsForLabel
  try {
    const [treeResp, kpiResp] = await Promise.all([
      fetchScriptTree(params.ws),
      fetchScriptKpis(params.ws),
    ])
    tree.value = (treeResp?.nodes || []).map((n) => ({
      ...n,
      open: n.type === 'folder' ? n.open !== false : undefined,
    }))
    kpis.value = kpiResp || []
    wsLabel.value = treeResp?.ws || wsForLabel
    loadError.value = ''
    if (!files.value.some((f) => f.id === activeId.value)) {
      activeId.value = files.value[0]?.id || ''
    }
    if (activeId.value) {
      applyLoaded(await fetchScriptContent(activeId.value))
      await loadRuns(activeId.value)
    }
    await loadUdfs()
  } catch (e) {
    loadError.value = e?.message || '开发脚本接口不可用'
    showToast(loadError.value, 'warning')
  }
}

function toggleFolder(node) {
  if (node.type !== 'folder') return
  node.open = !node.open
}

async function selectFile(node) {
  if (node.type !== 'file') return
  if (dirty.value && !window.confirm('当前脚本有未保存修改，切换将丢弃，继续？')) return
  activeId.value = node.id
  try {
    applyLoaded(await fetchScriptContent(node.id))
    await loadRuns(node.id)
  } catch (e) {
    showToast(e?.message || '读取脚本失败', 'warning')
  }
}

function onSqlInput(value) {
  sqlText.value = typeof value === 'string' ? value : value?.target?.value || ''
  dirty.value = true
}

function onFormat() {
  sqlText.value = formatEngineSql(sqlText.value, resolveEngineDialect(engine.value))
  dirty.value = true
  showToast(`已按 ${engineLabel.value} 格式化`, 'success')
}

async function onSave() {
  const f = activeFile.value
  if (!f) return false
  const ok = await runLocked('save', async () => {
    try {
      const saved = await commitScript({
        id: f.id,
        ws: currentWs.value,
        sql: sqlText.value,
        engine: engine.value,
        env: env.value,
      })
      applyLoaded(saved)
      if (saved.remoteWarning) showToast(saved.remoteWarning, 'warning')
      showToast(`已提交 Git ${saved.version || ''} ${f.name}`, 'success')
      kpis.value = (await fetchScriptKpis(currentWs.value)) || kpis.value
      return true
    } catch (e) {
      showToast(e?.message || '保存失败', 'warning')
      return false
    }
  })
  return ok === true
}

async function onTrialRun() {
  const f = activeFile.value
  if (!f) return
  await runLocked('trial', async () => {
    try {
      const run = await runScript({
        id: f.id,
        ws: currentWs.value,
        sql: sqlText.value,
        engine: engine.value,
        env: env.value,
      })
      dirty.value = false
      applyLoaded(await fetchScriptContent(f.id))
      await loadRuns(f.id)
      showRunResult(run)
      showToast(run.message || `试跑 ${run.runId}`, run.status === 'failed' ? 'warning' : 'info')
    } catch (e) {
      showToast(e?.message || '试跑失败', 'warning')
    }
  })
}

async function onSubmitPublish() {
  const f = activeFile.value
  if (!f) return
  await runLocked('submit', async () => {
    try {
      if (dirty.value) {
        const ok = await onSave()
        if (!ok) return
      }
      const pre = await fetchReleasePrecheck({
        scriptId: f.id,
        engine: engine.value,
        env: env.value,
      })
      if (!pre?.ok) {
        const hint = pre?.hint || '门禁未通过，请先处理失败项后再提交上版'
        showToast(hint, 'warning')
        const trialBlocked = (pre?.blocked || []).some((g) => String(g?.name || '').includes('试跑'))
        if (trialBlocked) {
          resultTab.value = 'log'
        }
        return
      }
      const rel = await createRelease({
        scriptId: f.id,
        ws: currentWs.value,
        engine: engine.value,
        env: env.value,
      })
      showToast(
        rel.reused
          ? rel.hint || `已复用进行中的发布单 ${rel.pkg}`
          : `已生成发布单 ${rel.pkg} · ${rel.result || '门禁中'}`,
        rel.reused ? 'info' : 'success',
      )
      router.push({ path: '/publish', query: { id: rel.id } })
    } catch (e) {
      showToast(e?.message || '提交上版失败', 'warning')
    }
  })
}

async function onNewScript() {
  const folderNode = tree.value.find((n) => n.type === 'folder' && n.open) || tree.value.find((n) => n.type === 'folder')
  const name = `untitled_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.sql`
  await runLocked('create', async () => {
    try {
      const created = await createScript({
        ws: currentWs.value,
        folder: folderNode?.name || 'default',
        name,
        engine: engine.value,
        env: 'TEST',
        sql: `-- ${name}\nSELECT 1;\n`,
      })
      await loadBoard()
      activeId.value = created.id
      applyLoaded(created)
      showToast(`已新建脚本 ${created.name}`, 'success')
    } catch (e) {
      showToast(e?.message || '新建失败', 'warning')
    }
  })
}

function showRunResult(run) {
  trialResult.value = run || null
  const cols = run?.columns || []
  resultTab.value = cols.length ? 'table' : 'log'
}

async function openRun(run) {
  if (!run?.runId) return
  try {
    const detail = await fetchScriptRun(run.runId)
    showRunResult(detail)
    const idx = runs.value.findIndex((item) => item.runId === detail.runId)
    if (idx >= 0) {
      runs.value[idx] = { ...runs.value[idx], ...detail, columns: undefined, rows: undefined, log: undefined }
    }
  } catch (e) {
    showToast(e?.message || '读取试跑结果失败', 'warning')
  }
}

function cellText(row, key) {
  const value = row?.[key]
  if (value == null || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function onOpenQueryValidate() {
  const sql = String(sqlText.value || '').trim()
  if (!sql) {
    showToast('当前无 SQL 可送即席校验', 'warning')
    return
  }
  router.push({
    path: '/query',
    query: {
      sql,
      name: activeFile.value?.name || '',
    },
  })
}

function scriptFileName(raw) {
  const base = String(raw || '').trim().replace(/\\/g, '/').split('/').pop() || ''
  const withExt = /\.sql$/i.test(base) ? base : base ? `${base}.sql` : ''
  if (/^[A-Za-z0-9][A-Za-z0-9_.-]*\.sql$/i.test(withExt)) return withExt
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  return `from_query_${stamp}.sql`
}

async function importSqlDraft(sql, suggestedName) {
  const text = String(sql || '').trim()
  if (!text) return
  const name = scriptFileName(suggestedName)
  try {
    const created = await createScript({
      ws: currentWs.value,
      folder: 'default',
      name,
      engine: engine.value,
      env: 'TEST',
      sql: text,
    })
    await loadBoard()
    activeId.value = created.id
    applyLoaded({ ...created, sql: text })
    dirty.value = false
    showToast(`已从即席导入 ${created.name}`, 'success')
  } catch (e) {
    showToast(e?.message || '导入失败', 'warning')
  }
}

function applyImportDeepLink() {
  const q = route.query || {}
  const sql = typeof q.importSql === 'string' ? q.importSql : typeof q.sql === 'string' ? q.sql : ''
  if (!sql) return
  importSqlDraft(sql, typeof q.name === 'string' ? q.name : '')
}

const sqlEditorRef = ref(null)

function insertUdf(u) {
  const snippet = u.snippet || u.name
  sqlEditorRef.value?.insertText(snippet)
  dirty.value = true
  showToast(`已插入 UDF：${u.name}`, 'success')
}

function showUdfDetail(u) {
  showToast(`${u.name} · ${u.engine} · ${u.ver} · ${u.uses}`, 'info')
}

watch(engine, () => loadUdfs())
watch(activeId, () => {
  trialResult.value = null
})
watchListScope(() => loadBoard())
watch(
  () => `${route.query.importSql || ''}|${route.query.sql || ''}`,
  () => applyImportDeepLink(),
)
onMounted(async () => {
  await loadBoard()
  applyImportDeepLink()
})
</script>

<template>
  <div class="develop-page">
    <PageHeader
      title="数据开发 / SQL 工作台"
      subtitle="Spark / Flink 为主 · Trino 校验 · 任务打包 · 版本对比 · 审批上版"
      :guide-title="guide.title"
      :guide="guide"
    >
      <label class="ws-mine-chk" title="默认跟随顶栏当前空间；勾选后查看全部归属">
        <input v-model="showAll" type="checkbox" />
        查看全部
      </label>
      <button class="btn btn-sm" :disabled="saving || !activeFile" @click="onSave">
        {{ saving ? '保存中…' : '💾 自动保存' }}
      </button>
      <button class="btn btn-sm" :disabled="!sqlText.trim()" @click="onOpenQueryValidate">🔍 打开即席校验</button>
      <button class="btn btn-sm" :disabled="trialing || !activeFile" @click="onTrialRun">
        {{ trialing ? '试跑中…' : `▶ 试跑(${engineLabel} · ${env})` }}
      </button>
      <button class="btn btn-sm btn-primary" :disabled="submitting || !activeFile" @click="onSubmitPublish">
        {{ submitting ? '提交中…' : '🚀 提交上版 →' }}
      </button>
    </PageHeader>

    <div v-if="loadError" class="banner-soft">{{ loadError }}</div>

    <div class="kpi-grid dev-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card">
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
          <span class="dev-ws">{{ wsLabel }}</span>
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
          <button class="btn btn-sm" style="width: 100%" :disabled="creating" @click="onNewScript">
            {{ creating ? '创建中…' : '＋ 新建 SQL 脚本' }}
          </button>
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
          </div>
        </div>

        <DevelopSqlEditor
          ref="sqlEditorRef"
          :model-value="sqlText"
          :engine="engine"
          :udfs="udfs"
          @update:model-value="onSqlInput"
          @save="onSave"
          @run="onTrialRun"
          @format="onFormat"
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

        <div class="dev-result">
          <div class="dev-result-bar">
            <span class="dev-result-title">试跑结果</span>
            <template v-if="trialResult">
              <span class="tag" :class="trialResult.status === 'failed' ? 'tag-red' : trialResult.status === 'ok' ? 'tag-green' : 'tag-blue'">
                {{ trialResult.status }}
              </span>
              <span class="muted">{{ trialResult.engine }} · {{ trialResult.env }}</span>
              <span v-if="trialResult.rowCount != null" class="muted">{{ trialResult.rowCount }} 行</span>
              <span v-if="trialResult.durMs != null" class="muted">{{ trialResult.durMs }} ms</span>
              <span v-if="trialResult.truncated" class="tag tag-orange">已截断</span>
            </template>
            <span class="dev-result-tabs">
              <button type="button" class="btn btn-sm" :class="{ 'btn-primary': resultTab === 'table' }" @click="resultTab = 'table'">结果表</button>
              <button type="button" class="btn btn-sm" :class="{ 'btn-primary': resultTab === 'log' }" @click="resultTab = 'log'">日志</button>
              <button
                v-if="trialResult && (trialResult.status === 'running' || trialResult.status === 'submitted')"
                type="button"
                class="btn btn-sm"
                @click="openRun(trialResult)"
              >刷新</button>
            </span>
          </div>
          <div v-if="!trialResult" class="dev-result-empty">试跑后在这里看结果表。Spark / Flink 的结果表是 Trino 抽样，调度日志在「日志」。</div>
          <template v-else>
            <div v-if="trialResult.previewNote" class="dev-result-note">{{ trialResult.previewNote }}</div>
            <div v-if="trialResult.message && trialResult.status === 'failed'" class="dev-result-note is-fail">{{ trialResult.message }}</div>
            <div v-if="resultTab === 'table'" class="dev-result-table-wrap">
              <table v-if="(trialResult.columns || []).length" class="dev-result-table">
                <thead>
                  <tr>
                    <th v-for="col in trialResult.columns" :key="col">{{ col }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in trialResult.rows || []" :key="i">
                    <td v-for="col in trialResult.columns" :key="col">{{ cellText(row, col) }}</td>
                  </tr>
                  <tr v-if="!(trialResult.rows || []).length">
                    <td :colspan="trialResult.columns.length" class="muted">查询完成，没有返回行</td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="dev-result-empty">{{ trialResult.message || '这次试跑没有结果表' }}</div>
            </div>
            <pre v-else class="dev-result-log">{{ trialResult.log || trialResult.message || '暂无日志' }}</pre>
          </template>
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
              v-for="u in udfs"
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
            <div v-if="!udfs.length" class="muted" style="padding: 12px; font-size: 12px">
              当前引擎暂无登记 UDF
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">最近试跑</div>
          </div>
          <div class="card-body" style="padding: 0">
            <div v-if="!runs.length" class="muted" style="padding: 12px; font-size: 12px">还没有试跑记录</div>
            <button
              v-for="r in runs"
              :key="r.id"
              type="button"
              :class="{
                'dev-run': true,
                active: trialResult && trialResult.runId === r.runId,
              }"
              @click="openRun(r)"
            >
              <span class="tag" :class="r.status === 'failed' ? 'tag-red' : r.status === 'ok' ? 'tag-green' : 'tag-blue'">{{ r.status }}</span>
              <span>{{ r.env }} · {{ r.engine }}</span>
              <span class="muted">{{ r.gitSha }}</span>
            </button>
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
.dev-run {
  width: 100%;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dev-run.active {
  background: var(--primary-light, #e6f4ff);
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
.dev-editor-card :deep(.dev-sql-editor) {
  border-top: 1px solid var(--border);
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
.dev-result {
  border-top: 1px solid var(--border);
  background: var(--bg-1, #fff);
}
.dev-result-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 14px;
}
.dev-result-title {
  font-size: 12px;
  font-weight: 600;
}
.dev-result-tabs {
  margin-left: auto;
  display: inline-flex;
  gap: 6px;
}
.dev-result-note {
  margin: 0 14px 8px;
  font-size: 12px;
  color: var(--text-3);
}
.dev-result-note.is-fail {
  color: var(--danger, #c2410c);
}
.dev-result-empty {
  padding: 12px 14px 16px;
  font-size: 12px;
  color: var(--text-3);
}
.dev-result-table-wrap {
  max-height: 280px;
  overflow: auto;
  border-top: 1px solid var(--border);
}
.dev-result-table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.dev-result-table th,
.dev-result-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dev-result-table th {
  position: sticky;
  top: 0;
  background: var(--bg-2, #f6f7f9);
  font-weight: 600;
}
.dev-result-log {
  margin: 0;
  padding: 10px 14px 14px;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  background: #0b1325;
  color: #c7d5ec;
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
