<script setup lang="ts">
import type { FirmwareSyncResult } from 'kuroshiro-shared'
import type { Firmware } from '@/types'
import { mdiAlertCircle, mdiCheckCircle, mdiCloudSync, mdiUpload } from '@mdi/js'
import { computed, ref } from 'vue'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VCol, VDivider, VFileInput, VRow, VSelect, VTextField } from 'vuetify/components'
import { formatDate } from '@/utils/formatDate'
import FirmwareList from './FirmwareList.vue'

const props = defineProps<{
  activeFirmware: Firmware[]
  totalFirmwareCount: number
  lastSyncedAt: string | null
  syncing: boolean
  uploading: boolean
  error: string | null
  syncResult: FirmwareSyncResult | null
  deviceModelOptions: { title: string, value: string }[]
}>()

const emit = defineEmits<{
  sync: []
  dismissResult: []
  delete: [id: string]
  upload: [payload: { file: File, version: string, label?: string, compatibleModels?: string[] }]
}>()

const uploadVersion = ref('')
const uploadLabel = ref('')
const uploadCompatibleModels = ref<string[]>([])
const uploadFile = ref<File[]>([])

const canUpload = computed(() => !!uploadVersion.value && uploadFile.value.length > 0)

function submitUpload() {
  const file = uploadFile.value[0]
  if (!file)
    return
  emit('upload', {
    file,
    version: uploadVersion.value,
    label: uploadLabel.value || undefined,
    compatibleModels: uploadCompatibleModels.value.length > 0 ? uploadCompatibleModels.value : undefined,
  })
}

function resetUploadForm() {
  uploadVersion.value = ''
  uploadLabel.value = ''
  uploadCompatibleModels.value = []
  uploadFile.value = []
}

defineExpose({ resetUploadForm, uploadFile })

const deprecatedFirmwareCount = computed(() => props.totalFirmwareCount - props.activeFirmware.length)
</script>

<template>
  <VCard elevation="1" class="mb-4" data-test-id="firmware-card">
    <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
      Firmware
      <VBtn
        :prepend-icon="mdiCloudSync"
        variant="tonal"
        color="secondary"
        :loading="syncing"
        data-test-id="sync-firmware-btn"
        @click="$emit('sync')"
      >
        Sync from TRMNL
      </VBtn>
    </VCardTitle>
    <VDivider />
    <VCardText>
      <p class="text-body-2 text-medium-emphasis mb-2">
        OTA binaries a Device can be pushed to — official-synced daily from usetrmnl.com, or uploaded directly. A push is always an explicit per-Device action from the Device's own settings.
      </p>
      <div class="text-body-2 mb-3">
        {{ activeFirmware.length }} firmware
        <span v-if="deprecatedFirmwareCount > 0">
          ({{ deprecatedFirmwareCount }} deprecated)
        </span>
        · Last synced: {{ lastSyncedAt ? formatDate(lastSyncedAt) : 'never' }}
      </div>
      <VAlert v-if="error" type="error" variant="tonal" class="mb-3" :icon="mdiAlertCircle">
        {{ error }}
      </VAlert>
      <VAlert v-else-if="syncResult" type="success" variant="tonal" class="mb-3" :icon="mdiCheckCircle" closable @click:close="$emit('dismissResult')">
        <span v-if="syncResult.inserted">Synced firmware {{ syncResult.version }}</span>
        <span v-else>Already up to date at {{ syncResult.version }}</span>
      </VAlert>

      <FirmwareList :firmware="activeFirmware" @delete="$emit('delete', $event)" />

      <VDivider class="mb-4" />

      <div class="text-subtitle-2 mb-2">
        Upload custom firmware
      </div>
      <VRow dense>
        <VCol cols="12" sm="4">
          <VTextField v-model="uploadVersion" density="compact" label="Version" hide-details data-test-id="firmware-upload-version" />
        </VCol>
        <VCol cols="12" sm="4">
          <VTextField v-model="uploadLabel" density="compact" label="Label (optional)" hide-details />
        </VCol>
        <VCol cols="12" sm="4">
          <VSelect
            v-model="uploadCompatibleModels"
            :items="deviceModelOptions"
            density="compact"
            label="Compatible models"
            placeholder="Universal"
            persistent-placeholder
            multiple
            hide-details
          />
        </VCol>
        <VCol cols="12" sm="8">
          <VFileInput v-model="uploadFile" density="compact" label="Binary (.bin)" accept=".bin" hide-details data-test-id="firmware-upload-file" />
        </VCol>
        <VCol cols="12" sm="4" class="d-flex align-center">
          <VBtn
            :prepend-icon="mdiUpload"
            color="primary"
            variant="tonal"
            :disabled="!canUpload"
            :loading="uploading"
            data-test-id="firmware-upload-btn"
            @click="submitUpload"
          >
            Upload
          </VBtn>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
