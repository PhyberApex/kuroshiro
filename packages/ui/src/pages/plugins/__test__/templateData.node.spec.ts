import { describe, expect, it } from 'vitest'
import { buildPreviewData } from '@/testing/fixtures/plugins'
import { dataNote, dataRowsOf, notFetchedReason, scheduledFailure, unfetchedSources } from '../templateData'

const FETCHED = buildPreviewData({
  context: {
    location: 'Lindenplatz',
    api_key: '••••••••',
    show_wind: true,
    days: 3,
    nothing: null,
    forecast: { current: { temperature: 14.2 } },
    stops: ['Lindenplatz', 'Marktplatz'],
    departures: { error: true, message: 'HTTP 503 Service Unavailable' },
    sensors: { temperature: { value: 21.5, unit: 'celsius' } },
    trmnl: { plugin_settings: { instance_name: 'Weather' } },
  },
  names: [
    { name: 'location', origin: 'fieldValue', error: null },
    { name: 'api_key', origin: 'fieldValue', error: null },
    { name: 'show_wind', origin: 'webhookPayload', error: null },
    { name: 'days', origin: 'webhookPayload', error: null },
    { name: 'nothing', origin: 'webhookPayload', error: null },
    { name: 'forecast', origin: 'dataSource', error: null },
    { name: 'stops', origin: 'dataSource', error: null },
    { name: 'departures', origin: 'dataSource', error: 'HTTP 503 Service Unavailable' },
    { name: 'sensors', origin: 'sensors', error: null },
    { name: 'trmnl', origin: 'trmnl', error: null },
  ],
})

describe('the rows of "Data"', () => {
  const rows = dataRowsOf(FETCHED, 'Kitchen')
  const row = (name: string) => rows.find(found => found.name === name)

  it('lists every name in the answer\'s order, each with where it comes from', () => {
    expect(rows.map(({ name, origin }) => `${name}: ${origin}`)).toEqual([
      'location: Field Value',
      'api_key: Field Value',
      'show_wind: Webhook Payload',
      'days: Webhook Payload',
      'nothing: Webhook Payload',
      'forecast: Data Source',
      'stops: Data Source',
      'departures: Data Source, not fetched',
      'sensors: Kitchen\'s Sensors',
      'trmnl: Kuroshiro',
    ])
  })

  it('shows a plain value in the row, as JSON', () => {
    expect(['location', 'api_key', 'show_wind', 'days', 'nothing'].map(name => row(name)?.value)).toEqual(['"Lindenplatz"', '"••••••••"', 'true', '3', 'null'])
    expect(row('location')?.code).toBeUndefined()
  })

  it('opens an object or a list to its JSON', () => {
    expect(row('forecast')).toMatchObject({ value: undefined, code: '{\n  "current": {\n    "temperature": 14.2\n  }\n}' })
    expect(row('stops')?.code).toBe('[\n  "Lindenplatz",\n  "Marktplatz"\n]')
  })

  it('says of a Data Source that was not fetched why, above its error marker', () => {
    expect(row('departures')).toEqual({
      name: 'departures',
      origin: 'Data Source, not fetched',
      notFetched: true,
      value: undefined,
      why: 'The preview\'s fetch failed: HTTP 503 Service Unavailable. The template reads an error marker in place of the data, as it would on the Device.',
      code: '{\n  "error": true,\n  "message": "HTTP 503 Service Unavailable"\n}',
    })
  })

  it('says that there are no Sensors without a Device, and shows what is empty in the row', () => {
    const none = dataRowsOf(buildPreviewData(), null).find(found => found.name === 'sensors')

    expect(none).toMatchObject({ origin: 'No Device, so no Sensors', value: '{}', code: undefined })
  })

  it('has no row for a Webhook Payload that is a list', () => {
    expect(dataRowsOf(buildPreviewData({ context: [1, 2], names: [] }), null)).toEqual([])
  })
})

describe('what is said about the preview\'s data', () => {
  it('counts the names', () => {
    expect([0, 1, 14].map(count => dataNote(count))).toEqual(['0 names', '1 name', '14 names'])
  })

  it('says when the data was fetched beside the names, for a Plugin that fetches', () => {
    expect(dataNote(14, '4 min ago')).toBe('14 names, fetched 4 min ago')
  })

  it('says from when the data the preview keeps is, after a fetch with no answer', () => {
    expect(notFetchedReason('Kuroshiro\'s server is not answering.', '4 min ago')).toBe('Kuroshiro\'s server is not answering. The preview uses the data from 4 min ago.')
    expect(notFetchedReason('Kuroshiro\'s server is not answering.', undefined)).toBe('Kuroshiro\'s server is not answering.')
  })

  it('names each Data Source that could not be fetched, with the server\'s reason and one full stop', () => {
    const data = buildPreviewData({
      names: [
        { name: 'forecast', origin: 'dataSource', error: null },
        { name: 'departures', origin: 'dataSource', error: 'HTTP 503 Service Unavailable' },
        { name: 'tides', origin: 'dataSource', error: 'The address did not answer.' },
      ],
    })

    expect(unfetchedSources(data)).toEqual([
      { name: 'departures', reason: 'HTTP 503 Service Unavailable.' },
      { name: 'tides', reason: 'The address did not answer.' },
    ])
  })
})

describe('the last scheduled render\'s failure', () => {
  const at = '2026-10-03T07:30:00.000Z'
  const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at))

  it('is nothing for a render that worked, and for a Plugin that was never rendered', () => {
    expect([scheduledFailure({ at, error: null }), scheduledFailure(null)]).toEqual([undefined, undefined])
  })

  it('names the time, the line and the Template that failed', () => {
    expect(scheduledFailure({ at, error: { message: 'undefined filter: rnd', line: 3, size: 'quadrant' } })).toEqual({
      before: `The scheduled render at ${clock} failed at line 3: `,
      message: 'undefined filter: rnd',
      line: 3,
      size: 'quadrant',
    })
  })

  it('names no line when the server\'s error has none', () => {
    expect(scheduledFailure({ at, error: { message: 'Maximum call stack size exceeded', line: null, size: 'full' } })).toMatchObject({
      before: `The scheduled render at ${clock} failed: `,
      line: null,
    })
  })
})
