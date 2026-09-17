/** 工作空间 · 对齐演示 HTML WORKSPACES / WS_QUOTA */

export const WS_KPIS = [
  { label: '工作空间总数', value: '12', unit: '个', delta: '跨 9 业务域', deltaCls: '' },
  { label: '当前空间资产', value: '42', unit: '张', delta: '质量≥95 共 28', deltaCls: 'success' },
  { label: '成员', value: '28', unit: '人', delta: 'Owner 4 · DEV 12 · Analyst 12', deltaCls: '' },
  { label: 'Trino 资源组', value: 'rg_trade', unit: '', delta: 'CPU 72% · 内存 68%', deltaCls: 'warn' },
]

export const WORKSPACES = [
  {
    id: 'ws_trade',
    name: '交易域工作空间',
    icon: '🛒',
    desc: '交易订单/支付/退款全链路 · 含 dwd_order_detail 等核心资产',
    members: 18,
    tables: 42,
    owner: '李明',
    owners: '李明 · 张涛',
    catalog: 'iceberg_trade',
    gravitino: 'lakehouse.trade',
    icebergDb: 'iceberg.dwd_trade',
    minio: 's3a://lakehouse/trade/',
    createdAt: '2025-10-08',
    tags: [
      { text: '含敏感数据', cls: 'tag-orange' },
      { text: '核心域', cls: 'tag-blue' },
    ],
    detail:
      '交易域统一工作空间，承载 ODS→DWD→DWS→ADS 全链路加工资产，GMV / 订单 / 履约 / 退款 主题全部归属于此空间。',
    current: true,
    storage: { used: 1.8, quota: 8 },
    cu: { used: 1200, quota: 2000 },
    domain: '交易',
    role: 'Owner',
    rg: 'rg_trade',
  },
  {
    id: 'ws_user',
    name: '用户域工作空间',
    icon: '👤',
    desc: '用户画像/标签/行为 · 含 dwd_user_info（PII 脱敏）',
    members: 9,
    tables: 28,
    owner: '王欢',
    owners: '王欢',
    catalog: 'iceberg_user',
    gravitino: 'lakehouse.user',
    icebergDb: 'iceberg.dwd_user',
    minio: 's3a://lakehouse/user/',
    createdAt: '2025-11-02',
    tags: [
      { text: '含 PII', cls: 'tag-orange' },
      { text: '脱敏默认', cls: 'tag-purple' },
    ],
    detail: '用户域画像与标签加工空间，默认列级脱敏；明文需安全岗二次审批。',
    current: false,
    storage: { used: 0.9, quota: 4 },
    cu: { used: 300, quota: 800 },
    domain: '用户',
    role: 'Owner',
    rg: 'rg_user',
  },
  {
    id: 'ws_goods',
    name: '商品域工作空间',
    icon: '📦',
    desc: '商品/库存/SKU 维度 · 含 dim_sku',
    members: 7,
    tables: 22,
    owner: '赵静',
    owners: '赵静',
    catalog: 'iceberg_goods',
    gravitino: 'lakehouse.goods',
    icebergDb: 'iceberg.dim_goods',
    minio: 's3a://lakehouse/goods/',
    createdAt: '2025-11-18',
    tags: [{ text: '维度域', cls: 'tag-blue' }],
    detail: '商品与库存维度统一空间，dim_sku 为黄金数据集，供交易/营销域复用。',
    current: false,
    storage: { used: 0.6, quota: 3 },
    cu: { used: 180, quota: 600 },
    domain: '商品',
    role: 'Owner',
    rg: 'rg_goods',
  },
  {
    id: 'ws_marketing',
    name: '营销域工作空间',
    icon: '📢',
    desc: '活动/优惠券/转化分析 · 消费交易域数据',
    members: 6,
    tables: 18,
    owner: '张涛',
    owners: '张涛',
    catalog: 'iceberg_mkt',
    gravitino: 'lakehouse.mkt',
    icebergDb: 'iceberg.ads_mkt',
    minio: 's3a://lakehouse/mkt/',
    createdAt: '2026-01-09',
    tags: [
      { text: '消费交易域', cls: 'tag-gray' },
      { text: '配额告警', cls: 'tag-orange' },
    ],
    detail: '营销分析空间，只读订阅交易域 ADS；存储接近配额上限，需归档或扩容。',
    current: false,
    storage: { used: 0.5, quota: 2 },
    cu: { used: 80, quota: 400 },
    domain: '营销',
    role: '业务方',
    rg: 'rg_mkt',
  },
  {
    id: 'ws_finance',
    name: '财务域工作空间',
    icon: '💰',
    desc: '对账/结算/财务报表 · 高敏感·强审计',
    members: 5,
    tables: 12,
    owner: '刘强',
    owners: '刘强 · 安全岗',
    catalog: 'iceberg_fin',
    gravitino: 'lakehouse.fin',
    icebergDb: 'iceberg.ads_fin',
    minio: 's3a://lakehouse/fin/',
    createdAt: '2025-12-20',
    tags: [
      { text: '高敏感', cls: 'tag-red' },
      { text: '强审计', cls: 'tag-orange' },
    ],
    detail: '财务对账与结算空间，访问全量审计；切换 Catalog 需二次确认。',
    current: false,
    storage: { used: 0.3, quota: 2 },
    cu: { used: 40, quota: 300 },
    domain: '财务',
    role: '安全岗',
    rg: 'rg_fin',
  },
  {
    id: 'ws_sandbox',
    name: '沙箱空间（归档）',
    icon: '🧪',
    desc: '临时实验/培训 · 自动清理 30 天',
    members: 3,
    tables: 8,
    owner: '陈晓',
    owners: '陈晓',
    catalog: 'iceberg_sbx',
    gravitino: 'lakehouse.sbx',
    icebergDb: 'iceberg.tmp_sbx',
    minio: 's3a://lakehouse/sbx/',
    createdAt: '2026-08-01',
    tags: [
      { text: '归档候选', cls: 'tag-gray' },
      { text: '30 天清理', cls: 'tag-orange' },
    ],
    detail: '实验与培训沙箱，资源配额最低；超过 30 天未访问自动归档清理。',
    current: false,
    storage: { used: 0.1, quota: 1 },
    cu: { used: 0, quota: 200 },
    domain: '实验',
    role: '运维',
    rg: 'rg_sbx',
  },
]

