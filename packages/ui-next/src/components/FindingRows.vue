<script setup lang="ts">
import { AccordionRoot } from 'reka-ui'

defineSlots<{
  /** One `FindingRow` per group of findings. */
  default: () => unknown
}>()

/** The `value` of the opened row. One row is open at a time. */
const open = defineModel<string>('open')
</script>

<template>
  <AccordionRoot v-model="open" as-child type="single" collapsible>
    <ul class="finding-rows">
      <slot />
    </ul>
  </AccordionRoot>
</template>
