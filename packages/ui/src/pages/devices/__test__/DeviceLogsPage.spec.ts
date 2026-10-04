import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildDeviceLogEntry } from '@/testing/fixtures/devices'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { logTime } from '../deviceLogWording'
import { ENTRIES, fakeKitchenLog, quietPolls } from './deviceLogHarness'

type Screen = Awaited<ReturnType<typeof mountApp>>

const words = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const at = (id: string) => logTime(new Date(ENTRIES.find(entry => entry.id === id)!.at))
const log = (screen: Screen) => screen.getByRole('list', { name: 'Kitchen\'s Device Log' })
const lines = (screen: Screen) => [...log(screen).element().children].map(line => words(line.querySelector('.entry-line') ?? line))
const facts = (row: Element) => [...row.querySelectorAll('.entry-fact')].map(fact => [words(fact.querySelector('dt')), words(fact.querySelector('dd'))])

const messages = (screen: Screen) => [...log(screen).element().querySelectorAll('.message')].map(words)
const marked = (screen: Screen) => [...log(screen).element().querySelectorAll('mark')].map(words)
const lastRead = (faked: { reads: Record<string, string>[] }) => faked.reads[faked.reads.length - 1]
const comeBackToTheTab = () => window.dispatchEvent(new Event('focus'))

async function mountLogs(address = '/devices/kitchen/logs') {
  const screen = await mountApp({ at: address })
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Kitchen' })).toBeVisible()
  return screen
}

