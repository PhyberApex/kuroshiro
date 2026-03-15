<script setup lang="ts">
import { mdiClipboardArrowRight, mdiSend, mdiSync } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VTextField } from 'vuetify/components'
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
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" sm="12">
        <v-card elevation="1" class="mb-6">
          <v-card-title>Virtual Device</v-card-title>
          <v-divider />
          <v-card-text>
            <v-alert v-if="error" type="error" class="mb-4">
              {{ error }}
            </v-alert>
            <v-form @submit.prevent="callSetup">
              <v-tabs v-model="macInputTab" grow>
                <v-tab value="mac">
                  MAC
                </v-tab>
                <v-tab value="device">
                  Device
                </v-tab>
              </v-tabs>
              <v-window v-model="macInputTab">
                <v-window-item value="mac">
                  <VTextField ref="macInputRef" v-model="mac" label="MAC Address" :rules="macRules" clearable :append-inner-icon="mdiSync" :prepend-icon="currentMac ? mdiClipboardArrowRight : undefined" @click:append-inner="generateMac" @click:prepend="takeCurrentMac" />
                </v-window-item>
                <v-window-item value="device">
                  <v-autocomplete v-model="mac" :items="autocompleteDevices" label="Device" />
                </v-window-item>
              </v-window>
              <v-btn variant="tonal" color="primary" :loading="loadingSetup" type="submit" :disabled="!mac || !validForSetupCall" :prepend-icon="mdiSend">
                Call setup to get API key
              </v-btn>
            </v-form>
            <v-divider class="my-4" />
            <v-form @submit.prevent="callDisplay">
              <v-row>
                <v-col cols="12" md="12">
                  <VTextField v-model="apiKey" label="API key" :rules="apikeyRules" clearable />
                </v-col>
              </v-row>
              <v-row>
                <v-col v-for="(v, k) in customHeaders" :key="k" cols="12" md="6">
                  <VTextField v-model="customHeaders[k]" :label="k" clearable />
                </v-col>
              </v-row>
              <v-btn variant="tonal" color="primary" :loading="loadingDisplay" type="submit" :disabled="!validForDisplayCall" :prepend-icon="mdiSend">
                Fetch screen
              </v-btn>
            </v-form>
            <v-expansion-panels v-if="displayResponse" class="mt-4" flat>
              <v-expansion-panel>
                <v-expansion-panel-title>Response</v-expansion-panel-title>
                <v-expansion-panel-text>
                  <pre class="text-caption">{{ displayResponse }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
            <div v-if="displayImageUrl" class="mt-4">
              <v-img :src="displayImageUrl" aspect-ratio="800/480" alt="Virtual device screen preview" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
