<script setup lang="ts">
import type { AlertSummary } from 'kuroshiro-shared'
import { ALERT_KIND_LABELS } from 'kuroshiro-shared'
import { RouterLink } from 'vue-router'
import { VListItemSubtitle, VListItemTitle } from 'vuetify/components'
import { formatDate } from '@/utils/formatDate'

defineProps<{
  alert: AlertSummary
  showResolved: boolean
}>()
</script>

<template>
  <VListItemTitle>
    {{ ALERT_KIND_LABELS[alert.kind] }} — <RouterLink v-if="alert.deviceId" :to="{ name: 'device', params: { id: alert.deviceId } }">
      {{ alert.deviceName }}
    </RouterLink>
    <template v-else>
      {{ alert.pluginName }} / {{ alert.dataSourceName }}
    </template>
  </VListItemTitle>
  <VListItemSubtitle>
    Opened {{ formatDate(alert.openedAt) }}<template v-if="showResolved">
      · Resolved {{ alert.resolvedAt ? formatDate(alert.resolvedAt) : 'N/A' }}
    </template>
  </VListItemSubtitle>
</template>
