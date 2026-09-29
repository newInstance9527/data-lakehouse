<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatAiMarkdown } from '@/utils/aiMarkdown'

const props = defineProps({
  /** 原始 Markdown / 纯文本 */
  text: { type: String, default: '' },
  /** 兼容旧字段（已含 br / 片段 HTML） */
  html: { type: String, default: '' },
  role: { type: String, default: 'assistant' },
})

const router = useRouter()

const rendered = computed(() => {
  const raw = props.text || props.html || ''
  if (props.role === 'user') {
    return formatAiMarkdown(String(raw).replace(/<br\s*\/?>/gi, '\n'))
  }
  return formatAiMarkdown(raw)
})

/** Hash 路由：拦截站内链，避免 /apply 整页跳出变成总览 */
function onClick(e) {
  const a = e.target?.closest?.('a.ai-md-route, a[data-route]')
  if (!a) return
  const route = a.getAttribute('data-route') || ''
  if (!route.startsWith('/')) return
  e.preventDefault()
  e.stopPropagation()
  const qIdx = route.indexOf('?')
  if (qIdx >= 0) {
    const path = route.slice(0, qIdx)
    const qs = new URLSearchParams(route.slice(qIdx + 1))
    const query = Object.fromEntries(qs.entries())
    router.push({ path, query })
  } else {
    router.push(route)
  }
}
</script>

<template>
  <div class="ai-md" :class="`role-${role}`" v-html="rendered" @click="onClick" />
</template>

<style>
/* 非 scoped：气泡内 Markdown 需全局类名 */
.ai-md {
  font-size: 13px;
  line-height: 1.65;
  color: inherit;
  word-break: break-word;
}
.ai-md .ai-md-p {
  margin: 0 0 0.55em;
}
.ai-md .ai-md-p:last-child {
  margin-bottom: 0;
}
.ai-md .ai-md-h {
  margin: 0.7em 0 0.35em;
  font-weight: 650;
  line-height: 1.35;
  color: inherit;
}
.ai-md h1.ai-md-h {
  font-size: 1.15em;
}
.ai-md h2.ai-md-h {
  font-size: 1.08em;
}
.ai-md h3.ai-md-h {
  font-size: 1.02em;
}
.ai-md .ai-md-ul,
.ai-md .ai-md-ol {
  margin: 0.35em 0 0.55em;
  padding-left: 1.35em;
}
.ai-md .ai-md-ul li,
.ai-md .ai-md-ol li {
  margin: 0.15em 0;
}
.ai-md .ai-md-quote {
  margin: 0.4em 0;
  padding: 0.35em 0.75em;
  border-left: 3px solid #91caff;
  background: rgba(22, 119, 255, 0.06);
  color: inherit;
  opacity: 0.95;
}
.ai-md .ai-md-hr {
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  margin: 0.75em 0;
}
.ai-md .ai-md-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
}
.ai-md.role-user .ai-md-code {
  background: rgba(255, 255, 255, 0.2);
}
.ai-md .ai-md-pre {
  margin: 0.5em 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
}
.ai-md .ai-md-pre code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: transparent;
  padding: 0;
  color: inherit;
}
.ai-md .ai-md-a {
  color: #1677ff;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.ai-md.role-user .ai-md-a {
  color: #fff;
}
</style>
