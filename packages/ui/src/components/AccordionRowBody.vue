<script setup lang="ts">
import { AccordionContent } from 'reka-ui'

/**
 * The body of an accordion row: what the row opens, folded and unfolded under its line. The
 * row styles `.inside` (its padding) with `:deep`.
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
