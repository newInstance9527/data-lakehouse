<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppDrawer from '@/components/common/AppDrawer.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { useStorageTrend } from '@/composables/useStorageTrend'
import { useSession } from '@/composables/useSession'
import { resolveWs } from '@/utils/ws'
import { pageGuideOf } from '@/data/pageGuides'

const router = useRouter()
const route = useRoute()
const { showToast } = useToast()
const { currentWs } = useSession()
const guide = pageGuideOf('storage-trend')

const {
  loading,
  lastError,
  range,
  tableFilter,
  kpis,
  daily,
  layers,
  capacityRows,
  topGrowth,
  adviceCards,
  tableRows,
  showbackRows,
  showbackCostNote,
  collectBanner,
  chartFoot,
  dualChart,
  detailOpen,
  detailLoading,
  detailData,
  detailError,
  detailCurve,
  loadAll,
  setRange,
  setTableFilter,
  openDetail,
  closeDetail,
  downloadReport,
  lifecycleQuery,
  stGrowthCls,
  humanBytes,
} = useStorageTrend()

const highlightBucket = computed(() => {
  const b = route.query.bucket
  return b ? String(b) : ''
})

const capacityRowsView = computed(() => {
  const rows = capacityRows.value || []
  if (!highlightBucket.value) return rows
  const hit = rows.filter((r) => String(r.label || '').includes(highlightBucket.value))
  return hit.length ? hit : rows
})

const subtitle = computed(() => {
  const b = collectBanner.value
  const src = b?.source ? ' · ' + String(b.source).split(';')[0] : ''
  const bucket = highlightBucket.value ? ` · 聚焦桶 ${highlightBucket.value}` : ''
  return `三口径度量 · ${range.value} 窗口 · 建议只深链生命周期${src}${bucket}`
})

async function reload() {
  await loadAll(resolveWs())
}

watch(currentWs, () => {
  reload().catch((e) => showToast(`存储趋势加载失败：${e.message || e}`, 'error'))
})

onMounted(async () => {
  if (route.query.range) {
    range.value = String(route.query.range)
  }
  try {
    await reload()
    const table = route.query.table
    if (table) {
      await openDetail(String(table), currentWs.value)
    }
  } catch (e) {
    showToast(`存储趋势加载失败：${e.message || e}`, 'error')
  }
})

async function onRange(next) {
  try {
    await setRange(next, resolveWs())
    router.replace({ query: { ...route.query, range: next } })
  } catch (e) {
    showToast(`切换窗口失败：${e.message || e}`, 'error')
  }
}

async function onFilter(next) {
  try {
    await setTableFilter(next, resolveWs())
  } catch (e) {
    showToast(`筛选失败：${e.message || e}`, 'error')
  }
}

async function refreshMetrics() {
  try {
    await reload()
    showToast('🔄 已刷新存储趋势', 'success')
  } catch (e) {
    showToast(`刷新失败：${e.message || e}`, 'error')
  }
}

async function exportReport() {
  try {
    const res = await downloadReport(currentWs.value)
    if (res?.source === 'client-fallback') {
      showToast('📄 已下载本地拼装日报（后端 export 未就绪或格式未知）', 'info')
    } else {
      showToast('📄 存储日报已下载', 'success')
    }
  } catch (e) {
    showToast(`导出失败：${e.message || e}`, 'error')
  }
}

function goLifecycle(extra = {}) {
  router.push({ path: '/lifecycle', query: extra })
}

function goWorkspace(ws) {
  router.push({ path: '/workspace', query: ws ? { ws } : {} })
}

function goQuerygov(ws) {
  router.push({
    path: '/querygov',
    query: { ws: ws || currentWs.value || undefined, range: range.value },
  })
}

function goCatalog(q) {
  router.push({ path: '/catalog', query: { q } })
}

/** 本页只读：合并/过期一律深链主台 */
function runAction(kind, table, adviceId) {
  if (kind === 'catalog' && table) {
    goCatalog(table)
    return
  }
  goLifecycle(lifecycleQuery(kind, table, adviceId))
}

function onRowClick(row) {
  openDetail(row.table, row.ws && row.ws !== '—' ? row.ws : currentWs.value)
}

const FILTERS = [
  { id: 'anomaly', label: '异常' },
  { id: 'reclaimable', label: '可回收高' },
  { id: 'smallfile', label: '小文件多' },
  { id: 'all', label: '全部' },
]

