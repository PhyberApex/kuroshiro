<script setup lang="ts">
import type { FirmwareCatchUp } from 'kuroshiro-shared'
import { ref } from 'vue'
import { catchUpFirmware, previewCatchUp } from '@/api/firmware'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { failureReason } from '@/components/failureReason'
import { catchUpOutcome, catchUpWording } from './firmwareWording'

const emit = defineEmits<{
  /** The catch-up ran: what it came to, as a sentence. */
  caughtUp: [outcome: string]
  /** Who is behind could not be read: why, as a sentence. */
  failed: [reason: string]
}>()

const asking = ref(false)
const looking = ref(false)
const preview = ref<FirmwareCatchUp>()

/** Reads who is behind first, so the confirmation can name them. */
async function open() {
  looking.value = true
  try {
    preview.value = await previewCatchUp()
    asking.value = true
  }
  catch (error) {
    emit('failed', failureReason(error) ?? 'That did not work.')
  }
  finally {
    looking.value = false
  }
}

async function catchUp() {
  emit('caughtUp', catchUpOutcome(await catchUpFirmware()))
}
</script>

<template>
  <Button :loading="looking" @click="open">
    Catch up now
  </Button>
  <Confirmation
    v-if="preview"
    v-model:open="asking"
    :title="catchUpWording(preview).title"
    confirm-label="Catch up now"
    :action="preview.assigned.length > 0 ? catchUp : undefined"
  >
    {{ catchUpWording(preview).says }}
  </Confirmation>
</template>
