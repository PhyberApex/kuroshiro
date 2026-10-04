import type { ApiError, ImportGithubPluginInput, ImportRecipeInput, PluginImportResult, PluginSummary } from 'kuroshiro-shared'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginImportResult, buildPluginSummary } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'

const KITCHEN = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })

const IMPORTED = buildPluginImportResult()

type Answer = () => Response | Promise<Response>

const answerWith = (result: PluginImportResult): Answer => () => HttpResponse.json(result, { status: 201 })
const refuseWith = (refusal: Partial<ApiError>): Answer => () => apiErrorResponse(refusal)

interface Faked {
  /** What the next import answers. */
  answer: Answer
  /** The Plugins the Instance has. */
  plugins: PluginSummary[]
  /** Every Recipe and GitHub import's body, and every file import as its file's name and the Device sent with it. */
  sent: unknown[]
}

/** Fakes the shell's reads, the Plugins list, the three imports and the read of the Plugin an import answers. */
function fakeImporting(overrides: Partial<Pick<Faked, 'answer' | 'plugins'>> = {}): Faked {
  const faked: Faked = { answer: answerWith(IMPORTED), plugins: [], sent: [], ...overrides }
  fakeShellReads({ devices: [KITCHEN] })
  api.use(
    http.get(apiUrl('plugins'), () => HttpResponse.json(faked.plugins)),
    http.post(apiUrl('plugins/import-recipe'), async ({ request }) => {
      faked.sent.push(await request.json() as ImportRecipeInput)
      return faked.answer()
    }),
    http.post(apiUrl('plugins/import-github'), async ({ request }) => {
      faked.sent.push(await request.json() as ImportGithubPluginInput)
      return faked.answer()
    }),
    http.post(apiUrl('plugins/import'), async ({ request }) => {
      const form = await request.formData()
      const deviceId = form.get('deviceId')
      faked.sent.push({ fileName: (form.get('file') as File).name, ...(deviceId === null ? {} : { deviceId }) })
      return faked.answer()
    }),
    http.get(apiUrl(`plugins/${IMPORTED.plugin.id}`), () => HttpResponse.json(IMPORTED.plugin)),
  )
  return faked
}

async function mountAddPlugin(at = '/plugins/new') {
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { name: 'Add a Plugin', level: 1 })).toBeVisible()
  return screen
}

type Mounted = Awaited<ReturnType<typeof mountAddPlugin>>

const way = (screen: Mounted, name: string) => screen.getByRole('radiogroup', { name: 'Way to add a Plugin' }).getByRole('radio', { name, exact: true })
const path = (screen: Mounted) => screen.router.currentRoute.value.fullPath
const pluginPageOpened = (screen: Mounted) => expect.element(screen.getByRole('heading', { name: IMPORTED.plugin.name, level: 1 })).toBeVisible()

