<script setup lang="ts">
import type { FindingGroup } from './housekeepingWording'
import { computed } from 'vue'
import { findingLine, openedSentence } from './housekeepingWording'

const props = defineProps<{
  group: FindingGroup
}>()

const lines = computed(() => props.group.findings.map(finding => ({ id: finding.id, ...findingLine(finding) })))
</script>

<template>
  <p class="sentence">
    {{ openedSentence(group) }}
  </p>
  <ul class="held">
    <li v-for="line in lines" :key="line.id" class="item">
      <span class="what" :class="{ path: line.path }">{{ line.what }}</span>{{ ' ' }}<span class="detail">{{ line.detail }}</span>
    </li>
  </ul>
</template>

<style scoped>
@layer components {
  .sentence {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .held {
    display: grid;
    gap: var(--space-1);
    margin-top: var(--space-3);
  }

  .item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-4);
    font-size: var(--text-sm);
  }

  .what {
    overflow-wrap: anywhere;
  }

  .path,
  .detail {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .detail {
    color: var(--color-ink-soft);
    text-align: right;
  }
}
</style>
