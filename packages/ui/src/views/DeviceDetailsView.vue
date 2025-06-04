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
  mdiCodeBlockTags,
  mdiContentCopy,
  mdiContentSave,
  mdiDelete,
  mdiDownload,
  mdiEye,
  mdiEyeOff,
  mdiLink,
  mdiOpenInNew,
  mdiRefresh,
  mdiSignalCellular1,
  mdiSignalCellular2,
  mdiSignalCellular3,
  mdiSignalCellularOutline,
  mdiStop,
  mdiUpload,
} from '@mdi/js'
import { useClipboard } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { VTextField } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device'
import { useScreensStore } from '@/stores/screens'
import exampleHtml from '@/utils/exampleHtml'
import { formatDate } from '@/utils/formatDate'
import { isValidMac } from '@/utils/getRandomMac'
import { isDeviceOnline } from '@/utils/isDeviceOnline'

const props = defineProps<{ id: string }>()

const deviceStore = useDeviceStore()
const screensStore = useScreensStore()

const externalLink = ref('')
const fetchManual = ref(false)
const fileInput = ref<File | null>(null)

const previewIframeRef = useTemplateRef('previewIframeRef')

const { copy: copyToClipboard, copied: macCopied } = useClipboard()

const addScreenTab = ref<'link' | 'file' | 'html'>('link')

const filename = ref('')

const filenameRules = [
  (value: string) => {
    if (!value)
      return 'A filename is required'
    return true
  },
]

const showHtmlPreview = ref(false)

onMounted(async () => {
  await screensStore.fetchScreensForDevice(props.id)
})

const device = computed(() => deviceStore.getById(props.id))

const externalLinkRef = useTemplateRef('externalLinkRef')

onMounted(async () => {
  if (!device.value)
    return
  await screensStore.fetchCurrentScreenForDevice(device.value.mac, device.value.apikey)
})

const linkRules = [
  (value: string) => {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return true
    }
    return 'Needs to start with http:// or https://'
  },
]

const linkValid = computed(() => {
  return !linkRules.map(rule => rule(externalLink.value)).some(validationResult => validationResult !== true)
})

const renderHtml = ref('')

const renderHtmlValid = computed(() => {
  return renderHtml.value !== ''
})

async function renderPreviewHtml(html: string) {
  showHtmlPreview.value = true
  await nextTick()
  const iframe = previewIframeRef.value
  if (!iframe)
    return

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc)
    return
  doc.open()
  doc.write(`<html><head><link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css"><script src="https://usetrmnl.com/js/latest/plugins.js"><\/script></head><body>${html}</body></html>`)
  doc.close()
  showHtmlPreview.value = true
}

const addScreenInputValid = computed(() => {
  // If no device or no width or no height we can't add a screen
  if (!device.value || !device.value.width || !device.value.height)
    return false
  if (!filename.value)
    return false
  // Check for link selected
  if (addScreenTab.value === 'link' && (!externalLink.value || !linkValid.value))
    return false
  if (addScreenTab.value === 'file' && !fileInput.value)
    return false
  if (addScreenTab.value === 'html' && !renderHtmlValid.value)
    return false
  return true
})

