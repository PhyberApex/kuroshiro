<script setup lang="ts">
import type { RecipeSort } from 'kuroshiro-shared'
import type { SelectOption } from '@/components/selectOption'
import { useId } from 'vue'
import SearchField from '@/components/SearchField.vue'
import Select from '@/components/Select.vue'
import { SORT_OPTIONS } from './recipeGallery'

defineProps<{
  /** "Every category" and TRMNL's categories; none, and the Category select is left out. */
  categories: SelectOption[]
  /** What is typed is too short to search for. */
  tooShort: boolean
}>()

/** What stands in the search field, as it is typed. */
const search = defineModel<string>('search', { required: true })
const category = defineModel<string>('category', { required: true })
const sort = defineModel<RecipeSort>('sort', { required: true })

const hintId = useId()
</script>

<template>
  <div class="gallery-bar">
    <div class="search">
      <SearchField v-model="search" aria-label="Search Recipes" placeholder="Search Recipes" :aria-describedby="tooShort ? hintId : undefined" />
      <p v-if="tooShort" :id="hintId" class="hint">
        A search needs three characters.
      </p>
    </div>
    <Select
      v-if="categories.length > 1"
      class="choice"
      :model-value="category"
      :options="categories"
      aria-label="Category"
      @update:model-value="chosen => chosen && (category = chosen)"
    />
    <Select
      class="choice"
      :model-value="sort"
      :options="SORT_OPTIONS"
      aria-label="Order"
      @update:model-value="chosen => chosen && (sort = chosen)"
    />
  </div>
</template>

<style scoped>
@layer components {
  .gallery-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-3);
    margin-top: var(--space-6);
  }

  .search {
    flex: 1 1 14rem;
    max-width: 22rem;
  }

  .hint {
    padding-top: var(--space-1);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .choice {
    flex: 0 1 12rem;
  }

  @media (max-width: 820px) {
    .gallery-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .search,
    .choice {
      flex: none;
      max-width: none;
    }
  }
}
</style>
