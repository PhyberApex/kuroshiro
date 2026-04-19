<script setup lang="ts">
import {
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
  mdiCircle,
  mdiContentCopy,
  mdiContentSave,
  mdiDelete,
  mdiEye,
  mdiEyeOff,
  mdiPencil,
  mdiSignalCellular1,
  mdiSignalCellular2,
  mdiSignalCellular3,
  mdiSignalCellularOutline,
} from '@mdi/js'
import { useClipboard } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { VBtn, VCard, VCardText, VCardTitle, VCol, VDivider, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle, VIcon, VNumberInput, VRow, VSelect, VSwitch, VTextField } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device'
import { formatDate } from '@/utils/formatDate'
import { isValidMac } from '@/utils/getRandomMac'
import { isDeviceOnline } from '@/utils/isDeviceOnline'

const props = defineProps<{ deviceId: string }>()

const deviceStore = useDeviceStore()

const device = computed(() => deviceStore.getById(props.deviceId))

const { copy: copyToClipboard, copied: macCopied } = useClipboard()

const rssiStrength = computed(() => {
  if (!device.value || !device.value.rssi)
    return -1
  const rssi = Number.parseInt(device.value.rssi)
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

const specialFunctionalities = [
  { title: 'None', value: 'none' },
  { title: 'Identify', value: 'identify' },
  { title: 'Sleep', value: 'sleep' },
  { title: 'Add WiFi', value: 'add_wifi' },
  { title: 'Restart playlist (unavailable)', value: 'restart_playlist' },
  { title: 'Rewind', value: 'rewind' },
  { title: 'Send to me (unavailable)', value: 'send_to_me' },
]

const router = useRouter()

async function deleteDevice() {
  if (!device.value)
    return
  await deviceStore.deleteDevice(device.value.id)
  await router.push({ name: 'overview' })
}

const batteryPercentage = computed(() => {
  if (!device.value?.batteryVoltage)
    return -1
  const voltage = Number.parseFloat(device.value.batteryVoltage)
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

const showApikey = ref(false)

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

const macRules = [
  (value: string) => {
    if (!device.value?.mirrorEnabled)
      return true
    if (isValidMac(value)) {
      return true
    }
    return 'Enter a valid MAC address'
  },
]

const apikeyRules = [
  (value: string) => {
    if (!device.value?.mirrorEnabled)
      return true
    if (!value) {
      return 'API key is required'
    }
    return true
  },
]

const valid = computed(() => {
  return !macRules.map((rule) => {
    if (!device.value)
      return null
    return rule(device.value?.mirrorMac)
  }).some(validationResult => validationResult !== true)
  && !apikeyRules.map((rule) => {
    if (!device.value)
      return null
    return rule(device.value?.mirrorApikey)
  }).some(validationResult => validationResult !== true)
})

const refreshRateUnit = ref<'hours' | 'minutes' | 'seconds'>('seconds')

const refreshRateNumber = ref(300)

const newRefreshRate = computed(() => {
  switch (refreshRateUnit.value) {
    case 'hours':
      return refreshRateNumber.value * 3600
    case 'minutes':
      return refreshRateNumber.value * 60
    case 'seconds':
      return refreshRateNumber.value
    default:
      { const _: never = refreshRateUnit.value }
      return 0
  }
})

watch(() => device.value?.refreshRate, () => {
  if (device.value?.refreshRate && device.value.refreshRate % 3600 === 0) {
    refreshRateNumber.value = device.value.refreshRate / 3600
    refreshRateUnit.value = 'hours'
  }
  else if (device.value?.refreshRate && device.value.refreshRate % 60 === 0) {
    refreshRateNumber.value = device.value.refreshRate / 60
    refreshRateUnit.value = 'minutes'
  }
  else {
    refreshRateNumber.value = device.value?.refreshRate || 0
    refreshRateUnit.value = 'seconds'
  }
})

async function saveDevice() {
  if (!device.value)
    return
  device.value.refreshRate = newRefreshRate.value
  await deviceStore.updateDevice(device.value.id, {
    name: device.value.name,
    refreshRate: device.value.refreshRate,
    resetDevice: device.value.resetDevice,
    mirrorEnabled: device.value.mirrorEnabled,
    mirrorMac: device.value.mirrorMac,
    mirrorApikey: device.value.mirrorApikey,
    specialFunction: device.value.specialFunction,
  })
}
const nameEditing = ref(false)
</script>

<template>
  <template v-if="device">
    <VCard class="mb-6" elevation="1">
      <VCardTitle class="d-flex align-center justify-space-between">
        <div v-if="!nameEditing">
          <span data-test-id="device-name">{{ device.name }}</span>
          <v-icon-btn :icon="mdiPencil" size="x-small" class="ml-2" aria-label="Edit device name" variant="text" @click="nameEditing = true" />
          <VIcon :icon="mdiCircle" :color="isDeviceOnline(device) ? 'success' : 'error'" size="x-small" class="ml-2" />
        </div>
        <div v-else>
          <VTextField v-model="device.name" variant="underlined" density="compact" autofocus :hide-details="true" min-width="200" @blur="nameEditing = false" />
        </div>
        <div>
          <VBtn color="success" variant="tonal" :prepend-icon="mdiContentSave" class="mr-5" :disabled="!valid" @click="saveDevice">
            Update
          </VBtn>
          <VBtn color="error" variant="tonal" :prepend-icon="mdiDelete" data-test-id="delete-device-btn" @click="deleteDevice">
            Delete
          </VBtn>
        </div>
      </VCardTitle>
      <VDivider />
      <VCardText>
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
            <strong>Display size:</strong>
            <div>{{ device.width && device.height ? `${device.width}x${device.height}` : 'N/A' }}</div>
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
            <VTextField v-model="device.friendlyId" readonly density="compact" hide-details label="Friendly ID" />
          </VCol>
          <VCol cols="12" sm="12" md="6" lg="4">
            <VTextField v-model="device.mac" readonly density="compact" hide-details label="MAC" :append-icon="macCopied ? mdiCheck : mdiContentCopy" @click:append="copyToClipboard(device.mac)" />
          </VCol>
          <VCol cols="12" sm="12" md="6" lg="4">
            <VTextField v-model="device.apikey" readonly density="compact" :type="showApikey ? 'text' : 'password'" label="API key" :append-icon="showApikey ? mdiEyeOff : mdiEye" @click:append="showApikey = !showApikey" />
          </VCol>
        </VRow>
        <VExpansionPanels class="mt-2" flat>
          <VExpansionPanel>
            <VExpansionPanelTitle>Advanced</VExpansionPanelTitle>
            <VExpansionPanelText>
              <VRow class="mb-2" density="comfortable">
                <VCol cols="12" sm="12" md="6" lg="4">
                  <VRow>
                    <VCol cols="12" sm="5">
                      <VNumberInput v-model="refreshRateNumber" control-variant="hidden" type="number" density="compact" label="Refresh Rate" />
                    </VCol>
                    <VCol cols="12" sm="7">
                      <VSelect v-model="refreshRateUnit" density="compact" label="Unit" :items="['hours', 'minutes', 'seconds']" />
                    </VCol>
                  </VRow>
                </VCol>
                <VCol cols="12" sm="6" md="4">
                  <VSelect
                    v-model="device.specialFunction"
                    :items="specialFunctionalities"
                    density="compact"
                    label="Special Function"
                  />
                </VCol>
                <VCol cols="12" sm="4" md="4" lg="4">
                  <VSwitch v-model="device.resetDevice" color="secondary" density="compact" label="Reset device" />
                </VCol>
                <VCol cols="12" sm="4" md="4" lg="4">
                  <VSwitch v-model="device.updateFirmware" color="secondary" density="compact" label="Automatic updates" disabled />
                </VCol>
              </VRow>
              <VRow class="mb-0" density="comfortable">
                <VCol cols="12" sm="6" md="4">
                  <VSwitch v-model="device.mirrorEnabled" color="secondary" label="Mirroring" />
                </VCol>
                <VCol cols="12" sm="6" md="4">
                  <VTextField v-model="device.mirrorMac" density="compact" label="Mirror MAC address" :disabled="!device.mirrorEnabled" :rules="macRules" />
                </VCol>
                <VCol cols="12" sm="6" md="4">
                  <VTextField v-model="device.mirrorApikey" density="compact" label="Mirror API key" :disabled="!device.mirrorEnabled" :rules="apikeyRules" />
                </VCol>
              </VRow>
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>
      </VCardText>
    </VCard>
  </template>
</template>
