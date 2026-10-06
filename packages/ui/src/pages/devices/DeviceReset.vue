<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { ref, watch } from 'vue'
import { updateDevice } from '@/api/devices'
import Button from '@/components/Button.vue'
import Checkbox from '@/components/Checkbox.vue'
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
const newApikey = ref(false)

watch(asking, (isOpen) => {
  if (isOpen)
    newApikey.value = false
})

const reset = () => updateDevice(props.device.id, newApikey.value ? { resetDevice: true, resetDeviceNewApikey: true } : { resetDevice: true })

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
      Everything here: {{ device.name }}, its Screens, Schedules and Device Log. {{ newApikey ? 'It gets a new API key when it is set up again.' : 'It gets the same API key back.' }}
    </template>
    <template #extra>
      <Checkbox v-model="newApikey">
        Also give {{ device.name }} a new API key
      </Checkbox>
    </template>
  </Confirmation>
</template>
