<script setup lang="ts">
import type { DeviceLogEntry } from 'kuroshiro-shared'
import { computed } from 'vue'
import DayHeading from '@/components/DayHeading.vue'
import { useNow } from '@/patterns/useNow'
import DeviceLogEntryRow from './DeviceLogEntryRow.vue'
import { dayHeading } from './deviceLogWording'
import { possessive } from './screenNaming'

const props = defineProps<{
  deviceName: string
  /** Newest first. */
  entries: DeviceLogEntry[]
  sought: string
}>()

/** The id of the opened entry. One is open at a time. */
const open = defineModel<string | undefined>('open')

const now = useNow()

interface Line {
  entry: DeviceLogEntry
  /** The day's heading, on the first entry of each day. */
  day?: string
}

const lines = computed<Line[]>(() => props.entries.map((entry, index) => {
  const day = dayHeading(new Date(entry.at), now.value)
  const dayAbove = index > 0 ? dayHeading(new Date(props.entries[index - 1]!.at), now.value) : undefined
  return { entry, day: day === dayAbove ? undefined : day }
}))
</script>

<template>
  <ol class="log-entries" :aria-label="`${possessive(deviceName)} Device Log`">
    <template v-for="{ entry, day } in lines" :key="entry.id">
      <DayHeading v-if="day">
        {{ day }}
      </DayHeading>
      <DeviceLogEntryRow
        :entry="entry"
        :open="open === entry.id"
        :sought="sought"
        @toggle="open = open === entry.id ? undefined : entry.id"
      />
    </template>
  </ol>
</template>

<style scoped>
@layer components {
  .log-entries {
    border-top: var(--rule-heavy);
  }
}
</style>
