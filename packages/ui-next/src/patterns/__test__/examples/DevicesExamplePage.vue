<script setup lang="ts">
import Button from '@/components/Button.vue'
import { useDevices } from '@/reads/sharedReads'
import LoadBody from '../../LoadBody.vue'
import TitleLine from '../../TitleLine.vue'

const devices = useDevices()
</script>

<template>
  <TitleLine title="Devices">
    <template #actions>
      <Button>Connect a Device</Button>
    </template>
  </TitleLine>
  <LoadBody v-slot="{ data }" :load="devices" loading="Loading Devices" failed="Could not load the Devices.">
    <ul>
      <li v-for="device in data" :key="device.id">
        {{ device.name }}
      </li>
    </ul>
  </LoadBody>
</template>
