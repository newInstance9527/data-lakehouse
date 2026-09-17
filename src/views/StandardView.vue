<script setup>
import { computed, ref, watch } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSizeSelect from '@/components/common/PageSizeSelect.vue'
import RegisterStandardModal from '@/components/standard/RegisterStandardModal.vue'
import RegisterNamingModal from '@/components/standard/RegisterNamingModal.vue'
import { useStandards } from '@/composables/useStandards'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  STD_DETECTS,
  STD_KPIS,
  STD_MAPPINGS,
  stdStatusMeta,
} from '@/data/standards'

const { showToast } = useToast()
const { fieldList, codeList, namingList, addField, addCode, addNaming } = useStandards()
const stdGuide = pageGuideOf('standard')

const tab = ref('field')
const regOpen = ref(false)
const namingOpen = ref(false)

const fieldKw = ref('')
const domainFilter = ref('')
const fieldStatus = ref('')
const fieldPage = ref(1)
const fieldPageSize = ref(10)

const codeKw = ref('')
const codeStatus = ref('')
const codePage = ref(1)
const codePageSize = ref(10)

const mapKw = ref('')
const mapStatus = ref('')
const mapPage = ref(1)
const mapPageSize = ref(10)

const detKw = ref('')
const detStatus = ref('')
const detPage = ref(1)
const detPageSize = ref(10)

const nameKw = ref('')
const nameLayer = ref('')
const namePage = ref(1)
const namePageSize = ref(10)

const domains = computed(() => {
  const set = new Set(fieldList.value.map((f) => f.domain).filter(Boolean))
  return [...set]
})

const nameLayers = computed(() => {
  const set = new Set(namingList.value.map((n) => n.layer).filter(Boolean))
  return [...set]
})

const filteredFields = computed(() => {
  const q = fieldKw.value.trim().toLowerCase()
  return fieldList.value.filter((f) => {
    if (domainFilter.value && f.domain !== domainFilter.value) return false
    if (fieldStatus.value && f.status !== fieldStatus.value) return false
    if (!q) return true
    return `${f.name} ${f.type} ${f.unit} ${f.desc} ${f.domain}`.toLowerCase().includes(q)
  })
})

const fieldTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredFields.value.length / fieldPageSize.value)),
)
const pagedFields = computed(() => {
  const start = (fieldPage.value - 1) * fieldPageSize.value
  return filteredFields.value.slice(start, start + fieldPageSize.value)
})
const fieldPageNums = computed(() => pageNumsOf(fieldPage.value, fieldTotalPages.value))

const filteredCodes = computed(() => {
  const q = codeKw.value.trim().toLowerCase()
  return codeList.value.filter((c) => {
    if (codeStatus.value && c.status !== codeStatus.value) return false
    if (!q) return true
    return `${c.id} ${c.name} ${c.field} ${c.values} ${c.mapped}`.toLowerCase().includes(q)
  })
})

const codeTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredCodes.value.length / codePageSize.value)),
)
const pagedCodes = computed(() => {
  const start = (codePage.value - 1) * codePageSize.value
  return filteredCodes.value.slice(start, start + codePageSize.value)
})
const codePageNums = computed(() => pageNumsOf(codePage.value, codeTotalPages.value))

const filteredMappings = computed(() => {
  const q = mapKw.value.trim().toLowerCase()
  return STD_MAPPINGS.filter((m) => {
    if (mapStatus.value && m.status !== mapStatus.value) return false
    if (!q) return true
    return `${m.src} ${m.std} ${m.table} ${m.rule}`.toLowerCase().includes(q)
  })
})

const mapTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredMappings.value.length / mapPageSize.value)),
)
const pagedMappings = computed(() => {
  const start = (mapPage.value - 1) * mapPageSize.value
  return filteredMappings.value.slice(start, start + mapPageSize.value)
})
const mapPageNums = computed(() => pageNumsOf(mapPage.value, mapTotalPages.value))

const filteredDetects = computed(() => {
  const q = detKw.value.trim().toLowerCase()
  return STD_DETECTS.filter((d) => {
    if (detStatus.value && d.status !== detStatus.value) return false
    if (!q) return true
    return `${d.table} ${d.field} ${d.std} ${d.check} ${d.result}`.toLowerCase().includes(q)
  })
})

const detTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredDetects.value.length / detPageSize.value)),
)
const pagedDetects = computed(() => {
  const start = (detPage.value - 1) * detPageSize.value
  return filteredDetects.value.slice(start, start + detPageSize.value)
})
const detPageNums = computed(() => pageNumsOf(detPage.value, detTotalPages.value))

const filteredNaming = computed(() => {
  const q = nameKw.value.trim().toLowerCase()
  return namingList.value.filter((n) => {
    if (nameLayer.value && n.layer !== nameLayer.value) return false
    if (!q) return true
    return `${n.pattern} ${n.example} ${n.layer}`.toLowerCase().includes(q)
  })
})

const nameTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredNaming.value.length / namePageSize.value)),
)
const pagedNaming = computed(() => {
  const start = (namePage.value - 1) * namePageSize.value
  return filteredNaming.value.slice(start, start + namePageSize.value)
})
const namePageNums = computed(() => pageNumsOf(namePage.value, nameTotalPages.value))

const kpis = computed(() => {
  const base = STD_KPIS.map((k) => ({ ...k }))
  base[0].value = String(fieldList.value.length)
  base[1].value = String(codeList.value.length)
  base[2].value = String(STD_MAPPINGS.length)
  const fail = STD_DETECTS.filter((d) => d.status === 'fail' || d.status === 'warn').length
  base[4].value = String(fail)
  return base
})

watch([fieldKw, domainFilter, fieldStatus, fieldPageSize], () => {
  fieldPage.value = 1
})
watch([codeKw, codeStatus, codePageSize], () => {
  codePage.value = 1
})
watch([mapKw, mapStatus, mapPageSize], () => {
  mapPage.value = 1
})
watch([detKw, detStatus, detPageSize], () => {
  detPage.value = 1
})
watch([nameKw, nameLayer, namePageSize], () => {
  namePage.value = 1
})
watch(tab, (t) => {
  if (t === 'field') fieldPage.value = 1
  if (t === 'code') codePage.value = 1
  if (t === 'mapping') mapPage.value = 1
  if (t === 'detect') detPage.value = 1
  if (t === 'naming') namePage.value = 1
})

function pageNumsOf(cur, total) {
  const nums = []
  const push = (n) => {
    if (!nums.includes(n) && n >= 1 && n <= total) nums.push(n)
  }
  push(1)
  for (let i = cur - 1; i <= cur + 1; i++) push(i)
  push(total)
  return nums.sort((a, b) => a - b)
}

function goFieldPage(p) {
  if (p < 1 || p > fieldTotalPages.value) return
  fieldPage.value = p
}

function goCodePage(p) {
  if (p < 1 || p > codeTotalPages.value) return
  codePage.value = p
}

function goMapPage(p) {
  if (p < 1 || p > mapTotalPages.value) return
  mapPage.value = p
}

function goDetPage(p) {
  if (p < 1 || p > detTotalPages.value) return
  detPage.value = p
}

function goNamePage(p) {
  if (p < 1 || p > nameTotalPages.value) return
  namePage.value = p
}

function openRegister() {
  regOpen.value = true
}

function openNamingRegister() {
  namingOpen.value = true
  tab.value = 'naming'
}

function onRegisterSubmit(payload) {
  if (payload.kind === 'field') {
    addField(payload)
    tab.value = 'field'
    showToast(`✅ 已注册标准字段 ${payload.name}`, 'success')
  } else {
    addCode(payload)
    tab.value = 'code'
    showToast(`✅ 已注册标准码值 ${payload.id}`, 'success')
  }
}

function onNamingSubmit(payload) {
  addNaming(payload)
  tab.value = 'naming'
  showToast(`✅ 已注册命名规范 ${payload.pattern}`, 'success')
}
</script>