export const WS_QUOTA = [
  { ws: 'ws_trade', storage: '1.8/8 TB', sPct: 23, cu: '1200/2000', cPct: 60, trino: '12/20', api: '800/2000', status: 'ok' },
  { ws: 'ws_user', storage: '0.9/4 TB', sPct: 23, cu: '300/800', cPct: 38, trino: '6/10', api: '300/1000', status: 'ok' },
  { ws: 'ws_goods', storage: '0.6/3 TB', sPct: 20, cu: '180/600', cPct: 30, trino: '4/8', api: '200/800', status: 'ok' },
  { ws: 'ws_marketing', storage: '1.7/2 TB', sPct: 85, cu: '80/400', cPct: 20, trino: '3/5', api: '500/600', status: 'warn' },
  { ws: 'ws_finance', storage: '0.3/2 TB', sPct: 15, cu: '40/300', cPct: 13, trino: '2/5', api: '100/400', status: 'ok' },
  { ws: 'ws_sandbox', storage: '0.1/1 TB', sPct: 10, cu: '0/200', cPct: 0, trino: '1/3', api: '50/100', status: 'ok' },
]

export const WS_MEMBERS = {
  ws_trade: [
    { name: '🧑 李明 (LM)', role: 'Owner', roleCls: 'tag-green', scope: 'ALL + 明文凭据', last: '2026-09-03 10:42', action: 'audit' },
    { name: '🧑 张涛 (ZT)', role: 'Owner', roleCls: 'tag-green', scope: 'ALL + 明文凭据', last: '2026-09-03 09:12', action: 'audit' },
    { name: '👩 王芳 (WF)', role: 'Developer', roleCls: 'tag-blue', scope: '除 HR 敏感列外', last: '2026-09-03 08:37', action: 'remove' },
    { name: '👨 陈磊 (CL)', role: 'Developer', roleCls: 'tag-blue', scope: '只读 + DWD 可写', last: '2026-09-02 22:10', action: 'remove' },
    { name: '👩 赵敏 (ZM)', role: 'Analyst', roleCls: 'tag-orange', scope: 'ADS 只读 · 脱敏查看手机号', last: '2026-09-03 09:55', action: 'remove' },
    { name: '🤖 svc-dolphin (SA)', role: 'Service Account', roleCls: 'tag-gray', scope: '写 DWD/DWS · 全列明文', last: '2026-09-03 11:03', action: 'rotate' },
  ],
  ws_user: [
    { name: '🧑 王欢 (WH)', role: 'Owner', roleCls: 'tag-green', scope: 'ALL', last: '2026-09-03 11:20', action: 'audit' },
    { name: '👩 李娜 (LN)', role: 'Developer', roleCls: 'tag-blue', scope: 'DWD 可写 · PII 脱敏', last: '2026-09-02 16:40', action: 'remove' },
    { name: '👨 周杰 (ZJ)', role: 'Analyst', roleCls: 'tag-orange', scope: 'ADS 只读', last: '2026-09-01 09:05', action: 'remove' },
  ],
  ws_goods: [
    { name: '👩 赵静 (ZJ)', role: 'Owner', roleCls: 'tag-green', scope: 'ALL', last: '2026-09-03 08:00', action: 'audit' },
    { name: '🧑 孙强 (SQ)', role: 'Developer', roleCls: 'tag-blue', scope: 'DIM 可写', last: '2026-09-02 14:22', action: 'remove' },
  ],
  ws_marketing: [
    { name: '🧑 张涛 (ZT)', role: 'Owner', roleCls: 'tag-green', scope: 'ADS 只读订阅', last: '2026-09-03 10:01', action: 'audit' },
    { name: '👩 何莉 (HL)', role: 'Analyst', roleCls: 'tag-orange', scope: '看板查询', last: '2026-09-03 07:45', action: 'remove' },
  ],
  ws_finance: [
    { name: '🧑 刘强 (LQ)', role: 'Owner', roleCls: 'tag-green', scope: 'ALL + 审计', last: '2026-09-03 09:30', action: 'audit' },
    { name: '🔐 安全岗 (SEC)', role: 'Auditor', roleCls: 'tag-red', scope: '只读审计', last: '2026-09-02 18:00', action: 'audit' },
  ],
  ws_sandbox: [
    { name: '🧑 陈晓 (CX)', role: 'Owner', roleCls: 'tag-green', scope: 'ALL', last: '2026-08-28 12:00', action: 'audit' },
  ],
}

export function wsQuotaBarColor(pct) {
  if (pct > 80) return 'var(--danger)'
  if (pct > 60) return 'var(--warning)'
  return 'var(--success)'
}

export function wsQuotaStatusMeta(status) {
  return status === 'warn'
    ? { tag: 'tag-orange', label: '接近上限' }
    : { tag: 'tag-green', label: '正常' }
}

export function membersOf(wsId) {
  return WS_MEMBERS[wsId] || []
}

export function quotaOf(wsId) {
  return WS_QUOTA.find((q) => q.ws === wsId) || null
}
