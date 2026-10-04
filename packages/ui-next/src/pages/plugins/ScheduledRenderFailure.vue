<script setup lang="ts">
import type { ScheduledFailure } from './templateData'
import Button from '@/components/Button.vue'
import Icon from '@/components/Icon.vue'

/** What the Template section says while the last scheduled render is a failed one. */
defineProps<{
  failure: ScheduledFailure
  /** The Template that failed is among the form's, so its line can be gone to. */
  reachable: boolean
}>()

defineEmits<{
  /** "Go to line {n}" was pressed. */
  goToLine: [line: number]
}>()
</script>

<template>
  <div class="scheduled-failure">
    <Icon name="problem" class="mark" />
    <p class="said">
      <span class="what">{{ failure.before }}<code class="message">{{ failure.message }}</code>.</span>
      {{ ' ' }}
      <span class="after">The preview draws with the data fetched now, so it may not fail the same way.</span>
    </p>
    <Button v-if="failure.line !== null && reachable" class="go" variant="quiet" @click="$emit('goToLine', failure.line)">
      Go to line {{ failure.line }}
    </Button>
  </div>
</template>

<style scoped>
@layer components {
  /* A problem is ink with the problem icon, between two rules. Nothing here is red. */
  .scheduled-failure {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-1) var(--space-2);
    margin-bottom: var(--space-4);
    padding: var(--space-2) 0;
    border-block: var(--rule);
  }

  .scheduled-failure .mark {
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .said {
    max-width: var(--measure);
    text-wrap: pretty;
  }

  .what {
    font-weight: var(--weight-medium);
  }

  .message {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .after {
    display: block;
    color: var(--color-ink-soft);
  }

  .scheduled-failure .go {
    white-space: nowrap;
  }

  @media (max-width: 820px) {
    .scheduled-failure .go {
      grid-column: 2;
      justify-self: start;
    }
  }
}
</style>
