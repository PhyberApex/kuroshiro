import type { PluginDataSource } from '../../types/plugin'
import { describe, expect, it } from 'vitest'
import { parseJsonOrKeep, toEditableDataSource } from '../editableDataSource'

describe('toEditableDataSource', () => {
  const base = { id: 'ds-1', name: 'gh', mode: 'fetch', method: 'POST', url: 'https://api.github.com/graphql', order: 0 } as PluginDataSource

  it('hydrates headersJson and bodyJson from stored headers and body', () => {
    const editable = toEditableDataSource({ ...base, headers: { Authorization: 'Bearer t' }, body: { query: '{ viewer { login } }' }, transformJs: 'module.exports = function (data) { return data }' })

    expect(JSON.parse(editable.headersJson!)).toEqual({ Authorization: 'Bearer t' })
    expect(JSON.parse(editable.bodyJson!)).toEqual({ query: '{ viewer { login } }' })
    expect(editable.transformJs).toBe('module.exports = function (data) { return data }')
  })

  it('hydrates empty strings when headers and body are absent or empty', () => {
    expect(toEditableDataSource({ ...base, headers: {}, body: {} })).toMatchObject({ headersJson: '', bodyJson: '' })
    expect(toEditableDataSource(base)).toMatchObject({ headersJson: '', bodyJson: '', literalValueJson: '' })
  })

  it('hydrates literalValueJson from a literal value', () => {
    const editable = toEditableDataSource({ ...base, mode: 'literal', literalValue: { text: 'Hi' } })

    expect(JSON.parse(editable.literalValueJson!)).toEqual({ text: 'Hi' })
  })
})

describe('parseJsonOrKeep', () => {
  it('returns the empty value for blank input', () => {
    expect(parseJsonOrKeep('  ', {}, { a: 1 })).toEqual({})
    expect(parseJsonOrKeep(undefined, undefined, { a: 1 })).toBeUndefined()
  })

  it('parses valid JSON', () => {
    expect(parseJsonOrKeep('{"a":2}', {}, { a: 1 })).toEqual({ a: 2 })
  })

  it('keeps the current value while the JSON is invalid', () => {
    expect(parseJsonOrKeep('{"a": nope', {}, { a: 1 })).toEqual({ a: 1 })
  })
})
