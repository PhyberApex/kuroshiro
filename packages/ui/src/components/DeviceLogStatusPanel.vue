<script setup lang="ts">
import type { DeviceStatusStamp } from '@/types.ts'
import { computed } from 'vue'
import { VCol, VRow } from 'vuetify/components'

const props = defineProps<{ status: DeviceStatusStamp }>()

const freeHeapKb = computed(() => (props.status.free_heap_size / 1024).toFixed(1))
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
          {{ status.wifi_rssi_level }} dBm
        </div>
      </VCol>
      <VCol cols="6" sm="4">
        <div class="text-caption text-medium-emphasis">
          Battery
        </div>
        <div class="text-body-2">
          {{ status.battery_voltage }} V
        </div>
      </VCol>
      <VCol cols="6" sm="4">
        <div class="text-caption text-medium-emphasis">
          Firmware
        </div>
        <div class="text-body-2">
          {{ status.current_fw_version }}
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
          {{ status.wakeup_reason }}
        </div>
      </VCol>
      <VCol cols="6" sm="4">
        <div class="text-caption text-medium-emphasis">
          WiFi Status
        </div>
        <div class="text-body-2">
          {{ status.wifi_status }}
        </div>
      </VCol>
    </VRow>
  </div>
</template>
