import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken } from '@/api/token'
import { useSession } from '@/composables/useSession'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, id: 'login' },
  },
  { path: '/', name: 'overview', component: () => import('@/views/OverviewView.vue'), meta: { id: 'overview' } },
  { path: '/domain', name: 'domain', component: () => import('@/views/DomainView.vue'), meta: { id: 'domain' } },
  { path: '/catalog', name: 'catalog', component: () => import('@/views/CatalogView.vue'), meta: { id: 'catalog' } },
  { path: '/datasource', name: 'datasource', component: () => import('@/views/DatasourceView.vue'), meta: { id: 'datasource' } },
  {
    path: '/datasource/:id/tables',
    name: 'datasource-tables',
    component: () => import('@/views/SourceTablesView.vue'),
    meta: { id: 'datasource' },
  },
  { path: '/integration', name: 'integration', component: () => import('@/views/IntegrationView.vue'), meta: { id: 'integration' } },
  { path: '/lineage', name: 'lineage', component: () => import('@/views/LineageView.vue'), meta: { id: 'lineage' } },
  { path: '/standard', name: 'standard', component: () => import('@/views/StandardView.vue'), meta: { id: 'standard' } },
  { path: '/lifecycle', name: 'lifecycle', component: () => import('@/views/LifecycleView.vue'), meta: { id: 'lifecycle' } },
  {
    path: '/lifecycle/storage',
    name: 'storage-trend',
    component: () => import('@/views/StorageTrendView.vue'),
    meta: { id: 'storage-trend' },
  },
  {
    path: '/compliance',
    name: 'compliance',
    component: () => import('@/views/ComplianceView.vue'),
    meta: { id: 'compliance' },
  },
  { path: '/develop', name: 'develop', component: () => import('@/views/DevelopView.vue'), meta: { id: 'develop' } },
  { path: '/query', name: 'query', component: () => import('@/views/QueryView.vue'), meta: { id: 'query' } },
  { path: '/publish', name: 'publish', component: () => import('@/views/PublishView.vue'), meta: { id: 'publish' } },
  { path: '/quality', name: 'quality', component: () => import('@/views/QualityView.vue'), meta: { id: 'quality' } },
  { path: '/security', name: 'security', component: () => import('@/views/SecurityView.vue'), meta: { id: 'security' } },
  { path: '/contract', name: 'contract', component: () => import('@/views/ContractView.vue'), meta: { id: 'contract' } },
  {
    path: '/dataservice',
    name: 'dataservice',
    component: () => import('@/views/DataserviceOverviewView.vue'),
    meta: { id: 'dataservice' },
  },
  {
    path: '/dataservice/apis',
    name: 'dataservice-apis',
    component: () => import('@/views/DataserviceApisView.vue'),
    meta: { id: 'dataservice-apis' },
  },
  {
    path: '/dataservice/build/:id?',
    name: 'dataservice-build',
    component: () => import('@/views/DataserviceBuildView.vue'),
    meta: { id: 'dataservice-build' },
  },
  {
    path: '/dataservice/runtime',
    name: 'dataservice-runtime',
    component: () => import('@/views/DataserviceRuntimeView.vue'),
    meta: { id: 'dataservice-runtime' },
  },
  {
    path: '/metrics',
    name: 'metrics',
    component: () => import('@/views/MetricsOverviewView.vue'),
    meta: { id: 'metrics' },
  },
  {
    path: '/metrics/catalog',
    name: 'metrics-catalog',
    component: () => import('@/views/MetricsCatalogView.vue'),
    meta: { id: 'metrics-catalog' },
  },
  {
    path: '/metrics/define/:id?',
    redirect: (to) => ({
      path: '/metrics/catalog',
      query: to.params.id
        ? { edit: String(to.params.id) }
        : { create: '1' },
    }),
  },
  { path: '/export', name: 'export', component: () => import('@/views/ExportView.vue'), meta: { id: 'export' } },
  { path: '/apply', name: 'apply', component: () => import('@/views/ApplyView.vue'), meta: { id: 'apply' } },
  { path: '/ops', name: 'ops', component: () => import('@/views/OpsView.vue'), meta: { id: 'ops' } },
  { path: '/linktrace', name: 'linktrace', component: () => import('@/views/LinktraceView.vue'), meta: { id: 'linktrace' } },
  { path: '/infra', name: 'infra', component: () => import('@/views/InfraView.vue'), meta: { id: 'infra' } },
  { path: '/rootcause', name: 'rootcause', component: () => import('@/views/RootcauseView.vue'), meta: { id: 'rootcause' } },
  { path: '/reliability', name: 'reliability', component: () => import('@/views/ReliabilityView.vue'), meta: { id: 'reliability' } },
  { path: '/querygov', name: 'querygov', component: () => import('@/views/QuerygovView.vue'), meta: { id: 'querygov' } },
  { path: '/workspace', name: 'workspace', component: () => import('@/views/WorkspaceView.vue'), meta: { id: 'workspace' } },
  { path: '/aiassistant', name: 'aiassistant', component: () => import('@/views/AiAssistantView.vue'), meta: { id: 'aiassistant' } },
  { path: '/aimodel', name: 'aimodel', component: () => import('@/views/AiModelView.vue'), meta: { id: 'aimodel' } },
  { path: '/knowledge', name: 'knowledge', component: () => import('@/views/KnowledgeView.vue'), meta: { id: 'knowledge' } },
  { path: '/sys/org', name: 'sys-org', component: () => import('@/views/SysOrgView.vue'), meta: { id: 'sys-org' } },
  {
    path: '/sys/position',
    name: 'sys-position',
    component: () => import('@/views/SysPositionView.vue'),
    meta: { id: 'sys-position' },
  },
  { path: '/sys/users', name: 'sys-users', component: () => import('@/views/SysUserView.vue'), meta: { id: 'sys-users' } },
  { path: '/sys/roles', name: 'sys-roles', component: () => import('@/views/SysRoleView.vue'), meta: { id: 'sys-roles' } },
  { path: '/sys/menus', name: 'sys-menus', component: () => import('@/views/SysMenuView.vue'), meta: { id: 'sys-menus' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

let sessionBootstrapped = false

router.beforeEach(async (to) => {
  const { bootstrapSession, canAccessNav, isLoggedIn, ready } = useSession()
  if (!sessionBootstrapped || !ready.value) {
    await bootstrapSession()
    sessionBootstrapped = true
  }

  if (to.meta?.public) {
    if (to.name === 'login' && getToken() && isLoggedIn.value) {
      return typeof to.query.redirect === 'string' ? to.query.redirect : '/'
    }
    return true
  }

  if (!getToken() || !isLoggedIn.value) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  const navId = to.meta?.id
  if (navId && !canAccessNav(navId)) {
    return { path: '/', replace: true }
  }
  return true
})

export default router
