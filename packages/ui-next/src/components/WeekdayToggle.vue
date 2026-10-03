<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

/** A weekday as a Schedule holds it: 0 is Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

defineProps<{
  disabled?: boolean
  /** For the gallery: the states held still on a day, such as `{ 3: 'hover' }`. */
  force?: Partial<Record<Weekday, string>>
}>()

const model = defineModel<Weekday[]>({ default: () => [] })

const MONDAY_FIRST: { weekday: Weekday, letter: string, name: string }[] = [
  { weekday: 1, letter: 'M', name: 'Monday' },
  { weekday: 2, letter: 'T', name: 'Tuesday' },
  { weekday: 3, letter: 'W', name: 'Wednesday' },
  { weekday: 4, letter: 'T', name: 'Thursday' },
  { weekday: 5, letter: 'F', name: 'Friday' },
  { weekday: 6, letter: 'S', name: 'Saturday' },
  { weekday: 0, letter: 'S', name: 'Sunday' },
]

function choose(weekdays: Weekday[]) {
  model.value = [...weekdays].sort((a, b) => a - b)
}
</script>

<template>
  <ToggleGroupRoot
    type="multiple"
    class="days"
    :model-value="model"
    :disabled="disabled"
    @update:model-value="choose($event as Weekday[])"
  >
    <ToggleGroupItem
      v-for="day in MONDAY_FIRST"
      :key="day.weekday"
      class="day"
      :value="day.weekday"
      :aria-label="day.name"
      :data-force="force?.[day.weekday]"
    >
      {{ day.letter }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>

<style scoped>
@layer components {
  .days {
    display: inline-flex;
    gap: var(--space-1);
  }

  .day {
    width: 2rem;
    height: 2rem;
    border: var(--rule-control);
    border-radius: var(--radius);
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-align: center;
    transition:
      background-color var(--duration-quick) var(--ease-out),
      border-color var(--duration-quick) var(--ease-out),
      color var(--duration-quick) var(--ease-out);
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the day. */
  .day:not(:disabled):is(:hover, [data-force~='hover']) {
    border-color: var(--color-ink);
    background: var(--color-wash);
    color: var(--color-ink);
  }

  .day[aria-pressed='true'] {
    border-color: var(--color-ink);
    background: var(--color-ink);
    color: var(--color-paper);
    font-weight: var(--weight-medium);
  }

  .day[aria-pressed='true']:not(:disabled):is(:hover, [data-force~='hover']) {
    border-color: var(--color-ink-hover);
    background: var(--color-ink-hover);
    color: var(--color-paper);
  }

  .day:disabled {
    border-color: var(--color-line);
    cursor: default;
  }

  .day[aria-pressed='true']:disabled {
    background: var(--color-line);
    color: var(--color-ink);
  }

  @media (pointer: coarse) {
    .day {
      width: 2.5rem;
      height: var(--hit-target);
    }
  }
}
</style>
