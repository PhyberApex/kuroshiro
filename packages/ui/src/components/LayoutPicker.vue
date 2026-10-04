<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { DRAWING, drawLayout } from './layoutDrawing'

export interface PickableLayout {
  id: string
  /** The layout in words, such as "One left, two right". */
  name: string
  slotCount: number
}

defineProps<{
  layouts: PickableLayout[]
  /** For the gallery: the states held still on a layout, by its id, such as `{ '2x2': 'hover' }`. */
  force?: Record<string, string>
}>()

const model = defineModel<string>()
</script>

<template>
  <RadioGroupRoot
    class="layouts"
    :model-value="model"
    @update:model-value="model = $event as string"
  >
    <RadioGroupItem
      v-for="layout in layouts"
      :key="layout.id"
      class="layout"
      :value="layout.id"
      :data-force="force?.[layout.id]"
    >
      <svg
        class="drawing"
        :viewBox="`0 0 ${DRAWING.width} ${DRAWING.height}`"
        :stroke-width="DRAWING.stroke"
        aria-hidden="true"
      >
        <rect v-for="(slot, index) in drawLayout(layout.id, layout.slotCount)" :key="index" v-bind="slot" />
      </svg>
      {{ layout.name }}
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<style scoped>
@layer components {
  .layouts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
    gap: var(--space-2);
  }

  .layout {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-1) var(--space-2);
    border: var(--rule-control);
    border-radius: var(--radius);
    color: var(--color-ink-soft);
    font-size: var(--text-xs);
    line-height: 1.2;
    text-align: center;
    transition:
      background-color var(--duration-quick) var(--ease-out),
      border-color var(--duration-quick) var(--ease-out),
      color var(--duration-quick) var(--ease-out);
  }

  .drawing {
    width: 3.75rem;
    height: 2.25rem;
    fill: none;
    stroke: currentColor;
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the layout. */
  .layout:is(:hover, [data-force~='hover']) {
    border-color: var(--color-ink);
    background: var(--color-wash);
    color: var(--color-ink);
  }

  .layout[aria-checked='true'] {
    border-color: var(--color-ink);
    box-shadow: inset 0 0 0 1px var(--color-ink);
    color: var(--color-ink);
    font-weight: var(--weight-semibold);
  }
}
</style>
