import type { PreviewData } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { buildPluginDetail, buildPluginField, buildPreviewData } from '@/testing/fixtures/plugins'
import { heldWithForm } from '../templateContext'

const WEATHER = buildPluginDetail({
  name: 'Weather',
  fields: [
    buildPluginField({ keyname: 'location' }),
    buildPluginField({ keyname: 'units', type: 'select', default: 'metric' }),
    buildPluginField({ keyname: 'api_key', type: 'password' }),
    buildPluginField({ keyname: 'token', type: 'password' }),
  ],
  fieldValues: {
    location: { secret: false, value: 'Lindenplatz' },
    units: { secret: false, value: null },
    api_key: { secret: true, set: true },
    token: { secret: true, set: false },
  },
})

const FIELDS = [
  { keyname: 'location', name: 'Location', fieldType: 'string' },
  { keyname: 'units', name: 'Units', fieldType: 'select', defaultValue: 'metric' },
  { keyname: 'api_key', name: 'API key', fieldType: 'password' },
  { keyname: 'token', name: 'Token', fieldType: 'password' },
]

const SYSTEM = { timestamp_utc: 1790926500 }
const FORECAST = { today: { summary: 'Rain from 15:00' } }

/** What the server answered for Weather as it is saved. */
function fetched(overrides: Partial<PreviewData> = {}) {
  const values = { location: 'Lindenplatz', units: 'metric', api_key: '••••••••', token: '' }
  return buildPreviewData({
    context: {
      ...values,
      trmnl: { system: SYSTEM, plugin_settings: { instance_name: 'Weather', strategy: 'polling', custom_fields_values: values } },
      sensors: { temperature: { value: 21.5, unit: 'celsius' } },
      forecast: FORECAST,
    },
    names: [
      { name: 'location', origin: 'fieldValue', error: null },
      { name: 'units', origin: 'fieldValue', error: null },
      { name: 'api_key', origin: 'fieldValue', error: null },
      { name: 'token', origin: 'fieldValue', error: null },
      { name: 'forecast', origin: 'dataSource', error: null },
      { name: 'sensors', origin: 'sensors', error: null },
      { name: 'trmnl', origin: 'trmnl', error: null },
    ],
    ...overrides,
  })
}

describe('the held preview data with the form laid over it', () => {
  it('writes the unsaved name and every Field Value in both address forms, and keeps what was fetched', () => {
    const values = { location: 'Marktplatz', units: 'metric', api_key: '••••••••', token: '' }

    const held = heldWithForm(fetched(), WEATHER, { name: 'Forecast', fields: FIELDS, fieldValues: { location: 'Marktplatz', units: null } })

    expect(held.context).toEqual({
      ...values,
      trmnl: { system: SYSTEM, plugin_settings: { instance_name: 'Forecast', strategy: 'polling', custom_fields_values: values } },
      sensors: { temperature: { value: 21.5, unit: 'celsius' } },
      forecast: FORECAST,
    })
    expect(held.names).toEqual(fetched().names)
  })

  it('reads a Plugin Field\'s default where there is no value, and a typed password as eight dots', () => {
    const held = heldWithForm(fetched(), WEATHER, { fields: FIELDS, fieldValues: { location: null, units: 'imperial', token: 'hunter2' } })

    expect(held.context).toMatchObject({ location: '', units: 'imperial', api_key: '••••••••', token: '••••••••' })
  })

  it('reads a password that is cleared as empty', () => {
    expect(heldWithForm(fetched(), WEATHER, { fields: FIELDS, fieldValues: { api_key: null } }).context).toMatchObject({ api_key: '' })
  })

  it('reads the saved Plugin where a part of the form is not there', () => {
    expect(heldWithForm(fetched(), WEATHER, {}).context).toEqual(fetched().context)
  })

  it('follows the Plugin Fields of the form: a renamed keyname takes the old one\'s place and a new one is listed in its place', () => {
    const fields = [
      { keyname: 'place', name: 'Location', fieldType: 'string' },
      { keyname: 'days', name: 'Days', fieldType: 'number', defaultValue: '3' },
    ]

    const held = heldWithForm(fetched(), WEATHER, { fields, fieldValues: { place: 'Marktplatz' } })

    expect(held.context).not.toHaveProperty('location')
    expect(held.context).toMatchObject({ place: 'Marktplatz', days: '3', forecast: FORECAST })
    expect(held.names.map(({ name, origin }) => `${name} ${origin}`)).toEqual(['place fieldValue', 'days fieldValue', 'forecast dataSource', 'sensors sensors', 'trmnl trmnl'])
  })

  it('leaves a name the data replaces to the data, and gives a Plugin Field named like a built-in name no row', () => {
    const fields = [
      { keyname: 'forecast', name: 'Forecast', fieldType: 'string' },
      { keyname: 'sensors', name: 'Sensors', fieldType: 'string' },
    ]

    const held = heldWithForm(fetched(), WEATHER, { fields, fieldValues: { forecast: 'sunny', sensors: 'none' } })

    expect(held.context).toMatchObject({ forecast: FORECAST, sensors: { temperature: { value: 21.5, unit: 'celsius' } } })
    expect(held.names.map(({ name }) => name)).toEqual(['forecast', 'sensors', 'trmnl'])
    expect(held.context).toHaveProperty('trmnl.plugin_settings.custom_fields_values', { forecast: 'sunny', sensors: 'none' })
  })

  it('leaves a Webhook Payload that replaces `trmnl` or is a list as it was received', () => {
    const replaced = fetched({ context: { trmnl: 'ours' }, names: [{ name: 'trmnl', origin: 'webhookPayload', error: null }] })
    const list = fetched({ context: [1, 2], names: [] })

    expect(heldWithForm(replaced, WEATHER, { name: 'Forecast', fields: [] }).context).toEqual({ trmnl: 'ours' })
    expect(heldWithForm(list, WEATHER, { name: 'Forecast' })).toEqual(list)
  })
})
