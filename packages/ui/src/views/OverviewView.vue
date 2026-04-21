<script setup lang="ts">
import type { CreateDevice } from '../stores/device'
import { mdiDelete, mdiPlus, mdiSync } from '@mdi/js'
import { computed, ref } from 'vue'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VCol, VContainer, VDivider, VForm, VList, VListItem, VListItemSubtitle, VListItemTitle, VRow, VTextField } from 'vuetify/components'
import { VIconBtn } from 'vuetify/labs/VIconBtn'
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
    return 'Enter a valid MAC address'
  },
]

const nameRules = [
  (value: string) => {
    if (value === '') {
      return 'Name is required'
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
  <VContainer fluid>
    <VRow justify="center">
      <VCol cols="12" sm="12">
        <VCard class="mb-6" elevation="1">
          <VCardTitle class="d-flex align-center justify-space-between">
            Add Device
            <VIconBtn :icon="mdiSync" variant="tonal" color="secondary" aria-label="Refresh device list" :disabled="loadingUpdate" @click="update()" />
          </VCardTitle>
          <VDivider />
          <VCardText>
            <VForm ref="newDeviceFormRef" @submit.prevent="addDevice">
              <VRow>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="newDevice.name"
                    label="Name"
                    clearable
                    :rules="nameRules"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <VTextField
                    v-model="newDevice.mac"
                    label="MAC Address"
                    required
                    clearable
                    :append-inner-icon="mdiSync"
                    :rules="macRules"
                    @click:append-inner="generateMac"
                  />
                </VCol>
                <VCol cols="12" md="3" class="d-flex align-end">
                  <VBtn color="primary" type="submit" variant="tonal" :prepend-icon="mdiPlus" :disabled="!valid">
                    Add Device
                  </VBtn>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
        <VCard elevation="1">
          <VCardTitle>Devices</VCardTitle>
          <VDivider />
          <VCardText>
            <VList v-if="deviceStore.devices.length">
              <VListItem
                v-for="device in deviceStore.devices"
                :key="device.id"
                :to="{ name: 'device', params: { id: device.id } }"
                link
                class="mb-2"
              >
                <VListItemTitle>
                  <span class="font-weight-bold">{{ device.name }}</span>
                  <span class="text-medium-emphasis ms-2">({{ device.mac }})</span>
                </VListItemTitle>
                <VListItemSubtitle>
                  <span><b>Battery Voltage:</b> {{ device.batteryVoltage || 'N/A' }}</span>
                  <span class="ms-4"><b>RSSI:</b> {{ device.rssi || 'N/A' }}</span>
                </VListItemSubtitle>
                <template #append>
                  <VBtn color="error" variant="tonal" :prepend-icon="mdiDelete" :loading="loadingDelete.find(currentId => currentId === device.id)" @click.prevent="deleteDevice(device.id)">
                    Delete
                  </VBtn>
                </template>
              </VListItem>
            </VList>
            <VAlert v-else type="info" variant="tonal" class="text-body-2">
              No devices yet. Add one with the form above.
            </VAlert>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>
</template>
