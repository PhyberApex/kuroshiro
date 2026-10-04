<script setup lang="ts">
import { computed, ref } from 'vue'
import { isRefusal } from '@/api/client'
import { unassignPlugin } from '@/api/screens'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { unassignWording } from './pluginDevices'
import { usePluginPage } from './pluginPage'

const props = defineProps<{
  device: { id: string, name: string }
}>()

defineEmits<{
  /** The Plugin is off the Device. */
  unassigned: []
}>()

const { plugin } = usePluginPage()

const asking = ref(false)
const wording = computed(() => unassignWording(plugin.value, props.device.name))

function unassign() {
  return unassignPlugin(plugin.value.id, props.device.id).catch((error: unknown) => {
    if (!isRefusal(error, 'assignment-not-found'))
      throw error
  })
}
</script>

<template>
  <Button @click="asking = true">
    Unassign
  </Button>
  <Confirmation v-model:open="asking" :title="wording.title" confirm-label="Unassign Plugin" :action="unassign" @confirmed="$emit('unassigned')">
    <template #lost>
      {{ wording.lost }}
    </template>
    <template #stays>
      {{ wording.stays }}
    </template>
  </Confirmation>
</template>