<template>
  <div>
    <PageHeader
      title="📐 数据标准"
      subtitle="标准字段库 · 标准码值 · 命名规范 · 源到标准映射 · 落地检测"
      :guide-title="stdGuide.title"
      :guide="stdGuide"
    >
      <button class="btn btn-sm" @click="openRegister">＋ 新建标准</button>
      <button class="btn btn-sm btn-primary" @click="openNamingRegister">＋ 新建规范</button>
    </PageHeader>

    <div class="kpi-grid std-kpi-grid">
      <div v-for="k in kpis" :key="k.key" class="kpi-card">
        <div class="ds-kpi-top">
          <span :style="{ color: k.color }">{{ k.icon }}</span>
          <span style="color: var(--text-3); font-size: 11px">{{ k.sub }}</span>
        </div>
        <div class="kpi-value" :style="{ color: k.color, fontSize: '22px' }">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="card" style="margin-top: 16px">
      <div class="card-header" style="padding-bottom: 0">
        <div class="std-tabs" style="margin: 0">
          <span class="std-tab" :class="{ active: tab === 'field' }" @click="tab = 'field'">📐 标准字段</span>
          <span class="std-tab" :class="{ active: tab === 'code' }" @click="tab = 'code'">🏷️ 标准码值</span>
          <span class="std-tab" :class="{ active: tab === 'mapping' }" @click="tab = 'mapping'">🔗 源到标准映射</span>
          <span class="std-tab" :class="{ active: tab === 'detect' }" @click="tab = 'detect'">✅ 落地检测</span>
          <span class="std-tab" :class="{ active: tab === 'naming' }" @click="tab = 'naming'">📝 命名规范</span>
        </div>
      </div>
      <div class="card-body">
        <!-- 标准字段：列表 + 分页 -->
        <div v-show="tab === 'field'">
          <div class="ds-filters" style="margin-bottom: 10px">
            <input
              v-model="fieldKw"
              class="input"
              style="width: 260px"
              placeholder="搜索字段名 / 类型 / 含义…"
            />
            <select v-model="domainFilter" class="select input-sm">
              <option value="">全部域</option>
              <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
            </select>
            <select v-model="fieldStatus" class="select input-sm">
              <option value="">全部状态</option>
              <option value="ok">✓ 标准</option>
              <option value="warn">⚠ 待修复</option>
              <option value="fail">✗ 阻断</option>
            </select>
            <span class="tag tag-blue">筛选 {{ filteredFields.length }} / 共 {{ fieldList.length }}</span>
          </div>
          <div style="overflow: auto">
            <table class="std-table" style="font-size: 12px">
              <thead>
                <tr>
                  <th style="width: 14%">字段名</th>
                  <th style="width: 12%">类型</th>
                  <th style="width: 8%">单位</th>
                  <th>业务含义</th>
                  <th style="width: 8%">所属域</th>
                  <th style="width: 8%">映射数</th>
                  <th style="width: 10%">状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!pagedFields.length">
                  <td colspan="7" style="text-align: center; color: var(--text-3); padding: 28px">无匹配字段</td>
                </tr>
                <tr v-for="f in pagedFields" :key="f.name">
                  <td><code class="sf-name">{{ f.name }}</code></td>
                  <td class="sf-type">{{ f.type }}</td>
                  <td class="sf-unit">{{ f.unit }}</td>
                  <td style="color: var(--text-2)">{{ f.desc }}</td>
                  <td><span class="tag tag-blue" style="font-size: 10px">{{ f.domain }}</span></td>
                  <td style="text-align: center">{{ f.mapped }}</td>
                  <td>
                    <span class="tag" :class="stdStatusMeta(f.status).tag" style="font-size: 10px">
                      {{ stdStatusMeta(f.status).label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredFields.length" class="ds-pager" style="margin-top: 12px">
            <div class="ds-pager-info">
              第 {{ fieldPage }} / {{ fieldTotalPages }} 页 · 本页 {{ pagedFields.length }} 条 · 共 {{ filteredFields.length }} 条
            </div>
            <div class="ds-pager-controls">
              <PageSizeSelect v-model="fieldPageSize" />
              <button class="btn btn-sm" :disabled="fieldPage <= 1" @click="goFieldPage(fieldPage - 1)">上一页</button>
              <template v-for="(n, i) in fieldPageNums" :key="n">
                <span v-if="i > 0 && n - fieldPageNums[i - 1] > 1" class="ds-pager-ellipsis">…</span>
                <button
                  class="btn btn-sm"
                  :class="{ 'btn-primary': n === fieldPage }"
                  @click="goFieldPage(n)"
                >{{ n }}</button>
              </template>
              <button class="btn btn-sm" :disabled="fieldPage >= fieldTotalPages" @click="goFieldPage(fieldPage + 1)">下一页</button>
            </div>
          </div>
        </div>

        <!-- 标准码值：列表 + 分页 -->
        <div v-show="tab === 'code'">
          <div class="ds-filters" style="margin-bottom: 10px">
            <input
              v-model="codeKw"
              class="input"
              style="width: 280px"
              placeholder="搜索码值 ID / 名称 / 字段 / 枚举…"
            />
            <select v-model="codeStatus" class="select input-sm">
              <option value="">全部状态</option>
              <option value="ok">✓ 合规</option>
              <option value="warn">⚠ 待修复</option>
              <option value="fail">✗ 阻断</option>
            </select>
            <span class="tag tag-blue">筛选 {{ filteredCodes.length }} / 共 {{ codeList.length }}</span>
          </div>
          <div style="overflow: auto">
            <table class="std-table" style="font-size: 12px">
              <thead>
                <tr>
                  <th style="width: 12%">码值 ID</th>
                  <th style="width: 12%">名称</th>
                  <th style="width: 12%">关联字段</th>
                  <th style="width: 8%">枚举数</th>
                  <th>枚举预览</th>
                  <th style="width: 18%">已映射表</th>
                  <th style="width: 10%">状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!pagedCodes.length">
                  <td colspan="7" style="text-align: center; color: var(--text-3); padding: 28px">无匹配码值</td>
                </tr>
                <tr v-for="c in pagedCodes" :key="c.id">
                  <td><span class="std-code-badge">{{ c.id }}</span></td>
                  <td style="font-weight: 600">{{ c.name }}</td>
                  <td><code>{{ c.field }}</code></td>
                  <td style="text-align: center">{{ c.count }}</td>
                  <td style="color: var(--text-2); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap" :title="c.values">
                    {{ c.values }}
                  </td>
                  <td style="color: var(--text-2)">{{ c.mapped }}</td>
                  <td>
                    <span class="tag" :class="stdStatusMeta(c.status, 'code').tag" style="font-size: 10px">
                      {{ stdStatusMeta(c.status, 'code').label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredCodes.length" class="ds-pager" style="margin-top: 12px">
            <div class="ds-pager-info">
              第 {{ codePage }} / {{ codeTotalPages }} 页 · 本页 {{ pagedCodes.length }} 条 · 共 {{ filteredCodes.length }} 条
            </div>
            <div class="ds-pager-controls">
              <PageSizeSelect v-model="codePageSize" />
              <button class="btn btn-sm" :disabled="codePage <= 1" @click="goCodePage(codePage - 1)">上一页</button>
              <template v-for="(n, i) in codePageNums" :key="n">
                <span v-if="i > 0 && n - codePageNums[i - 1] > 1" class="ds-pager-ellipsis">…</span>
                <button
                  class="btn btn-sm"
                  :class="{ 'btn-primary': n === codePage }"
                  @click="goCodePage(n)"
                >{{ n }}</button>
              </template>
              <button class="btn btn-sm" :disabled="codePage >= codeTotalPages" @click="goCodePage(codePage + 1)">下一页</button>
            </div>
          </div>
        </div>

        <!-- 源到标准映射：列表 + 分页 -->
        <div v-show="tab === 'mapping'">
          <div class="form-hint" style="margin-bottom: 10px">
            记录源系统字段如何转换到标准字段，供 ETL 清洗与质量规则引用。
          </div>
          <div class="ds-filters" style="margin-bottom: 10px">
            <input
              v-model="mapKw"
              class="input"
              style="width: 280px"
              placeholder="搜索源字段 / 标准 / 目标表 / 规则…"
            />
            <select v-model="mapStatus" class="select input-sm">
              <option value="">全部状态</option>
              <option value="ok">✓ 正常</option>
              <option value="warn">⚠ 告警</option>
              <option value="fail">✗ 阻断</option>
            </select>
            <span class="tag tag-blue">筛选 {{ filteredMappings.length }} / 共 {{ STD_MAPPINGS.length }}</span>
          </div>
          <div style="overflow: auto">
            <table class="std-table" style="font-size: 12px">
              <thead>
                <tr>
                  <th style="width: 18%">源字段</th>
                  <th style="width: 20%">标准字段</th>
                  <th style="width: 16%">目标表</th>
                  <th>映射规则</th>
                  <th style="width: 10%">状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!pagedMappings.length">
                  <td colspan="5" style="text-align: center; color: var(--text-3); padding: 28px">无匹配映射</td>
                </tr>
                <tr v-for="(m, i) in pagedMappings" :key="m.src + i">
                  <td><code class="mr-src">{{ m.src }}</code></td>
                  <td><code class="mr-std">{{ m.std }}</code></td>
                  <td style="color: var(--text-2)">{{ m.table }}</td>
                  <td style="color: var(--text-2)">{{ m.rule }}</td>
                  <td>
                    <span class="tag" :class="stdStatusMeta(m.status, 'mapping').tag" style="font-size: 10px">
                      {{ stdStatusMeta(m.status, 'mapping').label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredMappings.length" class="ds-pager" style="margin-top: 12px">
            <div class="ds-pager-info">
              第 {{ mapPage }} / {{ mapTotalPages }} 页 · 本页 {{ pagedMappings.length }} 条 · 共 {{ filteredMappings.length }} 条
            </div>
            <div class="ds-pager-controls">
              <PageSizeSelect v-model="mapPageSize" />
              <button class="btn btn-sm" :disabled="mapPage <= 1" @click="goMapPage(mapPage - 1)">上一页</button>
              <template v-for="(n, i) in mapPageNums" :key="n">
                <span v-if="i > 0 && n - mapPageNums[i - 1] > 1" class="ds-pager-ellipsis">…</span>
                <button
                  class="btn btn-sm"
                  :class="{ 'btn-primary': n === mapPage }"
                  @click="goMapPage(n)"
                >{{ n }}</button>
              </template>
              <button class="btn btn-sm" :disabled="mapPage >= mapTotalPages" @click="goMapPage(mapPage + 1)">下一页</button>
            </div>
          </div>
        </div>

        <!-- 落地检测：列表 + 分页 -->
        <div v-show="tab === 'detect'">
          <div class="form-hint" style="margin-bottom: 10px">
            对已落地表字段做标准合规抽检（码值、类型、单位、脱敏等），异常可联动质量阻断。
          </div>
          <div class="ds-filters" style="margin-bottom: 10px">
            <input
              v-model="detKw"
              class="input"
              style="width: 280px"
              placeholder="搜索表 / 字段 / 标准 / 结果…"
            />
            <select v-model="detStatus" class="select input-sm">
              <option value="">全部状态</option>
              <option value="ok">✓ 合规</option>
              <option value="warn">⚠ 告警</option>
              <option value="fail">✗ 阻断</option>
            </select>
            <span class="tag tag-blue">筛选 {{ filteredDetects.length }} / 共 {{ STD_DETECTS.length }}</span>
          </div>
          <div style="overflow: auto">
            <table class="std-table" style="font-size: 12px">
              <thead>
                <tr>
                  <th style="width: 22%">表.字段</th>
                  <th style="width: 14%">标准</th>
                  <th style="width: 12%">检测项</th>
                  <th>结果</th>
                  <th style="width: 10%">状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!pagedDetects.length">
                  <td colspan="5" style="text-align: center; color: var(--text-3); padding: 28px">无匹配检测记录</td>
                </tr>
                <tr v-for="(d, i) in pagedDetects" :key="d.table + d.field + i">
                  <td><code style="font-size: 11px">{{ d.table }}.{{ d.field }}</code></td>
                  <td><span class="std-code-badge">{{ d.std }}</span></td>
                  <td>{{ d.check }}</td>
                  <td style="color: var(--text-2)">{{ d.result }}</td>
                  <td>
                    <span class="tag" :class="stdStatusMeta(d.status, 'detect').tag" style="font-size: 10px">
                      {{ stdStatusMeta(d.status, 'detect').label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredDetects.length" class="ds-pager" style="margin-top: 12px">
            <div class="ds-pager-info">
              第 {{ detPage }} / {{ detTotalPages }} 页 · 本页 {{ pagedDetects.length }} 条 · 共 {{ filteredDetects.length }} 条
            </div>
            <div class="ds-pager-controls">
              <PageSizeSelect v-model="detPageSize" />
              <button class="btn btn-sm" :disabled="detPage <= 1" @click="goDetPage(detPage - 1)">上一页</button>
              <template v-for="(n, i) in detPageNums" :key="n">
                <span v-if="i > 0 && n - detPageNums[i - 1] > 1" class="ds-pager-ellipsis">…</span>
                <button
                  class="btn btn-sm"
                  :class="{ 'btn-primary': n === detPage }"
                  @click="goDetPage(n)"
                >{{ n }}</button>
              </template>
              <button class="btn btn-sm" :disabled="detPage >= detTotalPages" @click="goDetPage(detPage + 1)">下一页</button>
            </div>
          </div>
        </div>

        <!-- 命名规范：列表 + 分页 -->
        <div v-show="tab === 'naming'">
          <div class="ds-filters" style="margin-bottom: 10px">
            <input
              v-model="nameKw"
              class="input"
              style="width: 280px"
              placeholder="搜索规则 / 示例 / 层级…"
            />
            <select v-model="nameLayer" class="select input-sm">
              <option value="">全部层级</option>
              <option v-for="l in nameLayers" :key="l" :value="l">{{ l }}</option>
            </select>
            <span class="tag tag-blue">筛选 {{ filteredNaming.length }} / 共 {{ namingList.length }}</span>
            <span style="flex: 1" />
          </div>
          <div style="overflow: auto">
            <table class="std-table" style="font-size: 12px">
              <thead>
                <tr>
                  <th style="width: 32%">命名规则</th>
                  <th style="width: 32%">示例</th>
                  <th style="width: 12%">层级</th>
                  <th style="width: 12%">状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!pagedNaming.length">
                  <td colspan="4" style="text-align: center; color: var(--text-3); padding: 28px">无匹配规范</td>
                </tr>
                <tr v-for="(n, i) in pagedNaming" :key="n.pattern + i">
                  <td><code style="font-size: 12px; font-weight: 600">{{ n.pattern }}</code></td>
                  <td><code style="font-size: 11px; color: var(--text-2)">{{ n.example }}</code></td>
                  <td><span class="tag tag-blue">{{ n.layer }}</span></td>
                  <td>
                    <span class="tag" :class="stdStatusMeta(n.status, 'naming').tag" style="font-size: 10px">
                      {{ stdStatusMeta(n.status, 'naming').label }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredNaming.length" class="ds-pager" style="margin-top: 12px">
            <div class="ds-pager-info">
              第 {{ namePage }} / {{ nameTotalPages }} 页 · 本页 {{ pagedNaming.length }} 条 · 共 {{ filteredNaming.length }} 条
            </div>
            <div class="ds-pager-controls">
              <PageSizeSelect v-model="namePageSize" />
              <button class="btn btn-sm" :disabled="namePage <= 1" @click="goNamePage(namePage - 1)">上一页</button>
              <template v-for="(n, i) in namePageNums" :key="n">
                <span v-if="i > 0 && n - namePageNums[i - 1] > 1" class="ds-pager-ellipsis">…</span>
                <button
                  class="btn btn-sm"
                  :class="{ 'btn-primary': n === namePage }"
                  @click="goNamePage(n)"
                >{{ n }}</button>
              </template>
              <button class="btn btn-sm" :disabled="namePage >= nameTotalPages" @click="goNamePage(namePage + 1)">下一页</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <RegisterStandardModal
      :open="regOpen"
      @close="regOpen = false"
      @submit="onRegisterSubmit"
    />

    <RegisterNamingModal
      :open="namingOpen"
      @close="namingOpen = false"
      @submit="onNamingSubmit"
    />
  </div>
</template>
