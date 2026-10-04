<script setup lang="ts">
import { recipePage } from './recipeUpdate'

/** A Recipe in a sentence: its name, then its id in mono, as one link to its page on trmnl.com when `linked`. */
defineProps<{
  recipe: { id: string, name: string | null }
  linked?: boolean
}>()
</script>

<template>
  <component :is="linked ? 'a' : 'span'" :href="linked ? recipePage(recipe.id) : undefined" class="recipe-name" :class="{ linked }">
    <template v-if="recipe.name">
      {{ recipe.name }}{{ ' ' }}
    </template><code class="id">{{ recipe.id }}</code>
  </component>
</template>

<style scoped>
@layer components {
  .linked {
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .linked:hover {
    color: var(--color-ink-hover);
  }

  .id {
    font-family: var(--font-mono);
    font-size: 0.92em;
  }
}
</style>
