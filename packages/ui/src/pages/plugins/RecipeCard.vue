<script setup lang="ts">
import type { PluginSummary, RecipeSummary } from 'kuroshiro-shared'
import type { CarriedDevice } from './addPlugin'
import { computed, ref, toRef, watch } from 'vue'
import { importRecipe } from '@/api/plugins'
import Button from '@/components/Button.vue'
import Icon from '@/components/Icon.vue'
import Plate from '@/components/Plate.vue'
import SentenceLine from '@/pages/devices/SentenceLine.vue'
import { heldFromRecipe, RECIPE_IMPORT_WORDING, useImportPluginOnto } from './importPlugin'
import { installsLine, recipeHeadingId } from './recipeGallery'

const props = defineProps<{
  recipe: RecipeSummary
  /** The Plugins already imported from this Recipe. */
  held: PluginSummary[]
  /** The Device the imported Plugin is assigned to. */
  device?: CarriedDevice
}>()

const importing = useImportPluginOnto(toRef(props, 'device'), RECIPE_IMPORT_WORDING)

// What kept the Recipe from importing, in Add a Plugin's words, as one line in the card.
const trouble = computed(() => {
  const { entered, unanswered, failure } = importing.trouble
  return entered ?? (unanswered && `${unanswered} Nothing was imported.`) ?? failure
})

function add() {
  return importing.run(deviceId => importRecipe({ recipe: props.recipe.id, deviceId }))
}

const heldLine = computed(() => heldFromRecipe(props.held))

// A screenshot that cannot be loaded leaves the plate's empty look, as one the Recipe does not have.
const unloadable = ref(false)
watch(() => props.recipe.screenshotUrl, () => {
  unloadable.value = false
})
</script>

<template>
  <li class="recipe-card" :aria-labelledby="recipeHeadingId(recipe.id)">
    <Plate :name="`Screenshot of ${recipe.name}`" :width="800" :height="480">
      <img
        v-if="recipe.screenshotUrl && !unloadable"
        class="screenshot"
        :src="recipe.screenshotUrl"
        :alt="`Screenshot of ${recipe.name}`"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="unloadable = true"
      >
      <span v-else />
    </Plate>
    <div class="body">
      <h2 :id="recipeHeadingId(recipe.id)" class="name" tabindex="-1">
        {{ recipe.name }}
      </h2>
      <p v-if="recipe.description" class="description">
        {{ recipe.description }}
      </p>
      <p class="installs">
        {{ installsLine(recipe.installs) }}
      </p>
    </div>
    <div class="foot">
      <p v-if="heldLine.length" class="note">
        <Icon name="problem" class="mark" />
        <SentenceLine class="said" :sentence="heldLine" />
      </p>
      <p v-if="trouble" class="note" role="alert">
        <Icon name="problem" class="mark" />
        <span class="said">{{ trouble }}</span>
      </p>
      <div class="actions">
        <Button variant="primary" :loading="importing.importing" :aria-label="`Import ${recipe.name}`" @click="add">
          Import
        </Button>
        <a
          v-if="recipe.recipeUrl"
          class="out"
          :href="recipe.recipeUrl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${recipe.name} on trmnl.com`"
        >On trmnl.com</a>
      </div>
    </div>
  </li>
</template>

<style scoped>
@layer components {
  .recipe-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .screenshot {
    width: 100%;
    height: 100%;
    border-radius: var(--radius-plate);
    object-fit: contain;
  }

  .body {
    display: grid;
    gap: var(--space-1);
  }

  .name {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
    line-height: var(--leading-title);
    overflow-wrap: anywhere;
  }

  .description {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    color: var(--color-ink-soft);
    overflow-wrap: anywhere;
  }

  .installs {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .foot {
    display: grid;
    gap: var(--space-2);
    margin-top: auto;
  }

  .note {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-weight: var(--weight-medium);
  }

  .note .said {
    min-width: 0;
    color: var(--color-ink);
    overflow-wrap: anywhere;
  }

  .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .out {
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .out:hover {
    color: var(--color-ink-hover);
  }
}
</style>
