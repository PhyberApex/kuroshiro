<script setup lang="ts">
import type { CleanupResult, DeviceModelSyncResult, FirmwareSyncResult } from '@/types'
import { mdiAlertCircle, mdiCheckCircle, mdiRefresh } from '@mdi/js'
import { computed, onMounted, ref } from 'vue'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VChip, VCol, VContainer, VDivider, VListItemSubtitle, VListItemTitle, VProgressCircular, VRow } from 'vuetify/components'
import CleanupActionsCard from '@/components/maintenance/CleanupActionsCard.vue'
import CleanupConfirmDialog from '@/components/maintenance/CleanupConfirmDialog.vue'
import CleanupResultAlert from '@/components/maintenance/CleanupResultAlert.vue'
import DeviceModelsCard from '@/components/maintenance/DeviceModelsCard.vue'
import FirmwareCard from '@/components/maintenance/FirmwareCard.vue'
import MaintenanceIssueListCard from '@/components/maintenance/MaintenanceIssueListCard.vue'
import ScanSummaryCard from '@/components/maintenance/ScanSummaryCard.vue'
import { useDeviceModelsStore } from '@/stores/deviceModels'
import { useFirmwareStore } from '@/stores/firmware'
import { useMaintenanceStore } from '@/stores/maintenance'
import { formatAge, formatBytes } from '@/utils/maintenanceFormat'

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

const deviceModelOptions = computed(() => deviceModelsStore.activeModels.map(model => ({ title: model.label, value: model.name })))

const firmwareCard = ref<InstanceType<typeof FirmwareCard>>()

