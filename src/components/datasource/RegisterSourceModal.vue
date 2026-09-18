<script setup>
import { computed, reactive, ref, watch } from 'vue'
import SchemaListField from '@/components/datasource/SchemaListField.vue'
import { DS_COMMON_FIELDS, dsTypeFields, dsTypeMeta } from '@/data/dsForm'
import { groupTypesByCategory } from '@/data/datasources'
import { isInventoryField } from '@/utils/schemaList'
import { useToast } from '@/composables/useToast'
import { testDatasource } from '@/api/datasource'

const props = defineProps({
  open: { type: Boolean, default: false },
  editSource: { type: Object, default: null },
})
const emit = defineEmits(['close', 'submit'])

const { showToast } = useToast()
const form = reactive({})
const tested = ref(false)
const testing = ref(false)

const typeFields = computed(() => dsTypeFields(form.type || 'MySQL'))
const isEdit = computed(() => !!props.editSource)
const syncSeed = computed(
  () => form.database || form.name || form.namespace || form.vhost || form.path || '',
)
const typeField = computed(() => DS_COMMON_FIELDS.find((f) => f.n === 'type'))
const typeGroups = computed(() => groupTypesByCategory(typeField.value?.o || []))
const basicFields = computed(() => DS_COMMON_FIELDS.filter((f) => f.n !== 'type'))

function blankForm(type = 'MySQL') {
  const next = { type }
  DS_COMMON_FIELDS.forEach((f) => {
    next[f.n] = f.def ?? ''
  })
  next.type = type
  dsTypeFields(type).forEach((f) => {
    next[f.n] = f.def ?? ''
  })
  return next
}

function resetForm() {
  Object.keys(form).forEach((k) => delete form[k])
  const seed = props.editSource
  if (seed) {
    Object.assign(form, blankForm(seed.type || 'MySQL'), {
      name: seed.name || '',
      type: seed.type || 'MySQL',
      purpose: seed.purpose || '数据入湖',
      owner: seed.owner || '李明',
      desc: seed.desc || '',
      host: seed.host || '',
      port: String(seed.port || ''),
      database: seed.database || '',
      user: seed.user || '',
      password: seed.password || '',
      extra: seed.extra || '',
      schema: seed.schema || '',
    })
    dsTypeFields(form.type).forEach((f) => {
      if (seed[f.n] != null && form[f.n] === '') form[f.n] = seed[f.n]
    })
    tested.value = true
  } else {
    Object.assign(form, blankForm('MySQL'))
    tested.value = false
  }
  testing.value = false
}

watch(
  () => props.open,
  (v) => {
    if (v) resetForm()
  },
)

watch(
  () => form.type,
  (type, prev) => {
    if (!props.open || type === prev) return
    const keep = {
      name: form.name,
      purpose: form.purpose,
      owner: form.owner,
      desc: form.desc,
    }
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, blankForm(type), keep, { type })
    tested.value = false
  },
)

function close() {
  emit('close')
}

function validate() {
  const fields = [...DS_COMMON_FIELDS.filter((f) => f.n !== 'type'), ...typeFields.value]
  for (const f of fields) {
    if (f.req && !String(form[f.n] ?? '').trim()) {
      showToast(`请填写：${f.l}`, 'error')
      return false
    }
  }
  if (!String(form.name || '').trim()) {
    showToast('请填写数据源名称', 'error')
    return false
  }
  return true
}

async function testConn() {
  if (!validate()) return
  testing.value = true
  showToast(`🧪 正在测试 ${form.type} 连通性…`, 'info')
  try {
    const res = await testDatasource({
      ...form,
      id: props.editSource?.id,
    })
    if (res?.ok) {
      tested.value = true
      showToast('✅ 连通性测试通过', 'success')
    } else {
      tested.value = false
      showToast(`连通失败：${res?.error || '未知错误'}`, 'error')
    }
  } catch (e) {
    tested.value = false
    showToast(`连通失败：${e.message || e}`, 'error')
  } finally {
    testing.value = false
  }
}

