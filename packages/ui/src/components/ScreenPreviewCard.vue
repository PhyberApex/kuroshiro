<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { VCard, VCardText, VCardTitle, VDivider, VImg } from 'vuetify/components'
import { useDeviceStore } from '@/stores/device.ts'
import { useScreensStore } from '@/stores/screens.ts'
import { cacheBustedUrl } from '@/utils/cacheBustedUrl'
import { deviceRenderSize } from '@/utils/deviceRenderSize'
import { formatDate } from '@/utils/formatDate'

const props = defineProps<{ deviceId: string }>()

const deviceStore = useDeviceStore()
const screensStore = useScreensStore()

const device = computed(() => deviceStore.getById(props.deviceId))
const renderSize = computed(() => deviceRenderSize(device.value))

onMounted(async () => {
  if (!device.value)
    return
  await screensStore.fetchCurrentScreenForDevice(device.value.mac, device.value.apikey)
})
const screen = computed(() => screensStore.currentScreen)
const cacheBustedImageUrl = computed(() => screen.value ? cacheBustedUrl(screen.value.image_url, screen.value.rendered_at) : undefined)
</script>

<template>
  <VCard class="mb-6" elevation="1">
    <VCardTitle>Current Screen</VCardTitle>
    <VDivider />
    <VCardText>
      <template v-if="screen">
        <VImg
          :src="cacheBustedImageUrl"
          :aspect-ratio="renderSize.width / renderSize.height"
          alt="Current device screen display"
          data-test-id="screen-image"
        />
        <div class="mt-5 text-subtitle-1" data-test-id="screen-rendered-date">
          Generated {{ screen.rendered_at ? formatDate(screen.rendered_at) : "???" }}
        </div>
      </template>
      <template v-else>
        <div class="text-body-2 text-medium-emphasis" data-test-id="no-screen">
          No screen available.
        </div>
      </template>
    </VCardText>
  </VCard>
</template>
