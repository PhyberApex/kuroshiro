<script setup lang="ts">
import { VBtn, VChip, VCol, VRow, VSelect } from 'vuetify/components'

defineProps<{
  firmwareOptions: { title: string, value: string }[]
  firmwareUpdating: boolean
  fwVersion?: string
  updatePending: boolean
}>()

defineEmits<{
  triggerFirmwareUpdate: []
}>()

const selectedFirmwareId = defineModel<string | null>('selectedFirmwareId', { required: true })
</script>

<template>
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
      <span class="text-caption text-medium-emphasis">Reported: {{ fwVersion || 'N/A' }}</span>
      <VBtn
        size="small"
        color="secondary"
        variant="tonal"
        :loading="firmwareUpdating"
        :disabled="!selectedFirmwareId"
        data-test-id="device-firmware-update-btn"
        @click="$emit('triggerFirmwareUpdate')"
      >
        Update now
      </VBtn>
      <VChip v-if="updatePending" color="info" size="small" variant="tonal">
        Update pending
      </VChip>
    </VCol>
  </VRow>
</template>
