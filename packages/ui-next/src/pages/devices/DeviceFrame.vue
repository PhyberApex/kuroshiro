<script setup lang="ts">
import type { NavItem } from '@/components/navItem'
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { getDevice } from '@/api/devices'
import Button from '@/components/Button.vue'
import Tabs from '@/components/Tabs.vue'
import MissingPage from '@/patterns/MissingPage.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import { useDevices } from '@/reads/sharedReads'
import { DEVICES_PATH, MOST_DEVICES_NAMED } from '@/shell/barEntries'
import { provideDeviceFrame } from './deviceFrame'

const route = useRoute()
const devices = useDevices()

const deviceId = computed(() => String(route.params.deviceId))
const device = useLoad(() => getDevice(deviceId.value), { key: () => route.params.deviceId, fresh: true })

const name = computed(() => device.data?.name
  ?? devices.data?.find(listed => listed.id === deviceId.value)?.name
  ?? 'Device')
const path = computed(() => `${DEVICES_PATH}/${deviceId.value}`)

provideDeviceFrame({ device, name, path })

const views = computed<NavItem[]>(() => [
  { label: 'Screens', to: path.value },
  { label: 'Settings', to: `${path.value}/settings` },
  { label: 'Logs', to: `${path.value}/logs` },
])

/** The bar stops naming the Devices from five on, so the way back to them stands above the title. */
const back = computed<NavItem | undefined>(() =>
  (devices.data?.length ?? 0) > MOST_DEVICES_NAMED ? { label: 'Devices', to: DEVICES_PATH } : undefined)

const addsScreen = computed(() => route.path === path.value && (device.data?.screenCount ?? 0) > 0)
</script>

<template>
  <MissingPage v-if="device.missing" title="No Device here" :back="{ label: 'All Devices', to: DEVICES_PATH }">
    It may have been deleted.
  </MissingPage>
  <template v-else>
    <TitleLine :title="name" :back="back">
      <template v-if="addsScreen" #actions>
        <Button as-child variant="primary">
          <RouterLink :to="`${path}/screens/new`">
            Add Screen
          </RouterLink>
        </Button>
      </template>
    </TitleLine>
    <Tabs :label="name" :items="views" />
    <RouterView />
  </template>
</template>
