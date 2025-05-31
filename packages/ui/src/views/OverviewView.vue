<script setup lang="ts">
import type { CreateDevice } from '../stores/device'
import { mdiDelete, mdiPlus, mdiSync } from '@mdi/js'
import { computed, ref } from 'vue'
import { VForm } from 'vuetify/components'
import { getRandomMac, isValidMac } from '@/utils/getRandomMac'
import { useDeviceStore } from '../stores/device'

const deviceStore = useDeviceStore()
const newDevice = ref<CreateDevice>({ mac: '', name: '' })
const newDeviceFormRef = ref<null | typeof VForm>(null)

const macRules = [
  (value: string) => {
    if (isValidMac(value)) {
      return true
    }
    return 'Please enter a valid MAC'
  },
]

const nameRules = [
  (value: string) => {
    if (value === '') {
      return 'A name is required'
    }
    return true
  },
]

const valid = computed(() => {
  return !macRules.map(rule => rule(newDevice.value.mac)).some(validationResult => validationResult !== true)
    && !nameRules.map(rule => rule(newDevice.value.name)).some(validationResult => validationResult !== true)
})

async function addDevice() {
  await deviceStore.addDevice(newDevice.value)
  newDeviceFormRef.value?.reset()
}

const loadingDelete = ref<Array<string>>([])

async function deleteDevice(id: string) {
  loadingDelete.value.push(id)
  try {
    await deviceStore.deleteDevice(id)
  }
  finally {
    loadingDelete.value = loadingDelete.value.filter(currentId => currentId !== id)
  }
}

function generateMac() {
  newDevice.value.mac = getRandomMac()
}

const loadingUpdate = ref(false)
async function update() {
  loadingUpdate.value = true
  try {
    await deviceStore.fetchDevices()
  }
  finally {
    loadingUpdate.value = false
  }
}
</script>

<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" sm="12">
        <v-card class="mb-6" color="primary" variant="tonal" elevation="2">
          <v-card-text>
            <b>Overview:</b> Add, view, and manage your TRMNL devices. Use the form below to add a device, or select a device from the list for more details.
          </v-card-text>
        </v-card>
        <v-card class="mb-6" elevation="2">
          <v-card-title class="d-flex align-center justify-space-between">
            Add Device
            <v-icon-btn :icon="mdiSync" variant="tonal" color="secondary" :disabled="loadingUpdate" @click="update()" />
          </v-card-title>
          <v-divider />
          <v-card-text>
            <VForm ref="newDeviceFormRef" @submit.prevent="addDevice">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="newDevice.name"
                    label="Name"
                    clearable
                    :rules="nameRules"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="newDevice.mac"
                    label="MAC Address"
                    required
                    clearable
                    :append-inner-icon="mdiSync"
                    :rules="macRules"
                    @click:append-inner="generateMac"
                  />
                </v-col>
                <v-col cols="12" md="3" class="d-flex align-end">
                  <v-btn color="primary" type="submit" variant="tonal" :prepend-icon="mdiPlus" :disabled="!valid">
                    Add Device
                  </v-btn>
                </v-col>
              </v-row>
            </VForm>
          </v-card-text>
        </v-card>
        <v-card elevation="2">
          <v-card-title>Devices</v-card-title>
          <v-divider />
          <v-card-text>
            <v-list v-if="deviceStore.devices.length">
              <v-list-item
                v-for="device in deviceStore.devices"
                :key="device.id"
                :to="{ name: 'device', params: { id: device.id } }"
                link
                class="mb-2"
              >
                <v-list-item-title>
                  <span class="font-weight-bold">{{ device.name }}</span>
                  <span class="text-grey ms-2">({{ device.mac }})</span>
                </v-list-item-title>
                <v-list-item-subtitle>
                  <span><b>Battery Voltage:</b> {{ device.batteryVoltage || 'N/A' }}</span>
                  <span class="ms-4"><b>RSSI:</b> {{ device.rssi || 'N/A' }}</span>
                </v-list-item-subtitle>
                <template #append>
                  <v-btn color="error" variant="tonal" :prepend-icon="mdiDelete" :loading="loadingDelete.find(currentId => currentId === device.id)" @click.stop="deleteDevice(device.id)">
                    Delete
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
            <v-alert v-else type="info">
              No devices found.
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.mb-6 { margin-bottom: 2.5rem; }
.ms-2 { margin-left: 0.5rem; }
.ms-4 { margin-left: 1.5rem; }
</style>
