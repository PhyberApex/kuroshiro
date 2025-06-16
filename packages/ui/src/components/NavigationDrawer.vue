<script setup lang="ts">
import {
  mdiCircle,
  mdiCodeBlockTags,
  mdiCog,
  mdiMonitor,
  mdiRobot,
  mdiToolbox,
  mdiViewDashboard,
} from '@mdi/js'
import { computed } from 'vue'
import { useDeviceStore } from '@/stores/device'
import { isDeviceOnline } from '@/utils/isDeviceOnline'

const deviceStore = useDeviceStore()

const devices = computed(() => deviceStore.devices)
</script>

<template>
  <v-list>
    <v-list density="compact" nav>
      <v-list-item :prepend-icon="mdiViewDashboard" title="Overview" :to="{ name: 'overview' }" data-test-id="nav-overview" />
      <v-divider />
      <v-list-group data-test-id="nav-devices-group">
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            :prepend-icon="mdiMonitor"
            title="Devices"
          />
        </template>
        <v-list-item
          v-if="devices.length === 0"
          title="No devices yet"
        />
        <v-list-item
          v-for="device in devices" :key="device.id"
          :title="device.name"
          :to="{ name: 'device', params: { id: device.id } }"
          :data-test-id="`nav-device-${device.id}`"
        >
          <template #append>
            <v-icon
              :icon="mdiCircle"
              :color="isDeviceOnline(device) ? 'success' : 'error'"
              size="x-small"
            />
          </template>
        </v-list-item>
      </v-list-group>
      <v-list-group>
        <template #activator="{ props }">
          <v-list-item
            v-bind="props"
            :prepend-icon="mdiToolbox"
            title="Tools"
          />
        </template>
        <v-list-item :prepend-icon="mdiRobot" title="Virtual Device" :to="{ name: 'virtualDevice' }" />
        <v-list-item :prepend-icon="mdiCodeBlockTags" title="HTML Preview" :to="{ name: 'htmlPreview' }" />
      </v-list-group>
      <v-list-item :prepend-icon="mdiCog" title="Maintenance" :to="{ name: 'maintenance' }" />
    </v-list>
  </v-list>
</template>

<style scoped>

</style>
