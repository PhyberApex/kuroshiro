<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { ref } from 'vue'
import { regenerateApikey } from '@/api/devices'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { useDeviceFrame } from './deviceFrame'

const props = defineProps<{
  device: DeviceDetail
}>()

const emit = defineEmits<{
  /** The Device has been read again with its new API key. */
  regenerated: []
}>()

const frame = useDeviceFrame()
const asking = ref(false)

const regenerate = () => regenerateApikey(props.device.id)

async function showNewKey() {
  await frame.device.reload()
  emit('regenerated')
}
</script>

<template>
  <Button @click="asking = true">
    Regenerate now
  </Button>
  <Confirmation v-model:open="asking" :title="`Give ${device.name} a new API key now?`" confirm-label="Regenerate now" :action="regenerate" @confirmed="showNewKey">
    {{ device.name }} stops working at once. Its polls are refused until someone holds its button for 15 seconds and sets it up again. To have it reset itself first, use Device Reset with a new API key instead.
    <template #lost>
      The current API key, everywhere it is used.
    </template>
    <template #stays>
      {{ device.name }}, its Screens, Schedules and Device Log.
    </template>
  </Confirmation>
</template>
