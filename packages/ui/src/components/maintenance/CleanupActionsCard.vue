<script setup lang="ts">
import { mdiDelete } from '@mdi/js'
import { VBtn, VCard, VCardText, VCardTitle, VDivider, VSwitch } from 'vuetify/components'
import { formatBytes } from '@/utils/maintenanceFormat'

defineProps<{
  selectedCount: number
  totalSelectedSize: number
  cleanupInProgress: boolean
}>()

defineEmits<{
  confirmCleanup: []
  selectAll: []
  deselectAll: []
}>()

const dryRun = defineModel<boolean>('dryRun', { required: true })
</script>

<template>
  <VCard elevation="1" class="mb-4">
    <VCardTitle>Cleanup Actions</VCardTitle>
    <VDivider />
    <VCardText>
      <div class="mb-4">
        <div class="text-body-2 mb-2">
          <span class="font-weight-bold">Selected items:</span>
          {{ selectedCount }}
        </div>
        <div class="text-body-2 mb-4">
          <span class="font-weight-bold">Space to be freed:</span>
          {{ formatBytes(totalSelectedSize) }}
        </div>

        <VSwitch
          v-model="dryRun"
          label="Dry Run (simulate without actual deletion)"
          color="warning"
          hide-details
          class="mb-4"
        />

        <div class="d-flex gap-2">
          <VBtn
            :prepend-icon="mdiDelete"
            color="error"
            variant="tonal"
            :loading="cleanupInProgress"
            @click="$emit('confirmCleanup')"
          >
            {{ dryRun ? 'Preview Cleanup' : 'Clean Selected' }}
          </VBtn>
          <VBtn
            variant="text"
            @click="$emit('selectAll')"
          >
            Select All
          </VBtn>
          <VBtn
            variant="text"
            @click="$emit('deselectAll')"
          >
            Deselect All
          </VBtn>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>
