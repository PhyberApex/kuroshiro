import type { PluginSummary, RecipeGalleryPage, RecipeGalleryQuery, RecipeSort } from 'kuroshiro-shared'
import type { SelectOption } from '@/components/selectOption'
import { RECIPE_CATEGORY_PATTERN, RECIPE_SEARCH_MIN_LENGTH, RECIPE_SORTS } from 'kuroshiro-shared'
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { isRefusal, isUnreachable } from '@/api/client'
import { listRecipes } from '@/api/plugins'
import { failureReason } from '@/components/failureReason'
import { useLoad } from '@/patterns/useLoad'

/** What the Gallery is showing, as the address holds it. */
export interface GalleryView {
  /** What is searched for: empty, or at least `RECIPE_SEARCH_MIN_LENGTH` characters. */
  search: string
  category?: string
  sort: RecipeSort
}

const SORT_WORDS: Record<RecipeSort, { label: string, first: string }> = {
  install: { label: 'Most installed', first: 'most installed first' },
  popularity: { label: 'Most popular', first: 'most popular first' },
  newest: { label: 'Newest', first: 'newest first' },
  oldest: { label: 'Oldest', first: 'oldest first' },
}

export const SORT_OPTIONS: SelectOption<RecipeSort>[] = RECIPE_SORTS.map(sort => ({ value: sort, label: SORT_WORDS[sort].label }))

/** The Category select's value for no category: a select's value is never the empty string. */
export const EVERY_CATEGORY = 'every'

export const categoryLabel = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1)

export function categoryOptions(slugs: string[]): SelectOption[] {
  return [{ value: EVERY_CATEGORY, label: 'Every category' }, ...slugs.map(slug => ({ value: slug, label: categoryLabel(slug) }))]
}

export const sortOf = (named: unknown): RecipeSort => RECIPE_SORTS.find(sort => sort === named) ?? 'install'

export const categoryOf = (named: unknown): string | undefined => typeof named === 'string' && RECIPE_CATEGORY_PATTERN.test(named) ? named : undefined

/** What a search field's text searches for: nothing under `RECIPE_SEARCH_MIN_LENGTH` characters. */
export const searchable = (typed: string) => typed.trim().length >= RECIPE_SEARCH_MIN_LENGTH ? typed.trim() : ''

/** Whether what is typed is too short to search for, which the field's hint then says. */
export const tooShort = (typed: string) => typed.trim().length > 0 && searchable(typed) === ''

export function galleryQueryOf({ search, category, sort }: GalleryView): RecipeGalleryQuery {
  return { ...(search ? { search } : {}), ...(category ? { category } : {}), sort }
}

const filteredBy = ({ search, category }: Pick<GalleryView, 'search' | 'category'>) => search !== '' || category !== undefined

export function countLine({ shown, total, filtered, sort }: { shown: number, total: number, filtered: boolean, sort: RecipeSort }) {
  const recipes = filtered
    ? total === 1 ? 'Recipe that matches' : 'Recipes that match'
    : total === 1 ? 'Recipe' : 'Recipes'
  return `Showing ${shown} of ${total} ${recipes}, ${SORT_WORDS[sort].first}`
}

export const endLine = (filtered: boolean) => filtered ? 'That is every Recipe that matches.' : 'That is the whole catalog.'

export function noMatchSentence({ search, category }: Pick<GalleryView, 'search' | 'category'>) {
  const within = category ? ` in ${categoryLabel(category)}` : ''
  return search ? `No Recipe is called “${search}”${within}.` : `No Recipe is${within}.`
}

export const installsLine = (installs: number) => `${installs.toLocaleString('en')} ${installs === 1 ? 'install' : 'installs'}`

/** The Plugins imported from a Recipe, by the Recipe's id. */
export function heldByRecipe(plugins: PluginSummary[]): Map<string, PluginSummary[]> {
  const held = new Map<string, PluginSummary[]>()
  for (const plugin of plugins) {
    if (plugin.sourceRecipeId)
      held.set(plugin.sourceRecipeId, [...held.get(plugin.sourceRecipeId) ?? [], plugin])
  }
  return held
}

