import type { RecipeGalleryPage, RecipeGalleryQuery } from 'kuroshiro-shared'
import type { TrmnlRecipeList } from '../recipe-gallery.mapper.js'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { RECIPE_CATEGORY_PATTERN, RECIPE_GALLERY_PAGE_SIZE, RECIPE_SEARCH_MIN_LENGTH } from 'kuroshiro-shared'
import { ApiException } from '../../errors/api.exception.js'
import { downloadLimited } from '../../utils/downloadLimited.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'
import { isPlainObject } from '../../utils/json.js'
import { toRecipeGalleryPage } from '../recipe-gallery.mapper.js'

// The host is fixed here: nothing the admin sends names where Kuroshiro fetches from.
const RECIPES_URL = 'https://trmnl.com/recipes.json'
const CATEGORIES_URL = 'https://trmnl.com/api/categories'

const FETCH_TIMEOUT_MS = 15_000
/** A page of 25 Recipes, each with its Plugin Fields, measured well under 1 MiB. */
const READ_LIMIT_BYTES = 4 * 1024 * 1024
const CATEGORIES_HELD_MS = 60 * 60_000

class TrmnlBusy extends Error {}

function upstreamUnreachable(reason: string): ApiException {
  return new ApiException(HttpStatus.BAD_GATEWAY, 'upstream-unreachable', `trmnl.com did not answer: ${reason}`, { reason })
}

/**
 * TRMNL's `search` string for a search and a category. The category is a `#slug` token and has to come
 * last: measured on 2026-11-10, `weather #calendar` answers 8 Recipes and `#calendar weather` none (ADR-0073).
 */
function trmnlSearchOf({ search, category }: Pick<RecipeGalleryQuery, 'search' | 'category'>): string | undefined {
  const words = search?.trim() ?? ''
  const tokens = [words.length >= RECIPE_SEARCH_MIN_LENGTH ? words : '', category ? `#${category}` : ''].filter(Boolean)
  return tokens.length > 0 ? tokens.join(' ') : undefined
}

/** TRMNL's published Recipes, read through Kuroshiro because `recipes.json` sends no CORS header. Nothing is stored. */
@Injectable()
export class RecipeGalleryService {
  private readonly logger = new Logger(RecipeGalleryService.name)
  private heldCategories: { slugs: string[], until: number } | null = null

  async page(query: RecipeGalleryQuery): Promise<RecipeGalleryPage> {
    const url = new URL(RECIPES_URL)
    const search = trmnlSearchOf(query)
    if (search)
      url.searchParams.set('search', search)
    url.searchParams.set('sort-by', query.sort ?? 'install')
    url.searchParams.set('per_page', String(RECIPE_GALLERY_PAGE_SIZE))
    url.searchParams.set('page', String(query.page ?? 1))

    let body: unknown
    try {
      body = await this.readJson(url.href)
    }
    catch (error) {
      if (error instanceof TrmnlBusy)
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'upstream-busy', 'trmnl.com is over its request limit. Wait a minute and try again.')
      throw upstreamUnreachable(getErrorMessage(error))
    }
    if (!isPlainObject(body) || !Array.isArray(body.data))
      throw upstreamUnreachable('what it answered is not a list of Recipes')
    return toRecipeGalleryPage(body as unknown as TrmnlRecipeList)
  }

  /** TRMNL's category slugs, held for an hour. A failed read answers none, and the Gallery goes without the control. */
  async categories(): Promise<string[]> {
    if (this.heldCategories && Date.now() < this.heldCategories.until)
      return this.heldCategories.slugs
    try {
      const body = await this.readJson(CATEGORIES_URL)
      if (!isPlainObject(body) || !Array.isArray(body.data))
        throw new Error('what it answered is not a list of categories')
      const slugs = body.data.filter((slug): slug is string => typeof slug === 'string' && RECIPE_CATEGORY_PATTERN.test(slug))
      this.heldCategories = { slugs, until: Date.now() + CATEGORIES_HELD_MS }
      return slugs
    }
    catch (error) {
      this.logger.warn(`TRMNL's Recipe categories could not be read: ${getErrorMessage(error)}`)
      return []
    }
  }

  private async readJson(url: string): Promise<unknown> {
    const { status, ok, buffer } = await downloadLimited(url, { limitBytes: READ_LIMIT_BYTES, timeoutMs: FETCH_TIMEOUT_MS })
    if (status === 429)
      throw new TrmnlBusy('it is over its request limit')
    if (!ok)
      throw new Error(`it answered ${status}`)
    try {
      return JSON.parse(buffer.toString('utf8'))
    }
    catch {
      return undefined
    }
  }
}
