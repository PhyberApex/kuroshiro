<script setup lang="ts" generic="T extends string">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import Icon from './Icon.vue'

export interface Segment<T extends string> {
  value: T
  label: string
  disabled?: boolean
  /** Puts the problem mark on the segment; the text says what is wrong and is read out with the label. */
  problem?: string
  /** Strikes the label through and says "(removed)" with it: what the segment stands for goes with the next save. It can still be chosen. */
  removed?: boolean
}

defineProps<{
  segments: Segment<T>[]
  disabled?: boolean
  /** For the gallery: the states held still on a segment, by its value, such as `{ problems: 'hover' }`. */
  force?: Partial<Record<T, string>>
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <RadioGroupRoot
    class="segments"
    :model-value="model"
    :disabled="disabled"
    @update:model-value="model = $event as T"
  >
    <RadioGroupItem
      v-for="segment in segments"
      :key="segment.value"
      class="segment"
      :value="segment.value"
      :disabled="segment.disabled"
      :data-force="force?.[segment.value]"
    >
      <span class="label" :class="{ removed: segment.removed }">{{ segment.label }}<span v-if="segment.removed" class="visually-hidden">(removed)</span></span>
      <Icon v-if="segment.problem" name="problem" :label="segment.problem" />
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<style scoped>
@layer components {
  .segments {
    display: inline-flex;
    max-width: 100%;
    border: 1px solid var(--color-ink);
    border-radius: var(--radius);
  }

  .segment {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: calc(var(--control-height) - 2px);
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    transition:
      background-color var(--duration-quick) var(--ease-out),
      color var(--duration-quick) var(--ease-out);
  }

  .removed {
    text-decoration: line-through;
  }

  .segment + .segment {
    border-left: 1px solid var(--color-ink);
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the segment. */
  .segment:not(:disabled, [aria-checked='true']):is(:hover, [data-force~='hover']) {
    background: var(--color-wash);
  }

  .segment[aria-checked='true'] {
    background: var(--color-ink);
    color: var(--color-paper);
    font-weight: var(--weight-semibold);
  }

  /* The ring of a segment in the middle would otherwise be painted over by the next one. */
  .segment:is(:focus-visible, [data-force~='focus']) {
    position: relative;
    z-index: 1;
  }

  .segment:disabled {
    color: var(--color-ink-soft);
    cursor: default;
  }

  .segment[aria-checked='true']:disabled {
    background: var(--color-line);
    color: var(--color-ink);
  }

  .segments[data-disabled],
  .segments[data-disabled] .segment + .segment {
    border-color: var(--color-line);
  }
}
</style>
