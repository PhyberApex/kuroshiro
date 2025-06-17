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
  { title: 'Restart Playlist (Not working)', value: 'restart_playlist' },
  { title: 'Rewind', value: 'rewind' },
  { title: 'Send to me (not working)', value: 'send_to_me' },
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
    return 'orange'
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
    return 'Please enter a valid MAC'
  },
]

const apikeyRules = [
  (value: string) => {
    if (!device.value?.mirrorEnabled)
      return true
    if (!value) {
      return 'An apikey is required'
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
    <v-card class="mb-6" elevation="2">
      <v-card-title class="d-flex align-center justify-space-between">
        <div v-if="!nameEditing">
          <span data-test-id="device-name">{{ device.name }}</span>
          <v-icon :icon="mdiPencil" class="ml-2" size="x-small" @click="nameEditing = true" />
          <v-icon :icon="mdiCircle" :color="isDeviceOnline(device) ? 'success' : 'error'" size="x-small" class="ml-2" />
        </div>
        <div v-else>
          <v-text-field v-model="device.name" variant="underlined" density="compact" autofocus :hide-details="true" min-width="200" @blur="nameEditing = false" />
        </div>
        <div>
          <v-btn color="success" variant="tonal" :prepend-icon="mdiContentSave" class="mr-5" :disabled="!valid" @click="saveDevice">
            Update
          </v-btn>
          <v-btn color="error" variant="tonal" :prepend-icon="mdiDelete" data-test-id="delete-device-btn" @click="deleteDevice">
            Delete
          </v-btn>
        </div>
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-row class="mb-4" dense>
          <v-col cols="12" sm="4">
            <strong>Firmware Version:</strong>
            <div>{{ device.fwVersion || 'N/A' }}</div>
          </v-col>
          <v-col cols="12" sm="4">
            <v-icon size="x-large" :color="rssiColor" class="mr-1" :icon="rssiIcon" />
            {{ device.rssi ? `(${device.rssi} dBm)` : 'N/A' }}
          </v-col>
          <v-col cols="12" sm="4">
            <v-icon size="x-large" :color="batteryColor" class="mr-1" :icon="batteryIcon" />
            {{ device.batteryVoltage ? `(${batteryPercentage} %)` : 'N/A' }}
          </v-col>
          <v-col cols="12" sm="4">
            <strong>Display size:</strong>
            <div>{{ device.width && device.height ? `${device.width}x${device.height}` : 'N/A' }}</div>
          </v-col>
          <v-col cols="12" sm="4">
            <strong>Last seen:</strong>
            <div class="text-truncate">
              {{ device.lastSeen ? formatDate(device.lastSeen) : 'N/A' }}
            </div>
          </v-col>
          <v-col cols="12" sm="4">
            <strong>User Agent:</strong>
            <div class="text-truncate">
              {{ device.userAgent || 'N/A' }}
            </div>
          </v-col>
        </v-row>
        <v-divider class="my-2" />
        <v-row class="mb-2" dense>
          <v-col cols="12" sm="12" md="6" lg="4">
            <v-text-field v-model="device.friendlyId" readonly density="compact" hide-details label="Friendly ID" />
          </v-col>
          <v-col cols="12" sm="12" md="6" lg="4">
            <v-text-field v-model="device.mac" readonly density="compact" hide-details label="MAC" :append-icon="macCopied ? mdiCheck : mdiContentCopy" @click:append="copyToClipboard(device.mac)" />
          </v-col>
          <v-col cols="12" sm="12" md="6" lg="4">
            <v-text-field v-model="device.apikey" readonly density="compact" :type="showApikey ? 'text' : 'password'" label="API Key" :append-icon="showApikey ? mdiEyeOff : mdiEye" @click:append="showApikey = !showApikey" />
          </v-col>
          <v-col cols="12" sm="12" md="6" lg="4">
            <v-row>
              <v-col cols="12" sm="5">
                <v-number-input v-model="refreshRateNumber" control-variant="hidden" type="number" density="compact" label="Refresh Rate" />
              </v-col>
              <v-col cols="12" sm="7">
                <v-select v-model="refreshRateUnit" density="compact" label="Unit" :items="['hours', 'minutes', 'seconds']" />
              </v-col>
            </v-row>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="device.specialFunction"
              :items="specialFunctionalities"
              density="compact"
              label="Special Function"
            />
          </v-col>
          <v-col cols="12" sm="4" md="4" lg="4">
            <v-switch v-model="device.resetDevice" color="secondary" density="compact" label="Reset device" />
          </v-col>
          <v-col cols="12" sm="4" md="4" lg="4">
            <v-switch v-model="device.updateFirmware" color="secondary" density="compact" label="Automatic updates" disabled />
          </v-col>
        </v-row>
        <v-divider class="my-2" />
        <v-row class="mb-2" dense>
          <v-col cols="12" sm="6" md="4">
            <v-switch v-model="device.mirrorEnabled" color="secondary" label="Mirroring" />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <VTextField v-model="device.mirrorMac" density="compact" label="MAC to mirror" :disabled="!device.mirrorEnabled" :rules="macRules" />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <VTextField v-model="device.mirrorApikey" density="compact" label="Apikey of mirror" :disabled="!device.mirrorEnabled" :rules="apikeyRules" />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </template>
</template>
