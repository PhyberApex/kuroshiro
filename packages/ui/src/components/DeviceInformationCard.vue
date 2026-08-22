<script setup lang="ts">
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { VBtn, VCard, VCardText, VCardTitle, VChip, VCol, VDivider, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle, VIcon, VNumberInput, VRow, VSelect, VSwitch, VTextField, VTooltip } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device'
import { useDeviceModelsStore } from '@/stores/deviceModels'
import { useFirmwareStore } from '@/stores/firmware'
import { DEFAULT_RENDER_SIZE } from '@/utils/deviceRenderSize'
import { formatDate } from '@/utils/formatDate'
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

watch(device, (current) => {
  selectedModelName.value = current?.deviceModel?.name ?? null
  selectedPaletteId.value = current?.palette?.id ?? null
  selectedFirmwareId.value = current?.targetFirmware?.id ?? null
  sleepStartTime.value = secondsToTimeInput(current?.sleepStartTime)
  sleepEndTime.value = secondsToTimeInput(current?.sleepEndTime)
  pendingSpecialFunction.value = current?.specialFunction ?? 'none'
}, { immediate: true })

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
const nameEditing = ref(false)
</script>

<template>
  <template v-if="device">
    <VCard class="mb-6" elevation="1">
      <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
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
                <VCol cols="12" sm="8" md="6" class="d-flex align-center ga-3">
                  <VSelect
                    v-model="pendingSpecialFunction"
                    :items="specialFunctionalities"
                    density="compact"
                    label="Special Function"
                    data-test-id="device-special-function-select"
                  />
                  <VBtn
                    size="small"
                    color="secondary"
                    variant="tonal"
                    :loading="specialFunctionTriggering"
                    :disabled="pendingSpecialFunction === 'none'"
                    data-test-id="device-special-function-trigger-btn"
                    @click="triggerSpecialFunction"
                  >
                    Trigger
                  </VBtn>
                </VCol>
                <VCol cols="12" sm="4" md="6" class="d-flex align-center">
                  <VBtn
                    size="small"
                    color="secondary"
                    variant="tonal"
                    :loading="resetTriggering"
                    data-test-id="device-reset-trigger-btn"
                    @click="triggerReset"
                  >
                    Reset device
                  </VBtn>
                </VCol>
              </VRow>
              <VRow class="mb-2" density="comfortable">
                <VCol cols="12" sm="6" md="4">
                  <VSelect
                    v-model="selectedModelName"
                    :items="modelOptions"
                    density="compact"
                    label="Device model"
                    data-test-id="device-model-select"
                  />
                </VCol>
                <VCol cols="12" sm="6" md="4">
                  <VSelect
                    v-model="selectedPaletteId"
                    :items="paletteOptions"
                    :disabled="!selectedModel"
                    density="compact"
                    label="Palette"
                    placeholder="Default (richest available)"
                    persistent-placeholder
                    data-test-id="device-palette-select"
                  />
                </VCol>
                <VCol v-if="device.deviceModel?.deprecated" cols="12" sm="12" md="4" class="d-flex align-center">
                  <VChip color="warning" size="small" variant="tonal">
                    Assigned model no longer exists upstream
                  </VChip>
                </VCol>
              </VRow>
              <VRow class="mb-2" density="comfortable">
                <VCol cols="12" sm="8" md="6">
                  <VSelect
                    v-model="selectedFirmwareId"
                    :items="firmwareOptions"
                    density="compact"
                    label="Target firmware"
                    placeholder="None"
                    persistent-placeholder
                    data-test-id="device-firmware-select"
                  />
                </VCol>
                <VCol cols="12" sm="4" md="6" class="d-flex align-center ga-3">
                  <span class="text-caption text-medium-emphasis">Reported: {{ device.fwVersion || 'N/A' }}</span>
                  <VBtn
                    size="small"
                    color="secondary"
                    variant="tonal"
                    :loading="firmwareUpdating"
                    :disabled="!selectedFirmwareId"
                    data-test-id="device-firmware-update-btn"
                    @click="triggerFirmwareUpdate"
                  >
                    Update now
                  </VBtn>
                  <VChip v-if="device.updateFirmware" color="info" size="small" variant="tonal">
                    Update pending
                  </VChip>
                </VCol>
              </VRow>
              <VRow class="mb-2" density="comfortable">
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
              <VDivider class="my-2" />
              <VRow class="mb-0" density="comfortable">
                <VCol cols="12" sm="6" md="3">
                  <VSwitch v-model="device.sleepModeEnabled" color="secondary" label="Sleep Mode" data-test-id="sleep-mode-switch" />
                </VCol>
                <VCol cols="12" sm="6" md="3">
                  <VTextField
                    v-model="sleepStartTime"
                    type="time"
                    density="compact"
                    label="Sleep window from"
                    :error="!sleepWindowValid"
                    :error-messages="!sleepWindowValid ? ['Set both a start and end time to enable Sleep Mode.'] : []"
                    data-test-id="sleep-start-time"
                  />
                </VCol>
                <VCol cols="12" sm="6" md="3">
                  <VTextField
                    v-model="sleepEndTime"
                    type="time"
                    density="compact"
                    label="Sleep window to"
                    :error="!sleepWindowValid"
                    :error-messages="!sleepWindowValid ? ['Set both a start and end time to enable Sleep Mode.'] : []"
                    data-test-id="sleep-end-time"
                  />
                </VCol>
                <VCol cols="12" sm="6" md="3">
                  <VSwitch v-model="device.sleepScreenEnabled" color="secondary" label="Show dedicated sleep screen" data-test-id="sleep-screen-switch" />
                </VCol>
                <VCol v-if="sleepWindowSpansMidnight" cols="12">
                  <span class="text-caption text-medium-emphasis" data-test-id="sleep-window-midnight-hint">This window crosses midnight.</span>
                </VCol>
              </VRow>
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>
      </VCardText>
    </VCard>
  </template>
</template>