describe('reading a Device Log', () => {
  it('lists the entries newest first under day headings, each with its time to the second, its level and its message', async () => {
    fakeKitchenLog()
    const screen = await mountLogs()

    await expect.element(log(screen)).toBeVisible()
    expect(lines(screen)).toEqual([
      'Today',
      `${at('poll-calendar')} info display poll, served Calendar (Order 2)`,
      `${at('battery-low')} warning battery 3.42 V, below the low-battery threshold`,
      'Yesterday, Friday 2 October',
      `${at('download-failed')} error image download failed, HTTP 502, retrying at the next poll`,
      `${at('wifi-slow')} warning WiFi reconnect took 9 s`,
      'Wednesday 30 September',
      `${at('heap')} debug heap after render 141 kB`,
      `${at('wifi-connected')} info wifi connected`,
    ])
    await expect.element(screen.getByText('Showing 6 of 6, newest first')).toBeVisible()
    await expect.element(screen.getByText('That is the whole Device Log.')).toBeVisible()
  })

  it('opens an entry to its source, its Device status, its Firmware and the further fields the firmware sent', async () => {
    fakeKitchenLog()
    const screen = await mountLogs()
    const entry = screen.getByRole('button', { name: /image download failed/ })

    await expect.element(entry).toHaveAttribute('aria-expanded', 'false')
    await entry.click()

    await expect.element(entry).toHaveAttribute('aria-expanded', 'true')
    expect(facts(entry.element().closest('li')!)).toEqual([
      ['Source', 'src/display.cpp:171'],
      ['Device status', 'battery 3.49 V · rssi −74 dBm · Wi-Fi connected · free heap 141 kB · wake reason timer'],
      ['Firmware', '1.6.8'],
      ['retry', '1'],
      ['special_function', 'none'],
    ])

    await entry.click()
    await expect.element(entry).toHaveAttribute('aria-expanded', 'false')
    expect(facts(entry.element().closest('li')!)).toEqual([])
  })

  it('says so when an opened entry carries nothing but its message', async () => {
    fakeKitchenLog()
    const screen = await mountLogs()

    await screen.getByRole('button', { name: /heap after render/ }).click()

    await expect.element(screen.getByText('The Device sent nothing more with this entry.')).toBeVisible()
  })

  it('sets a warning and an error apart by weight alone: nothing is red', async () => {
    fakeKitchenLog()
    const screen = await mountLogs()
    await expect.element(log(screen)).toBeVisible()
    const weightOf = (name: RegExp, part: string) => getComputedStyle(screen.getByRole('button', { name }).element().querySelector(part)!).fontWeight

    expect(weightOf(/WiFi reconnect/, '.level')).toBe('600')
    expect(weightOf(/image download failed/, '.level')).toBe('600')
    expect(weightOf(/image download failed/, '.message')).toBe('500')
    expect(weightOf(/wifi connected/, '.level')).toBe('400')
    expect(weightOf(/wifi connected/, '.message')).toBe('400')
    expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])
  })

  it('names the Device Log\'s Retention age and links to where it is set', async () => {
    fakeKitchenLog({ deviceLogRetentionDays: 14 })
    const screen = await mountLogs()

    await expect.element(screen.getByText('Entries older than 14 days are removed by', { exact: false })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Retention' })).toHaveAttribute('href', '/instance/settings#retention')
  })

  it('is accessible in both themes and does not scroll sideways, with an entry open', async () => {
    fakeKitchenLog()
    const screen = await mountLogs()
    await screen.getByRole('button', { name: /image download failed/ }).click()
    await expect.element(screen.getByText('src/display.cpp:171')).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})

describe('filtering and searching a Device Log', () => {
  it('asks the server for warnings and errors alone and keeps the filter in the address', async () => {
    const faked = fakeKitchenLog()
    const screen = await mountLogs()
    await expect.element(log(screen)).toBeVisible()

    await screen.getByRole('radio', { name: 'Warnings and errors' }).click()

    await expect.element(screen.getByText('Showing 3 of 3 that match, newest first')).toBeVisible()
    expect(messages(screen)).toEqual([
      'battery 3.42 V, below the low-battery threshold',
      'image download failed, HTTP 502, retrying at the next poll',
      'WiFi reconnect took 9 s',
    ])
    expect(lastRead(faked)).toEqual({ level: 'problems' })
    expect(screen.router.currentRoute.value.query).toEqual({ level: 'problems' })

    await screen.getByRole('radio', { name: 'All' }).click()

    await expect.element(screen.getByText('Showing 6 of 6, newest first')).toBeVisible()
    expect(screen.router.currentRoute.value.query).toEqual({})
  })

  it('searches the messages on the server from two characters on, once the typing has stopped, and marks what matched', async () => {
    const faked = fakeKitchenLog()
    const screen = await mountLogs()
    await expect.element(log(screen)).toBeVisible()
    const readsAtOpen = faked.reads.length

    await screen.getByRole('searchbox', { name: 'Search messages' }).fill('w')
    await new Promise(resolve => setTimeout(resolve, 450))
    expect(faked.reads).toHaveLength(readsAtOpen)

    await screen.getByRole('searchbox', { name: 'Search messages' }).fill('wifi')

    await expect.element(screen.getByText('Showing 2 of 2 that match, newest first')).toBeVisible()
    expect(messages(screen)).toEqual(['WiFi reconnect took 9 s', 'wifi connected'])
    expect(marked(screen)).toEqual(['WiFi', 'wifi'])
    expect(faked.reads.slice(readsAtOpen)).toEqual([{ q: 'wifi' }])
    expect(screen.router.currentRoute.value.query).toEqual({ q: 'wifi' })
  })

  it('restores the filter and the search from the address, and combines them', async () => {
    const faked = fakeKitchenLog()
    const screen = await mountLogs('/devices/kitchen/logs?level=problems&q=wifi')

    await expect.element(screen.getByText('Showing 1 of 1 that match, newest first')).toBeVisible()
    expect(messages(screen)).toEqual(['WiFi reconnect took 9 s'])
    expect(faked.reads[0]).toEqual({ level: 'problems', q: 'wifi' })
    await expect.element(screen.getByRole('radio', { name: 'Warnings and errors' })).toBeChecked()
    await expect.element(screen.getByRole('searchbox', { name: 'Search messages' })).toHaveValue('wifi')
  })

  it('says that nothing matches, in the words of the filter and the search, and offers every entry', async () => {
    fakeKitchenLog()
    const screen = await mountLogs('/devices/kitchen/logs?level=problems&q=served')

    await expect.element(screen.getByRole('heading', { name: 'No entry matches' })).toBeVisible()
    await expect.element(screen.getByText('Nothing in Kitchen\'s Device Log matches “served” among warnings and errors.')).toBeVisible()

    await screen.getByRole('button', { name: 'Show all entries' }).click()

    await expect.element(screen.getByText('Showing 6 of 6, newest first')).toBeVisible()
    expect(screen.router.currentRoute.value.query).toEqual({})
    await expect.element(screen.getByRole('searchbox', { name: 'Search messages' })).toHaveValue('')
    await expect.element(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  })
})

describe('paging a Device Log', () => {
  it('appends the next 50 entries for "Older entries", moves the focus to the first of them and says where the Device Log ends', async () => {
    const faked = fakeKitchenLog({ entries: quietPolls(120) })
    const screen = await mountLogs()

    await expect.element(screen.getByText('Showing 50 of 120, newest first')).toBeVisible()
    expect(messages(screen)).toHaveLength(50)

    await screen.getByRole('button', { name: 'Older entries' }).click()

    await expect.element(screen.getByText('Showing 100 of 120, newest first')).toBeVisible()
    expect(lastRead(faked)).toEqual({ before: 'cursor-poll-50' })
    await expect.element(screen.getByRole('button', { name: /display poll poll 51$/ })).toHaveFocus()

    await screen.getByRole('button', { name: 'Older entries' }).click()

    await expect.element(screen.getByText('Showing 120 of 120, newest first')).toBeVisible()
    expect(messages(screen)).toEqual(quietPolls(120).map(entry => entry.message))
    await expect.element(screen.getByText('That is the whole Device Log.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Older entries' }).query()).toBeNull()
  })

  it('keeps the list and says why when older entries cannot be loaded', async () => {
    const faked = fakeKitchenLog({ entries: quietPolls(60) })
    const screen = await mountLogs()
    await expect.element(screen.getByText('Showing 50 of 60, newest first')).toBeVisible()

    faked.failing = apiErrorResponse({ statusCode: 500, code: 'internal', message: 'Internal server error' })
    await screen.getByRole('button', { name: 'Older entries' }).click()

    await expect.element(screen.getByText('Could not load older entries.')).toBeVisible()
    expect(messages(screen)).toHaveLength(50)
  })
})

describe('entries that arrive while the page is open', () => {
  const arrivals = [
    buildDeviceLogEntry({ id: 'new-2', at: '2026-10-03T07:34:30.000Z', level: 'error', message: 'image download failed again' }),
    buildDeviceLogEntry({ id: 'new-1', at: '2026-10-03T07:34:00.000Z', message: 'display poll, served Weather (Order 1)' }),
  ]

  it('counts them without moving the list, and puts them on top when asked', async () => {
    const faked = fakeKitchenLog()
    const screen = await mountLogs()
    await expect.element(log(screen)).toBeVisible()

    faked.entries = [...arrivals, ...ENTRIES]
    comeBackToTheTab()

    const newEntries = screen.getByRole('button', { name: '2 new entries' })
    await expect.element(newEntries).toBeVisible()
    expect(lastRead(faked)).toEqual({ after: 'cursor-poll-calendar', limit: '0' })
    expect(messages(screen)).toHaveLength(6)
    await expect.element(screen.getByText('Showing 6 of 6, newest first')).toBeVisible()

    await newEntries.click()

    await expect.element(screen.getByText('Showing 8 of 8, newest first')).toBeVisible()
    expect(messages(screen).slice(0, 3)).toEqual(['image download failed again', 'display poll, served Weather (Order 1)', 'display poll, served Calendar (Order 2)'])
    expect(screen.getByRole('button', { name: /new entr/ }).query()).toBeNull()
  })

  it('counts only those the filter lets through', async () => {
    const faked = fakeKitchenLog()
    const screen = await mountLogs('/devices/kitchen/logs?level=problems')
    await expect.element(log(screen)).toBeVisible()

    faked.entries = [...arrivals, ...ENTRIES]
    comeBackToTheTab()

    await expect.element(screen.getByRole('button', { name: '1 new entry' })).toBeVisible()
  })

  it('shows the first entries of an empty Device Log by itself', async () => {
    const faked = fakeKitchenLog({ entries: [] })
    const screen = await mountLogs()
    await expect.element(screen.getByRole('heading', { name: 'No Device Log entries yet' })).toBeVisible()

    faked.entries = arrivals
    comeBackToTheTab()

    await expect.element(screen.getByText('Showing 2 of 2, newest first')).toBeVisible()
  })

  it('starts the list over when more arrived than one request answers', async () => {
    const faked = fakeKitchenLog()
    const screen = await mountLogs()
    await expect.element(log(screen)).toBeVisible()

    faked.entries = [...quietPolls(201, '2026-10-03T07:34:00.000Z', 'burst'), ...ENTRIES]
    comeBackToTheTab()
    await screen.getByRole('button', { name: '201 new entries' }).click()

    await expect.element(screen.getByText('Showing 50 of 207, newest first')).toBeVisible()
    expect(messages(screen)[0]).toBe('display poll burst 1')
  })
})

describe('clearing a Device Log', () => {
  it('confirms with the number of entries, clears the whole Device Log whatever the filter and shows it empty', async () => {
    const faked = fakeKitchenLog()
    const screen = await mountLogs('/devices/kitchen/logs?level=problems')
    await expect.element(log(screen)).toBeVisible()

    await screen.getByRole('button', { name: 'Clear Logs' }).click()

    const dialog = screen.getByRole('alertdialog', { name: 'Clear Kitchen\'s Logs?' })
    await expect.element(dialog).toBeVisible()
    expect(words(dialog.element())).toContain('All 6 entries of Kitchen\'s Device Log.')
    expect(words(dialog.element())).toContain('Nothing else changes. New entries arrive with the next poll.')
    await expect.element(dialog.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(faked.cleared).toBe(0)

    await dialog.getByRole('button', { name: 'Clear Logs' }).click()

    await expect.element(screen.getByRole('heading', { name: 'No Device Log entries yet' })).toBeVisible()
    expect(faked.cleared).toBe(1)
    await expect.element(screen.getByRole('button', { name: 'Clear Logs' })).toBeDisabled()
  })

  it('leaves the Device Log alone when the admin cancels', async () => {
    const faked = fakeKitchenLog()
    const screen = await mountLogs()
    await expect.element(log(screen)).toBeVisible()

    await screen.getByRole('button', { name: 'Clear Logs' }).click()
    await screen.getByRole('button', { name: 'Cancel' }).click()

    await expect.element(log(screen)).toBeVisible()
    expect(faked.cleared).toBe(0)
  })
})

describe('a Device Log with nothing to list', () => {
  it('says that no entry has arrived yet and what will bring one, with nothing to clear', async () => {
    fakeKitchenLog({ entries: [] })
    const screen = await mountLogs()

    await expect.element(screen.getByRole('heading', { name: 'No Device Log entries yet' })).toBeVisible()
    await expect.element(screen.getByText('Kitchen sends an entry when something goes wrong on its side. They appear here after its next poll.')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Clear Logs' })).toBeDisabled()
    await expectAccessible()
  })

  it('shows the bar and the loading line while the first answer is on its way', async () => {
    fakeKitchenLog()
    api.use(http.get(apiUrl('devices/kitchen/logs'), () => new Promise(() => {})))
    const screen = await mountLogs()

    await expect.element(screen.getByText('Loading Kitchen\'s Logs')).toBeVisible()
    await expect.element(screen.getByRole('searchbox', { name: 'Search messages' })).toBeVisible()
    expect(document.querySelectorAll('.log-loading .line')).toHaveLength(5)
    await expectAccessible()
  })

  it('says that the Logs could not be loaded and why, in no red, and loads them on "Try again"', async () => {
    const faked = fakeKitchenLog()
    faked.failing = apiErrorResponse({ statusCode: 500, code: 'internal', message: 'Internal server error' })
    const screen = await mountLogs()

    await expect.element(screen.getByText('Could not load Kitchen\'s Logs.')).toBeVisible()
    expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])
    await expectAccessible()

    faked.failing = undefined
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.element(log(screen)).toBeVisible()
    expect(screen.getByText('Could not load Kitchen\'s Logs.').query()).toBeNull()
  })
})
