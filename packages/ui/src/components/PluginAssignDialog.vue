<script setup lang="ts">
import type { Plugin } from '../types/plugin'
import { mdiCheck } from '@mdi/js'
import { onMounted, ref } from 'vue'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VCheckbox, VDialog, VDivider, VList, VListItem } from 'vuetify/components'
import { useDeviceStore } from '../stores/device'
import { usePluginsStore } from '../stores/plugins'

const props = defineProps<{
  modelValue: boolean
  plugin: Plugin
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'assigned': []
}>()

const deviceStore = useDeviceStore()
const pluginsStore = usePluginsStore()

const selectedDevices = ref<string[]>([])
const loading = ref(false)

onMounted(() => {
  // Pre-select already assigned devices
  if (props.plugin.deviceAssignments) {
    selectedDevices.value = props.plugin.deviceAssignments.map(da => da.device.id)
  }
})

async function saveAssignments() {
  loading.value = true
  try {
    const currentAssignments = new Set(props.plugin.deviceAssignments?.map(da => da.device.id) || [])
    const newAssignments = new Set(selectedDevices.value)

    // Assign to new devices
    for (const deviceId of newAssignments) {
      if (!currentAssignments.has(deviceId)) {
        await pluginsStore.assignToDevice(props.plugin.id, deviceId)
      }
    }

    // Unassign from removed devices
    for (const deviceId of currentAssignments) {
      if (!newAssignments.has(deviceId)) {
        await pluginsStore.unassignFromDevice(props.plugin.id, deviceId)
      }
    }

    emit('assigned')
    close()
  }
  finally {
    loading.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <VDialog :model-value="modelValue" max-width="600" @update:model-value="emit('update:modelValue', $event)">
    <VCard>
      <VCardTitle>Assign "{{ plugin.name }}" to Devices</VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert type="info" variant="tonal" class="mb-4">
          Select which devices should have this plugin. You can enable/disable per device later.
        </VAlert>

        <VList>
          <VListItem
            v-for="device in deviceStore.devices"
            :key="device.id"
          >
            <VCheckbox
              v-model="selectedDevices"
              :value="device.id"
              :label="device.name"
              hide-details
            />
          </VListItem>
        </VList>

        <VAlert v-if="deviceStore.devices.length === 0" type="warning" variant="tonal" class="mt-4">
          No devices available. Add a device first!
        </VAlert>
      </VCardText>
      <VDivider />
      <VCardActions class="d-flex justify-space-between">
        <VBtn variant="text" @click="close">
          Cancel
        </VBtn>
        <VBtn
          color="primary"
          variant="tonal"
          :prepend-icon="mdiCheck"
          :loading="loading"
          @click="saveAssignments"
        >
          Save Assignments
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
