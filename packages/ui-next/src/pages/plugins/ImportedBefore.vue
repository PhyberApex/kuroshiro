<script setup lang="ts">
import type { PluginSummary } from 'kuroshiro-shared'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { importedBefore } from './importPlugin'

const props = defineProps<{
  /** The Plugins that came from the Recipe in the field. None, and the line waits empty. */
  plugins: PluginSummary[]
}>()

const parts = computed(() => importedBefore(props.plugins))
</script>

<template>
  <p class="imported-before" role="status">
    <template v-if="parts.length">
      <Icon name="problem" class="mark" />
      <span>
        <template v-for="(part, index) in parts" :key="index">
          <RouterLink v-if="part.to" class="plugin" :to="part.to">{{ part.text }}</RouterLink>
          <template v-else>{{ part.text }}</template>
        </template>
      </span>
    </template>
  </p>
</template>

<style scoped>
@layer components {
  .imported-before {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-weight: var(--weight-medium);
  }

  .mark {
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .plugin {
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .plugin:hover {
    color: var(--color-ink-hover);
  }
}
</style>
