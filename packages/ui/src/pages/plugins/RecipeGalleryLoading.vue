<script setup lang="ts">
import Plate from '@/components/Plate.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import WashBar from '@/patterns/WashBar.vue'
import RecipeGrid from './RecipeGrid.vue'

defineProps<{
  /** Whether the answer has taken long enough for the loading state to show. */
  waiting: boolean
}>()

const CARDS = 6
</script>

<template>
  <div class="gallery-loading">
    <LoadingLine :shown="waiting">
      Loading Recipes
    </LoadingLine>
    <RecipeGrid v-if="waiting" aria-hidden="true">
      <li v-for="card in CARDS" :key="card" class="card">
        <Plate name="A Recipe" :width="800" :height="480" rendering />
        <WashBar width="60%" />
        <WashBar width="90%" />
        <WashBar width="30%" />
      </li>
    </RecipeGrid>
  </div>
</template>

<style scoped>
@layer components {
  .gallery-loading {
    display: grid;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  .card {
    display: grid;
    gap: var(--space-3);
  }
}
</style>
