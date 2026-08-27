<script setup lang="ts">
import type { DeviceModelSyncResult } from 'kuroshiro-shared'
import { mdiAlertCircle, mdiCheckCircle, mdiCloudSync } from '@mdi/js'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VDivider } from 'vuetify/components'
import { formatDate } from '@/utils/formatDate'

defineProps<{
  activeModelCount: number
  deprecatedModelCount: number
  paletteCount: number
  lastSyncedAt: string | null
  syncing: boolean
  error: string | null
  syncResult: DeviceModelSyncResult | null
}>()

defineEmits<{
  sync: []
  dismissResult: []
}>()
</script>

<template>
  <VCard elevation="1" class="mb-4" data-test-id="device-models-card">
    <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
      Device Models
      <VBtn
        :prepend-icon="mdiCloudSync"
        variant="tonal"
        color="secondary"
        :loading="syncing"
        data-test-id="sync-device-models-btn"
        @click="$emit('sync')"
      >
        Sync from TRMNL
      </VBtn>
    </VCardTitle>
    <VDivider />
    <VCardText>
      <p class="text-body-2 text-medium-emphasis mb-2">
        Panel sizes, colour depths and rendering settings for supported devices, synced from usetrmnl.com on startup and daily. Models removed upstream are kept and marked deprecated.
      </p>
      <div class="text-body-2">
        {{ activeModelCount }} models, {{ paletteCount }} palettes
        <span v-if="deprecatedModelCount > 0">
          ({{ deprecatedModelCount }} deprecated)
        </span>
        · Last synced: {{ lastSyncedAt ? formatDate(lastSyncedAt) : 'never (bundled snapshot)' }}
      </div>
      <VAlert v-if="error" type="error" variant="tonal" class="mt-3" :icon="mdiAlertCircle">
        {{ error }}
      </VAlert>
      <VAlert v-else-if="syncResult" type="success" variant="tonal" class="mt-3" :icon="mdiCheckCircle" closable @click:close="$emit('dismissResult')">
        Synced {{ syncResult.models }} models and {{ syncResult.palettes }} palettes
        <span v-if="syncResult.deprecatedModels || syncResult.deprecatedPalettes">
          ({{ syncResult.deprecatedModels }} models, {{ syncResult.deprecatedPalettes }} palettes newly deprecated)
        </span>
      </VAlert>
    </VCardText>
  </VCard>
</template>
