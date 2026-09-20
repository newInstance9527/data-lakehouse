<script setup>
import { computed, reactive, watch } from 'vue'
import SearchSelect from '@/components/common/SearchSelect.vue'
import { useStandards } from '@/composables/useStandards'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 编辑预填 */
  initial: { type: Object, default: null },
})
const emit = defineEmits(['close', 'submit'])

const { showToast } = useToast()
const { fieldList, codeList } = useStandards()

const form = reactive({
  srcObject: '',
  srcField: '',
  stdFieldName: '',
  codeSetId: '',
  targetTable: '',
  ruleText: '',
  status: 'ok',
  dsId: '',
  etlJobId: '',
  remark: '',
})

const editing = computed(() => Boolean(props.initial?.id))

const fieldOptions = computed(() =>
  fieldList.value.map((f) => ({
    value: f.name,
    label: f.name,
    sub: `${f.domain || '—'} · ${f.type || '—'}${f.desc ? ` · ${f.desc}` : ''}`,
  })),
)

const codeOptions = computed(() =>
  codeList.value.map((c) => ({
    value: c.id,
    label: `${c.id} · ${c.name || ''}`,
    sub: c.field ? `绑定 ${c.field}` : '',
  })),
)

watch(
  () => props.open,
  (v) => {
    if (!v) return
    const init = props.initial
    if (init?.id || init?.src) {
      const src = String(init.src || '')
      const dot = src.lastIndexOf('.')
      Object.assign(form, {
        srcObject: init.srcObject || (dot > 0 ? src.slice(0, dot) : ''),
        srcField: init.srcField || (dot > 0 ? src.slice(dot + 1) : src),
        stdFieldName: init.stdFieldName || String(init.std || '').replace(/\(.*\)$/, '').trim(),
        codeSetId: init.codeSetId || '',
        targetTable: init.targetTable || init.table || '',
        ruleText: init.ruleText || init.rule || '',
        status: init.status || 'ok',
        dsId: init.dsId || '',
        etlJobId: init.etlJobId || '',
        remark: init.remark || '',
      })
    } else {
      Object.assign(form, {
        srcObject: '',
        srcField: '',
        stdFieldName: '',
        codeSetId: '',
        targetTable: '',
        ruleText: '',
        status: 'ok',
        dsId: '',
        etlJobId: '',
        remark: '',
      })
    }
  },
)

function onSubmit() {
  if (!form.srcObject.trim() || !form.srcField.trim()) {
    showToast('请填写源对象与源字段', 'warning')
    return
  }
  if (!form.stdFieldName.trim()) {
    showToast('请选择或填写标准字段', 'warning')
    return
  }
  if (!form.targetTable.trim()) {
    showToast('请填写目标表', 'warning')
    return
  }
  emit('submit', {
    editing: editing.value,
    id: props.initial?.id,
    srcObject: form.srcObject.trim(),
    srcField: form.srcField.trim(),
    src: `${form.srcObject.trim()}.${form.srcField.trim()}`,
    stdFieldName: form.stdFieldName.trim(),
    codeSetId: form.codeSetId.trim() || undefined,
    targetTable: form.targetTable.trim(),
    table: form.targetTable.trim(),
    ruleText: form.ruleText.trim() || '直接映射',
    rule: form.ruleText.trim() || '直接映射',
    status: form.status || 'ok',
    dsId: form.dsId.trim() || undefined,
    etlJobId: form.etlJobId.trim() || undefined,
    remark: form.remark.trim() || undefined,
  })
}
</script>

<template>
  <div v-if="open" class="modal-mask" @click.self="emit('close')">
    <div class="modal-card" style="width: min(560px, 94vw)">
      <div class="modal-head">
        <div>
          <div class="modal-title">{{ editing ? '编辑源到标准映射' : '＋ 新建映射' }}</div>
          <div class="form-hint">源字段 → 标准字段；供 ETL / 质量引用。空库可手工补录。</div>
        </div>
        <button class="btn btn-sm" type="button" @click="emit('close')">✕</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
          <label class="form-field">
            <span class="form-label">源对象 *</span>
            <input v-model="form.srcObject" class="input" placeholder="如 s_order / ods.trade" />
          </label>
          <label class="form-field">
            <span class="form-label">源字段 *</span>
            <input v-model="form.srcField" class="input" placeholder="如 stat / order_status" />
          </label>
        </div>
        <label class="form-field">
          <span class="form-label">标准字段 *</span>
          <SearchSelect
            v-model="form.stdFieldName"
            :options="fieldOptions"
            placeholder="从标准字段库选择，或输入新名"
            :allow-custom="true"
          />
        </label>
        <label class="form-field">
          <span class="form-label">关联码值集（可选）</span>
          <SearchSelect
            v-model="form.codeSetId"
            :options="codeOptions"
            placeholder="选择标准码值集（可留空）"
            :allow-custom="true"
          />
        </label>
        <label class="form-field">
          <span class="form-label">目标表 *</span>
          <input v-model="form.targetTable" class="input" placeholder="如 dwd_trade.dwd_order_detail_d" />
        </label>
        <label class="form-field">
          <span class="form-label">映射规则</span>
          <textarea
            v-model="form.ruleText"
            class="input"
            rows="3"
            placeholder="如 CASE WHEN stat=1 THEN 'PAID' … 或「直接映射」"
          />
        </label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
          <label class="form-field">
            <span class="form-label">状态</span>
            <select v-model="form.status" class="select">
              <option value="ok">✓ 正常</option>
              <option value="warn">⚠ 告警</option>
              <option value="fail">✗ 阻断</option>
            </select>
          </label>
          <label class="form-field">
            <span class="form-label">ETL 作业 ID（可选）</span>
            <input v-model="form.etlJobId" class="input" placeholder="dag_code / 作业 id" />
          </label>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" type="button" @click="emit('close')">取消</button>
        <button class="btn btn-primary" type="button" @click="onSubmit">
          {{ editing ? '保存' : '登记映射' }}
        </button>
      </div>
    </div>
  </div>
</template>
