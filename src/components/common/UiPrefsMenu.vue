<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useLocale } from '@/composables/useLocale'
import { useTheme } from '@/composables/useTheme'

const props = defineProps({
  /** 登录页等深色底上的触发按钮样式 */
  onDark: { type: Boolean, default: false },
})

const { locale, locales, t, setLocale } = useLocale()
const { theme, themes, setTheme } = useTheme()

const open = ref(false)
const rootRef = ref(null)

const summary = computed(
  () => `${t(`prefs.theme.${theme.value}`)} · ${t(`prefs.locale.${locale.value}`)}`,
)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocClick(e) {
  if (!open.value) return
  if (rootRef.value && !rootRef.value.contains(e.target)) close()
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="rootRef" class="ui-prefs" :class="{ 'ui-prefs--on-dark': props.onDark }">
    <button
      type="button"
      class="icon-btn ui-prefs-trigger"
      :title="t('app.prefs.open')"
      :aria-expanded="open"
      aria-haspopup="true"
      @click.stop="toggle"
    >
      🎨
    </button>
    <div v-if="open" class="ui-prefs-panel" role="menu" @click.stop>
      <div class="ui-prefs-head">{{ t('app.prefs') }}</div>
      <div class="ui-prefs-summary">{{ summary }}</div>

      <div class="ui-prefs-section">
        <div class="ui-prefs-label">{{ t('prefs.theme') }}</div>
        <div class="ui-prefs-seg">
          <button
            v-for="opt in themes"
            :key="opt.value"
            type="button"
            class="ui-prefs-chip"
            :class="{ active: theme === opt.value }"
            @click="setTheme(opt.value)"
          >
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>

      <div class="ui-prefs-section">
        <div class="ui-prefs-label">{{ t('prefs.locale') }}</div>
        <div class="ui-prefs-seg">
          <button
            v-for="opt in locales"
            :key="opt.value"
            type="button"
            class="ui-prefs-chip"
            :class="{ active: locale === opt.value }"
            @click="setLocale(opt.value)"
          >
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ui-prefs {
  position: relative;
}
.ui-prefs-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 280px;
  padding: 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 80;
}
.ui-prefs-head {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.ui-prefs-summary {
  margin-top: 2px;
  margin-bottom: 10px;
  font-size: 11px;
  color: var(--text-3);
}
.ui-prefs-section + .ui-prefs-section {
  margin-top: 12px;
}
.ui-prefs-label {
  font-size: 11px;
  color: var(--text-3);
  margin-bottom: 6px;
}
.ui-prefs-seg {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ui-prefs-chip {
  flex: 1 1 auto;
  min-width: 72px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.ui-prefs-chip:hover {
  border-color: var(--border-dark);
  color: var(--text-1);
}
.ui-prefs-chip.active {
  border-color: var(--primary);
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
}
.ui-prefs--on-dark .ui-prefs-trigger {
  color: rgba(232, 241, 255, 0.9);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.ui-prefs--on-dark .ui-prefs-trigger:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}
</style>
