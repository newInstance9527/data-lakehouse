/** 侧栏导航 · 与演示 HTML 模块顺序一致 */
export const NAV_GROUPS = [
  {
    title: '工作台',
    items: [
      { id: 'overview', label: '总览仪表盘', icon: '🏠', path: '/' },
    ],
  },
  {
    title: '① 数据接入',
    items: [
      { id: 'datasource', label: '数据源管理', icon: '🔌', path: '/datasource' },
      { id: 'integration', label: 'ETL 编排', icon: '🛠️', path: '/integration' },
    ],
  },
  {
    title: '② 数据资产',
    items: [
      { id: 'catalog', label: '资产目录', icon: '📚', path: '/catalog' },
      { id: 'lineage', label: '字段血缘', icon: '🔗', path: '/lineage' },
      { id: 'standard', label: '数据标准', icon: '📐', path: '/standard' },
      { id: 'lifecycle', label: '生命周期', icon: '⏳', path: '/lifecycle' },
      { id: 'storage-trend', label: '存储趋势', icon: '📊', path: '/lifecycle/storage' },
      { id: 'compliance', label: '合规删除', icon: '🗑️', path: '/compliance' },
    ],
  },
  {
    title: '③ 数据开发',
    items: [
      { id: 'develop', label: '数据开发 / SQL', icon: '💻', path: '/develop' },
      { id: 'query', label: '即席查询', icon: '⚡', path: '/query' },
      { id: 'publish', label: '环境与发布', icon: '🚀', path: '/publish' },
    ],
  },
  {
    title: '④ 数据质量',
    items: [
      { id: 'quality', label: '数据质量', icon: '✅', path: '/quality', badge: '3' },
      { id: 'security', label: '安全与权限', icon: '🔐', path: '/security' },
      { id: 'contract', label: '数据契约', icon: '📜', path: '/contract' },
    ],
  },
  {
    title: '⑤ 数据服务',
    items: [
      { id: 'dataservice', label: '数据服务', icon: '🔌', path: '/dataservice' },
      { id: 'metrics', label: '指标中心', icon: '📊', path: '/metrics' },
      { id: 'export', label: '出湖与回流', icon: '📤', path: '/export' },
    ],
  },
  {
    title: '⑥ 申请与审批',
    items: [
      { id: 'apply', label: '申请中心', icon: '📝', path: '/apply' },
    ],
  },
  {
    title: '⑦ 运维监控',
    items: [
      { id: 'ops', label: '任务运维', icon: '⚙️', path: '/ops' },
      { id: 'linktrace', label: '链路调用监控', icon: '🧵', path: '/linktrace', badge: '新' },
      { id: 'infra', label: '基础设施监控', icon: '🖥️', path: '/infra', badge: '新' },
      { id: 'rootcause', label: '根因分析台', icon: '🔍', path: '/rootcause', badge: 'P0' },
      { id: 'reliability', label: '可靠性中心', icon: '🛡️', path: '/reliability' },
      { id: 'querygov', label: '查询治理与成本', icon: '🎚️', path: '/querygov' },
    ],
  },
  {
    title: '⑧ 平台能力',
    items: [
      { id: 'workspace', label: '工作空间', icon: '🗂️', path: '/workspace' },
      { id: 'aiassistant', label: 'AI 助手', icon: '🤖', path: '/aiassistant' },
      { id: 'aimodel', label: 'AI 模型管理', icon: '🧠', path: '/aimodel' },
      { id: 'knowledge', label: '知识库', icon: '📖', path: '/knowledge' },
    ],
  },
  {
    title: '⑨ 系统管理',
    items: [
      { id: 'sys-org', label: '部门管理', icon: '🏢', path: '/sys/org' },
      { id: 'sys-position', label: '职位管理', icon: '💼', path: '/sys/position' },
      { id: 'sys-users', label: '用户管理', icon: '👤', path: '/sys/users' },
      { id: 'sys-roles', label: '角色管理', icon: '🎭', path: '/sys/roles' },
      { id: 'sys-menus', label: '菜单管理', icon: '📋', path: '/sys/menus' },
    ],
  },
]

export const CRUMBS = Object.fromEntries(
  NAV_GROUPS.flatMap((g) =>
    g.items.map((item) => [item.id, [g.title, item.label]]),
  ),
)
