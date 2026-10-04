<script setup lang="ts">
import type { RecipeUpdatePreview } from 'kuroshiro-shared'
import { computed } from 'vue'
import RecipeName from './RecipeName.vue'
import { placesChanged, updateGroups, updateItemId } from './recipeUpdate'
import RecipeUpdateRow from './RecipeUpdateRow.vue'

/** What a check found: the opening sentence, then the Update Items in their groups, each with its checkbox. */
const props = defineProps<{
  preview: RecipeUpdatePreview
  pluginName: string
  /** The day of the Recipe Snapshot, or of the import. */
  since: string
}>()

const checked = defineModel<Record<string, boolean>>('checked', { required: true })

const groups = computed(() => updateGroups(props.preview.items))
const leftEmpty = computed(() => new Set(props.preview.requiredFieldsLeftEmpty))
</script>

<template>
  <p v-if="preview.mode === 'three-way'" class="lede">
    The Recipe <RecipeName :recipe="preview.recipe" /> changed in {{ placesChanged(preview.items.length) }} since {{ since }}.
    Choose what {{ pluginName }} takes over. Nothing is applied until you say so.
  </p>
  <p v-else class="lede">
    {{ pluginName }} has no Recipe Snapshot, so Kuroshiro cannot tell your changes from the Recipe's.
    Every difference between {{ pluginName }} and the Recipe <RecipeName :recipe="preview.recipe" /> is listed. Applying one replaces your version.
  </p>
  <section v-for="group in groups" :key="group.title" class="group">
    <h3 class="group-title">
      {{ group.title }}
    </h3>
    <ul>
      <RecipeUpdateRow
        v-for="item in group.items"
        :key="updateItemId(item)"
        v-model:checked="checked[updateItemId(item)]!"
        :item="item"
        :mode="preview.mode"
        :plugin-name="pluginName"
        :left-empty="item.itemType === 'field' && leftEmpty.has(item.key)"
      />
    </ul>
  </section>
</template>

<style scoped>
@layer components {
  .lede {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .group {
    margin-top: var(--space-8);
  }

  .group-title {
    padding-bottom: var(--space-2);
    border-bottom: var(--rule);
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
  }
}
</style>
