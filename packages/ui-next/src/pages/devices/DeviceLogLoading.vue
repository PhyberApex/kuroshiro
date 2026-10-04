<script setup lang="ts">
import LoadingLine from '@/patterns/LoadingLine.vue'
import WashBar from '@/patterns/WashBar.vue'
import { possessive } from './screenNaming'

defineProps<{
  deviceName: string
  /** Whether the answer has taken long enough for the loading state to show. */
  waiting: boolean
}>()

const MESSAGE_WIDTHS = ['46%', '38%', '62%', '30%', '52%']
</script>

<template>
  <div class="log-loading">
    <LoadingLine :shown="waiting">
      Loading {{ possessive(deviceName) }} Logs
    </LoadingLine>
    <div v-if="waiting" class="lines" aria-hidden="true">
      <div v-for="width in MESSAGE_WIDTHS" :key="width" class="line">
        <WashBar width="3.5rem" />
        <WashBar width="2.5rem" />
        <WashBar :width="width" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .log-loading {
    margin-top: var(--space-4);
  }

  .lines {
    margin-top: var(--space-2);
    border-top: var(--rule-heavy);
  }

  .line {
    display: grid;
    grid-template-columns: 5rem 3.75rem minmax(0, 1fr);
    gap: var(--space-3);
    align-items: center;
    min-height: var(--hit-target);
    border-bottom: var(--rule);
  }

  @media (max-width: 820px) {
    .line {
      grid-template-columns: 4rem 3.75rem minmax(0, 1fr);
      gap: var(--space-2);
    }
  }
}
</style>
