<script setup>
import { computed } from 'vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import SqlEditor from '@/components/etl/SqlEditor.vue'
import CleanFieldRules from '@/components/etl/CleanFieldRules.vue'
import ConditionBranchesEditor from '@/components/etl/ConditionBranchesEditor.vue'
import { useDatasources } from '@/composables/useDatasources'
import { useAssets } from '@/composables/useAssets'

const props = defineProps({
  type: { type: String, required: true },
  conf: { type: Object, required: true },
  upstreamFields: { type: Array, default: () => [] },
})
const emit = defineEmits(['patch', 'patch-many'])

const { sources, ensureTables, getSource } = useDatasources()
const { list: assetList } = useAssets()

const DB_TYPES = ['MySQL', 'PostgreSQL', 'Oracle', 'SQLServer', 'MongoDB', 'TiDB', 'SQLite']
const CDC_ENGINES = ['Flink CDC', 'Debezium', 'Canal', 'Maxwell', 'OGG']
const STARTUP_MODES = [
  { value: 'initial', label: 'initial (快照+增量)' },
  { value: 'latest-offset', label: 'latest-offset (只增量)' },
  { value: 'timestamp', label: 'timestamp 指定时间' },
]

function set(key, val) {
  emit('patch', key, val)
}
function setMany(obj) {
  emit('patch-many', obj)
}
function setNested(parent, key, val) {
  emit('patch-many', { [parent]: { ...(props.conf[parent] || {}), [key]: val } })
}