/** The notice of a page of Recipes that could not be loaded. */
export function failedNotice(error: unknown): { title: string, reason?: string } {
  if (isRefusal(error, 'upstream-unreachable'))
    return { title: 'trmnl.com did not answer.', reason: 'No Recipes could be loaded.' }
  if (isRefusal(error, 'upstream-busy'))
    return { title: 'trmnl.com is busy with other requests.', reason: 'Wait a minute and try again.' }
  return { title: 'Could not load the Recipes.', reason: isUnreachable(error) ? 'Kuroshiro\'s server is not answering.' : failureReason(error) }
}

/** The id of a card's heading, which takes the focus when its Recipe is the first of a page appended. */
export const recipeHeadingId = (recipeId: string) => `recipe-${recipeId}`

/**
 * The Recipe Gallery's Recipes for a view: the first page, loaded anew whenever the view changes, with the later
 * pages appended to it. It never asks again by itself: nothing about a published Recipe changes while it is shown.
 */
export function useRecipeGallery(view: () => GalleryView) {
  // `useLoad` keeps only a failure's sentence; the notice is worded from the refusal itself.
  const firstError = shallowRef<unknown>()
  const first = useLoad(() => listRecipes(galleryQueryOf(view())).then((page) => {
    firstError.value = undefined
    return page
  }, (error: unknown) => {
    firstError.value = error
    throw error
  }), {
    key: () => JSON.stringify(galleryQueryOf(view())),
  })

  // What was appended and what failed belong to the first page they were asked for under; once another first page
  // has taken its place, they are forgotten, and an answer that lands after that is dropped.
  const appended = shallowRef<{ under: RecipeGalleryPage, page: RecipeGalleryPage }>()
  const moreFailure = shallowRef<{ under: RecipeGalleryPage, error: unknown }>()
  const loadingMore = ref(false)
  const current = computed(() => appended.value && appended.value.under === first.data ? appended.value.page : first.data)
  // A view whose first page failed leaves the cards of the view before it under the notice.
  const earlier = shallowRef<RecipeGalleryPage>()
  watch(current, (now) => {
    if (now)
      earlier.value = now
  })
  const shown = computed(() => current.value ?? (first.failure ? earlier.value : undefined))
  const moreError = computed(() => moreFailure.value && moreFailure.value.under === first.data ? moreFailure.value.error : undefined)

  /** Appends the next page and answers the id of its first new Recipe, which takes the focus. */
  async function loadMore(): Promise<string | undefined> {
    const under = first.data
    const gallery = current.value
    if (!under || !gallery?.hasMore || loadingMore.value)
      return undefined
    loadingMore.value = true
    moreFailure.value = undefined
    try {
      const next = await listRecipes({ ...galleryQueryOf(view()), page: gallery.page + 1 })
      if (under !== first.data)
        return undefined
      // TRMNL's order can move between two pages, so a Recipe already shown is not shown twice.
      const held = new Set(gallery.recipes.map(recipe => recipe.id))
      const added = next.recipes.filter(recipe => !held.has(recipe.id))
      appended.value = { under, page: { ...next, recipes: [...gallery.recipes, ...added] } }
      return added[0]?.id
    }
    catch (error) {
      moreFailure.value = { under, error }
      return undefined
    }
    finally {
      loadingMore.value = false
    }
  }

  const failure = computed(() => {
    if (moreError.value !== undefined)
      return failedNotice(moreError.value)
    return first.failure ? failedNotice(firstError.value) : undefined
  })

  function retry() {
    if (moreError.value !== undefined)
      return loadMore()
    return first.reload()
  }

  return reactive({
    /** The load of the first page: its `waiting` is the page's loading state. */
    first,
    /** Every Recipe loaded so far as one page, or nothing before the first answer. */
    shown,
    loadingMore,
    /** The notice of the last load that failed, the first page's or a later one's. */
    failure,
    filtered: computed(() => filteredBy(view())),
    loadMore,
    retry,
  })
}
