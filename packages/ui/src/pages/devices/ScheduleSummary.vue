<script setup lang="ts">
import type { ScheduleRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import { scheduleSummary } from './scheduleSummary'

const props = defineProps<{
  /** The Screen's Schedule. A Screen without one is always shown. */
  schedule: ScheduleRead | null
}>()

const summary = computed(() => props.schedule && scheduleSummary(props.schedule))
</script>

<template>
  <span v-if="summary" class="schedule-summary" :class="{ off: !schedule?.enabled }">
    <span class="visually-hidden">{{ summary.said }}</span>
    <span class="days" aria-hidden="true">
      <span v-for="day in summary.days" :key="day.name" class="day" :class="{ on: day.on }">{{ day.on ? day.letter : '·' }}</span>
    </span>
    <span class="hours" aria-hidden="true">{{ summary.hours }}</span>
  </span>
  <span v-else class="schedule-summary">Always shown</span>
</template>

<style scoped>
@layer components {
  .schedule-summary {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--space-3);
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .days {
    display: inline-flex;
    gap: 0.2em;
    color: var(--color-line);
  }

  .day.on {
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  .hours {
    color: var(--color-ink);
  }

  .schedule-summary.off :is(.days, .hours) {
    text-decoration: line-through;
  }

  .schedule-summary.off :is(.day.on, .hours) {
    color: var(--color-ink-soft);
  }
}
</style>
