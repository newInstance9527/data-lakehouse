<script setup>
import { computed, ref } from 'vue'
import { normalizeGuide } from '@/data/pageGuides'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  /** 覆盖说明弹窗标题；默认取 guide.title */
  guideTitle: { type: String, default: '' },
  /**
   * 说明内容：
   * - 结构化对象 { title, sections }（推荐）
   * - 或 string / string[] / { body } 兼容旧写法
   */
  guide: { type: [String, Array, Object], default: null },
})

const guideOpen = ref(false)

const normalized = computed(() => normalizeGuide(props.guide))

const hasGuide = computed(() => normalized.value.sections.length > 0)

const dialogTitle = computed(() => props.guideTitle || normalized.value.title || '功能说明')

function textLines(content) {
  if (Array.isArray(content)) return content.map((s) => String(s).trim()).filter(Boolean)
  if (!content) return []
  return String(content)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
</script>

<template>
  <div class="page-title-row">
    <div>
      <div class="page-title">{{ title }}</div>
      <div v-if="subtitle" class="page-subtitle">{{ subtitle }}</div>
    </div>
    <div class="page-actions">
      <button
        v-if="hasGuide"
        type="button"
        class="btn btn-sm page-guide-btn"
        title="功能说明"
        @click="guideOpen = true"
      >ⓘ 说明</button>
      <slot />
    </div>
  </div>

  <Teleport to="body">
    <div v-if="guideOpen" class="modal-mask" @click.self="guideOpen = false">
      <div class="modal page-guide-modal">
        <div class="modal-header">
          <div class="modal-title">{{ dialogTitle }}</div>
          <button class="btn btn-sm" @click="guideOpen = false">✕</button>
        </div>
        <div class="modal-body page-guide-body">
          <section
            v-for="(sec, si) in normalized.sections"
            :key="si"
            class="guide-section"
          >
            <h4 v-if="sec.heading" class="guide-heading">{{ sec.heading }}</h4>

            <template v-if="sec.type === 'text' || !sec.type">
              <p v-for="(line, li) in textLines(sec.content)" :key="li" class="guide-p">
                {{ line }}
              </p>
            </template>

            <ul v-else-if="sec.type === 'list'" class="guide-list">
              <li v-for="(item, li) in sec.items" :key="li">{{ item }}</li>
            </ul>

            <ol v-else-if="sec.type === 'steps'" class="guide-steps">
              <li v-for="(item, li) in sec.items" :key="li">{{ item }}</li>
            </ol>

            <pre v-else-if="sec.type === 'example'" class="guide-example">{{ sec.content }}</pre>

            <div v-else-if="sec.type === 'note'" class="guide-note">
              {{ sec.content }}
            </div>

            <dl v-else-if="sec.type === 'kv'" class="guide-kv">
              <div v-for="(item, li) in sec.items" :key="li" class="guide-kv-row">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
          </section>
        </div>
        <div class="modal-footer">
          <span style="flex: 1" />
          <button class="btn btn-sm btn-primary" @click="guideOpen = false">知道了</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.page-guide-btn {
  color: var(--text-2);
}
.page-guide-modal {
  width: min(640px, 92vw);
  max-height: min(86vh, 760px);
  display: flex;
  flex-direction: column;
}
.page-guide-modal .modal-body {
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.page-guide-body {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.7;
  padding-top: 4px;
}
.guide-section + .guide-section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.guide-heading {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 650;
  color: var(--text-1);
  letter-spacing: 0.02em;
}
.guide-p {
  margin: 0;
}
.guide-p + .guide-p {
  margin-top: 8px;
}
.guide-list,
.guide-steps {
  margin: 0;
  padding-left: 1.25em;
}
.guide-list li + li,
.guide-steps li + li {
  margin-top: 6px;
}
.guide-steps {
  list-style: decimal;
}
.guide-example {
  margin: 0;
  padding: 12px 14px;
  background: var(--bg-2, #f5f7fa);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--text-1);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.guide-note {
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
  color: var(--text-1);
  font-size: 12px;
}
.guide-kv {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.guide-kv-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 10px;
  align-items: start;
}
.guide-kv-row dt {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  padding-top: 2px;
}
.guide-kv-row dd {
  margin: 0;
  color: var(--text-1);
}
</style>
