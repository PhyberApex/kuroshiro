import type { PluginDetail } from 'kuroshiro-shared'
import type { Webhook } from '../pluginWebhook'
import type { Faked, Mounted } from './pluginPageHarness'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'
import { fakePlugin, mountPlugin, NOW, refresh, saveBar } from './pluginPageHarness'

afterEach(() => resetViewport())

const TOKEN = 'wh8c1f02d94a7be6033f9a'
const NEW_TOKEN = 'wh41e7a90c2d5fb8e61b07'
const SERVER = 'https://kuroshiro.example'
const urlOf = (token: string) => `${SERVER}/api/webhook/${token}`
const MASKED_URL = `${SERVER}/api/webhook/${'•'.repeat(TOKEN.length - 4)}3f9a`
const PAYLOAD = { title: 'Back at six.', body: 'Soup is in the fridge.' }
const RECEIVED_AT = '2026-10-03T07:31:00.000Z'

function doorbell(webhook: Partial<Webhook> = {}): PluginDetail {
  return buildPluginDetail({
    id: 'doorbell',
    name: 'Doorbell note',
    kind: 'Webhook',
    refreshInterval: null,
    dataSources: [],
    webhook: { token: TOKEN, url: urlOf(TOKEN), mergeStrategy: 'standard', streamLimit: null, payload: PAYLOAD, payloadReceivedAt: RECEIVED_AT, ...webhook },
  })
}

const mountDoorbell = (at = '/plugins/doorbell') => mountPlugin('Doorbell note', at)

const spokenOf = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim()

function rowOf(label: string) {
  return [...document.querySelectorAll('#data .read-row')].find(row => spokenOf(row.querySelector('.label')) === label)
}

/** What a row says, part by part: its label, what it shows, its side and its note. */
const partsOf = (label: string) => [...rowOf(label)?.children ?? []].map(spokenOf)

const copyIn = (label: string) => page.elementLocator(rowOf(label)!).getByRole('button', { name: /^Cop/ })

/** The confirmation's sentences, part by part. */
const confirmationParts = () => [...document.querySelectorAll('[role="alertdialog"] :is(.body > p, dd)')].map(spokenOf)

/** The section, once it is there. */
async function section(screen: Mounted) {
  await expect.element(screen.getByRole('heading', { name: 'Webhook', level: 2 })).toBeVisible()
  return page.elementLocator(document.getElementById('data')!)
}

const confirmation = (screen: Mounted) => screen.getByRole('alertdialog')

function catchCopies() {
  const written = vi.fn<Clipboard['writeText']>(async () => {})
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(written)
  return written
}

function fakeClear(faked: Faked) {
  const cleared: string[] = []
  api.use(http.delete(apiUrl('plugins/doorbell/webhook-payload'), () => {
    cleared.push('doorbell')
    faked.plugin = { ...faked.plugin, webhook: { ...faked.plugin.webhook!, payload: null, payloadReceivedAt: null } }
    return HttpResponse.json(faked.plugin)
  }))
  return cleared
}

function fakeRegenerate(faked: Faked) {
  const regenerated: string[] = []
  api.use(http.post(apiUrl('plugins/doorbell/webhook-token'), () => {
    regenerated.push('doorbell')
    faked.plugin = { ...faked.plugin, webhook: { ...faked.plugin.webhook!, token: NEW_TOKEN, url: urlOf(NEW_TOKEN) } }
    return HttpResponse.json(faked.plugin)
  }))
  return regenerated
}

