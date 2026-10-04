<script setup lang="ts">
import type { DeviceSummary } from 'kuroshiro-shared'
import { watchEffect } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Button from '@/components/Button.vue'
import Plate from '@/components/Plate.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import WashBar from '@/patterns/WashBar.vue'
import { useAlerts, useDevices } from '@/reads/sharedReads'
import { CONNECT_PATH } from '@/shell/barEntries'
import DevicesListRow from './DevicesListRow.vue'

const router = useRouter()
const devices = useDevices()
const alerts = useAlerts()

const firingOn = (device: DeviceSummary) => alerts.data?.active.filter(alert => alert.deviceId === device.id) ?? []

const LOADING_ROWS = [['34%', '46%'], ['26%', '40%'], ['30%', '52%']]

watchEffect(() => {
  if (devices.data?.length === 0)
    void router.replace(CONNECT_PATH)
})
</script>

<template>
  <TitleLine title="Devices">
    <template #actions>
      <Button as-child>
        <RouterLink :to="CONNECT_PATH">
          Connect a Device
        </RouterLink>
      </Button>
    </template>
  </TitleLine>
  <LoadBody :load="devices" loading="Loading Devices" failed="Could not load the Devices.">
    <template #default="{ data }">
      <ul class="devices">
        <DevicesListRow v-for="device in data" :key="device.id" :device="device" :alerts="firingOn(device)" />
      </ul>
    </template>
    <template #skeleton>
      <div class="devices" aria-hidden="true">
        <div v-for="[name, shows] in LOADING_ROWS" :key="name" class="loading-row">
          <Plate size="list" name="A Device's Current Screen" rendering />
          <div class="bars">
            <WashBar :width="name" />
            <WashBar :width="shows" />
          </div>
        </div>
      </div>
    </template>
  </LoadBody>
</template>

<style scoped>
@layer components {
  .devices {
    border-top: var(--rule);
  }

  .loading-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
  }

  .bars {
    display: grid;
    gap: var(--space-3);
  }

  @media (max-width: 820px) {
    .loading-row {
      gap: var(--space-3);
    }
  }
}
</style>
