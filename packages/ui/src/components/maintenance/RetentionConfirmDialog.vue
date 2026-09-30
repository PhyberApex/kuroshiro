<script setup lang="ts">
import type { RetentionRunResult } from 'kuroshiro-shared'
import { mdiAlertCircle } from '@mdi/js'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VDialog, VDivider } from 'vuetify/components'

defineProps<{
  preview: RetentionRunResult | null
  confirming: boolean
}>()

defineEmits<{
  confirm: []
}>()

const open = defineModel<boolean>({ required: true })
</script>

<template>
  <VDialog v-model="open" max-width="500">
    <VCard>
      <VCardTitle>Confirm Retention Run</VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert
          type="warning"
          variant="tonal"
          class="mb-4"
          :icon="mdiAlertCircle"
        >
          <div class="font-weight-bold mb-2">
            This action cannot be undone!
          </div>
          <div>Running Retention now will delete:</div>
        </VAlert>

        <div v-if="preview" class="text-body-2">
          <div>Resolved Alerts: {{ preview.alertsPruned }}</div>
          <div>Device Log entries: {{ preview.deviceLogsPruned }}</div>
        </div>
      </VCardText>
      <VDivider />
      <VCardText class="d-flex justify-end gap-2">
        <VBtn
          variant="text"
          @click="open = false"
        >
          Cancel
        </VBtn>
        <VBtn
          color="error"
          variant="tonal"
          :loading="confirming"
          @click="$emit('confirm')"
        >
          Confirm Delete
        </VBtn>
      </VCardText>
    </VCard>
  </VDialog>
</template>
