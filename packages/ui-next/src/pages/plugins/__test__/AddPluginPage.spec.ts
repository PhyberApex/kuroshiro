import type { ApiError, CreatePluginInput, PluginDetail } from 'kuroshiro-shared'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'

const KITCHEN = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })

type Answer = (input: CreatePluginInput) => Response | Promise<Response>

function created(input: CreatePluginInput): PluginDetail {
  return buildPluginDetail({ id: 'new-plugin', name: input.name, kind: input.kind, description: null, dataSources: [], assignments: [], lastScheduledRender: null })
}

/** Fakes the shell's reads, `POST /api/plugins` and the read of the Plugin it answers. `sent` holds every body, in order. */
function fakeBuilding(answer: Answer = input => HttpResponse.json(created(input), { status: 201 })) {
  const sent: CreatePluginInput[] = []
  let plugin: PluginDetail | undefined
  fakeShellReads({ devices: [KITCHEN] })
  api.use(
    http.get(apiUrl('plugins'), () => HttpResponse.json([])),
    http.post(apiUrl('plugins'), async ({ request }) => {
      const input = await request.json() as CreatePluginInput
      sent.push(input)
      plugin = created(input)
      return answer(input)
    }),
    http.get(apiUrl('plugins/new-plugin'), () => HttpResponse.json(plugin)),
  )
  return { sent }
}

async function mountAddPlugin(at = '/plugins/new') {
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { name: 'Add a Plugin', level: 1 })).toBeVisible()
  return screen
}

type Mounted = Awaited<ReturnType<typeof mountAddPlugin>>

const way = (screen: Mounted, name: string) => screen.getByRole('radiogroup', { name: 'Way to add a Plugin' }).getByRole('radio', { name, exact: true })
const mergeStrategy = (screen: Mounted, name: string) => screen.getByRole('radiogroup', { name: 'Merge Strategy' }).getByRole('radio', { name, exact: true })
const nameField = (screen: Mounted) => screen.getByRole('textbox', { name: 'Name' })
const createPlugin = (screen: Mounted) => screen.getByRole('button', { name: 'Create Plugin' })
const path = (screen: Mounted) => screen.router.currentRoute.value.fullPath

