/** 工作空间 · 组织归属 / 成本 / 协作上下文（非 Catalog 硬隔离） */

/** 全平台共享的技术 Catalog（演示：各空间共用，不按 ws 切库） */
export const SHARED_CATALOG = {
  gravitino: 'lakehouse',
  iceberg: 'iceberg',
  note: '共享资源池 · 发现走资产目录 · 读数走申请中心',
}

export const WS_KPIS = [
  { label: '工作空间总数', value: '6', unit: '个', delta: '归属团队 · 非隔离租户', deltaCls: '' },
  { label: '当前团队资产', value: '42', unit: '张', delta: '归属本空间 · 目录可全局搜', deltaCls: 'success' },
  { label: '成员', value: '28', unit: '人', delta: 'Owner 4 · DEV 12 · 业务 12', deltaCls: '' },
  { label: '成本告警', value: '1', unit: '个', delta: '营销域存储接近上限', deltaCls: 'warn' },
]

export const WORKSPACES = [
  {
    id: 'ws_trade',
    name: '交易域团队',
    icon: '🛒',
    desc: '订单/支付/退款认责 · 归属 dwd_order_detail 等核心资产',
    members: 18,
    tables: 42,
    owner: '李明',
    owners: '李明 · 张涛',
    costCenter: 'CC-TRADE-01',
    gravitino: SHARED_CATALOG.gravitino,
    icebergDb: `${SHARED_CATALOG.iceberg}.dwd_trade`,
    preferredSchemas: 'ods_trade / dwd_trade / ads',
    createdAt: '2025-10-08',
    tags: [
      { text: '含敏感认责', cls: 'tag-orange' },
      { text: '核心域', cls: 'tag-blue' },
    ],
    detail:
      '交易域组织归属空间：资产/任务成本记在本团队。目录仍可全局发现黄金表；成员读数须走申请中心，不因入空间自动授权。',
    current: true,
    storage: { used: 1.8, quota: 8 },
    cu: { used: 1200, quota: 2000 },
    domain: '交易',
    role: 'Owner',
    rg: 'rg_trade',
  },
  {
    id: 'ws_user',
    name: '用户域团队',
    icon: '👤',
    desc: '画像/标签认责 · 含 dwd_user_info（PII 由 Grav 脱敏）',
    members: 9,
    tables: 28,
    owner: '王欢',
    owners: '王欢',
    costCenter: 'CC-USER-01',
    gravitino: SHARED_CATALOG.gravitino,
    icebergDb: `${SHARED_CATALOG.iceberg}.dwd_user`,
    preferredSchemas: 'ods_user / dwd_user / ads',
    createdAt: '2025-11-02',
    tags: [
      { text: '含 PII 认责', cls: 'tag-orange' },
      { text: '明文需申请', cls: 'tag-purple' },
    ],
    detail: '用户域归属与成本空间。明文 PII 须安全岗参与审批；空间角色只决定认责与默认审批人，不代替 Grav ACL。',
    current: false,
    storage: { used: 0.9, quota: 4 },
    cu: { used: 300, quota: 800 },
    domain: '用户',
    role: 'Owner',
    rg: 'rg_user',
  },
  {
    id: 'ws_goods',
    name: '商品域团队',
    icon: '📦',
    desc: '商品/库存/SKU 维度认责 · dim_sku 为黄金数据集',
    members: 7,
    tables: 22,
    owner: '赵静',
    owners: '赵静',
    costCenter: 'CC-GOODS-01',
    gravitino: SHARED_CATALOG.gravitino,
    icebergDb: `${SHARED_CATALOG.iceberg}.dim_goods`,
    preferredSchemas: 'dim / dwd_goods',
    createdAt: '2025-11-18',
    tags: [
      { text: '维度域', cls: 'tag-blue' },
      { text: '鼓励复用', cls: 'tag-green' },
    ],
    detail: '商品与库存维度归属空间。dim_sku 已标黄金，交易/营销团队应申请复用，避免平行再建。',
    current: false,
    storage: { used: 0.6, quota: 3 },
    cu: { used: 180, quota: 600 },
    domain: '商品',
    role: 'Owner',
    rg: 'rg_goods',
  },
  {
    id: 'ws_marketing',
    name: '营销域团队',
    icon: '📢',
    desc: '活动/转化分析 · 消费交易域 ADS（须申请）',
    members: 6,
    tables: 18,
    owner: '张涛',
    owners: '张涛',
    costCenter: 'CC-MKT-01',
    gravitino: SHARED_CATALOG.gravitino,
    icebergDb: `${SHARED_CATALOG.iceberg}.ads`,
    preferredSchemas: 'ads',
    createdAt: '2026-01-09',
    tags: [
      { text: '跨域消费', cls: 'tag-gray' },
      { text: '配额告警', cls: 'tag-orange' },
    ],
    detail: '营销分析归属空间：自建 ADS 少、多申请读交易域成果。存储接近配额上限，需归档或扩容申请。',
    current: false,
    storage: { used: 0.5, quota: 2 },
    cu: { used: 80, quota: 400 },
    domain: '营销',
    role: 'BusinessUser',
    rg: 'rg_mkt',
  },
  {
    id: 'ws_finance',
    name: '财务域团队',
    icon: '💰',
    desc: '对账/结算认责 · 高敏感 · 强审计审批',
    members: 5,
    tables: 12,
    owner: '刘强',
    owners: '刘强 · 安全岗',
    costCenter: 'CC-FIN-01',
    gravitino: SHARED_CATALOG.gravitino,
    icebergDb: `${SHARED_CATALOG.iceberg}.ads_fin`,
    preferredSchemas: 'ads_fin',
    createdAt: '2025-12-20',
    tags: [
      { text: '高敏感认责', cls: 'tag-red' },
      { text: '强审计', cls: 'tag-orange' },
    ],
    detail: '财务归属空间：审批链默认含安全岗。共享 Catalog，不因「切到财务空间」获得额外引擎权限。',
    current: false,
    storage: { used: 0.3, quota: 2 },
    cu: { used: 40, quota: 300 },
    domain: '财务',
    role: 'SecurityOfficer',
    rg: 'rg_fin',
  },
  {
    id: 'ws_sandbox',
    name: '实验沙箱团队',
    icon: '🧪',
    desc: '培训/临时实验 · 技术库 TTL 30 天 · 低配额',
    members: 3,
    tables: 8,
    owner: '陈晓',
    owners: '陈晓',
    costCenter: 'CC-SBX-01',
    gravitino: SHARED_CATALOG.gravitino,
    icebergDb: `${SHARED_CATALOG.iceberg}.tmp_sbx`,
    preferredSchemas: 'tmp_sbx',
    createdAt: '2026-08-01',
    tags: [
      { text: 'TTL 清理', cls: 'tag-orange' },
      { text: '低配额', cls: 'tag-gray' },
    ],
    detail: '沙箱归属与成本记账；写操作仍限 tmp_sbx 技术前缀 + 作业 SA，入空间不等于可写生产表。',
    current: false,
    storage: { used: 0.1, quota: 1 },
    cu: { used: 0, quota: 200 },
    domain: '实验',
    role: 'Operator',
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

/** scope = 门户协作含义，不是引擎 ACL */
export const WS_MEMBERS = {
  ws_trade: [
    { name: '🧑 李明 (LM)', role: 'Owner', roleCls: 'tag-green', scope: '认责 · 默认审批人', last: '2026-09-03 10:42', action: 'audit' },
    { name: '🧑 张涛 (ZT)', role: 'Owner', roleCls: 'tag-green', scope: '认责 · 默认审批人', last: '2026-09-03 09:12', action: 'audit' },
    { name: '👩 王芳 (WF)', role: 'Developer', roleCls: 'tag-blue', scope: '可登记/开发 · 读数需申请', last: '2026-09-03 08:37', action: 'remove' },
    { name: '👨 陈磊 (CL)', role: 'Developer', roleCls: 'tag-blue', scope: '可登记/开发 · 读数需申请', last: '2026-09-02 22:10', action: 'remove' },
    { name: '👩 赵敏 (ZM)', role: 'BusinessUser', roleCls: 'tag-orange', scope: '消费方 · 读 ADS 需申请', last: '2026-09-03 09:55', action: 'remove' },
    { name: '🤖 svc-dolphin (SA)', role: 'Service Account', roleCls: 'tag-gray', scope: '作业身份 · ACL 在 Grav', last: '2026-09-03 11:03', action: 'rotate' },
  ],
  ws_user: [
    { name: '🧑 王欢 (WH)', role: 'Owner', roleCls: 'tag-green', scope: '认责 · 默认审批人', last: '2026-09-03 11:20', action: 'audit' },
    { name: '👩 李娜 (LN)', role: 'Developer', roleCls: 'tag-blue', scope: '可登记/开发 · PII 明文需申请', last: '2026-09-02 16:40', action: 'remove' },
    { name: '👨 周杰 (ZJ)', role: 'BusinessUser', roleCls: 'tag-orange', scope: '消费方 · 读数需申请', last: '2026-09-01 09:05', action: 'remove' },
  ],
  ws_goods: [
    { name: '👩 赵静 (ZJ)', role: 'Owner', roleCls: 'tag-green', scope: '认责 · 默认审批人', last: '2026-09-03 08:00', action: 'audit' },
    { name: '🧑 孙强 (SQ)', role: 'Developer', roleCls: 'tag-blue', scope: '可登记/开发 · 读数需申请', last: '2026-09-02 14:22', action: 'remove' },
  ],
  ws_marketing: [
    { name: '🧑 张涛 (ZT)', role: 'Owner', roleCls: 'tag-green', scope: '认责 · 跨域申请默认审批', last: '2026-09-03 10:01', action: 'audit' },
    { name: '👩 何莉 (HL)', role: 'BusinessUser', roleCls: 'tag-orange', scope: '看板消费 · 读数需申请', last: '2026-09-03 07:45', action: 'remove' },
  ],
  ws_finance: [
    { name: '🧑 刘强 (LQ)', role: 'Owner', roleCls: 'tag-green', scope: '认责 · 强审计审批', last: '2026-09-03 09:30', action: 'audit' },
    { name: '🔐 安全岗 (SEC)', role: 'SecurityOfficer', roleCls: 'tag-red', scope: '高敏感审批参与方', last: '2026-09-02 18:00', action: 'audit' },
  ],
  ws_sandbox: [
    { name: '🧑 陈晓 (CX)', role: 'Owner', roleCls: 'tag-green', scope: '认责 · 沙箱配额', last: '2026-08-28 12:00', action: 'audit' },
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
