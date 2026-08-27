<script setup lang="ts">
import type { Device } from '@/types'
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
  mdiSignalCellular1,
  mdiSignalCellular2,
  mdiSignalCellular3,
  mdiSignalCellularOutline,
} from '@mdi/js'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { VCard, VCardText, VCardTitle, VDivider, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle } from 'vuetify/components'
import DeviceFirmwareSection from '@/components/device/DeviceFirmwareSection.vue'
import DeviceHardwareControlsSection from '@/components/device/DeviceHardwareControlsSection.vue'
import DeviceHeaderBar from '@/components/device/DeviceHeaderBar.vue'
import DeviceMirroringSection from '@/components/device/DeviceMirroringSection.vue'
import DeviceModelPaletteSection from '@/components/device/DeviceModelPaletteSection.vue'
import DeviceSleepModeSection from '@/components/device/DeviceSleepModeSection.vue'
import DeviceStatusOverview from '@/components/device/DeviceStatusOverview.vue'
import { useDeviceStore } from '@/stores/device'
import { useDeviceModelsStore } from '@/stores/deviceModels'
import { useFirmwareStore } from '@/stores/firmware'
import { DEFAULT_RENDER_SIZE } from '@/utils/deviceRenderSize'
import { isValidMac } from '@/utils/getRandomMac'
import { isDeviceOnline } from '@/utils/isDeviceOnline'
import { secondsToTimeInput, timeInputToSeconds } from '@/utils/sleepMode'

const props = defineProps<{ deviceId: string }>()

const deviceStore = useDeviceStore()
const deviceModelsStore = useDeviceModelsStore()
const firmwareStore = useFirmwareStore()

const device = computed(() => deviceStore.getById(props.deviceId))

onMounted(() => {
  deviceModelsStore.ensureLoaded()
  firmwareStore.ensureLoaded()
})

const selectedModelName = ref<string | null>(null)
const selectedPaletteId = ref<string | null>(null)
const selectedFirmwareId = ref<string | null>(null)
const sleepStartTime = ref('')
const sleepEndTime = ref('')
const pendingSpecialFunction = ref('none')

function syncFormStateFromDevice(current: Device | undefined) {
  if (!current) {
    selectedModelName.value = null
    selectedPaletteId.value = null
    selectedFirmwareId.value = null
    sleepStartTime.value = ''
    sleepEndTime.value = ''
    pendingSpecialFunction.value = 'none'
    return
  }
  selectedModelName.value = current.deviceModel?.name ?? null
  selectedPaletteId.value = current.palette?.id ?? null
  selectedFirmwareId.value = current.targetFirmware?.id ?? null
  sleepStartTime.value = secondsToTimeInput(current.sleepStartTime)
  sleepEndTime.value = secondsToTimeInput(current.sleepEndTime)
  pendingSpecialFunction.value = current.specialFunction ?? 'none'
}

watch(device, syncFormStateFromDevice, { immediate: true })

const sleepWindowSpansMidnight = computed(() => Boolean(sleepStartTime.value && sleepEndTime.value && sleepStartTime.value > sleepEndTime.value))

const firmwareOptions = computed(() => {
  const assigned = device.value?.targetFirmware
  const compatible = firmwareStore.compatibleWith(device.value?.deviceModel?.name)
  const firmwareList = assigned && !compatible.some(fw => fw.id === assigned.id) ? [assigned, ...compatible] : compatible
  return firmwareList.map(fw => ({
    title: `${fw.version}${fw.label ? ` — ${fw.label}` : ''} (${fw.kind === 'official-synced' ? 'official' : 'custom'})${fw.deprecated ? ' — deprecated' : ''}`,
    value: fw.id,
  }))
})

const firmwareUpdating = ref(false)

async function triggerFirmwareUpdate() {
  if (!device.value || !selectedFirmwareId.value)
    return
  firmwareUpdating.value = true
  try {
    await deviceStore.updateDevice(device.value.id, { targetFirmwareId: selectedFirmwareId.value, updateFirmware: true })
  }
  finally {
    firmwareUpdating.value = false
  }
}

const specialFunctionTriggering = ref(false)

async function triggerSpecialFunction() {
  if (!device.value)
    return
  specialFunctionTriggering.value = true
  try {
    await deviceStore.updateDevice(device.value.id, { specialFunction: pendingSpecialFunction.value })
  }
  finally {
    specialFunctionTriggering.value = false
  }
}

const resetTriggering = ref(false)

async function triggerReset() {
  if (!device.value)
    return
  resetTriggering.value = true
  try {
    await deviceStore.updateDevice(device.value.id, { resetDevice: true })
  }
  finally {
    resetTriggering.value = false
  }
}

const selectedModel = computed(() => deviceModelsStore.getByName(selectedModelName.value))

const modelOptions = computed(() => {
  const assigned = device.value?.deviceModel
  const models = assigned && assigned.deprecated ? [assigned, ...deviceModelsStore.activeModels] : deviceModelsStore.activeModels
  return models.map(model => ({
    title: `${model.label} (${model.width}x${model.height})${model.deprecated ? ' — deprecated' : ''}`,
    value: model.name,
  }))
})

const paletteOptions = computed(() =>
  deviceModelsStore.palettesFor(selectedModel.value).map(palette => ({ title: palette.name, value: palette.id })),
)

