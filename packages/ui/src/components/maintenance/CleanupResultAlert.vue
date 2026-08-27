<script setup lang="ts">
import type { CleanupResult } from '@/types'
import { mdiCheckCircle } from '@mdi/js'
import { VAlert } from 'vuetify/components'
import { formatBytes } from '@/utils/maintenanceFormat'

defineProps<{
  result: CleanupResult
  dryRun: boolean
}>()

defineEmits<{
  dismiss: []
}>()
</script>

<template>
  <VAlert
    :type="result.errors.length > 0 ? 'warning' : 'success'"
    variant="tonal"
    class="mb-4"
    :icon="mdiCheckCircle"
    closable
    @click:close="$emit('dismiss')"
  >
    <div class="text-body-2">
      <div v-if="dryRun" class="font-weight-bold mb-2">
        Dry Run Results (no actual changes made)
      </div>
      <div v-else class="font-weight-bold mb-2">
        Cleanup Complete
      </div>
      <div>Files deleted: {{ result.filesDeleted }}</div>
      <div>Directories deleted: {{ result.dirsDeleted }}</div>
      <div>Screens deleted: {{ result.screensDeleted }}</div>
      <div>Space freed: {{ formatBytes(result.bytesFreed) }}</div>
      <div v-if="result.errors.length > 0" class="mt-2">
        <div class="font-weight-bold">
          Errors:
        </div>
        <div v-for="(err, i) in result.errors" :key="i" class="text-error">
          {{ err }}
        </div>
      </div>
    </div>
  </VAlert>
</template>
