<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import Notice from '@/components/Notice.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
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
const anyMashup = computed(() => plugin.value.mashups.length > 0)
const anyRows = computed(() => anyDevice.value || anyMashup.value)
</script>

<template>
  <PageSection id="devices" title="Devices" :rows="anyRows">
    <Notice
      v-if="devices.failure"
      class="failed"
      title="Could not load the Devices."
      :reason="devices.failure.reason"
      action="Try again"
      @act="devices.reload"
    />
    <ul v-if="anyRows">
      <PluginDeviceRow v-for="standing in standings ?? []" :key="standing.device.id" v-bind="standing" />
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
    <LoadingLine v-if="!standings" :shown="devices.waiting">
      Loading the Devices
    </LoadingLine>
    <template v-if="anyDevice" #under>
      Assigning adds {{ plugin.name }} to the end of that Device's Order as a Screen, always shown until you give it a Schedule there.
    </template>
  </PageSection>
</template>

<style scoped>
@layer components {
  .failed {
    margin-bottom: var(--space-6);
  }

  .no-devices {
    display: grid;
    justify-items: start;
    gap: var(--space-4);
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }
}
</style>
