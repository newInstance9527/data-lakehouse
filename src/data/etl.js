/** ETL 编排 · 算子类型与演示任务 */

export const NODE_TYPES = {
  source: { label: 'CDC / 库表', group: 'source', cls: 'nt-source', color: '#1890ff', ports: ['out'] },
  source_api: { label: 'API 抽取', group: 'source', cls: 'nt-source', color: '#13c2c2', ports: ['out'] },
  source_file: { label: '文件 / FTP', group: 'source', cls: 'nt-source', color: '#fa8c16', ports: ['out'] },
  clean: { label: '清洗规则', group: 'process', cls: 'nt-clean', color: '#52c41a', ports: ['in', 'out'] },
  transform: { label: '转换 / SQL', group: 'process', cls: 'nt-transform', color: '#1890ff', ports: ['in', 'out'] },
  mapping: { label: '字段映射', group: 'process', cls: 'nt-mapping', color: '#722ed1', ports: ['in', 'out'] },
  quality: { label: '质量门禁', group: 'control', cls: 'nt-quality', color: '#f5222d', ports: ['in', 'out'] },
  parallel: { label: '并行分支', group: 'control', cls: 'nt-parallel', color: '#fa8c16', ports: ['in', 'out'] },
  condition: { label: '条件分支', group: 'control', cls: 'nt-condition', color: '#1890ff', ports: ['in', 'out'] },
  union: { label: '合并 UNION', group: 'control', cls: 'nt-union', color: '#8c8c8c', ports: ['in', 'out'] },
  sink_iceberg: { label: 'Iceberg', group: 'sink', cls: 'nt-sink', color: '#1890ff', ports: ['in'] },
  sink_ck: { label: 'ClickHouse', group: 'sink', cls: 'nt-sink', color: '#fa8c16', ports: ['in'] },
  sink_kafka: { label: 'Kafka', group: 'sink', cls: 'nt-sink', color: '#595959', ports: ['in'] },
  sink_object: { label: '对象存储', group: 'sink', cls: 'nt-sink', color: '#13c2c2', ports: ['in'] },
  sink_ftp: { label: 'FTP/SFTP', group: 'sink', cls: 'nt-sink', color: '#fa8c16', ports: ['in'] },
  sink_rdb: { label: '关系库', group: 'sink', cls: 'nt-sink', color: '#52c41a', ports: ['in'] },
  sink_search: { label: '搜索引擎', group: 'sink', cls: 'nt-sink', color: '#f5222d', ports: ['in'] },
  sink_bi: { label: 'BI / 出湖', group: 'sink', cls: 'nt-sink', color: '#722ed1', ports: ['in'] },
}

export const NODE_GROUPS = [
  { key: 'source', label: '数据源' },
  { key: 'process', label: '清洗转换' },
  { key: 'control', label: '控制' },
  { key: 'sink', label: '目标 / 出湖' },
]

export const NODE_ICONS = {
  source: '▣',
  source_api: '🌐',
  source_file: '📁',
  clean: '✓',
  transform: '⇄',
  mapping: '⇨',
  quality: '🛡',
  parallel: '⫿',
  condition: '◇',
  union: '⊔',
  sink_iceberg: '❄',
  sink_ck: '⚡',
  sink_kafka: 'K',
  sink_object: '🪣',
  sink_ftp: '📂',
  sink_rdb: '🗄',
  sink_search: '🔎',
  sink_bi: '📊',
}

export const ENGINES = ['flink', 'spark', 'datax']

export const CRON_PRESETS = [
  { value: '0 2 * * *', label: '每天 02:00' },
  { value: '0 */1 * * *', label: '每小时' },
  { value: '0 0 * * 1', label: '每周一 00:00' },
  { value: '0 4 1 * *', label: '每月 1 日 04:00' },
  { value: 'custom', label: '自定义…' },
]

export const SOURCE_MODES = [
  { value: 'cdc', label: 'CDC 增量' },
  { value: 'batch', label: 'Batch 全量' },
  { value: 'incremental', label: '水位增量' },
]

