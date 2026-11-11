import { describe, expect, it } from 'vitest'
import { toRecipeGalleryPage, toRecipeSummary } from '../recipe-gallery.mapper.js'

/** One entry of `GET trmnl.com/recipes.json` as it answered on 2026-11-10, `custom_fields` trimmed. */
const LINES = {
  id: 377363,
  user_id: 23360,
  name: 'Lines ',
  description: 'Time or Weather',
  published_at: '2026-07-22T05:05:44.390Z',
  icon_url: 'https://trmnl-public.s3.us-east-2.amazonaws.com/dsukbjvbnwbpzculaipf3wkmondw',
  icon_content_type: 'image/svg+xml',
  screenshot_url: 'https://trmnl-public.s3.us-east-2.amazonaws.com/mdv0h9x7a4b2trzuo7xh6gp5utv2',
  recipe_url: 'https://trmnl.com/recipes/lines-377363',
  author_bio: { name: 'About this plugin', keyname: 'author_bio', field_type: 'author_bio' },
  custom_fields: [],
  stats: { installs: 66, forks: 4 },
}

describe('the Recipe summary read model', () => {
  it('answers Kuroshiro\'s own keys, never TRMNL\'s, with the id as a string and the name trimmed', () => {
    expect(toRecipeSummary(LINES)).toEqual({
      id: '377363',
      name: 'Lines',
      description: 'Time or Weather',
      publishedAt: '2026-07-22T05:05:44.390Z',
      iconUrl: 'https://trmnl-public.s3.us-east-2.amazonaws.com/dsukbjvbnwbpzculaipf3wkmondw',
      screenshotUrl: 'https://trmnl-public.s3.us-east-2.amazonaws.com/mdv0h9x7a4b2trzuo7xh6gp5utv2',
      recipeUrl: 'https://trmnl.com/recipes/lines-377363',
      installs: 66,
    })
  })

  it('names every key, absent ones as null and no installs as 0', () => {
    expect(JSON.parse(JSON.stringify(toRecipeSummary({ id: 5, name: 'Bare' })))).toEqual({
      id: '5',
      name: 'Bare',
      description: null,
      publishedAt: null,
      iconUrl: null,
      screenshotUrl: null,
      recipeUrl: null,
      installs: 0,
    })
  })

  it('takes an empty description, and an address that is not https, as none', () => {
    const read = toRecipeSummary({ ...LINES, description: '  ', screenshot_url: 'javascript:alert(1)', icon_url: 'http://example.com/a.png' })
    expect(read).toMatchObject({ description: null, screenshotUrl: null, iconUrl: null })
  })
})

describe('the Recipe Gallery page read model', () => {
  it('reads total from TRMNL\'s total and hasMore from its next-page address', () => {
    const page = toRecipeGalleryPage({ data: [LINES], total: 8, per_page: 25, current_page: 1, next_page_url: '/recipes.json?page=2' })
    expect(page).toEqual({ recipes: [toRecipeSummary(LINES)], total: 8, page: 1, perPage: 25, hasMore: true })
  })

  it('has no more without a next-page address, however full the page', () => {
    const full = Array.from({ length: 25 }, (_, i) => ({ ...LINES, id: i + 1 }))
    expect(toRecipeGalleryPage({ data: full, total: 25, per_page: 25, current_page: 1, next_page_url: null }).hasMore).toBe(false)
  })

  it('leaves out an entry without an id or a name', () => {
    const page = toRecipeGalleryPage({ data: [LINES, { name: 'No id' }, { id: 9 }, null], total: 4, per_page: 25, current_page: 1, next_page_url: null })
    expect(page.recipes.map(recipe => recipe.id)).toEqual(['377363'])
  })
})
