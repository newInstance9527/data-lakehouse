<script setup>
import { useAppVersionCheck } from '@/composables/useAppVersionCheck'
import { t } from '@/composables/useLocale'
import DeferredRefreshBar from '@/components/common/DeferredRefreshBar.vue'

const { updateAvailable, applyUpdate, dismissUpdate } = useAppVersionCheck()
</script>

<template>
  <DeferredRefreshBar
    :show="updateAvailable"
    variant="float"
    :message="t('app.update.message', '检测到前端有新版本。确认后再刷新，避免打断当前操作。')"
    :apply-label="t('app.update.apply', '立即刷新')"
    :dismiss-label="t('common.cancel', '稍后')"
    @apply="applyUpdate"
    @dismiss="dismissUpdate"
  />
</template>
