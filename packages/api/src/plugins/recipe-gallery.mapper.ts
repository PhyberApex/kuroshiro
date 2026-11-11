import type { RecipeGalleryPage, RecipeSummary } from 'kuroshiro-shared'
import { isPlainObject } from '../utils/json.js'

/** The body of `GET trmnl.com/recipes.json` as far as the Recipe Gallery reads it; anything in it may be missing. */
export interface TrmnlRecipeList {
  data: unknown[]
  total?: unknown
  per_page?: unknown
  current_page?: unknown
  next_page_url?: unknown
}

const textOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const wholeNumberOr = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback

/** An address TRMNL gives for the browser to load or open, kept only when it is https: it ends up in an `img src` and an `a href`. */
function httpsUrlOrNull(value: unknown): string | null {
  const text = textOrNull(value)
  if (!text)
    return null
  try {
    return new URL(text).protocol === 'https:' ? text : null
  }
  catch {
    return null
  }
}

function idOf(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0)
    return String(value)
  return typeof value === 'string' && /^\d+$/.test(value) ? value : null
}

function publishedAtOf(value: unknown): string | null {
  const text = textOrNull(value)
  return text && !Number.isNaN(Date.parse(text)) ? new Date(text).toISOString() : null
}

/** One entry of TRMNL's list in Kuroshiro's words, or `null` for one without an id or a name to show. */
function recipeSummaryOrNull(entry: unknown): RecipeSummary | null {
  if (!isPlainObject(entry))
    return null
  const id = idOf(entry.id)
  const name = textOrNull(entry.name)
  if (!id || !name)
    return null
  const stats = isPlainObject(entry.stats) ? entry.stats : {}
  return {
    id,
    name,
    description: textOrNull(entry.description),
    publishedAt: publishedAtOf(entry.published_at),
    iconUrl: httpsUrlOrNull(entry.icon_url),
    screenshotUrl: httpsUrlOrNull(entry.screenshot_url),
    recipeUrl: httpsUrlOrNull(entry.recipe_url),
    installs: wholeNumberOr(stats.installs, 0),
  }
}

export function toRecipeSummary(entry: Record<string, unknown>): RecipeSummary {
  const summary = recipeSummaryOrNull(entry)
  if (!summary)
    throw new TypeError('A Recipe needs an id and a name.')
  return summary
}

/**
 * A page of TRMNL's list in Kuroshiro's words. `total` is TRMNL's own and `hasMore` is whether it names a next page:
 * neither is counted here or guessed from a full page (ADR-0073).
 */
export function toRecipeGalleryPage(body: TrmnlRecipeList): RecipeGalleryPage {
  const recipes = body.data.flatMap(entry => recipeSummaryOrNull(entry) ?? [])
  return {
    recipes,
    total: wholeNumberOr(body.total, recipes.length),
    page: wholeNumberOr(body.current_page, 1),
    perPage: wholeNumberOr(body.per_page, recipes.length),
    hasMore: textOrNull(body.next_page_url) !== null,
  }
}
