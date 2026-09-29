import { computed, ref, watch } from 'vue'
import { DEFAULT_THEME, THEMES, translate } from '@/i18n/messages'
import { useLocale } from '@/composables/useLocale'

export const THEME_STORAGE_KEY = 'lh_theme'
export const THEME_VALUES = new Set(['default', 'light', 'dark'])

const theme = ref(readTheme())

function readTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (THEME_VALUES.has(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

function applyDocumentTheme(value) {
  const html = document.documentElement
  html.setAttribute('data-theme', value)
  html.classList.toggle('theme-dark', value === 'dark')
  html.classList.toggle('theme-light', value === 'light')
  html.classList.toggle('theme-default', value === 'default')
}

export function setTheme(next) {
  const value = THEME_VALUES.has(next) ? next : DEFAULT_THEME
  theme.value = value
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    /* ignore */
  }
  applyDocumentTheme(value)
  return value
}

/** 启动时同步到 document（可在 main.js / index.html 调用） */
export function bootTheme() {
  applyDocumentTheme(theme.value)
  return theme.value
}

export function useTheme() {
  const { locale } = useLocale()
  const themeLabel = computed(() =>
    translate(locale.value, `prefs.theme.${theme.value}`),
  )

  watch(
    theme,
    (v) => applyDocumentTheme(v),
    { immediate: true },
  )

  return {
    theme,
    themes: THEMES,
    themeLabel,
    setTheme,
  }
}
