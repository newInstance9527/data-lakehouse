<script setup>
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import { formatSql } from '@/utils/sqlFormat'
import {
  QUERY_CATALOG,
  QUERY_HISTORY,
  QUERY_TABS_SEED,
  RESULT_COLUMNS,
  buildDemoResultRows,
} from '@/data/query'

const { showToast } = useToast()
const guide = pageGuideOf('query')

const catalog = reactive(structuredClone(QUERY_CATALOG))
const tabs = ref(QUERY_TABS_SEED.map((t) => ({ ...t })))
const activeTabId = ref(tabs.value[0]?.id || '')
const running = ref(false)
const showResult = ref(false)
const resultRows = ref([])
const activeTableId = ref('dwd_order_detail')
const history = ref([...QUERY_HISTORY])

const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) || null)
const sqlText = computed({
  get: () => activeTab.value?.sql || '',
  set: (v) => {
    if (activeTab.value) activeTab.value.sql = v
  },
})

function toggleNode(node) {
  if (node.locked) {
    showToast('🔒 未授权 Catalog：mysql_poste_prod', 'warning')
    return
  }
  if (node.type === 'catalog' || node.type === 'schema') {
    node.open = !node.open
  }
}

function insertTable(table) {
  if (!table?.fqn) return
  activeTableId.value = table.id
  const sample =
    table.sampleSql ||
    `SELECT *\nFROM ${table.fqn}\nWHERE dt >= date_sub(current_date, 7)\nLIMIT 100;`
  sqlText.value = sample
  showToast(`📋 已插入表：${table.fqn}`, 'success')
}

function selectTab(id) {
  activeTabId.value = id
}

function closeTab(id, e) {
  e?.stopPropagation()
  if (tabs.value.length <= 1) {
    showToast('至少保留一个查询页签', 'warning')
    return
  }
  const idx = tabs.value.findIndex((t) => t.id === id)
  tabs.value.splice(idx, 1)
  if (activeTabId.value === id) {
    activeTabId.value = tabs.value[Math.max(0, idx - 1)].id
  }
}

function addTab() {
  const id = `tab_${Date.now()}`
  const name = `unsaved_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.sql`
  tabs.value.push({
    id,
    name,
    closable: true,
    sql: '-- 新建查询\nSELECT 1;\n',
  })
  activeTabId.value = id
}

function onFormat() {
  sqlText.value = formatSql(sqlText.value)
  showToast('✅ SQL 已格式化', 'success')
}

function onExport() {
  showToast('📤 已导出 CSV（自动脱敏）：查询结果_脱敏.csv', 'success')
}

