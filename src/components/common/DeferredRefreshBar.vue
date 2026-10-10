<script setup>
/**
 * 有更新时右上角确认，避免自动刷掉当前界面。
 * variant=float：固定右上角（默认）；inline：页内 sticky。
 */
defineProps({
  show: { type: Boolean, default: false },
  message: {
    type: String,
    default: '检测到内容有更新。确认后才会刷新当前界面，避免打断操作。',
  },
  applyLabel: { type: String, default: '更新界面' },
  dismissLabel: { type: String, default: '稍后' },
  variant: {
    type: String,
    default: 'float',
    validator: (v) => v === 'float' || v === 'inline',
  },
})
defineEmits(['apply', 'dismiss'])
</script>

<template>
  <Teleport to="body" :disabled="variant !== 'float'">
    <Transition name="update-pop">
      <div
        v-if="show"
        class="deferred-refresh-bar"
        :class="variant === 'float' ? 'deferred-refresh-bar--float' : 'deferred-refresh-bar--inline'"
        role="alertdialog"
        aria-live="polite"
      >
        <div class="deferred-refresh-title">界面有更新</div>
        <p class="deferred-refresh-msg">{{ message }}</p>
        <div class="deferred-refresh-acts">
          <button type="button" class="btn btn-sm" @click="$emit('dismiss')">
            {{ dismissLabel }}
          </button>
          <button type="button" class="btn btn-sm btn-primary" @click="$emit('apply')">
            {{ applyLabel }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.deferred-refresh-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border, #e5e5e5);
  border-left: 3px solid var(--primary, #1677ff);
  border-radius: 10px;
  background: var(--bg-1, #fff);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  max-width: min(360px, calc(100vw - 24px));
}
.deferred-refresh-bar--float {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2100;
}
.deferred-refresh-bar--inline {
  position: sticky;
  top: 0;
  z-index: 40;
  margin-bottom: 12px;
  max-width: none;
  width: 100%;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
}
.deferred-refresh-title {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-1, #111);
  line-height: 1.3;
}
.deferred-refresh-msg {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-2, #555);
}
.deferred-refresh-acts {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.update-pop-enter-active,
.update-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.update-pop-enter-from,
.update-pop-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
