<script setup>
import { computed, ref } from 'vue'
import { normalizeGuide, pageGuideOf } from '@/data/pageGuides'
import { pageSubtitle, pageTitle, t, tt, useLocale } from '@/composables/useLocale'

const props = defineProps({
  /** 模块 id（与 nav / pageGuides 对齐）；提供后自动解析标题/副标题/说明 */
  pageId: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  guideTitle: { type: String, default: '' },
  /** 未传 pageId 时使用；有 pageId 时按当前语言自动 pageGuideOf */
  guide: { type: [String, Array, Object], default: null },
})

const guideOpen = ref(false)
const { locale } = useLocale()

const resolvedTitle = computed(() => {
  void locale.value
  if (props.pageId) return pageTitle(props.pageId)
  return props.title ? tt(props.title) : ''
})

const resolvedSubtitle = computed(() => {
  void locale.value
  if (props.subtitle) return tt(props.subtitle)
  if (props.pageId) return pageSubtitle(props.pageId)
  return ''
})

const resolvedGuide = computed(() => {
  void locale.value
  if (props.pageId) return pageGuideOf(props.pageId, locale.value)
  return props.guide
})

const normalized = computed(() => normalizeGuide(resolvedGuide.value))
const hasGuide = computed(() => normalized.value.sections.length > 0)

const dialogTitle = computed(() => {
  void locale.value
  if (props.guideTitle) return tt(props.guideTitle)
  return tt(normalized.value.title || t('app.guide.title'))
})

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
      <div class="page-title">{{ resolvedTitle }}</div>
      <div v-if="resolvedSubtitle" class="page-subtitle">{{ resolvedSubtitle }}</div>
    </div>
    <div class="page-actions">
      <button
        v-if="hasGuide"
        type="button"
        class="btn btn-sm page-guide-btn"
        :title="t('app.guide.title')"
        @click="guideOpen = true"
      >ⓘ {{ t('app.guide') }}</button>
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
            <h4 v-if="sec.heading" class="guide-heading">{{ tt(sec.heading) }}</h4>

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

            <template v-else-if="sec.type === 'kv'">
              <div v-for="(row, ri) in sec.items" :key="ri" class="guide-kv">
                <span class="guide-kv-label">{{ tt(row.label) }}</span>
                <span class="guide-kv-value">{{ row.value }}</span>
              </div>
            </template>

            <div v-else-if="sec.type === 'note' || sec.type === 'example'" class="guide-note">
              <p v-for="(line, li) in textLines(sec.content)" :key="li">{{ line }}</p>
            </div>
          </section>
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
  max-height: min(80vh, 720px);
  display: flex;
  flex-direction: column;
}
.page-guide-body {
  overflow-y: auto;
  padding: 16px 20px 20px;
}
.guide-section + .guide-section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.guide-heading {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.guide-p,
.guide-note p {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
}
.guide-list,
.guide-steps {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-2);
}
.guide-kv {
  display: flex;
  gap: 10px;
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 4px;
}
.guide-kv-label {
  flex: 0 0 72px;
  color: var(--text-3);
}
.guide-kv-value {
  color: var(--text-2);
}
</style>
