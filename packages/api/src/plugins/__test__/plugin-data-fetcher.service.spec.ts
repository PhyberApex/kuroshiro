import type { ConfigService } from '@nestjs/config'
import { lookup } from 'node:dns/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { asService } from '../../test/mockService.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import { PluginRendererService } from '../services/plugin-renderer.service.js'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))

const mockFetch = stubFetch()
const mockLookup = vi.mocked(lookup as (host: string, options: { all: true }) => Promise<{ address: string, family: number }[]>)

describe('pluginDataFetcherService', () => {
  let service: PluginDataFetcherService
  const mockRenderer = { render: vi.fn() }
  const mockConfigService = { get: vi.fn().mockReturnValue(false) }

  beforeEach(() => {
    service = new PluginDataFetcherService(asService<PluginRendererService>(mockRenderer), asService<ConfigService>(mockConfigService), new InstanceTimeZone())
    vi.clearAllMocks()
    mockConfigService.get.mockReturnValue(false)
    mockLookup.mockResolvedValue([{ address: '93.184.215.14', family: 4 }])
  })

  it('fetches data from a GET endpoint', async () => {
    const mockData = { temperature: 25, condition: 'sunny' }
    mockFetch.mockResolvedValue(jsonResponse(mockData))

    const result = await service.fetchData('GET', 'https://api.weather.com/data')

    expect(mockFetch).toHaveBeenCalledWith('https://api.weather.com/data', {
      method: 'GET',
      headers: {},
      signal: expect.any(AbortSignal),
    })
    expect(result).toEqual(mockData)
  })

  it('fetches data from a POST endpoint with body', async () => {
    const mockData = { success: true }
    const body = { location: 'Tokyo', units: 'metric' }
    mockFetch.mockResolvedValue(jsonResponse(mockData))

    const result = await service.fetchData('POST', 'https://api.example.com/webhook', {}, body)

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: expect.any(AbortSignal),
    })
    expect(result).toEqual(mockData)
  })

  it('includes custom headers in request', async () => {
    const mockData = { data: 'test' }
    const headers = { 'Authorization': 'Bearer token123', 'X-Custom': 'value' }
    mockFetch.mockResolvedValue(jsonResponse(mockData))

    await service.fetchData('GET', 'https://api.example.com', headers)

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com', {
      method: 'GET',
      headers,
      signal: expect.any(AbortSignal),
    })
  })

  it('renders Liquid in the url, the header values and the body against the template context', async () => {
    const liquid = new PluginRendererService(new InstanceTimeZone())
    mockRenderer.render.mockImplementation((template: string, data: object) => liquid.render(template, data))
    mockFetch.mockResolvedValue(jsonResponse({}))

    await service.fetchData(
      'POST',
      'https://api.example.com/{{ city }}',
      { 'Authorization': 'Bearer {{ trmnl.plugin_settings.custom_fields_values.api_key }}', 'X-Plain': 'as-is' },
      { query: { place: '{{ city }}', limit: 3 }, tags: ['{{ city }}', 'fixed'] },
      { city: 'Berlin', trmnl: { plugin_settings: { custom_fields_values: { api_key: 's3cret' } } } },
    )

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/Berlin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer s3cret', 'X-Plain': 'as-is' },
      body: JSON.stringify({ query: { place: 'Berlin', limit: 3 }, tags: ['Berlin', 'fixed'] }),
      signal: expect.any(AbortSignal),
    })
  })

  it('gives up on a host that has not answered within 10 seconds, as TRMNL does (ADR-0062)', async () => {
    mockFetch.mockImplementation(async (_url, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })

    await expect(service.fetchData('GET', 'https://slow.example/')).rejects.toThrow('The host did not answer within 10 seconds.')
  })

  describe('a response that is not JSON (ADR-0059)', () => {
    const xml = (body: string, type = 'application/xml') => new Response(body, { status: 200, headers: { 'content-type': type } })

    it('reads an XML feed as TRMNL does: the root element as the top key, a repeated child as a list, a single one as an object, text as a string', async () => {
      mockFetch.mockResolvedValue(xml('<?xml version="1.0"?><rss version="2.0"><channel><title>Peanuts</title><item><title>Monday</title><link>https://a/1</link></item><item><title>Tuesday</title></item></channel></rss>', 'application/rss+xml'))

      expect(await service.fetchData('GET', 'https://example.com/feed')).toEqual({
        rss: { version: '2.0', channel: { title: 'Peanuts', item: [{ title: 'Monday', link: 'https://a/1' }, { title: 'Tuesday' }] } },
      })
    })

    it('lays an element\'s attributes beside its children, keeps text over attributes, and reads an empty element as nothing', async () => {
      mockFetch.mockResolvedValue(xml('<feed xmlns="http://www.w3.org/2005/Atom"><entry><link href="https://a/1" rel="alternate"/><title type="html">Hello</title><summary/><media:content url="https://a/1.png"/></entry></feed>', 'application/atom+xml'))

      expect(await service.fetchData('GET', 'https://example.com/feed')).toEqual({
        feed: { xmlns: 'http://www.w3.org/2005/Atom', entry: { 'link': { href: 'https://a/1', rel: 'alternate' }, 'title': 'Hello', 'summary': null, 'media:content': { url: 'https://a/1.png' } } },
      })
    })

    it('reads CDATA and a byte order mark through, and text/xml as XML too', async () => {
      mockFetch.mockResolvedValue(xml('﻿<item><description><![CDATA[<img src="x">]]></description></item>', 'text/xml; charset=utf-8'))

      expect(await service.fetchData('GET', 'https://example.com/feed')).toEqual({ item: { description: '<img src="x">' } })
    })

    it('reads CSV as rows of cells under data, quotes honoured', async () => {
      mockFetch.mockResolvedValue(new Response('name,note\nA,"x, y"\nB,"say ""hi"""\n', { status: 200, headers: { 'content-type': 'text/csv' } }))

      expect(await service.fetchData('GET', 'https://example.com/table')).toEqual({ data: [['name', 'note'], ['A', 'x, y'], ['B', 'say "hi"']] })
    })

    it('answers the text of anything else that is not JSON, as an HTML page', async () => {
      mockFetch.mockResolvedValue(new Response('<html><body>hi</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }))

      expect(await service.fetchData('GET', 'https://example.com/page')).toBe('<html><body>hi</body></html>')
    })

    it('answers JSON served under a textual content type as JSON, and XML that does not parse as its text', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'text/plain' } }))
      expect(await service.fetchData('GET', 'https://example.com/a')).toEqual({ ok: true })

      mockFetch.mockResolvedValueOnce(xml('<broken'))
      expect(await service.fetchData('GET', 'https://example.com/b')).toBe('<broken')
    })
  })

  describe('an iCalendar feed (ADR-0066)', () => {
    const berlin = Object.assign(new InstanceTimeZone(), { name: 'Europe/Berlin' })
    const calendar = (events: string, type = 'text/calendar; charset=utf-8') => new Response(
      ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//EN', events, 'END:VCALENDAR', ''].join('\r\n'),
      { status: 200, headers: { 'content-type': type } },
    )
    let calendarService: PluginDataFetcherService

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-20T15:00:00Z'))
      calendarService = new PluginDataFetcherService(asService<PluginRendererService>(mockRenderer), asService<ConfigService>(mockConfigService), berlin)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('reads each event as uid, summary, description, location, start, end, all_day and status, times in the Instance Time Zone', async () => {
      mockFetch.mockResolvedValue(calendar([
        'BEGIN:VEVENT',
        'UID:standup@example.com',
        'DTSTART:20261021T070000Z',
        'DTEND:20261021T073000Z',
        'SUMMARY:Standup',
        'DESCRIPTION:Daily sync',
        'LOCATION:Room 1',
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT10M',
        'ACTION:DISPLAY',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n')))

      expect(await calendarService.fetchData('GET', 'https://example.com/basic.ics')).toEqual({
        events: [{
          uid: 'standup@example.com',
          summary: 'Standup',
          description: 'Daily sync',
          location: 'Room 1',
          start: '2026-10-21T09:00:00+02:00',
          end: '2026-10-21T09:30:00+02:00',
          all_day: false,
          status: 'CONFIRMED',
        }],
      })
    })

    const vevent = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n')
    const shown = (body: unknown) => (body as { events: { summary: string | null, start: string, end: string, all_day: boolean }[] }).events.map(({ summary, start, end, all_day }) => `${summary} ${start} ${end}${all_day ? ' all day' : ''}`)

    it('expands a recurring event over the window, skipping an excluded date and taking an override\'s time and summary, across a change of offset', async () => {
      mockFetch.mockResolvedValue(calendar([
        'BEGIN:VTIMEZONE',
        'TZID:Europe/Berlin',
        'BEGIN:DAYLIGHT',
        'TZOFFSETFROM:+0100',
        'TZOFFSETTO:+0200',
        'DTSTART:19700329T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
        'END:DAYLIGHT',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:+0200',
        'TZOFFSETTO:+0100',
        'DTSTART:19701025T030000',
        'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
        'END:STANDARD',
        'END:VTIMEZONE',
        vevent('UID:review', 'DTSTART;TZID=Europe/Berlin:20260101T090000', 'DTEND;TZID=Europe/Berlin:20260101T100000', 'RRULE:FREQ=WEEKLY;BYDAY=TH', 'EXDATE;TZID=Europe/Berlin:20261105T090000', 'SUMMARY:Review'),
        vevent('UID:review', 'RECURRENCE-ID;TZID=Europe/Berlin:20261112T090000', 'DTSTART;TZID=Europe/Berlin:20261112T140000', 'DTEND;TZID=Europe/Berlin:20261112T150000', 'SUMMARY:Review (moved)'),
      ].join('\r\n')))

      expect(shown(await calendarService.fetchData('GET', 'https://example.com/basic.ics'))).toEqual([
        'Review 2026-10-22T09:00:00+02:00 2026-10-22T10:00:00+02:00',
        'Review 2026-10-29T09:00:00+01:00 2026-10-29T10:00:00+01:00',
        'Review (moved) 2026-11-12T14:00:00+01:00 2026-11-12T15:00:00+01:00',
      ])
    })

    it('matches an exclusion, an override and an end of the rule given in another zone than the event, as the instants they name', async () => {
      mockFetch.mockResolvedValue(calendar([
        vevent('UID:sync', 'DTSTART;TZID=Europe/Berlin:20261020T233000', 'DTEND;TZID=Europe/Berlin:20261021T000000', 'RRULE:FREQ=DAILY;UNTIL=20261023T213000Z', 'EXDATE:20261020T213000Z', 'SUMMARY:Sync'),
        vevent('UID:sync', 'RECURRENCE-ID:20261021T213000Z', 'DTSTART:20261021T190000Z', 'DTEND:20261021T193000Z', 'SUMMARY:Sync (early)'),
      ].join('\r\n')))

      expect(shown(await calendarService.fetchData('GET', 'https://example.com/basic.ics'))).toEqual([
        'Sync (early) 2026-10-21T21:00:00+02:00 2026-10-21T21:30:00+02:00',
        'Sync 2026-10-22T23:30:00+02:00 2026-10-23T00:00:00+02:00',
        'Sync 2026-10-23T23:30:00+02:00 2026-10-24T00:00:00+02:00',
      ])
    })

    it('takes an override that moves the last occurrence of a rule into the window, and the events of every calendar in the feed', async () => {
      mockFetch.mockResolvedValue(new Response([
        'BEGIN:VCALENDAR',
        vevent('UID:offsite', 'DTSTART:20261201T090000Z', 'RRULE:FREQ=WEEKLY;COUNT=1', 'SUMMARY:Offsite'),
        vevent('UID:offsite', 'RECURRENCE-ID:20261201T090000Z', 'DTSTART:20261028T090000Z', 'DTEND:20261028T100000Z', 'SUMMARY:Offsite (brought forward)'),
        'END:VCALENDAR',
        'BEGIN:VCALENDAR',
        vevent('UID:dentist', 'DTSTART:20261027T080000Z', 'DTEND:20261027T090000Z', 'SUMMARY:Dentist'),
        'END:VCALENDAR',
        '',
      ].join('\r\n'), { status: 200, headers: { 'content-type': 'text/calendar' } }))

      expect(shown(await calendarService.fetchData('GET', 'https://example.com/basic.ics'))).toEqual([
        'Dentist 2026-10-27T09:00:00+01:00 2026-10-27T10:00:00+01:00',
        'Offsite (brought forward) 2026-10-28T10:00:00+01:00 2026-10-28T11:00:00+01:00',
      ])
    })

    it('keeps what overlaps the thirty days from the start of today, sorted by start, an all-day event as its dates', async () => {
      mockFetch.mockResolvedValue(calendar([
        vevent('UID:late', 'DTSTART:20261118T230000Z', 'DTEND:20261119T000000Z', 'SUMMARY:Past the window'),
        vevent('UID:holiday', 'DTSTART;VALUE=DATE:20261026', 'DTEND;VALUE=DATE:20261027', 'SUMMARY:Holiday'),
        vevent('UID:yesterday', 'DTSTART:20261019T080000Z', 'DTEND:20261019T090000Z', 'SUMMARY:Yesterday'),
        vevent('UID:overnight', 'DTSTART:20261019T200000Z', 'DTEND:20261020T060000Z', 'SUMMARY:Overnight'),
        vevent('UID:last', 'DTSTART:20261118T200000Z', 'DTEND:20261118T210000Z', 'SUMMARY:Last day'),
        vevent('UID:trip', 'DTSTART;VALUE=DATE:20261018', 'DTEND;VALUE=DATE:20261021', 'SUMMARY:Trip'),
      ].join('\r\n')))

      expect(shown(await calendarService.fetchData('GET', 'https://example.com/basic.ics'))).toEqual([
        'Trip 2026-10-18 2026-10-21 all day',
        'Overnight 2026-10-19T22:00:00+02:00 2026-10-20T08:00:00+02:00',
        'Holiday 2026-10-26 2026-10-27 all day',
        'Last day 2026-11-18T21:00:00+01:00 2026-11-18T22:00:00+01:00',
      ])
    })

    it('reads a time in a zone the feed defines under a name of its own, and a floating time in the Instance Time Zone', async () => {
      mockFetch.mockResolvedValue(calendar([
        'BEGIN:VTIMEZONE',
        'TZID:Eastern Standard Time',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:-0400',
        'TZOFFSETTO:-0500',
        'DTSTART:16011104T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
        'END:STANDARD',
        'BEGIN:DAYLIGHT',
        'TZOFFSETFROM:-0500',
        'TZOFFSETTO:-0400',
        'DTSTART:16010311T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
        'END:DAYLIGHT',
        'END:VTIMEZONE',
        vevent('UID:call', 'DTSTART;TZID=Eastern Standard Time:20261021T090000', 'DTEND;TZID=Eastern Standard Time:20261021T100000', 'SUMMARY:Call'),
        vevent('UID:lunch', 'DTSTART:20261022T120000', 'DTEND:20261022T130000', 'SUMMARY:Lunch'),
      ].join('\r\n')))

      expect(shown(await calendarService.fetchData('GET', 'https://example.com/basic.ics'))).toEqual([
        'Call 2026-10-21T15:00:00+02:00 2026-10-21T16:00:00+02:00',
        'Lunch 2026-10-22T12:00:00+02:00 2026-10-22T13:00:00+02:00',
      ])
    })

    it('reads a time in the hour the clocks go back twice as the first of the two', async () => {
      mockFetch.mockResolvedValue(calendar(vevent('UID:night', 'DTSTART;TZID=Europe/Berlin:20261025T023000', 'DTEND;TZID=Europe/Berlin:20261025T040000', 'SUMMARY:Night shift')))

      expect(shown(await calendarService.fetchData('GET', 'https://example.com/basic.ics'))).toEqual([
        'Night shift 2026-10-25T02:30:00+02:00 2026-10-25T04:00:00+01:00',
      ])
    })

    it('leaves out an event without a start and keeps the others', async () => {
      mockFetch.mockResolvedValue(calendar([
        vevent('UID:draft', 'SUMMARY:No time yet'),
        vevent('UID:dentist', 'DTSTART:20261027T080000Z', 'DTEND:20261027T090000Z', 'SUMMARY:Dentist'),
      ].join('\r\n')))

      expect(shown(await calendarService.fetchData('GET', 'https://example.com/basic.ics'))).toEqual([
        'Dentist 2026-10-27T09:00:00+01:00 2026-10-27T10:00:00+01:00',
      ])
    })

    it('reads a calendar served as text/plain or a download, and keeps a text/calendar body that does not parse as its text', async () => {
      const lone = vevent('UID:one', 'DTSTART;VALUE=DATE:20261020', 'SUMMARY:Today')
      mockFetch.mockResolvedValueOnce(calendar(lone, 'text/plain'))
      expect(shown(await calendarService.fetchData('GET', 'https://example.com/a.ics'))).toEqual(['Today 2026-10-20 2026-10-21 all day'])

      mockFetch.mockResolvedValueOnce(calendar(lone, 'application/octet-stream'))
      expect(shown(await calendarService.fetchData('GET', 'https://example.com/b.ics'))).toEqual(['Today 2026-10-20 2026-10-21 all day'])

      mockFetch.mockResolvedValueOnce(new Response('not a calendar', { status: 200, headers: { 'content-type': 'text/calendar' } }))
      expect(await calendarService.fetchData('GET', 'https://example.com/c.ics')).toBe('not a calendar')
    })
  })

  describe('several polling URLs (ADR-0058)', () => {
    it('requests each non-blank line the URL renders to and answers them as IDX_0, IDX_1, … in line order', async () => {
      mockRenderer.render.mockResolvedValue('https://a.example/one\n\n   https://b.example/two  \r\nhttps://c.example/three\n')
      mockFetch.mockImplementation(async (url: string | URL | Request) => jsonResponse({ from: String(url) }))

      const result = await service.fetchData('GET', '{% for feed in feeds %}{{ feed }}\n{% endfor %}', { Accept: 'application/json' }, undefined, { feeds: [] })

      expect(result).toEqual({ IDX_0: { from: 'https://a.example/one' }, IDX_1: { from: 'https://b.example/two' }, IDX_2: { from: 'https://c.example/three' } })
      expect(mockFetch.mock.calls.map(([url, init]) => [url, init?.headers])).toEqual([
        ['https://a.example/one', { Accept: 'application/json' }],
        ['https://b.example/two', { Accept: 'application/json' }],
        ['https://c.example/three', { Accept: 'application/json' }],
      ])
    })

    it('reads a line that answers a list or text under data, as TRMNL wraps each response before it is IDX_n (ADR-0061)', async () => {
      mockRenderer.render.mockResolvedValue('https://a.example/list\nhttps://b.example/text\nhttps://c.example/object')
      mockFetch
        .mockResolvedValueOnce(jsonResponse([1, 2]))
        .mockResolvedValueOnce(new Response('plain words', { status: 200, headers: { 'content-type': 'text/plain' } }))
        .mockResolvedValueOnce(jsonResponse({ ok: true }))

      expect(await service.fetchData('GET', '{{ urls }}', {}, undefined, {})).toEqual({ IDX_0: { data: [1, 2] }, IDX_1: { data: 'plain words' }, IDX_2: { ok: true } })
    })

    it('gives a line that fails its own error marker, so the other lines still read', async () => {
      mockRenderer.render.mockResolvedValue('https://a.example/one\nhttps://b.example/two')
      mockFetch.mockResolvedValueOnce(new Response('x', { status: 404 })).mockResolvedValueOnce(jsonResponse({ ok: true }))

      expect(await service.fetchData('GET', '{{ urls }}', {}, undefined, {})).toEqual({ IDX_0: { error: true, message: 'HTTP error! status: 404' }, IDX_1: { ok: true } })
    })

    it('refuses an internal host on any line in demo mode, with the marker on that line', async () => {
      mockConfigService.get.mockReturnValue(true)
      mockRenderer.render.mockResolvedValue('https://a.example/one\nhttp://localhost:3000/private')
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }))

      const result = await service.fetchData('GET', '{{ urls }}', {}, undefined, {}) as Record<string, unknown>

      expect(result.IDX_0).toEqual({ ok: true })
      expect(result.IDX_1).toMatchObject({ error: true })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('reads a single line, spaces around it dropped, as the one request it always was', async () => {
      mockRenderer.render.mockResolvedValue('  https://a.example/one \n')
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }))

      expect(await service.fetchData('GET', '{{ url }}', {}, undefined, {})).toEqual({ ok: true })
      expect(mockFetch).toHaveBeenCalledWith('https://a.example/one', expect.anything())
    })
  })

  describe('in demo mode', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue(true)
    })

    it('refuses a redirect to an internal host before requesting it', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }))

      await expect(service.fetchData('GET', 'https://attacker.example/r')).rejects.toThrow('not allowed in demo mode')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('refuses a host name that resolves to an internal address', async () => {
      mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])

      await expect(service.fetchData('GET', 'http://127.0.0.1.nip.io/')).rejects.toThrow('not allowed in demo mode')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('follows a redirect to a public host', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://api.example.com/v2' } })).mockResolvedValueOnce(jsonResponse({ ok: true }))

      expect(await service.fetchData('GET', 'https://api.example.com/v1')).toEqual({ ok: true })
      expect(mockFetch).toHaveBeenLastCalledWith('https://api.example.com/v2', expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }))
    })
  })

  it('answers an empty body as null', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 200 }))

    expect(await service.fetchData('GET', 'https://example.com/empty')).toBeNull()
  })

  describe('fetchForTransform', () => {
    it('passes the request through to fetch and answers the Response as is', async () => {
      const response = new Response('{"ok":true}', { status: 200 })
      mockFetch.mockResolvedValue(response)

      expect(await service.fetchForTransform('https://api.example.com/items', { method: 'POST', body: '{}' })).toBe(response)
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/items', { method: 'POST', body: '{}' })
    })

    it('refuses an internal host in demo mode, as a Data Source URL is refused', async () => {
      mockConfigService.get.mockReturnValue(true)

      await expect(service.fetchForTransform('http://127.0.0.1:9/secrets')).rejects.toThrow('not allowed in demo mode')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('refuses a redirect to an internal host in demo mode', async () => {
      mockConfigService.get.mockReturnValue(true)
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }))

      await expect(service.fetchForTransform('https://attacker.example/r')).rejects.toThrow('not allowed in demo mode')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  it('throws error when fetch fails', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, { ok: false, status: 404 }))

    await expect(
      service.fetchData('GET', 'https://api.example.com/notfound'),
    ).rejects.toThrow('HTTP error! status: 404')
  })

  it('throws error when network fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(
      service.fetchData('GET', 'https://api.example.com'),
    ).rejects.toThrow('Network error')
  })

  it('parses JSON response correctly', async () => {
    const complexData = {
      nested: { value: 123 },
      array: [1, 2, 3],
      string: 'test',
    }
    mockFetch.mockResolvedValue(jsonResponse(complexData))

    const result = await service.fetchData('GET', 'https://api.example.com')
    expect(result).toEqual(complexData)
  })
})
