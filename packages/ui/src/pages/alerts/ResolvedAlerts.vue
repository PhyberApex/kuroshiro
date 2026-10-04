<script setup lang="ts">
import type { AlertSummary } from 'kuroshiro-shared'
import type { AlertTold } from './alertWording'
import { useId } from 'vue'
import AlertRow from './AlertRow.vue'

defineProps<{
  /** The Alerts that resolved in the last 7 days, newest first, as the server caps them. */
  alerts: AlertSummary[]
  told: AlertTold
}>()

/** How many resolved Alerts the server answers at most; a list this long may have left older ones out. */
const MOST_RESOLVED_ANSWERED = 50

const headingId = useId()
</script>

<template>
  <section class="resolved-alerts" :aria-labelledby="headingId">
    <header class="head">
      <h2 :id="headingId" class="heading">
        Resolved in the last 7 days
      </h2>
      <p v-if="alerts.length > 0" class="order">
        newest first
      </p>
    </header>
    <ul v-if="alerts.length > 0" :aria-labelledby="headingId">
      <AlertRow v-for="alert in alerts" :key="alert.id" :alert="alert" :told="told" />
    </ul>
    <p v-else class="aside">
      Nothing resolved in the last 7 days.
    </p>
    <p v-if="alerts.length >= MOST_RESOLVED_ANSWERED" class="aside">
      The 50 most recent.
    </p>
  </section>
</template>

<style scoped>
@layer components {
  .resolved-alerts {
    margin-top: var(--space-10);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
  }

  .heading {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
  }

  .order,
  .aside {
    color: var(--color-ink-soft);
  }

  .order {
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  .aside {
    margin-top: var(--space-3);
  }
}
</style>
