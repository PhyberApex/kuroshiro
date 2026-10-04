<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import PageSection from '@/patterns/PageSection.vue'
import { useDevices } from '@/reads/sharedReads'
import { CONNECT_PATH } from '@/shell/barEntries'
import PluginDeviceRow from './PluginDeviceRow.vue'
import { standingsOf } from './pluginDevices'
import PluginMashupRow from './PluginMashupRow.vue'
import { usePluginPage } from './pluginPage'

const { plugin } = usePluginPage()
const devices = useDevices()

const standings = computed(() => devices.data && standingsOf(devices.data, plugin.value.assignments))
const anyDevice = computed(() => (standings.value?.length ?? 0) > 0)
</script>

<template>
  <PageSection id="devices" title="Devices" :rows="anyDevice">
    <ul v-if="anyDevice">
      <PluginDeviceRow v-for="standing in standings" :key="standing.device.id" v-bind="standing" />
      <PluginMashupRow v-for="place in plugin.mashups" :key="place.screenId" :place="place" :plugin-name="plugin.name" />
    </ul>
    <div v-else-if="standings" class="no-devices">
      <p>No Device is connected yet, so there is nothing to assign {{ plugin.name }} to.</p>
      <Button as-child>
        <RouterLink :to="CONNECT_PATH">
          Connect a Device
        </RouterLink>
      </Button>
    </div>
    <template v-if="anyDevice" #under>
      Assigning adds {{ plugin.name }} to the end of that Device's Order as a Screen, always shown until you give it a Schedule there.
    </template>
  </PageSection>
</template>

<style scoped>
@layer components {
  .no-devices {
    display: grid;
    justify-items: start;
    gap: var(--space-4);
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }
}
</style>
