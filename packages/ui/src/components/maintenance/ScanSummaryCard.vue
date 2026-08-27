<script setup lang="ts">
import type { MaintenanceIssues } from '@/types'
import { VCard, VCardText, VCardTitle, VChip, VCol, VDivider, VRow } from 'vuetify/components'
import { formatBytes } from '@/utils/maintenanceFormat'

defineProps<{
  issues: MaintenanceIssues
}>()
</script>

<template>
  <VCard elevation="1" class="mb-4">
    <VCardTitle class="d-flex align-center flex-wrap ga-2">
      Scan Summary
      <VChip v-if="issues.scannedAt" size="small">
        {{ new Date(issues.scannedAt).toLocaleString() }}
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
            {{ issues.orphanedScreenFiles.length }}
          </div>
        </VCol>
        <VCol cols="6" md="3">
          <div class="text-caption text-medium-emphasis">
            Orphaned Dirs
          </div>
          <div class="text-h6">
            {{ issues.orphanedDeviceDirs.length }}
          </div>
        </VCol>
        <VCol cols="6" md="3">
          <div class="text-caption text-medium-emphasis">
            Broken Screens
          </div>
          <div class="text-h6">
            {{ issues.brokenScreens.length }}
          </div>
        </VCol>
        <VCol cols="6" md="3">
          <div class="text-caption text-medium-emphasis">
            Total Size
          </div>
          <div class="text-h6">
            {{ formatBytes(issues.totalSize) }}
          </div>
        </VCol>
        <VCol cols="6" md="3">
          <div class="text-caption text-medium-emphasis">
            Temp Files
          </div>
          <div class="text-h6">
            {{ issues.tempFiles.length }}
          </div>
        </VCol>
        <VCol cols="6" md="3">
          <div class="text-caption text-medium-emphasis">
            Old Uploads
          </div>
          <div class="text-h6">
            {{ issues.oldUploads.length }}
          </div>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
