<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import CreateFormModal from '@/components/common/CreateFormModal.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { usePager } from '@/composables/usePager'
import { SCHEMA_REG_FORM } from '@/data/createForms'
import { pageGuideOf } from '@/data/pageGuides'
import {
  CONTRACT_APPROVAL_TICKETS,
  CONTRACT_CDC_FLOW,
  CONTRACT_CDC_SEMANTICS,
  CONTRACT_COMPAT_CHECK,
  CONTRACT_KPIS,
  CONTRACT_SCHEMAS,
  CONTRACT_VERSIONS,
  ICEBERG_EVOLUTION_RULES,
  contractCompatClass,
  contractSchemaStatusMeta,
  icebergAllowMeta,
} from '@/data/contract'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('contract')

const createOpen = ref(false)
const schemas = ref(CONTRACT_SCHEMAS.map((s) => ({ ...s })))
const { page, pageSize, total, totalPages, paged, pageNums, goPage, resetPage } = usePager(schemas)

function registerSchema() {
  createOpen.value = true
}

function onRegisterSchema(payload) {
  const fieldCount = String(payload.fields)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length
  schemas.value.unshift({
    name: payload.topic,
    type: payload.topic.startsWith('topic') || payload.topic.includes('cdc.') ? 'Avro' : 'Iceberg',
    version: 'v1',
    compat: payload.compat,
    fields: fieldCount || 1,
    change: '新注册 · 刚刚',
    status: 'ok',
  })
  resetPage()
  showToast(`✅ Schema 已注册：${payload.topic} · ${payload.compat}`, 'success')
}

function openChangeTicket() {
  showToast('📋 变更单 CHG-2026-008 · s_order 删列 pay_amt 阻断中', 'warning')
}

function goLineage() {
  router.push('/lineage')
}

function goCatalog(name) {
  router.push({ path: '/catalog', query: { q: name } })
}

function notifyDownstream() {
  showToast('📢 已通知 3 个作业 owner 评审变更单 CHG-2026-008', 'success')
}

function newChangeTicket() {
  showToast('＋ 发起 Schema 变更单（演示）', 'info')
}

function newCdcConfig() {
  showToast('＋ 新建 CDC 入湖语义配置（演示）', 'info')
}
</script>

