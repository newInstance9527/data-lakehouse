<script setup>
import { computed, reactive, watch } from 'vue'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 编辑预填；空则为新建 */
  initial: { type: Object, default: null },
})
const emit = defineEmits(['close', 'submit'])

const { showToast } = useToast()

const LAYERS = ['ODS', 'DWD', 'DWS', 'ADS', 'DIM', '任务', '消息', '临时', '视图', '接口', '指标', '质量', '其他']

const form = reactive({
  pattern: '',
  example: '',
  layer: 'DWD',
  status: 'ok',
})

const editing = computed(() => !!(props.open && props.initial?.pattern))

watch(
  () => props.open,
  (v) => {
    if (!v) return
    const init = props.initial
    if (init?.pattern) {
      Object.assign(form, {
        pattern: init.pattern || '',
        example: init.example || '',
        layer: init.layer || 'DWD',
        status: init.status || 'ok',
      })
      return
    }
    Object.assign(form, {
      pattern: '',
      example: '',
      layer: 'DWD',
      status: 'ok',
    })
  },
)

function close() {
  emit('close')
}

function submit() {
  if (!form.pattern.trim()) {
    showToast('请填写命名规则', 'warning')
    return
  }
  emit('submit', {
    pattern: form.pattern.trim(),
    example: form.example.trim() || '—',
    layer: form.layer,
    status: form.status || 'ok',
    editing: editing.value,
  })
  close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-mask" @click.self="close">
      <div class="modal" style="width: 520px">
        <div class="modal-header">
          <div>
            <div class="modal-title">{{ editing ? '编辑命名规范' : '＋ 新建命名规范' }}</div>
            <div class="modal-sub">
              {{ editing ? '修改示例或状态后保存（规则+层级为稳定键）' : '定义分层 / 任务等对象的命名模板，供开发与资产注册引用' }}
            </div>
          </div>
          <button class="btn btn-sm" @click="close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-section">
            <div class="form-grid">
              <label class="form-field wide">
                <span class="form-label"><span class="req">*</span>命名规则</span>
                <input
                  v-model="form.pattern"
                  class="input"
                  style="width: 100%"
                  placeholder="如 dwd_&lt;域&gt;_&lt;实体&gt;_&lt;粒度&gt;"
                  :disabled="editing"
                />
                <div v-if="editing" class="form-hint">规则模板为稳定键，编辑时不可改</div>
              </label>
              <label class="form-field wide">
                <span class="form-label">示例</span>
                <input
                  v-model="form.example"
                  class="input"
                  style="width: 100%"
                  placeholder="如 dwd_trade.dwd_order_detail_d"
                />
              </label>
              <label class="form-field wide">
                <span class="form-label">适用层级</span>
                <select v-model="form.layer" class="select" style="width: 100%" :disabled="editing">
                  <option v-for="l in LAYERS" :key="l" :value="l">{{ l }}</option>
                </select>
              </label>
              <label v-if="editing" class="form-field wide">
                <span class="form-label">状态</span>
                <select v-model="form.status" class="select" style="width: 100%">
                  <option value="ok">✓ 合规</option>
                  <option value="warn">⚠ 待修</option>
                  <option value="fail">✗ 违规</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <span style="flex: 1" />
          <button class="btn btn-sm" @click="close">取消</button>
          <button class="btn btn-sm btn-primary" @click="submit">{{ editing ? '保存' : '注册入库' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
