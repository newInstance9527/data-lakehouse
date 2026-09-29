<script setup>
/**
 * AI 助手线标（无 emoji）；name: chat | plus | trash | spark | close | expand | clear | attach
 */
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 16 },
})
</script>

<template>
  <svg
    class="ai-ico"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 对话气泡 -->
    <g v-if="name === 'chat'" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5.5 17.5 4 20.5l3.2-1.1A8.5 8.5 0 1 0 5.5 17.5Z" />
      <path d="M8.5 11h7M8.5 14h4.5" />
    </g>
    <!-- 新建 -->
    <g v-else-if="name === 'plus'" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
      <path d="M12 5.5v13M5.5 12h13" />
    </g>
    <!-- 删除 -->
    <g v-else-if="name === 'trash'" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 7.5h14" />
      <path d="M9.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 6v1.5" />
      <path d="M7.5 7.5 8.3 18a1.5 1.5 0 0 0 1.5 1.3h4.4a1.5 1.5 0 0 0 1.5-1.3l.8-10.5" />
      <path d="M10.5 11.5v5M13.5 11.5v5" />
    </g>
    <!-- 助手 / Copilot -->
    <g v-else-if="name === 'spark'" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3.5 13.4 8.6 18.5 10 13.4 11.4 12 16.5 10.6 11.4 5.5 10 10.6 8.6 12 3.5Z" />
      <path d="M18.5 15.5 19.2 17.8 21.5 18.5 19.2 19.2 18.5 21.5 17.8 19.2 15.5 18.5 17.8 17.8 18.5 15.5Z" />
    </g>
    <!-- 关闭 -->
    <g v-else-if="name === 'close'" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
      <path d="m7 7 10 10M17 7 7 17" />
    </g>
    <!-- 外链 / 完整页 -->
    <g v-else-if="name === 'expand'" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 5.5H5.5V10M14 18.5h4.5V14M5.5 5.5 10 10M18.5 18.5 14 14" />
    </g>
    <!-- 清空 -->
    <g v-else-if="name === 'clear'" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5.5 7.5h13" />
      <path d="M9 7.5V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2V7.5" />
      <path d="M8 7.5v10.2A1.3 1.3 0 0 0 9.3 19h5.4a1.3 1.3 0 0 0 1.3-1.3V7.5" />
      <path d="M10.5 4.5h3" />
    </g>
    <!-- 附件 -->
    <g v-else-if="name === 'attach'" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="m15.5 8.2-5.8 5.8a2.4 2.4 0 0 0 3.4 3.4l6.2-6.2a3.8 3.8 0 0 0-5.4-5.4L7.3 12.4a5.2 5.2 0 0 0 7.4 7.4l5.1-5.1" />
    </g>
  </svg>
</template>

<style scoped>
.ai-ico {
  display: block;
  flex-shrink: 0;
}
</style>
