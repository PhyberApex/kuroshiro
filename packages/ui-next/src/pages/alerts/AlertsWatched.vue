<script setup lang="ts">
import type { InstanceSettingsResponse } from 'kuroshiro-shared'
import { computed } from 'vue'
import { linkTo, sentence, strong } from '@/pages/devices/sentence'
import SentenceLine from '@/pages/devices/SentenceLine.vue'
import { ALERT_RULES_PATH, NOTIFICATIONS_PATH } from '@/pages/instance/instancePaths'

const props = defineProps<{
  settings: InstanceSettingsResponse
  /** Whether Notifications are set up, as the Instance facts say. */
  notificationsSetUp: boolean
}>()

const watched = computed(() => sentence(
  `Every 5 minutes Kuroshiro checks each Device for a battery below ${props.settings.lowBatteryPercent.value} % and for ${props.settings.offlineMultiplier.value} missed polls, and each Data Source for a Fetch Failure Streak of ${props.settings.fetchFailureThreshold.value}. An Alert resolves by itself once its cause is gone; there is nothing to dismiss. `,
  linkTo('Change the Alert Rules', ALERT_RULES_PATH),
))

const notifications = linkTo('Notifications', NOTIFICATIONS_PATH)

const announced = computed(() => props.notificationsSetUp
  ? sentence('Each Alert is announced through Apprise when it fires and when it resolves. ', notifications)
  : sentence(strong('Notifications are off'), ', so an Alert only shows here, on its Device and on its Plugin. ', notifications))
</script>

<template>
  <SentenceLine class="watched" :sentence="watched" />
  <SentenceLine class="announced" :sentence="announced" />
</template>

<style scoped>
@layer components {
  .watched,
  .announced {
    max-width: var(--measure);
    text-wrap: pretty;
  }

  .watched {
    margin-top: var(--space-4);
  }

  .announced {
    margin-top: var(--space-2);
  }
}
</style>
