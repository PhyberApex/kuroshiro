<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import PageSection from '@/patterns/PageSection.vue'
import { usePluginPage } from './pluginPage'
import { recipeUpdatePath } from './pluginPaths'
import RecipeName from './RecipeName.vue'
import { recipeDay, recipeTakenOver } from './recipeUpdate'

const { plugin } = usePluginPage()

const recipe = computed(() => plugin.value.recipe!)
const when = computed(() => recipeTakenOver(recipe.value)
  ? `last taken over on ${recipeDay(recipe.value.snapshotTakenAt!)}`
  : `on ${recipeDay(recipe.value.importedAt)}`)
</script>

<template>
  <PageSection id="recipe" title="Recipe">
    <template #actions>
      <Button as-child>
        <RouterLink :to="recipeUpdatePath(plugin.id)">
          Run a Recipe Update Check
        </RouterLink>
      </Button>
    </template>
    <p class="what">
      Imported from the Recipe <RecipeName :recipe="recipe" linked /> on trmnl.com, {{ when }}.
      Nothing updates by itself: a Recipe Update Check downloads the Recipe again and shows what changed before anything is applied.
    </p>
  </PageSection>
</template>

<style scoped>
@layer components {
  .what {
    max-width: var(--measure);
    text-wrap: pretty;
  }
}
</style>
