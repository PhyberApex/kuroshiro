import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { buildPreviewData } from '@/testing/fixtures/plugins'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import DataList from '../DataList.vue'
import { dataRowsOf } from '../templateData'

const HOURS = Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [`h${hour}`, { temperature: 10 + hour, summary: 'Cloudy' }]))

const ROWS = dataRowsOf(buildPreviewData({
  context: {
    location: 'Lindenplatz',
    forecast: { current: { temperature: 14.2 } },
    hourly: HOURS,
    departures: { error: true, message: 'HTTP 503 Service Unavailable' },
    sensors: {},
    trmnl: { plugin_settings: { instance_name: 'Weather' } },
  },
  names: [
    { name: 'location', origin: 'fieldValue', error: null },
    { name: 'forecast', origin: 'dataSource', error: null },
    { name: 'hourly', origin: 'dataSource', error: null },
    { name: 'departures', origin: 'dataSource', error: 'HTTP 503 Service Unavailable' },
    { name: 'sensors', origin: 'sensors', error: null },
    { name: 'trmnl', origin: 'trmnl', error: null },
  ],
}), null)

const read = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim()

/** A row's cells: its name, then its value and where it comes from. */
const cells = (row: Element) => [...row.querySelectorAll('.name, .from')].map(read).join(' ')

describe('data list', () => {
  it('is a list with one row per name, a plain value in its row and no button to open it', async () => {
    const screen = await mount(DataList, { props: { rows: ROWS } })

    expect(screen.getByRole('listitem').elements().map(cells)).toEqual([
      'location "Lindenplatz" · Field Value',
      'forecast Data Source',
      'hourly Data Source',
      'departures Data Source, not fetched',
      'sensors {} · No Device, so no Sensors',
      'trmnl Kuroshiro',
    ])
    expect(screen.getByRole('button').elements().map(cells)).toEqual(['forecast Data Source', 'hourly Data Source', 'departures Data Source, not fetched', 'trmnl Kuroshiro'])
  })

  it('opens an object in place to its JSON and closes it again, by pointer and by keyboard', async () => {
    const screen = await mount(DataList, { props: { rows: ROWS } })
    const forecast = screen.getByRole('button', { name: 'forecast Data Source', exact: true })
    await expect.element(forecast).toHaveAttribute('aria-expanded', 'false')

    await forecast.click()

    await expect.element(forecast).toHaveAttribute('aria-expanded', 'true')
    const code = () => read(screen.getByRole('listitem').nth(1).element().querySelector('pre'))
    await expect.poll(code).toBe('{ "current": { "temperature": 14.2 } }')

    await userEvent.keyboard('{Enter}')

    await expect.element(forecast).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(code).toBeUndefined()
  })

  it('scrolls a long object inside 14 rem', async () => {
    const screen = await mount(DataList, { props: { rows: ROWS } })

    await screen.getByRole('button', { name: 'hourly Data Source' }).click()

    const code = screen.getByRole('listitem').nth(2).element().querySelector('pre')!
    await expect.poll(() => code.clientHeight).toBeLessThanOrEqual(14 * 16)
    expect(code.scrollHeight).toBeGreaterThan(code.clientHeight)
    expect(getComputedStyle(code).overflowY).toBe('auto')
  })

  it('marks a Data Source that was not fetched in ink, and says why above its error marker', async () => {
    const screen = await mount(DataList, { props: { rows: ROWS } })
    const row = screen.getByRole('listitem').nth(3)

    expect(row.element().querySelector('button svg')).not.toBeNull()
    await screen.getByRole('button', { name: 'departures Data Source, not fetched' }).click()

    await expect.element(row.getByText('The preview\'s fetch failed: HTTP 503 Service Unavailable. The template reads an error marker in place of the data, as it would on the Device.')).toBeVisible()
    expect(read(row.element().querySelector('pre'))).toBe('{ "error": true, "message": "HTTP 503 Service Unavailable" }')
    expect(elementsInSealColour(document.body)).toEqual([])
  })

  it('is accessible and does not overflow, with a row opened and a long value in a row', async () => {
    const long = dataRowsOf(buildPreviewData({
      context: { note: 'Bring an umbrella and leave ten minutes early, the tram is replaced by a bus between Lindenplatz and Marktplatz', forecast: { current: 14 } },
      names: [{ name: 'note', origin: 'fieldValue', error: null }, { name: 'forecast', origin: 'dataSource', error: 'HTTP 503' }],
    }), 'Kitchen')
    const screen = await mount(DataList, { props: { rows: long } })
    await screen.getByRole('button', { name: 'forecast Data Source, not fetched' }).click()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
