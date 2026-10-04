<script setup lang="ts">
import type { ScreenRead } from 'kuroshiro-shared'
import ScheduleSummary from './ScheduleSummary.vue'
import ScheduleSwitch from './ScheduleSwitch.vue'

defineProps<{
  /** The Screen, under the name the admin reads it by. */
  screen: ScreenRead
  /** Reads the Screens again, after a write to this one. */
  reload: () => Promise<void>
}>()
</script>

<template>
  <ScheduleSwitch v-if="screen.schedule" :screen-id="screen.id" :enabled="screen.schedule.enabled" :label="`Schedule for ${screen.name}`" :reload="reload">
    <ScheduleSummary :schedule="screen.schedule" />
  </ScheduleSwitch>
  <ScheduleSummary v-else :schedule="null" />
</template>
