<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import MetricOntologyAdmin from '@/components/metrics/MetricOntologyAdmin.vue'
import { pageGuideOf } from '@/data/pageGuides'
import '@/styles/metrics-page.css'
import '@/styles/dataservice-page.css'

const guide = pageGuideOf('metric-qualifiers')
</script>

<template>
  <div class="met-page ds-page">
    <PageHeader
      page-id="metric-qualifiers"
      title="修饰词库"
      subtitle="可复用业务限定 · 在衍生指标「业务限定」中选用"
      :guide="guide"
    />
    <MetricOntologyAdmin mode="qualifier" />
  </div>
</template>
