<script setup lang="ts">
import type { DeviceModelSyncResult, FirmwareSyncResult } from '../types'
import { mdiAlertCircle, mdiCheckCircle, mdiCloudSync, mdiDelete, mdiRefresh, mdiUpload } from '@mdi/js'
import { computed, onMounted, ref } from 'vue'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VCheckbox, VChip, VCol, VContainer, VDialog, VDivider, VFileInput, VList, VListItem, VListItemSubtitle, VListItemTitle, VProgressCircular, VRow, VSelect, VSwitch, VTextField } from 'vuetify/components'
import { useDeviceModelsStore } from '../stores/deviceModels'
import { useFirmwareStore } from '../stores/firmware'
import { useMaintenanceStore } from '../stores/maintenance'
import { formatDate } from '../utils/formatDate'

const maintenanceStore = useMaintenanceStore()
const deviceModelsStore = useDeviceModelsStore()
const firmwareStore = useFirmwareStore()

const syncResult = ref<DeviceModelSyncResult | null>(null)

const lastModelSync = computed(() => {
  const dates = deviceModelsStore.models.map(model => model.syncedAt).filter((date): date is string => !!date).sort()
  return dates.at(-1) ?? null
})

// A successful sync always wins over a stale/unrelated store error (e.g. a refresh
// hiccup after the sync itself succeeded), so it never gets masked by an old alert.
const modelError = computed(() => (syncResult.value ? null : deviceModelsStore.error))

async function handleModelSync() {
  syncResult.value = await deviceModelsStore.sync()
}

const firmwareSyncResult = ref<FirmwareSyncResult | null>(null)
const firmwareError = computed(() => (firmwareSyncResult.value ? null : firmwareStore.error))

const lastFirmwareSync = computed(() => {
  const dates = firmwareStore.firmware.map(fw => fw.syncedAt).filter((date): date is string => !!date).sort()
  return dates.at(-1) ?? null
})

async function handleFirmwareSync() {
  firmwareSyncResult.value = await firmwareStore.sync()
}

const uploadVersion = ref('')
const uploadLabel = ref('')
const uploadCompatibleModels = ref<string[]>([])
const uploadFile = ref<File[]>([])

const deviceModelOptions = computed(() => deviceModelsStore.activeModels.map(model => ({ title: model.label, value: model.name })))

const canUpload = computed(() => !!uploadVersion.value && uploadFile.value.length > 0)

async function handleFirmwareUpload() {
  const file = uploadFile.value[0]
  if (!file)
    return
  const ok = await firmwareStore.upload(file, uploadVersion.value, uploadLabel.value || undefined, uploadCompatibleModels.value.length > 0 ? uploadCompatibleModels.value : undefined)
  if (ok) {
    uploadVersion.value = ''
    uploadLabel.value = ''
    uploadCompatibleModels.value = []
    uploadFile.value = []
  }
}

async function handleFirmwareDelete(id: string) {
  await firmwareStore.remove(id)
}

const selectedOrphanedFiles = ref<string[]>([])
const selectedOrphanedDirs = ref<string[]>([])
const selectedBrokenScreens = ref<string[]>([])
const selectedTempFiles = ref<string[]>([])
const selectedOldUploads = ref<string[]>([])
const dryRun = ref(true)
const showConfirmDialog = ref(false)
const cleanupInProgress = ref(false)
const cleanupResult = ref<{ filesDeleted: number, dirsDeleted: number, screensDeleted: number, bytesFreed: number, errors: string[] } | null>(null)

const hasSelection = computed(() => {
  return selectedOrphanedFiles.value.length > 0
    || selectedOrphanedDirs.value.length > 0
    || selectedBrokenScreens.value.length > 0
    || selectedTempFiles.value.length > 0
    || selectedOldUploads.value.length > 0
})

