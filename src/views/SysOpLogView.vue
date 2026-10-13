<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ListPager from '@/components/common/ListPager.vue'
import { useToast } from '@/composables/useToast'
import { useSession } from '@/composables/useSession'
import { pageGuideOf } from '@/data/pageGuides'
import { clearDevLogs, detailDevLog, pageDevLogs } from '@/api/sys'

const guide = pageGuideOf('sys-oplog')
const { showToast } = useToast()
const { isSuperAdmin } = useSession()

const CATEGORIES = [
  { value: 'OPERATE', label: '操作' },
  { value: 'EXCEPTION', label: '异常' },
  { value: 'LOGIN', label: '登录' },
  { value: 'LOGOUT', label: '登出' },
]

const category = ref('OPERATE')
const searchKey = ref('')
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pageNums = computed(() => {
  const t = totalPages.value
  const c = page.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  return [...new Set([1, t, c, c - 1, c + 1].filter((n) => n >= 1 && n <= t))].sort((a, b) => a - b)
})

onMounted(() => load())
watch(category, () => {
  page.value = 1
  load()
})

function goPage(p) {
  page.value = p
  load()
}

function onPageSize(s) {
  pageSize.value = s
  page.value = 1
  load()
}

async function load() {
  loading.value = true
  try {
    const data = await pageDevLogs({
      current: page.value,
      size: pageSize.value,
      category: category.value,
      searchKey: searchKey.value.trim() || undefined,
    })
    rows.value = Array.isArray(data?.records) ? data.records : []
    total.value = Number(data?.total || 0)
  } catch (e) {
    rows.value = []
    total.value = 0
    showToast(e?.message || '加载操作日志失败', 'error')
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  load()
}

function categoryLabel(c) {
  return CATEGORIES.find((x) => x.value === c)?.label || c || '—'
}

function formatTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function shortJson(s, max = 80) {
  if (!s) return '—'
  const t = String(s).replace(/\s+/g, ' ')
  return t.length > max ? `${t.slice(0, max)}…` : t
}

async function openDetail(row) {
  detailOpen.value = true
  detail.value = row
  detailLoading.value = true
  try {
    const full = await detailDevLog(row.id)
    detail.value = full || row
  } catch (e) {
    showToast(e?.message || '加载详情失败', 'warning')
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  detailOpen.value = false
  detail.value = null
}

async function onClear() {
  if (!isSuperAdmin.value) {
    showToast('仅超管可清空日志', 'warning')
    return
  }
  const label = categoryLabel(category.value)
  if (!window.confirm(`确定清空「${label}」类全部日志？此操作不可恢复。`)) return
  try {
    await clearDevLogs(category.value)
    showToast(`已清空 ${label} 日志`, 'success')
    page.value = 1
    await load()
  } catch (e) {
    showToast(e?.message || '清空失败', 'error')
  }
}
</script>

<template>
  <div class="sys-page">
    <PageHeader
      page-id="sys-oplog"
      title="操作日志"
      subtitle="操作 / 异常 / 登录登出 · Snowy DEV_LOG · @CommonLog"
      :guide-title="guide.title"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" :disabled="loading" @click="load">↻ 刷新</button>
      <button
        v-if="isSuperAdmin"
        type="button"
        class="btn btn-sm"
        style="color: var(--danger)"
        :disabled="loading"
        @click="onClear"
      >
        清空当前类
      </button>
    </PageHeader>

    <div class="card">
      <div class="card-body toolbar">
        <div class="seg">
          <button
            v-for="c in CATEGORIES"
            :key="c.value"
            type="button"
            :class="{ on: category === c.value }"
            @click="category = c.value"
          >
            {{ c.label }}
          </button>
        </div>
        <input
          v-model="searchKey"
          class="input input-sm"
          placeholder="按名称关键词搜索"
          @keyup.enter="onSearch"
        />
        <button type="button" class="btn btn-sm btn-primary" :disabled="loading" @click="onSearch">
          查询
        </button>
        <span class="muted">共 {{ total }} 条</span>
      </div>

      <div class="card-body" style="padding-top: 0">
        <p v-if="loading" class="empty">加载中…</p>
        <p v-else-if="!rows.length" class="empty">暂无日志（写操作需带 @CommonLog；登录/登出由框架记录）</p>
        <table v-else class="table">
          <thead>
            <tr>
              <th style="min-width: 140px">时间</th>
              <th style="min-width: 120px">名称</th>
              <th>操作人</th>
              <th>IP</th>
              <th>请求</th>
              <th>状态</th>
              <th style="width: 72px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id">
              <td class="mono">{{ formatTime(r.opTime || r.createTime) }}</td>
              <td>
                <div>{{ r.name || '—' }}</div>
                <div class="muted tiny">{{ categoryLabel(r.category) }}</div>
              </td>
              <td>{{ r.opUser || r.createUser || '—' }}</td>
              <td class="mono">{{ r.opIp || '—' }}</td>
              <td>
                <div class="mono tiny">{{ r.reqMethod || '' }} {{ shortJson(r.reqUrl, 48) }}</div>
              </td>
              <td>
                <span
                  class="tag"
                  :class="String(r.exeStatus || '').toUpperCase() === 'SUCCESS' || r.exeStatus === '成功' ? 'tag-green' : 'tag-orange'"
                >
                  {{ r.exeStatus || '—' }}
                </span>
              </td>
              <td>
                <button type="button" class="btn-link" @click="openDetail(r)">详情</button>
              </td>
            </tr>
          </tbody>
        </table>

        <ListPager
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="total"
          :total-pages="totalPages"
          :page-nums="pageNums"
          :page-count="rows.length"
          @go="goPage"
          @update:page-size="onPageSize"
        />
      </div>
    </div>

    <div v-if="detailOpen" class="drawer-mask" @click.self="closeDetail">
      <aside class="drawer-panel" role="dialog" aria-label="日志详情">
        <div class="drawer-hd">
          <strong>日志详情</strong>
          <button type="button" class="btn btn-sm" @click="closeDetail">✕</button>
        </div>
        <div v-if="detailLoading" class="empty">加载中…</div>
        <div v-else-if="detail" class="drawer-bd">
          <dl class="kv">
            <dt>名称</dt><dd>{{ detail.name || '—' }}</dd>
            <dt>分类</dt><dd>{{ categoryLabel(detail.category) }}</dd>
            <dt>时间</dt><dd class="mono">{{ formatTime(detail.opTime || detail.createTime) }}</dd>
            <dt>操作人</dt><dd>{{ detail.opUser || detail.createUser || '—' }}</dd>
            <dt>IP / 地址</dt><dd>{{ detail.opIp || '—' }} · {{ detail.opAddress || '—' }}</dd>
            <dt>浏览器 / OS</dt><dd>{{ detail.opBrowser || '—' }} · {{ detail.opOs || '—' }}</dd>
            <dt>请求</dt><dd class="mono">{{ detail.reqMethod }} {{ detail.reqUrl }}</dd>
            <dt>类 / 方法</dt><dd class="mono tiny">{{ detail.className }}.{{ detail.methodName }}</dd>
            <dt>执行状态</dt><dd>{{ detail.exeStatus || '—' }}</dd>
            <dt>消息</dt><dd>{{ detail.exeMessage || '—' }}</dd>
          </dl>
          <div class="block">
            <div class="block-title">请求参数</div>
            <pre class="pre">{{ detail.paramJson || '—' }}</pre>
          </div>
          <div class="block">
            <div class="block-title">返回结果</div>
            <pre class="pre">{{ detail.resultJson || '—' }}</pre>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.seg button {
  border: 0;
  background: var(--bg-1);
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
.seg button.on {
  background: color-mix(in srgb, var(--primary, #2563eb) 12%, var(--bg-1));
  color: var(--primary, #2563eb);
  font-weight: 600;
}
.muted { color: var(--text-3); font-size: 12px; }
.tiny { font-size: 11px; }
.mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
.empty { padding: 24px; text-align: center; color: var(--text-3); font-size: 13px; }
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 80;
  display: flex;
  justify-content: flex-end;
}
.drawer-panel {
  width: min(520px, 100%);
  height: 100%;
  background: var(--bg-1, #fff);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}
.drawer-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.drawer-bd {
  padding: 14px 16px 24px;
  overflow: auto;
  flex: 1;
}
.kv {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 8px 12px;
  font-size: 12px;
  margin: 0 0 16px;
}
.kv dt { color: var(--text-3); }
.kv dd { margin: 0; color: var(--text-1); word-break: break-all; }
.block { margin-bottom: 12px; }
.block-title { font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text-2); }
.pre {
  margin: 0;
  padding: 10px;
  max-height: 220px;
  overflow: auto;
  font-size: 11px;
  line-height: 1.45;
  background: var(--bg-2);
  border-radius: 6px;
  border: 1px solid var(--border);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
