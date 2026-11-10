<script setup lang="ts">
import type { RecipeSort } from 'kuroshiro-shared'
import type { GalleryView } from './recipeGallery'
import { computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listPlugins, listRecipeCategories } from '@/api/plugins'
import Notice from '@/components/Notice.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import { useSearchInAddress } from '@/patterns/useSearchInAddress'
import { useCarriedDevice } from './carriedDevice'
import { categoryOf, categoryOptions, countLine, endLine, EVERY_CATEGORY, heldByRecipe, noMatchSentence, recipeHeadingId, searchable, sortOf, tooShort, useRecipeGallery } from './recipeGallery'
import RecipeGalleryBar from './RecipeGalleryBar.vue'
import RecipeGalleryEmpty from './RecipeGalleryEmpty.vue'
import RecipeGalleryList from './RecipeGalleryList.vue'
import RecipeGalleryLoading from './RecipeGalleryLoading.vue'

const route = useRoute()
const router = useRouter()

const { device, settled, back } = useCarriedDevice()

function holdInAddress(changes: { q?: string, category?: string, sort?: string }) {
  void router.replace({ query: { ...route.query, ...changes } })
}

const sought = computed(() => typeof route.query.q === 'string' ? searchable(route.query.q) : '')
const view = computed<GalleryView>(() => ({ search: sought.value, category: categoryOf(route.query.category), sort: sortOf(route.query.sort) }))

const category = computed<string>({
  get: () => view.value.category ?? EVERY_CATEGORY,
  set: chosen => holdInAddress({ category: chosen === EVERY_CATEGORY ? undefined : chosen }),
})
const sort = computed<RecipeSort>({
  get: () => view.value.sort,
  // Installs is the order without a choice, so it is not written into the address.
  set: chosen => holdInAddress({ sort: chosen === 'install' ? undefined : chosen }),
})

// One or two characters search for nothing new: the grid is left as it is, whatever was searched for before.
const searchedFor = (text: string) => tooShort(text) ? sought.value : searchable(text)
const { typed, clear: clearSearch } = useSearchInAddress({ sought: () => sought.value, searchable: searchedFor, hold: q => holdInAddress({ q }) })

function showEvery() {
  clearSearch()
  holdInAddress({ q: undefined, category: undefined })
}

const gallery = useRecipeGallery(() => view.value)
const categories = useLoad(listRecipeCategories)
const categoryChoices = computed(() => categoryOptions(categories.data ?? []))

// The line about an earlier import is a courtesy: when the Plugins cannot be read it is left out.
const plugins = useLoad(listPlugins)
const heldBy = computed(() => heldByRecipe(plugins.data ?? []))

const counted = computed(() => gallery.shown
  ? countLine({ shown: gallery.shown.recipes.length, total: gallery.shown.total, filtered: gallery.filtered, sort: view.value.sort })
  : '')

async function showMore() {
  const firstNew = await gallery.loadMore()
  if (!firstNew)
    return
  await nextTick()
  document.getElementById(recipeHeadingId(firstNew))?.focus()
}
</script>

<template>
  <TitleLine title="Recipes" :back="back" />
  <p class="lede">
    Ready-made Plugins published on trmnl.com. Importing one copies it into Kuroshiro; nothing updates by itself afterwards.
    <template v-if="device">
      It is assigned to {{ device.name }} as soon as it exists, at the end of the Order.
    </template>
  </p>
  <RecipeGalleryBar v-model:search="typed" v-model:category="category" v-model:sort="sort" :categories="categoryChoices" :too-short="tooShort(typed)" />
  <Notice
    v-if="gallery.failure"
    class="gallery-notice"
    :title="gallery.failure.title"
    :reason="gallery.failure.reason"
    action="Try again"
    @act="gallery.retry"
  />
  <template v-if="gallery.shown && settled">
    <RecipeGalleryEmpty
      v-if="gallery.shown.recipes.length === 0"
      :no-match="gallery.filtered ? noMatchSentence(view) : undefined"
      @show-every="showEvery"
      @retry="gallery.first.reload"
    />
    <RecipeGalleryList
      v-else
      :gallery="gallery.shown"
      :counted="counted"
      :end="endLine(gallery.filtered)"
      :held-by="heldBy"
      :device="device"
      :loading-more="gallery.loadingMore"
      @more="showMore"
    />
  </template>
  <RecipeGalleryLoading v-else-if="!gallery.failure" :waiting="gallery.first.waiting" />
</template>

<style scoped>
@layer components {
  .lede {
    max-width: var(--measure);
    margin-top: calc(-1 * var(--space-2));
    color: var(--color-ink-soft);
  }

  .gallery-notice {
    margin-top: var(--space-4);
  }
}
</style>