export const HTTP_METHODS = ['GET', 'POST']
export const FILE_FORMATS = ['parquet', 'csv', 'json', 'orc', 'avro']
export const COMPRESSIONS = ['zstd', 'snappy', 'gzip', 'none']
export const WRITE_MODES = [
  { value: 'append', label: '追加 append' },
  { value: 'overwrite', label: '覆盖 overwrite' },
  { value: 'upsert', label: 'Upsert' },
]
export const PARTITIONS = ['dt', 'dt,hour', 'month', 'none']
export const CLEAN_RULES = [
  'PK_UNIQUE',
  'NULL_CHECK',
  'TYPE_CHECK',
  '精度2位',
  '字典标准化',
  '去重',
  '时区统一',
]
export const MASK_COLS = [
  'buyer_mobile',
  'user_mobile',
  'buyer_id_card',
  'id_card_no',
  'buyer_real_name',
  'email',
]
export const QUALITY_RULES = [
  'PK_UNIQUE',
  'NULL_CHECK',
  '行数对账',
  '金额对账',
  '码值合规',
  '波动检测',
]
export const MAPPING_STRATEGIES = [
  '直接映射',
  '码值 CASE',
  '码值映射表',
  '单位换算(分→元)',
  '脱敏后映射',
  '自定义表达式',
]
export const SQL_TEMPLATES = [
  { value: 'passthrough', label: '透传 SELECT *', sql: 'SELECT * FROM ${input}' },
  { value: 'daily_agg', label: '按日汇总', sql: 'SELECT dt, COUNT(1) AS cnt, SUM(pay_amt) AS gmv\nFROM ${input}\nGROUP BY dt' },
  { value: 'dedup', label: '按主键去重', sql: 'SELECT * FROM (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY ${pk} ORDER BY gmt_modified DESC) rn\n  FROM ${input}\n) t WHERE rn = 1' },
  { value: 'custom', label: '自定义 SQL', sql: '' },
]
export const CONDITION_PRESETS = [
  { value: 'row_count > 0', label: '有数据才继续' },
  { value: 'error_count == 0', label: '无错误才继续' },
  { value: 'lag_min < 30', label: '延迟 < 30 分钟' },
  { value: 'custom', label: '自定义表达式' },
]
export const UNION_MODES = [
  { value: 'union_all', label: 'UNION ALL' },
  { value: 'union', label: 'UNION 去重' },
]
export const FTP_PROTOCOLS = ['SFTP', 'FTP']
export const FTP_AFTER = [
  { value: 'none', label: '无动作' },
  { value: 'done', label: '写 .done 标记' },
  { value: 'delete', label: '删除源文件' },
  { value: 'archive', label: '移至 archive' },
]
export const SEARCH_ENGINES = ['Elasticsearch', 'OpenSearch']
export const BI_TARGETS = [
  'Superset GMV Board',
  'Superset User Profile',
  'Metabase Finance',
  '自定义看板',
]
export const BI_REFRESH = ['1min', '5min', '15min', '1h', '手动']
export const OBJECT_BUCKETS = ['lake-landing', 'lake-export', 'lake-archive', 'lake-tmp']
export const KAFKA_TOPICS = [
  'topic_trade_order_paid',
  'topic_trade_order_refund',
  'topic_user_profile_upsert',
  'topic_dq_alert',
]
export const RETRY_OPTIONS = [0, 1, 2, 3, 5]
export const PARALLEL_OPTIONS = [2, 3, 4, 8]

export const TASK_STATUS_META = {
  prod: { label: '已发布', tag: 'tag-green' },
  draft: { label: '草稿', tag: 'tag-gray' },
  paused: { label: '已暂停', tag: 'tag-orange' },
}

export const NODE_STATUS_META = {
  done: { label: '成功', color: '#52c41a' },
  running: { label: '运行中', color: '#1890ff' },
  blocked: { label: '阻断', color: '#f5222d' },
  pending: { label: '等待', color: '#8c8c8c' },
  warn: { label: '告警', color: '#fa8c16' },
}

