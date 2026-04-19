<script setup lang="ts">
import { mdiDelete } from '@mdi/js'
import { computed } from 'vue'
import { VAlert, VAvatar, VBtn, VCard, VCardText, VCardTitle, VChip, VCol, VDivider, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle, VIcon, VList, VListItem, VListItemSubtitle, VListItemTitle, VRow, VSpacer } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device.ts'
import { useLogStore } from '@/stores/logs.ts'

const props = defineProps<{ deviceId: string }>()

const deviceStore = useDeviceStore()
const device = computed(() => deviceStore.getById(props.deviceId))
const logsStore = useLogStore(props.deviceId)

function formatDate(date: Date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function parseLogEntry(entryString: string) {
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

function getLogSeverity(message: string) {
  const lowerMessage = message.toLowerCase()
  if (lowerMessage.includes('error') || lowerMessage.includes('failed'))
    return 'error'
  if (lowerMessage.includes('warning') || lowerMessage.includes('warn'))
    return 'warning'
  if (lowerMessage.includes('info'))
    return 'info'
  return 'default'
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'error': return 'error'
    case 'warning': return 'warning'
    case 'info': return 'info'
    default: return 'default'
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'error': return 'mdi-alert-circle'
    case 'warning': return 'mdi-alert'
    case 'info': return 'mdi-information'
    default: return 'mdi-circle-small'
  }
}
</script>

<template>
  <template v-if="device">
    <VCard elevation="1">
      <VCardTitle class="d-flex align-center">
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
          {{ logsStore.logEntries.length }} {{ logsStore.logEntries.length === 1 ? 'Entry' : 'Entries' }}
        </VChip>
      </VCardTitle>
      <VDivider />
      <VCardText class="pa-0">
        <VList v-if="parsedLogEntries.length !== 0" lines="three" data-test-id="logs-list">
          <template v-for="(item, index) in parsedLogEntries" :key="item.logEntry.logId">
            <VListItem data-test-id="log-list-item">
              <template #prepend>
                <VAvatar
                  :color="getSeverityColor(getLogSeverity(item.parsed?.log_message || ''))"
                  size="40"
                >
                  <VIcon :icon="getSeverityIcon(getLogSeverity(item.parsed?.log_message || ''))" />
                </VAvatar>
              </template>

              <VListItemTitle class="text-wrap mb-2">
                {{ item.parsed?.log_message || item.logEntry.entry }}
              </VListItemTitle>

              <VListItemSubtitle>
                <div class="d-flex flex-column gap-1">
                  <div class="d-flex align-center gap-2 flex-wrap">
                    <VChip size="x-small" prepend-icon="mdi-clock-outline" variant="text">
                      {{ formatDate(item.logEntry.date) }}
                    </VChip>
                    <VChip
                      v-if="item.parsed?.log_sourcefile"
                      size="x-small"
                      prepend-icon="mdi-file-code"
                      variant="text"
                    >
                      {{ item.parsed.log_sourcefile }}:{{ item.parsed.log_codeline }}
                    </VChip>
                  </div>

                  <VExpansionPanels
                    v-if="item.parsed?.device_status_stamp || item.parsed?.additional_info"
                    flat
                  >
                    <VExpansionPanel elevation="0" class="bg-transparent">
                      <VExpansionPanelTitle class="pa-0 min-height-auto">
                        <template #default="{ expanded }">
                          <VBtn
                            size="x-small"
                            variant="text"
                            :prepend-icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                            :aria-label="expanded ? 'Hide log details' : 'Show log details'"
                          >
                            {{ expanded ? 'Less' : 'Show Details' }}
                          </VBtn>
                        </template>
                      </VExpansionPanelTitle>
                      <VExpansionPanelText class="pa-0 mt-2">
                        <VCard variant="tonal" class="mb-2">
                          <VCardText class="pa-3">
                            <!-- Device Status -->
                            <div v-if="item.parsed?.device_status_stamp" class="mb-3">
                              <div class="text-subtitle-2 mb-2 font-weight-bold">
                                Device Status
                              </div>
                              <VRow dense>
                                <VCol cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    WiFi RSSI
                                  </div>
                                  <div class="text-body-2">
                                    {{ item.parsed.device_status_stamp.wifi_rssi_level }} dBm
                                  </div>
                                </VCol>
                                <VCol cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    Battery
                                  </div>
                                  <div class="text-body-2">
                                    {{ item.parsed.device_status_stamp.battery_voltage }} V
                                  </div>
                                </VCol>
                                <VCol cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    Firmware
                                  </div>
                                  <div class="text-body-2">
                                    {{ item.parsed.device_status_stamp.current_fw_version }}
                                  </div>
                                </VCol>
                                <VCol cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    Free Heap
                                  </div>
                                  <div class="text-body-2">
                                    {{ (item.parsed.device_status_stamp.free_heap_size / 1024).toFixed(1) }} KB
                                  </div>
                                </VCol>
                                <VCol cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    Wakeup Reason
                                  </div>
                                  <div class="text-body-2">
                                    {{ item.parsed.device_status_stamp.wakeup_reason }}
                                  </div>
                                </VCol>
                                <VCol cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    WiFi Status
                                  </div>
                                  <div class="text-body-2">
                                    {{ item.parsed.device_status_stamp.wifi_status }}
                                  </div>
                                </VCol>
                              </VRow>
                            </div>

                            <!-- Additional Info -->
                            <div
                              v-if="item.parsed?.additional_info
                                && Object.keys(item.parsed.additional_info).length > 0"
                            >
                              <div class="text-subtitle-2 mb-2 font-weight-bold">
                                Additional Info
                              </div>
                              <VRow dense>
                                <VCol
                                  v-for="(value, key) in item.parsed.additional_info"
                                  :key="key"
                                  cols="12"
                                  sm="6"
                                >
                                  <div class="text-caption text-medium-emphasis">
                                    {{ key }}
                                  </div>
                                  <div class="text-body-2">
                                    {{ value || '—' }}
                                  </div>
                                </VCol>
                              </VRow>
                            </div>
                          </VCardText>
                        </VCard>
                      </VExpansionPanelText>
                    </VExpansionPanel>
                  </VExpansionPanels>
                </div>
              </VListItemSubtitle>
            </VListItem>
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

<style scoped>
.gap-1 { gap: 0.25rem; }
.gap-2 { gap: 0.5rem; }
.min-height-auto {
  min-height: auto !important;
}
</style>
