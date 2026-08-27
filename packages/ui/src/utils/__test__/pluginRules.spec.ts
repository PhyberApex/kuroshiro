import { describe, expect, it } from 'vitest'
import { nameRules, refreshIntervalRules, templateRules } from '../pluginRules'

describe('nameRules', () => {
  it('rejects an empty name', () => {
    expect(nameRules[0]('')).toBe('Plugin name is required')
  })

  it('rejects a whitespace-only name', () => {
    expect(nameRules[0]('   ')).toBe('Plugin name is required')
  })

  it('accepts a non-empty name', () => {
    expect(nameRules[0]('My Plugin')).toBe(true)
  })
})

describe('templateRules', () => {
  it('rejects an empty template', () => {
    expect(templateRules[0]('')).toBe('Liquid template is required')
  })

  it('rejects a whitespace-only template', () => {
    expect(templateRules[0]('   ')).toBe('Liquid template is required')
  })

  it('accepts a non-empty template', () => {
    expect(templateRules[0]('<div>{{ data.title }}</div>')).toBe(true)
  })
})

describe('refreshIntervalRules', () => {
  it('rejects an interval below 1', () => {
    expect(refreshIntervalRules[0](0)).toBe('Refresh interval must be at least 1 minute')
  })

  it('accepts an interval of 1 or more', () => {
    expect(refreshIntervalRules[0](1)).toBe(true)
    expect(refreshIntervalRules[0](15)).toBe(true)
  })
})
