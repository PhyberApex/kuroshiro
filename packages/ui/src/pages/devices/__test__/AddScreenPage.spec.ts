import type { PluginSummary } from 'kuroshiro-shared'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { kindOf, mountAddScreen, nameField, OPENED_ON_THE_NEW_SCREEN, path } from './addScreenHarness'
import { fakeKitchen, openedRow, words } from './screensViewHarness'

const KITCHEN = { id: 'kitchen', name: 'Kitchen' }

const PLUGINS: PluginSummary[] = [
  buildPluginSummary({ id: 'bins', name: 'Bin day', devices: [] }),
  buildPluginSummary({ id: 'calendar', name: 'Calendar', devices: [{ id: 'hallway', name: 'Hallway' }] }),
  buildPluginSummary({ id: 'doorbell', name: 'Doorbell note', kind: 'Webhook', devices: [] }),
  buildPluginSummary({ id: 'trains', name: 'Train departures', devices: [], needsValues: true }),
  buildPluginSummary({ id: 'weather', name: 'Weather', devices: [KITCHEN] }),
]

const MANY_PLUGINS: PluginSummary[] = [
  ...PLUGINS,
  ...['Moon phase', 'Pollen', 'Tide table', 'Word of the day'].map(name => buildPluginSummary({ id: name, name, devices: [] })),
]

type Mounted = Awaited<ReturnType<typeof mountAddScreen>>

const plugin = (screen: Mounted, name: string) => screen.getByRole('radiogroup', { name: 'Plugin', exact: true }).getByRole('radio', { name, exact: true })
const assignPlugin = (screen: Mounted) => screen.getByRole('button', { name: 'Assign Plugin' })
const findPlugin = (screen: Mounted) => screen.getByRole('searchbox', { name: 'Find a Plugin' })

