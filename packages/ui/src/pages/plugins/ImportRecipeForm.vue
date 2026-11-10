<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { importRecipe, listPlugins } from '@/api/plugins'
import Field from '@/components/Field.vue'
import Notice from '@/components/Notice.vue'
import TextInput from '@/components/TextInput.vue'
import { useLoad } from '@/patterns/useLoad'
import AddPluginFoot from './AddPluginFoot.vue'
import { useAddPluginPage } from './addPluginPage'
import ImportedBefore from './ImportedBefore.vue'
import { enteredRecipe, RECIPE_IMPORT_WORDING, useImportPlugin } from './importPlugin'
import { recipeGalleryPath } from './pluginPaths'

const RECIPE_EXAMPLE = 'https://trmnl.com/recipes/41120'
const entered = ref('')
const recipe = computed(() => enteredRecipe(entered.value))

const { device } = useAddPluginPage()
const importing = useImportPlugin(RECIPE_IMPORT_WORDING)
watch(entered, importing.clear)

// The line about an earlier import is a courtesy: when the Plugins cannot be read it is left out and the import goes on.
const plugins = useLoad(listPlugins)
const fromThisRecipe = computed(() => recipe.value.id && !importing.trouble.entered
  ? (plugins.data ?? []).filter(plugin => plugin.sourceRecipeId === recipe.value.id)
  : [])

function add() {
  const { id, problem } = recipe.value
  if (problem !== undefined)
    return importing.refuse(problem)
  return importing.run(deviceId => importRecipe({ recipe: id, deviceId }))
}
</script>

<template>
  <form class="import-recipe" novalidate @submit.prevent="add">
    <Field
      v-slot="{ control }"
      class="recipe"
      label="Recipe"
      hint="The address of the Recipe's page on trmnl.com, or only its id."
      :error="importing.trouble.entered"
    >
      <TextInput v-model="entered" v-bind="control" wide :placeholder="RECIPE_EXAMPLE" autocomplete="off" spellcheck="false" />
    </Field>
    <ImportedBefore :plugins="fromThisRecipe" />
    <p>
      <RouterLink class="browse" :to="recipeGalleryPath(device?.id)">
        Browse the Recipe Gallery
      </RouterLink>
    </p>
    <Notice v-if="importing.trouble.unanswered" :title="importing.trouble.unanswered" reason="Nothing was imported." action="Try again" @act="add" />
    <AddPluginFoot button="Import Recipe" :running="importing.importing" :changed="!importing.imported && entered.trim() !== ''" :failure="importing.trouble.failure">
      Imports as a Poll or Webhook Plugin you can edit. Nothing updates by itself afterwards.
    </AddPluginFoot>
  </form>
</template>

<style scoped>
@layer components {
  .import-recipe {
    display: grid;
    gap: var(--space-4);
  }

  .import-recipe .recipe {
    max-width: none;
  }

  .browse {
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .browse:hover {
    color: var(--color-ink-hover);
  }
}
</style>
