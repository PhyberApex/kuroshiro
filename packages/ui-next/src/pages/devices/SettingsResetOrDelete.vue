<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import ResultLine from '@/components/ResultLine.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import { useNow } from '@/patterns/useNow'
import DeviceDeletion from './DeviceDeletion.vue'
import DeviceReset from './DeviceReset.vue'
import { reachesDevice, screensCounted, SETTINGS_SECTIONS } from './deviceSettings'
import SettingsProblem from './SettingsProblem.vue'

defineProps<{
  device: DeviceDetail
}>()

const now = useNow()
</script>

<template>
  <TuckedSection :id="SETTINGS_SECTIONS.resetOrDelete" :title="`Reset or delete ${device.name}`">
    <p class="intro">
      <span>A Device Reset makes {{ device.name }} erase its Wi-Fi credentials and this server's URL at its next poll, so someone has to set it up by hand again. Nothing here is lost.</span>
      {{ ' ' }}
      <span>Deleting removes {{ device.name }}, its {{ screensCounted(device.screenCount) }}, their Schedules and its Device Log from this Instance.</span>
    </p>
    <div class="buttons">
      <DeviceReset :device="device" />
      <DeviceDeletion :device="device" />
      <ResultLine :running="device.pending.deviceReset">
        <template v-if="device.pending.deviceReset" #default>
          Device Reset pending, {{ reachesDevice(device, now) }}
        </template>
      </ResultLine>
    </div>
    <SettingsProblem v-if="device.isProxied">
      {{ device.name }} is a Proxied Device, so a Device Reset triggered here never reaches it.
    </SettingsProblem>
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .intro {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-top: var(--space-4);
  }
}
</style>
