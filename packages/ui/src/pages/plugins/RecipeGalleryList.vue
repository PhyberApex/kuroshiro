<script setup lang="ts">
import type { PluginSummary, RecipeGalleryPage } from 'kuroshiro-shared'
import type { CarriedDevice } from './addPlugin'
import Button from '@/components/Button.vue'
import RecipeCard from './RecipeCard.vue'
import RecipeGrid from './RecipeGrid.vue'

defineProps<{
  /** Every Recipe loaded so far, as one page. */
  gallery: RecipeGalleryPage
  /** "Showing {n} of {N} Recipes, …". */
  counted: string
  /** The line at the end, once there is nothing more. */
  end: string
  /** The Plugins already imported, by the id of their Recipe. */
  heldBy: Map<string, PluginSummary[]>
  device?: CarriedDevice
  loadingMore: boolean
}>()

defineEmits<{
  more: []
}>()
</script>

<template>
  <p class="counted" role="status">
    {{ counted }}
  </p>
  <RecipeGrid>
    <RecipeCard
      v-for="recipe in gallery.recipes"
      :key="recipe.id"
      :recipe="recipe"
      :held="heldBy.get(recipe.id) ?? []"
      :device="device"
    />
  </RecipeGrid>
  <div class="gallery-foot">
    <Button v-if="gallery.hasMore" :loading="loadingMore" @click="$emit('more')">
      More Recipes
    </Button>
    <p v-else class="end">
      {{ end }}
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .counted {
    display: flex;
    align-items: center;
    min-height: var(--hit-target);
    margin-top: var(--space-2);
    margin-bottom: var(--space-4);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .gallery-foot {
    margin-top: var(--space-8);
    margin-bottom: var(--space-8);
  }

  .end {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
