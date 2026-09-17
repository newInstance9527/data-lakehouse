<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppDrawer from '@/components/common/AppDrawer.vue'
import { useDatasources } from '@/composables/useDatasources'
import { useToast } from '@/composables/useToast'
import { formatDataType, getAssetFields, yesNo } from '@/utils/fieldSchema'

const props = defineProps({
  asset: { type: Object, default: null },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const router = useRouter()
const { showToast } = useToast()
const { sources, getSource } = useDatasources()
const tab = ref('schema')

watch(
  () => props.asset?.id,
  () => {
    tab.value = 'schema'
  },
)

const linkedSource = computed(() => {
  const a = props.asset
  if (!a) return null
  if (a.sourceId) return getSource(a.sourceId)
  if (a.sourceName) {
    return sources.value.find((s) => s.name === a.sourceName || s.id === a.sourceName) || null
  }
  return sources.value.find((s) => s.asset === a.id) || null
})

const sourceType = computed(
  () => linkedSource.value?.type || props.asset?.sourceType || 'MySQL',
)

const fields = computed(() => getAssetFields(props.asset, sourceType.value))

const previewCols = computed(() => fields.value.slice(0, 8))

const qs = computed(() => props.asset?.quality || 0)
const qsc = computed(() =>
  qs.value >= 95 ? 'var(--success)' : qs.value >= 80 ? 'var(--warning)' : 'var(--danger)',
)

function close() {
  emit('close')
}

function go(path) {
  close()
  router.push(path)
}

function applyPerm() {
  close()
  showToast('🔐 申请权限（演示）· 后续迁入申请中心', 'info')
  router.push('/apply')
}

function fmtCell(v) {
  if (v == null || v === '') return '—'
  return v
}
</script>

<template>
  <AppDrawer
    :open="open && !!asset"
    :default-width="720"
    :min-width="480"
    storage-key="drawer-width-asset"
    @close="close"
  >
    <template v-if="asset">
      <div class="drawer-header">
        <div style="flex: 1; min-width: 0">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
            <span class="asset-layer" :class="`layer-${asset.layer}`">{{ asset.layerLabel }}</span>
            <span class="drawer-title">{{ asset.key }}</span>
          </div>
          <div class="drawer-subtitle">
            {{ asset.desc }}{{ asset.size ? ` · ${asset.size}` : '' }}
            <template v-if="linkedSource">
              · 🔌 {{ linkedSource.name }}
              <span class="tag tag-gray" style="margin-left: 4px">{{ sourceType }}</span>
            </template>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0">
          <button class="btn btn-sm" @click="go('/lineage')">🔗 血缘</button>
          <button class="btn btn-sm btn-primary" @click="applyPerm">🔐 申请权限</button>
          <button class="btn btn-sm" title="关闭" @click="close">✕</button>
        </div>
      </div>

      <div class="drawer-body">
        <div class="std-tabs">
          <span class="std-tab" :class="{ active: tab === 'schema' }" @click="tab = 'schema'">字段 Schema</span>
          <span class="std-tab" :class="{ active: tab === 'quality' }" @click="tab = 'quality'">质量</span>
          <span class="std-tab" :class="{ active: tab === 'preview' }" @click="tab = 'preview'">数据预览</span>
          <span class="std-tab" :class="{ active: tab === 'perm' }" @click="tab = 'perm'">权限 / 脱敏</span>
          <span class="std-tab" :class="{ active: tab === 'info' }" @click="tab = 'info'">基本信息</span>
        </div>

        <div v-show="tab === 'schema'">
          <div class="detail-section-title" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            字段定义 · {{ fields.length }} 列
            <span class="tag tag-blue">按 {{ sourceType }} 类型展示</span>
          </div>
          <div style="overflow: auto; max-height: 460px; margin-top: 8px">
            <table class="std-table field-meta-table" style="font-size: 12px">
              <thead>
                <tr>
                  <th style="min-width: 88px">中文名称</th>
                  <th style="min-width: 110px">英文名称</th>
                  <th style="min-width: 140px">描述</th>
                  <th style="min-width: 100px">字段类型</th>
                  <th style="width: 72px">字段长度</th>
                  <th style="width: 64px">小数位</th>
                  <th style="width: 72px">是否可空</th>
                  <th style="width: 72px">是否主键</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in fields" :key="c.enName">
                  <td>{{ c.cnName }}</td>
                  <td style="font-family: monospace; font-weight: 500">
                    <span v-if="c.pk">🔑 </span>{{ c.enName }}
                  </td>
                  <td style="color: var(--text-2)">{{ c.desc || '—' }}</td>
                  <td style="font-family: monospace; font-size: 11px; color: var(--primary)">
                    {{ formatDataType(c) }}
                  </td>
                  <td>{{ fmtCell(c.length) }}</td>
                  <td>{{ fmtCell(c.scale) }}</td>
                  <td>
                    <span :class="c.nullable ? 'tag tag-gray' : 'tag tag-orange'">{{ yesNo(c.nullable) }}</span>
                  </td>
                  <td>
                    <span :class="c.pk ? 'tag tag-blue' : 'tag tag-gray'">{{ yesNo(c.pk) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-show="tab === 'quality'">
          <div style="display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap">
            <div
              class="big-score"
              :style="{ background: `conic-gradient(${qsc} 0 ${qs}%, var(--bg-2) ${qs}% 100%)` }"
            >
              <div class="big-score-inner">
                <div class="big-score-num" :style="{ color: qsc }">{{ qs }}</div>
                <div class="big-score-label">质量分</div>
              </div>
            </div>
            <div style="flex: 1; min-width: 220px">
              <div class="info-grid" style="margin-bottom: 12px">
                <div>
                  <div class="info-label">规则</div>
                  <div class="info-value">18 条 · <span style="color: var(--success)">15 通过</span> · <span style="color: var(--danger)">3 失败</span></div>
                </div>
                <div>
                  <div class="info-label">黄金认证</div>
                  <div class="info-value">{{ asset.isGold ? '⭐ 已认证' : '待认证 / 已摘牌' }}</div>
                </div>
              </div>
              <button class="btn btn-sm" @click="go('/quality')">→ 数据质量</button>
            </div>
          </div>
        </div>

        <div v-show="tab === 'preview'">
          <div class="detail-section-title">样例数据（已应用动态脱敏）</div>
          <div style="overflow: auto; margin-top: 8px">
            <table class="std-table" style="font-size: 12px">
              <thead>
                <tr>
                  <th v-for="c in previewCols" :key="c.enName">{{ c.cnName || c.enName }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in 5" :key="row">
                  <td v-for="c in previewCols" :key="c.enName">
                    <span :class="{ masked: String(c.sample || '').includes('*') }">{{ c.sample ?? '—' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-show="tab === 'perm'">
          <div class="detail-section-title">权限与脱敏</div>
          <div class="info-grid" style="margin-top: 10px">
            <div>
              <div class="info-label">分级分类</div>
              <div class="info-value"><span class="tag" :class="asset.levelClass">{{ asset.level }}</span></div>
            </div>
            <div>
              <div class="info-label">查询入口</div>
              <div class="info-value">仅 Trino（禁止直连 CK/MinIO）</div>
            </div>
            <div>
              <div class="info-label">敏感列</div>
              <div class="info-value">
                {{ fields.filter((f) => f.sensitive).map((f) => f.enName).join(' / ') || '—' }}
              </div>
            </div>
            <div>
              <div class="info-label">授权落点</div>
              <div class="info-value">Gravitino 表/列/行策略</div>
            </div>
          </div>
          <div style="margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap">
            <button class="btn btn-sm btn-primary" @click="applyPerm">🔐 申请查询权限</button>
            <button class="btn btn-sm" @click="go('/security')">→ 安全与权限</button>
            <button class="btn btn-sm" @click="go('/query')">→ 即席查询</button>
          </div>
        </div>

        <div v-show="tab === 'info'">
          <div class="detail-section-title">基本信息</div>
          <div class="info-grid" style="margin-top: 10px">
            <div><div class="info-label">物理名</div><div class="info-value" style="font-family: monospace">{{ asset.key }}</div></div>
            <div>
              <div class="info-label">分层 / 域</div>
              <div class="info-value">
                <span class="asset-layer" :class="`layer-${asset.layer}`">{{ asset.layerLabel }}</span>
                · {{ asset.domainLabel }}
              </div>
            </div>
            <div>
              <div class="info-label">关联数据源</div>
              <div class="info-value">
                <template v-if="linkedSource">{{ linkedSource.name }} · {{ sourceType }}</template>
                <template v-else>—</template>
              </div>
            </div>
            <div><div class="info-label">引擎 / 存储</div><div class="info-value">{{ asset.engine || '—' }} · {{ asset.storage || '—' }}</div></div>
            <div><div class="info-label">数据量</div><div class="info-value">{{ asset.size || '—' }}</div></div>
            <div><div class="info-label">分区</div><div class="info-value">{{ asset.partitions || '—' }}</div></div>
            <div><div class="info-label">Owner</div><div class="info-value">{{ asset.owner }} / {{ asset.bizOwner }}</div></div>
            <div>
              <div class="info-label">资产标签</div>
              <div class="info-value">
                <span
                  v-for="(t, i) in asset.tags || []"
                  :key="i"
                  class="tag"
                  :class="t[1] || 'tag-gray'"
                  style="margin-right: 3px"
                >{{ t[0] }}</span>
              </div>
            </div>
            <div><div class="info-label">近 7 天查询</div><div class="info-value">{{ asset.metrics?.read7d || '—' }}</div></div>
          </div>
        </div>
      </div>
    </template>
  </AppDrawer>
</template>

<style scoped>
.field-meta-table th,
.field-meta-table td {
  white-space: nowrap;
}
.field-meta-table td:nth-child(3) {
  white-space: normal;
  min-width: 120px;
}
</style>
