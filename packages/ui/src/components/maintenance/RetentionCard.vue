<script setup lang="ts">
import type { RetentionStatus } from 'kuroshiro-shared'
import { mdiAlertCircle, mdiDeleteClock } from '@mdi/js'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VDivider } from 'vuetify/components'
import { formatDate } from '@/utils/formatDate'

defineProps<{
  status: RetentionStatus | null
  running: boolean
  error: string | null
}>()

defineEmits<{
  run: []
}>()

function formatAge(days: number): string {
  return days > 0 ? `${days} day${days === 1 ? '' : 's'}` : 'disabled'
}
</script>

<template>
  <VCard elevation="1" class="mb-4" data-test-id="retention-card">
    <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
      Retention
      <VBtn
        :prepend-icon="mdiDeleteClock"
        variant="tonal"
        color="secondary"
        :loading="running"
        :disabled="!status"
        data-test-id="run-retention-btn"
        @click="$emit('run')"
      >
        Preview Retention Run
      </VBtn>
    </VCardTitle>
    <VDivider />
    <VCardText>
      <p class="text-body-2 text-medium-emphasis mb-2">
        Prunes resolved Alerts and Device Log entries older than their configured retention age, daily at 4am. Active Alerts are never removed, regardless of age.
      </p>
      <template v-if="status">
        <div class="text-body-2">
          Alerts: {{ formatAge(status.ages.alertRetentionDays) }} &middot; Device Logs: {{ formatAge(status.ages.deviceLogRetentionDays) }}
        </div>
        <div class="text-body-2" data-test-id="retention-last-run">
          <template v-if="status.lastRun">
            Last run: {{ formatDate(status.lastRun.ranAt) }} &mdash; pruned {{ status.lastRun.alertsPruned }} Alerts, {{ status.lastRun.deviceLogsPruned }} Device Log entries
          </template>
          <template v-else>
            Retention has not run since startup.
          </template>
        </div>
      </template>
      <VAlert v-if="error" type="error" variant="tonal" class="mt-3" :icon="mdiAlertCircle">
        {{ error }}
      </VAlert>
    </VCardText>
  </VCard>
</template>
