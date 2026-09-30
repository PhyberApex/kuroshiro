<script setup lang="ts">
import type { AlertSummary } from 'kuroshiro-shared'
import { mdiAlertCircle, mdiBellRing, mdiCheckCircle } from '@mdi/js'
import { ALERT_KIND_LABELS } from 'kuroshiro-shared'
import { RouterLink } from 'vue-router'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VDivider, VList, VListItem, VListItemSubtitle, VListItemTitle } from 'vuetify/components'
import { formatDate } from '@/utils/formatDate'

defineProps<{
  active: AlertSummary[]
  resolved: AlertSummary[]
  error: string | null
  sendingTestNotification: boolean
  testNotificationResult: { ok: boolean, message: string } | null
}>()

defineEmits<{
  sendTestNotification: []
  dismissTestNotificationResult: []
}>()
</script>

<template>
  <VCard elevation="1" class="mb-4" data-test-id="alerts-card">
    <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
      Alerts
      <VBtn
        :prepend-icon="mdiBellRing"
        variant="tonal"
        color="secondary"
        :loading="sendingTestNotification"
        data-test-id="send-test-notification-btn"
        @click="$emit('sendTestNotification')"
      >
        Send test Notification
      </VBtn>
    </VCardTitle>
    <VDivider />
    <VCardText>
      <VAlert v-if="error" type="error" variant="tonal" class="mb-3" :icon="mdiAlertCircle">
        {{ error }}
      </VAlert>
      <VAlert
        v-if="testNotificationResult"
        :type="testNotificationResult.ok ? 'success' : 'error'"
        variant="tonal"
        class="mb-3"
        :icon="testNotificationResult.ok ? mdiCheckCircle : mdiAlertCircle"
        closable
        data-test-id="test-notification-result"
        @click:close="$emit('dismissTestNotificationResult')"
      >
        {{ testNotificationResult.message }}
      </VAlert>

      <div class="text-subtitle-2 mb-2">
        Active
      </div>
      <VList v-if="active.length > 0" data-test-id="active-alerts-list">
        <VListItem v-for="alert in active" :key="alert.id">
          <VListItemTitle>
            {{ ALERT_KIND_LABELS[alert.kind] }} — <RouterLink :to="{ name: 'device', params: { id: alert.deviceId } }">
              {{ alert.deviceName }}
            </RouterLink>
          </VListItemTitle>
          <VListItemSubtitle>Opened {{ formatDate(alert.openedAt) }}</VListItemSubtitle>
        </VListItem>
      </VList>
      <p v-else class="text-body-2 text-medium-emphasis" data-test-id="no-active-alerts">
        No active Alerts.
      </p>

      <VDivider class="my-4" />

      <div class="text-subtitle-2 mb-2">
        Recently resolved
      </div>
      <VList v-if="resolved.length > 0" data-test-id="resolved-alerts-list">
        <VListItem v-for="alert in resolved" :key="alert.id">
          <VListItemTitle>
            {{ ALERT_KIND_LABELS[alert.kind] }} — <RouterLink :to="{ name: 'device', params: { id: alert.deviceId } }">
              {{ alert.deviceName }}
            </RouterLink>
          </VListItemTitle>
          <VListItemSubtitle>Opened {{ formatDate(alert.openedAt) }} · Resolved {{ alert.resolvedAt ? formatDate(alert.resolvedAt) : 'N/A' }}</VListItemSubtitle>
        </VListItem>
      </VList>
      <p v-else class="text-body-2 text-medium-emphasis" data-test-id="no-resolved-alerts">
        Nothing resolved in the last 7 days.
      </p>
    </VCardText>
  </VCard>
</template>
