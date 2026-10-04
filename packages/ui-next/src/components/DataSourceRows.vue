<script setup lang="ts">
import { AccordionRoot } from 'reka-ui'

defineSlots<{
  /** One `DataSourceRow` per Data Source. */
  default: () => unknown
}>()

/** The `value` of the opened row. One row is open at a time. */
const open = defineModel<string>('open')
</script>

<template>
  <AccordionRoot v-model="open" as-child type="single" collapsible>
    <ul class="data-source-rows">
      <slot />
    </ul>
  </AccordionRoot>
</template>

<style scoped>
@layer components {
  .data-source-rows {
    border-top: var(--rule);
  }
}
</style>
