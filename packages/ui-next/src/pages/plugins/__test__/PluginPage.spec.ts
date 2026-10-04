import type { PluginArrival } from '../pluginArrival'
import type { Mounted } from './pluginPageHarness'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildPluginDetail, buildPluginPlace } from '@/testing/fixtures/plugins'
import { mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { freezeTime } from '@/testing/time'
import { holdTabVisible } from '@/testing/visibility'
import { openPluginPage } from '../pluginArrival'
import StandInPluginPage from './examples/StandInPluginPage.vue'
import { catchDownloads, clock, fakePlugin, mountPlugin, NOW, refresh, saveBar, WEATHER } from './pluginPageHarness'

const SOURCE = WEATHER.dataSources[0]!

const factsLine = () => document.querySelector('main .plugin-facts')?.textContent?.replace(/\s+/g, ' ').trim()

const nameField = (screen: Mounted) => screen.getByRole('textbox', { name: 'Name' })

async function openNaming(screen: Mounted) {
  await screen.getByRole('button', { name: 'Name and description' }).click()
  await expect.element(nameField(screen)).toBeVisible()
}

async function rename(screen: Mounted, name: string) {
  await openNaming(screen)
  await nameField(screen).fill(name)
}

async function openActions(screen: Mounted, plugin = 'Weather') {
  await screen.getByRole('button', { name: `Duplicate, export or delete ${plugin}` }).click()
}

describe('the Plugin page', () => {
  describe('the frame', () => {
    it('shows the back link, the name as the title and the facts of a Poll-kind Plugin', async () => {
      fakePlugin(buildPluginDetail({ id: 'weather', recipe: { id: '41120', name: 'Weather report', importedAt: '2026-09-12T09:20:00.000Z', snapshotTakenAt: null } }))
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toHaveAttribute('href', '/plugins')
      await expect.poll(factsLine).toBe('Poll Plugin · Fetches every 30 minutes · On Kitchen · From the Recipe Weather report')
      expect(document.title).toBe('Weather · Kuroshiro')
    })

    it('shows when a Webhook-kind Plugin last received its Webhook Payload, or that it has received nothing', async () => {
      const webhook = { token: 'tok', url: 'https://kuroshiro.test/api/webhook/tok', mergeStrategy: 'standard' as const, streamLimit: null, payload: { title: 'Ring' }, payloadReceivedAt: '2026-10-03T07:31:00.000Z' }
      const faked = fakePlugin(buildPluginDetail({ id: 'weather', kind: 'Webhook', refreshInterval: null, dataSources: [], assignments: [], webhook }))
      await mountPlugin()

      await expect.poll(factsLine).toBe('Webhook Plugin · Last received 4 min ago · Not on a Device')

      faked.plugin = { ...faked.plugin, webhook: { ...webhook, payload: null, payloadReceivedAt: null } }
      refresh()

      await expect.poll(factsLine).toBe('Webhook Plugin · Nothing received yet · Not on a Device')
    })

    it('says that there is no Plugin here for one that does not exist', async () => {
      fakeShellReads()
      api.use(http.get(apiUrl('plugins/gone'), () => apiErrorResponse({ statusCode: 404, code: 'plugin-not-found' })))
      const screen = await mountApp({ at: '/plugins/gone' })

      await expect.element(screen.getByRole('heading', { name: 'No Plugin here' })).toBeVisible()
      await expect.element(screen.getByText('It may have been deleted.')).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toHaveAttribute('href', '/plugins')
    })

    it('shows the loading line over the Template heading, a wash block and a rendering plate while the Plugin loads', async () => {
      fakeShellReads()
      api.use(http.get(apiUrl('plugins/weather'), async () => {
        await delay(1500)
        return HttpResponse.json(WEATHER)
      }))
      const screen = await mountApp({ at: '/plugins/weather' })

      await expect.element(screen.getByRole('status').filter({ hasText: 'Loading the Plugin' })).toBeVisible()
      await expect.element(screen.getByText('Template', { exact: true })).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toBeVisible()
      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()
      await expect.element(screen.getByText('Template', { exact: true })).not.toBeInTheDocument()
    })

    it('says that the Plugin could not be loaded and tries again', async () => {
      fakeShellReads()
      api.use(http.get(apiUrl('plugins/weather'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
      const screen = await mountApp({ at: '/plugins/weather' })
      await expect.element(screen.getByText('Could not load the Plugin.')).toBeVisible()

      fakePlugin()
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()
    })

    it('keeps the form usable under a refresh that failed', async () => {
      const faked = fakePlugin()
      const screen = await mountPlugin()
      api.use(http.get(apiUrl('plugins/weather'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
      refresh()
      await expect.element(screen.getByText('Could not load Weather.')).toBeVisible()

      await rename(screen, 'Forecast')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Forecast', level: 1 })).toBeVisible()
      expect(faked.saves).toEqual([{ name: 'Forecast' }])
    })
  })

  describe('editing a Plugin', () => {
    it('renames the Plugin: the save sends only the name, the title follows and the page stays', async () => {
      const faked = fakePlugin()
      const screen = await mountPlugin()
      await expect.element(saveBar(screen)).not.toBeInTheDocument()

      await rename(screen, 'Forecast')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the name.')).toBeVisible()
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Forecast', level: 1 })).toBeVisible()
      await expect.element(saveBar(screen)).not.toBeInTheDocument()
      await expect.element(screen.getByText(`Saved at ${clock(NOW)}. Fetching and rendering again for Kitchen.`)).toBeVisible()
      await expect.element(screen.getByRole('button', { name: 'Duplicate, export or delete Forecast' })).toBeVisible()
      expect(faked.saves).toEqual([{ name: 'Forecast' }])
      expect(screen.router.currentRoute.value.path).toBe('/plugins/weather')
      expect(document.title).toBe('Forecast · Kuroshiro')
    })

    it('saves the description with the name in one request, and says only the time for a Plugin on no Device', async () => {
      const faked = fakePlugin(buildPluginDetail({ id: 'weather', assignments: [] }))
      const screen = await mountPlugin()

      await rename(screen, 'Forecast')
      await screen.getByRole('textbox', { name: 'Description' }).fill('')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the name and description.')).toBeVisible()
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(screen.getByText(`Saved at ${clock(NOW)}.`, { exact: true })).toBeVisible()
      expect(faked.saves).toEqual([{ name: 'Forecast', description: null }])

      await screen.getByRole('button', { name: 'Dismiss' }).click()
      await expect.element(screen.getByText(`Saved at ${clock(NOW)}.`, { exact: true })).not.toBeInTheDocument()
    })

    it('puts every field back on "Discard changes" and asks nothing', async () => {
      const faked = fakePlugin()
      const screen = await mountPlugin()

      await rename(screen, 'Forecast')
      await saveBar(screen).getByRole('button', { name: 'Discard changes' }).click()

      await expect.element(nameField(screen)).toHaveValue('Weather')
      await expect.element(saveBar(screen)).not.toBeInTheDocument()
      await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
      expect(faked.saves).toEqual([])
    })

    it('does not save an empty name: the bar counts it, and "Show the first" opens the tucked section and focuses the field', async () => {
      const faked = fakePlugin()
      const screen = await mountPlugin()

      await rename(screen, '')
      await screen.getByRole('button', { name: 'Name and description' }).click()
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(saveBar(screen).getByText('1 thing to fix before this can be saved.')).toBeVisible()
      expect(faked.saves).toEqual([])
      await expect.element(nameField(screen)).not.toBeInTheDocument()

      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()

      await expect.element(nameField(screen)).toHaveFocus()
      await expect.element(screen.getByText('A Plugin needs a name.')).toBeVisible()
      await expect.element(nameField(screen)).toHaveAttribute('aria-invalid', 'true')

      await nameField(screen).fill('Forecast')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the name.')).toBeVisible()
    })

    it('keeps what was entered when the server refuses the save, says why and saves on "Try again"', async () => {
      const faked = fakePlugin()
      const screen = await mountPlugin()
      api.use(http.patch(apiUrl('plugins/weather'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))

      await rename(screen, 'Forecast')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(saveBar(screen).getByText(/^Not saved\. /)).toBeVisible()
      await expect.element(nameField(screen)).toHaveValue('Forecast')
      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()

      await saveBar(screen).getByRole('button', { name: 'Try again' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Forecast', level: 1 })).toBeVisible()
      expect(faked.saves).toEqual([{ name: 'Forecast' }])
    })

    it('shows the server\'s own message under the field it refused', async () => {
      fakePlugin()
      const screen = await mountPlugin()
      api.use(http.patch(apiUrl('plugins/weather'), () => apiErrorResponse({ statusCode: 400, code: 'validation', fields: [{ path: 'name', message: 'name must be shorter than or equal to 255 characters' }] })))

      await rename(screen, 'Forecast')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(screen.getByText('name must be shorter than or equal to 255 characters')).toBeVisible()
      await expect.element(saveBar(screen).getByText('1 thing to fix before this can be saved.')).toBeVisible()
    })
  })

  describe('a section that joins the form', () => {
    async function mountStandIn() {
      freezeTime(NOW)
      holdTabVisible()
      const screen = await mountPage({
        routes: [{ path: '/plugins/:pluginId', component: StandInPluginPage }, { path: '/plugins', component: { template: '<h1>Plugins</h1>' } }],
        at: '/plugins/weather',
      })
      await expect.element(screen.getByRole('heading', { name: 'Stand-in' })).toBeVisible()
      return screen
    }
    const minutes = (screen: Mounted) => screen.getByRole('spinbutton', { name: 'Minutes between fetches' })

    it('takes part in what differs and in the save, beside the page\'s own fields', async () => {
      const faked = fakePlugin()
      const screen = await mountStandIn()

      await screen.getByRole('button', { name: 'Fetch' }).click()
      await minutes(screen).fill('45')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the refresh interval.')).toBeVisible()
      await rename(screen, 'Forecast')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the refresh interval and name.')).toBeVisible()
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(saveBar(screen)).not.toBeInTheDocument()
      expect(faked.saves).toEqual([{ refreshInterval: 45, name: 'Forecast' }])
    })

    it('stops the save with its own rule, and "Show the first" opens what holds its field and focuses it', async () => {
      const faked = fakePlugin()
      const screen = await mountStandIn()

      await screen.getByRole('button', { name: 'Fetch' }).click()
      await minutes(screen).fill('0')
      await screen.getByRole('button', { name: 'Fetch' }).click()
      await rename(screen, '')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(saveBar(screen).getByText('2 things to fix before this can be saved.')).toBeVisible()
      expect(faked.saves).toEqual([])

      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()

      await expect.element(minutes(screen)).toHaveFocus()
      await expect.element(screen.getByText('Enter between 1 minute and 24 hours.')).toBeVisible()
    })

    it('is handed the server\'s field error for the path it owns', async () => {
      fakePlugin()
      const screen = await mountStandIn()
      api.use(http.patch(apiUrl('plugins/weather'), () => apiErrorResponse({ statusCode: 400, code: 'validation', fields: [{ path: 'refreshInterval', message: 'refreshInterval must not be greater than 1440' }] })))

      await screen.getByRole('button', { name: 'Fetch' }).click()
      await minutes(screen).fill('45')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(screen.getByText('refreshInterval must not be greater than 1440')).toBeVisible()
    })

    it('is handed the fresh facts of a refresh while its unsaved field stays as entered', async () => {
      const faked = fakePlugin()
      const screen = await mountStandIn()

      await screen.getByRole('button', { name: 'Fetch' }).click()
      await minutes(screen).fill('45')
      await screen.getByRole('heading', { name: 'Stand-in' }).click()
      faked.plugin = { ...WEATHER, refreshInterval: 120, dataSources: [{ ...SOURCE, fetchFailureStreak: 3 }] }
      refresh()

      await expect.element(screen.getByText('Its Fetch Failure Streak is 3.')).toBeVisible()
      await expect.element(minutes(screen)).toHaveValue(45)
    })
  })

  describe('leaving with unsaved changes', () => {
    it('asks on a route change, stays on "Keep editing" and leaves on "Leave"', async () => {
      fakePlugin()
      api.use(http.get(apiUrl('plugins'), () => HttpResponse.json([])))
      const screen = await mountPlugin()

      await rename(screen, 'Forecast')
      await screen.getByRole('link', { name: 'All Plugins' }).click()

      const question = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
      await expect.element(question.getByText('Your changes to Weather\'s name.')).toBeVisible()
      await question.getByRole('button', { name: 'Keep editing' }).click()
      expect(screen.router.currentRoute.value.path).toBe('/plugins/weather')
      await expect.element(nameField(screen)).toHaveValue('Forecast')

      await screen.getByRole('link', { name: 'All Plugins' }).click()
      await screen.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Plugins', level: 1 })).toBeVisible()
    })

    it('asks on the way to another Plugin\'s page, and not when only the fragment changes', async () => {
      fakePlugin()
      const tides = buildPluginDetail({ id: 'tides', name: 'Tide table' })
      api.use(http.get(apiUrl('plugins/tides'), () => HttpResponse.json(tides)))
      const screen = await mountPlugin()

      await rename(screen, 'Forecast')
      await screen.router.push('/plugins/weather#actions')
      await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()

      void screen.router.push('/plugins/tides')
      await screen.getByRole('alertdialog', { name: 'Leave without saving?' }).getByRole('button', { name: 'Leave' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Tide table', level: 1 })).toBeVisible()
    })

    it('does not ask when nothing was changed', async () => {
      fakePlugin()
      api.use(http.get(apiUrl('plugins'), () => HttpResponse.json([])))
      const screen = await mountPlugin()

      await screen.getByRole('link', { name: 'All Plugins' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Plugins', level: 1 })).toBeVisible()
    })

    it('asks before duplicating, and on "Leave" opens the copy\'s page, which says what it is a copy of', async () => {
      fakePlugin()
      const copy = buildPluginDetail({ id: 'weather-copy', name: 'Weather (copy)', assignments: [] })
      let duplicated = 0
      api.use(
        http.post(apiUrl('plugins/weather/duplicate'), () => {
          duplicated += 1
          return HttpResponse.json(copy, { status: 201 })
        }),
        http.get(apiUrl('plugins/weather-copy'), () => HttpResponse.json(copy)),
      )
      const screen = await mountPlugin()

      await rename(screen, 'Forecast')
      await openActions(screen)
      await screen.getByRole('button', { name: 'Duplicate' }).click()

      const question = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
      await question.getByRole('button', { name: 'Keep editing' }).click()
      await expect.element(question).not.toBeInTheDocument()
      expect(duplicated).toBe(0)

      await screen.getByRole('button', { name: 'Duplicate' }).click()
      await screen.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Weather (copy)', level: 1 })).toBeVisible()
      await expect.element(screen.getByText('A copy of Weather. It is not on a Device yet.')).toBeVisible()
      await expect.element(saveBar(screen)).not.toBeInTheDocument()
      expect(screen.router.currentRoute.value.path).toBe('/plugins/weather-copy')
      expect(duplicated).toBe(1)
    })

    it('asks before exporting, and exports at once when nothing was changed, the button reading "Exported"', async () => {
      fakePlugin()
      const downloads = catchDownloads()
      const screen = await mountPlugin()

      await openActions(screen)
      await screen.getByRole('button', { name: 'Export' }).click()

      await expect.element(screen.getByRole('button', { name: 'Exported' })).toBeVisible()
      expect(downloads).toEqual([apiUrl('plugins/weather/export')])
      await expect.element(screen.getByRole('button', { name: 'Export', exact: true }), { timeout: 4000 }).toBeVisible()

      await rename(screen, 'Forecast')
      await screen.getByRole('button', { name: 'Export', exact: true }).click()

      await expect.element(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeVisible()
      await screen.getByRole('alertdialog').getByRole('button', { name: 'Keep editing' }).click()
      expect(downloads).toHaveLength(1)
    })
  })

  describe('duplicate, export or delete', () => {
    it('says what each does, for a Poll-kind Plugin', async () => {
      fakePlugin()
      const screen = await mountPlugin()

      await openActions(screen)

      await expect.element(screen.getByText('A duplicate is a second Plugin with the same template, Data Sources, Plugin Fields and Field Values, on no Device.', { exact: false })).toBeVisible()
      await expect.element(screen.getByText('Deleting removes Weather from this Instance and from Kitchen.', { exact: false })).toBeVisible()
    })

    it('says why a duplicate could not be made and tries again', async () => {
      fakePlugin()
      api.use(http.post(apiUrl('plugins/weather/duplicate'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
      const screen = await mountPlugin()

      await openActions(screen)
      await screen.getByRole('button', { name: 'Duplicate' }).click()

      await expect.element(screen.getByText('Could not duplicate Weather.')).toBeVisible()
      await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    })

    it('deletes the Plugin after asking and opens the list, without asking about unsaved changes', async () => {
      fakePlugin()
      const deleted: string[] = []
      api.use(
        http.delete(apiUrl('plugins/weather'), () => {
          deleted.push('weather')
          return new HttpResponse(null, { status: 204 })
        }),
        http.get(apiUrl('plugins'), () => HttpResponse.json([])),
      )
      const screen = await mountPlugin()

      await rename(screen, 'Forecast')
      await openActions(screen)
      await screen.getByRole('button', { name: 'Delete Plugin' }).click()
      const question = screen.getByRole('alertdialog', { name: 'Delete Weather?' })
      await expect.element(question.getByText('Its Screen on Kitchen, with its Schedule.', { exact: false })).toBeVisible()
      await question.getByRole('button', { name: 'Delete Plugin' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Plugins', level: 1 })).toBeVisible()
      expect(deleted).toEqual(['weather'])
    })

    it('says why a Plugin that fills a Mashup slot cannot be deleted yet', async () => {
      fakePlugin(buildPluginDetail({ id: 'weather', mashups: [buildPluginPlace()] }))
      const screen = await mountPlugin()

      await openActions(screen)
      await screen.getByRole('button', { name: 'Delete Plugin' }).click()

      await expect.element(screen.getByRole('alertdialog', { name: 'Weather cannot be deleted yet' })).toBeVisible()
    })
  })

  describe('lines shown once', () => {
    async function arriveWith(arrival: PluginArrival) {
      fakePlugin()
      api.use(http.get(apiUrl('plugins'), () => HttpResponse.json([])))
      freezeTime(NOW)
      const screen = await mountApp({ at: '/plugins' })
      await openPluginPage(screen.router, 'weather', arrival)
      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()
      return screen
    }

    it.each<[PluginArrival, string]>([
      [{ how: 'created' }, 'Created. It shows its name until you write its template. It is not on a Device yet.'],
      [{ how: 'duplicated', source: 'Forecast' }, 'A copy of Forecast. It is not on a Device yet.'],
      [{ how: 'imported', origin: 'recipe', name: 'Weather report', hasTransform: false }, 'Imported from the Recipe Weather report. It is not on a Device yet.'],
      [{ how: 'imported', origin: 'file', name: 'weather.trmnlp.zip', hasTransform: true }, 'Imported from weather.trmnlp.zip. It is not on a Device yet. It brings a transform: JavaScript that runs on this server at every fetch. Read it under Data Sources.'],
      [{ how: 'imported', origin: 'github', name: 'usetrmnl/weather', hasTransform: false }, 'Imported from usetrmnl/weather. It is not on a Device yet.'],
      [{ how: 'applied', updateItems: 3, recipe: 'Weather report' }, 'Applied 3 Update Items from the Recipe Weather report.'],
      [{ how: 'skipped', updateItems: 2, recipe: 'Weather report' }, 'Skipped 2 Update Items from the Recipe Weather report.'],
    ])('says what just happened for %j', async (arrival, line) => {
      const screen = await arriveWith(arrival)

      await expect.element(screen.getByRole('status').filter({ hasText: line })).toBeVisible()
    })

    it('says which Device the Plugin was assigned to, with the link back to its Screens, until it is dismissed', async () => {
      const screen = await arriveWith({ how: 'created', device: { id: 'kitchen', name: 'Kitchen' } })

      await expect.element(screen.getByText('Created. It shows its name until you write its template. Assigned to Kitchen.', { exact: false })).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'Back to Kitchen\'s Screens' })).toHaveAttribute('href', '/devices/kitchen')

      await screen.getByRole('button', { name: 'Dismiss' }).click()

      await expect.element(screen.getByText('Assigned to Kitchen.', { exact: false })).not.toBeInTheDocument()
    })

    it('shows no line after a reload', async () => {
      const first = await arriveWith({ how: 'created' })
      await expect.element(first.getByText('Created.', { exact: false })).toBeVisible()
      first.unmount()

      const screen = await mountPlugin()

      await expect.element(screen.getByText('Created.', { exact: false })).not.toBeInTheDocument()
      await expect.element(screen.getByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    })
  })

  describe('problems', () => {
    const problemLines = () => [...document.querySelectorAll('main .problem-lines li')]
    const problemLine = (text: string) => problemLines().find(line => line.textContent?.includes(text))

    it('shows the four problems, each with the link to where it is fixed, and only the Alert in the seal colour', async () => {
      fakePlugin(buildPluginDetail({
        id: 'weather',
        dataSources: [
          { ...SOURCE, id: 'a', name: 'forecast', fetchFailureStreak: 6, alertFiring: true },
          { ...SOURCE, id: 'b', name: 'pollen', fetchFailureStreak: 1 },
          { ...SOURCE, id: 'c', name: 'tides' },
        ],
        fields: [
          { id: 'f1', keyname: 'latitude', label: 'Latitude', type: 'string', helpText: null, default: null, required: true, order: 0, options: null },
          { id: 'f2', keyname: 'api_key', label: 'API key', type: 'password', helpText: null, default: null, required: true, order: 1, options: null },
          { id: 'f3', keyname: 'units', label: 'Units', type: 'string', helpText: null, default: 'metric', required: true, order: 2, options: null },
        ],
        fieldValues: { latitude: { secret: false, value: null }, api_key: { secret: true, set: false }, units: { secret: false, value: null } },
        needsValues: true,
        lastScheduledRender: { at: '2026-10-03T07:30:00.000Z', error: { message: 'undefined filter: shout, line 4', line: 4, size: 'full' } },
      }))
      const screen = await mountPlugin()

      await expect.element(screen.getByText('Alert: the Data Source forecast keeps failing')).toBeVisible()
      await expect.element(screen.getByText('The last fetch of the Data Source pollen failed.')).toBeVisible()
      await expect.element(screen.getByText('2 required Plugin Fields are empty: Latitude and API key. Weather renders without them.')).toBeVisible()
      await expect.element(screen.getByText(`The template could not be rendered at ${clock('2026-10-03T07:30:00.000Z')}: undefined filter: shout, line 4`)).toBeVisible()
      expect(problemLines()).toHaveLength(4)

      const linkOf = (text: string) => problemLine(text)?.querySelector('a')
      expect(linkOf('forecast')?.textContent?.trim()).toBe('See the error')
      expect(linkOf('forecast')?.getAttribute('href')).toBe('/plugins/weather?source=forecast')
      expect(linkOf('pollen')?.getAttribute('href')).toBe('/plugins/weather?source=pollen')
      expect(linkOf('required Plugin Fields')?.textContent?.trim()).toBe('Fill in the Field Values')
      expect(linkOf('required Plugin Fields')?.getAttribute('href')).toBe('/plugins/weather#values')
      expect(linkOf('could not be rendered')?.textContent?.trim()).toBe('Open the template')
      expect(linkOf('could not be rendered')?.getAttribute('href')).toBe('/plugins/weather#template')

      const main = screen.getByRole('main').element()
      expect(elementsInSealColour(main).length).toBeGreaterThan(0)
      const whereTheAlertShows = [problemLine('forecast')!, screen.getByRole('button', { name: 'forecast', exact: true }).element().closest('li')!]
      expect(elementsInSealColour(main).every(element => whereTheAlertShows.some(place => place.contains(element)))).toBe(true)
    })

    it('names the one required Plugin Field that is empty', async () => {
      fakePlugin(buildPluginDetail({
        id: 'weather',
        fields: [{ id: 'f1', keyname: 'latitude', label: 'Latitude', type: 'string', helpText: null, default: null, required: true, order: 0, options: null }],
        fieldValues: { latitude: { secret: false, value: null } },
        needsValues: true,
      }))
      const screen = await mountPlugin()

      await expect.element(screen.getByText('The required Plugin Field Latitude is empty. Weather renders without it.')).toBeVisible()
    })

    it('shows no problem line and no "all good" line for a healthy Plugin', async () => {
      fakePlugin()
      const screen = await mountPlugin()

      await expect.poll(factsLine).toContain('Poll Plugin')
      expect(problemLines()).toHaveLength(0)
      expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])
    })
  })

  describe('the 30-second refresh', () => {
    it('changes the facts line and the problems and leaves a changed form alone', async () => {
      const faked = fakePlugin()
      const screen = await mountPlugin()

      await rename(screen, 'Forecast')
      await screen.getByRole('heading', { name: 'Weather', level: 1 }).click()
      faked.plugin = { ...WEATHER, name: 'Weather, renamed elsewhere', refreshInterval: 60, dataSources: [{ ...SOURCE, fetchFailureStreak: 1 }] }
      refresh()

      await expect.poll(factsLine).toBe('Poll Plugin · Fetches every hour · On Kitchen')
      await expect.element(screen.getByText('The last fetch of the Data Source forecast failed.')).toBeVisible()
      await expect.element(nameField(screen)).toHaveValue('Forecast')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the name.')).toBeVisible()
    })
  })

  describe('accessibility and layout', () => {
    it('is accessible in both themes and does not scroll sideways, with a problem, a line shown once and the save bar', async () => {
      fakePlugin(buildPluginDetail({ id: 'weather', dataSources: [{ ...SOURCE, fetchFailureStreak: 6, alertFiring: true }] }))
      const screen = await mountPlugin()

      await rename(screen, 'Forecast')
      await openActions(screen)
      await expect.element(saveBar(screen)).toBeVisible()

      await expectAccessible()
      await expectNoHorizontalOverflow()
    })
  })
})
