<script setup lang="ts">
import { AccordionHeader, AccordionTrigger } from 'reka-ui'

/** The heading of an accordion row: its default slot is the button that opens the row. */
defineProps<{
  /** The heading level, by where the row's list sits in the page's outline. */
  heading: 'h2' | 'h3' | 'h4'
}>()

defineSlots<{
  default: () => unknown
}>()
</script>

<template>
  <AccordionHeader as-child>
    <component :is="heading" class="heading">
      <AccordionTrigger as-child>
        <slot />
      </AccordionTrigger>
    </component>
  </AccordionHeader>
</template>
