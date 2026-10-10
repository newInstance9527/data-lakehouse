<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import MetricOntologyAdmin from '@/components/metrics/MetricOntologyAdmin.vue'
import { pageGuideOf } from '@/data/pageGuides'
import '@/styles/metrics-page.css'
import '@/styles/dataservice-page.css'

const guide = pageGuideOf('metric-dims')
</script>

<template>
  <div class="met-page ds-page">
    <PageHeader
      page-id="metric-dims"
      title="维度库"
      subtitle="统计粒度与 DIM 挂接 · 在衍生指标「统计粒度」中选用"
      :guide="guide"
    />
    <MetricOntologyAdmin mode="dim" />
  </div>
</template>