watch(selectedModel, (model) => {
  if (model && selectedPaletteId.value && !model.paletteIds.includes(selectedPaletteId.value))
    selectedPaletteId.value = null
})

const modelSummary = computed(() => {
  const model = device.value?.deviceModel
  if (!model)
    return `Not resolved yet — renders as TRMNL OG (${DEFAULT_RENDER_SIZE.width}x${DEFAULT_RENDER_SIZE.height})`
  return `${model.label} (${model.width}x${model.height})`
})

const reportedSummary = computed(() => {
  const current = device.value
  if (!current)
    return null
  const parts = [current.reportedModel, current.width && current.height ? `${current.width}x${current.height}` : null].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
})

const reportMismatch = computed(() => {
  const current = device.value
  const model = current?.deviceModel
  if (!current || !model || !current.width || !current.height)
    return false
  return current.width !== model.width || current.height !== model.height
})

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

const sleepWindowValid = computed(() => !device.value?.sleepModeEnabled || (Boolean(sleepStartTime.value) && Boolean(sleepEndTime.value)))

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
  && sleepWindowValid.value
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
  if (!device.value || !sleepWindowValid.value)
    return
  device.value.refreshRate = newRefreshRate.value
  await deviceStore.updateDevice(device.value.id, {
    name: device.value.name,
    refreshRate: device.value.refreshRate,
    mirrorEnabled: device.value.mirrorEnabled,
    mirrorMac: device.value.mirrorMac,
    mirrorApikey: device.value.mirrorApikey,
    sleepModeEnabled: device.value.sleepModeEnabled,
    sleepStartTime: timeInputToSeconds(sleepStartTime.value),
    sleepEndTime: timeInputToSeconds(sleepEndTime.value),
    sleepScreenEnabled: device.value.sleepScreenEnabled,
    ...(selectedModelName.value ? { deviceModelName: selectedModelName.value } : {}),
    ...(selectedPaletteId.value ? { paletteId: selectedPaletteId.value } : {}),
  })
}

defineExpose({
  selectedModelName,
  selectedPaletteId,
  selectedFirmwareId,
  sleepStartTime,
  sleepEndTime,
  pendingSpecialFunction,
  sleepWindowValid,
  firmwareOptions,
  saveDevice,
  triggerSpecialFunction,
  triggerReset,
  triggerFirmwareUpdate,
})
</script>

<template>
  <template v-if="device">
    <VCard class="mb-6" elevation="1">
      <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
        <DeviceHeaderBar
          v-model:name="device.name"
          :online="isDeviceOnline(device)"
          :valid="valid"
          @save="saveDevice"
          @delete="deleteDevice"
        />
      </VCardTitle>
      <VDivider />
      <VCardText>
        <DeviceStatusOverview
          :device="device"
          :rssi-color="rssiColor"
          :rssi-icon="rssiIcon"
          :battery-color="batteryColor"
          :battery-icon="batteryIcon"
          :battery-percentage="batteryPercentage"
          :model-summary="modelSummary"
          :reported-summary="reportedSummary"
          :report-mismatch="reportMismatch"
        />
        <VExpansionPanels class="mt-2" flat>
          <VExpansionPanel>
            <VExpansionPanelTitle>Advanced</VExpansionPanelTitle>
            <VExpansionPanelText>
              <DeviceHardwareControlsSection
                v-model:refresh-rate-number="refreshRateNumber"
                v-model:refresh-rate-unit="refreshRateUnit"
                v-model:pending-special-function="pendingSpecialFunction"
                :special-function-triggering="specialFunctionTriggering"
                :reset-triggering="resetTriggering"
                @trigger-special-function="triggerSpecialFunction"
                @trigger-reset="triggerReset"
              />
              <DeviceModelPaletteSection
                v-model:selected-model-name="selectedModelName"
                v-model:selected-palette-id="selectedPaletteId"
                :model-options="modelOptions"
                :palette-options="paletteOptions"
                :palette-disabled="!selectedModel"
                :deprecated-assigned="Boolean(device.deviceModel?.deprecated)"
              />
              <DeviceFirmwareSection
                v-model:selected-firmware-id="selectedFirmwareId"
                :firmware-options="firmwareOptions"
                :firmware-updating="firmwareUpdating"
                :fw-version="device.fwVersion"
                :update-pending="device.updateFirmware"
                @trigger-firmware-update="triggerFirmwareUpdate"
              />
              <DeviceMirroringSection
                v-model:mirror-enabled="device.mirrorEnabled"
                v-model:mirror-mac="device.mirrorMac"
                v-model:mirror-apikey="device.mirrorApikey"
                :mac-rules="macRules"
                :apikey-rules="apikeyRules"
              />
              <VDivider class="my-2" />
              <DeviceSleepModeSection
                v-model:sleep-mode-enabled="device.sleepModeEnabled"
                v-model:sleep-start-time="sleepStartTime"
                v-model:sleep-end-time="sleepEndTime"
                v-model:sleep-screen-enabled="device.sleepScreenEnabled"
                :sleep-window-valid="sleepWindowValid"
                :sleep-window-spans-midnight="sleepWindowSpansMidnight"
              />
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>
      </VCardText>
    </VCard>
  </template>
</template>
