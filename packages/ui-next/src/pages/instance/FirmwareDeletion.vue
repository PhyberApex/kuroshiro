<script setup lang="ts">
import type { FirmwareRead } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import { deleteFirmware } from '@/api/firmware'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { deletionWording } from './firmwareWording'

const props = defineProps<{
  firmware: FirmwareRead
}>()

defineEmits<{
  deleted: []
}>()

const asking = ref(false)
const wording = computed(() => deletionWording(props.firmware))
</script>

<template>
  <Button :aria-label="`Delete Firmware ${firmware.version}`" @click="asking = true">
    Delete
  </Button>
  <Confirmation
    v-model:open="asking"
    :title="wording.title"
    confirm-label="Delete Firmware"
    :action="() => deleteFirmware(firmware.id)"
    @confirmed="$emit('deleted')"
  >
    <template v-if="wording.happens" #default>
      {{ wording.happens }}
    </template>
    <template #lost>
      {{ wording.lost }}
    </template>
    <template #stays>
      {{ wording.stays }}
    </template>
  </Confirmation>
</template>
