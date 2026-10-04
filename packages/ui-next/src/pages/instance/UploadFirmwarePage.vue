<script setup lang="ts">
import type { DeviceModelRead } from 'kuroshiro-shared'
import type { Load } from '@/patterns/useLoad'
import { computed, reactive } from 'vue'
import { listDeviceModels } from '@/api/device-models'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import { useInstanceFacts } from '@/reads/sharedReads'
import InstancePageHeading from './InstancePageHeading.vue'
import { FIRMWARE_PATH } from './instancePaths'
import UploadFirmwareForm from './UploadFirmwareForm.vue'

const deviceModels = useLoad(listDeviceModels)
const instanceFacts = useInstanceFacts()

/** The form names the Device Models and the upload limit, so it waits for both and either one's failure is its notice. */
const page: Load<{ models: DeviceModelRead[], maxBytes: number }> = reactive({
  data: computed(() => deviceModels.data && instanceFacts.data
    ? { models: deviceModels.data.models.filter(model => !model.deprecated), maxBytes: instanceFacts.data.limits.firmwareUploadBytes }
    : undefined),
  waiting: computed(() => deviceModels.waiting || instanceFacts.waiting),
  failure: computed(() => deviceModels.failure ?? instanceFacts.failure),
  missing: false,
  reload: async () => {
    await Promise.all([deviceModels.reload(), instanceFacts.reload()])
  },
})
</script>

<template>
  <InstancePageHeading title="Upload Firmware" :back="{ label: 'Firmware', to: FIRMWARE_PATH }" />
  <div class="body">
    <LoadBody v-slot="{ data }" :load="page" loading="Loading the Device Models" failed="Could not load the Device Models.">
      <UploadFirmwareForm :models="data.models" :max-bytes="data.maxBytes" />
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
