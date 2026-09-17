<script setup>
import { computed } from 'vue'
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

const props = defineProps({
  source: { type: Object, default: null },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'toggle-status', 'edit', 'open-tables'])

const router = useRouter()
const { showToast } = useToast()

const cat = computed(() => (props.source ? dsCategory(props.source) : ''))
const st = computed(() => statusMeta(props.source?.status))
const summary = computed(() => schemaSummary(props.source?.schema, 5))

function close() {
  emit('close')
}

function test() {
  showToast(`🧪 连通性测试 ${props.source.name} · 成功`, 'success')
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

function goAsset() {
  close()
  router.push({
    path: '/catalog',
    query: {
      source: props.source.name,
      sourceId: props.source.id,
      ...(props.source.asset ? { asset: props.source.asset } : {}),
    },
  })
}
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
          <button class="btn btn-sm" @click="test">🧪 测试</button>
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
              <button class="btn-link" @click="goAsset">
                <template v-if="source.asset">{{ source.asset }}</template>
                <template v-else>查看资产目录</template>
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
