<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
</script>

<template>
  <CollapsibleRoot>
    <CollapsibleTrigger class="trigger">
      Details
    </CollapsibleTrigger>
    <CollapsibleContent>
      <p>Polled 4 min ago</p>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<style scoped>
@layer components {
  .trigger {
    padding: var(--space-2) var(--space-3);
    border: var(--rule-control);
    border-radius: var(--radius);
  }
}
</style>
