<script setup>
import { computed, reactive, ref, watch } from 'vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import { useStandards } from '@/composables/useStandards'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'submit'])

const { showToast } = useToast()
const { fieldList } = useStandards()

const form = reactive({
  kind: 'field',
  name: '',
  type: 'VARCHAR(64)',
  unit: '—',
  domain: '交易',
  desc: '',
  id: '',
  field: '',
})

const enumRows = ref([{ code: '', label: '' }])

const fieldOptions = computed(() =>
  fieldList.value.map((f) => ({
    value: f.name,
    label: f.name,
    sub: `${f.domain} · ${f.type}${f.desc ? ` · ${f.desc}` : ''}`,
  })),
)

watch(
  () => props.open,
  (v) => {
    if (!v) return
    Object.assign(form, {
      kind: 'field',
      name: '',
      type: 'VARCHAR(64)',
      unit: '—',
      domain: '交易',
      desc: '',
      id: '',
      field: '',
    })
    enumRows.value = [{ code: '', label: '' }]
  },
)

function addEnumRow() {
  enumRows.value.push({ code: '', label: '' })
}

function removeEnumRow(i) {
  if (enumRows.value.length <= 1) {
    enumRows.value = [{ code: '', label: '' }]
    return
  }
  enumRows.value.splice(i, 1)
}

function serializeEnums() {
  return enumRows.value
    .map((r) => ({ code: r.code.trim(), label: r.label.trim() }))
    .filter((r) => r.code || r.label)
    .map((r) => (r.label ? `${r.code}=${r.label}` : r.code))
    .join(', ')
}

function close() {
  emit('close')
}

function submit() {
  if (form.kind === 'field') {
    if (!form.name.trim()) {
      showToast('请填写字段名', 'warning')
      return
    }
    emit('submit', {
      kind: 'field',
      name: form.name.trim(),
      type: form.type.trim() || 'VARCHAR(64)',
      unit: form.unit.trim() || '—',
      domain: form.domain,
      desc: form.desc.trim(),
    })
  } else {
    if (!form.id.trim() || !form.name.trim() || !form.field.trim()) {
      showToast('请填写码值 ID、名称与绑定字段', 'warning')
      return
    }
    const pairs = enumRows.value
      .map((r) => ({ code: r.code.trim(), label: r.label.trim() }))
      .filter((r) => r.code || r.label)
    if (!pairs.length) {
      showToast('请至少添加一条枚举值', 'warning')
      return
    }
    const incomplete = pairs.find((r) => !r.code || !r.label)
    if (incomplete) {
      showToast('枚举值需同时填写编码与含义', 'warning')
      return
    }
    emit('submit', {
      kind: 'code',
      id: form.id.trim(),
      name: form.name.trim(),
      field: form.field.trim(),
      values: serializeEnums(),
    })
  }
  close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-mask" @click.self="close">
      <div class="modal" style="width: 560px">
        <div class="modal-header">
          <div>
            <div class="modal-title">＋ 新建标准</div>
            <div class="modal-sub">标准字段或标准码值 · 注册后可供资产映射与落地检测引用</div>
          </div>
          <button class="btn btn-sm" @click="close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-section">
            <div class="form-section-title">类型</div>
            <div class="std-kind-tabs">
              <button
                type="button"
                class="btn btn-sm"
                :class="{ 'btn-primary': form.kind === 'field' }"
                @click="form.kind = 'field'"
              >📐 标准字段</button>
              <button
                type="button"
                class="btn btn-sm"
                :class="{ 'btn-primary': form.kind === 'code' }"
                @click="form.kind = 'code'"
              >🏷️ 标准码值</button>
            </div>
          </div>

          <div v-if="form.kind === 'field'" class="form-section">
            <div class="form-section-title">字段信息</div>
            <div class="form-grid">
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>字段名</span>
                <input v-model="form.name" class="input" style="width: 100%" placeholder="如 order_status" />
              </label>
              <label class="form-field">
                <span class="form-label">类型</span>
                <input v-model="form.type" class="input" style="width: 100%" placeholder="INT / VARCHAR(32)" />
              </label>
              <label class="form-field">
                <span class="form-label">单位</span>
                <input v-model="form.unit" class="input" style="width: 100%" placeholder="元 / 分 / 码值 / —" />
              </label>
              <label class="form-field">
                <span class="form-label">业务域</span>
                <select v-model="form.domain" class="select" style="width: 100%">
                  <option>交易</option>
                  <option>用户</option>
                  <option>商品</option>
                  <option>通用</option>
                  <option>营销</option>
                  <option>财务</option>
                  <option>门店</option>
                </select>
              </label>
              <label class="form-field wide">
                <span class="form-label">业务含义</span>
                <textarea v-model="form.desc" class="textarea" rows="2" placeholder="标准字段业务说明" />
              </label>
            </div>
          </div>

          <div v-else class="form-section">
            <div class="form-section-title">码值信息</div>
            <div class="form-grid">
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>标准 ID</span>
                <input v-model="form.id" class="input" style="width: 100%" placeholder="如 STD-C0021" />
              </label>
              <label class="form-field">
                <span class="form-label"><span class="req">*</span>名称</span>
                <input v-model="form.name" class="input" style="width: 100%" placeholder="如 订单状态" />
              </label>
              <div class="form-field wide">
                <span class="form-label"><span class="req">*</span>绑定字段</span>
                <SearchSelect
                  v-model="form.field"
                  :options="fieldOptions"
                  value-key="value"
                  label-key="label"
                  sub-key="sub"
                  allow-custom
                  placeholder="选择已有标准字段，或输入自定义字段名"
                  empty-text="无匹配字段，可输入后使用自定义"
                />
                <div class="form-hint">可从标准字段库选择，也可直接输入新字段名</div>
              </div>
            </div>

            <div class="form-section-title" style="margin-top: 16px">
              <span class="req">*</span>枚举值
              <span style="font-weight: 400; color: var(--text-3); margin-left: 8px">逐条维护编码与含义</span>
            </div>
            <div class="enum-editor">
              <div class="enum-head">
                <span>编码</span>
                <span>含义</span>
                <span />
              </div>
              <div v-for="(row, i) in enumRows" :key="i" class="enum-row">
                <input
                  v-model="row.code"
                  class="input"
                  placeholder="如 0"
                  @keydown.enter.prevent="addEnumRow"
                />
                <input
                  v-model="row.label"
                  class="input"
                  placeholder="如 草稿"
                  @keydown.enter.prevent="addEnumRow"
                />
                <button
                  type="button"
                  class="btn btn-sm enum-del"
                  title="删除"
                  :disabled="enumRows.length === 1 && !row.code && !row.label"
                  @click="removeEnumRow(i)"
                >✕</button>
              </div>
              <button type="button" class="btn btn-sm enum-add" @click="addEnumRow">＋ 添加枚举</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <span style="flex: 1" />
          <button class="btn btn-sm" @click="close">取消</button>
          <button class="btn btn-sm btn-primary" @click="submit">注册入库</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.std-kind-tabs {
  display: flex;
  gap: 8px;
}
.enum-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.enum-head,
.enum-row {
  display: grid;
  grid-template-columns: 120px 1fr 36px;
  gap: 8px;
  align-items: center;
}
.enum-head {
  font-size: 11px;
  color: var(--text-3);
  padding: 0 2px;
}
.enum-del {
  padding: 4px 8px;
  color: var(--text-3);
}
.enum-del:hover:not(:disabled) {
  color: var(--danger, #cf1322);
}
.enum-add {
  align-self: flex-start;
  margin-top: 2px;
}
</style>
