<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppDrawer from '@/components/common/AppDrawer.vue'
import {
  DS_CAT_LABEL,
  dsCategory,
  endpointOf,
  statusMeta,
} from '@/data/datasources'
import { schemaSummary } from '@/utils/schemaList'
import { useToast } from '@/composables/useToast'
import { testDatasource } from '@/api/datasource'

const props = defineProps({
  source: { type: Object, default: null },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'toggle-status', 'edit', 'open-tables', 'tested'])

const router = useRouter()
const { showToast } = useToast()

const cat = computed(() => (props.source ? dsCategory(props.source) : ''))
const st = computed(() => statusMeta(props.source?.status))
const summary = computed(() => schemaSummary(props.source?.schema, 5))
const testing = ref(false)

function close() {
  emit('close')
}

async function test() {
  if (!props.source?.id || testing.value) return
  testing.value = true
  try {
    const res = await testDatasource({ id: props.source.id, type: props.source.type })
    if (res?.ok) {
      showToast(`🧪 连通性测试 ${props.source.name} · 成功（${res.costMs ?? '?'}ms）`, 'success')
    } else {
      showToast(`连通失败：${res?.error || '未知错误'}`, 'error')
    }
    emit('tested', props.source.id)
  } catch (e) {
    showToast(`连通失败：${e.message || e}`, 'error')
    emit('tested', props.source.id)
  } finally {
    testing.value = false
  }
}

function edit() {
  emit('edit', props.source.id)
}

function toggle() {
  emit('toggle-status', props.source.id)
}

function openTables() {
  emit('open-tables', props.source.id)
  close()
}

function goAsset(assetCode) {
  close()
  router.push({
    path: '/catalog',
    query: {
      source: props.source.name,
      sourceId: props.source.id,
      ...(assetCode || props.source.asset ? { asset: assetCode || props.source.asset } : {}),
    },
  })
}

const linkedAssets = computed(() => {
  const list = props.source?.linkedAssets
  return Array.isArray(list) ? list : []
})
</script>

<template>
  <AppDrawer
    :open="open && !!source"
    :default-width="560"
    :min-width="400"
    storage-key="drawer-width-datasource"
    @close="close"
  >
    <template v-if="source">
      <div class="drawer-header">
        <div style="flex: 1; min-width: 0">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px">
            <div
              class="ds-icon"
              :style="{ background: source.bg, color: source.color }"
            >{{ source.icon }}</div>
            <div>
              <div class="drawer-title">{{ source.name }}</div>
              <div class="drawer-subtitle">
                {{ source.id }} · {{ source.type }} · {{ DS_CAT_LABEL[cat] || cat }}
              </div>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-shrink: 0">
          <button class="btn btn-sm" :disabled="testing" @click="test">
            {{ testing ? '测试中…' : '🧪 测试' }}
          </button>
          <button class="btn btn-sm btn-primary" @click="edit">✎ 编辑</button>
          <button class="btn btn-sm" @click="close">✕</button>
        </div>
      </div>

      <div class="drawer-body">
        <div class="detail-section-title">连接信息</div>
        <div class="info-grid" style="margin: 10px 0 18px">
          <div>
            <div class="info-label">状态</div>
            <div class="info-value"><span class="tag" :class="st.tag">{{ st.label }}</span></div>
          </div>
          <div>
            <div class="info-label">延迟</div>
            <div class="info-value">{{ source.lag || '—' }}</div>
          </div>
          <div>
            <div class="info-label">连接</div>
            <div class="info-value" style="font-family: monospace; font-size: 12px">{{ endpointOf(source) }}</div>
          </div>
          <div>
            <div class="info-label">账号</div>
            <div class="info-value">{{ source.user || '—' }} / {{ source.password || '—' }}</div>
          </div>
          <div>
            <div class="info-label">扩展参数</div>
            <div class="info-value" style="font-size: 12px; word-break: break-all">{{ source.extra || '—' }}</div>
          </div>
          <div>
            <div class="info-label">Owner / 版本</div>
            <div class="info-value">{{ source.owner }} · {{ source.ver }} · {{ source.created }}</div>
          </div>
          <div>
            <div class="info-label">关联资产</div>
            <div class="info-value">
              <template v-if="linkedAssets.length">
                <div
                  v-for="a in linkedAssets"
                  :key="a.assetId || a.assetCode"
                  style="margin-bottom: 4px"
                >
                  <button class="btn-link" @click="goAsset(a.assetCode)">
                    {{ a.assetCode || a.name }}
                    <span style="color: var(--text-3); font-weight: 400">
                      · {{ a.objectName || a.name || '' }}
                      <template v-if="a.linkRole === 'primary'"> · 主</template>
                      →
                    </span>
                  </button>
                </div>
                <button class="btn-link" style="margin-top: 2px; color: var(--text-3)" @click="goAsset()">
                  查看全部（按此源过滤）→
                </button>
              </template>
              <button v-else class="btn-link" @click="goAsset()">
                <template v-if="source.asset">{{ source.asset }}</template>
                <template v-else>暂无关联 · 去目录注册</template>
                <span style="color: var(--text-3)"> · {{ source.name }} →</span>
              </button>
            </div>
          </div>
        </div>

        <div class="detail-section-title">表清单</div>
        <div class="schema-preview" style="margin: 8px 0 18px">
          <div class="schema-preview-text">
            <template v-if="summary.count">
              <div v-for="n in summary.preview" :key="n" class="schema-preview-item">{{ n }}</div>
              <div v-if="summary.count > summary.preview.length" class="schema-preview-more">
                … 共 {{ summary.count }} 项
              </div>
            </template>
            <div v-else class="schema-preview-empty">未同步 Schema</div>
          </div>
          <button class="btn btn-sm btn-primary" style="margin-top: 10px" @click="openTables">
            管理表清单 →
          </button>
        </div>

        <div class="detail-section-title">描述</div>
        <p style="margin: 8px 0 18px; color: var(--text-2); line-height: 1.7">{{ source.desc }}</p>

        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <button
            class="btn btn-sm"
            :style="{ color: source.status === 'online' ? 'var(--warning)' : 'var(--success)' }"
            @click="toggle"
          >
            {{ source.status === 'online' ? '⏸ 停用' : '▶ 启用' }}
          </button>
        </div>
      </div>
    </template>
  </AppDrawer>
</template>

<style scoped>
.ds-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.schema-preview {
  padding: 12px;
  background: var(--bg-2);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.schema-preview-item {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 3px 0;
  color: var(--text-1);
}
.schema-preview-more,
.schema-preview-empty {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}
</style>
