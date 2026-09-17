/** 根因分析台 · 对齐演示 HTML page-rootcause */

export const RC_ALERT_OPTIONS = [
  { value: 'ads_gmv', label: 'ads_gmv_board 对账失败 · 14分钟前' },
  { value: 'dwd_quality', label: 'dwd_order_detail 质量分骤降 · 32分钟前' },
  { value: 'flink_lag', label: 'Flink CDC Lag 超阈值 · 2小时前' },
]

/**
 * steps 3/4 = alert；step 5 = conclusion（warning 高亮）
 * content 保留演示 HTML 换行，用数组渲染 <br>
 */
export const RC_STEPS = [
  {
    num: 1,
    title: '夜莺告警触发',
    content: [
      'ads_gmv_board 质量分 68 < 80 阈值',
      '对账 Iceberg vs CK 差异 0.15%',
      '摘牌黄金 · Superset 看板红底',
    ],
  },
  {
    num: 2,
    title: '血缘向上追溯',
    content: [
      'ads_gmv_board',
      '← dws_order_1d',
      '← dwd_order_detail',
      '← ods_trade.s_order',
    ],
  },
  {
    num: 3,
    title: '任务 × 质量叠加',
    alert: true,
    contentTone: 'danger',
    content: [
      '⚠ DS dag.trade_dwd 失败重试2次',
      'dwd 主键重复 1.2%',
      '规则 PK_UNIQUE 失败',
      '→ DAG 阻断下游',
    ],
  },
  {
    num: 4,
    title: '组件监控叠加',
    alert: true,
    contentTone: 'danger',
    content: [
      '⚠ Flink CDC cdc.trade.order',
      'Kafka Lag 12.5万条 ≈ 12min',
      '源库 09-03 00:00~02:00',
      'binlog 发送抖动',
    ],
  },
  {
    num: 5,
    title: '结论 & 动作',
    conclusion: true,
    contentBold: true,
    content: [
      '✅ 根因确认：源 CDC 延迟 + DWD 未严格去重',
      '动作1：DS 指定 dt 补数重跑 dwd',
      '动作2：源库 DBA 查 binlog 策略',
      '动作3：工单挂表 owner 李明',
    ],
  },
]

export const RC_EVIDENCE = [
  {
    layer: 'ADS',
    layerTag: 'tag-red',
    object: 'ads_gmv_board',
    symptom: '对账失败 · 黄金摘牌',
    metric: '行数差 1,248 · 金额差 ¥4.2万',
    metricTone: 'danger',
    sla: '差 < 0.1% or 0',
    actionLabel: '对账详情 →',
    action: { type: 'route', path: '/ops' },
    rowTone: 'danger',
  },
  {
    layer: 'DWS',
    layerTag: 'tag-orange',
    object: 'dws_order_1d (dt=09-02)',
    symptom: '未产出（被上游阻断）',
    metric: '任务状态 BLOCKED',
    metricTone: 'danger',
    sla: 'T+1 06:00 前',
    actionLabel: 'DS DAG →',
    action: { type: 'route', path: '/ops' },
    rowTone: 'danger',
  },
  {
    layer: 'DWD',
    layerTag: 'tag-red',
    object: 'dwd_order_detail',
    symptom: '主键重复 1.2% · 质量门禁失败',
    metric: 'PK_UNIQUE fail 12,842 行',
    metricTone: 'danger',
    sla: '0 行 · 质量 ≥ 95',
    actionLabel: '质量详情 →',
    action: { type: 'route', path: '/quality' },
    rowTone: 'danger',
  },
  {
    layer: 'ODS',
    layerTag: 'tag-blue',
    object: 'ods_trade.s_order',
    symptom: '乱序行增多 · 存在延迟数据',
    metric: '迟到事件占比 4.8%',
    metricTone: 'warning',
    sla: '< 1%',
    actionLabel: '资产详情 →',
    action: { type: 'route', path: '/catalog', query: { q: 'ods_order' } },
    rowTone: 'warning',
  },
  {
    layer: 'Flink',
    layerTag: 'tag-purple',
    object: 'cdc.trade.order 作业',
    symptom: 'Kafka consumer Lag 持续',
    metric: 'Lag 125,482 条',
    metricTone: 'warning',
    sla: '< 5,000',
    actionLabel: 'Flink 详情 →',
    action: { type: 'route', path: '/ops' },
    rowTone: 'warning',
  },
  {
    layer: '源',
    layerTag: 'tag-gray',
    object: 'MySQL order_prod 主库',
    symptom: '09-03 凌晨大事务',
    metric: 'binlog 峰值 180MB/s',
    metricTone: 'muted',
    sla: '正常 < 80MB/s',
    actionLabel: '通知源 DBA →',
    action: {
      type: 'toast',
      message: '通知源 DBA · MySQL order_prod 主库·大事务',
      level: 'info',
    },
    rowTone: 'muted',
  },
]

export const RC_ACTIONS = [
  {
    id: 'supplement',
    tone: 'primary',
    title: '🔧 建议 1：补数重跑 dwd → dws → ads',
    body: '选择分区 dt=2026-09-02，按血缘下游顺序重跑 dag.trade_dwd → dag.trade_dws → 导入 CK → 重新对账。预计耗时 1.5h。',
    btnText: '一键提交补数 DAG',
    btnClass: 'btn-primary',
    toast: '🔧 补数 DAG 已提交 · dt=2026-09-02 · dwd→dws→ads',
    toastLevel: 'success',
  },
  {
    id: 'binlog',
    tone: 'warning',
    title: '🔧 建议 2：源库侧排查 binlog',
    body: '00:15~02:08 期间 binlog 发送异常。建议 DBA 检查：① 大事务批量 UPDATE 订单状态 ② 主从延迟 ③ 是否有归档作业。',
    btnText: '派发工单给源 DBA',
    btnClass: '',
    toast: '📋 派发 ITSM 工单 · 通知源库 DBA 排查 binlog',
    toastLevel: 'info',
  },
  {
    id: 'degrade',
    tone: 'success',
    title: '🔧 建议 3：临时降级看板查询',
    body: 'ADS 被摘牌期间，GMV 核心看板可切换到「Trino 扫 Iceberg」模式，查询延迟增加 8~15 秒但数据准确。',
    btnText: '切换到 Iceberg 降级源',
    btnClass: 'btn-success',
    toast: '切换降级源 · 3 张核心 GMV 看板 → Iceberg 降级',
    toastLevel: 'success',
  },
]

export const RC_LONG_TERM = [
  'DWD 层补 watermark + 严格去重策略（当前 upsert 不幂等）',
  'Flink CDC 作业加反压阈值告警 & 自动扩并行度',
  '源库大事务窗口：提前发通知，避免凌晨 0~3 点大更',
  'ODS 增加 CDC 删除传播测试：源 DELETE → 全链路闭链验证',
]
