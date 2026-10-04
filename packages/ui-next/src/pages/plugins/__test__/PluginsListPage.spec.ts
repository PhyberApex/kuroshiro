import type { PluginPlace, PluginSummary } from 'kuroshiro-shared'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, onTestFinished } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginDetail, buildPluginPlace, buildPluginSummary } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { takePluginArrival } from '../pluginArrival'

const device = (name: string) => ({ id: name.toLowerCase(), name })
const KITCHEN = device('Kitchen')
const HALLWAY = device('Hallway')
const STUDY = device('Study')

const TEN: PluginSummary[] = [
  buildPluginSummary({ id: 'bins', name: 'Bin day', devices: [KITCHEN], worstFetchFailureStreak: 1 }),
  buildPluginSummary({ id: 'calendar', name: 'Calendar', devices: [KITCHEN, STUDY] }),
  buildPluginSummary({ id: 'doorbell', name: 'Doorbell note', kind: 'Webhook', devices: [HALLWAY], webhookPayloadStored: true }),
  buildPluginSummary({ id: 'moon', name: 'Moon phase', devices: [KITCHEN, HALLWAY, STUDY] }),
  buildPluginSummary({ id: 'parcels', name: 'Parcel tracker', kind: 'Webhook', devices: [], webhookPayloadStored: false }),
  buildPluginSummary({ id: 'pollen', name: 'Pollen count', sourceRecipeId: '41120', devices: [], needsValues: true }),
  buildPluginSummary({ id: 'tides', name: 'Tide table', sourceRecipeId: '9001', devices: [], mashups: [buildPluginPlace({ screenId: 'weekend', name: 'Weekend board', deviceId: 'study', deviceName: 'Study' })] }),
  buildPluginSummary({ id: 'trains', name: 'Train departures', sourceRecipeId: '77', devices: [KITCHEN], fetchAlertFiring: true, worstFetchFailureStreak: 6 }),
  buildPluginSummary({ id: 'weather', name: 'Weather', sourceRecipeId: '12', devices: [KITCHEN, HALLWAY] }),
  buildPluginSummary({ id: 'word', name: 'Word of the day', devices: [], worstFetchFailureStreak: 3 }),
]
const FOUR_HEALTHY = [TEN[1]!, TEN[2]!, TEN[3]!, TEN[8]!]

interface Faked {
  plugins: PluginSummary[]
  /** The ids the page asked the server to delete. */
  deleted: string[]
}

/** Fakes what the list reads. What it holds is read on every request, so a test changes it and asks for a refresh. */
function fakePlugins(plugins: PluginSummary[] = TEN): Faked {
  const faked: Faked = { plugins, deleted: [] }
  fakeShellReads({ devices: [KITCHEN, HALLWAY, STUDY].map(({ id, name }) => buildDeviceSummary({ id, name })) })
  api.use(http.get(apiUrl('plugins'), () => HttpResponse.json(faked.plugins)))
  return faked
}

async function mountList(at = '/plugins') {
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { name: 'Plugins', level: 1 })).toBeVisible()
  return screen
}

type Mounted = Awaited<ReturnType<typeof mountList>>

const refresh = () => window.dispatchEvent(new Event('focus'))

// Read from the DOM and not by role: while a dialog is open, the list is hidden from assistive technology.
const rows = () => [...document.querySelectorAll('main li')]
const rowNames = () => rows().map(item => item.querySelector('a')?.textContent?.trim())
const row = (name: string) => rows().find(item => item.querySelector('a')?.textContent?.trim() === name)!
const rowText = (name: string) => [...row(name).children].slice(1, 4).map(cell => cell.textContent?.trim())

async function choose(screen: Mounted, plugin: string, action: 'Duplicate' | 'Export' | 'Delete Plugin') {
  await screen.getByRole('button', { name: `More actions for ${plugin}` }).click()
  await screen.getByRole('menuitem', { name: action }).click()
}