const addScreenIcon = computed(() => {
  switch (addScreenTab.value) {
    case 'file':
      return mdiUpload
    case 'link':
      return fetchManual.value ? mdiDownload : mdiLink
    case 'html':
      return mdiCodeBlockTags
    default:
      return mdiStop
  }
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

const addScreenInfo = computed(() => {
  let title = ''
  let text = ''
  if (addScreenTab.value === 'link') {
    if (fetchManual.value) {
      title = 'External link (cached)'
      text = 'The image will be downloaded and converted now and is only updated with the link on manually.'
    }
    else {
      title = 'External link (no cache)'
      text = 'The URL will be fetched on each request dynamically and a image will be generated from it on the fly.'
    }
  }
  else if (addScreenTab.value === 'file') {
    title = 'Upload file'
    text = 'The file is uploaded, converted and will be statically served.'
  }
  else if (addScreenTab.value === 'html') {
    title = 'Render HTML'
    text = 'Enter HTML to be rendered and presented. The TRMNL framework is available.'
  }
  return { title, text }
})

async function submitAddScreen() {
  if (addScreenTab.value === 'link') {
    if (!externalLink.value)
      return
    await screensStore.addScreen(props.id, externalLink.value, fetchManual.value, filename.value)
    externalLinkRef.value?.reset()
    fetchManual.value = false
  }
  else if (addScreenTab.value === 'file') {
    if (!fileInput.value)
      return
    await screensStore.addScreenFile(props.id, fileInput.value, filename.value)
    fileInput.value = null
  }
  else if (addScreenTab.value === 'html') {
    await screensStore.addScreenHtml(props.id, renderHtml.value, filename.value)
    renderHtml.value = ''
  }
}

const specialFunctionalities = [
  { title: 'None', value: 'none' },
  { title: 'Identify', value: 'identify' },
  { title: 'Sleep', value: 'sleep' },
  { title: 'Add WiFi', value: 'add_wifi' },
  { title: 'Restart Playlist (Not working)', value: 'restart_playlist' },
  { title: 'Rewind', value: 'rewind' },
  { title: 'Send to me (not working)', value: 'send_to_me' },
]

async function deleteScreen(screenId: string) {
  if (!device.value)
    return
  await screensStore.deleteScreen(device.value.id, screenId)
}

async function updateExternalImage(screenId: string) {
  if (!device.value)
    return
  await screensStore.updateExternalScreen(device.value.id, screenId)
}

const router = useRouter()

async function saveDevice() {
  if (!device.value)
    return
  await deviceStore.updateDevice(device.value.id, {
    apikey: device.value.apikey,
    refreshRate: device.value.refreshRate,
    resetDevice: device.value.resetDevice,
    mirrorEnabled: device.value.mirrorEnabled,
    mirrorMac: device.value.mirrorMac,
    mirrorApikey: device.value.mirrorApikey,
    specialFunction: device.value.specialFunction,
  })
}

async function deleteDevice() {
  if (!device.value)
    return
  await deviceStore.deleteDevice(device.value.id)
  router.push({ name: 'overview' })
}

const batteryPercentage = computed(() => {
  if (!device.value?.batteryVoltage)
    return -1
  const voltage = Number.parseFloat(device.value.batteryVoltage)
  if (voltage >= 4.2)
    return 100
  if (voltage <= 3.0)
    return 0
  return Math.round((((voltage - 3.0) / (4.2 - 3.0)) * 100) * 100) / 100
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
</script>

<template>
  <v-container v-if="device" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="12">
        <v-card class="mb-6" color="primary" variant="tonal" elevation="2">
          <v-card-text>
            <b>Device Details:</b> View and edit device details, manage screens, and access device-specific actions.
          </v-card-text>
        </v-card>
        <v-row>
          <v-col cols="12" sm="12" md="7">
            <v-card class="mb-6" elevation="2">
              <v-card-title class="d-flex align-center justify-space-between">
                <div>
                  {{ device.name }}
                  <v-icon :icon="mdiCircle" :color="isDeviceOnline(device) ? 'success' : 'error'" size="x-small" />
                </div>
                <div>
                  <v-btn color="success" variant="tonal" :prepend-icon="mdiContentSave" class="mr-5" :disabled="!valid" @click="saveDevice">
                    Update
                  </v-btn>
                  <v-btn color="error" variant="tonal" :prepend-icon="mdiDelete" @click="deleteDevice">
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
                    <VTextField v-model="device.friendlyId" readonly density="compact" hide-details label="Friendly ID" />
                  </v-col>
                  <v-col cols="12" sm="12" md="6" lg="4">
                    <VTextField v-model="device.mac" density="compact" label="MAC Address" readonly :append-inner-icon="macCopied ? mdiCheck : mdiContentCopy" @click:append-inner="copyToClipboard(device.mac)" />
                  </v-col>
                  <v-col cols="12" sm="12" md="6" lg="4">
                    <VTextField v-model="device.apikey" density="compact" :type="showApikey ? 'text' : 'password'" label="API Key" :append-icon="showApikey ? mdiEyeOff : mdiEye" @click:append="showApikey = !showApikey" />
                  </v-col>
                  <v-col cols="12" sm="12" md="6" lg="4">
                    <v-number-input v-model="device.refreshRate" type="number" control-variant="default" density="compact" hide-details label="Refresh Rate" />
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
            <v-card class="mb-6" elevation="1">
              <v-card-title>Current Screen</v-card-title>
              <v-divider />
              <v-card-text>
                <v-img :src="screensStore.currentScreen?.image_url" />
                <div v-if="screensStore.currentScreen" class="mt-5 text-subtitle-1">
                  Generated {{ formatDate(screensStore.currentScreen?.rendered_at) }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="12" md="5">
            <v-card class="mb-6" elevation="1">
              <v-card-title>Add Screen</v-card-title>
              <v-divider />
              <v-card-text>
                <VTextField v-model="filename" :rules="filenameRules" label="Filename" />
                <v-tabs v-model="addScreenTab" grow>
                  <v-tab value="link">
                    External Link
                  </v-tab>
                  <v-tab value="file">
                    Upload File
                  </v-tab>
                  <v-tab value="html">
                    Render HTML
                  </v-tab>
                </v-tabs>
                <v-window v-model="addScreenTab">
                  <v-window-item value="link">
                    <v-form>
                      <v-row>
                        <v-col cols="12">
                          <VTextField ref="externalLinkRef" v-model="externalLink" :rules="linkRules" label="External image link" required clearable :disabled="!device.width || !device.height" />
                          <v-switch v-model="fetchManual" color="secondary" label="Cache (image needs to be updated manually)" />
                        </v-col>
                      </v-row>
                    </v-form>
                  </v-window-item>
                  <v-window-item value="file">
                    <v-form>
                      <v-row>
                        <v-col cols="12">
                          <v-file-input v-model="fileInput" label="Upload image" accept="image/png, image/jpeg, image/bmp" :disabled="!device.width || !device.height" />
                        </v-col>
                      </v-row>
                    </v-form>
                  </v-window-item>
                  <v-window-item value="html">
                    <v-form>
                      <v-row>
                        <v-col cols="12">
                          <v-textarea v-model="renderHtml" label="HTML to render" :placeholder="exampleHtml" />
                        </v-col>
                      </v-row>
                    </v-form>
                  </v-window-item>
                </v-window>
                <v-card color="primary" variant="tonal" elevation="2">
                  <v-card-text>
                    <b>{{ addScreenInfo.title }}:</b> {{ addScreenInfo.text }}
                  </v-card-text>
                </v-card>
                <v-btn
                  color="primary"
                  class="mt-5"
                  :prepend-icon="addScreenIcon"
                  :disabled="!addScreenInputValid"
                  @click="submitAddScreen"
                >
                  Add Screen
                </v-btn>
                <v-btn
                  v-if="addScreenTab === 'html'"
                  color="secondary"
                  class="mt-5 ml-5"
                  :prepend-icon="mdiEye"
                  :disabled="!renderHtmlValid"
                  @click="renderPreviewHtml(renderHtml)"
                >
                  Preview
                </v-btn>
              </v-card-text>
            </v-card>
            <v-card elevation="1">
              <v-card-title>Screens</v-card-title>
              <v-divider />
              <v-card-text>
                <v-table v-if="screensStore.screens.length" density="comfortable">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Filename</th>
                      <th>Status</th>
                      <th class="text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="screen in screensStore.screens" :key="screen.id">
                      <td>
                        <v-chip :color="screen.externalLink ? 'info' : 'primary'" size="small">
                          {{ screen.externalLink ? screen.fetchManual ? 'External (cached)' : 'External' : screen.html ? 'HTML' : 'File' }}
                        </v-chip>
                      </td>
                      <td>
                        <span>{{ screen.filename }}</span>
                      </td>
                      <td>
                        <v-chip v-if="screen.isActive" color="success" size="small">
                          Active
                        </v-chip>
                        <v-chip v-else color="grey" size="small">
                          Queued
                        </v-chip>
                      </td>
                      <td class="text-right">
                        <v-btn
                          v-if="screen.externalLink && screen.fetchManual"
                          color="warning"
                          size="small"
                          variant="tonal"
                          class="mr-2"
                          :icon="mdiRefresh"
                          @click="updateExternalImage(screen.id)"
                        />
                        <v-btn
                          v-if="screen.externalLink"
                          size="small" class="mr-2" :href="screen.externalLink" target="_blank" variant="tonal" color="secondary" :icon="mdiOpenInNew"
                        />
                        <v-btn
                          v-else-if="screen.html"
                          size="small" class="mr-2" :icon="mdiEye" variant="tonal" color="secondary" @click="renderPreviewHtml(screen.html)"
                        />
                        <v-btn
                          v-else
                          size="small" class="mr-2" :href="`/screens/devices/${device?.id}/${screen.id}.bmp`" target="_blank" variant="tonal" color="secondary" :icon="mdiOpenInNew"
                        />
                        <v-btn
                          size="small"

                          color="error"
                          variant="tonal"
                          :icon="mdiDelete"
                          @click="deleteScreen(screen.id)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </v-table>
                <v-alert v-else type="info">
                  No screens for this device. Add one.
                </v-alert>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    <v-overlay v-model="showHtmlPreview" class="align-center justify-center">
      <iframe ref="previewIframeRef" :width="(device.width || 0) + 5" :height="(device.height || 0) + 5" class="align-center" />
    </v-overlay>
  </v-container>
</template>
