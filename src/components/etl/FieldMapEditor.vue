<script setup>
import SearchSelect from '@/components/common/SearchSelect.vue'
import { fieldSelectOptions } from '@/utils/etlFields'
import { MAPPING_STRATEGIES } from '@/data/etl'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  srcFields: { type: Array, default: () => [] },
  dstFields: { type: Array, default: () => [] },
  /** dst 列标题 */
  dstLabel: { type: String, default: '目标字段' },
  srcLabel: { type: String, default: '源字段' },
  showTransform: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'auto-map'])

const srcOpts = () => fieldSelectOptions(props.srcFields)
const dstOpts = () => fieldSelectOptions(props.dstFields)

function rows() {
  return Array.isArray(props.modelValue) ? props.modelValue : []
}

function update(next) {
  emit('update:modelValue', next)
}

function patchRow(i, key, val) {
  const next = rows().map((r, idx) => (idx === i ? { ...r, [key]: val } : r))
  update(next)
}

function addRow() {
  update([...rows(), { src: '', dst: '', transform: '直接映射' }])
}

function removeRow(i) {
  update(rows().filter((_, idx) => idx !== i))
}
</script>

<template>
  <div class="fmap">
    <div class="fmap-toolbar">
      <span class="form-label" style="margin: 0">字段映射</span>
      <span style="flex: 1" />
      <button type="button" class="btn btn-sm" :disabled="!srcFields.length || !dstFields.length" @click="emit('auto-map')">
        同名映射
      </button>
      <button type="button" class="btn btn-sm" @click="addRow">＋ 添加</button>
    </div>

    <div v-if="!srcFields.length" class="form-hint">暂无源字段：请先配置上游节点或源表</div>
    <div v-else-if="!rows().length" class="form-hint">尚未配置映射，可「同名映射」或逐条添加</div>

    <div v-for="(row, i) in rows()" :key="i" class="fmap-row">
      <SearchSelect
        :model-value="row.src"
        :options="srcOpts()"
        sub-key="sub"
        allow-custom
        :placeholder="`搜索${srcLabel}或自定义`"
        @update:model-value="patchRow(i, 'src', $event)"
      />
      <span class="fmap-arrow">→</span>
      <SearchSelect
        :model-value="row.dst"
        :options="dstOpts()"
        sub-key="sub"
        allow-custom
        :placeholder="`搜索${dstLabel}或自定义`"
        @update:model-value="patchRow(i, 'dst', $event)"
      />
      <select
        v-if="showTransform"
        class="select input-sm"
        :value="row.transform || '直接映射'"
        @change="patchRow(i, 'transform', $event.target.value)"
      >
        <option v-for="s in MAPPING_STRATEGIES" :key="s" :value="s">{{ s }}</option>
      </select>
      <button type="button" class="btn btn-sm fmap-del" title="删除" @click="removeRow(i)">✕</button>
    </div>

    <div v-if="srcFields.length" class="fmap-upstream">
      <span class="form-hint">可用源字段：</span>
      <code v-for="f in srcFields.slice(0, 12)" :key="f.name" class="fmap-chip" :title="f.cn">{{ f.name }}</code>
      <span v-if="srcFields.length > 12" class="form-hint">+{{ srcFields.length - 12 }}</span>
    </div>
  </div>
</template>

<style scoped>
.fmap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fmap-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fmap-row {
  display: grid;
  grid-template-columns: 1fr 16px 1fr minmax(88px, 0.85fr) 28px;
  gap: 6px;
  align-items: center;
}
.fmap-arrow {
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
}
.fmap-del {
  padding: 4px 6px;
  color: var(--text-3);
}
.fmap-upstream {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.fmap-chip {
  font-size: 10px;
  padding: 1px 5px;
  background: var(--bg-2, #f5f7fa);
  border-radius: 4px;
  color: var(--text-2);
}
</style>
