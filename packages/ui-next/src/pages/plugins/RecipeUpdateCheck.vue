<script setup lang="ts">
import type { PluginDetail } from 'kuroshiro-shared'
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Notice from '@/components/Notice.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import NotFromRecipe from './NotFromRecipe.vue'
import { pluginPath } from './pluginPaths'
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
  <NotFromRecipe v-else-if="check.state.step === 'notFromRecipe'" :plugin="plugin" />
  <template v-else-if="preview">
    <Notice v-if="check.changedAgain" class="changed-again" title="The Recipe changed again while you were reading." reason="This is the new comparison." />
    <EmptyState v-if="preview.items.length === 0" class="nothing" title="Nothing to apply" heading="h3">
      The Recipe <RecipeName :recipe="recipeNow" /> has not changed since {{ plugin.name }} last took it over, on {{ since }}. Your own changes to {{ plugin.name }} are untouched.
      <template #action>
        <Button as-child>
          <RouterLink :to="pluginPath(plugin.id)">
            Back to {{ plugin.name }}
          </RouterLink>
        </Button>
      </template>
    </EmptyState>
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

  /* It stands under the section's heading, which already draws the heavy rule. */
  .nothing {
    padding-top: 0;
    border-top: 0;
  }
}
</style>
