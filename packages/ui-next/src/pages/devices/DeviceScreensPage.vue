<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { listScreens } from '@/api/screens'
import Notice from '@/components/Notice.vue'
import { useLoad } from '@/patterns/useLoad'
import { useAlerts, useDevices } from '@/reads/sharedReads'
import CurrentScreenHero from './CurrentScreenHero.vue'
import { useDeviceFrame } from './deviceFrame'
import { possessive } from './screenNaming'
import ScreensInOrder from './ScreensInOrder.vue'
import ScreensLoading from './ScreensLoading.vue'

const route = useRoute()
const { device, name } = useDeviceFrame()
const devices = useDevices()
const alerts = useAlerts()

const screens = useLoad(() => listScreens(String(route.params.deviceId)), { key: () => route.params.deviceId, fresh: true })

const failure = computed(() => device.failure ?? screens.failure)
const firingHere = computed(() => alerts.data?.active.filter(alert => alert.deviceId === route.params.deviceId) ?? [])
const listed = computed(() => devices.data?.find(summary => summary.id === route.params.deviceId))

function reload() {
  void device.reload()
  void screens.reload()
}
</script>

<template>
  <Notice
    v-if="failure"
    class="failed"
    :title="`Could not load ${possessive(name)} Screens.`"
    :reason="failure.reason"
    action="Try again"
    @act="reload"
  />
  <template v-if="device.data && screens.data">
    <CurrentScreenHero :device="device.data" :screens="screens.data" :alerts="firingHere" />
    <ScreensInOrder :device="device.data" :screens="screens.data" :reload="screens.reload" />
  </template>
  <ScreensLoading v-else-if="!failure" :device-name="name" :waiting="device.waiting || screens.waiting" :device-model="listed?.deviceModel" />
</template>

<style scoped>
@layer components {
  .failed {
    margin-top: var(--space-6);
  }
}
</style>