const dsOptions = computed(() =>
  sources.value.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.type})`,
  })),
)

const tableOptions = computed(() => {
  const id = props.conf.dsId
  if (!id) return []
  return (ensureTables(id) || []).map((t) => ({
    value: t.name,
    label: t.name,
    sub: t.cnName || t.comment || '',
  }))
})

const lakeTableOptions = computed(() =>
  assetList.value.map((a) => ({
    value: a.key || a.name,
    label: a.key || a.name,
    sub: `${a.layerLabel || a.layer || ''} · ${a.domainLabel || ''}`,
  })),
)

function onBindDs(id) {
  if (!id) {
    set('dsId', '')
    return
  }
  const s = getSource(id)
  if (!s) {
    set('dsId', id)
    return
  }
  setMany({
    dsId: id,
    dbType: s.type || props.conf.dbType,
    host: s.host || '',
    port: Number(s.port) || props.conf.port || 3306,
    database: s.database || '',
    username: s.user || s.username || '',
  })
  ensureTables(id)
}

const tablesStr = computed({
  get: () => (props.conf.tables || []).join(','),
  set: (v) =>
    set(
      'tables',
      String(v || '')
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
})
</script>

<template>
  <!-- ===== source CDC ===== -->
  <template v-if="type === 'source'">
    <div class="sec-title">连接信息</div>
    <label class="form-field">
      <span class="form-label">绑定已有数据源</span>
      <select class="select" :value="conf.dsId || ''" @change="onBindDs($event.target.value)">
        <option value="">— 暂不绑定 / 手填 —</option>
        <option v-for="o in dsOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <div class="form-hint">生产环境推荐：绑定数据源，凭证走 Vault 动态租约</div>
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">数据库类型</span>
        <select class="select" :value="conf.dbType" @change="set('dbType', $event.target.value)">
          <option v-for="t in DB_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">Host</span>
        <input class="input" :value="conf.host" @input="set('host', $event.target.value)" />
      </label>
      <label class="form-field">
        <span class="form-label">端口</span>
        <input class="input" type="number" :value="conf.port" @input="set('port', Number($event.target.value))" />
      </label>
      <label class="form-field">
        <span class="form-label">数据库名</span>
        <input class="input" :value="conf.database" @input="set('database', $event.target.value)" />
      </label>
      <label class="form-field">
        <span class="form-label">用户名</span>
        <input class="input" :value="conf.username" @input="set('username', $event.target.value)" />
      </label>
      <label class="form-field">
        <span class="form-label">密码</span>
        <input class="input" type="password" :value="conf.password" @input="set('password', $event.target.value)" placeholder="演示可留空" />
      </label>
    </div>
    <label class="form-field">
      <span class="form-label">CDC 表列表（逗号分隔）</span>
      <input class="input" :value="tablesStr" @input="tablesStr = $event.target.value" placeholder="schema.table" />
    </label>
    <div v-if="tableOptions.length" class="form-field">
      <span class="form-label">从数据源选表</span>
      <SearchSelect
        :model-value="(conf.tables && conf.tables[0]) || ''"
        :options="tableOptions"
        allow-custom
        placeholder="搜索表名…"
        @update:model-value="(v) => setMany({ tables: v ? [v] : [], src: v })"
      />
    </div>
    <label class="form-field">
      <span class="form-label">主键字段</span>
      <input class="input" :value="conf.pk" @input="set('pk', $event.target.value)" />
    </label>
    <label class="form-field">
      <span class="form-label">抽取模式</span>
      <select class="select" :value="conf.mode || 'cdc'" @change="set('mode', $event.target.value)">
        <option value="cdc">CDC 增量</option>
        <option value="batch">Batch 全量</option>
        <option value="incremental">水位增量</option>
      </select>
    </label>
    <div class="form-hint">本节点只负责抽取；写入湖内 ODS/DWD 请使用下游「Iceberg / 关系库」等目标节点，并在目标节点配置字段映射。</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">CDC 引擎</span>
        <select class="select" :value="conf.cdcEngine" @change="set('cdcEngine', $event.target.value)">
          <option v-for="e in CDC_ENGINES" :key="e" :value="e">{{ e }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">启动模式</span>
        <select class="select" :value="conf.startupMode" @change="set('startupMode', $event.target.value)">
          <option v-for="m in STARTUP_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">Slot/日志名</span>
        <input class="input" :value="conf.slotName" @input="set('slotName', $event.target.value)" />
      </label>
      <label class="form-field">
        <span class="form-label">时区</span>
        <input class="input" :value="conf.serverTimeZone" @input="set('serverTimeZone', $event.target.value)" />
      </label>
      <label class="form-field">
        <span class="form-label">快照批量行数</span>
        <input class="input" type="number" :value="conf.snapshotPollSize" @input="set('snapshotPollSize', Number($event.target.value))" />
      </label>
      <label class="form-field">
        <span class="form-label">fetchSize</span>
        <input class="input" type="number" :value="conf.fetchSize" @input="set('fetchSize', Number($event.target.value))" />
      </label>
    </div>

    <div class="sec-title">高级参数</div>
    <div class="chk-group">
      <label class="chk-item">
        <input type="checkbox" :checked="!!conf.includeSchemaChange" @change="set('includeSchemaChange', $event.target.checked)" />
        采集并下发 DDL Schema 变更
      </label>
      <label class="chk-item">
        <input type="checkbox" :checked="!!conf.sharding" @change="set('sharding', $event.target.checked)" />
        启用分库分表合并
      </label>
      <label class="chk-item">
        <input type="checkbox" :checked="!!conf.ttlEnabled" @change="set('ttlEnabled', $event.target.checked)" />
        启用日志保留 TTL
      </label>
    </div>
    <div class="form-grid-2" style="margin-top: 8px">
      <label class="form-field">
        <span class="form-label">DDL 容忍策略</span>
        <select class="select" :value="conf.ddlTolerance" @change="set('ddlTolerance', $event.target.value)">
          <option>error</option>
          <option>warn</option>
          <option>ignore</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">分片数</span>
        <input class="input" type="number" :value="conf.shardCount" @input="set('shardCount', Number($event.target.value))" />
      </label>
      <label class="form-field">
        <span class="form-label">TTL (天)</span>
        <input class="input" type="number" :value="conf.ttlDays" @input="set('ttlDays', Number($event.target.value))" />
      </label>
      <label class="form-field">
        <span class="form-label">连接超时(秒)</span>
        <input class="input" type="number" :value="conf.connectTimeout" @input="set('connectTimeout', Number($event.target.value))" />
      </label>
      <label class="form-field">
        <span class="form-label">失败重试</span>
        <input class="input" type="number" :value="conf.retry" @input="set('retry', Number($event.target.value))" />
      </label>
    </div>
  </template>

  <!-- ===== source_api ===== -->
  <template v-else-if="type === 'source_api'">
    <div class="sec-title">请求信息</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">Method</span>
        <select class="select" :value="conf.method" @change="set('method', $event.target.value)">
          <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">Content-Type</span>
        <select class="select" :value="conf.contentType" @change="set('contentType', $event.target.value)">
          <option>application/json</option>
          <option>application/x-www-form-urlencoded</option>
          <option>multipart/form-data</option>
          <option>text/plain</option>
        </select>
      </label>
    </div>
    <label class="form-field">
      <span class="form-label">绑定 API 数据源</span>
      <select class="select" :value="conf.dsId || ''" @change="onBindDs($event.target.value)">
        <option value="">— 暂不绑定 —</option>
        <option v-for="o in dsOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <label class="form-field">
      <span class="form-label">Base URL</span>
      <input class="input" :value="conf.baseUrl" @input="set('baseUrl', $event.target.value)" />
    </label>
    <label class="form-field">
      <span class="form-label">接口 Path</span>
      <input class="input" :value="conf.path" @input="set('path', $event.target.value)" />
    </label>
    <label class="form-field">
      <span class="form-label">Body 模板</span>
      <textarea class="textarea mono" rows="3" :value="conf.bodyTemplate" @input="set('bodyTemplate', $event.target.value)" />
    </label>

    <div class="sec-title">鉴权方式</div>
    <label class="form-field">
      <span class="form-label">类型</span>
      <select class="select" :value="conf.authType" @change="set('authType', $event.target.value)">
        <option value="none">无</option>
        <option value="basic">Basic Auth</option>
        <option value="bearer">Bearer Token</option>
        <option value="apikey">API Key</option>
        <option value="oauth2">OAuth2 Client</option>
      </select>
    </label>
    <div v-if="conf.authType === 'basic'" class="form-grid-2">
      <label class="form-field"><span class="form-label">账号</span><input class="input" :value="conf.authUser" @input="set('authUser', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">密码</span><input class="input" type="password" :value="conf.authPass" @input="set('authPass', $event.target.value)" /></label>
    </div>
    <label v-if="conf.authType === 'bearer'" class="form-field">
      <span class="form-label">Token</span>
      <input class="input" :value="conf.authToken" @input="set('authToken', $event.target.value)" />
    </label>
    <div v-if="conf.authType === 'apikey'" class="form-grid-2">
      <label class="form-field"><span class="form-label">Header 名</span><input class="input" :value="conf.apiKeyHeader" @input="set('apiKeyHeader', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Key</span><input class="input" :value="conf.apiKey" @input="set('apiKey', $event.target.value)" /></label>
    </div>

    <div class="sec-title">分页 & 限流</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">分页方式</span>
        <select class="select" :value="conf.pagination" @change="set('pagination', $event.target.value)">
          <option value="page">page 页码</option>
          <option value="offset">offset 偏移</option>
          <option value="cursor">cursor 游标</option>
          <option value="none">不分页</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">每页数量</span><input class="input" type="number" :value="conf.pageSize" @input="set('pageSize', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">限频 QPS</span><input class="input" type="number" :value="conf.rateLimitQps" @input="set('rateLimitQps', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">超时(秒)</span><input class="input" type="number" :value="conf.timeout" @input="set('timeout', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">重试次数</span><input class="input" type="number" :value="conf.retry" @input="set('retry', Number($event.target.value))" /></label>
      <label class="form-field">
        <span class="form-label">退避策略</span>
        <select class="select" :value="conf.backoff" @change="set('backoff', $event.target.value)">
          <option>fixed</option><option>exponential</option><option>jitter</option>
        </select>
      </label>
    </div>

    <div class="sec-title">返回解析</div>
    <label class="form-field"><span class="form-label">JSONPath 取数</span><input class="input" :value="conf.jsonPath" @input="set('jsonPath', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">主键字段</span><input class="input" :value="conf.idField" @input="set('idField', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">增量字段</span><input class="input" :value="conf.updatedAtField" @input="set('updatedAtField', $event.target.value)" /></label>
    </div>
  </template>

  <!-- ===== source_file ===== -->
  <template v-else-if="type === 'source_file'">
    <div class="sec-title">存储位置</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">存储类型</span>
        <select class="select" :value="conf.storageType" @change="set('storageType', $event.target.value)">
          <option>S3</option><option>HDFS</option><option>FTP</option><option>SFTP</option><option>LOCAL</option><option>OSS</option><option>COS</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">Endpoint</span><input class="input" :value="conf.endpoint" @input="set('endpoint', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Bucket</span><input class="input" :value="conf.bucket" @input="set('bucket', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Access Key</span><input class="input" :value="conf.accessKey" @input="set('accessKey', $event.target.value)" /></label>
    </div>
    <label class="form-field"><span class="form-label">基础路径</span><input class="input" :value="conf.basePath" @input="set('basePath', $event.target.value)" /></label>
    <label class="form-field"><span class="form-label">文件匹配 (Glob)</span><input class="input" :value="conf.filePattern" @input="set('filePattern', $event.target.value)" /></label>

    <div class="sec-title">文件格式</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">格式</span>
        <select class="select" :value="conf.format" @change="set('format', $event.target.value)">
          <option>csv</option><option>json</option><option>parquet</option><option>orc</option><option>xlsx</option><option>xml</option><option>txt</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">压缩</span>
        <select class="select" :value="conf.compression" @change="set('compression', $event.target.value)">
          <option>none</option><option>gzip</option><option>snappy</option><option>zip</option><option>zstd</option><option>lz4</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">编码</span>
        <select class="select" :value="conf.encoding" @change="set('encoding', $event.target.value)">
          <option>UTF-8</option><option>GBK</option><option>ISO-8859-1</option><option>UTF-16</option>
        </select>
      </label>
      <label v-if="conf.format === 'csv' || conf.format === 'txt'" class="form-field">
        <span class="form-label">分隔符</span>
        <input class="input" :value="conf.delimiter" @input="set('delimiter', $event.target.value)" />
      </label>
    </div>
    <div class="chk-group">
      <label class="chk-item"><input type="checkbox" :checked="!!conf.headerLine" @change="set('headerLine', $event.target.checked)" /> 首行为表头</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.schemaInfer" @change="set('schemaInfer', $event.target.checked)" /> 自动推断 Schema</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.failOnCorrupt" @change="set('failOnCorrupt', $event.target.checked)" /> 损坏文件直接失败</label>
    </div>
    <div class="form-grid-2" style="margin-top: 8px">
      <label class="form-field">
        <span class="form-label">写入模式</span>
        <select class="select" :value="conf.writeMode" @change="set('writeMode', $event.target.value)">
          <option>append</option><option>overwrite</option><option>error_if_exists</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">跳过前 N 行</span><input class="input" type="number" :value="conf.skipRows" @input="set('skipRows', Number($event.target.value))" /></label>
    </div>
  </template>

  <!-- ===== clean ===== -->
  <template v-else-if="type === 'clean'">
    <div class="sec-title">预设与全局策略</div>
    <label class="form-field">
      <span class="form-label">清洗等级</span>
      <select class="select" :value="conf.preset" @change="set('preset', $event.target.value)">
        <option value="STANDARD">标准（按字段规则执行）</option>
        <option value="STRICT">严格（额外格式校验）</option>
        <option value="LOOSE">宽松（仅空白/大小写）</option>
        <option value="CUSTOM">自定义</option>
      </select>
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">跨字段去重</span>
        <select class="select" :value="String(!!conf.dedup)" @change="set('dedup', $event.target.value === 'true')">
          <option value="true">启用</option>
          <option value="false">关闭</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">去重保留</span>
        <select class="select" :value="conf.dedupKeep || 'latest'" @change="set('dedupKeep', $event.target.value)">
          <option value="latest">保留最新</option>
          <option value="earliest">保留最早</option>
        </select>
      </label>
    </div>
    <label class="form-field">
      <span class="form-label">去重键（逗号，跨字段）</span>
      <input
        class="input"
        :value="(conf.dedupKeys || conf.rules?.dedupKeys || []).join(',')"
        @input="set('dedupKeys', $event.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean))"
      />
    </label>
    <div class="form-hint">引擎继承任务「主引擎」，清洗节点无需单独选引擎。</div>

    <div class="sec-title">字段级规则</div>
    <CleanFieldRules
      :model-value="conf.fieldRules || []"
      :fields="upstreamFields"
      @update:model-value="set('fieldRules', $event)"
    />
  </template>

  <!-- ===== transform ===== -->
  <template v-else-if="type === 'transform'">
    <div class="sec-title">计算引擎</div>
    <div class="form-hint">仅 SQL/计算节点需要指定执行引擎；默认可与任务主引擎一致。</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">引擎</span>
        <select class="select" :value="conf.engine" @change="set('engine', $event.target.value)">
          <option>Spark</option><option>Flink</option><option>Hive</option><option>Trino</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">方言</span>
        <select class="select" :value="conf.dialect" @change="set('dialect', $event.target.value)">
          <option value="ansi">ANSI</option><option value="hive">Hive</option><option value="flink">Flink</option><option value="spark">Spark</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">超时(秒)</span><input class="input" type="number" :value="conf.timeout" @input="set('timeout', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">失败重试</span><input class="input" type="number" :value="conf.retry" @input="set('retry', Number($event.target.value))" /></label>
    </div>
    <div class="sec-title">SQL</div>
    <div v-if="upstreamFields.length" class="form-hint" style="margin-bottom: 6px">
      上游字段：
      <code v-for="f in upstreamFields.slice(0, 12)" :key="f.name" style="margin-right: 4px">{{ f.name }}</code>
    </div>
    <SqlEditor :model-value="conf.sql || ''" :rows="10" @update:model-value="set('sql', $event)" />
    <div class="sec-title">资源配置</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">队列</span><input class="input" :value="conf.resources?.queue" @input="setNested('resources', 'queue', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Driver Cores</span><input class="input" type="number" :value="conf.resources?.driverCores" @input="setNested('resources', 'driverCores', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">Driver Mem</span><input class="input" :value="conf.resources?.driverMem" @input="setNested('resources', 'driverMem', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Executor 数</span><input class="input" type="number" :value="conf.resources?.executorNum" @input="setNested('resources', 'executorNum', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">Executor Cores</span><input class="input" type="number" :value="conf.resources?.executorCores" @input="setNested('resources', 'executorCores', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">Executor Mem</span><input class="input" :value="conf.resources?.executorMem" @input="setNested('resources', 'executorMem', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">分区字段</span><input class="input" :value="conf.partitionBy" @input="set('partitionBy', $event.target.value)" /></label>
      <label class="form-field">
        <span class="form-label">Cache</span>
        <select class="select" :value="conf.cacheLevel" @change="set('cacheLevel', $event.target.value)">
          <option>NONE</option><option>MEMORY</option><option>DISK</option><option>MEMORY_AND_DISK</option>
        </select>
      </label>
    </div>
  </template>

  <!-- ===== mapping ===== -->
  <template v-else-if="type === 'mapping'">
    <div class="sec-title">映射策略</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">默认策略</span>
        <select class="select" :value="conf.strategy" @change="set('strategy', $event.target.value)">
          <option>同名映射</option><option>显式映射</option><option>表达式</option><option>自动推断</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">重命名</span>
        <select class="select" :value="conf.autoRename" @change="set('autoRename', $event.target.value)">
          <option value="none">无</option>
          <option value="under2camel">下划线→驼峰</option>
          <option value="camel2under">驼峰→下划线</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">前缀</span><input class="input" :value="conf.addPrefix" @input="set('addPrefix', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">后缀</span><input class="input" :value="conf.addSuffix" @input="set('addSuffix', $event.target.value)" /></label>
    </div>
    <label class="chk-item" style="margin: 8px 0">
      <input type="checkbox" :checked="!!conf.castStringToVarchar" @change="set('castStringToVarchar', $event.target.checked)" />
      String → VARCHAR 强制转换
    </label>
  </template>

  <!-- ===== quality ===== -->
  <template v-else-if="type === 'quality'">
    <div class="sec-title">规则与策略</div>
    <label class="form-field"><span class="form-label">规则组</span><input class="input" :value="conf.ruleGroup" @input="set('ruleGroup', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">失败阈值</span><input class="input" type="number" step="0.01" :value="conf.threshold" @input="set('threshold', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">采样率</span><input class="input" type="number" step="0.01" :value="conf.sampleRatio" @input="set('sampleRatio', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">最大检测行</span><input class="input" type="number" :value="conf.maxRows" @input="set('maxRows', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">报告表</span><input class="input" :value="conf.reportTable" @input="set('reportTable', $event.target.value)" /></label>
    </div>
    <div class="chk-group">
      <label class="chk-item"><input type="checkbox" :checked="!!conf.blockOnFail" @change="set('blockOnFail', $event.target.checked)" /> 失败阻断下游</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.outputReport" @change="set('outputReport', $event.target.checked)" /> 输出检测报告</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.alertOwner" @change="set('alertOwner', $event.target.checked)" /> 通知负责人</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.alertDing" @change="set('alertDing', $event.target.checked)" /> 钉钉告警</label>
    </div>
    <label class="form-field" style="margin-top: 8px">
      <span class="form-label">规则明细 (JSON)</span>
      <textarea
        class="textarea mono"
        rows="6"
        :value="typeof conf.rules === 'string' ? conf.rules : JSON.stringify(conf.rules || [], null, 2)"
        @input="set('rules', $event.target.value)"
      />
    </label>
  </template>

  <!-- ===== parallel ===== -->
  <template v-else-if="type === 'parallel'">
    <div class="sec-title">并行分支</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">并行度</span><input class="input" type="number" :value="conf.parallelism" @input="set('parallelism', Number($event.target.value))" /></label>
      <label class="form-field">
        <span class="form-label">策略</span>
        <select class="select" :value="conf.strategy" @change="set('strategy', $event.target.value)">
          <option value="hash">hash</option><option value="round_robin">round_robin</option><option value="key">key</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">分片键</span><input class="input" :value="conf.shardKey" @input="set('shardKey', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">最大等待(ms)</span><input class="input" type="number" :value="conf.maxWaitMs" @input="set('maxWaitMs', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">CPU/分支</span><input class="input" type="number" :value="conf.cpuPerBranch" @input="set('cpuPerBranch', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">内存/分支</span><input class="input" :value="conf.memPerBranch" @input="set('memPerBranch', $event.target.value)" /></label>
    </div>
    <label class="chk-item"><input type="checkbox" :checked="!!conf.failFast" @change="set('failFast', $event.target.checked)" /> Fail Fast</label>
    <label class="form-field"><span class="form-label">分支标签（逗号）</span>
      <input class="input" :value="(conf.branchLabels || []).join(',')" @input="set('branchLabels', $event.target.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean))" />
    </label>
  </template>

  <!-- ===== condition ===== -->
  <template v-else-if="type === 'condition'">
    <div class="sec-title">求值参数</div>
    <label class="form-field">
      <span class="form-label">总条件说明（可选）</span>
      <input class="input" :value="conf.cond" @input="set('cond', $event.target.value)" placeholder="如：按金额分档路由" />
    </label>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">NULL 处理</span>
        <select class="select" :value="conf.nullHandling" @change="set('nullHandling', $event.target.value)">
          <option value="as_false">视为 FALSE</option>
          <option value="as_true">视为 TRUE</option>
          <option value="exception">抛异常</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">默认分支</span>
        <select class="select" :value="conf.defaultBranch" @change="set('defaultBranch', $event.target.value)">
          <option
            v-for="(b, i) in (conf.branches || [])"
            :key="'br' + i"
            :value="'branch' + (i + 1)"
          >{{ b.label || ('分支' + (i + 1)) }}</option>
          <option value="fail">阻塞并告警</option>
          <option value="pass">跳过该节点</option>
        </select>
      </label>
    </div>
    <label class="chk-item" style="margin: 8px 0">
      <input type="checkbox" :checked="conf.evalOncePerRow !== false" @change="set('evalOncePerRow', $event.target.checked)" />
      每行按顺序匹配首个命中分支
    </label>

    <div class="sec-title">分支定义</div>
    <ConditionBranchesEditor
      :model-value="Array.isArray(conf.branches) ? conf.branches : []"
      :fields="upstreamFields"
      @update:model-value="set('branches', $event)"
    />
  </template>

  <!-- ===== union ===== -->
  <template v-else-if="type === 'union'">
    <div class="sec-title">合并 / UNION</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">策略</span>
        <select class="select" :value="conf.strategy" @change="set('strategy', $event.target.value)">
          <option>UNION ALL</option><option>UNION DISTINCT</option><option>INTERSECT</option><option>EXCEPT</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">输入路数</span><input class="input" type="number" :value="conf.inputCount" @input="set('inputCount', Number($event.target.value))" /></label>
      <label class="form-field">
        <span class="form-label">缺列填充</span>
        <select class="select" :value="conf.missingColumnFill" @change="set('missingColumnFill', $event.target.value)">
          <option value="null">null</option><option value="default">default</option><option value="drop_row">drop_row</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">类型冲突</span>
        <select class="select" :value="conf.typeConflictPolicy" @change="set('typeConflictPolicy', $event.target.value)">
          <option value="wider_cast">wider_cast</option><option value="error">error</option><option value="drop_row">drop_row</option>
        </select>
      </label>
    </div>
    <div class="chk-group">
      <label class="chk-item"><input type="checkbox" :checked="!!conf.autoAlignColumns" @change="set('autoAlignColumns', $event.target.checked)" /> 自动对齐列</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.dedupAfter" @change="set('dedupAfter', $event.target.checked)" /> 合并后去重</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.allowEmptyBranch" @change="set('allowEmptyBranch', $event.target.checked)" /> 允许空分支</label>
    </div>
  </template>

  <!-- ===== sink_iceberg ===== -->
  <template v-else-if="type === 'sink_iceberg'">
    <div class="sec-title">Iceberg 目标</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">Catalog</span><input class="input" :value="conf.catalog" @input="set('catalog', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Database</span><input class="input" :value="conf.database" @input="set('database', $event.target.value)" /></label>
    </div>
    <label class="form-field">
      <span class="form-label">表</span>
      <SearchSelect :model-value="conf.table || ''" :options="lakeTableOptions" allow-custom @update:model-value="(v) => set('table', v)" />
    </label>
    <label class="form-field"><span class="form-label">Warehouse</span><input class="input" :value="conf.warehouse" @input="set('warehouse', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">分区</span><input class="input" :value="conf.partition" @input="set('partition', $event.target.value)" /></label>
      <label class="form-field">
        <span class="form-label">分区变换</span>
        <select class="select" :value="conf.partitionTransform" @change="set('partitionTransform', $event.target.value)">
          <option>identity</option><option>year</option><option>month</option><option>day</option><option>hour</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-label">写入模式</span>
        <select class="select" :value="conf.writeMode" @change="set('writeMode', $event.target.value)">
          <option>append</option><option>overwrite</option><option>upsert</option><option>cdc</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">主键</span><input class="input" :value="conf.pk" @input="set('pk', $event.target.value)" /></label>
      <label class="form-field">
        <span class="form-label">压缩</span>
        <select class="select" :value="conf.compression" @change="set('compression', $event.target.value)">
          <option>zstd</option><option>snappy</option><option>gzip</option><option>none</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">目标文件大小(MB)</span><input class="input" type="number" :value="conf.fileSizeMb" @input="set('fileSizeMb', Number($event.target.value))" /></label>
    </div>
    <div class="chk-group">
      <label class="chk-item"><input type="checkbox" :checked="!!conf.mergeOnRead" @change="set('mergeOnRead', $event.target.checked)" /> Merge on Read</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.enableExpire" @change="set('enableExpire', $event.target.checked)" /> Expire Snapshots</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.enableCompact" @change="set('enableCompact', $event.target.checked)" /> Compact</label>
      <label class="chk-item"><input type="checkbox" :checked="!!conf.enableVacuum" @change="set('enableVacuum', $event.target.checked)" /> Vacuum</label>
    </div>
  </template>

  <!-- ===== sink_ck ===== -->
  <template v-else-if="type === 'sink_ck'">
    <div class="sec-title">ClickHouse</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">Cluster</span><input class="input" :value="conf.cluster" @input="set('cluster', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Database</span><input class="input" :value="conf.database" @input="set('database', $event.target.value)" /></label>
    </div>
    <label class="form-field"><span class="form-label">表</span><input class="input" :value="conf.table" @input="set('table', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">表引擎 (MergeTree 族)</span><input class="input" :value="conf.engine" @input="set('engine', $event.target.value)" placeholder="ReplacingMergeTree" /></label>
      <label class="form-field"><span class="form-label">版本列</span><input class="input" :value="conf.engineVerCol" @input="set('engineVerCol', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">ORDER BY</span><input class="input" :value="conf.orderBy" @input="set('orderBy', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">PARTITION BY</span><input class="input" :value="conf.partitionBy" @input="set('partitionBy', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">批次大小</span><input class="input" type="number" :value="conf.batchSize" @input="set('batchSize', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">Flush(ms)</span><input class="input" type="number" :value="conf.flushIntervalMs" @input="set('flushIntervalMs', Number($event.target.value))" /></label>
    </div>
    <label class="form-field"><span class="form-label">TTL 表达式</span><input class="input" :value="conf.ttlExpression" @input="set('ttlExpression', $event.target.value)" /></label>
  </template>

  <!-- ===== sink_kafka ===== -->
  <template v-else-if="type === 'sink_kafka'">
    <div class="sec-title">Kafka</div>
    <label class="form-field"><span class="form-label">Bootstrap</span><input class="input" :value="conf.bootstrap" @input="set('bootstrap', $event.target.value)" /></label>
    <label class="form-field"><span class="form-label">Topic</span><input class="input" :value="conf.topic" @input="set('topic', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">Key 字段</span><input class="input" :value="conf.keyField" @input="set('keyField', $event.target.value)" /></label>
      <label class="form-field">
        <span class="form-label">Value 格式</span>
        <select class="select" :value="conf.valueFormat" @change="set('valueFormat', $event.target.value)">
          <option>JSON</option><option>Avro</option><option>Protobuf</option><option>String</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">acks</span><select class="select" :value="conf.acks" @change="set('acks', $event.target.value)"><option>all</option><option>1</option><option>0</option></select></label>
      <label class="form-field"><span class="form-label">压缩</span><select class="select" :value="conf.compression" @change="set('compression', $event.target.value)"><option>lz4</option><option>snappy</option><option>gzip</option><option>none</option></select></label>
      <label class="form-field"><span class="form-label">lingerMs</span><input class="input" type="number" :value="conf.lingerMs" @input="set('lingerMs', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">重试</span><input class="input" type="number" :value="conf.retries" @input="set('retries', Number($event.target.value))" /></label>
    </div>
    <label class="chk-item"><input type="checkbox" :checked="!!conf.enableIdempotence" @change="set('enableIdempotence', $event.target.checked)" /> 幂等生产者</label>
  </template>

  <!-- ===== sink_object ===== -->
  <template v-else-if="type === 'sink_object'">
    <div class="sec-title">对象存储</div>
    <div class="form-grid-2">
      <label class="form-field">
        <span class="form-label">存储类型</span>
        <select class="select" :value="conf.storageType" @change="set('storageType', $event.target.value)">
          <option>S3</option><option>OSS</option><option>COS</option><option>MinIO</option><option>HDFS</option>
        </select>
      </label>
      <label class="form-field"><span class="form-label">Endpoint</span><input class="input" :value="conf.endpoint" @input="set('endpoint', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Bucket</span><input class="input" :value="conf.bucket" @input="set('bucket', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">Region</span><input class="input" :value="conf.region" @input="set('region', $event.target.value)" /></label>
    </div>
    <label class="form-field"><span class="form-label">路径</span><input class="input" :value="conf.basePath" @input="set('basePath', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">格式</span><select class="select" :value="conf.format" @change="set('format', $event.target.value)"><option>parquet</option><option>orc</option><option>csv</option><option>json</option></select></label>
      <label class="form-field"><span class="form-label">压缩</span><select class="select" :value="conf.compression" @change="set('compression', $event.target.value)"><option>zstd</option><option>snappy</option><option>gzip</option><option>none</option></select></label>
      <label class="form-field"><span class="form-label">写入模式</span><select class="select" :value="conf.writeMode" @change="set('writeMode', $event.target.value)"><option>overwrite</option><option>append</option></select></label>
      <label class="form-field"><span class="form-label">分区</span><input class="input" :value="conf.partitionBy" @input="set('partitionBy', $event.target.value)" /></label>
    </div>
  </template>

  <!-- ===== sink_ftp ===== -->
  <template v-else-if="type === 'sink_ftp'">
    <div class="sec-title">FTP/SFTP</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">协议</span><select class="select" :value="conf.protocol" @change="set('protocol', $event.target.value)"><option>SFTP</option><option>FTP</option><option>FTPS</option></select></label>
      <label class="form-field"><span class="form-label">Host</span><input class="input" :value="conf.host" @input="set('host', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">端口</span><input class="input" type="number" :value="conf.port" @input="set('port', Number($event.target.value))" /></label>
      <label class="form-field"><span class="form-label">用户</span><input class="input" :value="conf.user" @input="set('user', $event.target.value)" /></label>
    </div>
    <label class="form-field"><span class="form-label">远端目录</span><input class="input" :value="conf.remoteDir" @input="set('remoteDir', $event.target.value)" /></label>
    <label class="form-field"><span class="form-label">文件名</span><input class="input" :value="conf.fileName" @input="set('fileName', $event.target.value)" /></label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">编码</span><input class="input" :value="conf.encoding" @input="set('encoding', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">加密</span><input class="input" :value="conf.encrypt" @input="set('encrypt', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">投递后</span><input class="input" :value="conf.afterPut" @input="set('afterPut', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">重试</span><input class="input" type="number" :value="conf.retry" @input="set('retry', Number($event.target.value))" /></label>
    </div>
  </template>

  <!-- ===== sink_rdb ===== -->
  <template v-else-if="type === 'sink_rdb'">
    <div class="sec-title">关系库出湖</div>
    <label class="form-field">
      <span class="form-label">绑定数据源</span>
      <select class="select" :value="conf.dsId || ''" @change="onBindDs($event.target.value)">
        <option value="">— 暂不绑定 —</option>
        <option v-for="o in dsOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">库类型</span><select class="select" :value="conf.dbType" @change="set('dbType', $event.target.value)"><option v-for="t in DB_TYPES" :key="t" :value="t">{{ t }}</option></select></label>
      <label class="form-field"><span class="form-label">写入模式</span><select class="select" :value="conf.writeMode" @change="set('writeMode', $event.target.value)"><option>replace</option><option>insert</option><option>update</option><option>upsert</option></select></label>
    </div>
    <label class="form-field">
      <span class="form-label">目标表</span>
      <SearchSelect :model-value="conf.table || ''" :options="tableOptions" allow-custom @update:model-value="(v) => set('table', v)" />
    </label>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">批次大小</span><input class="input" type="number" :value="conf.batchSize" @input="set('batchSize', Number($event.target.value))" /></label>
    </div>
    <label class="form-field"><span class="form-label">Pre SQL</span><textarea class="textarea mono" rows="2" :value="conf.preSql" @input="set('preSql', $event.target.value)" /></label>
    <label class="form-field"><span class="form-label">Post SQL</span><textarea class="textarea mono" rows="2" :value="conf.postSql" @input="set('postSql', $event.target.value)" /></label>
  </template>

  <!-- ===== sink_search ===== -->
  <template v-else-if="type === 'sink_search'">
    <div class="sec-title">搜索引擎</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">引擎类型</span><select class="select" :value="conf.engineType || 'Elasticsearch'" @change="set('engineType', $event.target.value)"><option>Elasticsearch</option><option>OpenSearch</option><option>Solr</option></select></label>
      <label class="form-field"><span class="form-label">Index</span><input class="input" :value="conf.index" @input="set('index', $event.target.value)" /></label>
    </div>
    <div class="form-hint">写出运行时继承任务主引擎，无需在节点重复选择。</div>
  </template>

  <!-- ===== sink_bi ===== -->
  <template v-else-if="type === 'sink_bi'">
    <div class="sec-title">BI 推送</div>
    <div class="form-grid-2">
      <label class="form-field"><span class="form-label">看板目标</span><input class="input" :value="conf.target" @input="set('target', $event.target.value)" /></label>
      <label class="form-field"><span class="form-label">刷新周期</span><input class="input" :value="conf.refresh" @input="set('refresh', $event.target.value)" /></label>
    </div>
  </template>

  <div v-else class="form-hint">该节点类型暂无额外参数</div>
</template>

<style scoped>
.sec-title {
  margin: 14px 0 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border, #e5e7eb);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3, #8c8c8c);
  letter-spacing: 0.02em;
}
.sec-title:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}
.chk-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-2, #f7f8fa);
}
.chk-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
