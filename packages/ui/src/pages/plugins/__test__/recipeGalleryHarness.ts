import type { ApiError, ImportRecipeInput, PluginSummary, RecipeGalleryPage, RecipeSummary } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { expect } from 'vitest'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginImportResult, buildRecipeGalleryPage, buildRecipeSummary } from '@/testing/fixtures/plugins'
import { fakeRecipeImages, TRMNL_IMAGE_BUCKET } from '@/testing/images'

const KITCHEN = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })

export const IMPORTED = buildPluginImportResult()

function recipe(id: string, name: string, description: string, installs: number): RecipeSummary {
  return buildRecipeSummary({
    id,
    name,
    description,
    installs,
    screenshotUrl: `${TRMNL_IMAGE_BUCKET}/${id}`,
    recipeUrl: `https://trmnl.com/recipes/${id}`,
  })
}

export const MOON_PHASE = buildRecipeSummary()
export const RECIPES: RecipeSummary[] = [
  MOON_PHASE,
  recipe('51200', 'Google Calendar Agenda', 'The next events of every calendar you connect, grouped by day', 1830),
  recipe('38001', 'Weather Station', 'Temperature, wind and the next hours of rain from Open-Meteo', 1212),
  recipe('29004', 'Word of the Day', 'One English word with its meaning and an example', 640),
]

const CATEGORIES = ['album', 'calendar', 'weather']

type Answer = (query: URLSearchParams) => Response | Promise<Response>

export interface FakedGallery {
  /** What a read of the Recipes answers, handed its query. */
  recipes: Answer
  /** What the categories read answers. */
  categories: () => Response | Promise<Response>
  /** What an import answers. */
  imported: () => Response | Promise<Response>
  plugins: PluginSummary[]
  /** The query of every read of the Recipes, as an object. */
  asked: Record<string, string>[]
  /** The body of every import. */
  sent: ImportRecipeInput[]
}

export const pageOf = (recipes: RecipeSummary[], overrides: Partial<RecipeGalleryPage> = {}) => buildRecipeGalleryPage({ recipes, total: recipes.length, ...overrides })

export const answerPage = (page: RecipeGalleryPage): Answer => () => HttpResponse.json(page)

export const refuseWith = (refusal: Partial<ApiError>) => () => apiErrorResponse(refusal)

/** Fakes the shell's reads, the Gallery's two reads, the Plugins, a Recipe's import and the read of the Plugin it answers. */
export function fakeGallery(overrides: Partial<Pick<FakedGallery, 'recipes' | 'categories' | 'imported' | 'plugins'>> = {}): FakedGallery {
  const faked: FakedGallery = {
    recipes: answerPage(pageOf(RECIPES)),
    categories: () => HttpResponse.json(CATEGORIES),
    imported: () => HttpResponse.json(IMPORTED, { status: 201 }),
    plugins: [],
    asked: [],
    sent: [],
    ...overrides,
  }
  fakeShellReads({ devices: [KITCHEN] })
  fakeRecipeImages()
  api.use(
    http.get(apiUrl('recipes/categories'), () => faked.categories()),
    http.get(apiUrl('recipes'), ({ request }) => {
      const query = new URL(request.url).searchParams
      faked.asked.push(Object.fromEntries(query))
      return faked.recipes(query)
    }),
    http.get(apiUrl('plugins'), () => HttpResponse.json(faked.plugins)),
    http.post(apiUrl('plugins/import-recipe'), async ({ request }) => {
      faked.sent.push(await request.json() as ImportRecipeInput)
      return faked.imported()
    }),
    http.get(apiUrl(`plugins/${IMPORTED.plugin.id}`), () => HttpResponse.json(IMPORTED.plugin)),
  )
  return faked
}

export async function mountGallery(at = '/plugins/recipes') {
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { name: 'Recipes', level: 1 })).toBeVisible()
  return screen
}
