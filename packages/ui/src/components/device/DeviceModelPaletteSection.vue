<script setup lang="ts">
import { VChip, VCol, VRow, VSelect } from 'vuetify/components'

defineProps<{
  modelOptions: { title: string, value: string }[]
  paletteOptions: { title: string, value: string }[]
  paletteDisabled: boolean
  deprecatedAssigned: boolean
}>()

const selectedModelName = defineModel<string | null>('selectedModelName', { required: true })
const selectedPaletteId = defineModel<string | null>('selectedPaletteId', { required: true })
</script>

<template>
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
        :disabled="paletteDisabled"
        density="compact"
        label="Palette"
        placeholder="Default (richest available)"
        persistent-placeholder
        data-test-id="device-palette-select"
      />
    </VCol>
    <VCol v-if="deprecatedAssigned" cols="12" sm="12" md="4" class="d-flex align-center">
      <VChip color="warning" size="small" variant="tonal">
        Assigned model no longer exists upstream
      </VChip>
    </VCol>
  </VRow>
</template>
