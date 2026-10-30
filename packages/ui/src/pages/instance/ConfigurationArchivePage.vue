<script setup lang="ts">
import ConfigurationExport from './ConfigurationExport.vue'
import ConfigurationImport from './ConfigurationImport.vue'
import InstancePageBody from './InstancePageBody.vue'
import InstancePageHeading from './InstancePageHeading.vue'
</script>

<template>
  <InstancePageHeading title="Configuration Archive" />
  <InstancePageBody>
    <template #lede>
      One .zip holding what you built on this Instance: Devices, Screens with their Schedules, Mashups, Plugins with their Field Values, custom Palettes and the Instance Settings you set.
    </template>
    <ConfigurationExport class="first" />
    <ConfigurationImport />
  </InstancePageBody>
</template>
