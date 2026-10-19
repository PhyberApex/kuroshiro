import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { makeDeviceSensor, makePlugin, makePluginDataSource, makePluginField } from '../../test/fixtures.js'
import { createPluginTemplateContextService } from '../../test/mockPluginCollaborators.js'
import { PluginTemplateContextService } from '../services/plugin-template-context.service.js'

describe('pluginTemplateContextService', () => {
  const plugin = makePlugin({ name: 'Weather' })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('trmnl.user time zone', () => {
    const userAt = async (zone: string, at: string) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(at))
      const service = new PluginTemplateContextService(
        { resolveFor: async () => ({}) } as never,
        { resolveAll: async () => ({}) } as never,
        Object.assign(new InstanceTimeZone(), { name: zone }),
        { load: async () => ({}) } as never,
      )
      const { context } = await service.contextFor(plugin, [])
      return (context as { trmnl: { user: Record<string, unknown> } }).trmnl.user
    }

    it('carries the Instance Time Zone as time_zone_iana and time_zone', async () => {
      expect(await userAt('Europe/Berlin', '2030-01-05T09:00:00Z')).toMatchObject({ time_zone_iana: 'Europe/Berlin', time_zone: 'Europe/Berlin' })
    })

    it('carries the offset in seconds either side of a DST change', async () => {
      expect((await userAt('Europe/Berlin', '2030-01-05T09:00:00Z')).utc_offset).toBe(3600)
      expect((await userAt('Europe/Berlin', '2030-07-05T09:00:00Z')).utc_offset).toBe(7200)
      expect((await userAt('America/St_Johns', '2030-01-05T09:00:00Z')).utc_offset).toBe(-12600)
    })
  })

  it('includes the trmnl system object keyed by the plugin name', async () => {
    const { context } = await createPluginTemplateContextService().contextFor(plugin, [])

    expect(context).toMatchObject({
      trmnl: {
        plugin_settings: { instance_name: 'Weather' },
        user: { id: 'kuroshiro-user', locale: 'en', time_zone_iana: expect.any(String), utc_offset: expect.any(Number) },
        system: { timestamp_utc: expect.any(Number) },
      },
    })
  })

  describe('trmnl.plugin_settings.data_fetched_utc (ADR-0057)', () => {
    it('is the second the Data Sources were resolved at, for a Plugin that has any', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2030-01-05T09:00:00Z'))
      const polled = makePlugin({ name: 'Weather', dataSources: [makePluginDataSource({ name: 'source' })] })

      const { context } = await createPluginTemplateContextService({}, { resolveAll: async () => ({ source: { temp: 3 } }) }).contextFor(polled, [])

      expect(context).toMatchObject({ trmnl: { plugin_settings: { strategy: 'polling', data_fetched_utc: 1893834000 } } })
    })

    it('is absent for a Plugin with no Data Sources, which fetched nothing', async () => {
      const { context } = await createPluginTemplateContextService().contextFor(makePlugin({ name: 'Clock', dataSources: [] }), [])

      expect((context as { trmnl: { plugin_settings: Record<string, unknown> } }).trmnl.plugin_settings).not.toHaveProperty('data_fetched_utc')
    })

    it('is the second a Webhook-kind Plugin\'s payload arrived at, with the strategy TRMNL names', async () => {
      const webhook = makePlugin({ name: 'Feed', kind: 'Webhook', webhookPayload: { reading: 4 }, payloadReceivedAt: new Date('2030-01-05T09:00:00.700Z') })

      const { context } = await createPluginTemplateContextService().contextFor(webhook, [])

      expect(context).toMatchObject({ trmnl: { plugin_settings: { strategy: 'webhook', data_fetched_utc: 1893834000 } } })
    })

    it('is absent for a Webhook-kind Plugin that has not been sent a payload yet', async () => {
      const { context } = await createPluginTemplateContextService().contextFor(makePlugin({ name: 'Feed', kind: 'Webhook' }), [])

      expect((context as { trmnl: { plugin_settings: Record<string, unknown> } }).trmnl.plugin_settings).not.toHaveProperty('data_fetched_utc')
    })
  })

  it('tells the template the Plugin\'s screen modifiers as TRMNL spells them', async () => {
    const { context } = await createPluginTemplateContextService().contextFor(makePlugin({ name: 'Weather', noScreenPadding: true, darkMode: false }), [])

    expect(context).toMatchObject({ trmnl: { plugin_settings: { no_screen_padding: 'yes', dark_mode: 'no' } } })
  })

  it('shapes a sensors object keyed by kind for a device with readings across multiple kinds', async () => {
    const sensors = [
      makeDeviceSensor({ kind: 'temperature', value: 21.5, unit: 'C' }),
      makeDeviceSensor({ kind: 'humidity', value: 45, unit: '%' }),
    ]

    const { context } = await createPluginTemplateContextService().contextFor(plugin, sensors)

    expect(context).toHaveProperty('sensors', {
      temperature: { value: 21.5, unit: 'C' },
      humidity: { value: 45, unit: '%' },
    })
  })

  it('produces an empty sensors object for a device with none', async () => {
    const { context } = await createPluginTemplateContextService().contextFor(plugin, [])

    expect(context).toHaveProperty('sensors', {})
  })

  it('exposes the resolved Field Values as bare keys and under trmnl.plugin_settings.custom_fields_values', async () => {
    const { context } = await createPluginTemplateContextService({ city: 'Berlin' }).contextFor(plugin, [])

    expect(context).toMatchObject({ city: 'Berlin', trmnl: { plugin_settings: { custom_fields_values: { city: 'Berlin' } } } })
  })

  it('never lets a Field Value keyname replace trmnl or sensors', async () => {
    const { context } = await createPluginTemplateContextService({ trmnl: 'x', sensors: 'y' }).contextFor(plugin, [])

    expect(context).toMatchObject({ trmnl: { plugin_settings: { instance_name: 'Weather' } }, sensors: {} })
  })

  it('lays the Data Sources\' results by name over the rest, so the data wins a bare Field Value key', async () => {
    const withSource = makePlugin({ name: 'Weather', dataSources: [makePluginDataSource({ name: 'city' })] })
    const resolveAll = vi.fn().mockResolvedValue({ city: { name: 'from the Data Source' } })

    const { context, sourceData } = await createPluginTemplateContextService({ city: 'Berlin' }, { resolveAll }).contextFor(withSource, [])

    expect(context).toMatchObject({ city: { name: 'from the Data Source' }, trmnl: { plugin_settings: { custom_fields_values: { city: 'Berlin' } } } })
    expect(sourceData).toEqual({ city: { name: 'from the Data Source' } })
    expect(resolveAll).toHaveBeenCalledWith(withSource.dataSources, expect.objectContaining({ city: 'Berlin' }), { savedStates: {} })
  })

  describe('saved state (ADR-0052)', () => {
    const lone = makePlugin({ name: 'Trend', dataSources: [makePluginDataSource({ id: 'ds-1', name: 'source', transformJs: 'x' })] })

    it('takes trmnl_state out of a Data Source\'s result, lists it as the state the run wrote, and lets a lone Data Source\'s template read it as trmnl.state', async () => {
      const resolveAll = vi.fn().mockResolvedValue({ source: { price: 3, trmnl_state: { history: [1, 3] } } })

      const { context, sourceData, sourceStates } = await createPluginTemplateContextService({}, { resolveAll }).contextFor(lone, [])

      expect(context).toMatchObject({ price: 3, source: { price: 3 }, trmnl: { state: { history: [1, 3] } } })
      expect(context).not.toHaveProperty('trmnl_state')
      expect((context as { source: object }).source).not.toHaveProperty('trmnl_state')
      expect(sourceData).toEqual({ source: { price: 3 } })
      expect(sourceStates).toEqual({ source: { history: [1, 3] } })
    })

    it('reads the saved state for the request and the template when the run writes none', async () => {
      const resolveAll = vi.fn().mockResolvedValue({ source: { price: 3 } })
      const savedStates = { 'ds-1': { history: [1] } }

      const { context, sourceStates } = await createPluginTemplateContextService({}, { resolveAll }, { load: async () => savedStates }).contextFor(lone, [])

      expect(context).toMatchObject({ trmnl: { state: { history: [1] } } })
      expect(sourceStates).toEqual({})
      expect(resolveAll).toHaveBeenCalledWith(lone.dataSources, expect.objectContaining({ trmnl: expect.objectContaining({ state: { history: [1] } }) }), { savedStates })
    })

    it.each([
      ['a list', [1, 2]],
      ['text', 'abc'],
      ['more than 8192 bytes', { big: 'x'.repeat(8192) }],
    ])('drops a trmnl_state that is %s, keeping the saved state, and still takes it out of the data', async (_, written) => {
      const resolveAll = vi.fn().mockResolvedValue({ source: { price: 3, trmnl_state: written } })

      const { context, sourceStates } = await createPluginTemplateContextService({}, { resolveAll }, { load: async () => ({ 'ds-1': { kept: true } }) }).contextFor(lone, [])

      expect(context).toMatchObject({ trmnl: { state: { kept: true } }, source: { price: 3 } })
      expect(sourceStates).toEqual({})
    })

    it('gives a template no trmnl.state when the Plugin has two Data Sources, though each transform wrote its own', async () => {
      const two = makePlugin({ name: 'Two', dataSources: [makePluginDataSource({ id: 'ds-1', name: 'a' }), makePluginDataSource({ id: 'ds-2', name: 'b' })] })
      const resolveAll = vi.fn().mockResolvedValue({ a: { trmnl_state: { n: 1 } }, b: { trmnl_state: { n: 2 } } })

      const { context, sourceStates } = await createPluginTemplateContextService({}, { resolveAll }).contextFor(two, [])

      expect(context).toMatchObject({ trmnl: { state: {} }, a: {}, b: {} })
      expect(sourceStates).toEqual({ a: { n: 1 }, b: { n: 2 } })
    })
  })

  describe('a lone Data Source', () => {
    const lone = makePlugin({ name: 'Letters', dataSources: [makePluginDataSource({ name: 'source' })] })

    it('lays its keys at the root as well as under its name, as TRMNL does with one polling URL', async () => {
      const resolveAll = vi.fn().mockResolvedValue({ source: { author: 'Seneca', title: 'On the shortness of life' } })

      const { context, sourceData } = await createPluginTemplateContextService({ author: 'from the Field Value' }, { resolveAll }).contextFor(lone, [])

      expect(context).toMatchObject({ author: 'Seneca', title: 'On the shortness of life', source: { author: 'Seneca' } })
      expect(sourceData).toEqual({ source: { author: 'Seneca', title: 'On the shortness of life' } })
    })

    it('never lets its keys replace trmnl, sensors or the Data Source\'s own name', async () => {
      const resolveAll = vi.fn().mockResolvedValue({ source: { trmnl: 'x', sensors: 'y', source: 'z' } })

      const { context } = await createPluginTemplateContextService({}, { resolveAll }).contextFor(lone, [makeDeviceSensor({ kind: 'temperature', value: 21, unit: 'C' })])

      expect(context).toMatchObject({ trmnl: { plugin_settings: { instance_name: 'Letters' } }, sensors: { temperature: { value: 21, unit: 'C' } }, source: { source: 'z' } })
    })

    it.each([
      ['a list', [1, 2]],
      ['text', '<rss/>'],
    ])('lays %s at the root as data, as TRMNL wraps one polling URL\'s response that is not an object (ADR-0058)', async (_, result) => {
      const resolveAll = vi.fn().mockResolvedValue({ source: result })

      const { context } = await createPluginTemplateContextService({ data: 'from the Field Value' }, { resolveAll }).contextFor(lone, [])

      expect(context).toMatchObject({ data: result, source: result })
    })

    it.each([
      ['nothing', null],
      ['an error marker', { error: true, message: 'HTTP 500' }],
    ])('lays nothing at the root when its result is %s', async (_, result) => {
      const resolveAll = vi.fn().mockResolvedValue({ source: result })

      const { context } = await createPluginTemplateContextService({}, { resolveAll }).contextFor(lone, [])

      expect(Object.keys(context)).toEqual(['trmnl', 'sensors', 'source'])
    })

    it('lays nothing at the root when the Plugin has two Data Sources', async () => {
      const two = makePlugin({ name: 'Weather', dataSources: [makePluginDataSource({ name: 'now' }), makePluginDataSource({ name: 'forecast' })] })
      const resolveAll = vi.fn().mockResolvedValue({ now: { temp: 21 }, forecast: { temp: 19 } })

      const { context } = await createPluginTemplateContextService({}, { resolveAll }).contextFor(two, [])

      expect(context).not.toHaveProperty('temp')
    })
  })

  it('exposes the resolved Field Values unhidden, so a caller that must hide a secret elsewhere does not resolve them twice', async () => {
    const fields = [makePluginField({ keyname: 'api_key', fieldType: 'password' })]

    const { resolvedFieldValues } = await createPluginTemplateContextService({ api_key: 'hunter2', city: 'Berlin' })
      .contextFor(plugin, [], {}, { hideSecretsOf: fields })

    expect(resolvedFieldValues).toEqual({ api_key: 'hunter2', city: 'Berlin' })
  })

  it('lays a Webhook-kind Plugin\'s Webhook Payload keys over trmnl, its Field Values and sensors, and fetches nothing', async () => {
    const webhook = makePlugin({ name: 'Feed', kind: 'Webhook', webhookPayload: { reading: 4 } })
    const resolveAll = vi.fn()

    const { context } = await createPluginTemplateContextService({ city: 'Berlin' }, { resolveAll }).contextFor(webhook, [])

    expect(context).toMatchObject({ reading: 4, city: 'Berlin', sensors: {}, trmnl: { plugin_settings: { instance_name: 'Feed' } } })
    expect(resolveAll).not.toHaveBeenCalled()
  })

  it('passes a Webhook Payload that is a list through alone', async () => {
    const webhook = makePlugin({ kind: 'Webhook', webhookPayload: [1, 2] })

    const { context } = await createPluginTemplateContextService({ city: 'Berlin' }).contextFor(webhook, [])

    expect(context).toEqual([1, 2])
  })

  describe('for what is not saved yet', () => {
    it('uses the unsaved name and Data Sources in place of the stored ones', async () => {
      const stored = makePlugin({ name: 'Weather', dataSources: [makePluginDataSource({ name: 'stored' })] })
      const unsavedSources = [{ name: 'unsaved', mode: 'literal' as const, literalValue: { n: 1 } }]
      const resolveAll = vi.fn().mockResolvedValue({ unsaved: { n: 1 } })

      const { context } = await createPluginTemplateContextService({}, { resolveAll }).contextFor(stored, [], { name: 'Forecast', dataSources: unsavedSources })

      expect(context).toMatchObject({ unsaved: { n: 1 }, trmnl: { plugin_settings: { instance_name: 'Forecast' } } })
      expect(resolveAll).toHaveBeenCalledWith(unsavedSources, expect.anything(), { savedStates: {} })
    })

    it('hides a password Field Value in both address forms, and still fetches with the real one', async () => {
      const fields = [makePluginField({ keyname: 'api_key', fieldType: 'password' }), makePluginField({ keyname: 'city', fieldType: 'string' }), makePluginField({ keyname: 'unset', fieldType: 'password' })]
      const resolveAll = vi.fn().mockResolvedValue({})

      const { context, fieldValues } = await createPluginTemplateContextService({ api_key: 'hunter2', city: 'Berlin', unset: '' }, { resolveAll })
        .contextFor(plugin, [], {}, { hideSecretsOf: fields })

      const shown = { api_key: '••••••••', city: 'Berlin', unset: '' }
      expect(context).toMatchObject({ ...shown, trmnl: { plugin_settings: { custom_fields_values: shown } } })
      expect(fieldValues).toEqual(shown)
      expect(JSON.stringify(context)).not.toContain('hunter2')
      expect(resolveAll).toHaveBeenCalledWith([], expect.objectContaining({ api_key: 'hunter2', trmnl: expect.objectContaining({ plugin_settings: expect.objectContaining({ custom_fields_values: expect.objectContaining({ api_key: 'hunter2' }) }) }) }), { savedStates: {} })
    })
  })
})
