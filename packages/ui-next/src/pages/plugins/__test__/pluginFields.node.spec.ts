import type { PluginFieldRead } from 'kuroshiro-shared'
import type { PluginFieldDraft } from '../pluginFields'
import { describe, expect, it } from 'vitest'
import { buildPluginDetail, buildPluginField } from '@/testing/fixtures/plugins'
import { addedPluginField, fieldPaths, inOrderOf, pluginFields, typeName } from '../pluginFields'

const field = (overrides: Partial<PluginFieldRead>) => buildPluginField({ id: 'location-id', ...overrides })

const LOCATION = field({ helpText: 'A place name or a postcode.', required: true })
const UNITS = field({
  id: 'units-id',
  keyname: 'units',
  label: 'Units',
  type: 'select',
  default: 'metric',
  order: 1,
  options: [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }],
})
const API_KEY = field({ id: 'key-id', keyname: 'api_key', label: 'API key', type: 'password', order: 2 })

const weather = (fields: PluginFieldRead[] = [LOCATION, UNITS, API_KEY]) => buildPluginDetail({ name: 'Weather', fields })

const drafted = (fields?: PluginFieldRead[]) => pluginFields.read(weather(fields)).rows

const row = (overrides: Partial<PluginFieldDraft>): PluginFieldDraft => ({ ...drafted([LOCATION])[0]!, ...overrides })

const problems = (rows: PluginFieldDraft[], plugin = weather()) => pluginFields.validate!({ rows }, { plugin, unsaved: {} })

