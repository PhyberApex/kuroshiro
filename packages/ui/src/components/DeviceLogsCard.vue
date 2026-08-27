<script setup lang="ts">
import type { ParsedDeviceLogPayload } from '@/types.ts'
import { mdiDelete } from '@mdi/js'
import { computed } from 'vue'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VChip, VDivider, VList, VSpacer } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device.ts'
import { useLogStore } from '@/stores/logs.ts'
import DeviceLogEntry from './DeviceLogEntry.vue'

const props = defineProps<{ deviceId: string }>()

const deviceStore = useDeviceStore()
const device = computed(() => deviceStore.getById(props.deviceId))
const logsStore = useLogStore(props.deviceId)

function parseLogEntry(entryString: string): ParsedDeviceLogPayload | null {
  try {
    return JSON.parse(entryString)
  }
  catch {
    return null
  }
}

const parsedLogEntries = computed(() =>
  logsStore.logEntries.map(logEntry => ({
    logEntry,
    parsed: parseLogEntry(logEntry.entry),
  })),
)

const entryCountLabel = computed(() => {
  const count = logsStore.logEntries.length
  return `${count} ${count === 1 ? 'Entry' : 'Entries'}`
})
</script>

<template>
  <template v-if="device">
    <VCard elevation="1">
      <VCardTitle class="d-flex align-center flex-wrap ga-2">
        Logs
        <VSpacer />
        <VBtn
          color="error"
          size="small"
          variant="tonal"
          class="mr-2"
          :prepend-icon="mdiDelete"
          :disabled="logsStore.loading"
          data-test-id="clear-log-button"
          @click="logsStore.clearLogs()"
        >
          Clear Logs
        </VBtn>
        <VChip v-if="logsStore.logEntries.length > 0" size="small" color="primary">
          {{ entryCountLabel }}
        </VChip>
      </VCardTitle>
      <VDivider />
      <VCardText class="pa-0">
        <VList v-if="parsedLogEntries.length !== 0" lines="three" data-test-id="logs-list">
          <template v-for="(item, index) in parsedLogEntries" :key="item.logEntry.logId">
            <DeviceLogEntry :log-entry="item.logEntry" :parsed="item.parsed" />
            <VDivider v-if="index < parsedLogEntries.length - 1" />
          </template>
        </VList>
        <VAlert v-else type="info" variant="tonal" data-test-id="log-list-empty-alert">
          No logs yet.
        </VAlert>
      </VCardText>
    </VCard>
  </template>
</template>
