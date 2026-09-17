import { computed, ref } from 'vue'
import { PUBLISH_HISTORY, PUBLISH_GATES } from '@/data/publish'

const history = ref(PUBLISH_HISTORY.map((h) => ({ ...h })))
const gates = ref(PUBLISH_GATES.map((g) => ({ ...g })))
const focusPkg = ref('v23-dwd-order-clean')

export function usePublish() {
  const items = computed(() => history.value)
  const gateList = computed(() => gates.value)
  const focus = computed(() => focusPkg.value)

  function addRelease({ name, script, engine, env }) {
    const pkg = name || `v${Date.now().toString().slice(-4)}-${(script || 'script').replace(/\.sql$/i, '')}`
    const tag = `v${Date.now().toString().slice(-2)}.0`
    const targetEnv = String(env || 'stg').toLowerCase() === 'prod' ? 'stg' : String(env || 'stg').toLowerCase()
    const row = {
      pkg,
      tag,
      env: targetEnv,
      result: '门禁中',
      time: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      script: script || '',
      engine: engine || 'spark',
    }
    history.value = [row, ...history.value]
    focusPkg.value = pkg
    gates.value = [
      { step: 1, name: 'Git 编译通过', detail: `${script || pkg} 编译排队`, status: 'run' },
      { step: 2, name: '血缘解析入库', detail: '等待编译完成后解析', status: 'wait' },
      { step: 3, name: '质量规则绑定', detail: '待绑定', status: 'wait' },
      { step: 4, name: 'stg 环境跑通', detail: '待试跑', status: 'wait' },
      { step: 5, name: '变更影响无阻断', detail: '待评估', status: 'wait' },
      { step: 6, name: '生产发布', detail: '等待门禁通过后自动发布', status: 'wait' },
    ]
    return row
  }

  return { items, gateList, focus, addRelease }
}
