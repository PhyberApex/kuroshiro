<script setup lang="ts">
import {
  mdiCircle,
  mdiCodeBlockTags,
  mdiCog,
  mdiMonitor,
  mdiRobot,
  mdiViewDashboard,
} from '@mdi/js'
import { computed } from 'vue'
import { VDivider, VIcon, VList, VListGroup, VListItem } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device'
import { isDeviceOnline } from '@/utils/isDeviceOnline'

const deviceStore = useDeviceStore()

const devices = computed(() => deviceStore.devices)
</script>

<template>
  <VList>
    <VList density="compact" nav>
      <VListItem :prepend-icon="mdiViewDashboard" title="Overview" :to="{ name: 'overview' }" data-test-id="nav-overview" />
      <VDivider />
      <VListGroup data-test-id="nav-devices-group">
        <template #activator="{ props }">
          <VListItem
            v-bind="props"
            :prepend-icon="mdiMonitor"
            title="Devices"
          />
        </template>
        <VListItem
          v-if="devices.length === 0"
          title="No devices yet"
          subtitle="Add one from Overview"
          disabled
        />
        <VListItem
          v-for="device in devices" :key="device.id"
          :title="device.name"
          :to="{ name: 'device', params: { id: device.id } }"
          :data-test-id="`nav-device-${device.id}`"
        >
          <template #append>
            <VIcon
              :icon="mdiCircle"
              :color="isDeviceOnline(device) ? 'success' : 'error'"
              size="x-small"
            />
          </template>
        </VListItem>
      </VListGroup>
      <VListItem :prepend-icon="mdiRobot" title="Virtual Device" :to="{ name: 'virtualDevice' }" />
      <VListItem :prepend-icon="mdiCodeBlockTags" title="HTML Preview" :to="{ name: 'htmlPreview' }" />
      <VListItem :prepend-icon="mdiCog" title="Maintenance" :to="{ name: 'maintenance' }" />
    </VList>
  </VList>
</template>

<style scoped>

</style>
