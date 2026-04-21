<script setup lang="ts">
import { mdiClipboardArrowRight, mdiSend, mdiSync } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VAlert, VAutocomplete, VBtn, VCard, VCardText, VCardTitle, VCol, VContainer, VDivider, VExpansionPanel, VExpansionPanels, VExpansionPanelText, VExpansionPanelTitle, VForm, VImg, VRow, VTab, VTabs, VTextField, VWindow, VWindowItem } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device'
import { getRandomMac, isValidMac } from '@/utils/getRandomMac'

const mac = ref('')
const apiKey = ref<string | null>(null)
const friendlyId = ref('')
const displayResponse = ref<any>(null)
const displayImageUrl = ref('')
const customHeaders = ref({
  'battery-voltage': '4.2V',
  'fw-version': '',
  'refresh-rate': '',
  'rssi': '',
  'user-agent': window.navigator.userAgent,
  'width': '800',
  'height': '480',
})
const loadingSetup = ref(false)
const loadingDisplay = ref(false)
const error = ref('')

async function callSetup() {
  error.value = ''
  loadingSetup.value = true
  try {
    const res = await fetch('/api/setup', {
      headers: { id: mac.value },
    })
    if (!res.ok)
      throw new Error('Setup failed')
    const data = await res.json()
    apiKey.value = data.api_key
    friendlyId.value = data.friendly_id
  }
  catch (e: any) {
    error.value = e.message
  }
  finally {
    loadingSetup.value = false
  }
}

async function callDisplay() {
  if (apiKey.value === null)
    return
  error.value = ''
  loadingDisplay.value = true
  try {
    const headers: Record<string, string> = {
      'id': mac.value,
      'access-token': apiKey.value,
    }
    for (const [k, v] of Object.entries(customHeaders.value)) {
      if (v)
        headers[k] = v
    }
    const res = await fetch('/api/display', { headers })
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) {
        const error = await res.json()
        throw new Error (`Display failed: ${error.message}`)
      }
      throw new Error(`Display failed: ${res.status}`)
    }
    const data = await res.json()
    displayResponse.value = data
    displayImageUrl.value = data.image_url
  }
  catch (e: any) {
    error.value = e.message
  }
  finally {
    loadingDisplay.value = false
  }
}

function generateMac() {
  mac.value = getRandomMac()
}

const deviceStore = useDeviceStore()
const route = useRoute()

const currentMac = computed(() => {
  if (route.name !== 'device')
    return null
  return deviceStore.getById(route.params?.id as string)?.mac || null
})

function takeCurrentMac() {
  mac.value = currentMac.value || ''
}

const macRules = [
  (value: string) => {
    if (isValidMac(value)) {
      return true
    }
    return 'Enter a valid MAC address'
  },
]

const validForSetupCall = computed(() => {
  return !macRules.map(rule => rule(mac.value)).some(validationResult => validationResult !== true)
})

const apikeyRules = [
  (value: string | null) => {
    if (value !== null) {
      return true
    }
    return 'API key is required'
  },
]

const validForDisplayCall = computed(() => {
  return !apikeyRules.map(rule => rule(apiKey.value)).some(validationResult => validationResult !== true)
})

const autocompleteDevices = computed(() => {
  return deviceStore.devices.map((mapDevice) => {
    return {
      title: mapDevice.name,
      value: mapDevice.mac,
    }
  })
})

const macInputTab = ref<'mac' | 'device'>('mac')
const macInputRef = ref<null | VTextField>(null)
watch(macInputTab, () => {
  if (macInputTab.value === 'device' && !deviceStore.devices.some(d => d.mac === mac.value)) {
    macInputRef.value?.reset()
  }
})

watch(mac, () => {
  if (macInputTab.value !== 'device')
    return
  const device = deviceStore.devices.find(d => d.mac === mac.value)
  if (!device)
    return
  customHeaders.value['battery-voltage'] = device.batteryVoltage || customHeaders.value['battery-voltage']
  customHeaders.value['fw-version'] = device.fwVersion || customHeaders.value['fw-version']
  customHeaders.value['refresh-rate'] = device.refreshRate?.toString() || customHeaders.value['refresh-rate']
  customHeaders.value.rssi = device.rssi || customHeaders.value.rssi
  customHeaders.value['user-agent'] = device.userAgent || customHeaders.value['user-agent']
  customHeaders.value.width = device.width?.toString() || customHeaders.value.width
  customHeaders.value.height = device.height?.toString() || customHeaders.value.height
})
</script>

<template>
  <VContainer fluid>
    <VRow justify="center">
      <VCol cols="12" sm="12">
        <VCard elevation="1" class="mb-6">
          <VCardTitle>Virtual Device</VCardTitle>
          <VDivider />
          <VCardText>
            <VAlert v-if="error" type="error" class="mb-4">
              {{ error }}
            </VAlert>
            <VForm @submit.prevent="callSetup">
              <VTabs v-model="macInputTab" grow>
                <VTab value="mac">
                  MAC
                </VTab>
                <VTab value="device">
                  Device
                </VTab>
              </VTabs>
              <VWindow v-model="macInputTab">
                <VWindowItem value="mac">
                  <VTextField ref="macInputRef" v-model="mac" label="MAC Address" :rules="macRules" clearable :append-inner-icon="mdiSync" :prepend-icon="currentMac ? mdiClipboardArrowRight : undefined" @click:append-inner="generateMac" @click:prepend="takeCurrentMac" />
                </VWindowItem>
                <VWindowItem value="device">
                  <VAutocomplete v-model="mac" :items="autocompleteDevices" label="Device" />
                </VWindowItem>
              </VWindow>
              <VBtn variant="tonal" color="primary" :loading="loadingSetup" type="submit" :disabled="!mac || !validForSetupCall" :prepend-icon="mdiSend">
                Call setup to get API key
              </VBtn>
            </VForm>
            <VDivider class="my-4" />
            <VForm @submit.prevent="callDisplay">
              <VRow>
                <VCol cols="12" md="12">
                  <VTextField v-model="apiKey" label="API key" :rules="apikeyRules" clearable />
                </VCol>
              </VRow>
              <VRow>
                <VCol v-for="(v, k) in customHeaders" :key="k" cols="12" md="6">
                  <VTextField v-model="customHeaders[k]" :label="k" clearable />
                </VCol>
              </VRow>
              <VBtn variant="tonal" color="primary" :loading="loadingDisplay" type="submit" :disabled="!validForDisplayCall" :prepend-icon="mdiSend">
                Fetch screen
              </VBtn>
            </VForm>
            <VExpansionPanels v-if="displayResponse" class="mt-4" flat>
              <VExpansionPanel>
                <VExpansionPanelTitle>Response</VExpansionPanelTitle>
                <VExpansionPanelText>
                  <pre class="text-caption">{{ displayResponse }}</pre>
                </VExpansionPanelText>
              </VExpansionPanel>
            </VExpansionPanels>
            <div v-if="displayImageUrl" class="mt-4">
              <VImg :src="displayImageUrl" aspect-ratio="800/480" alt="Virtual device screen preview" />
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>
