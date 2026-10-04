<script setup lang="ts">
import type { DeviceModelList, InstanceFacts } from 'kuroshiro-shared'
import { listDeviceModels } from '@/api/device-models'
import { joinLoads } from '@/patterns/joinLoads'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import { useInstanceFacts } from '@/reads/sharedReads'
import InstancePageHeading from './InstancePageHeading.vue'
import { FIRMWARE_PATH } from './instancePaths'
import UploadFirmwareForm from './UploadFirmwareForm.vue'

const deviceModels = useLoad(listDeviceModels)
/** The form names the Device Models and the upload limit, so it waits for both and either one's failure is its notice. */
const page = joinLoads<{ deviceModels: DeviceModelList, facts: InstanceFacts }>({ deviceModels, facts: useInstanceFacts() })
</script>

<template>
  <InstancePageHeading title="Upload Firmware" :back="{ label: 'Firmware', to: FIRMWARE_PATH }" />
  <div class="body">
    <LoadBody v-slot="{ data }" :load="page" loading="Loading the Device Models" failed="Could not load the Device Models.">
      <UploadFirmwareForm :models="data.deviceModels.models.filter(model => !model.deprecated)" :max-bytes="data.facts.limits.firmwareUploadBytes" />
    </LoadBody>
  </div>
</template>

<style scoped>
@layer components {
  .body {
    margin-top: var(--space-5);
  }
}
</style>
