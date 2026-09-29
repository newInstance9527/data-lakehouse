/**
 * 业务域 SoT 缓存 · 供指标/资产/标准下拉共用
 */
import { computed, ref } from 'vue'
import { fetchDomainOptions } from '@/api/domain'

/** @type {import('vue').Ref<Array<{value:string,label:string}>>} */
const options = ref([])
const loaded = ref(false)
const loading = ref(false)
let loadPromise = null

/** 空态兜底（与 V75 种子一致；仅 API 失败时） */
export const DOMAIN_FALLBACK = [
  { value: 'common', label: '通用' },
  { value: 'trade', label: '交易域' },
  { value: 'user', label: '用户域' },
  { value: 'goods', label: '商品域' },
  { value: 'marketing', label: '营销域' },
  { value: 'finance', label: '财务域' },
]

export function useDomains() {
  const domainOptions = computed(() =>
    options.value.length ? options.value : DOMAIN_FALLBACK,
  )

  const domainTabs = computed(() => [
    { id: 'all', label: '全部域' },
    ...domainOptions.value.map((d) => ({ id: d.value, label: d.label })),
  ])

  async function ensureDomains(force = false) {
    if (!force && loaded.value && options.value.length) return options.value
    if (loadPromise) return loadPromise
    loading.value = true
    loadPromise = fetchDomainOptions()
      .then((list) => {
        const rows = Array.isArray(list) ? list : []
        options.value = rows
          .map((d) => ({
            value: String(d.value || d.domainCode || '').trim(),
            label: String(d.label || d.name || d.value || '').trim(),
          }))
          .filter((d) => d.value)
        loaded.value = true
        return options.value
      })
      .catch((e) => {
        console.warn('[domain] options load failed', e)
        if (!options.value.length) options.value = [...DOMAIN_FALLBACK]
        return options.value
      })
      .finally(() => {
        loading.value = false
        loadPromise = null
      })
    return loadPromise
  }

  function domainLabel(code) {
    if (!code) return '—'
    const c = String(code).trim()
    const hit = domainOptions.value.find((d) => d.value === c)
    if (hit) return hit.label
    if (c === 'product') {
      return domainOptions.value.find((d) => d.value === 'goods')?.label || '商品域'
    }
    return c
  }

  /** CreateFormModal select：{value,label}[] */
  function domainSelectOptions() {
    return domainOptions.value.map((d) => ({
      value: d.value,
      label: d.label,
    }))
  }

  return {
    domainOptions,
    domainTabs,
    loading,
    loaded,
    ensureDomains,
    domainLabel,
    domainSelectOptions,
  }
}

/** 非 setup 场景（createForms optionsResolver） */
let _ensure = null
export function domainSelectOptionsSync() {
  if (!_ensure) {
    _ensure = useDomains()
  }
  return _ensure.domainSelectOptions()
}

export async function ensureDomainSelectOptions() {
  if (!_ensure) _ensure = useDomains()
  await _ensure.ensureDomains()
  return _ensure.domainSelectOptions()
}
