/** 数据安全与权限中心 · 对齐演示 HTML */

export const SEC_KPIS = [
  { icon: '👥', color: 'blue', label: '平台用户', value: '184', unit: '人', trend: '↑ 9 人本月新增', trendUp: true },
  { icon: '🔐', color: 'purple', label: '活跃授权策略', value: '428', unit: '条', trend: '↑ 27 条', trendUp: true },
  { icon: '🚫', color: 'orange', label: '敏感列数', value: '216', unit: '列', trend: '↓ 0.3% 占比下降', trendUp: false },
  { icon: '📜', color: 'green', label: '审计日志(日)', value: '12.4K', unit: '条', trend: '↑ 8.2%', trendUp: true },
]

export const SEC_CLASSIFICATION = [
  { label: '公开', tagCls: 'tag-gray', pct: 33, count: 62, bar: '#bfbfbf' },
  { label: '内部', tagCls: 'tag-blue', pct: 42, count: 78, bar: 'var(--primary)' },
  { label: '敏感', tagCls: 'tag-orange', pct: 19, count: 36, bar: 'var(--warning)' },
  { label: '机密', tagCls: 'tag-red', pct: 5.4, count: 10, bar: 'var(--danger)' },
]

export const SEC_IRON_RULES = [
  '人（分析师/BI/JDBC）一律走 Trino，禁止直连 ClickHouse、MinIO',
  'ClickHouse 9000/8123 端口只对平台作业 SA 开放（Flink Sink、DS 导入、对账）',
  '人永不持有 Iceberg 写权限，写库只给作业服务账号',
  '「目录可见」≠「引擎可查」，机密资产默认可搜摘要、不可预览样本',
]

export const SEC_MASK_POLICIES = [
  { name: '手机号脱敏', cols: '*mobile* *phone*', algo: '保留前3后4 → 138****5678', exempt: '安全审计岗', status: '生效' },
  { name: '身份证哈希', cols: '*id_card*', algo: 'SHA-256 + 盐', exempt: '公安合规岗', status: '生效' },
  { name: '邮箱掩蔽', cols: '*email*', algo: '保留首字符 → z***@xx.com', exempt: '—', status: '生效' },
  { name: '金额区间化', cols: '敏感金额列', algo: '按角色：明文 / 万元级 / 模糊', exempt: '财务分析师', status: '生效' },
  { name: '姓名脱敏', cols: '*name* real_name', algo: '张** · 保留姓氏', exempt: '客服岗', status: '生效' },
  { name: '地址截断', cols: 'address', algo: '保留到区县级', exempt: '—', status: '生效' },
]

export const SEC_AUDIT_LOG = [
  {
    risk: '高',
    riskCls: 'tag-red',
    time: '09-03 14:22',
    user: '王芳(分析师)',
    action: 'SELECT 全表扫',
    target: 'ods_trade.s_order (无分区过滤)',
    targetDanger: true,
    result: '扫描 128GB · 已阻断',
    resultDanger: true,
    source: 'Trino',
    sourceCls: 'tag-blue',
  },
  {
    risk: '中',
    riskCls: 'tag-orange',
    time: '09-03 13:51',
    user: 'job.trade.ods_writer(SA)',
    action: 'Iceberg WRITE',
    target: 'iceberg.ods_trade.s_order dt=2026-09-03',
    result: '写入 386MB · 成功',
    source: 'Flink',
    sourceCls: 'tag-purple',
  },
  {
    risk: '中',
    riskCls: 'tag-orange',
    time: '09-03 12:07',
    user: '刘强(分析师)',
    action: '导出 CSV',
    target: 'dwd_trade.dwd_order_detail',
    result: '导出 12 万行 · 静态脱敏',
    source: '门户',
    sourceCls: 'tag-gray',
  },
  {
    risk: '低',
    riskCls: 'tag-blue',
    time: '09-03 11:40',
    user: '李明(治理)',
    action: '授予列权限',
    target: 'dwd_user.dwd_user_info.mobile → 分析师组',
    result: '有效期 30 天 · 需审批',
    source: 'Gravitino',
    sourceCls: 'tag-blue',
  },
  {
    risk: '高',
    riskCls: 'tag-red',
    time: '09-03 10:12',
    user: '未知IP 10.x.x.243',
    userBold: true,
    action: '直连 CK 尝试',
    target: 'ClickHouse ads_gmv_board',
    result: '已被防火墙拒绝',
    resultDanger: true,
    source: '安全组',
    sourceCls: 'tag-red',
  },
  {
    risk: '低',
    riskCls: 'tag-blue',
    time: '09-03 09:08',
    user: '张明(治理)',
    action: '修改脱敏策略',
    target: '手机号脱敏策略变更',
    result: '豁免角色添加安全审计岗',
    source: '门户',
    sourceCls: 'tag-gray',
  },
]

