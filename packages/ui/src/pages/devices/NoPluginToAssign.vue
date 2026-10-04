<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import { addPluginPath } from '@/pages/plugins/pluginPaths'

defineProps<{
  device: DeviceDetail
}>()
</script>

<template>
  <EmptyState class="no-plugin" title="No Plugins yet" heading="h3">
    A Plugin fetches data and renders it with a template. Import one as a Recipe from TRMNL, or build your own. Either way it is assigned to {{ device.name }} when you save it.
    <template #action>
      <span class="ways">
        <Button as-child variant="primary">
          <RouterLink :to="addPluginPath('recipe', device.id)">
            Import a Recipe
          </RouterLink>
        </Button>
        <Button as-child>
          <RouterLink :to="addPluginPath('poll', device.id)">
            Build a Plugin
          </RouterLink>
        </Button>
      </span>
    </template>
  </EmptyState>
</template>

<style scoped>
@layer components {
  /* The page's own heavy rule stands right above it. */
  .empty-state.no-plugin {
    padding-top: 0;
    border-top: 0;
  }

  .ways {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}
</style>