function onSaveDataset() {
  const name = `query_result_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  showToast(`💾 已保存为数据集：${name}`, 'success')
}

function onSaveSql() {
  const tab = activeTab.value
  if (!tab) return
  if (/^unsaved_/i.test(tab.name) || tab.name.startsWith('untitled')) {
    const suggested = `query_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.sql`
    const name = window.prompt('保存脚本名称', suggested)
    if (!name) return
    tab.name = name.endsWith('.sql') ? name : `${name}.sql`
  }
  tab.savedAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  showToast(`💾 已保存脚本 ${tab.name}`, 'success')
}

function detectScanBlock(sql) {
  const s = String(sql || '').toLowerCase()
  const hasFrom = /\bfrom\b/.test(s)
  const hasWhere = /\bwhere\b/.test(s)
  const hasLimit = /\blimit\b/.test(s)
  const hasPartition = /\bdt\b/.test(s) || /\bpartition\b/.test(s)
  if (hasFrom && !hasWhere && !hasLimit) return true
  if (hasFrom && !hasPartition && /ods_/.test(s) && !hasLimit) return true
  return false
}

function runQuery() {
  if (running.value) return
  const sql = sqlText.value
  if (detectScanBlock(sql)) {
    showToast('⚠ 查询治理：疑似无分区过滤 / 全表扫描，已阻断（演示）', 'warning')
    showResult.value = false
    history.value.unshift({
      id: `h_${Date.now()}`,
      time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-'),
      user: '我 (张明)',
      summary: summarize(sql),
      duration: '—',
      scan: '—',
      rows: '—',
      status: 'blocked',
      statusLabel: '⚠ 无分区过滤·阻断',
      tagClass: 'tag-red',
      sql,
    })
    return
  }

  const qid = `20260903_${String(Date.now()).slice(-6)}_00142`
  showToast(
    `Trino 接收 query_id=${qid} · Gravitino 鉴权通过 · 脱敏 & 行级策略生效`,
    'info',
  )
  running.value = true
  showResult.value = true
  resultRows.value = []

  setTimeout(() => {
    resultRows.value = buildDemoResultRows()
    running.value = false
    history.value.unshift({
      id: `h_${Date.now()}`,
      time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-'),
      user: '我 (张明)',
      summary: summarize(sql),
      duration: '2.48s',
      scan: '1.2GB',
      rows: String(resultRows.value.length),
      status: 'ok',
      statusLabel: '✓ · 脱敏 1列',
      tagClass: 'tag-green',
      sql,
    })
    if (history.value.length > 8) history.value.pop()
    showToast('✅ 查询完成！敏感列 buyer_mobile 已按策略动态脱敏。Scan 1.2GB 未超限额。', 'success')
  }, 450)
}

function summarize(sql) {
  const one = String(sql || '').replace(/\s+/g, ' ').trim()
  return one.length > 56 ? `${one.slice(0, 56)}…` : one
}

function loadHistory(h) {
  if (!h?.sql) return
  sqlText.value = h.sql
  showToast('📋 已加载历史 SQL 到编辑器', 'success')
}

function onKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = e.target
    const start = el.selectionStart
    const end = el.selectionEnd
    const v = sqlText.value || ''
    sqlText.value = `${v.slice(0, start)}  ${v.slice(end)}`
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2
    })
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    runQuery()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    onSaveSql()
  }
}
</script>

<template>
  <div class="query-page">
    <PageHeader
      title="即席 SQL 查询 · Trino"
      subtitle="经 Trino · Gravitino 鉴权 · 列级脱敏 · 行级过滤 · 扫描限额"
      :guide-title="guide.title"
      :guide="guide"
    >
      <button class="btn btn-sm" @click="onSaveSql">💾 保存脚本</button>
      <button class="btn btn-sm" @click="onExport">📤 导出 CSV（自动脱敏）</button>
      <button class="btn btn-sm" @click="onSaveDataset">💾 保存为数据集</button>
      <button class="btn btn-sm btn-primary" :disabled="running" @click="runQuery">
        ▶ 执行查询 (Ctrl+Enter)
      </button>
    </PageHeader>

    <div class="query-layout">
      <!-- Catalog 树 -->
      <aside class="card query-cat">
        <div class="card-header">
          <div class="card-title">🗂️ 目录</div>
        </div>
        <div class="cat-body">
          <template v-for="cat in catalog" :key="cat.id">
            <button
              type="button"
              class="cat-node catalog"
              :class="{ locked: cat.locked }"
              @click="toggleNode(cat)"
            >
              <span v-if="cat.locked">🔒</span>
              <span v-else>{{ cat.open ? '▼' : '▶' }}</span>
              {{ cat.name }}
            </button>
            <template v-if="cat.open && !cat.locked">
              <template v-for="sch in cat.children" :key="sch.id">
                <button type="button" class="cat-node schema" @click="toggleNode(sch)">
                  {{ sch.open ? '▼' : '▶' }} {{ sch.name }}
                </button>
                <template v-if="sch.open">
                  <button
                    v-for="tb in sch.children"
                    :key="tb.id"
                    type="button"
                    class="cat-node table"
                    :class="{ active: tb.id === activeTableId }"
                    @click="insertTable(tb)"
                  >
                    <span>📋 {{ tb.name }}<template v-if="tb.star"> ⭐</template></span>
                    <span v-if="tb.rows" class="cat-rows">{{ tb.rows }}</span>
                  </button>
                </template>
              </template>
            </template>
          </template>
        </div>
      </aside>

      <!-- 编辑器 + 结果 + 历史 -->
      <div class="query-main">
        <div class="sql-wrap">
          <div class="sql-toolbar">
            <div class="sql-tabs">
              <button
                v-for="t in tabs"
                :key="t.id"
                type="button"
                class="sql-tab"
                :class="{ active: t.id === activeTabId }"
                @click="selectTab(t.id)"
              >
                {{ t.name }}
                <span
                  v-if="t.closable"
                  class="sql-tab-x"
                  @click="closeTab(t.id, $event)"
                >✕</span>
              </button>
              <button type="button" class="sql-tab add" @click="addTab">+</button>
            </div>
          </div>

          <textarea
            class="sql-area"
            spellcheck="false"
            :value="sqlText"
            @input="sqlText = $event.target.value"
            @keydown="onKeydown"
          />

          <div class="sql-status">
            <div>✅ Gravitino 鉴权预检查通过：表可见 · 列可见 · 行级策略 tenant_id = 当前用户租户（自动注入）</div>
            <div class="sql-status-acts">
              <button type="button" class="btn btn-sm sql-dark-btn" @click="onSaveSql">💾 保存</button>
              <button type="button" class="btn btn-sm sql-dark-btn" @click="onFormat">⚙ 格式化</button>
              <button type="button" class="btn btn-sm btn-primary" :disabled="running" @click="runQuery">
                ▶ 执行 (Ctrl⏎)
              </button>
            </div>
          </div>
        </div>

        <div v-if="showResult" class="result-wrap">
          <div class="result-stat">
            <div class="result-stat-left">
              <span>状态：<b class="ok">{{ running ? '执行中…' : '✓ 完成' }}</b></span>
              <span>返回行：<b>{{ resultRows.length || '—' }} 行</b></span>
              <span>耗时：<b>{{ running ? '…' : '2.48 s' }}</b></span>
              <span>
                Scan：<b>1.2 GB</b> · 3,482 万行（
                <b class="ok">符合限额 ≤ 50GB</b>）
              </span>
              <span>Trino Worker：<b>× 6</b></span>
            </div>
            <div class="result-stat-right">
              <span class="tag tag-orange">🔒 已脱敏 1 列</span>
              <span class="tag tag-blue">🎯 行级过滤生效</span>
              <button class="btn btn-sm" @click="onExport">📤 导出 CSV（脱敏集）</button>
            </div>
          </div>
          <div class="result-table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th v-for="c in RESULT_COLUMNS" :key="c.key">
                    {{ c.label }}
                    <span v-if="c.masked" class="tag tag-orange" style="font-size: 10px; margin-left: 4px">🔒脱敏</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in resultRows" :key="i" class="blink-row">
                  <td class="mono">{{ r.dt }}</td>
                  <td><span class="tag" :class="r.channelTag">{{ r.order_channel }}</span></td>
                  <td class="mono num">{{ r.order_cnt }}</td>
                  <td class="mono num success">{{ r.gmv }}</td>
                  <td class="masked">{{ r.buyer_mobile }}</td>
                </tr>
                <tr v-if="running">
                  <td colspan="5" class="empty">查询执行中…</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <section class="card">
          <div class="card-header">
            <div class="card-title">📜 近 {{ Math.min(history.length, 8) }} 条查询历史（我的 + 审计可见）</div>
          </div>
          <div class="card-body" style="padding: 0; overflow: auto">
            <table class="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>用户</th>
                  <th>SQL 摘要</th>
                  <th>耗时</th>
                  <th>Scan</th>
                  <th>行数</th>
                  <th>状态/脱敏</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="h in history"
                  :key="h.id"
                  class="hist-row"
                  @click="loadHistory(h)"
                >
                  <td>{{ h.time }}</td>
                  <td>{{ h.user }}</td>
                  <td><code>{{ h.summary }}</code></td>
                  <td>{{ h.duration }}</td>
                  <td :class="{ danger: h.scanDanger }">{{ h.scan }}</td>
                  <td>{{ h.rows }}</td>
                  <td><span class="tag" :class="h.tagClass">{{ h.statusLabel }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.query-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 960px) {
  .query-layout { grid-template-columns: 1fr; }
}

.query-cat {
  position: sticky;
  top: 0;
  align-self: start;
  max-height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cat-body {
  padding: 8px 4px 12px;
  font-size: 12px;
  overflow: auto;
  flex: 1;
}
.cat-node {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border: none;
  background: transparent;
  font: inherit;
  color: var(--text-2);
  cursor: pointer;
  text-align: left;
  border-radius: 4px;
  padding: 3px 8px;
  line-height: 1.6;
}
.cat-node.catalog {
  font-weight: 600;
  margin-top: 4px;
}
.cat-node.catalog.locked {
  color: var(--text-4);
  cursor: not-allowed;
}
.cat-node.schema {
  padding-left: 18px;
}
.cat-node.table {
  padding-left: 32px;
}
.cat-node.table:hover {
  background: var(--bg-2);
}
.cat-node.table.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 500;
}
.cat-rows {
  color: var(--text-4);
  font-size: 11px;
  flex-shrink: 0;
}

.query-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.sql-wrap {
  background: #0f1a2e;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid #1a2744;
}
.sql-toolbar {
  padding: 10px 14px;
  background: #162240;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.sql-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.sql-tab {
  padding: 5px 12px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #98a5be;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
}
.sql-tab.active {
  background: var(--primary);
  color: #fff;
}
.sql-tab.add {
  opacity: 0.6;
}
.sql-tab-x {
  opacity: 0.7;
  font-size: 11px;
}
.sql-tab-x:hover {
  opacity: 1;
}
.sql-meta {
  font-size: 11px;
  color: #6b7a99;
}
.sql-area {
  display: block;
  width: 100%;
  min-height: 200px;
  padding: 14px 18px;
  background: #0f1a2e;
  color: #e6ebf5;
  border: none;
  outline: none;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  tab-size: 2;
  box-sizing: border-box;
}
.sql-status {
  padding: 10px 18px;
  background: #162240;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #6b7a99;
}
.sql-status-acts {
  display: flex;
  gap: 8px;
}
.sql-dark-btn {
  background: #203050 !important;
  border-color: #2e4475 !important;
  color: #cfd6e4 !important;
}

.result-wrap {
  background: var(--bg-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  overflow: hidden;
}
.result-stat {
  padding: 10px 16px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
}
.result-stat-left {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  color: var(--text-2);
}
.result-stat-left b {
  color: var(--text-1);
  font-weight: 600;
}
.result-stat-left .ok,
.ok {
  color: var(--success) !important;
}
.result-stat-right {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 11px;
}
.result-table-wrap {
  overflow: auto;
  max-height: 360px;
}
.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
}
.num {
  text-align: right;
  font-weight: 600;
}
.num.success {
  color: var(--success);
  font-weight: 700;
}
.masked {
  background: repeating-linear-gradient(
    45deg,
    var(--warning-light),
    var(--warning-light) 4px,
    #fff0d6 4px,
    #fff0d6 8px
  );
  color: var(--warning);
  font-family: monospace;
  letter-spacing: 1px;
  font-weight: 500;
}
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 20px !important;
}
.hist-row {
  cursor: pointer;
}
.hist-row:hover {
  background: var(--bg-2);
}
.danger {
  color: var(--danger);
  font-weight: 600;
}

@keyframes blink-in {
  from { background: rgba(30, 111, 255, 0.12); }
  to { background: transparent; }
}
.blink-row {
  animation: blink-in 0.6s ease;
}
</style>
