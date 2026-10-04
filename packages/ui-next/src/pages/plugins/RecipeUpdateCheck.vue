<script setup lang="ts">
import type { PluginDetail } from 'kuroshiro-shared'
import { computed, onMounted } from 'vue'
import Notice from '@/components/Notice.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import RecipeCheckEmpty from './RecipeCheckEmpty.vue'
import RecipeName from './RecipeName.vue'
import { recipeDay } from './recipeUpdate'
import { useRecipeUpdateCheck } from './recipeUpdateCheck'
import RecipeUpdateFoot from './RecipeUpdateFoot.vue'
import RecipeUpdateItems from './RecipeUpdateItems.vue'

/** The check itself, run once when it is mounted: what it is doing, why it failed, or what it found. */
const props = defineProps<{
  plugin: PluginDetail
  /** The Plugin's Recipe, as the Plugin knows it before the check answers. */
  recipe: NonNullable<PluginDetail['recipe']>
}>()

const check = useRecipeUpdateCheck(() => props.plugin)
onMounted(check.run)

const preview = computed(() => check.state.step === 'checked' ? check.state.preview : undefined)
const recipeNow = computed(() => preview.value?.recipe ?? props.recipe)
const since = computed(() => recipeDay(preview.value?.snapshotTakenAt ?? props.recipe.importedAt))
</script>

<template>
  <LoadingLine :shown="check.state.step === 'running'">
    Downloading the Recipe <RecipeName :recipe="recipeNow" /> from TRMNL and comparing
  </LoadingLine>
  <Notice
    v-if="check.state.step === 'failed'"
    title="Could not download the Recipe."
    :reason="check.state.reason"
    action="Try again"
    @act="check.run"
  />
  <RecipeCheckEmpty v-else-if="check.state.step === 'notFromRecipe'" title="Not from a Recipe" :plugin="plugin">
    {{ plugin.name }} was not imported from a Recipe, so there is nothing to check.
  </RecipeCheckEmpty>
  <template v-else-if="preview">
    <Notice v-if="check.changedAgain" class="changed-again" title="The Recipe changed again while you were reading." reason="This is the new comparison." />
    <RecipeCheckEmpty v-if="preview.items.length === 0" title="Nothing to apply" :plugin="plugin">
      The Recipe <RecipeName :recipe="recipeNow" /> has not changed since {{ plugin.name }} last took it over, on {{ since }}. Your own changes to {{ plugin.name }} are untouched.
    </RecipeCheckEmpty>
    <template v-else>
      <RecipeUpdateItems v-model:checked="check.checked" :preview="preview" :plugin-name="plugin.name" :since="since" />
      <RecipeUpdateFoot
        :plugin-id="plugin.id"
        :chosen="check.chosen.length"
        :offered="preview.items.length"
        :mode="preview.mode"
        :sending="check.sending"
        :not-sent="check.notSent"
        @apply="check.apply"
        @skip="check.skipAll"
      />
    </template>
  </template>
</template>

<style scoped>
@layer components {
  .changed-again {
    margin-bottom: var(--space-5);
  }
}
</style>