const totalSelectedSize = computed(() => {
  let size = 0
  if (maintenanceStore.issues) {
    selectedOrphanedFiles.value.forEach((path) => {
      const item = maintenanceStore.issues!.orphanedScreenFiles.find(f => f.path === path)
      if (item)
        size += item.size
    })
    selectedOrphanedDirs.value.forEach((path) => {
      const item = maintenanceStore.issues!.orphanedDeviceDirs.find(d => d.path === path)
      if (item)
        size += item.size
    })
    selectedTempFiles.value.forEach((path) => {
      const item = maintenanceStore.issues!.tempFiles.find(f => f.path === path)
      if (item)
        size += item.size
    })
    selectedOldUploads.value.forEach((path) => {
      const item = maintenanceStore.issues!.oldUploads.find(f => f.path === path)
      if (item)
        size += item.size
    })
  }
  return size
})

onMounted(async () => {
  await Promise.all([maintenanceStore.scanSystem(), deviceModelsStore.ensureLoaded(), firmwareStore.ensureLoaded()])
})

async function handleScan() {
  selectedOrphanedFiles.value = []
  selectedOrphanedDirs.value = []
  selectedBrokenScreens.value = []
  selectedTempFiles.value = []
  selectedOldUploads.value = []
  cleanupResult.value = null
  await maintenanceStore.scanSystem()
}

function selectAllOrphanedFiles() {
  if (!maintenanceStore.issues)
    return
  selectedOrphanedFiles.value = maintenanceStore.issues.orphanedScreenFiles.map(f => f.path)
}

function selectAllOrphanedDirs() {
  if (!maintenanceStore.issues)
    return
  selectedOrphanedDirs.value = maintenanceStore.issues.orphanedDeviceDirs.map(d => d.path)
}

function selectAllBrokenScreens() {
  if (!maintenanceStore.issues)
    return
  selectedBrokenScreens.value = maintenanceStore.issues.brokenScreens.map(s => s.screenId)
}

function selectAllTempFiles() {
  if (!maintenanceStore.issues)
    return
  selectedTempFiles.value = maintenanceStore.issues.tempFiles.map(f => f.path)
}

function selectAllOldUploads() {
  if (!maintenanceStore.issues)
    return
  selectedOldUploads.value = maintenanceStore.issues.oldUploads.map(f => f.path)
}

function selectAll() {
  selectAllOrphanedFiles()
  selectAllOrphanedDirs()
  selectAllBrokenScreens()
  selectAllTempFiles()
  selectAllOldUploads()
}

function deselectAll() {
  selectedOrphanedFiles.value = []
  selectedOrphanedDirs.value = []
  selectedBrokenScreens.value = []
  selectedTempFiles.value = []
  selectedOldUploads.value = []
}

