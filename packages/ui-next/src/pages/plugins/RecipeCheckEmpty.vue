<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import { pluginPath } from './pluginPaths'

/** Where the check ends without anything to choose: its sentence and the way back to the Plugin. */
defineProps<{
  title: string
  plugin: { id: string, name: string }
}>()

defineSlots<{
  default: () => unknown
}>()
</script>

<template>
  <EmptyState class="check-empty" :title="title" heading="h3">
    <slot />
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
  .check-empty {
    padding-top: 0;
    border-top: 0;
  }
}
</style>
