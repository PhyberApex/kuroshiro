<script setup lang="ts">
import type { PluginFact } from './pluginPageWording'
import RelativeTime from '@/patterns/RelativeTime.vue'

defineProps<{
  facts: PluginFact[]
}>()
</script>

<template>
  <p class="plugin-facts">
    <template v-for="(fact, index) in facts" :key="fact.text">
      <template v-if="index > 0">
        ·
      </template>
      <span class="fact">{{ fact.text }}<template v-if="fact.at">&nbsp;<RelativeTime :at="fact.at" /></template></span>
    </template>
  </p>
</template>

<style scoped>
@layer components {
  /* The facts belong to the title: they stand closer to it than the title line's own space below. */
  .plugin-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-2);
    margin-top: calc(var(--space-3) - var(--space-6));
    color: var(--color-ink-soft);
  }
}
</style>
