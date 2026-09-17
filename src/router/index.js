import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'overview', component: () => import('@/views/OverviewView.vue'), meta: { id: 'overview' } },
  { path: '/catalog', name: 'catalog', component: () => import('@/views/CatalogView.vue'), meta: { id: 'catalog' } },
  // 后续按模块顺序替换为真实页面
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
  { path: '/dataservice', name: 'dataservice', component: () => import('@/views/DataserviceView.vue'), meta: { id: 'dataservice' } },
  { path: '/metrics', name: 'metrics', component: () => import('@/views/MetricsView.vue'), meta: { id: 'metrics' } },
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
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
