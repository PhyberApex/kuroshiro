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
    expect(resolveAll).toHaveBeenCalledWith(withSource.dataSources, expect.objectContaining({ city: 'Berlin' }))
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
      expect(resolveAll).toHaveBeenCalledWith(unsavedSources, expect.anything())
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
      expect(resolveAll).toHaveBeenCalledWith([], expect.objectContaining({ api_key: 'hunter2', trmnl: expect.objectContaining({ plugin_settings: expect.objectContaining({ custom_fields_values: expect.objectContaining({ api_key: 'hunter2' }) }) }) }))
    })
  })
})
