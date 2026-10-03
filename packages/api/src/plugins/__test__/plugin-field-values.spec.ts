import { describe, expect, it } from 'vitest'
import { makePluginField } from '../../test/fixtures.js'
import { fieldValueViews, needsValues, resolveFieldValues } from '../plugin-field-values.js'

describe('plugin field values', () => {
  const city = makePluginField({ keyname: 'city', defaultValue: 'Tokyo' })
  const units = makePluginField({ keyname: 'units', defaultValue: null })

  describe('resolveFieldValues', () => {
    it('uses the Field Value, else the Plugin Field\'s default, else empty', () => {
      expect(resolveFieldValues([city, units], { city: 'Berlin' })).toEqual({ city: 'Berlin', units: '' })
      expect(resolveFieldValues([city, units], {})).toEqual({ city: 'Tokyo', units: '' })
    })
  })

  describe('needsValues', () => {
    const required = makePluginField({ keyname: 'api_key', required: true })

    it('is true when a required Plugin Field has neither a Field Value nor a default', () => {
      expect(needsValues([required], {})).toBe(true)
    })

    it('is false once that Plugin Field has a Field Value or a default', () => {
      expect(needsValues([required], { api_key: 'abc' })).toBe(false)
      expect(needsValues([{ ...required, defaultValue: 'abc' }], {})).toBe(false)
    })

    it('ignores optional Plugin Fields and the author_bio credit', () => {
      expect(needsValues([units, makePluginField({ keyname: 'author_bio', fieldType: 'author_bio', required: true })], {})).toBe(false)
    })
  })

  describe('fieldValueViews', () => {
    it('reports a stored value and whether it is set, per Plugin Field', () => {
      expect(fieldValueViews([city, units], { city: 'Berlin' })).toEqual({
        city: { value: 'Berlin', isSet: true },
        units: { value: null, isSet: false },
      })
    })

    it('never carries a password-type Field Value, only whether it is set', () => {
      const password = makePluginField({ keyname: 'api_key', fieldType: 'password' })

      expect(fieldValueViews([password], { api_key: 's3cret' })).toEqual({ api_key: { value: null, isSet: true } })
      expect(fieldValueViews([password], {})).toEqual({ api_key: { value: null, isSet: false } })
    })
  })
})
