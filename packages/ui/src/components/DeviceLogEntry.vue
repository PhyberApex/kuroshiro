<script setup lang="ts">
import type { LogEntry, LogSeverity, NormalizedLogEntry } from '@/types.ts'
import { computed } from 'vue'
import { VAvatar, VBtn, VCard, VCardText, VChip, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle, VIcon, VListItem, VListItemSubtitle, VListItemTitle } from 'vuetify/components'
import DeviceLogAdditionalInfo from './DeviceLogAdditionalInfo.vue'
import DeviceLogStatusPanel from './DeviceLogStatusPanel.vue'

const props = defineProps<{
  logEntry: LogEntry
  parsed: NormalizedLogEntry
}>()

function formatLogTimestamp(date: Date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getSeverityColor(severity: LogSeverity) {
  switch (severity) {
    case 'error': return 'error'
    case 'warning': return 'warning'
    case 'info': return 'info'
    default: return 'default'
  }
}

function getSeverityIcon(severity: LogSeverity) {
  switch (severity) {
    case 'error': return 'mdi-alert-circle'
    case 'warning': return 'mdi-alert'
    case 'info': return 'mdi-information'
    default: return 'mdi-circle-small'
  }
}

function detailsToggleState(expanded: boolean) {
  return {
    icon: expanded ? 'mdi-chevron-up' : 'mdi-chevron-down',
    ariaLabel: expanded ? 'Hide log details' : 'Show log details',
    label: expanded ? 'Less' : 'Show Details',
  }
}

const message = computed(() => props.parsed.message || props.logEntry.entry)
const severity = computed(() => props.parsed.severity)
const hasAdditionalInfo = computed(() => Object.keys(props.parsed.extras).length > 0)
const hasDetails = computed(() => !!props.parsed.status || hasAdditionalInfo.value)
</script>

<template>
  <VListItem data-test-id="log-list-item">
    <template #prepend>
      <VAvatar :color="getSeverityColor(severity)" size="40">
        <VIcon :icon="getSeverityIcon(severity)" />
      </VAvatar>
    </template>

    <VListItemTitle class="text-wrap mb-2">
      {{ message }}
    </VListItemTitle>

    <VListItemSubtitle>
      <div class="d-flex flex-column gap-1">
        <div class="d-flex align-center gap-2 flex-wrap">
          <VChip size="x-small" prepend-icon="mdi-clock-outline" variant="text">
            {{ formatLogTimestamp(logEntry.date) }}
          </VChip>
          <VChip
            v-if="parsed.sourceFile"
            size="x-small"
            prepend-icon="mdi-file-code"
            variant="text"
          >
            {{ parsed.sourceFile }}:{{ parsed.sourceLine }}
          </VChip>
        </div>

        <VExpansionPanels v-if="hasDetails" flat>
          <VExpansionPanel elevation="0" class="bg-transparent">
            <VExpansionPanelTitle class="pa-0 min-height-auto">
              <template #default="{ expanded }">
                <VBtn
                  size="x-small"
                  variant="text"
                  :prepend-icon="detailsToggleState(expanded).icon"
                  :aria-label="detailsToggleState(expanded).ariaLabel"
                  data-test-id="log-entry-details-toggle"
                >
                  {{ detailsToggleState(expanded).label }}
                </VBtn>
              </template>
            </VExpansionPanelTitle>
            <VExpansionPanelText class="pa-0 mt-2">
              <VCard variant="tonal" class="mb-2">
                <VCardText class="pa-3">
                  <DeviceLogStatusPanel v-if="parsed.status" :status="parsed.status" />
                  <DeviceLogAdditionalInfo v-if="hasAdditionalInfo" :info="parsed.extras" />
                </VCardText>
              </VCard>
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>
      </div>
    </VListItemSubtitle>
  </VListItem>
</template>

<style scoped>
.gap-1 { gap: 0.25rem; }
.gap-2 { gap: 0.5rem; }
.min-height-auto {
  min-height: auto !important;
}
</style>
