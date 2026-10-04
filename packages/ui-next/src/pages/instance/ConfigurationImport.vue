<script setup lang="ts">
import type { DeviceSummary, InstanceFacts } from 'kuroshiro-shared'
import { joinLoads } from '@/patterns/joinLoads'
import LoadBody from '@/patterns/LoadBody.vue'
import { useDevices, useInstanceFacts } from '@/reads/sharedReads'
import ImportSteps from './ImportSteps.vue'
import InstanceSection from './InstanceSection.vue'

/** The section counts the Devices and names the archive limit and this Kuroshiro's version, so it waits for both reads. */
const instance = joinLoads<{ devices: DeviceSummary[], facts: InstanceFacts }>({ devices: useDevices(), facts: useInstanceFacts() })
</script>

<template>
  <InstanceSection id="import" title="Configuration Import">
    <div class="import">
      <LoadBody v-slot="{ data }" :load="instance" loading="Loading the Instance" failed="Could not load the Instance.">
        <ImportSteps :device-count="data.devices.length" :max-bytes="data.facts.limits.archiveUploadBytes" :version="data.facts.version" />
      </LoadBody>
    </div>
  </InstanceSection>
</template>

<style scoped>
@layer components {
  .import {
    margin-top: var(--space-3);
  }
}
</style>
