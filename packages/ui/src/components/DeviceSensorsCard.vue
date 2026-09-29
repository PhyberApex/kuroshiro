<script setup lang="ts">
import type { DeviceSensorKind } from '@/types'
import { computed } from 'vue'
import { VCard, VCardText, VCardTitle, VDivider, VList, VListItem, VListItemTitle } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device'
import { useDeviceSensorsStore } from '@/stores/deviceSensors'

const props = defineProps<{ deviceId: string }>()

const SENSOR_LABELS: Record<DeviceSensorKind, string> = {
  carbon_dioxide: 'CO₂',
  humidity: 'Humidity',
  pressure: 'Pressure',
  temperature: 'Temperature',
}

const deviceStore = useDeviceStore()
const device = computed(() => deviceStore.getById(props.deviceId))
const sensorsStore = useDeviceSensorsStore(props.deviceId)
</script>

<template>
  <template v-if="device && sensorsStore.readings.length > 0">
    <VCard class="mb-6" elevation="1">
      <VCardTitle>Sensors</VCardTitle>
      <VDivider />
      <VCardText class="pa-0">
        <VList data-test-id="sensors-list">
          <VListItem v-for="reading in sensorsStore.readings" :key="reading.kind" data-test-id="sensor-list-item">
            <VListItemTitle>{{ SENSOR_LABELS[reading.kind] }}: {{ reading.value }} {{ reading.unit }}</VListItemTitle>
          </VListItem>
        </VList>
      </VCardText>
    </VCard>
  </template>
</template>