export function defaultConfFor(type) {
    switch(type){
      // ===== 数据源 1：数据库 CDC（MySQL/PostgreSQL/Oracle/MongoDB） =====
      case 'source':
        return {
          dsId:'', dbType:'MySQL', host:'', port:3306, username:'', password:'',
          database:'', table:'', src:'', tables:[], pk:'id', slotName:'',
          mode:'cdc', cdcEngine:'Flink CDC',
          startupMode:'latest-offset',
          snapshotPollSize:5000, serverTimeZone:'Asia/Shanghai',
          watermarkColumn:'', markKey:'',
          includeSchemaChange:false, ddlTolerance:'warn',
          sharding:false, shardCount:1,
          fetchSize:1024, connectTimeout:30, retry:3
        };
      // ===== 数据源 2：API 抽取（HTTP/REST） =====
      case 'source_api':
        return {
          dsId:'', baseUrl:'https://api.example.com/v1', path:'/orders', method:'GET',
          authType:'none', // none / basic / bearer / apikey / oauth2
          authUser:'', authPass:'', authToken:'', apiKey:'', apiKeyHeader:'X-API-Key',
          mode:'api_pull', contentType:'application/json',
          pagination:'page', // page / cursor / offset / none
          pageSize:200, startPage:1, cursorField:'next_cursor',
          rateLimitQps:10, timeout:30, retry:3, backoff:'exponential',
          headers:[{k:'Accept',v:'application/json'}],
          bodyTemplate:'', bodyExample:'',
          jsonPath:'$.data[*]', idField:'id', updatedAtField:'updated_at'
        };
      // ===== 数据源 3：文件上传（S3/HDFS/FTP/SFTP/本地） =====
      case 'source_file':
        return {
          dsId:'', storageType:'S3', // S3 / HDFS / FTP / SFTP / LOCAL
          endpoint:'s3.amazonaws.com', bucket:'lake-landing', accessKey:'',
          basePath:'/data/orders/2026/', filePattern:'*.csv.gz',
          mode:'upload',
          format:'csv', // csv / json / parquet / xlsx / xml
          delimiter:',', quoteChar:'"', escapeChar:'\\', headerLine:true, skipRows:0,
          encoding:'UTF-8', compression:'gzip', // none / gzip / snappy / zip
          schemaInfer:true, failOnCorrupt:true,
          writeMode:'append', fileName:'', multiLine:false
        };
      // ===== 清洗规则 =====
      case 'clean':
        return {
          preset:'STANDARD', // STANDARD / STRICT / LOOSE / CUSTOM
          // 全局：跨字段策略（去重等）
          dedup:true, dedupKeys:['id'], dedupKeep:'latest',
          // 按字段清洗：[{ field, ops:[], nullDefault, castType, lenMax, maskRule, regexPat, regexRep }]
          fieldRules:[],
          rules:{
            nullFill:true, nullFillStrategy:'default', nullDefaultValue:'',
            trimSpaces:true, toLowerCase:false,
            dedup:true, dedupKeys:['id'], dedupKeep:'latest',
            regexClean:[],
            typeCast:true, lenTrim:true, lenTrimMax:255,
            formatCheck:{email:true,phone:true,idcard:false,url:false},
            maskCols:[], maskRule:'mask_middle'
          }
        };
      // ===== 转换 / SQL =====
      case 'transform':
        return {
          engine:'spark', sql:'SELECT\n  id,\n  order_id,\n  user_id,\n  amount\nFROM source_table',
          dialect:'ansi', hint:'', engine_override:'', override_reason:'',
          retry:2, timeout:1800,
          resources:{queue:'default', driverCores:1, driverMem:'2g', executorNum:4, executorCores:2, executorMem:'4g'},
          udfList:[], tempViews:[],
          partitionBy:'dt', bucketNum:0,
          cacheLevel:'NONE',
          explain:false, broadcastHint:false
        };
      // ===== 字段映射 =====
      case 'mapping':
        return {
          strategy:'同名映射',
          stdRef:'', // 标准字段名，如 order_status
          codeSetId:'', // 标准码值集，如 STD-C0021（码值 CASE 时）
          castStringToVarchar:true,
          autoRename:'none', // none / under2camel / camel2under
          addPrefix:'', addSuffix:'',
          mapList:[
            {src:'order_id', dst:'order_id', type:'BIGINT', comment:'订单ID', skip:false, expr:''},
            {src:'user_id',  dst:'user_id',  type:'BIGINT', comment:'用户ID', skip:false, expr:''},
            {src:'amount',   dst:'pay_amt',  type:'DECIMAL(18,2)', comment:'支付金额', skip:false, expr:'amount/100'}
          ]
        };
      // ===== 质量门禁 =====
      case 'quality':
        return {
          ruleGroup:'',
          ruleIds:[],
          rules:[],
          threshold:0.01, blockOnFail:true,
          sampleRatio:1.0, maxRows:1000000,
          outputReport:false, reportTable:'dq_reports',
          alertOwner:true, alertDing:false
        };
      // ===== 并行分支 =====
      case 'parallel':
        return {
          parallelism:3,
          mode:'dag_fanout', // dag_fanout | row_shard
          strategy:'hash',
          shardKey:'user_id',
          maxWaitMs:30000, failFast:false,
          branchLabels:['A','B','C'],
        };
      // ===== 条件分支 =====
      case 'condition':
        return {
          cond:'amount > 1000',
          branches:[
            {label:'大额订单 (IF)',   expr:'amount > 1000', targetPort:'out1'},
            {label:'中额订单 (ELIF)', expr:'amount > 100',  targetPort:'out2'},
            {label:'小额订单 (ELSE)', expr:'1=1',            targetPort:'out3'}
          ],
          defaultBranch:'branch3', // fail / pass / branchN
          evalOncePerRow:true,
          nullHandling:'as_false' // as_false / as_true / exception
        };
      // ===== 合并 / UNION =====
      case 'union':
        return {
          strategy:'UNION ALL', // UNION ALL / UNION DISTINCT / INTERSECT / EXCEPT
          inputCount:2,
          autoAlignColumns:true,
          missingColumnFill:'null', // null / default / drop_row
          typeConflictPolicy:'wider_cast', // wider_cast / error / drop_row
          dedupAfter:false, dedupKeys:[],
          allowEmptyBranch:true
        };
      // ===== Iceberg 入湖 =====
      case 'sink_iceberg':
        return {
          catalog:'iceberg', database:'ods', table:'',
          warehouse:'s3a://warehouse/',
          partition:'', partitionTransform:'day', // identity / year / month / day / hour / bucket[N]
          writeMode:'append', // append / overwrite / upsert / cdc
          pk:'', mergeOnRead:false,
          formatVersion:2, compression:'zstd',
          fileSizeMb:128,
          autoCreate:'off', // off / if_not_exists / fail_if_missing
          schemaFrom:'upstream', // upstream / mapping / explicit
          registerAfterCreate:true,
          saRole:'',
          icebergProps:{
            'write.distribution-mode':'hash',
            'write.parquet.compression-codec':'zstd',
            'engine.hive.enabled':'true'
          },
          enableExpire:false, expireDays:180,
          enableCompact:false, compactTargetMb:256,
          enableVacuum:false, vacuumRetainDays:7
        };
      // ===== ClickHouse =====
      case 'sink_ck':
        return {
          cluster:'default', database:'ads', table:'ads_gmv_board',
          engine:'ReplacingMergeTree', engineVerCol:'ts',
          orderBy:'(stat_date, region, sku_id)',
          partitionBy:'toYYYYMM(stat_date)',
          primaryKey:'(stat_date, region, sku_id)',
          autoCreate:'off',
          schemaFrom:'upstream',
          registerAfterCreate:true,
          saRole:'job.trade.ads_ck_writer',
          ttlDays:180,
          settings:{
            'insert_quorum':'auto',
            'insert_quorum_parallel':'1',
            'async_insert':'1'
          },
          ttlExpression:'stat_date + INTERVAL 365 DAY',
          shardingKey:'rand()', replication:true,
          flushIntervalMs:5000, batchSize:10000
        };
      // ===== Kafka =====
      case 'sink_kafka':
        return {
          bootstrap:'kafka-1:9092,kafka-2:9092,kafka-3:9092',
          topic:'dwd.order_detail.cdc.v1',
          keyField:'id', keySerializer:'String',
          valueFormat:'JSON', valueSchema:'',
          acks:'all', compression:'lz4',
          partitioner:'murmur2',
          lingerMs:20, batchSize:16384, bufferMem:67108864,
          enableIdempotence:true, retries:3,
          transactional:false, transactionIdPrefix:''
        };
      // ===== 对象存储（落地/归档） =====
      case 'sink_object':
        return {
          dsId:'', storageType:'S3', endpoint:'minio.corp.local', bucket:'lake-export',
          accessKey:'', region:'cn-north-1', secure:true,
          basePath:'ods/file_landing/dt=${bizdate}/', fileNamePattern:'part-*.parquet',
          format:'parquet', compression:'zstd', writeMode:'overwrite', partitionBy:'dt',
          engine:'spark', acl:'private', overwritePartition:true
        };
      // ===== FTP/SFTP 出湖 =====
      case 'sink_ftp':
        return {
          dsId:'', protocol:'SFTP', host:'sftp.bank.cn', port:22, user:'bank_user_01',
          remoteDir:'/outbox/daily/', fileName:'ads_gmv_${bizdate}.csv',
          encoding:'UTF-8', delimiter:',', headerLine:true,
          encrypt:'PGP', encryptKeyPath:'vault://keys/bank.pgp.pub',
          engine:'datax', afterPut:'rename .ok', retry:3, timeout:60,
          ticketNo:'', // 出湖申请单号（合规必填）
        };
      // ===== 关系库出湖 =====
      case 'sink_rdb':
        return {
          dsId:'', dbType:'MySQL', table:'bi_db.ads_gmv_board', writeMode:'replace',
          batchSize:1000, preSql:'DELETE FROM ${table} WHERE dt=${bizdate}', postSql:'',
          columnMap:'*', engine:'datax', saRole:'job.ads_out_writer', truncateBefore:false,
          autoCreate:'off', schemaFrom:'upstream', registerAfterCreate:false, pk:'',
          ticketNo:'',
        };
      // ===== 搜索引擎出湖 =====
      case 'sink_search':
        return {
          dsId:'', engineType:'Elasticsearch', hosts:'https://es-search-cluster:9200',
          index:'search_goods', idField:'sku_id', writeMode:'upsert', bulkSize:2000,
          refreshInterval:'30s', engine:'spark', pipeline:'', dropNull:true
        };
      // ===== BI / 出湖 =====
      case 'sink_bi':
        return {
          targetSystem:'Superset', // Superset / FineBI / Tableau / 飞书多维表格 / MySQL出湖 / API推送
          target:'', // 兼容旧字段
          workspace:'gmv-board', dataset:'ads_gmv_daily',
          refreshMode:'incremental', // full / incremental / streaming
          refreshCron:'0 */2 * * *',
          refresh:'',
          authType:'token', endpoint:'https://bi.example.com/api/', token:'',
          mappings:[{src:'stat_date', dst:'统计日期'},{src:'gmv',dst:'GMV'}],
          notifyOwnerOnFinish:true,
          exportPath:'s3://lake-export/gmv/', exportFormat:'xlsx',
          ticketNo:'',
        };
      default: return {};
    }
}

