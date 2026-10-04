<script setup lang="ts">
import AddFormFoot from '@/patterns/AddFormFoot.vue'
import { useAddPluginPage } from './addPluginPage'

defineProps<{
  /** The name of the way's primary button, which submits the form the foot stands in: "Create Plugin". */
  button: string
  /** The Plugin is being added: the button shows the loading mark. */
  running: boolean
  /** Whether the form holds something that leaving would lose. False again once the Plugin is added. */
  changed: boolean
  /** Why nothing was added, as a sentence: "Not created. That Device does not exist." */
  failure?: string
}>()

defineSlots<{
  /** The one line under the buttons: what the admin should know before adding. */
  default: () => unknown
}>()

const { cancelTo } = useAddPluginPage()
</script>

<template>
  <AddFormFoot :button="button" :running="running" :changed="changed" :failure="failure" :cancel-to="cancelTo">
    <slot />
    <template #lost>
      What you entered for the new Plugin.
    </template>
  </AddFormFoot>
</template>
