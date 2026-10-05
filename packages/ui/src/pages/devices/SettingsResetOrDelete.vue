<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import Button from '@/components/Button.vue'
import ResultLine from '@/components/ResultLine.vue'
import SaveState from '@/components/SaveState.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import { useNow } from '@/patterns/useNow'
import DeviceDeletion from './DeviceDeletion.vue'
import DeviceReset from './DeviceReset.vue'
import { reachesDevice, screensCounted, SETTINGS_SECTIONS } from './deviceSettings'
import SettingsProblem from './SettingsProblem.vue'
import { useDeviceWrite } from './useDeviceSetting'

defineProps<{
  device: DeviceDetail
}>()

const now = useNow()
const cancel = useDeviceWrite()
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
      <Button v-if="device.pending.deviceReset" variant="quiet" :loading="cancel.status === 'saving'" @click="cancel.send({ resetDevice: false })">
        Cancel Device Reset
      </Button>
    </div>
    <SettingsProblem v-if="device.isProxied">
      {{ device.name }} is a Proxied Device, so a Device Reset triggered here never reaches it.
    </SettingsProblem>
    <SaveState class="state" :status="cancel.status" :reason="cancel.reason" @retry="cancel.retry" />
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

  .state {
    margin-top: var(--space-3);
  }
}
</style>
