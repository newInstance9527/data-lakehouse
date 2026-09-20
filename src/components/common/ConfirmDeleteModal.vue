<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import {
  CONFIRM_PHRASE,
  isConfirmPhraseMatch,
  settleConfirmDelete,
  useConfirmDeleteState,
} from '@/composables/useConfirmDelete'

const state = useConfirmDeleteState()
const inputRef = ref(null)

const canConfirm = computed(
  () => isConfirmPhraseMatch(state.input) && !state.busy,
)

watch(
  () => state.open,
  async (open) => {
    if (!open) return
    state.input = ''
    await nextTick()
    inputRef.value?.focus?.()
  },
)

function onCancel() {
  if (state.busy) return
  settleConfirmDelete(false)
}

function onConfirm() {
  if (!canConfirm.value) return
  settleConfirmDelete(true)
}

function onMaskClick() {
  onCancel()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="modal-mask confirm-delete-mask"
      @click.self="onMaskClick"
    >
      <div
        class="modal confirm-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        @keydown.esc.stop="onCancel"
      >
        <div class="modal-header">
          <div>
            <div id="confirm-delete-title" class="modal-title">{{ state.title }}</div>
            <div v-if="state.message" class="modal-sub">{{ state.message }}</div>
          </div>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="state.busy"
            title="关闭"
            @click="onCancel"
          >✕</button>
        </div>
        <div class="modal-body">
          <p class="confirm-delete-hint">
            此操作不可轻易撤销。请输入
            <code>{{ CONFIRM_PHRASE }}</code>
            （全小写）以确认删除。
          </p>
          <label class="form-field">
            <span class="form-label">确认文本</span>
            <input
              ref="inputRef"
              v-model="state.input"
              class="input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :placeholder="CONFIRM_PHRASE"
              :disabled="state.busy"
              @keydown.enter.prevent="onConfirm"
            />
          </label>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-sm" :disabled="state.busy" @click="onCancel">
            取消
          </button>
          <button
            type="button"
            class="btn btn-sm confirm-delete-btn"
            :disabled="!canConfirm"
            @click="onConfirm"
          >
            {{ state.busy ? '处理中…' : state.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-delete-mask {
  z-index: 1100;
}
.confirm-delete-modal {
  width: 420px;
}
.confirm-delete-hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
}
.confirm-delete-hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--danger-light);
  color: var(--danger);
}
.confirm-delete-btn {
  color: #fff;
  background: var(--danger);
  border-color: var(--danger);
}
.confirm-delete-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-label {
  font-size: 12px;
  color: var(--text-3);
}
</style>
