<script setup lang="ts">
import { mdiAlertCircle, mdiDownload, mdiUpload } from '@mdi/js'
import { ref } from 'vue'
import { VAlert, VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VDivider, VFileInput, VList, VListItem, VSnackbar } from 'vuetify/components'
import { useConfigurationStore } from '@/stores/configuration'
import { withBasePath } from '@/utils/basePath'

const configurationStore = useConfigurationStore()

const showExportSnackbar = ref(false)
const showImportDialog = ref(false)
const importFile = ref<File[]>([])

function exportConfiguration() {
  window.location.href = withBasePath('/api/config/export')
  showExportSnackbar.value = true
}

function openImportDialog() {
  importFile.value = []
  configurationStore.reset()
  showImportDialog.value = true
}

function totalCount(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

async function confirmImport() {
  const file = importFile.value[0]
  if (!file) {
    return
  }
  const ok = await configurationStore.importArchive(file)
  if (ok) {
    importFile.value = []
  }
}
</script>

<template>
  <VCard elevation="1" class="mb-4" data-test-id="configuration-card">
    <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
      Configuration
      <div class="d-flex ga-2 flex-wrap">
        <VBtn :prepend-icon="mdiUpload" variant="tonal" color="secondary" data-test-id="import-config-btn" @click="openImportDialog">
          Import configuration
        </VBtn>
        <VBtn :prepend-icon="mdiDownload" variant="tonal" color="primary" data-test-id="export-config-btn" @click="exportConfiguration">
          Export configuration
        </VBtn>
      </div>
    </VCardTitle>
    <VDivider />
    <VCardText>
      <p class="text-body-2 text-medium-emphasis">
        A single archive of every Plugin, Device, Screen, Schedule, Mashup, custom Palette and custom Firmware on this server — for backup, review, or moving to another instance.
      </p>
      <VAlert type="warning" variant="tonal" class="mt-2" :icon="mdiAlertCircle">
        The archive contains Data Source headers and Device API keys in plaintext. Store it as carefully as you would a database backup.
      </VAlert>
    </VCardText>

    <VSnackbar v-model="showExportSnackbar" :timeout="3000" color="success">
      Downloading configuration export...
    </VSnackbar>

    <VDialog v-model="showImportDialog" max-width="600">
      <VCard>
        <VCardTitle>Import Configuration</VCardTitle>
        <VDivider />
        <VCardText>
          <VAlert type="warning" variant="tonal" class="mb-4 text-body-2">
            Importing upserts every record in the archive by its original id. This is designed to restore onto a fresh instance — importing onto a server that already has unrelated Plugins, Devices or Screens is not supported yet.
          </VAlert>

          <VAlert v-if="configurationStore.error" type="error" variant="tonal" class="mb-4" data-test-id="import-config-error">
            {{ configurationStore.error }}
          </VAlert>

          <VFileInput
            v-model="importFile"
            label="Select configuration archive (.zip)"
            accept=".zip"
            :prepend-icon="mdiUpload"
            show-size
          />

          <VAlert v-if="configurationStore.importSummary" type="success" variant="tonal" class="mt-4" data-test-id="import-config-summary">
            <div class="text-body-2">
              Created {{ totalCount(configurationStore.importSummary.created) }}, updated {{ totalCount(configurationStore.importSummary.updated) }} record(s).
            </div>
            <VList v-if="configurationStore.importSummary.warnings.length > 0" density="compact" class="bg-transparent">
              <VListItem v-for="(warning, index) in configurationStore.importSummary.warnings" :key="index" class="text-caption">
                {{ warning }}
              </VListItem>
            </VList>
          </VAlert>
        </VCardText>
        <VDivider />
        <VCardActions class="d-flex justify-space-between">
          <VBtn variant="text" @click="showImportDialog = false">
            Close
          </VBtn>
          <VBtn
            color="primary"
            variant="tonal"
            data-test-id="import-config-submit"
            :loading="configurationStore.importing"
            :disabled="importFile.length === 0"
            @click="confirmImport"
          >
            Import
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VCard>
</template>
