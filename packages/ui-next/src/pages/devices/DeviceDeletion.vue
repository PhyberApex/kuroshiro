<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { deleteDevice } from '@/api/devices'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { useDevices } from '@/reads/sharedReads'
import { screensCounted } from './deviceSettings'

const props = defineProps<{
  device: DeviceDetail
}>()

const router = useRouter()
const devices = useDevices()
const asking = ref(false)

/** The landing route decides by the Devices where it leads, so they are read again before it opens. */
async function remove() {
  await deleteDevice(props.device.id)
  await devices.reload()
}
</script>

<template>
  <Button @click="asking = true">
    Delete {{ device.name }}
  </Button>
  <Confirmation v-model:open="asking" :title="`Delete ${device.name}?`" :confirm-label="`Delete ${device.name}`" :action="remove" @confirmed="router.push('/')">
    <template #lost>
      {{ device.name }}, its {{ screensCounted(device.screenCount) }} with their Schedules, and its Device Log.
    </template>
    <template #stays>
      Your Plugins. The Device itself keeps working until it next polls and is then registered again as a new Device.
    </template>
  </Confirmation>
</template>
