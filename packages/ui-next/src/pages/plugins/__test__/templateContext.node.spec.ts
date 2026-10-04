import { describe, expect, it } from 'vitest'
import { buildPluginDetail, buildPluginField } from '@/testing/fixtures/plugins'
import { formContext } from '../templateContext'

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

describe('the context the preview draws against, from the form alone', () => {
  it('holds the unsaved name and every Field Value in both address forms', () => {
    const values = { location: 'Marktplatz', units: 'metric', api_key: '••••••••', token: '' }

    expect(formContext(WEATHER, { name: 'Forecast', fields: FIELDS, fieldValues: { location: 'Marktplatz', units: null } })).toEqual({
      ...values,
      trmnl: { plugin_settings: { instance_name: 'Forecast', custom_fields_values: values } },
    })
  })

  it('reads a Plugin Field\'s default where there is no value, and a typed password as eight dots', () => {
    const context = formContext(WEATHER, { fields: FIELDS, fieldValues: { location: null, units: 'imperial', token: 'hunter2' } })

    expect(context).toMatchObject({ location: '', units: 'imperial', api_key: '••••••••', token: '••••••••' })
  })

  it('reads a password that is cleared as empty', () => {
    expect(formContext(WEATHER, { fields: FIELDS, fieldValues: { api_key: null } })).toMatchObject({ api_key: '' })
  })

  it('reads the saved Plugin where a part of the form is not there', () => {
    expect(formContext(WEATHER, {})).toMatchObject({
      location: 'Lindenplatz',
      units: 'metric',
      api_key: '••••••••',
      trmnl: { plugin_settings: { instance_name: 'Weather' } },
    })
  })
})