describe('the Plugin Fields of the Plugin\'s form', () => {
  it('saves the Plugin Fields and nothing else', () => {
    expect(pluginFields.keys).toEqual(['fields'])
  })

  describe('read', () => {
    it('holds each Plugin Field as its form shows it, keyed by its id', () => {
      expect(drafted([UNITS])).toEqual([{
        key: 'units-id',
        id: 'units-id',
        keyname: 'units',
        label: 'Units',
        type: 'select',
        default: 'metric',
        options: 'Metric\nImperial',
        storedOptions: [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }],
        helpText: '',
        required: false,
        removed: false,
      }])
    })

    it('reads the same Plugin as the same draft', () => {
      expect(pluginFields.read(weather())).toEqual(pluginFields.read(weather()))
    })
  })

  describe('what a save sends', () => {
    it('is every Plugin Field in its order, as the server takes it', () => {
      expect(pluginFields.toInput({ rows: drafted() })).toEqual({
        fields: [
          { keyname: 'location', name: 'Location', fieldType: 'string', description: 'A place name or a postcode.', options: null, required: true, order: 0 },
          { keyname: 'units', name: 'Units', fieldType: 'select', defaultValue: 'metric', options: [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }], required: false, order: 1 },
          { keyname: 'api_key', name: 'API key', fieldType: 'password', options: null, required: false, order: 2 },
        ],
      })
    })

    it('leaves a removed Plugin Field out and counts the order without it', () => {
      const [location, units, key] = drafted()
      const { fields } = pluginFields.toInput({ rows: [{ ...location!, removed: true }, units!, key!] })

      expect(fields!.map(sent => [sent.keyname, sent.order])).toEqual([['units', 0], ['api_key', 1]])
    })

    it('trims the keyname and the label, and sends an empty label as it is', () => {
      const { fields } = pluginFields.toInput({ rows: [row({ keyname: ' place ', label: '  ' })] })

      expect(fields![0]).toMatchObject({ keyname: 'place', name: '' })
    })

    it('keeps the value of an option whose label was not touched, and makes a new line its own value', () => {
      const [units] = drafted([UNITS])
      const { fields } = pluginFields.toInput({ rows: [{ ...units!, options: 'Metric\n\n Scientific \nImperial' }] })

      expect(fields![0]!.options).toEqual([
        { label: 'Metric', value: 'metric' },
        { label: 'Scientific', value: 'Scientific' },
        { label: 'Imperial', value: 'imperial' },
      ])
    })

    it('keeps the value of an option that was given another label in its place', () => {
      const [units] = drafted([UNITS])
      const { fields } = pluginFields.toInput({ rows: [{ ...units!, options: 'Metric (°C)\nImperial' }] })

      expect(fields![0]!.options).toEqual([{ label: 'Metric (°C)', value: 'metric' }, { label: 'Imperial', value: 'imperial' }])
    })

    it('keeps two options of one label apart', () => {
      const twice = field({ type: 'select', options: [{ label: 'Auto', value: 'auto' }, { label: 'Auto', value: 'auto_night' }] })

      expect(pluginFields.toInput({ rows: drafted([twice]) }).fields![0]!.options).toEqual([{ label: 'Auto', value: 'auto' }, { label: 'Auto', value: 'auto_night' }])
    })

    it('sends no default for a Password', () => {
      const { fields } = pluginFields.toInput({ rows: [row({ type: 'password', default: 'hunter2' })] })

      expect(fields![0]).not.toHaveProperty('defaultValue')
    })

    it('passes a type Kuroshiro does not know through as written, with its options', () => {
      const zone = field({ type: 'time_zone', options: [{ label: 'Berlin', value: 'Europe/Berlin' }] })
      const { fields } = pluginFields.toInput({ rows: drafted([zone]) })

      expect(fields![0]).toMatchObject({ fieldType: 'time_zone', options: [{ label: 'Berlin', value: 'Europe/Berlin' }] })
    })
  })

  describe('what stops a save', () => {
    it('is nothing for the Plugin Fields as they are saved', () => {
      expect(problems(drafted())).toEqual([])
    })

    it.each(['', '  ', '2fast', 'with space', 'dash-ed', 'ümlaut'])('is a keyname like "%s"', (keyname) => {
      expect(problems([row({ keyname })])).toEqual([
        { path: 'fields.0.keyname', message: 'Use letters, digits and underscores, starting with a letter.' },
      ])
    })

    it('is a keyname another Plugin Field before it has', () => {
      const [location, units] = drafted()

      expect(problems([location!, { ...units!, keyname: 'location' }])).toEqual([
        { path: 'fields.1.keyname', message: 'Another Plugin Field is called location.' },
      ])
    })

    it('is a keyname that is the name of a Data Source, as the form holds them', () => {
      const [location] = drafted()
      const asSaved = pluginFields.validate!({ rows: [{ ...location!, keyname: 'forecast' }] }, { plugin: weather(), unsaved: {} })
      const asEntered = pluginFields.validate!({ rows: [{ ...location!, keyname: 'pollen' }] }, { plugin: weather(), unsaved: { dataSources: [{ name: 'pollen', mode: 'literal' }] } })

      expect(asSaved).toEqual([{ path: 'fields.0.keyname', message: 'forecast is already the name of a Data Source.' }])
      expect(asEntered).toEqual([{ path: 'fields.0.keyname', message: 'pollen is already the name of a Data Source.' }])
    })

    it('is the keyname trmnl', () => {
      expect(problems([row({ keyname: 'trmnl' })])).toEqual([{ path: 'fields.0.keyname', message: '`trmnl` is taken by Kuroshiro.' }])
    })

    it('is a Select without an option', () => {
      expect(problems([row({ type: 'select', options: ' \n' })])).toEqual([{ path: 'fields.0.options', message: 'A Select needs at least one option.' }])
    })

    it('counts only the Plugin Fields that are sent, and checks none that is removed', () => {
      const [location, units] = drafted()

      expect(problems([{ ...location!, keyname: '', removed: true }, { ...units!, keyname: '' }])).toEqual([
        { path: 'fields.0.keyname', message: 'Use letters, digits and underscores, starting with a letter.' },
      ])
    })
  })

  it('gives each Plugin Field that is sent its path', () => {
    const [location, units, key] = drafted()

    expect(fieldPaths([location!, { ...units!, removed: true }, key!])).toEqual(['fields.0', undefined, 'fields.1'])
  })

  describe('"Add a Plugin Field"', () => {
    it('appends a Single-line text called field', () => {
      expect(addedPluginField([])).toEqual({
        key: 'added-1',
        id: null,
        keyname: 'field',
        label: '',
        type: 'string',
        default: '',
        options: '',
        storedOptions: null,
        helpText: '',
        required: false,
        removed: false,
      })
    })

    it('takes the next free keyname and key', () => {
      const first = addedPluginField([])
      const second = addedPluginField([first])

      expect([second.key, second.keyname]).toEqual(['added-2', 'field_2'])
    })
  })

  it('puts the rows in the order of their keys', () => {
    const rows = drafted()

    expect(inOrderOf(rows, ['key-id', 'location-id', 'units-id']).map(moved => moved.keyname)).toEqual(['api_key', 'location', 'units'])
  })

  it.each([
    ['string', 'Single-line text'],
    ['url', 'Single-line text'],
    ['text', 'Multi-line text'],
    ['number', 'Number'],
    ['boolean', 'On or off'],
    ['password', 'Password'],
    ['select', 'Select'],
    ['author_bio', 'Credit, read-only'],
    ['time_zone', 'Single-line text'],
  ])('calls the type %s "%s"', (type, name) => {
    expect(typeName(type)).toBe(name)
  })
})
