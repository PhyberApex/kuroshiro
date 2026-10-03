<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import LoadBody from '@/patterns/LoadBody.vue'
import { useDevices } from '@/reads/sharedReads'
import { landingPathFor } from './landing'

const router = useRouter()
const devices = useDevices()

watchEffect(() => {
  if (devices.data)
    void router.replace(landingPathFor(devices.data))
})
</script>

<template>
  <LoadBody :load="devices" loading="Loading Devices" failed="Could not load the Devices.">
    <template #default />
  </LoadBody>
</template>