/** Catches what the page has the browser download, in place of the download. */
function catchDownloads() {
  const addresses: string[] = []
  const hold = (event: MouseEvent) => {
    if (event.target instanceof HTMLAnchorElement && event.target.hasAttribute('download')) {
      event.preventDefault()
      addresses.push(event.target.href)
    }
  }
  document.addEventListener('click', hold, true)
  onTestFinished(() => document.removeEventListener('click', hold, true))
  return addresses
}

function refuseDeletionFor(pluginId: string, mashups: PluginPlace[]) {
  api.use(http.delete(apiUrl(`plugins/${pluginId}`), () => apiErrorResponse({ statusCode: 409, code: 'plugin-in-mashup', message: 'The Plugin fills a slot in a Mashup.', details: { mashups } })))
}

describe('the Plugins list', () => {
  describe('seeing all Plugins', () => {
    it('lists every Plugin in the order the server gives, each with its kind, where it shows and its state', async () => {
      fakePlugins()
      const screen = await mountList()

      await expect.element(screen.getByRole('link', { name: 'Weather', exact: true })).toBeVisible()
      expect(rowNames()).toEqual(TEN.map(plugin => plugin.name))
      expect(rowText('Weather')).toEqual(['Poll Plugin · from a Recipe', 'On Kitchen and Hallway', ''])
      expect(rowText('Doorbell note')).toEqual(['Webhook Plugin', 'On Hallway', ''])
      expect(rowText('Moon phase')).toEqual(['Poll Plugin', 'On 3 Devices', ''])
      expect(rowText('Tide table')).toEqual(['Poll Plugin · from a Recipe', 'In a Mashup on Study', ''])
      await expect.element(screen.getByText('10 Plugins, by name · 4 with a problem')).toBeVisible()
    })

    it('reads the five states of the state column, the Alert before the Fetch Failure Streak, and only the Alert in the seal colour', async () => {
      fakePlugins()
      const screen = await mountList()

      await expect.element(screen.getByText('Alert: a Data Source keeps failing')).toBeVisible()
      expect(rowText('Train departures')[2]).toBe('Alert: a Data Source keeps failing')
      expect(rowText('Bin day')[2]).toBe('The last fetch failed')
      expect(rowText('Word of the day')[2]).toBe('3 fetches failed in a row')
      expect(rowText('Pollen count')[2]).toBe('A required Plugin Field is empty')
      expect(rowText('Parcel tracker')[2]).toBe('Nothing received yet')

      const list = screen.getByRole('main').getByRole('list').element()
      expect(elementsInSealColour(list).every(element => row('Train departures').contains(element))).toBe(true)
      expect(elementsInSealColour(list).length).toBeGreaterThan(0)
    })

    it('leads to the Plugin\'s page from a row, and to Add a Plugin from the title line', async () => {
      fakePlugins()
      const screen = await mountList()

      await expect.element(screen.getByRole('link', { name: 'Build a Plugin' })).toHaveAttribute('href', '/plugins/new?way=poll')
      await expect.element(screen.getByRole('link', { name: 'Import a Recipe' })).toHaveAttribute('href', '/plugins/new?way=recipe')
      await expect.element(screen.getByRole('link', { name: 'Weather', exact: true })).toHaveAttribute('href', '/plugins/weather')
    })

    it('shows a state that appears on the server without a reload', async () => {
      const faked = fakePlugins(FOUR_HEALTHY)
      const screen = await mountList()
      await expect.element(screen.getByText('4 Plugins, by name')).toBeVisible()

      faked.plugins = FOUR_HEALTHY.map(plugin => plugin.id === 'weather' ? { ...plugin, worstFetchFailureStreak: 1 } : plugin)
      refresh()

      await expect.element(screen.getByText('The last fetch failed')).toBeVisible()
      await expect.element(screen.getByText('4 Plugins, by name · 1 with a problem')).toBeVisible()
    })
  })

  describe('searching and filtering', () => {
    it('offers the search only above eight Plugins, and the filter only while a Plugin has a problem', async () => {
      fakePlugins(FOUR_HEALTHY)
      const screen = await mountList()

      await expect.element(screen.getByText('4 Plugins, by name')).toBeVisible()
      await expect.element(screen.getByRole('searchbox')).not.toBeInTheDocument()
      await expect.element(screen.getByRole('radiogroup')).not.toBeInTheDocument()
    })

    it('does not count "Nothing received yet" as a problem', async () => {
      fakePlugins(TEN.slice(1, 5))
      const screen = await mountList()

      await expect.element(screen.getByText('Nothing received yet')).toBeVisible()
      await expect.element(screen.getByText('4 Plugins, by name')).toBeVisible()
      await expect.element(screen.getByRole('radiogroup')).not.toBeInTheDocument()
    })

    it('filters by name as it is typed and holds the search in the address', async () => {
      fakePlugins()
      const screen = await mountList()

      await screen.getByRole('searchbox', { name: 'Find a Plugin' }).fill('da')

      await expect.element(screen.getByText('3 of 10 Plugins · 4 with a problem')).toBeVisible()
      expect(rowNames()).toEqual(['Bin day', 'Calendar', 'Word of the day'])
      expect(screen.router.currentRoute.value.query).toEqual({ q: 'da' })

      await screen.getByRole('searchbox', { name: 'Find a Plugin' }).fill('')

      await expect.element(screen.getByText('10 Plugins, by name · 4 with a problem')).toBeVisible()
      expect(screen.router.currentRoute.value.query).toEqual({})
    })

    it('shows only the Plugins with a problem and holds the filter in the address', async () => {
      fakePlugins()
      const screen = await mountList()

      await screen.getByRole('radio', { name: 'With a problem' }).click()

      await expect.element(screen.getByText('4 of 10 Plugins')).toBeVisible()
      expect(rowNames()).toEqual(['Bin day', 'Pollen count', 'Train departures', 'Word of the day'])
      expect(screen.router.currentRoute.value.query).toEqual({ show: 'problems' })

      await screen.getByRole('radio', { name: 'All' }).click()

      await expect.element(screen.getByText('10 Plugins, by name · 4 with a problem')).toBeVisible()
      expect(screen.router.currentRoute.value.query).toEqual({})
    })

    it('opens with the search and the filter the address holds', async () => {
      fakePlugins()
      const screen = await mountList('/plugins?q=o&show=problems')

      await expect.element(screen.getByText('2 of 10 Plugins')).toBeVisible()
      expect(rowNames()).toEqual(['Pollen count', 'Word of the day'])
      await expect.element(screen.getByRole('searchbox', { name: 'Find a Plugin' })).toHaveValue('o')
      await expect.element(screen.getByRole('radio', { name: 'With a problem' })).toBeChecked()
    })

    it('says that nothing matches, and shows all Plugins again on request', async () => {
      fakePlugins()
      const screen = await mountList('/plugins?q=tide&show=problems')

      await expect.element(screen.getByRole('heading', { name: 'No Plugin matches' })).toBeVisible()
      await expect.element(screen.getByText('No Plugin is called “tide” among those with a problem.')).toBeVisible()
      await expect.element(screen.getByText('0 of 10 Plugins')).toBeVisible()

      await screen.getByRole('button', { name: 'Show all Plugins' }).click()

      await expect.element(screen.getByText('10 Plugins, by name · 4 with a problem')).toBeVisible()
      expect(screen.router.currentRoute.value.query).toEqual({})
    })
  })

  describe('empty, loading and failed', () => {
    it('says what a Plugin is when there is none, with both ways to add one and no actions on the title line', async () => {
      fakePlugins([])
      const screen = await mountList()

      await expect.element(screen.getByRole('heading', { name: 'No Plugins yet' })).toBeVisible()
      await expect.element(screen.getByText('A Plugin fetches data and renders it with a template, for a Device to show as a Screen. Import one as a Recipe from TRMNL, or build your own.')).toBeVisible()
      expect(screen.getByRole('main').getByRole('link').elements().map(link => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
        ['Import a Recipe', '/plugins/new?way=recipe'],
        ['Build a Plugin', '/plugins/new?way=poll'],
      ])
    })

    it('says "Loading Plugins" while the answer takes long', async () => {
      fakeShellReads()
      api.use(http.get(apiUrl('plugins'), async () => {
        await delay('infinite')
        return HttpResponse.json([])
      }))
      const screen = await mountList()

      await expect.element(screen.getByRole('status').filter({ hasText: 'Loading Plugins' })).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'Import a Recipe' })).not.toBeInTheDocument()
    })

    it('says that the Plugins could not be loaded, and loads them on "Try again"', async () => {
      const faked = fakePlugins()
      api.use(http.get(apiUrl('plugins'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
      const screen = await mountList()

      await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Plugins. Something went wrong on the server.')

      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(screen.getByRole('link', { name: 'Weather', exact: true })).toBeVisible()
      await expect.element(screen.getByRole('alert')).not.toBeInTheDocument()
      expect(faked.plugins).toHaveLength(10)
    })
  })

  describe('duplicating a Plugin', () => {
    it('makes the copy and opens its page, carrying that it was duplicated and from what', async () => {
      fakePlugins()
      const copy = buildPluginDetail({ id: 'weather-copy', name: 'Weather (copy)', assignments: [] })
      api.use(
        http.post(apiUrl('plugins/weather/duplicate'), () => HttpResponse.json(copy, { status: 201 })),
        http.get(apiUrl('plugins/weather-copy'), () => HttpResponse.json(copy)),
      )
      const screen = await mountList()

      await choose(screen, 'Weather', 'Duplicate')

      await expect.element(screen.getByRole('heading', { name: 'Weather (copy)', level: 1 })).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toHaveAttribute('href', '/plugins')
      expect(screen.router.currentRoute.value.path).toBe('/plugins/weather-copy')
      expect(takePluginArrival('weather-copy')).toEqual({ how: 'duplicated', source: 'Weather' })
      expect(takePluginArrival('weather-copy')).toBeUndefined()
    })

    it('says why when the copy could not be made, and tries again on request', async () => {
      fakePlugins()
      api.use(http.post(apiUrl('plugins/weather/duplicate'), () => apiErrorResponse({ statusCode: 404, code: 'plugin-not-found' }), { once: true }))
      const screen = await mountList()

      await choose(screen, 'Weather', 'Duplicate')

      await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not duplicate Weather. That Plugin does not exist.')
      expect(screen.router.currentRoute.value.path).toBe('/plugins')

      const copy = buildPluginDetail({ id: 'weather-copy', name: 'Weather (copy)' })
      api.use(
        http.post(apiUrl('plugins/weather/duplicate'), () => HttpResponse.json(copy, { status: 201 })),
        http.get(apiUrl('plugins/weather-copy'), () => HttpResponse.json(copy)),
      )
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Weather (copy)', level: 1 })).toBeVisible()
    })
  })

  describe('exporting a Plugin', () => {
    it('downloads the Plugin from the server and reads "Exported" in the row for 2 seconds', async () => {
      fakePlugins()
      const downloads = catchDownloads()
      const screen = await mountList()

      await choose(screen, 'Bin day', 'Export')

      expect(downloads).toEqual([apiUrl('plugins/bins/export')])
      await expect.poll(() => rowText('Bin day')[2]).toBe('Exported')
      await expect.element(screen.getByRole('status').filter({ hasText: 'Exported Bin day.' })).toBeInTheDocument()

      const exportedAt = performance.now()
      await expect.poll(() => rowText('Bin day')[2], { timeout: 4000 }).toBe('The last fetch failed')
      expect(performance.now() - exportedAt).toBeGreaterThan(1500)
    })
  })

  describe('deleting a Plugin', () => {
    it('asks first, saying what is lost and what stays, then deletes the Plugin and shows the list without it', async () => {
      const faked = fakePlugins()
      api.use(http.delete(apiUrl('plugins/weather'), () => {
        faked.deleted.push('weather')
        faked.plugins = TEN.filter(plugin => plugin.id !== 'weather')
        return new HttpResponse(null, { status: 204 })
      }))
      const screen = await mountList()

      await choose(screen, 'Weather', 'Delete Plugin')

      const dialog = screen.getByRole('alertdialog', { name: 'Delete Weather?' })
      await expect.element(dialog).toBeVisible()
      await expect.element(dialog.getByText('The Plugin: its template, its Data Sources, its Plugin Fields and Field Values. Its Screen on Kitchen and Hallway, with their Schedules.')).toBeVisible()
      await expect.element(dialog.getByText('The other Screens of Kitchen and Hallway, which move up in the Order.')).toBeVisible()
      expect(faked.deleted).toEqual([])

      await dialog.getByRole('button', { name: 'Delete Plugin' }).click()

      await expect.element(screen.getByText('9 Plugins, by name · 4 with a problem')).toBeVisible()
      await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
      expect(faked.deleted).toEqual(['weather'])
      expect(rowNames()).not.toContain('Weather')
    })

    it('words what is lost for a Webhook-kind Plugin on no Device', async () => {
      fakePlugins()
      const screen = await mountList()

      await choose(screen, 'Parcel tracker', 'Delete Plugin')

      const dialog = screen.getByRole('alertdialog', { name: 'Delete Parcel tracker?' })
      await expect.element(dialog.getByText('The Plugin: its template, its Webhook URL and Webhook Payload, its Plugin Fields and Field Values.')).toBeVisible()
      await expect.element(dialog.getByText('Everything else. It is on no Device.')).toBeVisible()
    })

    it('keeps the Plugin when the admin cancels', async () => {
      const faked = fakePlugins()
      const screen = await mountList()

      await choose(screen, 'Weather', 'Delete Plugin')
      await screen.getByRole('button', { name: 'Cancel' }).click()

      await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
      expect(faked.deleted).toEqual([])
      expect(rowNames()).toContain('Weather')
    })

    it('stays open and says why when the server cannot delete', async () => {
      fakePlugins()
      api.use(http.delete(apiUrl('plugins/weather'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
      const screen = await mountList()

      await choose(screen, 'Weather', 'Delete Plugin')
      await screen.getByRole('button', { name: 'Delete Plugin' }).click()

      await expect.element(screen.getByText('Something went wrong on the server.')).toBeVisible()
      await expect.element(screen.getByRole('alertdialog', { name: 'Delete Weather?' })).toBeVisible()
    })

    it('says at once why a Plugin that fills a Mashup slot cannot be deleted, with no confirming button and the way to the Mashup', async () => {
      const faked = fakePlugins()
      const screen = await mountList()

      await choose(screen, 'Tide table', 'Delete Plugin')

      const dialog = screen.getByRole('alertdialog', { name: 'Tide table cannot be deleted yet' })
      await expect.element(dialog.getByText('It fills a slot in the Mashup Weekend board on Study. Give that slot another Plugin, or delete the Mashup. Then Tide table can be deleted.')).toBeVisible()
      expect(dialog.getByRole('button').elements().map(button => button.textContent?.trim())).toEqual(['Close'])
      await expect.element(dialog.getByRole('link', { name: 'Open the Mashup' })).toHaveAttribute('href', '/devices/study?screen=weekend')

      await dialog.getByRole('button', { name: 'Close' }).click()

      await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
      expect(faked.deleted).toEqual([])
    })

    it('words the dialog from the one Mashup the server refuses the delete for', async () => {
      fakePlugins()
      refuseDeletionFor('weather', [buildPluginPlace({ screenId: 'morning', name: 'Morning', deviceId: 'hallway', deviceName: 'Hallway' })])
      const screen = await mountList()

      await choose(screen, 'Weather', 'Delete Plugin')
      await screen.getByRole('button', { name: 'Delete Plugin' }).click()

      const dialog = screen.getByRole('alertdialog', { name: 'Weather cannot be deleted yet' })
      await expect.element(dialog.getByText('It fills a slot in the Mashup Morning on Hallway. Give that slot another Plugin, or delete the Mashup. Then Weather can be deleted.')).toBeVisible()
      expect(dialog.getByRole('button').elements().map(button => button.textContent?.trim())).toEqual(['Close'])
      await expect.element(dialog.getByRole('link', { name: 'Open the Mashup' })).toHaveAttribute('href', '/devices/hallway?screen=morning')
      expect(rowNames()).toContain('Weather')
    })

    it('names every Mashup when the server refuses the delete for several, without a way to one of them', async () => {
      fakePlugins()
      refuseDeletionFor('weather', [
        buildPluginPlace({ screenId: 'morning', name: 'Morning', deviceName: 'Hallway' }),
        buildPluginPlace({ screenId: 'weekend', name: 'Weekend board', deviceName: 'Study' }),
        buildPluginPlace({ screenId: 'unnamed', name: '', deviceName: 'Kitchen' }),
      ])
      const screen = await mountList()

      await choose(screen, 'Weather', 'Delete Plugin')
      await screen.getByRole('button', { name: 'Delete Plugin' }).click()

      const dialog = screen.getByRole('alertdialog', { name: 'Weather cannot be deleted yet' })
      await expect.element(dialog.getByText('It fills a slot in 3 Mashups: Morning on Hallway, Weekend board on Study, Unnamed Screen on Kitchen. Give those slots another Plugin, or delete the Mashups. Then Weather can be deleted.')).toBeVisible()
      expect(dialog.getByRole('button').elements().map(button => button.textContent?.trim())).toEqual(['Close'])
      await expect.element(dialog.getByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('the Plugin\'s page, until it is built', () => {
    it('shows the back link and the Plugin\'s name', async () => {
      fakeShellReads()
      api.use(http.get(apiUrl('plugins/weather'), () => HttpResponse.json(buildPluginDetail({ id: 'weather', name: 'Weather' }))))
      const screen = await mountApp({ at: '/plugins/weather' })

      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toHaveAttribute('href', '/plugins')
      await expectAccessible()
    })

    it('says "No Plugin here" for a Plugin that does not exist', async () => {
      fakeShellReads()
      api.use(http.get(apiUrl('plugins/gone'), () => apiErrorResponse({ statusCode: 404, code: 'plugin-not-found' })))
      const screen = await mountApp({ at: '/plugins/gone' })

      await expect.element(screen.getByRole('heading', { name: 'No Plugin here', level: 1 })).toBeVisible()
      await expect.element(screen.getByText('It may have been deleted.')).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toHaveAttribute('href', '/plugins')
    })
  })

  it('is accessible and does not overflow, with every state in the list', async () => {
    fakePlugins([...TEN, buildPluginSummary({ id: 'long', name: 'Zeitgeist-Wetterstationsübersichtsanzeige mit einem sehr langen Namen', sourceRecipeId: '5', devices: [KITCHEN, HALLWAY], worstFetchFailureStreak: 12 })])
    const screen = await mountList()
    await expect.element(screen.getByRole('link', { name: 'Weather', exact: true })).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('is accessible and does not overflow when empty and when nothing matches', async () => {
    const faked = fakePlugins([])
    const screen = await mountList()
    await expect.element(screen.getByRole('heading', { name: 'No Plugins yet' })).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalOverflow()

    faked.plugins = TEN
    refresh()
    await screen.router.push('/plugins?q=nothing')
    await expect.element(screen.getByRole('heading', { name: 'No Plugin matches' })).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
