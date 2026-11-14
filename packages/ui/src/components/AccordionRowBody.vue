<script setup lang="ts">
import { AccordionContent } from 'reka-ui'

/**
 * The body of an accordion row: what the row opens, folded and unfolded under its line. A row
 * sets its own padding by giving `.row-body` a `--row-inside`.
 */
defineSlots<{
  default: () => unknown
}>()
</script>

<template>
  <AccordionContent as-child>
    <div class="body row-body">
      <div class="inside">
        <slot />
      </div>
    </div>
  </AccordionContent>
</template>

<style scoped>
.inside {
  padding: var(--row-inside);
}
</style>
