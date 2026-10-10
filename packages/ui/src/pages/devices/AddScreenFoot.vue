<script setup lang="ts">
import AddFormFoot from '@/patterns/AddFormFoot.vue'
import { useDeviceFrame } from './deviceFrame'

withDefaults(defineProps<{
  button?: string
  /** The Screen is being added: the button shows the loading mark. */
  running: boolean
  /** The form cannot be sent yet: a Mashup with an empty slot. */
  disabled?: boolean
  /** Whether the form holds something that leaving would lose. False again once the Screen is added. */
  changed: boolean
  /** Why no Screen was added, as a sentence: "Not added. That Device does not exist." */
  failure?: string
  /** Whether this form asks "Leave without saving?" on its own. False on Add Screen, where the page holds one guard for every kind's form. */
  guarded?: boolean
}>(), {
  button: 'Add Screen',
  guarded: true,
})

const { path } = useDeviceFrame()
</script>

<template>
  <AddFormFoot :button="button" :running="running" :disabled="disabled" :changed="changed" :failure="failure" :cancel-to="path" :guarded="guarded">
    Joins the end of the Order, always shown until you give it a Schedule.
    <template #lost>
      What you entered for the new Screen.
    </template>
  </AddFormFoot>
</template>