async function handleFirmwareUpload(payload: { file: File, version: string, label?: string, compatibleModels?: string[] }) {
  const ok = await firmwareStore.upload(payload.file, payload.version, payload.label, payload.compatibleModels)
  if (ok)
    firmwareCard.value?.resetUploadForm()
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
const cleanupResult = ref<CleanupResult | null>(null)

function withKey<T>(items: T[] | undefined, keyOf: (item: T) => string) {
  return (items ?? []).map(item => ({ ...item, key: keyOf(item) }))
}

const orphanedFileItems = computed(() => withKey(maintenanceStore.issues?.orphanedScreenFiles, file => file.path))
const orphanedDirItems = computed(() => withKey(maintenanceStore.issues?.orphanedDeviceDirs, dir => dir.path))
const brokenScreenItems = computed(() => withKey(maintenanceStore.issues?.brokenScreens, screen => screen.screenId))
const tempFileItems = computed(() => withKey(maintenanceStore.issues?.tempFiles, file => file.path))
const oldUploadItems = computed(() => withKey(maintenanceStore.issues?.oldUploads, file => file.path))

const hasNoIssues = computed(() => {
  return orphanedFileItems.value.length === 0
    && orphanedDirItems.value.length === 0
    && brokenScreenItems.value.length === 0
    && tempFileItems.value.length === 0
    && oldUploadItems.value.length === 0
})

const hasSelection = computed(() => {
  return selectedOrphanedFiles.value.length > 0
    || selectedOrphanedDirs.value.length > 0
    || selectedBrokenScreens.value.length > 0
    || selectedTempFiles.value.length > 0
    || selectedOldUploads.value.length > 0
})

const selectedCount = computed(() => {
  return selectedOrphanedFiles.value.length + selectedOrphanedDirs.value.length + selectedBrokenScreens.value.length + selectedTempFiles.value.length + selectedOldUploads.value.length
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
  deselectAll()
  cleanupResult.value = null
  await maintenanceStore.scanSystem()
}

function selectAll() {
  selectedOrphanedFiles.value = orphanedFileItems.value.map(item => item.key)
  selectedOrphanedDirs.value = orphanedDirItems.value.map(item => item.key)
  selectedBrokenScreens.value = brokenScreenItems.value.map(item => item.key)
  selectedTempFiles.value = tempFileItems.value.map(item => item.key)
  selectedOldUploads.value = oldUploadItems.value.map(item => item.key)
}

function deselectAll() {
  selectedOrphanedFiles.value = []
  selectedOrphanedDirs.value = []
  selectedBrokenScreens.value = []
  selectedTempFiles.value = []
  selectedOldUploads.value = []
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

        <DeviceModelsCard
          :active-model-count="deviceModelsStore.activeModels.length"
          :deprecated-model-count="deviceModelsStore.models.length - deviceModelsStore.activeModels.length"
          :palette-count="deviceModelsStore.palettes.length"
          :last-synced-at="lastModelSync"
          :syncing="deviceModelsStore.syncing"
          :error="modelError"
          :sync-result="syncResult"
          @sync="handleModelSync"
          @dismiss-result="syncResult = null"
        />

        <FirmwareCard
          ref="firmwareCard"
          :active-firmware="firmwareStore.activeFirmware"
          :total-firmware-count="firmwareStore.firmware.length"
          :last-synced-at="lastFirmwareSync"
          :syncing="firmwareStore.syncing"
          :uploading="firmwareStore.uploading"
          :error="firmwareError"
          :sync-result="firmwareSyncResult"
          :device-model-options="deviceModelOptions"
          @sync="handleFirmwareSync"
          @dismiss-result="firmwareSyncResult = null"
          @delete="handleFirmwareDelete"
          @upload="handleFirmwareUpload"
        />

        <VAlert
          v-if="maintenanceStore.error"
          type="error"
          variant="tonal"
          class="mb-4"
          :icon="mdiAlertCircle"
        >
          {{ maintenanceStore.error }}
        </VAlert>

        <CleanupResultAlert
          v-if="cleanupResult"
          :result="cleanupResult"
          :dry-run="dryRun"
          @dismiss="cleanupResult = null"
        />

        <VProgressCircular
          v-if="maintenanceStore.loading"
          indeterminate
          color="primary"
          class="d-block mx-auto my-8"
        />

        <template v-else-if="maintenanceStore.issues">
          <ScanSummaryCard :issues="maintenanceStore.issues" />

          <MaintenanceIssueListCard v-model:selected="selectedOrphanedFiles" title="Orphaned Screen Files" :items="orphanedFileItems">
            <template #default="{ item }">
              <VListItemTitle class="text-body-2">
                Device: <span class="font-weight-bold">{{ item.deviceId }}</span> / Screen: <span class="font-weight-bold">{{ item.screenId }}</span>
              </VListItemTitle>
              <VListItemSubtitle class="text-caption">
                {{ item.path }} ({{ formatBytes(item.size) }})
              </VListItemSubtitle>
            </template>
          </MaintenanceIssueListCard>

          <MaintenanceIssueListCard v-model:selected="selectedOrphanedDirs" title="Orphaned Device Directories" :items="orphanedDirItems">
            <template #default="{ item }">
              <VListItemTitle class="text-body-2">
                Device ID: <span class="font-weight-bold">{{ item.deviceId }}</span>
              </VListItemTitle>
              <VListItemSubtitle class="text-caption">
                {{ item.path }} ({{ item.fileCount }} files, {{ formatBytes(item.size) }})
              </VListItemSubtitle>
            </template>
          </MaintenanceIssueListCard>

          <MaintenanceIssueListCard v-model:selected="selectedBrokenScreens" title="Broken Screens (Missing Files)" :items="brokenScreenItems">
            <template #default="{ item }">
              <VListItemTitle class="text-body-2">
                {{ item.filename }} <VChip size="x-small" class="ml-2">
                  {{ item.type }}
                </VChip>
              </VListItemTitle>
              <VListItemSubtitle class="text-caption">
                Device: {{ item.deviceId }} / Screen: {{ item.screenId }}
              </VListItemSubtitle>
            </template>
          </MaintenanceIssueListCard>

          <MaintenanceIssueListCard v-model:selected="selectedTempFiles" title="Temporary Files" :items="tempFileItems">
            <template #default="{ item }">
              <VListItemTitle class="text-body-2">
                {{ item.path.split('/').pop() }} <VChip size="x-small" class="ml-2">
                  {{ formatAge(item.age) }} old
                </VChip>
              </VListItemTitle>
              <VListItemSubtitle class="text-caption">
                {{ item.path }} ({{ formatBytes(item.size) }})
              </VListItemSubtitle>
            </template>
          </MaintenanceIssueListCard>

          <MaintenanceIssueListCard v-model:selected="selectedOldUploads" title="Old Upload Files" :items="oldUploadItems">
            <template #default="{ item }">
              <VListItemTitle class="text-body-2">
                {{ item.path.split('/').pop() }} <VChip size="x-small" class="ml-2">
                  {{ formatAge(item.age) }} old
                </VChip>
              </VListItemTitle>
              <VListItemSubtitle class="text-caption">
                {{ item.path }} ({{ formatBytes(item.size) }})
              </VListItemSubtitle>
            </template>
          </MaintenanceIssueListCard>

          <VCard v-if="hasNoIssues" elevation="1" class="mb-4">
            <VCardText>
              <VAlert type="success" variant="tonal" :icon="mdiCheckCircle">
                No maintenance issues found. System is clean!
              </VAlert>
            </VCardText>
          </VCard>

          <CleanupActionsCard
            v-if="hasSelection"
            v-model:dry-run="dryRun"
            :selected-count="selectedCount"
            :total-selected-size="totalSelectedSize"
            :cleanup-in-progress="cleanupInProgress"
            @confirm-cleanup="confirmCleanup"
            @select-all="selectAll"
            @deselect-all="deselectAll"
          />
        </template>
      </VCol>
    </VRow>

    <CleanupConfirmDialog
      v-model="showConfirmDialog"
      :dry-run="dryRun"
      :file-count="selectedOrphanedFiles.length + selectedTempFiles.length + selectedOldUploads.length"
      :dir-count="selectedOrphanedDirs.length"
      :screen-count="selectedBrokenScreens.length"
      :total-size="totalSelectedSize"
      @confirm="executeCleanup"
    />
  </VContainer>
</template>
