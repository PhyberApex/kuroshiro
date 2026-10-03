<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'

withDefaults(defineProps<{
  text: string
  /** Holds the tooltip open or shut. Left out, it opens on hover and on keyboard focus. */
  open?: boolean
}>(), {
  open: undefined,
})

const HOVER_DELAY_MS = 400

// Reka reads the layer off the content and puts it on the positioned wrapper it draws around it.
const LAYER = { zIndex: 'var(--layer-popover)' }
</script>

<template>
  <TooltipProvider :delay-duration="HOVER_DELAY_MS">
    <TooltipRoot :open="open">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :aria-label="text"
          :side-offset="6"
          :collision-padding="8"
          :style="LAYER"
        >
          <span class="tooltip">{{ text }}</span>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<style scoped>
@layer components {
  .tooltip {
    display: block;
    max-width: min(20rem, calc(100vw - var(--space-4)));
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius);
    background: var(--color-ink);
    color: var(--color-paper);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    overflow-wrap: anywhere;
  }
}
</style>
