<script setup>
import { computed, reactive, ref, watch } from 'vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import SqlEditor from '@/components/etl/SqlEditor.vue'
import { useToast } from '@/composables/useToast'
import { useDataservice } from '@/composables/useDataservice'
import { resolveSqlDialect } from '@/utils/sqlDialect'
import {
  API_BUILD_STEPS,
  API_DATASOURCE_OPTIONS,
  API_METRIC_OPTIONS,
  API_TABLE_OPTIONS,
  FIELD_TRANSFORM_OPTIONS,
  RESPONSE_FORMAT_OPTIONS,
  RESPONSE_SHAPE_OPTIONS,
  apiDatasourceLabel,
  apiSourceLabel,
  buildApiFromWizard,
  defaultApiBuildForm,
  runApiBuildTest,
  syncSqlTemplate,
} from '@/data/apiBuild'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'publish'])
const { showToast } = useToast()
const { runTrial, runBuildAndPublish, sqlrestDs } = useDataservice()

const step = ref(0)
const form = reactive(defaultApiBuildForm())
const testing = ref(false)
const publishing = ref(false)

const steps = API_BUILD_STEPS
const isLast = computed(() => step.value === steps.length - 1)
const isFirst = computed(() => step.value === 0)

/** 优先用门户已投影/可投影数据源（listForSqlrest），否则回落演示选项 */
const datasourceOptions = computed(() => {
  const live = (sqlrestDs.value || [])
    .filter((d) => d.projectable || d.projected)
    .map((d) => ({
      value: d.id,
      label: `${d.name || d.dsCode || d.id}${d.projected ? ' · 已投影' : ' · 待投影'}`,
      sub: `${d.type || ''} · ${d.sqlrestName || d.sqlrestDatasourceId || ''}`,
      name: d.name,
      type: d.type,
    }))
  return live.length ? live : API_DATASOURCE_OPTIONS
})

const wizardDialectType = computed(() => {
  if (form.srcType !== 'SQL') return 'trino'
  const row = (sqlrestDs.value || []).find((d) => d.id === form.datasourceId)
  return row?.sqlrestType || row?.type || ''
})

const wizardDialect = computed(() => resolveSqlDialect(wizardDialectType.value))

watch(
  () => props.open,
  (v) => {
    if (!v) return
    step.value = 0
    Object.assign(form, defaultApiBuildForm())
    testing.value = false
  },
)

watch(
  () => [form.srcType, form.metricId, form.tableKey],
  () => {
    if (form.srcType !== 'SQL') form.sql = syncSqlTemplate(form)
  },
)

function close() {
  emit('close')
}

function validateStep(idx) {
  if (idx === 0) {
    if (!form.path?.trim() || !form.name?.trim()) return '请填写 API 名称与路径'
    if (form.srcType === '指标' && !form.metricId) return '请选择指标'
    if (form.srcType === '表' && !form.tableKey) return '请选择表'
    if (form.srcType === 'SQL') {
      if (!form.datasourceId) return '请选择数据源'
      if (!form.sql?.trim()) return form.engine === 'GROOVY' ? '请填写 Groovy 脚本' : '请填写自定义 SQL'
    }
  }
  if (idx === 1) {
    if (!form.method) return '请选择 HTTP 方法'
    if (!form.params?.length) return '请至少保留一个入参（可标为非必填）'
    if (form.params.some((p) => !String(p.name || '').trim())) return '入参名称不能为空'
    if (!form.responses?.length) return '请至少定义一个响应字段'
    if (form.responses.some((r) => !String(r.name || '').trim())) return '响应字段名称不能为空'
  }
  if (idx === 2) {
    if (!form.auth) return '请选择鉴权方式'
  }
  if (idx === 3) {
    const q = Number(form.qps)
    if (!q || q < 1) return '接口全局 QPS 须 ≥ 1'
  }
  if (idx === 4) {
    if (!form.tested || !form.testResult?.ok) return '请先完成试跑测试'
  }
  if (idx === 5) {
    if (!form.owner?.trim()) return '请填写负责人'
  }
  return ''
}

