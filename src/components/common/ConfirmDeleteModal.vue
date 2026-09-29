<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import {
  CONFIRM_PHRASE,
  isConfirmPhraseMatch,
  settleConfirmDelete,
  useConfirmDeleteState,
} from '@/composables/useConfirmDelete'
import { t, tt, useLocale } from '@/composables/useLocale'

const state = useConfirmDeleteState()
const inputRef = ref(null)
const { locale } = useLocale()

const canConfirm = computed(
  () => isConfirmPhraseMatch(state.input) && !state.busy,
)

const titleText = computed(() => {
  void locale.value
  return tt(state.title || '')
})
const messageText = computed(() => {
  void locale.value
  return state.message ? tt(state.message) : ''
})
const confirmLabelText = computed(() => {
  void locale.value
  return state.busy ? t('common.busy') : tt(state.confirmLabel || '确认')
})

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
            <div id="confirm-delete-title" class="modal-title">{{ titleText }}</div>
            <div v-if="messageText" class="modal-sub">{{ messageText }}</div>
          </div>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="state.busy"
            :title="t('common.close')"
            @click="onCancel"
          >✕</button>
        </div>
        <div class="modal-body">
          <p class="confirm-delete-hint">
            {{ t('common.confirm.hint', { phrase: CONFIRM_PHRASE }) }}
          </p>
          <label class="form-field">
            <span class="form-label">{{ t('common.confirm.label') }}</span>
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
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-sm confirm-delete-btn"
            :disabled="!canConfirm"
            @click="onConfirm"
          >
            {{ confirmLabelText }}
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
