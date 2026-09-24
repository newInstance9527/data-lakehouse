/** 数据安全 · 铁律与路径示意（列表/KPI 走安全 API，禁止假行） */

export const SEC_IRON_RULES = [
  '人（分析师/BI/JDBC）一律走 Trino，禁止直连 ClickHouse、MinIO',
  'ClickHouse 9000/8123 端口只对平台作业 SA 开放（Flink Sink、DS 导入、对账）',
  '人永不持有 Iceberg 写权限，写库只给作业服务账号',
  '「目录可见」≠「引擎可查」，机密资产默认可搜摘要、不可预览样本',
]

export const SEC_PATH_ALLOW = [
  { icon: '🧑', title: '人 / BI', sub: 'OIDC → 门户' },
  { icon: '🔀', title: 'Trino', sub: '脱敏 + 配额' },
  { icon: '🧊', title: 'Iceberg 读', sub: '按授权列' },
]

export const SEC_PATH_FORBID = [
  { icon: '🧑', title: '人', sub: '直连源库/CK/MinIO' },
  { icon: '🚫', title: '阻断', sub: '安全组 + 防火墙' },
  { icon: '📜', title: '审计', sub: '记录尝试' },
]