function submit() {
  if (!validate()) return
  if (!tested.value && !isEdit.value) {
    showToast('请先测试连通性', 'warning')
    return
  }
  const meta = dsTypeMeta(form.type)
  const host =
    form.host ||
    form.bootstrap ||
    form.endpoint ||
    form.nameNode ||
    form.serviceUrl ||
    form.zkQuorum ||
    form.baseURL ||
    ''
  const port = form.port || meta.port || ''
  const database =
    form.database || form.sid || form.namespace || form.vhost || form.tenant || form.db || form.path || ''
  const payload = {
    id: props.editSource?.id,
    name: form.name.trim(),
    type: form.type,
    purpose: form.purpose,
    owner: form.owner || '李明',
    desc: form.desc || '',
    host: String(host).replace(/^https?:\/\//, '').split('/')[0] || host,
    port: String(port),
    database: String(database),
    user: form.user || form.accessKey || '',
    password: form.password || form.secretKey || form.token || '',
    extra: form.extra || form.feNodes || form.warehouse || '',
    schema: form.schema || form.topics || form.queues || '',
    lag: form.access || form.pollCycle || '待探测',
    access: form.access || '',
    // 类型专属原字段一并带上，后端写入 conn
    ...Object.fromEntries(
      typeFields.value.map((f) => [f.n, form[f.n]]).filter(([, v]) => v != null && v !== ''),
    ),
  }
  emit('submit', payload)
  close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-mask" @click.self="close">
      <div class="modal ds-reg-modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">{{ isEdit ? '编辑数据源' : '＋ 注册数据源' }}</div>
            <div class="modal-sub">选类型 → 按类型填连接参数 → 测试连通 → 同步清单 → 注册入目录</div>
          </div>
          <button class="btn btn-sm" @click="close">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-section">
            <div class="form-section-title">基本信息</div>
            <div class="form-grid">
              <label class="form-field wide">
                <span class="form-label">
                  <span class="req">*</span>{{ typeField.l }}
                </span>
                <select v-model="form.type" class="select" style="width: 100%">
                  <optgroup v-for="g in typeGroups" :key="g.value" :label="g.label">
                    <option v-for="t in g.types" :key="t.value" :value="t.value">{{ t.value }}</option>
                  </optgroup>
                </select>
              </label>
              <label
                v-for="f in basicFields"
                :key="f.n"
                class="form-field"
                :class="{ wide: f.t === 'textarea' }"
              >
                <span class="form-label">
                  <span v-if="f.req" class="req">*</span>{{ f.l }}
                </span>
                <select v-if="f.t === 'select'" v-model="form[f.n]" class="select" style="width: 100%">
                  <option v-for="o in f.o" :key="o" :value="o">{{ o }}</option>
                </select>
                <textarea
                  v-else-if="f.t === 'textarea'"
                  v-model="form[f.n]"
                  class="textarea"
                  :placeholder="f.ph || ''"
                  rows="2"
                />
                <input
                  v-else
                  v-model="form[f.n]"
                  class="input"
                  style="width: 100%"
                  :placeholder="f.ph || ''"
                />
              </label>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">
              连接参数 · {{ form.type }}
              <span class="tag tag-gray" style="margin-left: 6px">类型联动</span>
            </div>
            <div v-if="!typeFields.length" class="form-hint">
              该类型复用通用连接模板（别名映射），请按 HTTP/JDBC 习惯填写。
            </div>
            <div class="form-grid">
              <div
                v-for="f in typeFields"
                :key="f.n"
                class="form-field"
                :class="{ wide: f.t === 'textarea' || isInventoryField(f) }"
              >
                <span class="form-label">
                  <span v-if="f.req" class="req">*</span>{{ f.l }}
                </span>
                <SchemaListField
                  v-if="isInventoryField(f)"
                  v-model="form[f.n]"
                  :label="f.l"
                  :can-sync="tested"
                  :placeholder="f.ph || '输入名称后添加'"
                  :source-type="form.type"
                  :field-name="f.n"
                  :seed="syncSeed"
                />
                <select
                  v-else-if="f.t === 'select'"
                  v-model="form[f.n]"
                  class="select"
                  style="width: 100%"
                >
                  <option v-for="o in f.o" :key="o" :value="o">{{ o }}</option>
                </select>
                <textarea
                  v-else-if="f.t === 'textarea'"
                  v-model="form[f.n]"
                  class="textarea"
                  :placeholder="f.ph || ''"
                  rows="2"
                />
                <input
                  v-else
                  v-model="form[f.n]"
                  class="input"
                  style="width: 100%"
                  :placeholder="f.ph || ''"
                  :type="f.n === 'password' || f.n === 'secretKey' || f.n === 'token' ? 'password' : 'text'"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <span v-if="tested" class="tag tag-green">已通过连通测试</span>
          <span style="flex: 1" />
          <button class="btn btn-sm" @click="close">取消</button>
          <button class="btn btn-sm" :disabled="testing" @click="testConn">
            {{ testing ? '测试中…' : '🧪 测试连通' }}
          </button>
          <button class="btn btn-sm btn-primary" @click="submit">
            {{ isEdit ? '保存修改' : '注册入库' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
