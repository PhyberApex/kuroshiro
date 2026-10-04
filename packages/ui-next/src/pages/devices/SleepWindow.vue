<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { computed } from 'vue'
import SettingRow from '@/components/SettingRow.vue'
import TimeInput from '@/components/TimeInput.vue'
import { useServerTimezone } from '@/reads/sharedReads'
import { useDeviceSetting } from './deviceSetting'
import { sleepWindowInput } from './deviceSettings'
import { changedOfPair, crossesMidnight } from './scheduleEditing'

const props = defineProps<{
  device: DeviceDetail
}>()

const timezone = useServerTimezone()

const savedWindow = () => ({ start: props.device.sleep.start, end: props.device.sleep.end })

const sleepWindow = useDeviceSetting(savedWindow, (entered) => {
  const changed = changedOfPair(savedWindow(), entered)
  return changed && sleepWindowInput(changed)
})

const crosses = computed(() => crossesMidnight(sleepWindow.entered.start, sleepWindow.entered.end))
</script>

<template>
  <SettingRow label="Window" :status="sleepWindow.status" :reason="sleepWindow.reason" @retry="sleepWindow.retry">
    <template #default="{ labelId }">
      <span class="pair" role="group" :aria-labelledby="labelId">
        <TimeInput v-model="sleepWindow.entered.start" aria-label="Sleep Mode from" @commit="sleepWindow.commit" />
        to
        <TimeInput v-model="sleepWindow.entered.end" aria-label="Sleep Mode to" @commit="sleepWindow.commit" />
      </span>
    </template>
    <template #source>
      {{ timezone ? `Server timezone, ${timezone}` : 'Server timezone' }}
    </template>
    <template v-if="crosses" #note>
      This window crosses midnight.
    </template>
  </SettingRow>
</template>

<style scoped>
@layer components {
  .pair {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }
}
</style>
