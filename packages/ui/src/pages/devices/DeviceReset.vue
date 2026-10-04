<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { ref } from 'vue'
import { updateDevice } from '@/api/devices'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { useNow } from '@/patterns/useNow'
import { nextPollTime } from './currentScreenStory'
import { useDeviceFrame } from './deviceFrame'

const props = defineProps<{
  device: DeviceDetail
}>()

const frame = useDeviceFrame()
const now = useNow()
const asking = ref(false)

const reset = () => updateDevice(props.device.id, { resetDevice: true })

function whenItErases() {
  const around = nextPollTime(props.device, now.value)
  return around ? `At its next poll, around ${around},` : 'At its next poll,'
}
</script>

<template>
  <Button :disabled="device.pending.deviceReset || device.isProxied" @click="asking = true">
    Device Reset
  </Button>
  <Confirmation v-model:open="asking" :title="`Reset ${device.name}?`" confirm-label="Device Reset" :action="reset" @confirmed="frame.device.reload()">
    {{ whenItErases() }} {{ device.name }} erases what it has stored and restarts into Wi-Fi setup. You need to be at the Device afterwards and enter the Wi-Fi and this server's URL again.
    <template #lost>
      On the Device: its Wi-Fi credentials, its API key and this server's URL.
    </template>
    <template #stays>
      Everything here: {{ device.name }}, its Screens, Schedules and Device Log. It gets the same API key back.
    </template>
  </Confirmation>
</template>
