<script setup lang="ts">
import { mdiAlertCircle, mdiCheckCircle } from '@mdi/js'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VDialog, VDivider } from 'vuetify/components'
import { formatBytes } from '@/utils/maintenanceFormat'

defineProps<{
  dryRun: boolean
  fileCount: number
  dirCount: number
  screenCount: number
  totalSize: number
}>()

defineEmits<{
  confirm: []
}>()

const open = defineModel<boolean>({ required: true })
</script>

<template>
  <VDialog v-model="open" max-width="500">
    <VCard>
      <VCardTitle>Confirm Cleanup</VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert
          :type="dryRun ? 'info' : 'warning'"
          variant="tonal"
          class="mb-4"
          :icon="dryRun ? mdiCheckCircle : mdiAlertCircle"
        >
          <div v-if="dryRun" class="text-body-2">
            This is a dry run. No files will be deleted.
          </div>
          <div v-else class="text-body-2">
            <div class="font-weight-bold mb-2">
              Warning: This action cannot be undone!
            </div>
            <div>You are about to delete:</div>
          </div>
        </VAlert>

        <div class="text-body-2">
          <div>Files: {{ fileCount }}</div>
          <div>Directories: {{ dirCount }}</div>
          <div>Screens: {{ screenCount }}</div>
          <div class="mt-2 font-weight-bold">
            Total space: {{ formatBytes(totalSize) }}
          </div>
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
          :color="dryRun ? 'primary' : 'error'"
          variant="tonal"
          @click="$emit('confirm')"
        >
          {{ dryRun ? 'Preview' : 'Confirm Delete' }}
        </VBtn>
      </VCardText>
    </VCard>
  </VDialog>
</template>
