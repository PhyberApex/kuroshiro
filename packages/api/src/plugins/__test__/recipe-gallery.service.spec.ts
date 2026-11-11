import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { endlessBody, jsonResponse, stubFetch } from '../../test/fetch.js'
import { RecipeGalleryService } from '../services/recipe-gallery.service.js'

const mockFetch = stubFetch()

const LINES = {
  id: 377363,
  name: 'Lines',
  description: 'Time or Weather',
  published_at: '2026-07-22T05:05:44.390Z',
  icon_url: 'https://trmnl-public.s3.us-east-2.amazonaws.com/icon',
  screenshot_url: 'https://trmnl-public.s3.us-east-2.amazonaws.com/shot',
  recipe_url: 'https://trmnl.com/recipes/lines-377363',
  stats: { installs: 66, forks: 4 },
}

/** The paging keys of `recipes.json`'s body as they answered on 2026-11-10. */
function listBody(data: unknown[] = [LINES], paging: Record<string, unknown> = {}) {
  return { data, total: 8, from: 1, to: data.length, per_page: 25, current_page: 1, prev_page_url: null, next_page_url: '/recipes.json?page=2', ...paging }
}

/** The query TRMNL was asked with, the only request a read of the list makes. */
function askedFor(call = 0): URLSearchParams {
  const url = new URL(String(mockFetch.mock.calls[call][0]))
  expect(`${url.origin}${url.pathname}`).toBe('https://trmnl.com/recipes.json')
  return url.searchParams
}

describe('the Recipe Gallery', () => {
  let service: RecipeGalleryService

  beforeEach(() => {
    mockFetch.mockReset()
    service = new RecipeGalleryService()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('a page of Recipes', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(jsonResponse(listBody()))
    })

    it('asks for the first 25 by installs when nothing is chosen', async () => {
      await service.page({})

      expect(Object.fromEntries(askedFor())).toEqual({ 'sort-by': 'install', 'per_page': '25', 'page': '1' })
    })

    it('answers the page in Kuroshiro\'s own words', async () => {
      expect(await service.page({})).toEqual({
        recipes: [{
          id: '377363',
          name: 'Lines',
          description: 'Time or Weather',
          publishedAt: '2026-07-22T05:05:44.390Z',
          iconUrl: 'https://trmnl-public.s3.us-east-2.amazonaws.com/icon',
          screenshotUrl: 'https://trmnl-public.s3.us-east-2.amazonaws.com/shot',
          recipeUrl: 'https://trmnl.com/recipes/lines-377363',
          installs: 66,
        }],
        total: 8,
        page: 1,
        perPage: 25,
        hasMore: true,
      })
    })

    it('sends the order and the page asked for', async () => {
      await service.page({ sort: 'newest', page: 3 })

      expect(askedFor().get('sort-by')).toBe('newest')
      expect(askedFor().get('page')).toBe('3')
    })

    it('sends the search as TRMNL\'s search', async () => {
      await service.page({ search: ' weather ' })

      expect(askedFor().get('search')).toBe('weather')
    })

    it('puts the category after the search as a #slug token, the only order TRMNL matches both in', async () => {
      await service.page({ search: 'weather', category: 'calendar' })

      expect(askedFor().get('search')).toBe('weather #calendar')
    })

    it('sends a category alone as the #slug token', async () => {
      await service.page({ category: 'calendar' })

      expect(askedFor().get('search')).toBe('#calendar')
    })

    it('sends a search under three characters as no search at all', async () => {
      await service.page({ search: 'we' })

      expect(askedFor().has('search')).toBe(false)
    })

    it('keeps the category of a search too short to send', async () => {
      await service.page({ search: 'we', category: 'calendar' })

      expect(askedFor().get('search')).toBe('#calendar')
    })
  })

  describe('a refusal', () => {
    it('answers 503 upstream-busy when TRMNL is over its request limit', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Too many requests' }, { status: 429 }))

      await expect(service.page({})).rejects.toMatchObject({ code: 'upstream-busy', status: 503 })
    })

    it.each([
      ['answers 500', () => jsonResponse({}, { status: 500 }), 'it answered 500'],
      ['cannot be reached', () => Promise.reject(new TypeError('fetch failed')), 'fetch failed'],
      ['answers something that is not JSON', () => new Response('<html>', { status: 200 }), 'what it answered is not a list of Recipes'],
      ['answers JSON without a list', () => jsonResponse({ total: 3 }), 'what it answered is not a list of Recipes'],
    ])('answers 502 upstream-unreachable with the reason when TRMNL %s', async (_what, answer, reason) => {
      mockFetch.mockImplementation(answer as () => Promise<Response>)

      await expect(service.page({})).rejects.toMatchObject({ code: 'upstream-unreachable', status: 502, details: { reason } })
    })

    it('answers 502 upstream-unreachable when TRMNL sends more than a list could hold', async () => {
      const { body, cancelled } = endlessBody()
      mockFetch.mockResolvedValue(new Response(body, { status: 200 }))

      await expect(service.page({})).rejects.toMatchObject({ code: 'upstream-unreachable', status: 502 })
      expect(cancelled()).toBe(true)
    })
  })

  describe('the categories', () => {
    const CATEGORIES = ['album', 'calendar', 'travel']

    it('answers TRMNL\'s slugs from its categories read', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: CATEGORIES }))

      expect(await service.categories()).toEqual(CATEGORIES)
      expect(String(mockFetch.mock.calls[0][0])).toBe('https://trmnl.com/api/categories')
    })

    it('leaves out an entry that is not a slug', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: ['calendar', 'not a slug', 7, null, '#news'] }))

      expect(await service.categories()).toEqual(['calendar'])
    })

    it('holds them in memory for an hour', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      mockFetch.mockImplementation(async () => jsonResponse({ data: CATEGORIES }))

      await service.categories()
      vi.advanceTimersByTime(59 * 60_000)
      await service.categories()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(2 * 60_000)
      await service.categories()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it.each([
      ['answers 429', () => jsonResponse({}, { status: 429 })],
      ['cannot be reached', () => Promise.reject(new TypeError('fetch failed'))],
      ['answers without a list', () => jsonResponse({ categories: [] })],
    ])('answers an empty list, and holds nothing, when TRMNL %s', async (_what, answer) => {
      mockFetch.mockImplementation(answer as () => Promise<Response>)

      expect(await service.categories()).toEqual([])

      mockFetch.mockResolvedValue(jsonResponse({ data: CATEGORIES }))
      expect(await service.categories()).toEqual(CATEGORIES)
    })
  })
})
