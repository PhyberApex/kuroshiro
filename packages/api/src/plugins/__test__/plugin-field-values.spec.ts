import { describe, expect, it } from 'vitest'
import { makePluginField } from '../../test/fixtures.js'
import { fieldValueViews, needsValues, resolveFieldValues, templateFieldValues } from '../plugin-field-values.js'

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

    it('ignores optional Plugin Fields, the author_bio credit and a copyable_webhook_url', () => {
      expect(needsValues([units, makePluginField({ keyname: 'author_bio', fieldType: 'author_bio', required: true })], {})).toBe(false)
      expect(needsValues([makePluginField({ keyname: 'webhook_url', fieldType: 'copyable_webhook_url', required: true })], {})).toBe(false)
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

  describe('templateFieldValues (ADR-0064)', () => {
    it('reads a multi_string and a select that allows several as the lines of the value, and leaves the rest as text', () => {
      const fields = [
        makePluginField({ keyname: 'labels', fieldType: 'multi_string' }),
        makePluginField({ keyname: 'days', fieldType: 'select', attributes: { multiple: true } }),
        makePluginField({ keyname: 'theme', fieldType: 'select' }),
        makePluginField({ keyname: 'note', fieldType: 'text' }),
      ]
      const resolved = { labels: 'Work\n\n Home \n', days: 'mon', theme: 'dark', note: 'a\nb' }

      expect(templateFieldValues(fields, resolved)).toEqual({ labels: ['Work', 'Home'], days: ['mon'], theme: 'dark', note: 'a\nb' })
      expect(templateFieldValues(fields, { labels: '' })).toEqual({ labels: [] })
    })
  })
})