function next() {
  const err = validateStep(step.value)
  if (err) {
    showToast(err, 'warning')
    return
  }
  if (isLast.value) {
    publish()
    return
  }
  step.value += 1
}

function prev() {
  if (!isFirst.value) step.value -= 1
}

function goStep(i) {
  if (i <= step.value) step.value = i
}

function addParam() {
  form.params.push({ name: '', type: 'string', required: false, example: '', desc: '' })
}

function removeParam(i) {
  if (form.params.length <= 1) {
    showToast('至少保留一个入参', 'warning')
    return
  }
  form.params.splice(i, 1)
}

function addResponse() {
  form.responses.push({
    source: '',
    name: '',
    type: 'string',
    nullable: false,
    transform: 'none',
    example: '',
    desc: '',
  })
}

function removeResponse(i) {
  if (form.responses.length <= 1) {
    showToast('至少保留一个响应字段', 'warning')
    return
  }
  form.responses.splice(i, 1)
}

/** 从 SQL SELECT 列表粗略推断响应字段名 */
function inferResponsesFromSql() {
  const sql = form.sql || ''
  const m = sql.match(/select\s+([\s\S]+?)\s+from\s+/i)
  if (!m) {
    showToast('未能从 SQL 解析 SELECT 列，请手动配置', 'warning')
    return
  }
  const raw = m[1].trim()
  if (raw === '*' || raw.startsWith('*\n')) {
    showToast('SELECT * 无法推断字段，请改为显式列名或手动添加', 'warning')
    return
  }
  const cols = raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const as = c.match(/\bas\s+([`"']?)([\w.]+)\1$/i)
      if (as) return as[2]
      const parts = c.replace(/[`"]/g, '').split(/\s+/)
      const last = parts[parts.length - 1]
      return last.includes('.') ? last.split('.').pop() : last
    })
    .filter((n) => n && n !== '*')
  if (!cols.length) {
    showToast('未解析到列名', 'warning')
    return
  }
  form.responses = cols.map((name) => {
    const prev = form.responses.find((r) => r.source === name || r.name === name)
    return (
      prev || {
        source: name,
        name: name === 'total_gmv' ? 'totalGmv' : name,
        type: name === 'dt' ? 'date' : /gmv|amt|cnt|value|limit|id/i.test(name) ? 'number' : 'string',
        nullable: false,
        transform: /gmv|amt/i.test(name) ? 'cents_to_yuan' : 'none',
        example: name === 'dt' ? '2026-09-16' : '',
        desc: '',
      }
    )
  })
  showToast(`已推断 ${cols.length} 个响应字段（可继续配置映射转换）`, 'success')
}

async function doTest() {
  testing.value = true
  form.tested = false
  form.testResult = null
  try {
    const res = await runTrial(form)
    if (res?.ok || res?.sample != null || res?.data?.answer != null) {
      const sample = res.sample ?? res.data?.answer ?? res.data
      const rows = Array.isArray(sample) ? sample : sample != null ? [sample] : []
      form.testResult = {
        ok: true,
        latencyMs: 0,
        engine: '接口服务',
        source: apiSourceLabel(form),
        rowCount: rows.length,
        format: form.responseFormat || 'wrapped',
        shape: form.responseShape || 'list',
        sample: res.sample != null ? { code: 0, message: '操作成功', data: res.sample } : runApiBuildTest(form).sample,
        logs: res.logs,
        checkedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        degraded: !!res.degraded,
      }
      form.tested = true
      showToast(
        res.degraded
          ? `⚠ 试跑降级：${res.message || '后端不可达'}`
          : `✅ 试跑通过 · ${rows.length} 行`,
        res.degraded ? 'warning' : 'success',
      )
    } else {
      throw new Error(res?.message || '试跑失败')
    }
  } catch (e) {
    form.testResult = runApiBuildTest(form)
    form.tested = !!form.testResult.ok
    form.testResult.degraded = true
    showToast(
      `本地试跑（后端未通：${e?.message || e}）· ${form.testResult.latencyMs}ms`,
      'warning',
    )
  } finally {
    testing.value = false
  }
}

async function publish() {
  const err = validateStep(5)
  if (err) {
    showToast(err, 'warning')
    return
  }
  if (!form.tested) {
    showToast('发布前须完成测试', 'warning')
    step.value = 4
    return
  }
  publishing.value = true
  try {
    const result = await runBuildAndPublish(form)
    const row =
      result?.binding ||
      buildApiFromWizard({
        ...form,
        params: form.params.map((p) => ({ ...p })),
        responses: form.responses.map((r) => ({ ...r })),
      })
    const tip = result?.publish?.degraded || result?.build?.degraded
      ? `⚠ 已保存，部分步骤降级：${result?.publish?.binding?.lastError || result?.build?.sqlrest?.message || ''}`
      : `🚀 已发布 ${row.method || form.method} ${row.path || form.path}`
    showToast(tip, result?.publish?.degraded || result?.build?.degraded ? 'warning' : 'success')
    emit('publish', row)
    close()
  } catch (e) {
    const row = buildApiFromWizard({
      ...form,
      params: form.params.map((p) => ({ ...p })),
      responses: form.responses.map((r) => ({ ...r })),
    })
    showToast(`发布失败，已写入本地列表：${e?.message || e}`, 'warning')
    emit('publish', row)
    close()
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-mask" @click.self="close">
      <div class="modal api-wiz">
        <div class="modal-header">
          <div>
            <div class="modal-title">构建 API</div>
            <div class="modal-sub">门户编排 → 接口服务创建 / 调试 / 发布 / 部署 · 默认边缘统一网关</div>
          </div>
          <button type="button" class="btn btn-sm" @click="close">✕</button>
        </div>

        <div class="wiz-steps">
          <button
            v-for="(s, i) in steps"
            :key="s.id"
            type="button"
            class="wiz-step"
            :class="{ active: i === step, done: i < step }"
            @click="goStep(i)"
          >
            <span class="wiz-num">{{ i < step ? '✓' : i + 1 }}</span>
            <span class="wiz-meta">
              <span class="wiz-title">{{ s.title }}</span>
              <span class="wiz-desc">{{ s.desc }}</span>
            </span>
          </button>
        </div>

        <div class="modal-body wiz-body">
          <!-- 1 选源 -->
          <div v-if="step === 0" class="wiz-panel">
            <div class="form-grid wiz-grid">
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>来源类型</span>
                <select v-model="form.srcType" class="select" style="width: 100%">
                  <option>指标</option>
                  <option>表</option>
                  <option>SQL</option>
                </select>
              </label>
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>HTTP 方法</span>
                <select v-model="form.method" class="select" style="width: 100%">
                  <option>GET</option>
                  <option>POST</option>
                </select>
              </label>
              <label class="form-field wide">
                <span class="form-label"><span class="req">*</span>API 名称</span>
                <input v-model="form.name" class="input" style="width: 100%" placeholder="日 GMV 查询" />
              </label>
              <label class="form-field wide">
                <span class="form-label"><span class="req">*</span>路径</span>
                <input v-model="form.path" class="input" style="width: 100%" placeholder="/api/gmv/daily" />
              </label>
              <label v-if="form.srcType === '指标'" class="form-field wide">
                <span class="form-label"><span class="req">*</span>选择指标</span>
                <SearchSelect
                  v-model="form.metricId"
                  :options="API_METRIC_OPTIONS"
                  placeholder="搜索已启用指标"
                  sub-key="sub"
                  :search-keys="['name', 'type', 'value']"
                />
              </label>
              <label v-else-if="form.srcType === '表'" class="form-field wide">
                <span class="form-label"><span class="req">*</span>选择表</span>
                <SearchSelect
                  v-model="form.tableKey"
                  :options="API_TABLE_OPTIONS"
                  placeholder="搜索 ADS / DWD / DWS / DIM 表"
                  sub-key="sub"
                  :search-keys="['name', 'layer', 'domain', 'value']"
                />
              </label>
              <template v-else>
                <label class="form-field">
                  <span class="form-label"><span class="req">*</span>执行引擎</span>
                  <select v-model="form.engine" class="select" style="width: 100%">
                    <option value="SQL">SQL 语句</option>
                    <option value="GROOVY">Groovy 脚本</option>
                  </select>
                </label>
                <label class="form-field wide">
                  <span class="form-label"><span class="req">*</span>数据源（门户 → 投影接口服务）</span>
                  <SearchSelect
                    v-model="form.datasourceId"
                    :options="datasourceOptions"
                    placeholder="搜索可投影 / 已投影数据源"
                    sub-key="sub"
                    :search-keys="['name', 'type', 'value', 'label']"
                  />
                </label>
                <label class="form-field wide">
                  <span class="form-label"><span class="req">*</span>{{ form.engine === 'GROOVY' ? 'Groovy 脚本' : '自定义 SQL' }}</span>
                  <SqlEditor
                    v-model="form.sql"
                    compact
                    :rows="8"
                    :language="form.engine === 'GROOVY' ? 'groovy' : 'sql'"
                    :dialect="wizardDialectType"
                    :label="form.engine === 'GROOVY' ? 'Groovy' : 'SQL'"
                    :hint="form.engine === 'GROOVY' ? 'Groovy 关键字 / 字符串 / 方法调用高亮' : `${wizardDialect.family ? `${wizardDialect.label} · 按 ${wizardDialect.family}` : wizardDialect.label} · ${wizardDialect.quoteHint}`"
                    :placeholder="form.engine === 'GROOVY' ? '// groovy' : wizardDialect.sample"
                  />
                </label>
              </template>
            </div>
            <p class="field-hint">
              当前来源：{{ apiSourceLabel(form) }}
              <template v-if="form.srcType === 'SQL'"> · 数据源 {{ apiDatasourceLabel(form.datasourceId) }}</template>
              <template v-else> · 查询经接口服务 → 查询引擎（湖仓默认闸门）</template>
            </p>
          </div>

          <!-- 2 配参 -->
          <div v-else-if="step === 1" class="wiz-panel">
            <div class="form-grid wiz-grid">
              <div class="form-field wide">
                <SqlEditor
                  v-model="form.sql"
                  compact
                  :rows="8"
                  default-editing
                  label="SQL 模板"
                  :dialect="wizardDialectType"
                  :hint="
                    form.srcType === 'SQL'
                      ? `${wizardDialect.label} · ${wizardDialect.quoteHint} · 可用 {{param}}`
                      : `查询引擎 · ${wizardDialect.quoteHint} · 可用 {{param}}`
                  "
                  placeholder="SELECT ... WHERE dt = {{dt}}"
                />
              </div>
              <label class="form-field">
                <span class="form-label">封装格式</span>
                <select v-model="form.responseFormat" class="select" style="width: 100%">
                  <option v-for="o in RESPONSE_FORMAT_OPTIONS" :key="o.value" :value="o.value">
                    {{ o.label }} · {{ o.tip }}
                  </option>
                </select>
              </label>
              <label class="form-field">
                <span class="form-label">数据形态（result）</span>
                <select
                  v-model="form.responseShape"
                  class="select"
                  style="width: 100%"
                  :disabled="form.responseFormat === 'nil'"
                >
                  <option v-for="o in RESPONSE_SHAPE_OPTIONS" :key="o.value" :value="o.value">
                    {{ o.label }} · {{ o.tip }}
                  </option>
                </select>
              </label>
              <label v-if="form.responseShape === 'page' && form.responseFormat !== 'nil'" class="form-field">
                <span class="form-label">分页 total 示例</span>
                <input v-model.number="form.pageTotalExample" class="input" type="number" min="0" style="width: 100%" />
              </label>
            </div>

            <div class="param-head">
              <span class="form-label">入参定义</span>
              <button type="button" class="btn btn-sm" @click="addParam">＋ 入参</button>
            </div>
            <table class="data-table param-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>必填</th>
                  <th>示例</th>
                  <th>说明</th>
                  <th style="width: 48px" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(p, i) in form.params" :key="'in-' + i">
                  <td><input v-model="p.name" class="input" placeholder="dt" /></td>
                  <td>
                    <select v-model="p.type" class="select">
                      <option>string</option>
                      <option>int</option>
                      <option>number</option>
                      <option>date</option>
                      <option>bool</option>
                    </select>
                  </td>
                  <td style="text-align: center">
                    <input v-model="p.required" type="checkbox" />
                  </td>
                  <td><input v-model="p.example" class="input" placeholder="示例值" /></td>
                  <td><input v-model="p.desc" class="input" placeholder="说明" /></td>
                  <td>
                    <button type="button" class="btn btn-sm" @click="removeParam(i)">删</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="param-head param-head-out">
              <span class="form-label">出参映射与转换</span>
              <div class="param-head-actions">
                <button type="button" class="btn btn-sm" @click="inferResponsesFromSql">从 SQL 推断</button>
                <button type="button" class="btn btn-sm" @click="addResponse">＋ 字段</button>
              </div>
            </div>
            <table class="data-table param-table resp-map-table">
              <thead>
                <tr>
                  <th>SQL 列</th>
                  <th>出参名</th>
                  <th>类型</th>
                  <th>转换</th>
                  <th>可空</th>
                  <th>示例</th>
                  <th>说明</th>
                  <th style="width: 48px" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in form.responses" :key="'out-' + i">
                  <td><input v-model="r.source" class="input" placeholder="total_gmv" /></td>
                  <td><input v-model="r.name" class="input" placeholder="totalGmv" /></td>
                  <td>
                    <select v-model="r.type" class="select">
                      <option>string</option>
                      <option>int</option>
                      <option>number</option>
                      <option>date</option>
                      <option>bool</option>
                      <option>object</option>
                      <option>array</option>
                    </select>
                  </td>
                  <td>
                    <select v-model="r.transform" class="select">
                      <option v-for="t in FIELD_TRANSFORM_OPTIONS" :key="t.value" :value="t.value">
                        {{ t.label }}
                      </option>
                    </select>
                  </td>
                  <td style="text-align: center">
                    <input v-model="r.nullable" type="checkbox" />
                  </td>
                  <td><input v-model="r.example" class="input" placeholder="示例值" /></td>
                  <td><input v-model="r.desc" class="input" placeholder="说明" /></td>
                  <td>
                    <button type="button" class="btn btn-sm" @click="removeResponse(i)">删</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="field-hint">
              对齐接口服务：封装（wrapped/origin/nil）+ 形态（list/object/page）+ 列→出参映射与转换（改名、分转元、类型强制等）；试跑样例会按此结构生成。
            </p>
          </div>

          <!-- 3 鉴权 -->
          <div v-else-if="step === 2" class="wiz-panel">
            <div class="form-grid wiz-grid">
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>鉴权方式</span>
                <select v-model="form.auth" class="select" style="width: 100%">
                  <option>Token</option>
                  <option>OAuth2</option>
                  <option>免鉴权</option>
                </select>
              </label>
              <label v-if="form.auth === 'Token'" class="form-field">
                <span class="form-label">Token 有效期</span>
                <select v-model="form.tokenTtl" class="select" style="width: 100%">
                  <option>7天</option>
                  <option>30天</option>
                  <option>90天</option>
                  <option>长期</option>
                </select>
              </label>
              <label v-if="form.auth === 'OAuth2'" class="form-field wide">
                <span class="form-label">OAuth Scopes</span>
                <input v-model="form.oauthScopes" class="input" style="width: 100%" placeholder="api.read" />
              </label>
            </div>
            <p class="field-hint">
              Token / OAuth2 由申请中心签发；免鉴权仅用于内网只读演示接口，生产需审批。
            </p>
          </div>

          <!-- 4 全局限流 -->
          <div v-else-if="step === 3" class="wiz-panel">
            <div class="form-grid wiz-grid">
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>接口全局 QPS</span>
                <input v-model.number="form.qps" class="input" type="number" min="1" style="width: 100%" />
              </label>
              <label class="form-field">
                <span class="form-label">全局突发 Burst</span>
                <input v-model.number="form.burst" class="input" type="number" min="1" style="width: 100%" />
              </label>
              <label class="form-field wide">
                <span class="form-label">熔断策略（路由级）</span>
                <select v-model="form.breaker" class="select" style="width: 100%">
                  <option>5xx>20% 熔断 30s</option>
                  <option>5xx>10% 熔断 60s</option>
                  <option>RT>2s 熔断 30s</option>
                  <option>关闭熔断</option>
                </select>
              </label>
            </div>
            <p class="field-hint">
              此处为 <b>API 路由全局上限</b>（所有调用方合计）。各申请方的配额在「申请凭证」中按应用审批，且不得超过本全局 QPS；由 APISIX limit-req 分层落地。
            </p>
          </div>

          <!-- 5 测试 -->
          <div v-else-if="step === 4" class="wiz-panel">
            <div class="test-bar">
              <div>
                <div class="test-title">{{ form.method }} {{ form.path }}</div>
                <div class="tip">
                  来源 {{ apiSourceLabel(form) }}
                  <template v-if="form.srcType === 'SQL'"> · {{ apiDatasourceLabel(form.datasourceId) }}</template>
                  · {{ form.auth }} · 全局 {{ form.qps }} QPS
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" :disabled="testing" @click="doTest">
                {{ testing ? '试跑中…' : '▶ 试跑' }}
              </button>
            </div>
            <div v-if="form.testResult" class="test-result" :class="{ ok: form.testResult.ok }">
              <div class="tr-row">
                <span>结果</span>
                <strong>{{ form.testResult.ok ? '通过' : '失败' }}</strong>
              </div>
              <div class="tr-row"><span>引擎</span><code>{{ form.testResult.engine }}</code></div>
              <div class="tr-row"><span>延迟</span><code>{{ form.testResult.latencyMs }} ms</code></div>
              <div class="tr-row"><span>行数</span><code>{{ form.testResult.rowCount }}</code></div>
              <div class="tr-row"><span>响应结构</span><code>{{ form.testResult.format }} / {{ form.testResult.shape }}</code></div>
              <div class="tr-row"><span>时间</span><code>{{ form.testResult.checkedAt }}</code></div>
              <pre class="sample-json">{{ JSON.stringify(form.testResult.sample, null, 2) }}</pre>
            </div>
            <p v-else class="field-hint">
              点击试跑：接口服务编译模板 →
              {{ form.srcType === 'SQL' ? apiDatasourceLabel(form.datasourceId) : '查询引擎' }}
              执行（演示返回样例数据）。
            </p>
          </div>

          <!-- 6 发布 -->
          <div v-else class="wiz-panel">
            <div class="form-grid wiz-grid">
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>负责人</span>
                <input v-model="form.owner" class="input" style="width: 100%" />
              </label>
              <label class="form-field">
                <span class="form-label">业务域</span>
                <select v-model="form.domain" class="select" style="width: 100%">
                  <option>交易域</option>
                  <option>用户域</option>
                  <option>商品域</option>
                  <option>自定义</option>
                </select>
              </label>
              <label class="form-field wide">
                <span class="form-label">发布环境</span>
                <select v-model="form.publishEnv" class="select" style="width: 100%">
                  <option value="stg">stg（推荐先发预发）</option>
                  <option value="prod">prod（需 API Owner 审批）</option>
                </select>
              </label>
            </div>
            <div class="publish-summary">
              <div><span>路径</span><code>{{ form.method }} {{ form.path }}</code></div>
              <div><span>来源</span><code>{{ apiSourceLabel(form) }}</code></div>
              <div v-if="form.srcType === 'SQL'">
                <span>数据源</span><code>{{ apiDatasourceLabel(form.datasourceId) }}</code>
              </div>
              <div><span>鉴权 / 全局限流</span><code>{{ form.auth }} · {{ form.qps }} QPS</code></div>
              <div><span>入参 / 出参</span><code>{{ form.params.length }} 入 · {{ form.responses.length }} 出 · {{ form.responseFormat }}/{{ form.responseShape }}</code></div>
              <div><span>试跑</span><code>{{ form.tested ? `通过 ${form.testResult?.latencyMs}ms` : '未测试' }}</code></div>
            </div>
            <p class="field-hint">发布将写入 APISIX 路由（演示）；prod 环境会同步生成申请单待 API Owner 审批。</p>
          </div>
        </div>

        <div class="modal-footer wiz-footer">
          <button type="button" class="btn btn-sm" @click="close">取消</button>
          <div class="wiz-nav">
            <button type="button" class="btn btn-sm" :disabled="isFirst || publishing" @click="prev">上一步</button>
            <button type="button" class="btn btn-sm btn-primary" :disabled="publishing || testing" @click="next">
              {{
                isLast
                  ? publishing
                    ? '发布中…'
                    : form.publishEnv === 'prod'
                      ? '提交发布'
                      : '发布到 stg'
                  : '下一步'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.api-wiz {
  width: min(920px, 96vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.wiz-steps {
  display: flex;
  gap: 4px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  background: var(--bg-2);
}
.wiz-step {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 100px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: var(--text-3);
}
.wiz-step.active {
  background: var(--bg);
  border-color: var(--border);
  color: var(--text);
}
.wiz-step.done {
  color: var(--text-2);
}
.wiz-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  background: var(--bg);
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.wiz-step.active .wiz-num {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.wiz-step.done .wiz-num {
  background: var(--success);
  border-color: var(--success);
  color: #fff;
}
.wiz-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.wiz-title {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.wiz-desc {
  font-size: 10px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wiz-body {
  flex: 1;
  overflow: auto;
}
.wiz-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
}
.wiz-grid .wide {
  grid-column: 1 / -1;
}
.form-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-2);
}
.req {
  color: var(--danger);
  margin-right: 2px;
}
.field-hint {
  margin-top: 12px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-3);
}
.param-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 8px;
}
.param-head-out {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
.param-head-actions {
  display: flex;
  gap: 8px;
}
.param-table .input,
.param-table .select {
  width: 100%;
  min-width: 0;
  font-size: 12px;
}
.resp-map-table th:nth-child(4),
.resp-map-table td:nth-child(4) {
  min-width: 96px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.test-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.test-title {
  font-weight: 600;
  font-size: 14px;
}
.test-result {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-2);
}
.test-result.ok {
  border-color: color-mix(in srgb, var(--success) 40%, var(--border));
}
.tr-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  margin-bottom: 6px;
}
.tr-row span {
  color: var(--text-3);
}
.sample-json {
  margin: 10px 0 0;
  padding: 10px;
  border-radius: 6px;
  background: var(--bg);
  font-size: 11px;
  overflow: auto;
  max-height: 180px;
}
.publish-summary {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 8px;
  font-size: 12px;
}
.publish-summary > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.publish-summary span {
  color: var(--text-3);
}
.wiz-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.wiz-nav {
  display: flex;
  gap: 8px;
}
@media (max-width: 640px) {
  .wiz-grid {
    grid-template-columns: 1fr;
  }
  .wiz-desc {
    display: none;
  }
}
</style>