export const SEC_SERVICE_ACCOUNTS = [
  { name: 'job.trade.ods_writer', job: 'Flink cdc.trade.order', scope: 'Iceberg 写 ods_trade', cred: 'Vault ✓', status: '活跃', statusCls: 'tag-green' },
  { name: 'job.trade.dwd_build', job: 'DS dag.trade_dwd', scope: 'Iceberg 写 dwd_trade', cred: 'Vault ✓', status: '活跃', statusCls: 'tag-green' },
  { name: 'job.ck.sync', job: 'DS job.ck.sync.gmv', scope: 'CK 写 ads', cred: 'Vault ✓', status: '活跃', statusCls: 'tag-green' },
  { name: 'job.user.ods_writer', job: 'Flink cdc.user.info', scope: 'Iceberg 写 ods_user', cred: 'Vault ✓', status: '活跃', statusCls: 'tag-green' },
  { name: 'job.reconcile', job: 'DS job.reconcile.*', scope: 'Iceberg 读 + CK 读写', cred: 'Vault ✓', status: '活跃', statusCls: 'tag-green' },
  { name: 'job.trade.ods_old', job: '—（已下线）', scope: '—', cred: '已回收', status: '已回收', statusCls: 'tag-gray' },
]

export const SEC_VAULT_ROTATION = [
  { type: '数据库密码', cycle: '30 天', last: '08-05', remain: '3 天', remainWarn: true, status: '将到期', statusCls: 'tag-orange' },
  { type: 'Kafka SASL', cycle: '90 天', last: '06-10', remain: '5 天', remainWarn: true, status: '将到期', statusCls: 'tag-orange' },
  { type: 'MinIO AK/SK', cycle: 'STS 12h', last: '09-03 13:00', remain: '11h', status: '✓', statusCls: 'tag-green' },
  { type: 'CK 用户密码', cycle: '30 天', last: '08-20', remain: '17 天', status: '✓', statusCls: 'tag-green' },
  { type: 'API Token', cycle: '按申请单', last: '—', remain: '—', status: 'N/A', statusCls: 'tag-gray' },
]

export const SEC_PATH_ALLOW = [
  { icon: '👤', title: '人（OIDC）', sub: '分析师/BI/JDBC' },
  { icon: '🚪', title: '统一门户 SSO', sub: '' },
  { icon: '🔍', title: 'Trino', sub: 'Gravitino 裁决 + 动态脱敏' },
  { icon: '🧊', title: 'Iceberg / 联邦外部源', sub: '' },
]

export const SEC_PATH_FORBID = [
  { icon: '👤', title: '人', sub: '→ 直连 CK 9000/8123' },
  { icon: '👤', title: '人', sub: '→ 直连 MinIO 9000' },
  { icon: '⚙️', title: '作业', sub: '→ 用个人账号写湖' },
  { icon: '🔑', title: 'SA', sub: '→ 持有人类 OIDC Token' },
]