describe('the Webhook section of the Plugin page', () => {
  it('shows the Webhook URL with the token as dots and its last four characters, and copies the whole address hidden and revealed', async () => {
    fakePlugin(doorbell())
    const copies = catchCopies()
    const screen = await mountDoorbell()
    const webhook = await section(screen)
    const urlRow = () => rowOf('Webhook URL')

    expect(spokenOf(urlRow()?.querySelector('code'))).toBe(MASKED_URL)
    expect(partsOf('Webhook URL')[2]).toBe('POST a JSON object or array here. It becomes the Webhook Payload and Doorbell note is rendered again at once. The Webhook Token at its end is the only key, so treat the address as a secret.')
    await copyIn('Webhook URL').click()
    expect(copies).toHaveBeenLastCalledWith(urlOf(TOKEN))

    await webhook.getByRole('button', { name: 'Reveal' }).click()

    await expect.poll(() => spokenOf(urlRow()?.querySelector('code'))).toBe(urlOf(TOKEN))
    await expect.element(webhook.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true')
    await copyIn('Webhook URL').click()
    expect(copies).toHaveBeenLastCalledWith(urlOf(TOKEN))
    expect(document.title).not.toContain(TOKEN)
  })

  it('shows "…" for the token in the example call while it is hidden, and copies the working command either way', async () => {
    fakePlugin(doorbell())
    const copies = catchCopies()
    const screen = await mountDoorbell()
    const webhook = await section(screen)
    const example = () => rowOf('Example')!
    const working = `curl -X POST ${urlOf(TOKEN)} \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "Hello from curl"}'`

    expect(example().querySelector('pre')?.textContent).toBe(working.replace(TOKEN, '…'))
    await copyIn('Example').click()
    expect(copies).toHaveBeenLastCalledWith(working)

    await webhook.getByRole('button', { name: 'Reveal' }).click()

    await expect.poll(() => example().querySelector('pre')?.textContent).toBe(working)
    await copyIn('Example').click()
    expect(copies).toHaveBeenLastCalledWith(working)
  })

  it('names the Merge Strategy with its API value, that it is fixed, and for Stream its Stream Limit', async () => {
    fakePlugin(doorbell({ mergeStrategy: 'stream', streamLimit: 20 }))
    const screen = await mountDoorbell()
    await section(screen)

    expect(partsOf('Merge Strategy')).toEqual([
      'Merge Strategy',
      'Stream stream · Stream Limit 20',
      'Fixed when the Plugin was created',
      'Top-level arrays are appended to and keep their newest 20 entries. Other keys are replaced.',
    ])
    expect(rowOf('Merge Strategy')?.querySelector('code')?.textContent).toBe('stream')
  })

  it('reads the stored Webhook Payload, when it was received and a key the template reads it by', async () => {
    fakePlugin(doorbell())
    const screen = await mountDoorbell()
    const webhook = await section(screen)
    const payloadRow = rowOf('Webhook Payload')

    expect(spokenOf(payloadRow?.querySelector('.received'))).toBe('Received 4 min ago. The template reads its keys directly, for example {{ title }}.')
    expect(payloadRow?.querySelector('pre')?.textContent).toBe(JSON.stringify(PAYLOAD, null, 2))
    await expect.element(webhook.getByRole('button', { name: 'Clear Webhook Payload' })).toBeVisible()
  })

  it('folds a Webhook Payload of 45 lines to its first 30', async () => {
    fakePlugin(doorbell({ payload: { readings: Array.from({ length: 41 }, (_, index) => index) } }))
    const screen = await mountDoorbell()
    const webhook = await section(screen)

    expect(rowOf('Webhook Payload')?.querySelector('pre')?.textContent?.split('\n')).toHaveLength(30)
    await webhook.getByRole('button', { name: 'Show all 45 lines' }).click()
    expect(rowOf('Webhook Payload')?.querySelector('pre')?.textContent?.split('\n')).toHaveLength(45)
  })

  it('says nothing was received yet, and offers nothing to clear', async () => {
    fakePlugin(doorbell({ payload: null, payloadReceivedAt: null }))
    const screen = await mountDoorbell()
    const webhook = await section(screen)

    expect(partsOf('Webhook Payload')).toEqual(['Webhook Payload', 'Nothing received yet. Until the first POST arrives the template renders without data.'])
    expect(webhook.getByRole('button', { name: 'Clear Webhook Payload' }).query()).toBeNull()
  })

  it('shows a Webhook Payload that arrives, at the 30-second refresh', async () => {
    const faked = fakePlugin(doorbell({ payload: null, payloadReceivedAt: null }))
    const screen = await mountDoorbell()
    await section(screen)

    faked.plugin = doorbell({ payload: { title: 'Home soon.' }, payloadReceivedAt: NOW })
    refresh()

    await expect.poll(() => spokenOf(rowOf('Webhook Payload')?.querySelector('.received'))).toBe('Received just now. The template reads its keys directly, for example {{ title }}.')
    expect(rowOf('Webhook Payload')?.querySelector('pre')?.textContent).toContain('Home soon.')
  })

  it('clears the Webhook Payload behind a confirmation that names the Plugin and focuses the safe choice', async () => {
    const faked = fakePlugin(doorbell())
    const cleared = fakeClear(faked)
    const screen = await mountDoorbell()
    const webhook = await section(screen)

    await webhook.getByRole('button', { name: 'Clear Webhook Payload' }).click()

    await expect.element(confirmation(screen).getByRole('heading', { name: 'Clear Doorbell note\'s Webhook Payload?' })).toBeVisible()
    expect(confirmationParts()).toEqual(['The stored Webhook Payload. Doorbell note renders without data until the next POST.', 'The Webhook URL, the template and the Merge Strategy.'])
    await expect.element(confirmation(screen).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await confirmation(screen).getByRole('button', { name: 'Clear Webhook Payload' }).click()

    await expect.poll(() => partsOf('Webhook Payload')).toEqual(['Webhook Payload', 'Nothing received yet. Until the first POST arrives the template renders without data.'])
    expect(cleared).toEqual(['doorbell'])
    expect(faked.saves).toEqual([])
  })

  it('keeps the Webhook Payload shown with the server\'s reason when clearing fails', async () => {
    fakePlugin(doorbell())
    api.use(http.delete(apiUrl('plugins/doorbell/webhook-payload'), () => apiErrorResponse({ statusCode: 400, code: 'plugin-not-webhook' })))
    const screen = await mountDoorbell()
    const webhook = await section(screen)

    await webhook.getByRole('button', { name: 'Clear Webhook Payload' }).click()
    await confirmation(screen).getByRole('button', { name: 'Clear Webhook Payload' }).click()

    await expect.element(confirmation(screen).getByText('That Plugin is not a Webhook-kind Plugin, so it has no Webhook Payload or Webhook Token.')).toBeVisible()
    await confirmation(screen).getByRole('button', { name: 'Cancel' }).click()
    expect(rowOf('Webhook Payload')?.querySelector('pre')?.textContent).toBe(JSON.stringify(PAYLOAD, null, 2))
  })

  it('regenerates the Webhook Token behind a confirmation that says what breaks, then shows the new URL revealed and keeps unsaved changes', async () => {
    const faked = fakePlugin(doorbell())
    const regenerated = fakeRegenerate(faked)
    const screen = await mountDoorbell()
    const webhook = await section(screen)
    await screen.getByRole('button', { name: 'Name and description' }).click()
    await screen.getByRole('textbox', { name: 'Name' }).fill('Doorbell')
    await expect.element(saveBar(screen).getByText('Unsaved changes to the name. The preview already shows them.')).toBeVisible()
    expect(spokenOf(webhook.element().querySelector('.under'))).toBe('A sender that should no longer reach Doorbell note? Regenerate the Webhook Token')

    await webhook.getByRole('button', { name: 'Regenerate the Webhook Token' }).click()

    await expect.element(confirmation(screen).getByRole('heading', { name: 'Regenerate Doorbell note\'s Webhook Token?' })).toBeVisible()
    expect(confirmationParts()).toEqual([
      'Everything that posts to the current Webhook URL is refused from now on, until you give it the new one.',
      'The current Webhook URL.',
      'The Webhook Payload, the template and the Merge Strategy.',
    ])
    await expect.element(confirmation(screen).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await confirmation(screen).getByRole('button', { name: 'Regenerate Webhook Token' }).click()

    await expect.poll(() => spokenOf(rowOf('Webhook URL')?.querySelector('code'))).toBe(urlOf(NEW_TOKEN))
    expect(regenerated).toEqual(['doorbell'])
    await expect.element(webhook.getByRole('button', { name: 'Hide' })).toBeVisible()
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Doorbell')
    await expect.element(saveBar(screen).getByText('Unsaved changes to the name. The preview already shows them.')).toBeVisible()
    expect(faked.saves).toEqual([])
  })

  it('shows no Webhook section for a Poll-kind Plugin', async () => {
    fakePlugin()
    const screen = await mountPlugin()
    await expect.element(screen.getByRole('heading', { name: 'Data Sources', level: 2 })).toBeVisible()

    expect(screen.getByRole('heading', { name: 'Webhook', level: 2 }).query()).toBeNull()
  })

  it('reveals, copies and clears on a phone, and is accessible without sideways scrolling', async () => {
    const faked = fakePlugin(doorbell({ mergeStrategy: 'stream', streamLimit: 20 }))
    fakeClear(faked)
    catchCopies()
    await resizeTo(375, 812)
    const screen = await mountDoorbell()
    const webhook = await section(screen)

    await webhook.getByRole('button', { name: 'Reveal' }).click()
    await expect.poll(() => spokenOf(rowOf('Webhook URL')?.querySelector('code'))).toBe(urlOf(TOKEN))
    await expectNoHorizontalOverflow()
    await expectAccessible()

    await webhook.getByRole('button', { name: 'Clear Webhook Payload' }).click()
    await confirmation(screen).getByRole('button', { name: 'Clear Webhook Payload' }).click()
    await expect.poll(() => spokenOf(rowOf('Webhook Payload'))).toContain('Nothing received yet.')
    await expectNoHorizontalOverflow()
    await expectAccessible()
  })
})
