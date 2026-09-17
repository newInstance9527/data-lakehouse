<script setup>
import { reactive, watch } from 'vue'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'submit'])

const { showToast } = useToast()

const LAYERS = ['ODS', 'DWD', 'DWS', 'ADS', 'DIM', '任务', '消息', '临时', '视图', '接口', '指标', '质量', '其他']

const form = reactive({
  pattern: '',
  example: '',
  layer: 'DWD',
})

watch(
  () => props.open,
  (v) => {
    if (!v) return
    Object.assign(form, {
      pattern: '',
      example: '',
      layer: 'DWD',
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
    status: 'ok',
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
            <div class="modal-title">＋ 新建命名规范</div>
            <div class="modal-sub">定义分层 / 任务等对象的命名模板，供开发与资产注册引用</div>
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
                />
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
                <select v-model="form.layer" class="select" style="width: 100%">
                  <option v-for="l in LAYERS" :key="l" :value="l">{{ l }}</option>
                </select>
              </label>
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
