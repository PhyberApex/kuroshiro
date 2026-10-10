import type { PluginFieldRead } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { buildPluginDetail, buildPluginField } from '@/testing/fixtures/plugins'
import { creditOf, fieldControl, fieldsWithRow, fieldValueNote, isClearable, isOn, pluginFieldValues, valuesAmong } from '../pluginFieldValues'

const field = (keyname: string, overrides: Partial<PluginFieldRead> = {}) => buildPluginField({ id: `${keyname}-id`, keyname, label: keyname, ...overrides })

const WEATHER = buildPluginDetail({
  fields: [field('location'), field('units', { type: 'select', default: 'metric' }), field('api_key', { type: 'password' }), field('author_bio', { type: 'author_bio' })],
  fieldValues: {
    location: { secret: false, value: 'Lindenplatz' },
    units: { secret: false, value: null },
    api_key: { secret: true, set: true },
    author_bio: { secret: false, value: null },
  },
})

describe('the Field Values of the Plugin\'s form', () => {
  it('saves the Field Values and nothing else', () => {
    expect(pluginFieldValues.keys).toEqual(['fieldValues'])
  })

  it('holds what each control shows, and neither a password nor a credit', () => {
    expect(pluginFieldValues.read(WEATHER)).toEqual({ values: { location: 'Lindenplatz', units: '' } })
  })

  describe('what a save sends', () => {
    it('is every value it holds, and null to clear one, so a password that was not replaced is left out', () => {
      expect(pluginFieldValues.toInput(pluginFieldValues.read(WEATHER))).toEqual({ fieldValues: { location: 'Lindenplatz', units: null } })
    })

    it('holds a password that was typed', () => {
      expect(pluginFieldValues.toInput({ values: { api_key: 'hunter2' } })).toEqual({ fieldValues: { api_key: 'hunter2' } })
    })

    it('is the same whatever order the values were entered in', () => {
      const one = pluginFieldValues.toInput({ values: { location: 'Lindenplatz', units: 'metric' } })
      const other = pluginFieldValues.toInput({ values: { units: 'metric', location: 'Lindenplatz' } })

      expect(JSON.stringify(one)).toBe(JSON.stringify(other))
    })
  })

  describe('the values among the Plugin Fields as the form holds them', () => {
    const saved = { location: 'Lindenplatz', units: '' }

    it('stay as they are while every keyname is there', () => {
      expect(valuesAmong(['location', 'units', 'api_key'], { location: 'Marktplatz', units: '', api_key: 'hunter2' }, saved))
        .toEqual({ location: 'Marktplatz', units: '', api_key: 'hunter2' })
    })

    it('lose the value of a keyname that is gone: a changed keyname starts its Field Value over', () => {
      expect(valuesAmong(['place', 'units'], { location: 'Marktplatz', units: '' }, saved)).toEqual({ units: '' })
    })

    it('hold no empty value for a keyname with nothing to clear, so a stored password is kept', () => {
      expect(valuesAmong(['location', 'api_key', 'station'], { location: '', api_key: '', station: '' }, saved)).toEqual({ location: '' })
    })

    it('hold an empty value for a stored password whose Plugin Field is no password any more, which clears it at the save', () => {
      expect(valuesAmong(['location', 'api_key'], { location: 'Lindenplatz' }, saved, ['api_key'])).toEqual({ location: 'Lindenplatz', api_key: '' })
      expect(valuesAmong(['location', 'api_key'], { location: 'Lindenplatz', api_key: 'in the open' }, saved, ['api_key'])).toEqual({ location: 'Lindenplatz', api_key: 'in the open' })
    })

    it('take the saved value of a keyname that is back', () => {
      expect(valuesAmong(['location', 'units'], { units: '' }, saved)).toEqual({ location: 'Lindenplatz', units: '' })
    })
  })

  it.each([
    ['string', 'text'],
    ['url', 'text'],
    ['text', 'textarea'],
    ['number', 'number'],
    ['boolean', 'switch'],
    ['select', 'select'],
    ['password', 'secret'],
    ['time_zone', 'text'],
    [undefined, 'text'],
  ])('enters a Plugin Field of type %s with the control "%s"', (type, control) => {
    expect(fieldControl(type)).toBe(control)
  })

  describe('the note at the right of a row', () => {
    const optional = { fieldType: 'string', required: false }
    const required = { fieldType: 'string', required: true }

    it('is "The default" while the value is the default, or none is entered and there is one', () => {
      expect(fieldValueNote({ ...optional, defaultValue: 'metric' }, { entered: 'metric', secretStored: false })).toBe('The default')
      expect(fieldValueNote({ ...required, defaultValue: 'metric' }, { entered: '', secretStored: false })).toBe('The default')
    })

    it('is nothing for another value, and for none without a default', () => {
      expect(fieldValueNote({ ...optional, defaultValue: 'metric' }, { entered: 'imperial', secretStored: false })).toBeUndefined()
      expect(fieldValueNote(optional, { entered: '', secretStored: false })).toBeUndefined()
    })

    it('says a stored password is set, until another is typed', () => {
      const password = { fieldType: 'password', required: true }

      expect(fieldValueNote(password, { entered: '', secretStored: true })).toBe('Set. A secret is never shown again.')
      expect(fieldValueNote(password, { entered: 'hunter2', secretStored: true })).toBeUndefined()
    })

    it('is "Empty" for a required Plugin Field with neither a value nor a default', () => {
      expect(fieldValueNote(required, { entered: '', secretStored: false })).toBe('Empty')
      expect(fieldValueNote({ fieldType: 'password', required: true }, { entered: '', secretStored: false })).toBe('Empty')
      expect(fieldValueNote(required, { entered: 'Lindenplatz', secretStored: false })).toBeUndefined()
    })
  })

  it('offers "Clear" for a select or on/off Field Value that holds a value, never for another type or an empty value', () => {
    expect(isClearable('select', 'imperial')).toBe(true)
    expect(isClearable('boolean', 'true')).toBe(true)
    expect(isClearable('select', '')).toBe(false)
    expect(isClearable('boolean', '')).toBe(false)
    expect(isClearable('string', 'Lindenplatz')).toBe(false)
    expect(isClearable('password', 'hunter2')).toBe(false)
  })

  it('reads a switch as on for the value true, and for the default while there is no value', () => {
    expect(isOn('true', undefined)).toBe(true)
    expect(isOn('false', 'true')).toBe(false)
    expect(isOn('', 'true')).toBe(true)
    expect(isOn('', undefined)).toBe(false)
  })

  it('reads the credit from the author_bio Plugin Field', () => {
    expect(creditOf([{ keyname: 'location', name: 'Location' }, { keyname: 'author_bio', name: 'About', fieldType: 'author_bio', description: 'Made by Mika.' }])).toBe('Made by Mika.')
    expect(creditOf([{ keyname: 'location', name: 'Location' }])).toBeUndefined()
  })

  it('gives a row to every Plugin Field that is an input, once per keyname', () => {
    const fields = [
      { keyname: 'location', name: 'Location' },
      { keyname: '', name: 'Not named yet' },
      { keyname: 'author_bio', name: 'About', fieldType: 'author_bio' },
      { keyname: 'location', name: 'A second location' },
      { keyname: 'units', name: 'Units' },
    ]

    expect(fieldsWithRow(fields).map(field => field.name)).toEqual(['Location', 'Units'])
  })
})
