<script setup lang="ts">
import type { Device } from '@/types'
import { mdiAlert, mdiCheck, mdiContentCopy, mdiEye, mdiEyeOff } from '@mdi/js'
import { useClipboard } from '@vueuse/core'
import { ref } from 'vue'
import { VCol, VDivider, VIcon, VRow, VTextField, VTooltip } from 'vuetify/components'
import { formatDate } from '@/utils/formatDate'

defineProps<{
  device: Device
  rssiColor: string
  rssiIcon: string
  batteryColor: string
  batteryIcon: string
  batteryPercentage: number
  modelSummary: string
  reportedSummary: string | null
  reportMismatch: boolean
}>()

const { copy: copyToClipboard, copied: macCopied } = useClipboard()

const showApikey = ref(false)
</script>

<template>
  <VRow class="mb-4" density="comfortable">
    <VCol cols="12" sm="4">
      <strong>Firmware Version:</strong>
      <div>{{ device.fwVersion || 'N/A' }}</div>
    </VCol>
    <VCol cols="12" sm="4">
      <VIcon size="x-large" :color="rssiColor" class="mr-1" :icon="rssiIcon" />
      {{ device.rssi ? `(${device.rssi} dBm)` : 'N/A' }}
    </VCol>
    <VCol cols="12" sm="4">
      <VIcon size="x-large" :color="batteryColor" class="mr-1" :icon="batteryIcon" />
      {{ device.batteryVoltage ? `(${batteryPercentage} %)` : 'N/A' }}
    </VCol>
    <VCol cols="12" sm="4">
      <strong>Model:</strong>
      <div data-test-id="device-model-summary">
        {{ modelSummary }}
        <VTooltip v-if="reportMismatch" location="top" text="The device reports a different panel size than its assigned model. Check the model in Advanced.">
          <template #activator="{ props: tooltipProps }">
            <VIcon
              v-bind="tooltipProps"
              :icon="mdiAlert"
              color="warning"
              size="small"
              class="ml-1"
              tabindex="0"
              role="img"
              aria-label="The device reports a different panel size than its assigned model. Check the model in Advanced."
              data-test-id="device-model-mismatch"
            />
          </template>
        </VTooltip>
      </div>
      <div v-if="reportedSummary" class="text-caption text-medium-emphasis">
        Reported: {{ reportedSummary }}
      </div>
    </VCol>
    <VCol cols="12" sm="4">
      <strong>Last seen:</strong>
      <div class="text-truncate">
        {{ device.lastSeen ? formatDate(device.lastSeen) : 'N/A' }}
      </div>
    </VCol>
    <VCol cols="12" sm="4">
      <strong>User Agent:</strong>
      <div class="text-truncate">
        {{ device.userAgent || 'N/A' }}
      </div>
    </VCol>
  </VRow>
  <VDivider class="my-2" />
  <VRow class="mb-2" density="comfortable">
    <VCol cols="12" sm="12" md="6" lg="4">
      <VTextField :model-value="device.friendlyId" readonly density="compact" hide-details label="Friendly ID" />
    </VCol>
    <VCol cols="12" sm="12" md="6" lg="4">
      <VTextField :model-value="device.mac" readonly density="compact" hide-details label="MAC" :append-icon="macCopied ? mdiCheck : mdiContentCopy" @click:append="copyToClipboard(device.mac)" />
    </VCol>
    <VCol cols="12" sm="12" md="6" lg="4">
      <VTextField :model-value="device.apikey" readonly density="compact" :type="showApikey ? 'text' : 'password'" label="API key" :append-icon="showApikey ? mdiEyeOff : mdiEye" @click:append="showApikey = !showApikey" />
    </VCol>
  </VRow>
</template>
