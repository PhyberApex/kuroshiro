<script setup lang="ts">
import { computed, watch } from 'vue'
import AddScreenCard from '@/components/AddScreenCard.vue'
import DeviceInformationCard from '@/components/DeviceInformationCard.vue'
import DeviceLogsCard from '@/components/DeviceLogsCard.vue'
import ScreenListCard from '@/components/ScreenListCard.vue'
import ScreenPreviewCard from '@/components/ScreenPreviewCard.vue'
import { useDeviceStore } from '@/stores/device'
import { useScreensStore } from '@/stores/screens'

const props = defineProps<{ id: string }>()

const deviceStore = useDeviceStore()
const screensStore = useScreensStore()

const device = computed(() => deviceStore.getById(props.id))

watch(device, () => {
  if (!device.value)
    return
  screensStore.fetchScreensForDevice(device.value.id)
  screensStore.fetchCurrentScreenForDevice(device.value.mac, device.value.apikey)
})
</script>

<template>
  <v-container v-if="device" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="12">
        <v-card class="mb-6" color="primary" variant="tonal" elevation="2">
          <v-card-text>
            <b>Device Details:</b> View and edit device details, manage screens, and access device-specific actions.
          </v-card-text>
        </v-card>
        <v-row>
          <v-col cols="12" sm="12" md="7">
            <DeviceInformationCard :device-id="props.id" />
            <ScreenPreviewCard :device-id="props.id" />
          </v-col>
          <v-col cols="12" sm="12" md="5">
            <AddScreenCard :device-id="props.id" />
            <ScreenListCard :device-id="props.id" />
            <DeviceLogsCard :device-id="props.id" />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
