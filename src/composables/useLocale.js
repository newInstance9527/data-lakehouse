import { computed, ref, watch } from 'vue'
import {
  DEFAULT_LOCALE,
  LOCALES,
  MESSAGES,
  translate,
} from '@/i18n/messages'
import { PHRASES_EN } from '@/i18n/phrases'
import { PAGE_SUBTITLES_EN, PAGE_SUBTITLES_ZH } from '@/i18n/pages'

export const LOCALE_STORAGE_KEY = 'lh_locale'

const locale = ref(readLocale())

function readLocale() {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (v && MESSAGES[v]) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE
}

function applyDocumentLang(code) {
  const html = document.documentElement
  html.lang = code === 'en' ? 'en' : 'zh-CN'
  try {
    document.title = translate(code, 'login.title')
  } catch {
    /* ignore */
  }
}

/** 键值词典翻译（nav / common / page.*） */
export function t(key, varsOrFallback) {
  if (typeof varsOrFallback === 'string') {
    const text = translate(locale.value, key)
    return text === key ? varsOrFallback : text
  }
  return translate(locale.value, key, varsOrFallback)
}

/**
 * 中文原文翻译：zh 原样；en 查 PHRASES_EN / 键值词典。
 * 模板可写 {{ tt('刷新') }}，未收录则保持中文。
 */
export function tt(text, vars) {
  if (text == null || text === '') return text
  const raw = String(text)
  if (locale.value !== 'en') {
    return applyVars(raw, vars)
  }
  const fromPhrase = PHRASES_EN[raw]
  if (fromPhrase != null) return applyVars(fromPhrase, vars)
  const fromKey = translate('en', raw)
  if (fromKey !== raw) return applyVars(fromKey, vars)
  return applyVars(raw, vars)
}

function applyVars(text, vars) {
  if (!vars || typeof vars !== 'object') return text
  let out = text
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v ?? ''))
  }
  return out
}

export function pageTitle(pageId) {
  return t(`nav.${pageId}`, pageId)
}

export function pageSubtitle(pageId) {
  const id = String(pageId || '')
  if (locale.value === 'en') {
    return PAGE_SUBTITLES_EN[id] || PAGE_SUBTITLES_ZH[id] || ''
  }
  return PAGE_SUBTITLES_ZH[id] || ''
}

export function setLocale(next) {
  const code = MESSAGES[next] ? next : DEFAULT_LOCALE
  locale.value = code
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code)
  } catch {
    /* ignore */
  }
  applyDocumentLang(code)
  return code
}

/** 启动时同步到 document（可在 main.js 调用） */
export function bootLocale() {
  applyDocumentLang(locale.value)
  return locale.value
}

export function useLocale() {
  const localeLabel = computed(() => t(`prefs.locale.${locale.value}`))

  watch(
    locale,
    (v) => applyDocumentLang(v),
    { immediate: true },
  )

  return {
    locale,
    locales: LOCALES,
    localeLabel,
    t,
    tt,
    pageTitle,
    pageSubtitle,
    setLocale,
  }
}