describe('add a Plugin by importing', () => {
  describe('a Recipe', () => {
    const recipeField = (screen: Mounted) => screen.getByRole('textbox', { name: 'Recipe' })
    const importRecipe = (screen: Mounted) => screen.getByRole('button', { name: 'Import Recipe' })

    it('is the way the page opens with, and says what a Recipe is and what importing does', async () => {
      fakeImporting()
      const screen = await mountAddPlugin()

      await expect.element(way(screen, 'Recipe')).toBeChecked()
      await expect.element(way(screen, 'Recipe')).toHaveAccessibleDescription('A ready-made Plugin from trmnl.com/recipes')
      await expect.element(recipeField(screen)).toHaveAttribute('placeholder', 'https://trmnl.com/recipes/41120')
      await expect.element(recipeField(screen)).toHaveAccessibleDescription('The address of the Recipe\'s page on trmnl.com, or only its id.')
      await expect.element(screen.getByRole('link', { name: 'Browse Recipes on trmnl.com' })).toHaveAttribute('href', 'https://trmnl.com/recipes')
      await expect.element(screen.getByText('Imports as a Poll Plugin you can edit. Nothing updates by itself afterwards.')).toBeVisible()
      await expect.element(screen.getByRole('combobox')).not.toBeInTheDocument()
    })

    it.each(['41120', ' https://trmnl.com/recipes/41120 '])('imports the Recipe entered as “%s” by its id and opens the Plugin\'s page, which says where it came from', async (entered) => {
      const faked = fakeImporting()
      const screen = await mountAddPlugin('/plugins/new?way=recipe')

      await recipeField(screen).fill(entered)
      await importRecipe(screen).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ recipe: '41120' }])
      expect(path(screen)).toBe(`/plugins/${IMPORTED.plugin.id}`)
      await expect.element(screen.getByText('Imported from the Recipe Moon Phase. It is not on a Device yet.')).toBeVisible()
    })

    it('says that the Recipe brings a transform', async () => {
      fakeImporting({ answer: answerWith({ ...IMPORTED, hasTransform: true }) })
      const screen = await mountAddPlugin()

      await recipeField(screen).fill('41120')
      await importRecipe(screen).click()

      await expect.element(screen.getByText('Imported from the Recipe Moon Phase. It is not on a Device yet. It brings a transform: JavaScript that runs on this server at every fetch. Read it under Data Sources.')).toBeVisible()
    })

    it('shows the loading mark on the button while the Recipe is imported', async () => {
      fakeImporting({ answer: async () => {
        await delay(300)
        return HttpResponse.json(IMPORTED, { status: 201 })
      } })
      const screen = await mountAddPlugin()

      await recipeField(screen).fill('41120')
      await importRecipe(screen).click()

      await expect.element(importRecipe(screen)).toHaveAttribute('aria-busy', 'true')
      await pluginPageOpened(screen)
    })

    it.each([
      ['', 'Enter a Recipe\'s address or its id.'],
      ['   ', 'Enter a Recipe\'s address or its id.'],
      ['weather', 'This is not a Recipe address or id. It looks like https://trmnl.com/recipes/41120, or 41120.'],
      ['https://trmnl.com/plugins/41120', 'This is not a Recipe address or id. It looks like https://trmnl.com/recipes/41120, or 41120.'],
    ])('refuses “%s” under the field and sends nothing', async (entered, message) => {
      const faked = fakeImporting()
      const screen = await mountAddPlugin()

      await recipeField(screen).fill(entered)
      await importRecipe(screen).click()

      await expect.element(recipeField(screen)).toHaveAccessibleDescription(message)
      await expect.element(recipeField(screen)).toHaveAttribute('aria-invalid', 'true')
      expect(faked.sent).toEqual([])
      expect(path(screen)).toBe('/plugins/new')
    })

    it.each<[string, Partial<ApiError>, string]>([
      ['TRMNL has no such Recipe', { statusCode: 422, code: 'recipe-not-found', details: { id: '41120' } }, 'TRMNL has no Recipe 41120.'],
      ['the Recipe signs in to another service', { statusCode: 422, code: 'recipe-oauth' }, 'This Recipe signs in to another service with OAuth, which Kuroshiro cannot do.'],
      ['the Recipe is fed by a webhook', { statusCode: 422, code: 'recipe-strategy-unsupported', details: { strategy: 'webhook' } }, 'This Recipe gets its data pushed by TRMNL. Kuroshiro can only import Recipes that poll or hold fixed data. Build a Webhook Plugin instead.'],
      ['the server reads no id either', { statusCode: 400, code: 'recipe-id-invalid' }, 'This is not a Recipe address or id. It looks like https://trmnl.com/recipes/41120, or 41120.'],
      ['a refusal the spec has no words for', { statusCode: 422, code: 'recipe-static-transform', message: 'The Recipe holds fixed data and a transform.js, which has nothing to transform.' }, 'The Recipe holds fixed data and a transform.js, which has nothing to transform.'],
      ['the Recipe holds no template', { statusCode: 422, code: 'import-no-plugin' }, 'This Recipe holds no template, so there is nothing to import.'],
    ])('says under the field that %s, and keeps what was entered', async (_cause, refusal, message) => {
      const faked = fakeImporting({ answer: refuseWith(refusal) })
      const screen = await mountAddPlugin()

      await recipeField(screen).fill('41120')
      await importRecipe(screen).click()

      await expect.element(recipeField(screen)).toHaveAccessibleDescription(message)
      await expect.element(recipeField(screen)).toHaveValue('41120')
      await expect.element(importRecipe(screen)).not.toHaveAttribute('aria-busy')
      expect(faked.sent).toHaveLength(1)
      expect(path(screen)).toBe('/plugins/new')
    })

    it('says that trmnl.com did not answer and imports on "Try again"', async () => {
      const faked = fakeImporting({ answer: refuseWith({ statusCode: 502, code: 'upstream-unreachable', details: { reason: 'fetch failed' } }) })
      const screen = await mountAddPlugin()

      await recipeField(screen).fill('41120')
      await importRecipe(screen).click()

      await expect.element(screen.getByRole('alert')).toHaveTextContent('trmnl.com did not answer. Nothing was imported.')
      await expect.element(recipeField(screen)).not.toHaveAttribute('aria-invalid')

      faked.answer = answerWith(IMPORTED)
      await screen.getByRole('button', { name: 'Try again' }).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ recipe: '41120' }, { recipe: '41120' }])
    })

    it('takes the notice away once the Recipe is changed', async () => {
      fakeImporting({ answer: refuseWith({ statusCode: 502, code: 'upstream-unreachable' }) })
      const screen = await mountAddPlugin()

      await recipeField(screen).fill('41120')
      await importRecipe(screen).click()
      await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()

      await recipeField(screen).fill('41121')

      await expect.element(screen.getByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    })

    it('says why nothing was imported when the refusal is not about the Recipe', async () => {
      fakeImporting({ answer: refuseWith({ statusCode: 404, code: 'device-not-found' }) })
      const screen = await mountAddPlugin('/plugins/new?way=recipe&device=kitchen')

      await recipeField(screen).fill('41120')
      await importRecipe(screen).click()

      await expect.element(screen.getByRole('status').filter({ hasText: 'Not imported.' })).toHaveTextContent('Not imported. That Device does not exist.')
      await expect.element(recipeField(screen)).toHaveValue('41120')
    })

    describe('a Recipe imported before', () => {
      const WEATHER = buildPluginSummary({ id: 'weather', name: 'Weather', sourceRecipeId: '41120' })
      const already = (screen: Mounted) => screen.getByRole('status').filter({ hasText: 'You already have' })

      it('says which Plugin came from the Recipe as soon as its id can be read, and still imports', async () => {
        const faked = fakeImporting({ plugins: [WEATHER, buildPluginSummary({ id: 'clock', name: 'Clock', sourceRecipeId: '7' })] })
        const screen = await mountAddPlugin()

        await recipeField(screen).fill('https://trmnl.com/recipes/4112')
        await expect.element(already(screen)).not.toBeInTheDocument()

        await recipeField(screen).fill('https://trmnl.com/recipes/41120')
        await expect.element(already(screen)).toHaveTextContent('You already have Weather from this Recipe. Importing makes a second Plugin.')
        await expect.element(screen.getByRole('link', { name: 'Weather', exact: true })).toHaveAttribute('href', '/plugins/weather')
        await expect.element(recipeField(screen)).not.toHaveAttribute('aria-invalid')

        await importRecipe(screen).click()

        await pluginPageOpened(screen)
        expect(faked.sent).toEqual([{ recipe: '41120' }])
      })

      it('names every Plugin that came from it', async () => {
        fakeImporting({ plugins: [WEATHER, buildPluginSummary({ id: 'weather-copy', name: 'Weather (copy)', sourceRecipeId: '41120' })] })
        const screen = await mountAddPlugin()

        await recipeField(screen).fill('41120')

        await expect.element(already(screen)).toHaveTextContent('You already have Weather and Weather (copy) from this Recipe. Importing makes another Plugin.')
      })

      it('gives way to a refusal', async () => {
        fakeImporting({ plugins: [WEATHER], answer: refuseWith({ statusCode: 422, code: 'recipe-oauth' }) })
        const screen = await mountAddPlugin()

        await recipeField(screen).fill('41120')
        await importRecipe(screen).click()

        await expect.element(recipeField(screen)).toHaveAccessibleDescription('This Recipe signs in to another service with OAuth, which Kuroshiro cannot do.')
        await expect.element(already(screen)).not.toBeInTheDocument()
      })

      it('imports all the same when the Plugins cannot be read', async () => {
        const faked = fakeImporting()
        api.use(http.get(apiUrl('plugins'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
        const screen = await mountAddPlugin()

        await recipeField(screen).fill('41120')
        await importRecipe(screen).click()

        await pluginPageOpened(screen)
        expect(faked.sent).toEqual([{ recipe: '41120' }])
      })
    })

    it('sends the Device the address carries, and the Plugin\'s page says it was assigned', async () => {
      const faked = fakeImporting()
      const screen = await mountAddPlugin('/plugins/new?way=recipe&device=kitchen')

      await expect.element(screen.getByText('It is assigned to Kitchen as soon as it exists, at the end of the Order.')).toBeVisible()
      await recipeField(screen).fill('41120')
      await importRecipe(screen).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ recipe: '41120', deviceId: 'kitchen' }])
      await expect.element(screen.getByText(/Imported from the Recipe Moon Phase\. Assigned to Kitchen\./)).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'Back to Kitchen\'s Screens' })).toHaveAttribute('href', '/devices/kitchen')
    })

    it('asks before leaving a Recipe that was entered', async () => {
      fakeImporting()
      const screen = await mountAddPlugin()

      await recipeField(screen).fill('41120')
      await screen.getByRole('link', { name: 'Cancel' }).click()

      await expect.element(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeVisible()
    })
  })

  describe('a file', () => {
    const FROM_FILE: PluginImportResult = { ...IMPORTED, origin: { type: 'file', fileName: 'moon.trmnlp.zip' } }
    const fileInput = (screen: Mounted) => screen.getByLabelText('Choose file')
    const importPlugin = (screen: Mounted) => screen.getByRole('button', { name: 'Import Plugin' })
    const zip = (name = 'moon.trmnlp.zip') => new File([new Uint8Array(2048)], name, { type: 'application/zip' })

    it('offers a drop zone that takes a .zip only, up to what this Instance accepts, and asks for no Device', async () => {
      fakeImporting()
      const screen = await mountAddPlugin('/plugins/new?way=file')

      await expect.element(way(screen, 'File')).toBeChecked()
      await expect.element(way(screen, 'File')).toHaveAccessibleDescription('A Plugin exported from Kuroshiro or TRMNL')
      await expect.element(screen.getByRole('group', { name: 'Plugin file' }).getByText('Drop a .zip here: a Plugin as Kuroshiro or TRMNL exports it. ZIP, up to 10 MB.')).toBeVisible()
      await expect.element(fileInput(screen)).toHaveAttribute('accept', '.zip')
      await expect.element(screen.getByText('Imports as a Poll Plugin. Field Values are not part of a file, so you enter them afterwards.')).toBeVisible()
      await expect.element(screen.getByRole('combobox')).not.toBeInTheDocument()
    })

    it('imports the chosen .zip and opens the Plugin\'s page, which names the file', async () => {
      const faked = fakeImporting({ answer: answerWith(FROM_FILE) })
      const screen = await mountAddPlugin('/plugins/new?way=file')

      await userEvent.upload(fileInput(screen), zip())
      await expect.element(screen.getByText('moon.trmnlp.zip')).toBeVisible()
      await importPlugin(screen).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ fileName: 'moon.trmnlp.zip' }])
      await expect.element(screen.getByText('Imported from moon.trmnlp.zip. It is not on a Device yet.')).toBeVisible()
    })

    it('does not take a bare .trmnlp.yml', async () => {
      const faked = fakeImporting()
      const screen = await mountAddPlugin('/plugins/new?way=file')

      await userEvent.upload(fileInput(screen), zip('moon.trmnlp.yml'))
      await expect.element(screen.getByText('moon.trmnlp.yml is not a ZIP file.')).toBeVisible()
      await importPlugin(screen).click()

      await expect.element(fileInput(screen)).toHaveAccessibleDescription(/Choose a \.zip to import\./)
      expect(faked.sent).toEqual([])
    })

    it('asks for a file when none is chosen, and sends nothing', async () => {
      const faked = fakeImporting()
      const screen = await mountAddPlugin('/plugins/new?way=file')

      await importPlugin(screen).click()

      await expect.element(screen.getByText('Choose a .zip to import.')).toBeVisible()
      await expect.element(fileInput(screen)).toHaveAttribute('aria-invalid', 'true')
      expect(faked.sent).toEqual([])
    })

    it.each<[string, Partial<ApiError>, string]>([
      ['holds no Plugin', { statusCode: 422, code: 'import-no-plugin' }, 'This .zip holds no Plugin. It needs a .trmnlp.yml and at least one .liquid template.'],
      ['is not a .zip inside', { statusCode: 400, code: 'import-not-zip' }, 'This file is not a .zip. A Plugin is imported from a .zip as Kuroshiro or TRMNL exports it.'],
      ['is in the legacy format', { statusCode: 422, code: 'import-legacy-format' }, 'This Plugin was exported in a format Kuroshiro no longer reads. Export it again where it came from.'],
      ['is larger than the server takes', { statusCode: 413, code: 'upload-too-large', details: { limitBytes: 1024 * 1024 } }, 'That file is larger than the 1 MB this Instance accepts.'],
    ])('says under the drop zone that the file %s, and keeps the file', async (_cause, refusal, message) => {
      const faked = fakeImporting({ answer: refuseWith(refusal) })
      const screen = await mountAddPlugin('/plugins/new?way=file')

      await userEvent.upload(fileInput(screen), zip())
      await importPlugin(screen).click()

      await expect.element(screen.getByText(message)).toBeVisible()
      await expect.element(fileInput(screen)).toHaveAttribute('aria-invalid', 'true')
      await expect.element(screen.getByText('moon.trmnlp.zip')).toBeVisible()
      expect(faked.sent).toHaveLength(1)
      expect(path(screen)).toBe('/plugins/new?way=file')
    })

    it('takes the refusal away once another file is chosen', async () => {
      fakeImporting({ answer: refuseWith({ statusCode: 422, code: 'import-no-plugin' }) })
      const screen = await mountAddPlugin('/plugins/new?way=file')

      await userEvent.upload(fileInput(screen), zip())
      await importPlugin(screen).click()
      await expect.element(screen.getByText(/This \.zip holds no Plugin/)).toBeVisible()

      await userEvent.upload(fileInput(screen), zip('weather.zip'))

      await expect.element(screen.getByText(/This \.zip holds no Plugin/)).not.toBeInTheDocument()
    })

    it('says why nothing was imported when the refusal is not about the file', async () => {
      fakeImporting({ answer: refuseWith({ statusCode: 500, code: 'internal' }) })
      const screen = await mountAddPlugin('/plugins/new?way=file')

      await userEvent.upload(fileInput(screen), zip())
      await importPlugin(screen).click()

      await expect.element(screen.getByRole('status').filter({ hasText: 'Not imported.' })).toHaveTextContent('Not imported. Something went wrong on the server.')
    })

    it('sends the Device the address carries with the file', async () => {
      const faked = fakeImporting({ answer: answerWith(FROM_FILE) })
      const screen = await mountAddPlugin('/plugins/new?way=file&device=kitchen')

      await userEvent.upload(fileInput(screen), zip())
      await importPlugin(screen).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ fileName: 'moon.trmnlp.zip', deviceId: 'kitchen' }])
      await expect.element(screen.getByText(/Imported from moon\.trmnlp\.zip\. Assigned to Kitchen\./)).toBeVisible()
    })
  })

  describe('a GitHub repository', () => {
    const FROM_GITHUB: PluginImportResult = { ...IMPORTED, origin: { type: 'github', repository: 'usetrmnl/moon-phase' } }
    const repositoryField = (screen: Mounted) => screen.getByRole('textbox', { name: 'Repository' })
    const importPlugin = (screen: Mounted) => screen.getByRole('button', { name: 'Import Plugin' })

    it('asks for the repository\'s address, says where the Plugin has to be, and asks for no Device', async () => {
      fakeImporting()
      const screen = await mountAddPlugin('/plugins/new?way=github')

      await expect.element(way(screen, 'GitHub')).toBeChecked()
      await expect.element(way(screen, 'GitHub')).toHaveAccessibleDescription('A Plugin kept in a public repository')
      await expect.element(repositoryField(screen)).toHaveAttribute('placeholder', 'https://github.com/owner/repository')
      await expect.element(repositoryField(screen)).toHaveAccessibleDescription('A public repository with the Plugin at its root, on the branch main.')
      await expect.element(screen.getByText('Imports as a Poll Plugin, copied once. Later changes in the repository do not reach it.')).toBeVisible()
      await expect.element(screen.getByRole('combobox')).not.toBeInTheDocument()
    })

    it('imports the Plugin of the repository and opens its page, which names the repository', async () => {
      const faked = fakeImporting({ answer: answerWith(FROM_GITHUB) })
      const screen = await mountAddPlugin('/plugins/new?way=github')

      await repositoryField(screen).fill(' https://github.com/usetrmnl/moon-phase ')
      await importPlugin(screen).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ githubUrl: 'https://github.com/usetrmnl/moon-phase' }])
      await expect.element(screen.getByText('Imported from usetrmnl/moon-phase. It is not on a Device yet.')).toBeVisible()
    })

    it.each(['', 'usetrmnl/moon-phase', 'https://github.com/usetrmnl/moon-phase/tree/develop'])('refuses “%s” under the field and sends nothing', async (entered) => {
      const faked = fakeImporting()
      const screen = await mountAddPlugin('/plugins/new?way=github')

      await repositoryField(screen).fill(entered)
      await importPlugin(screen).click()

      await expect.element(repositoryField(screen)).toHaveAccessibleDescription('Enter a repository address like https://github.com/owner/repository.')
      await expect.element(repositoryField(screen)).toHaveAttribute('aria-invalid', 'true')
      expect(faked.sent).toEqual([])
    })

    it.each<[string, Partial<ApiError>, string]>([
      ['GitHub has no such public repository', { statusCode: 422, code: 'github-repo-not-found' }, 'GitHub has no public repository at this address.'],
      ['the repository holds no Plugin', { statusCode: 422, code: 'import-no-plugin' }, 'This repository holds no Plugin at its root.'],
      ['the server does not take the address either', { statusCode: 400, code: 'github-url-invalid' }, 'Enter a repository address like https://github.com/owner/repository.'],
    ])('says under the field that %s, and keeps what was entered', async (_cause, refusal, message) => {
      const faked = fakeImporting({ answer: refuseWith(refusal) })
      const screen = await mountAddPlugin('/plugins/new?way=github')

      await repositoryField(screen).fill('https://github.com/usetrmnl/moon-phase')
      await importPlugin(screen).click()

      await expect.element(repositoryField(screen)).toHaveAccessibleDescription(message)
      await expect.element(repositoryField(screen)).toHaveValue('https://github.com/usetrmnl/moon-phase')
      expect(faked.sent).toHaveLength(1)
      expect(path(screen)).toBe('/plugins/new?way=github')
    })

    it('says that github.com did not answer and imports on "Try again"', async () => {
      const faked = fakeImporting({ answer: refuseWith({ statusCode: 502, code: 'upstream-unreachable' }) })
      const screen = await mountAddPlugin('/plugins/new?way=github')

      await repositoryField(screen).fill('https://github.com/usetrmnl/moon-phase')
      await importPlugin(screen).click()

      await expect.element(screen.getByRole('alert')).toHaveTextContent('github.com did not answer. Nothing was imported.')

      faked.answer = answerWith(FROM_GITHUB)
      await screen.getByRole('button', { name: 'Try again' }).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toHaveLength(2)
    })

    it('sends the Device the address carries', async () => {
      const faked = fakeImporting({ answer: answerWith(FROM_GITHUB) })
      const screen = await mountAddPlugin('/plugins/new?way=github&device=kitchen')

      await repositoryField(screen).fill('https://github.com/usetrmnl/moon-phase')
      await importPlugin(screen).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ githubUrl: 'https://github.com/usetrmnl/moon-phase', deviceId: 'kitchen' }])
      await expect.element(screen.getByText(/Imported from usetrmnl\/moon-phase\. Assigned to Kitchen\./)).toBeVisible()
    })
  })

  describe('the ways', () => {
    it('stand in the order Recipe, File, GitHub, then the two ways of building', async () => {
      fakeImporting()
      const screen = await mountAddPlugin('/plugins/new?way=carrier-pigeon')

      await expect.element(way(screen, 'Recipe')).toBeChecked()
      const radios = screen.getByRole('radiogroup', { name: 'Way to add a Plugin' }).getByRole('radio').elements()
      const places = ['Recipe', 'File', 'GitHub', 'Build a Poll Plugin', 'Build a Webhook Plugin'].map(name => radios.indexOf(way(screen, name).element()))
      expect(places).toEqual([0, 1, 2, 3, 4])
      expect(radios).toHaveLength(5)
      await way(screen, 'GitHub').click()
      expect(path(screen)).toBe('/plugins/new?way=github')
      await way(screen, 'File').click()
      expect(path(screen)).toBe('/plugins/new?way=file')
    })

    it('opens the Recipe way from "Import a Recipe" on the Plugins list', async () => {
      fakeImporting({ plugins: [buildPluginSummary()] })
      const screen = await mountApp({ at: '/plugins' })

      await screen.getByRole('link', { name: 'Import a Recipe' }).click()

      await expect.element(way(screen, 'Recipe')).toBeChecked()
      expect(path(screen)).toBe('/plugins/new?way=recipe')
    })
  })

  it('is accessible and does not overflow, for each way of importing with its trouble shown', async () => {
    fakeImporting({ plugins: [buildPluginSummary({ id: 'weather', sourceRecipeId: '41120' })], answer: refuseWith({ statusCode: 502, code: 'upstream-unreachable' }) })
    const screen = await mountAddPlugin('/plugins/new?device=kitchen')
    await screen.getByRole('textbox', { name: 'Recipe' }).fill('41120')
    await expect.element(screen.getByRole('status').filter({ hasText: 'You already have' })).toBeVisible()
    await screen.getByRole('button', { name: 'Import Recipe' }).click()
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()

    await way(screen, 'File').click()
    await screen.getByRole('button', { name: 'Import Plugin' }).click()
    await expect.element(screen.getByText('Choose a .zip to import.')).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()

    await way(screen, 'GitHub').click()
    await screen.getByRole('button', { name: 'Import Plugin' }).click()
    await expect.element(screen.getByRole('textbox', { name: 'Repository' })).toHaveAttribute('aria-invalid', 'true')

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
