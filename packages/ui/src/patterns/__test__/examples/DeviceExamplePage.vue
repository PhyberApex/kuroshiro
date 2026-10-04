<script setup lang="ts">
import type { DeviceSummary } from 'kuroshiro-shared'
import { useRoute } from 'vue-router'
import { apiGet } from '@/api/client'
import LoadBody from '../../LoadBody.vue'
import MissingPage from '../../MissingPage.vue'
import TitleLine from '../../TitleLine.vue'
import { useLoad } from '../../useLoad'

const route = useRoute()
const device = useLoad(() => apiGet<DeviceSummary>(`devices/${String(route.params.deviceId)}`), { key: () => route.params.deviceId })
</script>

<template>
  <MissingPage v-if="device.missing" title="No Device here" :back="{ label: 'All Devices', to: '/devices' }">
    It may have been deleted.
  </MissingPage>
  <template v-else>
    <TitleLine :title="device.data?.name ?? 'Device'" :back="{ label: 'Devices', to: '/devices' }" />
    <LoadBody v-slot="{ data }" :load="device" loading="Loading the Device" failed="Could not load the Device.">
      <p>Battery {{ data.batteryPercent }} %</p>
    </LoadBody>
  </template>
</template>