describe('add Screen', () => {
  describe('the page', () => {
    it('stands under the Screens tab with the way back, the five kinds and the Plugin kind chosen', async () => {
      fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen()

      await expect.element(screen.getByRole('link', { name: 'Screens', exact: true })).toHaveAttribute('aria-current', 'page')
      await expect.element(screen.getByRole('link', { name: 'Kitchen\'s Screens' })).toHaveAttribute('href', '/devices/kitchen')
      const kinds = screen.getByRole('radiogroup', { name: 'Kind of Screen' }).getByRole('radio').elements()
      expect(kinds.map(kind => [kind.getAttribute('aria-labelledby'), kind.getAttribute('aria-describedby')].map(id => words(document.getElementById(id!))))).toEqual([
        ['Plugin', 'One of your Plugins, rendered for this Device'],
        ['Mashup', 'Several Plugins sharing one Screen in a layout'],
        ['External link', 'An image fetched from a URL'],
        ['File', 'An image you upload'],
        ['HTML', 'Markup you write here, with a live preview'],
      ])
      await expect.element(kindOf(screen, 'Plugin')).toBeChecked()
      await expect.element(assignPlugin(screen)).toBeVisible()
      await expect.element(screen.getByText('Joins the end of the Order, always shown until you give it a Schedule.')).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/devices/kitchen')
    })

    it('opens with the kind the address names, and shows another kind\'s form when it is chosen', async () => {
      fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('link')

      await expect.element(kindOf(screen, 'External link')).toBeChecked()
      await expect.element(screen.getByRole('textbox', { name: 'Image URL' })).toBeVisible()

      await kindOf(screen, 'Plugin').click()

      await expect.element(assignPlugin(screen)).toBeVisible()
      await expect.element(screen.getByRole('textbox', { name: 'Image URL' })).not.toBeInTheDocument()
      expect(path(screen)).toBe('/devices/kitchen/screens/new?kind=plugin')
    })

    it('keeps what was entered for a kind while another kind is looked at', async () => {
      fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('link')

      await nameField(screen).fill('Tide table')
      await kindOf(screen, 'Plugin').click()
      await expect.element(assignPlugin(screen)).toBeVisible()
      await kindOf(screen, 'External link').click()

      await expect.element(nameField(screen)).toHaveValue('Tide table')
    })

    it('falls back on the Plugin kind for a kind it does not know', async () => {
      fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('poster')

      await expect.element(kindOf(screen, 'Plugin')).toBeChecked()
    })

    it('disables the File kind in demo mode and says why', async () => {
      fakeKitchen({ plugins: PLUGINS, instance: buildInstanceFacts({ demoMode: true }) })
      const screen = await mountAddScreen('file')

      await expect.element(kindOf(screen, 'File')).toBeDisabled()
      await expect.element(kindOf(screen, 'File')).toHaveAccessibleDescription('Not available in the demo.')
      await expect.element(kindOf(screen, 'Plugin')).toBeChecked()
    })

    it('asks before leaving with something entered, and leaves at once with nothing entered', async () => {
      fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('link')

      await nameField(screen).fill('Tide table')
      await screen.getByRole('link', { name: 'Cancel' }).click()

      const question = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
      await expect.element(question).toBeVisible()
      await expect.element(question.getByText('What you entered for the new Screen.')).toBeVisible()
      await question.getByRole('button', { name: 'Keep editing' }).click()
      await expect.element(nameField(screen)).toHaveValue('Tide table')

      await nameField(screen).fill('')
      await screen.getByRole('link', { name: 'Cancel' }).click()
      await expect.poll(() => path(screen)).toBe('/devices/kitchen')
    })
  })

  describe('a Plugin', () => {
    it('assigns the chosen Plugin and opens its new row in the Screens view', async () => {
      const faked = fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('plugin')

      await expect.element(plugin(screen, 'Bin day')).toBeChecked()
      await plugin(screen, 'Doorbell note').click()
      await assignPlugin(screen).click()

      await expect.poll(() => path(screen)).toBe(OPENED_ON_THE_NEW_SCREEN)
      expect(faked.writes).toEqual([{ method: 'POST', path: 'plugins/doorbell/assign', body: { deviceId: 'kitchen' } }])
      await openedRow(screen, 'Doorbell note')
    })

    it('reads each Plugin\'s kind, notes an empty required Plugin Field and disables a Plugin already on the Device', async () => {
      fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('plugin')

      await expect.element(plugin(screen, 'Bin day')).toHaveAccessibleDescription('Poll Plugin')
      await expect.element(plugin(screen, 'Doorbell note')).toHaveAccessibleDescription('Webhook Plugin')
      await expect.element(plugin(screen, 'Train departures')).toHaveAccessibleDescription('Poll Plugin · a required Plugin Field is empty')
      await expect.element(plugin(screen, 'Train departures')).toBeEnabled()
      await expect.element(plugin(screen, 'Weather')).toBeDisabled()
      await expect.element(plugin(screen, 'Weather')).toHaveAccessibleDescription('Already on Kitchen')
      await expect.element(plugin(screen, 'Calendar')).toBeEnabled()
      await expect.element(findPlugin(screen)).not.toBeInTheDocument()
    })

    it('links to Add a Plugin carrying the Device', async () => {
      fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('plugin')

      const shortcut = screen.getByRole('link', { name: 'Import a Recipe or build one' })
      await expect.element(shortcut).toHaveAttribute('href', '/plugins/new?way=recipe&device=kitchen')
      expect(words(shortcut.element().parentElement)).toBe('No Plugin for it yet? Import a Recipe or build one; it is assigned to Kitchen when you save it.')
    })

    it('finds a Plugin by name from nine Plugins on, and says when none is called that', async () => {
      const faked = fakeKitchen({ plugins: MANY_PLUGINS })
      const screen = await mountAddScreen('plugin')

      await findPlugin(screen).fill('ti')
      await expect.element(plugin(screen, 'Tide table')).toBeChecked()
      await expect.element(plugin(screen, 'Bin day')).not.toBeInTheDocument()

      await findPlugin(screen).fill('tides')
      await expect.element(screen.getByText('No Plugin is called “tides”.')).toBeVisible()
      await expect.element(assignPlugin(screen)).toBeDisabled()

      await findPlugin(screen).fill('ti')
      await assignPlugin(screen).click()
      await expect.poll(() => faked.writes).toEqual([{ method: 'POST', path: 'plugins/Tide table/assign', body: { deviceId: 'kitchen' } }])
    })

    it('shows the empty state with both ways to a first Plugin, each carrying the Device', async () => {
      fakeKitchen({ plugins: [] })
      const screen = await mountAddScreen('plugin')

      await expect.element(screen.getByRole('heading', { name: 'No Plugins yet' })).toBeVisible()
      await expect.element(screen.getByText('A Plugin fetches data and renders it with a template. Import one as a Recipe from TRMNL, or build your own. Either way it is assigned to Kitchen when you save it.')).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'Import a Recipe', exact: true })).toHaveAttribute('href', '/plugins/new?way=recipe&device=kitchen')
      await expect.element(screen.getByRole('link', { name: 'Build a Plugin' })).toHaveAttribute('href', '/plugins/new?way=poll&device=kitchen')
      await expect.element(assignPlugin(screen)).not.toBeInTheDocument()
    })

    it('says so when the Plugins cannot be loaded, and loads them on "Try again"', async () => {
      fakeKitchen({ plugins: PLUGINS })
      let fails = true
      api.use(http.get(apiUrl('plugins'), () => fails ? apiErrorResponse({ statusCode: 500, code: 'internal' }) : HttpResponse.json(PLUGINS)))
      const screen = await mountAddScreen('plugin')

      await expect.element(screen.getByText('Could not load the Plugins.')).toBeVisible()
      fails = false
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(plugin(screen, 'Bin day')).toBeChecked()
      await expect.element(screen.getByText('Could not load the Plugins.')).not.toBeInTheDocument()
    })

    it('keeps the choice and says why when the Plugin is on the Device after all', async () => {
      fakeKitchen({ plugins: PLUGINS })
      api.use(http.post(apiUrl('plugins/:id/assign'), async () => {
        await delay(50)
        return apiErrorResponse({ statusCode: 409, code: 'plugin-already-assigned' })
      }))
      const screen = await mountAddScreen('plugin')

      await plugin(screen, 'Calendar').click()
      await assignPlugin(screen).click()

      await expect.element(screen.getByText('Not assigned. That Plugin is already on this Device.')).toBeVisible()
      await expect.element(plugin(screen, 'Calendar')).toBeChecked()
      expect(path(screen)).toBe('/devices/kitchen/screens/new?kind=plugin')
    })

    it('is accessible and does not overflow, with the Plugins and without any', async () => {
      fakeKitchen({ plugins: MANY_PLUGINS })
      const screen = await mountAddScreen('plugin')
      await expect.element(plugin(screen, 'Bin day')).toBeChecked()

      await expectAccessible()
      await expectNoHorizontalOverflow()
    })
  })
})
