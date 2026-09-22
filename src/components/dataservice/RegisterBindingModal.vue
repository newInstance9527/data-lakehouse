<script setup>
import { reactive, watch } from 'vue'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: { type: Boolean, default: false },
  assignments: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'submit'])
const { showToast } = useToast()

const form = reactive({
  sqlrestApiId: '',
  name: '',
  publicPath: '',
  method: 'GET',
  sourceKind: 'asset',
  sourceRef: '',
  domainCode: '',
  ownerUser: '',
  publishEnv: 'stg',
})

watch(
  () => props.open,
  (v) => {
    if (!v) return
    Object.assign(form, {
      sqlrestApiId: '',
      name: '',
      publicPath: '',
      method: 'GET',
      sourceKind: 'asset',
      sourceRef: '',
      domainCode: '',
      ownerUser: '',
      publishEnv: 'stg',
    })
  },
)

function onPick(a) {
  if (!a) return
  form.sqlrestApiId = String(a.id)
  form.name = a.name || ''
  form.method = a.method || 'GET'
  const p = a.path || ''
  form.publicPath = p.startsWith('/') ? p : p.startsWith('api/') ? `/${p}` : `/api/${p}`
}

function submit() {
  if (!form.sqlrestApiId) {
    showToast('请选择或填写 SQLREST 接口 ID', 'warning')
    return
  }
  emit('submit', { ...form })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-mask" @click.self="emit('close')">
      <div class="modal reg-modal">
        <div class="modal-hd">
          <div>
            <div class="modal-title">登记绑定</div>
            <div class="tip">在 SQLREST Manager 用 SQL/Groovy 构建后，到此登记资产绑定并经 Gateway 发布</div>
          </div>
          <button type="button" class="btn btn-sm" @click="emit('close')">✕</button>
        </div>
        <div class="modal-bd">
          <label class="field">
            <span>SQLREST 接口</span>
            <select
              class="input"
              :value="form.sqlrestApiId"
              @change="
                (e) => {
                  const a = assignments.find((x) => String(x.id) === e.target.value)
                  if (a) onPick(a)
                  else form.sqlrestApiId = e.target.value
                }
              "
            >
              <option value="">从同步列表选择…</option>
              <option v-for="a in assignments" :key="a.id" :value="String(a.id)">
                {{ a.method }} {{ a.path }} · {{ a.name }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>或手动填 sqlrestApiId</span>
            <input v-model="form.sqlrestApiId" class="input" placeholder="SQLREST assignment id" />
          </label>
          <div class="grid2">
            <label class="field">
              <span>名称</span>
              <input v-model="form.name" class="input" />
            </label>
            <label class="field">
              <span>方法</span>
              <select v-model="form.method" class="input">
                <option>GET</option>
                <option>POST</option>
              </select>
            </label>
          </div>
          <label class="field">
            <span>对外路径</span>
            <input v-model="form.publicPath" class="input" placeholder="/api/..." />
          </label>
          <div class="grid2">
            <label class="field">
              <span>来源类型</span>
              <select v-model="form.sourceKind" class="input">
                <option value="asset">资产</option>
                <option value="metric">指标</option>
                <option value="sql">SQL/Groovy</option>
              </select>
            </label>
            <label class="field">
              <span>来源引用</span>
              <input v-model="form.sourceRef" class="input" placeholder="资产键 / 指标ID" />
            </label>
          </div>
          <div class="grid2">
            <label class="field">
              <span>业务域</span>
              <input v-model="form.domainCode" class="input" />
            </label>
            <label class="field">
              <span>环境</span>
              <select v-model="form.publishEnv" class="input">
                <option value="stg">stg</option>
                <option value="prod">prod</option>
              </select>
            </label>
          </div>
        </div>
        <div class="modal-ft">
          <button type="button" class="btn btn-sm" @click="emit('close')">取消</button>
          <button type="button" class="btn btn-sm btn-primary" @click="submit">登记</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
}
.reg-modal {
  width: min(520px, 92vw);
  background: var(--bg, #fff);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
.modal-hd,
.modal-ft {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border, #eee);
}
.modal-ft {
  border-bottom: none;
  border-top: 1px solid var(--border, #eee);
  gap: 8px;
  justify-content: flex-end;
}
.modal-title {
  font-weight: 600;
}
.modal-bd {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