function formatBytes(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / (k ** i)).toFixed(2))} ${sizes[i]}`
}

function formatAge(hours: number): string {
  if (hours < 24)
    return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

async function confirmCleanup() {
  showConfirmDialog.value = true
}

async function executeCleanup() {
  showConfirmDialog.value = false
  cleanupInProgress.value = true
  cleanupResult.value = null

  try {
    const result = await maintenanceStore.cleanupIssues(
      selectedOrphanedFiles.value,
      selectedOrphanedDirs.value,
      selectedBrokenScreens.value,
      selectedTempFiles.value,
      selectedOldUploads.value,
      dryRun.value,
    )
    cleanupResult.value = result

    if (!dryRun.value) {
      deselectAll()
      await maintenanceStore.scanSystem()
    }
  }
  finally {
    cleanupInProgress.value = false
  }
}
</script>

<template>
  <VContainer fluid>
    <VRow justify="center">
      <VCol cols="12">
        <VCard elevation="1" class="mb-4">
          <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
            Maintenance Dashboard
            <VBtn
              :prepend-icon="mdiRefresh"
              variant="tonal"
              color="secondary"
              :loading="maintenanceStore.loading"
              @click="handleScan"
            >
              Scan System
            </VBtn>
          </VCardTitle>
          <VDivider />
          <VCardText>
            <p class="text-body-2 text-medium-emphasis">
              Scan filesystem for orphaned files, broken screens, and temporary data that can be cleaned up.
            </p>
          </VCardText>
        </VCard>

        <VCard elevation="1" class="mb-4" data-test-id="device-models-card">
          <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
            Device Models
            <VBtn
              :prepend-icon="mdiCloudSync"
              variant="tonal"
              color="secondary"
              :loading="deviceModelsStore.syncing"
              data-test-id="sync-device-models-btn"
              @click="handleModelSync"
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
              {{ deviceModelsStore.activeModels.length }} models, {{ deviceModelsStore.palettes.length }} palettes
              <span v-if="deviceModelsStore.models.length - deviceModelsStore.activeModels.length > 0">
                ({{ deviceModelsStore.models.length - deviceModelsStore.activeModels.length }} deprecated)
              </span>
              · Last synced: {{ lastModelSync ? formatDate(lastModelSync) : 'never (bundled snapshot)' }}
            </div>
            <VAlert v-if="modelError" type="error" variant="tonal" class="mt-3" :icon="mdiAlertCircle">
              {{ modelError }}
            </VAlert>
            <VAlert v-else-if="syncResult" type="success" variant="tonal" class="mt-3" :icon="mdiCheckCircle" closable @click:close="syncResult = null">
              Synced {{ syncResult.models }} models and {{ syncResult.palettes }} palettes
              <span v-if="syncResult.deprecatedModels || syncResult.deprecatedPalettes">
                ({{ syncResult.deprecatedModels }} models, {{ syncResult.deprecatedPalettes }} palettes newly deprecated)
              </span>
            </VAlert>
          </VCardText>
        </VCard>

        <VCard elevation="1" class="mb-4" data-test-id="firmware-card">
          <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
            Firmware
            <VBtn
              :prepend-icon="mdiCloudSync"
              variant="tonal"
              color="secondary"
              :loading="firmwareStore.syncing"
              data-test-id="sync-firmware-btn"
              @click="handleFirmwareSync"
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
              {{ firmwareStore.activeFirmware.length }} firmware
              <span v-if="firmwareStore.firmware.length - firmwareStore.activeFirmware.length > 0">
                ({{ firmwareStore.firmware.length - firmwareStore.activeFirmware.length }} deprecated)
              </span>
              · Last synced: {{ lastFirmwareSync ? formatDate(lastFirmwareSync) : 'never' }}
            </div>
            <VAlert v-if="firmwareError" type="error" variant="tonal" class="mb-3" :icon="mdiAlertCircle">
              {{ firmwareError }}
            </VAlert>
            <VAlert v-else-if="firmwareSyncResult" type="success" variant="tonal" class="mb-3" :icon="mdiCheckCircle" closable @click:close="firmwareSyncResult = null">
              <span v-if="firmwareSyncResult.inserted">Synced firmware {{ firmwareSyncResult.version }}</span>
              <span v-else>Already up to date at {{ firmwareSyncResult.version }}</span>
            </VAlert>

            <VList v-if="firmwareStore.activeFirmware.length > 0" density="compact" class="mb-4">
              <VListItem v-for="fw in firmwareStore.activeFirmware" :key="fw.id" :data-test-id="`firmware-row-${fw.id}`">
                <VListItemTitle class="text-body-2">
                  {{ fw.version }}
                  <VChip size="x-small" class="ml-2">
                    {{ fw.kind === 'official-synced' ? 'official' : 'custom' }}
                  </VChip>
                  <VChip v-if="fw.label" size="x-small" variant="tonal" class="ml-1">
                    {{ fw.label }}
                  </VChip>
                </VListItemTitle>
                <VListItemSubtitle class="text-caption">
                  {{ fw.compatibleModels.length > 0 ? fw.compatibleModels.join(', ') : 'Universal (all models)' }}
                </VListItemSubtitle>
                <template v-if="fw.kind === 'custom'" #append>
                  <VBtn
                    :icon="mdiDelete"
                    size="small"
                    variant="text"
                    color="error"
                    :data-test-id="`firmware-delete-${fw.id}`"
                    @click="handleFirmwareDelete(fw.id)"
                  />
                </template>
              </VListItem>
            </VList>

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
                  :loading="firmwareStore.uploading"
                  data-test-id="firmware-upload-btn"
                  @click="handleFirmwareUpload"
                >
                  Upload
                </VBtn>
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <VAlert
          v-if="maintenanceStore.error"
          type="error"
          variant="tonal"
          class="mb-4"
          :icon="mdiAlertCircle"
        >
          {{ maintenanceStore.error }}
        </VAlert>

        <VAlert
          v-if="cleanupResult"
          :type="cleanupResult.errors.length > 0 ? 'warning' : 'success'"
          variant="tonal"
          class="mb-4"
          :icon="mdiCheckCircle"
          closable
          @click:close="cleanupResult = null"
        >
          <div class="text-body-2">
            <div v-if="dryRun" class="font-weight-bold mb-2">
              Dry Run Results (no actual changes made)
            </div>
            <div v-else class="font-weight-bold mb-2">
              Cleanup Complete
            </div>
            <div>Files deleted: {{ cleanupResult.filesDeleted }}</div>
            <div>Directories deleted: {{ cleanupResult.dirsDeleted }}</div>
            <div>Screens deleted: {{ cleanupResult.screensDeleted }}</div>
            <div>Space freed: {{ formatBytes(cleanupResult.bytesFreed) }}</div>
            <div v-if="cleanupResult.errors.length > 0" class="mt-2">
              <div class="font-weight-bold">
                Errors:
              </div>
              <div v-for="(err, i) in cleanupResult.errors" :key="i" class="text-error">
                {{ err }}
              </div>
            </div>
          </div>
        </VAlert>

        <VProgressCircular
          v-if="maintenanceStore.loading"
          indeterminate
          color="primary"
          class="d-block mx-auto my-8"
        />

        <template v-else-if="maintenanceStore.issues">
          <VCard elevation="1" class="mb-4">
            <VCardTitle>
              Scan Summary
              <VChip v-if="maintenanceStore.issues.scannedAt" size="small" class="ml-2">
                {{ new Date(maintenanceStore.issues.scannedAt).toLocaleString() }}
              </VChip>
            </VCardTitle>
            <VDivider />
            <VCardText>
              <VRow>
                <VCol cols="6" md="3">
                  <div class="text-caption text-medium-emphasis">
                    Orphaned Files
                  </div>
                  <div class="text-h6">
                    {{ maintenanceStore.issues.orphanedScreenFiles.length }}
                  </div>
                </VCol>
                <VCol cols="6" md="3">
                  <div class="text-caption text-medium-emphasis">
                    Orphaned Dirs
                  </div>
                  <div class="text-h6">
                    {{ maintenanceStore.issues.orphanedDeviceDirs.length }}
                  </div>
                </VCol>
                <VCol cols="6" md="3">
                  <div class="text-caption text-medium-emphasis">
                    Broken Screens
                  </div>
                  <div class="text-h6">
                    {{ maintenanceStore.issues.brokenScreens.length }}
                  </div>
                </VCol>
                <VCol cols="6" md="3">
                  <div class="text-caption text-medium-emphasis">
                    Total Size
                  </div>
                  <div class="text-h6">
                    {{ formatBytes(maintenanceStore.issues.totalSize) }}
                  </div>
                </VCol>
                <VCol cols="6" md="3">
                  <div class="text-caption text-medium-emphasis">
                    Temp Files
                  </div>
                  <div class="text-h6">
                    {{ maintenanceStore.issues.tempFiles.length }}
                  </div>
                </VCol>
                <VCol cols="6" md="3">
                  <div class="text-caption text-medium-emphasis">
                    Old Uploads
                  </div>
                  <div class="text-h6">
                    {{ maintenanceStore.issues.oldUploads.length }}
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <VCard v-if="maintenanceStore.issues.orphanedScreenFiles.length > 0" elevation="1" class="mb-4">
            <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
              Orphaned Screen Files
              <VBtn
                size="small"
                variant="text"
                @click="selectAllOrphanedFiles"
              >
                Select All
              </VBtn>
            </VCardTitle>
            <VDivider />
            <VCardText>
              <VList>
                <VListItem
                  v-for="file in maintenanceStore.issues.orphanedScreenFiles"
                  :key="file.path"
                >
                  <template #prepend>
                    <VCheckbox
                      v-model="selectedOrphanedFiles"
                      :value="file.path"
                      hide-details
                    />
                  </template>
                  <VListItemTitle class="text-body-2">
                    Device: <span class="font-weight-bold">{{ file.deviceId }}</span> / Screen: <span class="font-weight-bold">{{ file.screenId }}</span>
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption">
                    {{ file.path }} ({{ formatBytes(file.size) }})
                  </VListItemSubtitle>
                </VListItem>
              </VList>
            </VCardText>
          </VCard>

          <VCard v-if="maintenanceStore.issues.orphanedDeviceDirs.length > 0" elevation="1" class="mb-4">
            <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
              Orphaned Device Directories
              <VBtn
                size="small"
                variant="text"
                @click="selectAllOrphanedDirs"
              >
                Select All
              </VBtn>
            </VCardTitle>
            <VDivider />
            <VCardText>
              <VList>
                <VListItem
                  v-for="dir in maintenanceStore.issues.orphanedDeviceDirs"
                  :key="dir.path"
                >
                  <template #prepend>
                    <VCheckbox
                      v-model="selectedOrphanedDirs"
                      :value="dir.path"
                      hide-details
                    />
                  </template>
                  <VListItemTitle class="text-body-2">
                    Device ID: <span class="font-weight-bold">{{ dir.deviceId }}</span>
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption">
                    {{ dir.path }} ({{ dir.fileCount }} files, {{ formatBytes(dir.size) }})
                  </VListItemSubtitle>
                </VListItem>
              </VList>
            </VCardText>
          </VCard>

          <VCard v-if="maintenanceStore.issues.brokenScreens.length > 0" elevation="1" class="mb-4">
            <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
              Broken Screens (Missing Files)
              <VBtn
                size="small"
                variant="text"
                @click="selectAllBrokenScreens"
              >
                Select All
              </VBtn>
            </VCardTitle>
            <VDivider />
            <VCardText>
              <VList>
                <VListItem
                  v-for="screen in maintenanceStore.issues.brokenScreens"
                  :key="screen.screenId"
                >
                  <template #prepend>
                    <VCheckbox
                      v-model="selectedBrokenScreens"
                      :value="screen.screenId"
                      hide-details
                    />
                  </template>
                  <VListItemTitle class="text-body-2">
                    {{ screen.filename }} <VChip size="x-small" class="ml-2">
                      {{ screen.type }}
                    </VChip>
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption">
                    Device: {{ screen.deviceId }} / Screen: {{ screen.screenId }}
                  </VListItemSubtitle>
                </VListItem>
              </VList>
            </VCardText>
          </VCard>

          <VCard v-if="maintenanceStore.issues.tempFiles.length > 0" elevation="1" class="mb-4">
            <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
              Temporary Files
              <VBtn
                size="small"
                variant="text"
                @click="selectAllTempFiles"
              >
                Select All
              </VBtn>
            </VCardTitle>
            <VDivider />
            <VCardText>
              <VList>
                <VListItem
                  v-for="file in maintenanceStore.issues.tempFiles"
                  :key="file.path"
                >
                  <template #prepend>
                    <VCheckbox
                      v-model="selectedTempFiles"
                      :value="file.path"
                      hide-details
                    />
                  </template>
                  <VListItemTitle class="text-body-2">
                    {{ file.path.split('/').pop() }} <VChip size="x-small" class="ml-2">
                      {{ formatAge(file.age) }} old
                    </VChip>
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption">
                    {{ file.path }} ({{ formatBytes(file.size) }})
                  </VListItemSubtitle>
                </VListItem>
              </VList>
            </VCardText>
          </VCard>

          <VCard v-if="maintenanceStore.issues.oldUploads.length > 0" elevation="1" class="mb-4">
            <VCardTitle class="d-flex align-center justify-space-between flex-wrap ga-2">
              Old Upload Files
              <VBtn
                size="small"
                variant="text"
                @click="selectAllOldUploads"
              >
                Select All
              </VBtn>
            </VCardTitle>
            <VDivider />
            <VCardText>
              <VList>
                <VListItem
                  v-for="file in maintenanceStore.issues.oldUploads"
                  :key="file.path"
                >
                  <template #prepend>
                    <VCheckbox
                      v-model="selectedOldUploads"
                      :value="file.path"
                      hide-details
                    />
                  </template>
                  <VListItemTitle class="text-body-2">
                    {{ file.path.split('/').pop() }} <VChip size="x-small" class="ml-2">
                      {{ formatAge(file.age) }} old
                    </VChip>
                  </VListItemTitle>
                  <VListItemSubtitle class="text-caption">
                    {{ file.path }} ({{ formatBytes(file.size) }})
                  </VListItemSubtitle>
                </VListItem>
              </VList>
            </VCardText>
          </VCard>

          <VCard
            v-if="maintenanceStore.issues.orphanedScreenFiles.length === 0
              && maintenanceStore.issues.orphanedDeviceDirs.length === 0
              && maintenanceStore.issues.brokenScreens.length === 0
              && maintenanceStore.issues.tempFiles.length === 0
              && maintenanceStore.issues.oldUploads.length === 0"
            elevation="1"
            class="mb-4"
          >
            <VCardText>
              <VAlert type="success" variant="tonal" :icon="mdiCheckCircle">
                No maintenance issues found. System is clean!
              </VAlert>
            </VCardText>
          </VCard>

          <VCard v-if="hasSelection" elevation="1" class="mb-4">
            <VCardTitle>Cleanup Actions</VCardTitle>
            <VDivider />
            <VCardText>
              <div class="mb-4">
                <div class="text-body-2 mb-2">
                  <span class="font-weight-bold">Selected items:</span>
                  {{ selectedOrphanedFiles.length + selectedOrphanedDirs.length + selectedBrokenScreens.length + selectedTempFiles.length + selectedOldUploads.length }}
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
                    @click="confirmCleanup"
                  >
                    {{ dryRun ? 'Preview Cleanup' : 'Clean Selected' }}
                  </VBtn>
                  <VBtn
                    variant="text"
                    @click="selectAll"
                  >
                    Select All
                  </VBtn>
                  <VBtn
                    variant="text"
                    @click="deselectAll"
                  >
                    Deselect All
                  </VBtn>
                </div>
              </div>
            </VCardText>
          </VCard>
        </template>
      </VCol>
    </VRow>

    <VDialog v-model="showConfirmDialog" max-width="500">
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
            <div>Files: {{ selectedOrphanedFiles.length + selectedTempFiles.length + selectedOldUploads.length }}</div>
            <div>Directories: {{ selectedOrphanedDirs.length }}</div>
            <div>Screens: {{ selectedBrokenScreens.length }}</div>
            <div class="mt-2 font-weight-bold">
              Total space: {{ formatBytes(totalSelectedSize) }}
            </div>
          </div>
        </VCardText>
        <VDivider />
        <VCardText class="d-flex justify-end gap-2">
          <VBtn
            variant="text"
            @click="showConfirmDialog = false"
          >
            Cancel
          </VBtn>
          <VBtn
            :color="dryRun ? 'primary' : 'error'"
            variant="tonal"
            @click="executeCleanup"
          >
            {{ dryRun ? 'Preview' : 'Confirm Delete' }}
          </VBtn>
        </VCardText>
      </VCard>
    </VDialog>
  </VContainer>
</template>
