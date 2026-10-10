<script setup>
/**
 * 有后台更新时提示用户确认，避免使用中整页被刷掉
 */
defineProps({
  show: { type: Boolean, default: false },
  message: {
    type: String,
    default: '检测到内容有更新。确认后才会刷新当前界面，避免打断操作。',
  },
  applyLabel: { type: String, default: '更新界面' },
  dismissLabel: { type: String, default: '稍后' },
})
defineEmits(['apply', 'dismiss'])
</script>

<template>
  <div v-if="show" class="deferred-refresh-bar" role="status">
    <span class="deferred-refresh-msg">{{ message }}</span>
    <div class="deferred-refresh-acts">
      <button type="button" class="btn btn-sm" @click="$emit('dismiss')">{{ dismissLabel }}</button>
      <button type="button" class="btn btn-sm btn-primary" @click="$emit('apply')">
        {{ applyLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.deferred-refresh-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding: 10px 14px;
  margin-bottom: 12px;
  border: 1px solid var(--border, #e5e5e5);
  border-left: 3px solid var(--primary, #1677ff);
  border-radius: 4px;
  background: var(--bg-elevated, #fafafa);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
}
.deferred-refresh-msg {
  font-size: 13px;
  line-height: 1.45;
  color: var(--text, #333);
  flex: 1;
  min-width: 200px;
}
.deferred-refresh-acts {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
