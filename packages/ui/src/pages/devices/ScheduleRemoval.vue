<script setup lang="ts">
import { ref } from 'vue'
import { removeSchedule } from '@/api/screens'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { possessive } from './screenNaming'

defineProps<{
  screenId: string
  screenName: string
}>()

defineEmits<{
  /** The Screen has no Schedule any more. */
  removed: []
}>()

const asking = ref(false)
</script>

<template>
  <Button variant="quiet" @click="asking = true">
    Remove Schedule
  </Button>
  <Confirmation
    v-model:open="asking"
    :title="`Remove ${possessive(screenName)} Schedule?`"
    confirm-label="Remove Schedule"
    :action="() => removeSchedule(screenId)"
    @confirmed="$emit('removed')"
  >
    To keep the days and hours and only stop showing it, switch the Schedule off instead.
    <template #lost>
      Its days, hours and dates.
    </template>
    <template #stays>
      {{ screenName }} itself, which is then always shown.
    </template>
  </Confirmation>
</template>
