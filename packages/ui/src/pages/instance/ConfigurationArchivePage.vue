<script setup lang="ts">
import ConfigurationExport from './ConfigurationExport.vue'
import ConfigurationImport from './ConfigurationImport.vue'
import InstancePageHeading from './InstancePageHeading.vue'
</script>

<template>
  <InstancePageHeading title="Configuration Archive" />
  <div class="body">
    <p class="lede">
      One .zip holding what you built on this Instance: Devices, Screens with their Schedules, Mashups, Plugins with their Field Values, custom Palettes and the Instance Settings you set.
    </p>
    <ConfigurationExport class="first" />
    <ConfigurationImport />
  </div>
</template>

<style scoped>
@layer components {
  .body {
    margin-top: var(--space-3);
  }

  .lede {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .body .first {
    margin-top: var(--space-8);
  }
}
</style>
