<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import { pluginPath } from './pluginPaths'

defineProps<{
  plugin: { id: string, name: string }
}>()
</script>

<template>
  <EmptyState class="not-from-recipe" title="Not from a Recipe" heading="h3">
    {{ plugin.name }} was not imported from a Recipe, so there is nothing to check.
    <template #action>
      <Button as-child>
        <RouterLink :to="pluginPath(plugin.id)">
          Back to {{ plugin.name }}
        </RouterLink>
      </Button>
    </template>
  </EmptyState>
</template>

<style scoped>
@layer components {
  /* It stands under the section's heading, which already draws the heavy rule. */
  .not-from-recipe {
    padding-top: 0;
    border-top: 0;
  }
}
</style>
