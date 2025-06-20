<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useDeviceStore } from '@/stores/device.ts'
import { useScreensStore } from '@/stores/screens.ts'
import { formatDate } from '@/utils/formatDate'

const props = defineProps<{ deviceId: string }>()

const deviceStore = useDeviceStore()
const screensStore = useScreensStore()

const device = computed(() => deviceStore.getById(props.deviceId))

onMounted(async () => {
  if (!device.value)
    return
  await screensStore.fetchCurrentScreenForDevice(device.value.mac, device.value.apikey)
})
const screen = computed(() => screensStore.currentScreen)
</script>

<template>
  <v-card class="mb-6" elevation="1">
    <v-card-title>Current Screen</v-card-title>
    <v-divider />
    <v-card-text>
      <template v-if="screen">
        <v-img :src="screen.image_url" data-test-id="screen-image" />
        <div class="mt-5 text-subtitle-1" data-test-id="screen-rendered-date">
          Generated {{ screen.rendered_at ? formatDate(screen.rendered_at) : "???" }}
        </div>
      </template>
      <template v-else>
        <div class="text-subtitle-1" data-test-id="no-screen">
          No screen available
        </div>
      </template>
    </v-card-text>
  </v-card>
</template>
