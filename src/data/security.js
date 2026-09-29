/** 数据安全 · 铁律与路径示意（列表/KPI 走安全 API，禁止假行） */

export const SEC_IRON_RULES = [
  '人（分析师/BI/JDBC）一律走统一查询，禁止直连加速层、对象存储',
  '加速层端口只对平台作业服务账号开放（流写入、批导入、对账）',
  '人永不持有湖表写权限，写库只给作业服务账号',
  '「目录可见」≠「引擎可查」，机密资产默认可搜摘要、不可预览样本',
]

export const SEC_PATH_ALLOW = [
  { icon: '🧑', title: '人 / BI', sub: 'OIDC → 门户' },
  { icon: '🔀', title: '统一查询', sub: '脱敏 + 配额' },
  { icon: '🧊', title: '湖表读', sub: '按授权列' },
]

export const SEC_PATH_FORBID = [
  { icon: '🧑', title: '人', sub: '直连源库/加速层/对象存储' },
  { icon: '🚫', title: '阻断', sub: '安全组 + 防火墙' },
  { icon: '📜', title: '审计', sub: '记录尝试' },
]
