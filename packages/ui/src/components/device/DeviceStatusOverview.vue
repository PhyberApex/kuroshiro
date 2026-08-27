<script setup lang="ts">
import type { Device } from '@/types'
import {
  mdiAlert,
  mdiBattery,
  mdiBattery10,
  mdiBattery20,
  mdiBattery30,
  mdiBattery40,
  mdiBattery50,
  mdiBattery60,
  mdiBattery70,
  mdiBattery80,
  mdiBattery90,
  mdiBatteryOutline,
  mdiBatteryUnknown,
  mdiCheck,
  mdiContentCopy,
  mdiEye,
  mdiEyeOff,
  mdiSignalCellular1,
  mdiSignalCellular2,
  mdiSignalCellular3,
  mdiSignalCellularOutline,
} from '@mdi/js'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'
import { VCol, VDivider, VIcon, VRow, VTextField, VTooltip } from 'vuetify/components'
import { DEFAULT_RENDER_SIZE } from '@/utils/deviceRenderSize'
import { formatDate } from '@/utils/formatDate'

const props = defineProps<{
  device: Device
}>()

const { copy: copyToClipboard, copied: macCopied } = useClipboard()

const showApikey = ref(false)

const modelSummary = computed(() => {
  const model = props.device.deviceModel
  if (!model)
    return `Not resolved yet — renders as TRMNL OG (${DEFAULT_RENDER_SIZE.width}x${DEFAULT_RENDER_SIZE.height})`
  return `${model.label} (${model.width}x${model.height})`
})

const reportedSummary = computed(() => {
  const { reportedModel, width, height } = props.device
  const parts = [reportedModel, width && height ? `${width}x${height}` : null].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
})

const reportMismatch = computed(() => {
  const { deviceModel, width, height } = props.device
  if (!deviceModel || !width || !height)
    return false
  return width !== deviceModel.width || height !== deviceModel.height
})

const rssiStrength = computed(() => {
  if (!props.device.rssi)
    return -1
  const rssi = Number.parseInt(props.device.rssi)
  if (Number.isNaN(rssi))
    return -1
  if (rssi >= -70)
    return 3
  if (rssi >= -80)
    return 2
  if (rssi >= -90)
    return 1
  return 0
})
const rssiColor = computed((): string => {
  switch (rssiStrength.value) {
    case 3: return 'success'
    case 2: return 'warning'
    case 1: return 'warning'
    case 0: return 'error'
    case -1: return 'secondary'
    default:
      { const _: never = rssiStrength.value }
      return ''
  }
})
const rssiIcon = computed((): string => {
  switch (rssiStrength.value) {
    case 3: return mdiSignalCellular3
    case 2: return mdiSignalCellular2
    case 1: return mdiSignalCellular1
    case 0: return mdiSignalCellularOutline
    case -1: return mdiSignalCellularOutline
    default:
      { const _: never = rssiStrength.value }
      return ''
  }
})

const batteryPercentage = computed(() => {
  if (!props.device.batteryVoltage)
    return -1
  const voltage = Number.parseFloat(props.device.batteryVoltage)
  if (voltage >= 4.2)
    return 100
  if (voltage <= 3.0)
    return 0
  return Math.round(((voltage - 3.0) / 0.012))
})

const batteryColor = computed(() => {
  if (batteryPercentage.value === -1)
    return 'secondary'
  if (batteryPercentage.value <= 10)
    return 'error'
  if (batteryPercentage.value <= 20)
    return 'warning'
  if (batteryPercentage.value <= 60)
    return 'warning'
  return 'success'
})

const batteryIcon = computed(() => {
  const iconMap = [
    { min: 95, icon: mdiBattery },
    { min: 85, icon: mdiBattery90 },
    { min: 75, icon: mdiBattery80 },
    { min: 65, icon: mdiBattery70 },
    { min: 55, icon: mdiBattery60 },
    { min: 45, icon: mdiBattery50 },
    { min: 35, icon: mdiBattery40 },
    { min: 25, icon: mdiBattery30 },
    { min: 15, icon: mdiBattery20 },
    { min: 5, icon: mdiBattery10 },
    { min: 0, icon: mdiBatteryOutline },
  ]
  return iconMap.find(item => batteryPercentage.value >= item.min)?.icon || mdiBatteryUnknown
})
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
