<script setup lang="ts">
import { mdiDelete } from '@mdi/js'
import { computed } from 'vue'
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
    <v-card elevation="2">
      <v-card-title class="d-flex align-center">
        Logs
        <v-spacer />
        <v-btn
          color="error"
          size="small"
          variant="tonal"
          class="mr-2"
          :prepend-icon="mdiDelete"
          :disabled="logsStore.loading"
          @click="logsStore.clearLogs()"
        >
          Clear Logs
        </v-btn>
        <v-chip v-if="logsStore.logEntries.length > 0" size="small" color="primary">
          {{ logsStore.logEntries.length }} {{ logsStore.logEntries.length === 1 ? 'Entry' : 'Entries' }}
        </v-chip>
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-0">
        <v-list v-if="logsStore.logEntries.length !== 0" lines="three" data-test-id="logs-list">
          <template v-for="(logEntry, index) in logsStore.logEntries" :key="logEntry.logId">
            <v-list-item>
              <template #prepend>
                <v-avatar
                  :color="getSeverityColor(getLogSeverity(parseLogEntry(logEntry.entry)?.log_message || ''))"
                  size="40"
                >
                  <v-icon :icon="getSeverityIcon(getLogSeverity(parseLogEntry(logEntry.entry)?.log_message || ''))" />
                </v-avatar>
              </template>

              <v-list-item-title class="text-wrap mb-2">
                {{ parseLogEntry(logEntry.entry)?.log_message || logEntry.entry }}
              </v-list-item-title>

              <v-list-item-subtitle>
                <div class="d-flex flex-column gap-1">
                  <div class="d-flex align-center gap-2 flex-wrap">
                    <v-chip size="x-small" prepend-icon="mdi-clock-outline" variant="text">
                      {{ formatDate(logEntry.date) }}
                    </v-chip>
                    <v-chip
                      v-if="parseLogEntry(logEntry.entry)?.log_sourcefile"
                      size="x-small"
                      prepend-icon="mdi-file-code"
                      variant="text"
                    >
                      {{ parseLogEntry(logEntry.entry).log_sourcefile }}:{{ parseLogEntry(logEntry.entry).log_codeline }}
                    </v-chip>
                  </div>

                  <v-expansion-panels
                    v-if="parseLogEntry(logEntry.entry)?.device_status_stamp || parseLogEntry(logEntry.entry)?.additional_info"
                    flat
                  >
                    <v-expansion-panel elevation="0" class="bg-transparent">
                      <v-expansion-panel-title class="pa-0 min-height-auto">
                        <template #default="{ expanded }">
                          <v-btn
                            size="x-small"
                            variant="text"
                            :prepend-icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                          >
                            {{ expanded ? 'Less' : 'Show Details' }}
                          </v-btn>
                        </template>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text class="pa-0 mt-2">
                        <v-card variant="tonal" class="mb-2">
                          <v-card-text class="pa-3">
                            <!-- Device Status -->
                            <div v-if="parseLogEntry(logEntry.entry)?.device_status_stamp" class="mb-3">
                              <div class="text-subtitle-2 mb-2 font-weight-bold">
                                Device Status
                              </div>
                              <v-row dense>
                                <v-col cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    WiFi RSSI
                                  </div>
                                  <div class="text-body-2">
                                    {{ parseLogEntry(logEntry.entry).device_status_stamp.wifi_rssi_level }} dBm
                                  </div>
                                </v-col>
                                <v-col cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    Battery
                                  </div>
                                  <div class="text-body-2">
                                    {{ parseLogEntry(logEntry.entry).device_status_stamp.battery_voltage }} V
                                  </div>
                                </v-col>
                                <v-col cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    Firmware
                                  </div>
                                  <div class="text-body-2">
                                    {{ parseLogEntry(logEntry.entry).device_status_stamp.current_fw_version }}
                                  </div>
                                </v-col>
                                <v-col cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    Free Heap
                                  </div>
                                  <div class="text-body-2">
                                    {{ (parseLogEntry(logEntry.entry).device_status_stamp.free_heap_size / 1024).toFixed(1) }} KB
                                  </div>
                                </v-col>
                                <v-col cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    Wakeup Reason
                                  </div>
                                  <div class="text-body-2">
                                    {{ parseLogEntry(logEntry.entry).device_status_stamp.wakeup_reason }}
                                  </div>
                                </v-col>
                                <v-col cols="6" sm="4">
                                  <div class="text-caption text-medium-emphasis">
                                    WiFi Status
                                  </div>
                                  <div class="text-body-2">
                                    {{ parseLogEntry(logEntry.entry).device_status_stamp.wifi_status }}
                                  </div>
                                </v-col>
                              </v-row>
                            </div>

                            <!-- Additional Info -->
                            <div
                              v-if="parseLogEntry(logEntry.entry)?.additional_info
                                && Object.keys(parseLogEntry(logEntry.entry).additional_info).length > 0"
                            >
                              <div class="text-subtitle-2 mb-2 font-weight-bold">
                                Additional Info
                              </div>
                              <v-row dense>
                                <v-col
                                  v-for="(value, key) in parseLogEntry(logEntry.entry).additional_info"
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
                                </v-col>
                              </v-row>
                            </div>
                          </v-card-text>
                        </v-card>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
              </v-list-item-subtitle>
            </v-list-item>
            <v-divider v-if="index < logsStore.logEntries.length - 1" />
          </template>
        </v-list>
        <v-alert v-else type="info" data-test-id="log-list-empty-alert">
          No logs for this device yet.
        </v-alert>
      </v-card-text>
    </v-card>
  </template>
</template>

<style scoped>
.gap-1 {
  gap: 0.25rem;
}

.gap-2 {
  gap: 0.5rem;
}

.min-height-auto {
  min-height: auto !important;
}
</style>
