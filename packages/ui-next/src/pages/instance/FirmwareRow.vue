<script setup lang="ts">
import type { DeviceModelRead, FirmwareRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import LibraryRow from '@/components/LibraryRow.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import DeviceNames from './DeviceNames.vue'
import { headedFor, whatItIs } from './firmwareWording'

const props = defineProps<{
  firmware: FirmwareRead
  models: DeviceModelRead[]
}>()

defineSlots<{
  /** The row's actions, after its date. */
  actions?: () => unknown
}>()

const MISSING_FILE = 'Its file is missing, so it cannot be pushed. Delete it and upload it again.'

const headed = computed(() => headedFor(props.firmware))
const arrived = computed(() => props.firmware.uploadedAt
  ? { how: 'Uploaded', at: props.firmware.uploadedAt }
  : props.firmware.syncedAt ? { how: 'Synced', at: props.firmware.syncedAt } : undefined)
</script>

<template>
  <LibraryRow :name="firmware.version" mono :problem="firmware.filePresent ? undefined : MISSING_FILE">
    <p>{{ whatItIs(firmware, models) }}</p>
    <p v-if="headed.goesOutTo.length > 0 || headed.runningOn.length > 0">
      <b v-if="headed.goesOutTo.length > 0" class="goes-out">Goes out to <DeviceNames :devices="headed.goesOutTo" /> at the next poll</b>
      <template v-if="headed.goesOutTo.length > 0 && headed.runningOn.length > 0">
        {{ ' · ' }}
      </template>
      <span v-if="headed.runningOn.length > 0">Running on <DeviceNames :devices="headed.runningOn" /></span>
    </p>
    <template #end>
      <span v-if="arrived" class="arrived">{{ arrived.how }} <RelativeTime :at="arrived.at" /></span>
      <slot name="actions" />
    </template>
  </LibraryRow>
</template>

<style scoped>
@layer components {
  .goes-out {
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }
}
</style>
