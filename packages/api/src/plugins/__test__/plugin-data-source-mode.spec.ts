import { describe, expect, it } from 'vitest'
import { dataSourceModeViolation } from '../plugin-data-source-mode'

describe('dataSourceModeViolation', () => {
  describe('literal mode', () => {
    it('passes with only a literalValue', () => {
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: { title: 'Hello' } })).toBeNull()
    })

    it('accepts a scalar literalValue', () => {
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: 'a plain string' })).toBeNull()
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: 42 })).toBeNull()
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: false })).toBeNull()
    })

    it('rejects a non-default Method', () => {
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: {}, method: 'POST' })).toBe(
        'A literal-mode Data Source cannot have a Method',
      )
    })

    it('tolerates a Method of "GET", since that is the entity column\'s non-nullable default rather than something a caller actually set', () => {
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: {}, method: 'GET' })).toBeNull()
    })

    it('rejects a URL', () => {
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: {}, url: 'https://api.example.com' })).toBe(
        'A literal-mode Data Source cannot have a URL',
      )
    })

    it('rejects Headers', () => {
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: {}, headers: { Authorization: 'x' } })).toBe(
        'A literal-mode Data Source cannot have Headers',
      )
    })

    it('rejects a Body', () => {
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: {}, body: { a: 1 } })).toBe(
        'A literal-mode Data Source cannot have a Body',
      )
    })

    it('rejects a Transform', () => {
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: {}, transformJs: 'module.exports = d => d' })).toBe(
        'A literal-mode Data Source cannot have a Transform',
      )
    })

    it('requires a literalValue', () => {
      expect(dataSourceModeViolation({ mode: 'literal' })).toBe(
        'A literal-mode Data Source requires a Value',
      )
    })

    it('rejects a null literalValue as missing', () => {
      expect(dataSourceModeViolation({ mode: 'literal', literalValue: null })).toBe(
        'A literal-mode Data Source requires a Value',
      )
    })
  })

  describe('fetch mode', () => {
    it('passes with only a URL', () => {
      expect(dataSourceModeViolation({ mode: 'fetch', url: 'https://api.example.com' })).toBeNull()
    })

    it('defaults to fetch mode when mode is omitted', () => {
      expect(dataSourceModeViolation({ url: 'https://api.example.com' })).toBeNull()
      expect(dataSourceModeViolation({})).toBe('A fetch-mode Data Source requires a URL')
    })

    it('requires a URL', () => {
      expect(dataSourceModeViolation({ mode: 'fetch' })).toBe('A fetch-mode Data Source requires a URL')
    })

    it('rejects a literalValue', () => {
      expect(dataSourceModeViolation({ mode: 'fetch', url: 'https://api.example.com', literalValue: { a: 1 } })).toBe(
        'A fetch-mode Data Source cannot have a Value',
      )
    })
  })
})
