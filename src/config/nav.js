/** 侧栏导航 · 与路由对齐（文案经 i18n，label 为中文兜底）
 * 组序定案：标准先行（元数据 → 集成 → 资产）；契约属元数据；申请紧挨治理；运维基建沉底。
 */
export const NAV_GROUPS = [
  {
    key: 'workbench',
    title: '工作台',
    items: [
      { id: 'overview', label: '总览仪表盘', icon: 'overview', path: '/' },
    ],
  },
  {
    key: 'meta',
    title: '元数据管理',
    items: [
      { id: 'domain', label: '数据域', icon: 'domain', path: '/domain' },
      { id: 'standard', label: '数据标准', icon: 'standard', path: '/standard' },
      { id: 'contract', label: '数据契约', icon: 'contract', path: '/contract' },
    ],
  },
  {
    key: 'ingest',
    title: '数据集成',
    items: [
      { id: 'datasource', label: '数据源管理', icon: 'datasource', path: '/datasource' },
      { id: 'integration', label: 'ETL 编排', icon: 'integration', path: '/integration' },
      { id: 'export', label: '出湖与回流', icon: 'export', path: '/export' },
    ],
  },
  {
    key: 'asset',
    title: '数据资产',
    items: [
      { id: 'catalog', label: '资产目录', icon: 'catalog', path: '/catalog' },
      { id: 'lineage', label: '字段血缘', icon: 'lineage', path: '/lineage' },
      { id: 'lifecycle', label: '生命周期', icon: 'lifecycle', path: '/lifecycle' },
      { id: 'storage-trend', label: '存储趋势', icon: 'storage', path: '/lifecycle/storage' },
      { id: 'compliance', label: '合规删除', icon: 'compliance', path: '/compliance' },
    ],
  },
  {
    key: 'dev',
    title: '数据开发',
    items: [
      { id: 'develop', label: '数据开发 / SQL', icon: 'develop', path: '/develop' },
      { id: 'query', label: '即席查询', icon: 'query', path: '/query' },
      { id: 'publish', label: '环境与发布', icon: 'publish', path: '/publish' },
    ],
  },
  {
    key: 'quality',
    title: '数据质量',
    items: [
      { id: 'quality', label: '数据质量', icon: 'quality', path: '/quality' },
    ],
  },
  {
    key: 'gov',
    title: '治理与安全',
    items: [
      { id: 'security', label: '安全与权限', icon: 'security', path: '/security' },
    ],
  },
  {
    key: 'apply',
    title: '申请与审批',
    items: [
      { id: 'apply', label: '申请中心', icon: 'apply', path: '/apply' },
    ],
  },
  {
    key: 'metrics',
    title: '指标中心',
    items: [
      { id: 'metrics', label: '指标概览', icon: 'metrics', path: '/metrics' },
      { id: 'metrics-catalog', label: '指标目录', icon: 'metrics-catalog', path: '/metrics/catalog' },
    ],
  },
  {
    key: 'service',
    title: '数据服务',
    items: [
      { id: 'dataservice', label: '服务概览', icon: 'dataservice', path: '/dataservice' },
      { id: 'dataservice-apis', label: 'API 目录', icon: 'dataservice-apis', path: '/dataservice/apis' },
      { id: 'dataservice-build', label: '构建工作台', icon: 'dataservice-build', path: '/dataservice/build' },
      { id: 'dataservice-runtime', label: '运行与网关', icon: 'dataservice-runtime', path: '/dataservice/runtime' },
    ],
  },
  {
    key: 'ops',
    title: '运维监控',
    items: [
      { id: 'ops', label: '任务运维', icon: 'ops', path: '/ops' },
      { id: 'linktrace', label: '链路调用监控', icon: 'linktrace', path: '/linktrace' },
      { id: 'rootcause', label: '根因分析台', icon: 'rootcause', path: '/rootcause' },
      { id: 'reliability', label: '可靠性中心', icon: 'reliability', path: '/reliability' },
      { id: 'querygov', label: '查询治理与成本', icon: 'querygov', path: '/querygov' },
      { id: 'infra', label: '基础设施监控', icon: 'infra', path: '/infra' },
    ],
  },
  {
    key: 'platform',
    title: '平台能力',
    items: [
      { id: 'workspace', label: '工作空间', icon: 'workspace', path: '/workspace' },
      { id: 'aiassistant', label: 'AI 助手', icon: 'aiassistant', path: '/aiassistant' },
      { id: 'aimodel', label: 'AI 模型管理', icon: 'aimodel', path: '/aimodel' },
      { id: 'knowledge', label: '知识库', icon: 'knowledge', path: '/knowledge' },
    ],
  },
  {
    key: 'sys',
    title: '系统管理',
    items: [
      { id: 'sys-org', label: '部门管理', icon: 'sys-org', path: '/sys/org' },
      { id: 'sys-position', label: '职位管理', icon: 'sys-position', path: '/sys/position' },
      { id: 'sys-users', label: '用户管理', icon: 'sys-users', path: '/sys/users' },
      { id: 'sys-roles', label: '角色管理', icon: 'sys-roles', path: '/sys/roles' },
      { id: 'sys-menus', label: '菜单管理', icon: 'sys-menus', path: '/sys/menus' },
    ],
  },
]

export const CRUMBS = Object.fromEntries(
  NAV_GROUPS.flatMap((g) =>
    g.items.map((item) => [item.id, [g.title, item.label]]),
  ),
)