describe('add a Plugin', () => {
  describe('building a Poll Plugin', () => {
    it('creates the Plugin from its name alone and opens its page, which says so', async () => {
      const { sent } = fakeBuilding()
      const screen = await mountAddPlugin()

      await expect.element(way(screen, 'Build a Poll Plugin')).toBeChecked()
      await expect.element(way(screen, 'Build a Poll Plugin')).toHaveAccessibleDescription('Kuroshiro fetches the data on a schedule')
      await expect.element(screen.getByText('Kuroshiro fetches its Data Sources on a schedule and renders them with a template. You write both on the Plugin\'s page, which opens next.')).toBeVisible()
      await expect.element(screen.getByText('A Poll Plugin stays a Poll Plugin: the Plugin Kind cannot be changed later.')).toBeVisible()

      await nameField(screen).fill(' Weather ')
      await createPlugin(screen).click()

      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()
      expect(sent).toEqual([{ kind: 'Poll', name: 'Weather' }])
      expect(path(screen)).toBe('/plugins/new-plugin')
      await expect.element(screen.getByText('Created. It shows its name until you write its template. It is not on a Device yet.')).toBeVisible()
    })

    it('says that a Plugin needs a name and sends nothing', async () => {
      const { sent } = fakeBuilding()
      const screen = await mountAddPlugin()

      await nameField(screen).fill('   ')
      await createPlugin(screen).click()

      await expect.element(nameField(screen)).toHaveAccessibleDescription('A Plugin needs a name.')
      await expect.element(nameField(screen)).toHaveAttribute('aria-invalid', 'true')
      expect(sent).toEqual([])
      expect(path(screen)).toBe('/plugins/new')
    })

    it('shows the loading mark on the button while the Plugin is created', async () => {
      fakeBuilding(async (input) => {
        await delay(300)
        return HttpResponse.json(created(input), { status: 201 })
      })
      const screen = await mountAddPlugin()

      await nameField(screen).fill('Weather')
      await createPlugin(screen).click()

      await expect.element(createPlugin(screen)).toHaveAttribute('aria-busy', 'true')
      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()
    })
  })

  describe('building a Webhook Plugin', () => {
    it('opens with the way the address names, Replace chosen, and each Merge Strategy with its API value', async () => {
      fakeBuilding()
      const screen = await mountAddPlugin('/plugins/new?way=webhook')

      await expect.element(way(screen, 'Build a Webhook Plugin')).toBeChecked()
      await expect.element(way(screen, 'Build a Webhook Plugin')).toHaveAccessibleDescription('Another system sends the data')
      await expect.element(mergeStrategy(screen, 'Replace')).toBeChecked()
      await expect.element(mergeStrategy(screen, 'Replace')).toHaveAccessibleDescription('standard Each POST replaces the Webhook Payload.')
      await expect.element(mergeStrategy(screen, 'Deep merge')).toHaveAccessibleDescription('deep_merge Objects are merged key by key. An array is replaced.')
      await expect.element(mergeStrategy(screen, 'Stream')).toHaveAccessibleDescription('stream Top-level arrays are appended to, up to the Stream Limit. Other keys are replaced.')
      await expect.element(screen.getByText('deep_merge')).toHaveStyle({ fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono') })
      await expect.element(screen.getByRole('spinbutton', { name: 'Stream Limit' })).not.toBeInTheDocument()
      await expect.element(screen.getByText('Kuroshiro gives the Plugin a Webhook URL. Whatever is POSTed there becomes its Webhook Payload and is rendered at once.')).toBeVisible()
      await expect.element(screen.getByText('The Plugin Kind and the Merge Strategy cannot be changed later.')).toBeVisible()
    })

    it('creates the Plugin with its Merge Strategy, and no Stream Limit unless it streams', async () => {
      const { sent } = fakeBuilding()
      const screen = await mountAddPlugin('/plugins/new?way=webhook')

      await nameField(screen).fill('Doorbell note')
      await mergeStrategy(screen, 'Deep merge').click()
      await createPlugin(screen).click()

      await expect.element(screen.getByRole('heading', { name: 'Doorbell note', level: 1 })).toBeVisible()
      expect(sent).toEqual([{ kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'deep_merge' }])
    })

    it('asks for the Stream Limit of a stream, 20 to begin with, and sends it', async () => {
      const { sent } = fakeBuilding()
      const screen = await mountAddPlugin('/plugins/new?way=webhook')

      await nameField(screen).fill('Doorbell note')
      await mergeStrategy(screen, 'Stream').click()
      const limit = screen.getByRole('spinbutton', { name: 'Stream Limit' })
      await expect.element(limit).toHaveValue(20)
      await expect.element(screen.getByText('Keep the newest')).toBeVisible()
      await expect.element(screen.getByText('entries of each array')).toBeVisible()

      await limit.fill('50')
      await createPlugin(screen).click()

      await expect.element(screen.getByRole('heading', { name: 'Doorbell note', level: 1 })).toBeVisible()
      expect(sent).toEqual([{ kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'stream', streamLimit: 50 }])
    })

    it.each(['0', '2.5', ''])('refuses the Stream Limit “%s” and sends nothing', async (entered) => {
      const { sent } = fakeBuilding()
      const screen = await mountAddPlugin('/plugins/new?way=webhook')

      await nameField(screen).fill('Doorbell note')
      await mergeStrategy(screen, 'Stream').click()
      const limit = screen.getByRole('spinbutton', { name: 'Stream Limit' })
      await limit.fill(entered)
      await createPlugin(screen).click()

      await expect.element(limit).toHaveAccessibleDescription('Enter a whole number of 1 or more.')
      expect(sent).toEqual([])
    })
  })

  describe('the ways', () => {
    it('offers the ways that are built, and falls back to the first for a way it does not know', async () => {
      fakeBuilding()
      const screen = await mountAddPlugin('/plugins/new?way=carrier-pigeon')

      await expect.element(way(screen, 'Build a Poll Plugin')).toBeChecked()
      expect(screen.getByRole('radiogroup', { name: 'Way to add a Plugin' }).getByRole('radio').elements()).toHaveLength(2)
    })

    it('keeps the chosen way in the address and the name across the two ways of building', async () => {
      const { sent } = fakeBuilding()
      const screen = await mountAddPlugin()

      await nameField(screen).fill('Doorbell note')
      await way(screen, 'Build a Webhook Plugin').click()

      await expect.element(mergeStrategy(screen, 'Replace')).toBeChecked()
      expect(path(screen)).toBe('/plugins/new?way=webhook')
      await expect.element(nameField(screen)).toHaveValue('Doorbell note')

      await createPlugin(screen).click()
      await expect.element(screen.getByRole('heading', { name: 'Doorbell note', level: 1 })).toBeVisible()
      expect(sent).toEqual([{ kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'standard' }])
    })
  })

  describe('carrying a Device', () => {
    it('says where the Plugin goes, sends the Device, and the Plugin\'s page says it was assigned', async () => {
      const { sent } = fakeBuilding()
      const screen = await mountAddPlugin('/plugins/new?way=poll&device=kitchen')

      await expect.element(screen.getByRole('link', { name: 'Kitchen\'s Screens' })).toHaveAttribute('href', '/devices/kitchen')
      await expect.element(screen.getByText('It is assigned to Kitchen as soon as it exists, at the end of the Order.')).toBeVisible()

      await way(screen, 'Build a Webhook Plugin').click()
      await way(screen, 'Build a Poll Plugin').click()
      expect(path(screen)).toBe('/plugins/new?way=poll&device=kitchen')

      await nameField(screen).fill('Weather')
      await createPlugin(screen).click()

      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()
      expect(sent).toEqual([{ kind: 'Poll', name: 'Weather', deviceId: 'kitchen' }])
      await expect.element(screen.getByText(/Created\. It shows its name until you write its template\. Assigned to Kitchen\./)).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'Back to Kitchen\'s Screens' })).toHaveAttribute('href', '/devices/kitchen')
    })

    it('waits for the Devices before it offers the form, so that the Device is never left behind', async () => {
      const { sent } = fakeBuilding()
      api.use(http.get(apiUrl('devices'), async () => {
        await delay(400)
        return HttpResponse.json([KITCHEN])
      }))
      const screen = await mountAddPlugin('/plugins/new?device=kitchen')

      expect(createPlugin(screen).elements()).toHaveLength(0)
      await expect.element(screen.getByRole('link', { name: 'Kitchen\'s Screens' })).toBeVisible()

      await nameField(screen).fill('Weather')
      await createPlugin(screen).click()

      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()
      expect(sent).toEqual([{ kind: 'Poll', name: 'Weather', deviceId: 'kitchen' }])
    })

    it('returns to the Device on Cancel', async () => {
      fakeBuilding()
      const screen = await mountAddPlugin('/plugins/new?device=kitchen')

      await screen.getByRole('link', { name: 'Cancel' }).click()

      await expect.poll(() => path(screen)).toBe('/devices/kitchen')
    })

    it('carries nothing for an id that is no Device\'s', async () => {
      const { sent } = fakeBuilding()
      const screen = await mountAddPlugin('/plugins/new?device=attic')

      await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true })).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toHaveAttribute('href', '/plugins')
      await expect.element(screen.getByText(/It is assigned to/)).not.toBeInTheDocument()

      await nameField(screen).fill('Weather')
      await createPlugin(screen).click()

      await expect.element(screen.getByRole('heading', { name: 'Weather', level: 1 })).toBeVisible()
      expect(sent).toEqual([{ kind: 'Poll', name: 'Weather' }])
      await expect.element(screen.getByText('Created. It shows its name until you write its template. It is not on a Device yet.')).toBeVisible()
    })
  })

  describe('cancel', () => {
    it('returns to where the admin came from', async () => {
      fakeBuilding()
      const screen = await mountApp({ at: '/alerts' })
      await expect.element(screen.getByRole('heading', { name: 'Alerts', level: 1 })).toBeVisible()
      await screen.router.push('/plugins/new?way=poll')
      await way(screen, 'Build a Webhook Plugin').click()

      await screen.getByRole('link', { name: 'Cancel' }).click()

      await expect.poll(() => path(screen)).toBe('/alerts')
    })

    it('returns to the Plugins list when the page was opened by its address', async () => {
      fakeBuilding()
      const screen = await mountAddPlugin()
      await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toHaveAttribute('href', '/plugins')

      await screen.getByRole('link', { name: 'Cancel' }).click()

      await expect.poll(() => path(screen)).toBe('/plugins')
    })

    it('asks before leaving what was entered, and stays on "Keep editing"', async () => {
      fakeBuilding()
      const screen = await mountAddPlugin()

      await nameField(screen).fill('Weather')
      await screen.getByRole('link', { name: 'Cancel' }).click()

      const dialog = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
      await expect.element(dialog.getByText('What you entered for the new Plugin.')).toBeVisible()
      await dialog.getByRole('button', { name: 'Keep editing' }).click()

      expect(path(screen)).toBe('/plugins/new')
      await expect.element(nameField(screen)).toHaveValue('Weather')
    })
  })

  describe('a refused request', () => {
    it('keeps what was entered and shows the server\'s reason for a field under it', async () => {
      const refusal: Partial<ApiError> = { statusCode: 400, code: 'validation', fields: [{ path: 'name', message: 'name should not be empty' }] }
      const { sent } = fakeBuilding(() => apiErrorResponse(refusal))
      const screen = await mountAddPlugin()

      await nameField(screen).fill('Weather')
      await createPlugin(screen).click()

      await expect.element(nameField(screen)).toHaveAccessibleDescription('name should not be empty')
      await expect.element(nameField(screen)).toHaveValue('Weather')
      expect(sent).toHaveLength(1)
      expect(path(screen)).toBe('/plugins/new')
    })

    it('says the server\'s reason for a field the form does not show', async () => {
      const refusal: Partial<ApiError> = { statusCode: 400, code: 'validation', fields: [{ path: 'streamLimit', message: 'streamLimit must not be less than 1' }] }
      fakeBuilding(() => apiErrorResponse(refusal))
      const screen = await mountAddPlugin()

      await nameField(screen).fill('Weather')
      await createPlugin(screen).click()

      await expect.element(screen.getByRole('status').filter({ hasText: 'Not created.' })).toHaveTextContent('Not created. Some of what was sent is not valid.')
    })

    it('keeps what was entered and says why nothing was created', async () => {
      fakeBuilding(() => apiErrorResponse({ statusCode: 404, code: 'device-not-found' }))
      const screen = await mountAddPlugin('/plugins/new?way=webhook&device=kitchen')

      await nameField(screen).fill('Doorbell note')
      await mergeStrategy(screen, 'Stream').click()
      await createPlugin(screen).click()

      await expect.element(screen.getByRole('status').filter({ hasText: 'Not created.' })).toHaveTextContent('Not created. That Device does not exist.')
      await expect.element(nameField(screen)).toHaveValue('Doorbell note')
      await expect.element(mergeStrategy(screen, 'Stream')).toBeChecked()
      await expect.element(createPlugin(screen)).not.toHaveAttribute('aria-busy')
      expect(path(screen)).toBe('/plugins/new?way=webhook&device=kitchen')
    })
  })

  it('is accessible and does not overflow, for both ways and with a problem shown', async () => {
    fakeBuilding()
    const screen = await mountAddPlugin('/plugins/new?way=webhook&device=kitchen')
    await mergeStrategy(screen, 'Stream').click()
    await createPlugin(screen).click()
    await expect.element(nameField(screen)).toHaveAccessibleDescription('A Plugin needs a name.')

    await expectAccessible()
    await expectNoHorizontalOverflow()

    await way(screen, 'Build a Poll Plugin').click()
    await expect.element(screen.getByText(/You write both on the Plugin's page/)).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
