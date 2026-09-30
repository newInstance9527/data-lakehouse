import { computed, ref, watch } from 'vue'
import { DEFAULT_THEME, THEMES, translate } from '@/i18n/messages'
import { useLocale } from '@/composables/useLocale'

export const THEME_STORAGE_KEY = 'lh_theme'

/** 三种界面风格；旧值映射保留兼容 */
export const THEME_VALUES = new Set(['minimal', 'soft', 'azure'])

const LEGACY_THEME_MAP = {
  default: 'azure',
  studio: 'azure',
  tech: 'azure',
  light: 'minimal',
  dark: 'soft',
}

const theme = ref(readTheme())

function normalizeTheme(raw) {
  if (THEME_VALUES.has(raw)) return raw
  if (LEGACY_THEME_MAP[raw]) return LEGACY_THEME_MAP[raw]
  return DEFAULT_THEME
}

function readTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return normalizeTheme(v)
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

function applyDocumentTheme(value) {
  const html = document.documentElement
  const v = normalizeTheme(value)
  html.setAttribute('data-theme', v)
  html.classList.toggle('theme-minimal', v === 'minimal')
  html.classList.toggle('theme-soft', v === 'soft')
  html.classList.toggle('theme-azure', v === 'azure')
  html.classList.toggle('theme-tech', false)
  html.classList.toggle('theme-studio', false)
  html.classList.toggle('theme-dark', false)
  html.classList.toggle('theme-light', v === 'minimal')
  html.classList.toggle('theme-default', v === 'soft')
}

export function setTheme(next) {
  const value = normalizeTheme(next)
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
