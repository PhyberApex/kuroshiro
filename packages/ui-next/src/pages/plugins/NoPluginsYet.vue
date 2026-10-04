<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import { addPluginPath } from './pluginPaths'
</script>

<template>
  <EmptyState title="No Plugins yet">
    A Plugin fetches data and renders it with a template, for a Device to show as a Screen. Import one as a Recipe from TRMNL, or build your own.
    <template #action>
      <span class="choices">
        <Button as-child variant="primary">
          <RouterLink :to="addPluginPath('recipe')">
            Import a Recipe
          </RouterLink>
        </Button>
        <Button as-child>
          <RouterLink :to="addPluginPath('poll')">
            Build a Plugin
          </RouterLink>
        </Button>
      </span>
    </template>
  </EmptyState>
</template>

<style scoped>
@layer components {
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}
</style>
