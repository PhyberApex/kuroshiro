<script setup lang="ts">
import LoadBody from '@/patterns/LoadBody.vue'
import WashBar from '@/patterns/WashBar.vue'
import { useDevices } from '@/reads/sharedReads'
import InstancePageHeading from './InstancePageHeading.vue'
import SimulatorBench from './SimulatorBench.vue'

const devices = useDevices()
</script>

<template>
  <InstancePageHeading title="Device Simulator" />
  <div class="body">
    <p class="lede">
      Makes the two calls a Device's firmware makes, from this browser, and shows what the server answers. For finding out why a Device shows what it shows, without walking to it.
    </p>
    <LoadBody :load="devices" loading="Loading the Devices" failed="Could not load the Devices.">
      <template #skeleton>
        <div class="skeleton" aria-hidden="true">
          <WashBar width="40%" />
          <WashBar width="60%" />
        </div>
      </template>
      <template #default="{ data }">
        <SimulatorBench :devices="data" />
      </template>
    </LoadBody>
  </div>
</template>

<style scoped>
@layer components {
  .body {
    display: grid;
    gap: var(--space-6);
    margin-top: var(--space-3);
  }

  .lede {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .skeleton {
    display: grid;
    gap: var(--space-4);
  }
}
</style>