const RANGES = ['7d', '30d', '90d']
</script>

<template>
  <div class="st-page">
    <PageHeader
      page-id="storage-trend" title="存储趋势" :subtitle="subtitle" :guide="guide">
      <div class="st-range">
        <button
          v-for="r in RANGES"
          :key="r"
          type="button"
          class="btn btn-sm"
          :class="{ 'btn-primary': range === r }"
          :disabled="loading"
          @click="onRange(r)"
        >
          {{ r }}
        </button>
      </div>
      <button type="button" class="btn btn-sm" :disabled="loading" @click="refreshMetrics">
        🔄 刷新水位
      </button>
      <button type="button" class="btn btn-sm" @click="exportReport">📄 导出日报</button>
      <button type="button" class="btn btn-sm btn-primary" @click="goLifecycle()">⏳ 去生命周期执行</button>
    </PageHeader>

    <p v-if="lastError && !loading" class="st-banner warn">
      加载失败：{{ lastError.message || lastError }}
    </p>
    <p v-else-if="collectBanner" class="st-banner" :class="collectBanner.status === 'FRESH' ? 'ok' : 'warn'">
      采集 {{ collectBanner.status }}
      <template v-if="collectBanner.collectedAt"> · 截至 {{ collectBanner.collectedAt }}</template>
      <template v-if="collectBanner.caliberNote"> · {{ collectBanner.caliberNote }}</template>
    </p>

    <div class="kpi-grid st-kpi">
      <div v-for="(k, i) in kpis" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-trend" :class="k.trendDown ? 'down' : 'up'">{{ k.trend }}</div>
      </div>
    </div>

    <div class="grid grid-2 st-section">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            📈 存储趋势（{{ range }}）
            <span class="tip">· 单位 TB · 物理/活跃双线 + 可回收缺口</span>
          </div>
          <div class="st-legend">
            <span class="st-leg phys">物理</span>
            <span class="st-leg act">活跃</span>
            <span class="st-leg gap">缺口</span>
            <span v-if="dualChart.showForecast" class="st-leg fc">预测</span>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!daily.length" class="st-chart-empty">暂无趋势点</div>
          <svg
            v-else
            class="st-svg"
            :viewBox="dualChart.viewBox"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="物理与活跃双线趋势"
          >
            <line
              v-for="(t, i) in dualChart.yTicks"
              :key="'gy' + i"
              :x1="40"
              :x2="dualChart.width - 16"
              :y1="t.y"
              :y2="t.y"
              class="st-grid"
            />
            <text
              v-for="(t, i) in dualChart.yTicks"
              :key="'yl' + i"
              :x="36"
              :y="t.y + 3"
              class="st-axis"
              text-anchor="end"
            >
              {{ t.text }}
            </text>

            <line
              v-if="dualChart.capacityY != null"
              :x1="40"
              :x2="dualChart.width - 16"
              :y1="dualChart.capacityY"
              :y2="dualChart.capacityY"
              class="st-cap-line"
            />
            <text
              v-if="dualChart.capacityY != null"
              :x="dualChart.width - 18"
              :y="dualChart.capacityY - 4"
              class="st-cap-lab"
              text-anchor="end"
            >
              容量 {{ dualChart.capacityLabel }}
            </text>

            <path v-if="dualChart.gapPath" :d="dualChart.gapPath" class="st-gap" />

            <path
              v-if="dualChart.forecastBand"
              :d="dualChart.forecastBand"
              class="st-fc-band"
            />
            <polyline
              v-if="dualChart.forecastP95"
              :points="dualChart.forecastP95"
              class="st-fc-line p95"
              fill="none"
            />
            <polyline
              v-if="dualChart.forecastP50"
              :points="dualChart.forecastP50"
              class="st-fc-line p50"
              fill="none"
            />

            <polyline
              v-if="dualChart.physicalLine"
              :points="dualChart.physicalLine"
              class="st-line phys"
              fill="none"
            />
            <polyline
              v-if="dualChart.activeLine"
              :points="dualChart.activeLine"
              class="st-line act"
              fill="none"
            />

            <circle
              v-for="(p, i) in dualChart.physicalPts"
              :key="'pp' + i"
              :cx="p.x"
              :cy="p.y"
              r="2.5"
              class="st-dot-phys"
            >
              <title>{{ p.day }} · 物理 {{ p.v }} TB · 活跃 {{ dualChart.activePts[i]?.v ?? '—' }} TB</title>
            </circle>

            <g v-if="dualChart.intersectP95">
              <circle
                :cx="dualChart.intersectP95.x"
                :cy="dualChart.intersectP95.y"
                r="4"
                class="st-intersect p95"
              />
              <text
                :x="dualChart.intersectP95.x"
                :y="dualChart.intersectP95.y - 8"
                class="st-intersect-lab"
                text-anchor="middle"
              >
                {{ dualChart.intersectP95.label }}
              </text>
            </g>
            <g v-if="dualChart.intersectP50">
              <circle
                :cx="dualChart.intersectP50.x"
                :cy="dualChart.intersectP50.y"
                r="4"
                class="st-intersect p50"
              />
              <text
                :x="dualChart.intersectP50.x"
                :y="dualChart.intersectP50.y - 8"
                class="st-intersect-lab"
                text-anchor="middle"
              >
                {{ dualChart.intersectP50.label }}
              </text>
            </g>

            <text
              v-for="(l, i) in dualChart.xLabels"
              :key="'xl' + i"
              :x="l.x"
              :y="l.y"
              class="st-axis"
              text-anchor="middle"
            >
              {{ l.text }}
            </text>
          </svg>
          <p v-if="dualChart.forecastNote" class="st-fc-note">{{ dualChart.forecastNote }}</p>
          <div class="st-chart-foot">
            <span>起始 {{ chartFoot.start }}</span>
            <span>今日 {{ chartFoot.end }} · {{ chartFoot.gap }}</span>
            <span class="st-delta">{{ chartFoot.delta }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">
            🧱 分层存量（活跃口径）
            <span class="tip">· {{ range }}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="st-stack" aria-hidden="true">
            <div
              v-for="l in layers"
              :key="l.layer"
              class="st-stack-seg"
              :style="{ width: `${l.pct}%`, background: l.color }"
              :title="`${l.layer} ${l.size}`"
            />
          </div>
          <div class="st-layer-list">
            <div v-for="l in layers" :key="l.layer" class="st-layer-row">
              <div class="st-layer-lab">
                <i class="st-dot" :style="{ background: l.color }" />
                <b>{{ l.layer }}</b>
                <span class="st-layer-note">{{ l.note }}</span>
              </div>
              <div class="st-layer-meta">
                <span>{{ l.size }}</span>
                <span class="st-growth">{{ l.growth }}</span>
              </div>
              <div class="progress st-layer-bar">
                <div class="progress-bar" :style="{ width: `${l.pct}%`, background: l.color }" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-2 st-section">
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            💧 桶水位 · days-to-full
            <span class="tip">· 按桶分列 · 加速层单列</span>
          </div>
        </div>
        <div class="card-body">
          <div v-for="(b, i) in capacityRowsView" :key="i" class="st-cap-row">
            <div class="st-cap-label">{{ b.label }}</div>
            <div class="progress st-cap-bar">
              <div class="progress-bar" :style="{ width: `${b.pct}%`, background: b.gradient }" />
            </div>
            <div class="st-cap-cap">
              <b>{{ b.used }}</b>/{{ b.cap }}
            </div>
          </div>
          <div class="st-top-title">{{ range }} 增速 Top</div>
          <div class="st-top-list">
            <div v-for="g in topGrowth" :key="g.table">
              📊 <code>{{ g.table }}</code> · {{ g.growth }}
              <span :style="{ color: g.danger ? 'var(--danger)' : 'var(--text-3)' }"> · {{ g.tip }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">💡 治理建议（按预计可回收）</div>
          <button type="button" class="btn btn-sm" @click="goLifecycle()">去执行 →</button>
        </div>
        <div class="card-body st-advice-body">
          <div v-for="(a, i) in adviceCards" :key="a.id || i" class="st-advice">
            <div class="st-advice-hd">
              <span class="tag" :class="a.priCls">{{ a.pri }}</span>
              <b>{{ a.title }}</b>
            </div>
            <div class="st-advice-detail">{{ a.detail }}</div>
            <button type="button" class="btn btn-sm" @click="runAction(a.act, a.table, a.adviceId)">
              {{ a.actLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card st-section">
      <div class="card-header">
        <div class="card-title">
          🏢 按空间 showback
          <span class="tip">· 配额读 gov_ws_quota · 金额引 FinOps 同源单价</span>
        </div>
        <button type="button" class="btn btn-sm" @click="goQuerygov()">去查询治理成本 →</button>
      </div>
      <div class="card-body" style="padding: 0; overflow-x: auto">
        <p v-if="showbackCostNote" style="padding: 10px 16px 0; margin: 0; font-size: 12px; color: var(--text-3)">
          {{ showbackCostNote }}
        </p>
        <table v-if="showbackRows.length" class="table">
          <thead>
            <tr>
              <th>空间</th>
              <th>活跃</th>
              <th>物理</th>
              <th>估算成本</th>
              <th>配额</th>
              <th>占比</th>
              <th>净增</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in showbackRows" :key="row.ws" :class="{ warn: row.warn }">
              <td>
                <button type="button" class="btn-link" @click="goWorkspace(row.ws)">
                  <code>{{ row.ws }}</code>
                </button>
                <span v-if="row.warn" class="tag tag-red" style="margin-left: 6px">≥80%</span>
              </td>
              <td>{{ row.active }}</td>
              <td>{{ row.total }}</td>
              <td>{{ row.storageCost }}</td>
              <td>{{ row.quota }}</td>
              <td>{{ row.quotaPct }}</td>
              <td>{{ row.netGrowth }}</td>
              <td style="font-size: 12px; color: var(--text-2)">{{ row.owner }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else style="padding: 16px; color: var(--text-3); margin: 0">
          暂无 showback 数据（接通 /storage/showback 后展示）
        </p>
      </div>
    </div>

    <div class="card st-section">
      <div class="card-header st-table-hd">
        <div class="card-title">
          ⚠️ 表级画像
          <span class="tip">· 三口径 · {{ range }} · 点行开抽屉 · 动作只深链</span>
        </div>
        <div class="st-filters">
          <button
            v-for="f in FILTERS"
            :key="f.id"
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-primary': tableFilter === f.id }"
            :disabled="loading"
            @click="onFilter(f.id)"
          >
            {{ f.label }}
          </button>
        </div>
      </div>
      <div class="card-body" style="padding: 0; overflow-x: auto">
        <table class="table">
          <thead>
            <tr>
              <th>表</th>
              <th>空间</th>
              <th>分层</th>
              <th>活跃</th>
              <th>物理</th>
              <th>可回收</th>
              <th>增速</th>
              <th>归因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in tableRows"
              :key="row.table + (row.ws || '')"
              class="st-row"
              @click="onRowClick(row)"
            >
              <td>
                <button type="button" class="btn-link" @click.stop="onRowClick(row)">
                  <code>{{ row.table }}</code>
                </button>
              </td>
              <td>
                <button
                  v-if="row.ws && row.ws !== '—'"
                  type="button"
                  class="btn-link"
                  @click.stop="goWorkspace(row.ws)"
                >
                  {{ row.ws }}
                </button>
                <span v-else>—</span>
              </td>
              <td><span class="tag tag-blue">{{ row.layer }}</span></td>
              <td>{{ row.active || row.size }}</td>
              <td>{{ row.total || '—' }}</td>
              <td>{{ row.reclaimable || '—' }}</td>
              <td>
                <span class="st-growth" :class="stGrowthCls(row.status)">{{ row.growth }}</span>
              </td>
              <td style="font-size: 12px; color: var(--text-2)">{{ row.reason }}</td>
              <td>
                <button
                  type="button"
                  class="btn-link"
                  @click.stop="runAction(row.action, row.table)"
                >
                  {{ row.actionLabel }}
                </button>
              </td>
            </tr>
            <tr v-if="!tableRows.length">
              <td colspan="9" style="text-align: center; color: var(--text-3); padding: 24px">
                当前筛选无数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppDrawer
      :open="detailOpen"
      storage-key="storage-trend-detail"
      :default-width="560"
      @close="closeDetail"
    >
      <div class="st-drawer">
        <div class="st-drawer-hd">
          <div>
            <div class="st-drawer-title">
              {{ detailData?.fqtn || '表详情' }}
            </div>
            <div class="st-drawer-sub tip">
              90d 三口径 · 分区 / 快照 · 最近作业
              <span v-if="detailLoading"> · 加载中…</span>
            </div>
          </div>
          <button type="button" class="btn btn-sm" @click="closeDetail">关闭</button>
        </div>

        <div v-if="detailLoading && !detailData" class="st-drawer-empty">加载中…</div>
        <div v-else-if="detailError && !detailData" class="st-drawer-empty warn">
          {{ detailError.message || detailError }}
        </div>
        <template v-else-if="detailData">
          <div class="st-drawer-kpis">
            <div>
              <span class="tip">活跃</span>
              <b>{{ humanBytes(detailData.row?.activeBytes) }}</b>
            </div>
            <div>
              <span class="tip">物理</span>
              <b>{{ humanBytes(detailData.row?.totalBytes) }}</b>
            </div>
            <div>
              <span class="tip">可回收</span>
              <b>{{ humanBytes(detailData.row?.reclaimableBytes) }}</b>
            </div>
          </div>

          <div class="st-drawer-sec">
            <div class="st-drawer-sec-t">90d 曲线</div>
            <svg
              v-if="detailCurve?.physicalLine"
              class="st-svg st-svg-sm"
              :viewBox="detailCurve.viewBox"
              preserveAspectRatio="xMidYMid meet"
            >
              <path v-if="detailCurve.gapPath" :d="detailCurve.gapPath" class="st-gap" />
              <polyline :points="detailCurve.physicalLine" class="st-line phys" fill="none" />
              <polyline :points="detailCurve.activeLine" class="st-line act" fill="none" />
              <text
                v-for="(l, i) in detailCurve.xLabels"
                :key="'dx' + i"
                :x="l.x"
                :y="l.y"
                class="st-axis"
                text-anchor="middle"
              >
                {{ l.text }}
              </text>
            </svg>
            <p v-else class="tip">暂无曲线</p>
          </div>

          <div class="st-drawer-sec">
            <div class="st-drawer-sec-t">分区 / 快照</div>
            <div class="st-kv">
              <div>
                <span>分区数</span>
                <b>{{ detailData.partitionHint?.partitionCount ?? detailData.row?.partitionCount ?? '—' }}</b>
              </div>
              <div>
                <span>快照数</span>
                <b>{{ detailData.snapshotCount ?? detailData.row?.snapshotCount ?? '—' }}</b>
              </div>
              <div>
                <span>最老快照年龄</span>
                <b>
                  <template v-if="detailData.oldestSnapshotAgeDays != null">
                    {{ detailData.oldestSnapshotAgeDays }} 天
                  </template>
                  <template v-else>—</template>
                </b>
              </div>
            </div>
            <p v-if="detailData.partitionHint?.note" class="tip" style="margin-top: 6px">
              {{ detailData.partitionHint.note }}
            </p>
          </div>

          <div v-if="detailData.policy" class="st-drawer-sec">
            <div class="st-drawer-sec-t">当前策略</div>
            <div class="st-kv">
              <div><span>keepCount</span><b>{{ detailData.policy.keepCount ?? '—' }}</b></div>
              <div><span>keepDays</span><b>{{ detailData.policy.keepDays ?? '—' }}</b></div>
              <div><span>compact</span><b>{{ detailData.policy.compactLevel ?? '—' }}</b></div>
            </div>
          </div>

          <div class="st-drawer-sec">
            <div class="st-drawer-sec-t">最近生命周期作业</div>
            <div v-if="!detailData.recentRuns?.length" class="tip">暂无作业记录</div>
            <div v-else class="st-runs">
              <div v-for="r in detailData.recentRuns" :key="r.runId || r.id" class="st-run-row">
                <span class="tag tag-blue">{{ r.kind }}</span>
                <span>{{ r.status }}</span>
                <span class="tip">{{ r.startedAt }}</span>
              </div>
            </div>
          </div>

          <div class="st-drawer-acts">
            <button
              type="button"
              class="btn btn-sm"
              @click="goCatalog(detailData.fqtn)"
            >
              看资产 →
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              @click="goLifecycle({ table: detailData.fqtn, from: 'storage-trend' })"
            >
              看策略 / 去执行 →
            </button>
          </div>
        </template>
      </div>
    </AppDrawer>
  </div>
</template>

<style scoped>
.st-kpi {
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1200px) {
  .st-kpi {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 700px) {
  .st-kpi {
    grid-template-columns: repeat(2, 1fr);
  }
}

.st-range,
.st-filters {
  display: inline-flex;
  gap: 4px;
  margin-right: 8px;
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.st-banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 6px;
}
.st-banner.warn {
  color: var(--warning);
  background: var(--warning-light, #fff7e6);
}
.st-banner.ok {
  color: var(--success, #389e0d);
  background: #f6ffed;
}

.st-section {
  margin-top: 16px;
}

.st-legend {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 11px;
  color: var(--text-3);
}
.st-leg::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 3px;
  margin-right: 4px;
  vertical-align: middle;
  border-radius: 1px;
}
.st-leg.phys::before {
  background: #4d8dff;
}
.st-leg.act::before {
  background: #3dd68c;
}
.st-leg.gap::before {
  height: 8px;
  background: rgba(230, 180, 80, 0.35);
}
.st-leg.fc::before {
  background: transparent;
  border-top: 2px dashed #a78bfa;
  height: 0;
}

.st-svg {
  width: 100%;
  height: 180px;
  display: block;
}
.st-svg-sm {
  height: 140px;
}
.st-chart-empty {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  font-size: 13px;
}
.st-grid {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.st-axis {
  fill: var(--text-3);
  font-size: 10px;
}
.st-gap {
  fill: rgba(230, 180, 80, 0.28);
  stroke: none;
}
.st-line {
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.st-line.phys {
  stroke: #4d8dff;
}
.st-line.act {
  stroke: #3dd68c;
}
.st-dot-phys {
  fill: #4d8dff;
}
.st-fc-band {
  fill: rgba(167, 139, 250, 0.12);
  stroke: none;
}
.st-fc-line {
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}
.st-fc-line.p50 {
  stroke: #a78bfa;
}
.st-fc-line.p95 {
  stroke: #f97316;
}
.st-cap-line {
  stroke: var(--danger, #ff7875);
  stroke-width: 1;
  stroke-dasharray: 6 4;
}
.st-cap-lab {
  fill: var(--danger, #ff7875);
  font-size: 10px;
}
.st-intersect {
  stroke: #fff;
  stroke-width: 1.5;
}
.st-intersect.p50 {
  fill: #a78bfa;
}
.st-intersect.p95 {
  fill: #f97316;
}
.st-intersect-lab {
  fill: var(--text-2);
  font-size: 10px;
}
.st-fc-note {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--text-3);
}
.st-chart-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  color: var(--text-3);
  gap: 8px;
  flex-wrap: wrap;
}
.st-delta {
  color: var(--warning);
  font-weight: 600;
}

.st-stack {
  display: flex;
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
  margin-bottom: 12px;
}
.st-stack-seg {
  height: 100%;
  min-width: 2px;
}

.st-layer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.st-layer-row {
  display: grid;
  gap: 4px;
}
.st-layer-lab {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.st-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.st-layer-note {
  color: var(--text-3);
  font-size: 11px;
}
.st-layer-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.st-layer-bar {
  height: 6px;
}

.st-growth.warn {
  color: var(--warning);
  font-weight: 600;
}
.st-growth.danger {
  color: var(--danger);
  font-weight: 600;
}
.st-growth.ok {
  color: var(--success);
}

.st-cap-row {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 12px;
}
.st-cap-bar {
  height: 8px;
}
.st-cap-cap {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.st-top-title {
  margin-top: 12px;
  font-size: 12px;
  font-weight: 600;
}
.st-top-list {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-2);
}

.st-advice-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.st-advice {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.st-advice-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.st-advice-detail {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}

.st-table-hd {
  flex-wrap: wrap;
  gap: 8px;
}

.st-row {
  cursor: pointer;
}
.st-row:hover {
  background: var(--bg-2, #f7f8fa);
}

.btn-link {
  border: none;
  background: none;
  color: var(--primary, #4d8dff);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}
.btn-link:hover {
  text-decoration: underline;
}

.st-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 18px 20px;
  box-sizing: border-box;
  overflow: auto;
}
.st-drawer-hd {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.st-drawer-title {
  font-size: 15px;
  font-weight: 700;
  word-break: break-all;
}
.st-drawer-sub {
  margin-top: 4px;
}
.st-drawer-empty {
  padding: 32px 8px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.st-drawer-empty.warn {
  color: var(--warning);
}
.st-drawer-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.st-drawer-kpis > div {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.st-drawer-sec {
  margin-bottom: 14px;
}
.st-drawer-sec-t {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}
.st-kv {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  font-size: 12px;
}
.st-kv > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text-3);
}
.st-kv b {
  color: var(--text-1, #1f2329);
  font-weight: 600;
}
.st-runs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.st-run-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.st-drawer-acts {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