<template>
  <div class="ctr-page">
    <PageHeader
      title="数据契约"
      subtitle="Schema Registry · 兼容性 · CDC · Iceberg 演进"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="registerSchema">＋ 注册 Schema</button>
      <button type="button" class="btn btn-sm" @click="openChangeTicket">📋 变更单</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goLineage">🔗 血缘影响</button>
    </PageHeader>

    <CreateFormModal
      :open="createOpen"
      v-bind="SCHEMA_REG_FORM"
      @close="createOpen = false"
      @submit="onRegisterSchema"
    />

    <div class="kpi-grid ctr-kpi">
      <div v-for="(k, i) in CONTRACT_KPIS" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="k.trendUp ? 'up' : 'down'">{{ k.trend }}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 Schema Registry <span class="tip">· Topic/表 schema 注册 · Avro/JSON · 版本化</span></div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>Schema</th>
              <th>类型</th>
              <th>当前版本</th>
              <th>兼容性</th>
              <th>字段数</th>
              <th>最近变更</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!paged.length">
              <td colspan="7" style="text-align: center; color: var(--text-3); padding: 24px">暂无 Schema</td>
            </tr>
            <tr v-for="(s, si) in paged" :key="`${s.name}-${si}`">
              <td>
                <button type="button" class="btn-link" @click="goCatalog(s.name)">
                  <code>{{ s.name }}</code>
                </button>
              </td>
              <td><span class="tag tag-blue" style="font-size: 10px">{{ s.type }}</span></td>
              <td><b>{{ s.version }}</b></td>
              <td>
                <span class="compat-badge" :class="contractCompatClass(s.compat)">{{ s.compat }}</span>
              </td>
              <td style="text-align: center">{{ s.fields }}</td>
              <td style="font-size: 11px; color: var(--text-3)">{{ s.change }}</td>
              <td>
                <span class="tag" :class="contractSchemaStatusMeta(s.status).tag" style="font-size: 10px">
                  {{ contractSchemaStatusMeta(s.status).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
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

    <div class="grid grid-2 ctr-grid-top">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔄 Schema 版本演进 · <code>ods_trade.s_order</code></div>
          <span class="tag tag-red">破坏性变更阻断中</span>
        </div>
        <div class="card-body ctr-versions">
          <div
            v-for="v in CONTRACT_VERSIONS"
            :key="v.ver"
            class="schema-version-card"
            :class="{ fail: v.status === 'fail' }"
          >
            <div class="svc-head">
              <span class="svc-version">{{ v.ver }}</span>
              <span class="svc-date">{{ v.date }}</span>
              <span v-if="v.status === 'fail'" class="tag tag-red svc-fail-tag">破坏性变更</span>
            </div>
            <div class="svc-body">{{ v.change }}</div>
            <div class="svc-fields">{{ (v.fields || []).join(' · ') }}</div>
            <div class="svc-compat">
              <span class="muted">兼容性：</span>
              <b :class="v.status === 'fail' ? 'text-danger' : 'text-success'">{{ v.compat }}</b>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🗑️ CDC 删除传播链路</div>
        </div>
        <div class="card-body">
          <div class="flow-chain ctr-flow">
            <template v-for="(node, ni) in CONTRACT_CDC_FLOW" :key="ni">
              <div v-if="ni > 0" class="flow-arrow">→</div>
              <div class="flow-node">
                <div class="fn-icon">{{ node.icon }}</div>
                <div class="fn-title">{{ node.title }}</div>
                <div class="fn-sub">{{ node.sub }}</div>
              </div>
            </template>
          </div>
          <p class="ctr-cdc-note">
            <b class="text-danger">约束：</b>源 DELETE 必须传播到 ODS equality delete → DWD 剔除 → ADS 重算 → CK 重导。
            缺失这条链路会导致「订单作废」和合规删除在看板里<b>幽灵复活</b>。
          </p>
        </div>
      </div>
    </div>

    <div class="card ctr-card-top">
      <div class="card-header">
        <div class="card-title">🧊 Iceberg Schema 演进规则</div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>变更类型</th>
              <th>允许</th>
              <th>动作</th>
              <th>CK 同步</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in ICEBERG_EVOLUTION_RULES" :key="row.change">
              <td>{{ row.change }}</td>
              <td>
                <span class="tag" :class="icebergAllowMeta(row.allow).tag">{{ icebergAllowMeta(row.allow).label }}</span>
              </td>
              <td style="font-size: 12px">{{ row.action }}</td>
              <td style="font-size: 12px">{{ row.ck }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card ctr-card-top">
      <div class="card-header">
        <div class="card-title">📡 CDC 入湖必须写死的语义</div>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr><th>问题</th><th>约定</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in CONTRACT_CDC_SEMANTICS" :key="row.q">
              <td>{{ row.q }}</td>
              <td style="font-size: 12px">{{ row.a }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card ctr-card-top">
      <div class="card-header">
        <div class="card-title">📝 Schema 变更审批 · §34.1 <span class="tip">· 破坏性变更必须走变更单</span></div>
        <button type="button" class="btn btn-sm" @click="newChangeTicket">＋ 发起变更单</button>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th>变更单</th>
              <th>表/Topic</th>
              <th>类型</th>
              <th>兼容性</th>
              <th>下游影响</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in CONTRACT_APPROVAL_TICKETS" :key="t.id">
              <td><code>{{ t.id }}</code></td>
              <td><code>{{ t.target }}</code></td>
              <td><span class="tag" :class="t.typeCls">{{ t.type }}</span></td>
              <td><span class="tag" :class="t.compatCls">{{ t.compat }}</span></td>
              <td>{{ t.impact }}</td>
              <td><span class="tag" :class="t.statusCls">{{ t.status }}</span></td>
            </tr>
          </tbody>
        </table>
        <div class="ctr-footnote">流程：草稿 → 兼容性检查 → 血缘影响 → 评审 → 批准 → 作业先发 → 放行 binlog</div>
      </div>
    </div>

    <div class="grid grid-2 ctr-grid-top">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔍 兼容性检查 · §34.2 <span class="tip">· CHG-2026-008</span></div>
          <span class="tag tag-red">破坏性</span>
        </div>
        <div class="card-body ctr-compat">
          <table class="table ctr-compat-table">
            <thead>
              <tr><th>字段</th><th>旧</th><th>新</th><th>判定</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in CONTRACT_COMPAT_CHECK" :key="c.field">
                <td>{{ c.field }}</td>
                <td>{{ c.old }}</td>
                <td>{{ c.neu }}</td>
                <td>
                  <span class="tag" :class="c.ok ? 'tag-green' : 'tag-red'">{{ c.label || '✓' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="ctr-alert danger">
            ⚠ 删列 <code>pay_amt</code> 违反 BACKWARD。必须走「新表 + 双跑 + 切读 + 下线旧表」流程。
          </div>
          <div class="ctr-jobs">
            <strong>需同步改的作业：</strong>
            <div>· dag.trade_dwd（dwd_order_detail 依赖 pay_amt）</div>
            <div>· job.ck.sync.gmv_board（导入 SQL 引用 pay_amt）</div>
            <div>· 报表「交易总览」3 张图表引用</div>
          </div>
          <button type="button" class="btn btn-sm" @click="notifyDownstream">📢 通知下游</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">⚙️ CDC 入湖语义 · §34.3 <span class="tip">· 每表一份</span></div>
          <button type="button" class="btn btn-sm" @click="newCdcConfig">＋ 新建配置</button>
        </div>
        <div class="card-body ctr-compat">
          <div class="ctr-cdc-focus"><strong>当前：<code>cdc.trade.order → ods_trade.s_order</code></strong></div>
          <table class="table ctr-compat-table">
            <thead><tr><th>配置项</th><th>当前值</th></tr></thead>
            <tbody>
              <tr><td>首次接入</td><td><span class="tag tag-green">全量+增量</span></td></tr>
              <tr><td>主键策略</td><td>equality upsert</td></tr>
              <tr><td>DELETE 处理</td><td><span class="tag tag-green">传播 (equality delete)</span></td></tr>
              <tr><td>乱序处理</td><td>watermark + 侧输出</td></tr>
              <tr><td>时间语义</td><td>事件时间</td></tr>
              <tr><td>时区</td><td>UTC 存储</td></tr>
            </tbody>
          </table>
          <div class="ctr-alert warn">
            ⚠ DELETE 传播是合规删除的前置条件。改为「忽略」将标记该表<b>不支持合规删除</b>。
          </div>
          <div class="ctr-jobs">
            <strong>其他表配置：</strong>
            <div>· cdc.user.info → equality upsert · DELETE 传播 ✓</div>
            <div>· cdc.erp.goods → append-only · 无主键</div>
            <div>· kafka.pv.buried → append-only · 事件时间</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ctr-kpi {
  grid-template-columns: repeat(5, 1fr);
}
.ctr-grid-top,
.ctr-card-top {
  margin-top: 16px;
}
.ctr-flow {
  flex-wrap: wrap;
  align-items: center;
  padding: 8px;
}
.flow-chain {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.flow-arrow {
  color: var(--text-3);
  font-size: 12px;
}
.flow-node {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
  min-width: 88px;
}
.fn-icon {
  font-size: 20px;
}
.fn-title {
  font-weight: 600;
  font-size: 13px;
  margin-top: 4px;
}
.fn-sub {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}
.ctr-cdc-note {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.8;
}
.ctr-versions {
  padding: 14px;
}
.schema-version-card {
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}
.schema-version-card.fail {
  border-color: var(--danger);
}
.svc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.svc-version {
  font-weight: 700;
  font-size: 13px;
}
.svc-date {
  font-size: 11px;
  color: var(--text-3);
}
.svc-fail-tag {
  margin-left: auto;
  font-size: 10px;
}
.svc-body {
  margin-top: 6px;
  font-size: 12px;
}
.svc-fields {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-3);
}
.svc-compat {
  margin-top: 6px;
  font-size: 11px;
}
.muted {
  color: var(--text-3);
}
.text-danger {
  color: var(--danger);
}
.text-success {
  color: var(--success);
}
.compat-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}
.compat-badge.backward {
  background: #e6f7ff;
  color: #096dd9;
}
.compat-badge.forward {
  background: #f6ffed;
  color: #389e0d;
}
.compat-badge.full {
  background: #f9f0ff;
  color: #722ed1;
}
.compat-badge.breaking {
  background: var(--danger-light);
  color: var(--danger);
}
.ctr-footnote {
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-3);
  border-top: 1px solid var(--border);
}
.ctr-compat {
  font-size: 12px;
  line-height: 1.8;
}
.ctr-compat-table {
  font-size: 11px;
}
.ctr-alert {
  margin-top: 8px;
  padding: 8px;
  border-radius: 6px;
  font-size: 11px;
}
.ctr-alert.danger {
  background: var(--danger-light);
  color: var(--danger);
}
.ctr-alert.warn {
  background: var(--warning-light);
  color: var(--warning);
}
.ctr-jobs {
  margin-top: 8px;
  color: var(--text-2);
  font-size: 12px;
}
.ctr-cdc-focus {
  margin-bottom: 8px;
}
</style>
