<script setup lang="ts">
import { useDevices } from '@/reads/sharedReads'
import LoadBody from '../../LoadBody.vue'
import TitleLine from '../../TitleLine.vue'
import WashBar from '../../WashBar.vue'

const devices = useDevices()
</script>

<template>
  <TitleLine title="Devices" />
  <LoadBody :load="devices" loading="Loading Devices" failed="Could not load the Devices.">
    <template #skeleton>
      <WashBar data-testid="bone" width="12rem" />
    </template>
    <template #default="{ data }">
      <p>{{ data.length }} Devices</p>
    </template>
  </LoadBody>
</template>
