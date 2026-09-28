<script setup lang="ts">
import type { NormalizedLogStatus } from '@/types.ts'
import { computed } from 'vue'
import { VCol, VRow } from 'vuetify/components'

const props = defineProps<{ status: NormalizedLogStatus }>()

const freeHeapKb = computed(() => props.status.freeHeapSize !== undefined ? (props.status.freeHeapSize / 1024).toFixed(1) : undefined)
</script>

<template>
  <div class="mb-3">
    <div class="text-subtitle-2 mb-2 font-weight-bold">
      Device Status
    </div>
    <VRow dense>
      <VCol cols="6" sm="4">
        <div class="text-caption text-medium-emphasis">
          WiFi RSSI
        </div>
        <div class="text-body-2">
          {{ status.wifiRssi }} dBm
        </div>
      </VCol>
      <VCol cols="6" sm="4">
        <div class="text-caption text-medium-emphasis">
          Battery
        </div>
        <div class="text-body-2">
          {{ status.batteryVoltage }} V
        </div>
      </VCol>
      <VCol cols="6" sm="4">
        <div class="text-caption text-medium-emphasis">
          Firmware
        </div>
        <div class="text-body-2">
          {{ status.firmwareVersion }}
        </div>
      </VCol>
      <VCol cols="6" sm="4">
        <div class="text-caption text-medium-emphasis">
          Free Heap
        </div>
        <div class="text-body-2">
          {{ freeHeapKb }} KB
        </div>
      </VCol>
      <VCol cols="6" sm="4">
        <div class="text-caption text-medium-emphasis">
          Wakeup Reason
        </div>
        <div class="text-body-2">
          {{ status.wakeReason }}
        </div>
      </VCol>
      <VCol cols="6" sm="4">
        <div class="text-caption text-medium-emphasis">
          WiFi Status
        </div>
        <div class="text-body-2">
          {{ status.wifiStatus }}
        </div>
      </VCol>
    </VRow>
  </div>
</template>
