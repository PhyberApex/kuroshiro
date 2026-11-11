<script setup lang="ts">
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'

defineProps<{
  /** What nothing matched, when a search or a category was chosen; left out, trmnl.com published nothing. */
  noMatch?: string
}>()

defineEmits<{
  showEvery: []
  retry: []
}>()
</script>

<template>
  <EmptyState v-if="noMatch" class="gallery-empty" title="No Recipe matches">
    {{ noMatch }}
    <template #action>
      <Button @click="$emit('showEvery')">
        Show every Recipe
      </Button>
    </template>
  </EmptyState>
  <EmptyState v-else class="gallery-empty" title="trmnl.com published no Recipes.">
    <template #action>
      <Button @click="$emit('retry')">
        Try again
      </Button>
    </template>
  </EmptyState>
</template>

<style scoped>
@layer components {
  .gallery-empty {
    margin-top: var(--space-6);
  }
}
</style>