/** 浅合并默认 conf，补齐迁移前参数（保留已有值） */
export function mergeConfDefaults(type, conf = {}) {
  const def = defaultConfFor(type) || {}
  const out = { ...def, ...(conf || {}) }
  Object.keys(def).forEach((k) => {
    if (out[k] === undefined) out[k] = def[k]
    const d = def[k]
    const c = conf?.[k]
    if (d && typeof d === 'object' && !Array.isArray(d) && c && typeof c === 'object' && !Array.isArray(c)) {
      out[k] = { ...d, ...c }
      if (d.formatCheck && typeof d.formatCheck === 'object') {
        out[k].formatCheck = { ...d.formatCheck, ...(c.formatCheck || {}) }
      }
    }
  })
  // 兼容旧字段 + 单表约定：table/src 为准，tables 仅作长度 0/1 兼容镜像
  if (out.src && !out.table) out.table = out.src
  if (out.table && !out.src) out.src = out.table
  if (typeof out.tables === 'string') {
    out.tables = out.tables.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  }
  if (!out.table && Array.isArray(out.tables) && out.tables.length) {
    out.table = out.tables[0]
    out.src = out.tables[0]
  }
  // 强制单表：多表历史配置只保留第一张
  if (out.table || out.src) {
    const one = out.table || out.src
    out.table = one
    out.src = one
    out.tables = [one]
  } else {
    out.tables = []
  }
  // sink 自动建表默认值
  if (['sink_iceberg', 'sink_ck', 'sink_rdb'].includes(type)) {
    if (!out.autoCreate) out.autoCreate = 'off'
    if (!out.schemaFrom) out.schemaFrom = 'upstream'
    if (out.registerAfterCreate == null) out.registerAfterCreate = type !== 'sink_rdb'
  }
  if (out.fieldMaps && !out.mapList) out.mapList = out.fieldMaps
  if (out.mapList && !out.fieldMaps) out.fieldMaps = out.mapList.map(m => ({ src: m.src, dst: m.dst, transform: m.expr || m.transform || '直接映射' }))
  // 清洗：旧 maskCols / 全局 rules → fieldRules
  if (!Array.isArray(out.fieldRules)) out.fieldRules = []
  if (!out.fieldRules.length && Array.isArray(out.rules?.maskCols) && out.rules.maskCols.length) {
    out.fieldRules = out.rules.maskCols.map((f) => ({
      field: f,
      ops: ['mask', 'trim'],
      maskRule: out.rules.maskRule || 'mask_middle',
      nullDefault: '',
      castType: 'STRING',
      lenMax: out.rules.lenTrimMax || 255,
      regexPat: '',
      regexRep: '',
    }))
  }
  if (Array.isArray(out.maskCols) && out.maskCols.length && !out.fieldRules.length) {
    out.fieldRules = out.maskCols.map((f) => ({
      field: f,
      ops: ['mask', 'trim'],
      maskRule: 'mask_middle',
      nullDefault: '',
      castType: 'STRING',
      lenMax: 255,
      regexPat: '',
      regexRep: '',
    }))
  }
  return out
}

/** 演示 DAG 种子已下线（X+）；任务列表只读门户 /lh/etl */

export function uid(prefix = 'n') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
