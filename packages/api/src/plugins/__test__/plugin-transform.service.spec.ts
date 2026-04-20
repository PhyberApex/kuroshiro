import { beforeEach, describe, expect, it } from 'vitest'
import { PluginTransformService } from '../services/plugin-transform.service'

describe('pluginTransformService', () => {
  let service: PluginTransformService

  beforeEach(() => {
    service = new PluginTransformService()
  })

  it('transforms data using module.exports function', () => {
    const transformJs = `
      module.exports = function(data) {
        return { transformed: true, original: data };
      };
    `
    const rawData = { value: 42 }
    const result = service.transform(transformJs, rawData)

    expect(result.transformed).toBe(true)
    expect(result.original).toEqual({ value: 42 })
  })

  it('transforms data using transform function', () => {
    const transformJs = `
      function transform(data) {
        return { doubled: data.value * 2 };
      }
    `
    const rawData = { value: 10 }
    const result = service.transform(transformJs, rawData)

    expect(result.doubled).toBe(20)
  })

  it('returns data unchanged if no transform function found', () => {
    const transformJs = `
      const x = 5;
    `
    const rawData = { value: 42 }
    const result = service.transform(transformJs, rawData)

    expect(result).toEqual({ value: 42 })
  })

  it('handles complex transformations', () => {
    const transformJs = `
      module.exports = function(data) {
        return {
          items: data.items.map(item => ({
            ...item,
            processed: true
          }))
        };
      };
    `
    const rawData = { items: [{ id: 1 }, { id: 2 }] }
    const result = service.transform(transformJs, rawData)

    expect(result.items).toHaveLength(2)
    expect(result.items[0].processed).toBe(true)
    expect(result.items[1].processed).toBe(true)
  })

  it('returns raw data on transformation error', () => {
    const transformJs = `
      module.exports = function(data) {
        throw new Error('Transform failed');
      };
    `
    const rawData = { value: 42 }
    const result = service.transform(transformJs, rawData)

    expect(result).toEqual({ value: 42 })
  })

  it('handles timeout for long-running transforms', () => {
    const transformJs = `
      module.exports = function(data) {
        while(true) {} // Infinite loop
        return data;
      };
    `
    const rawData = { value: 42 }
    const result = service.transform(transformJs, rawData)

    expect(result).toEqual({ value: 42 })
  }, 10000)

  it('provides console.log in sandbox', () => {
    const transformJs = `
      module.exports = function(data) {
        console.log('Processing data', data.value);
        return { logged: true };
      };
    `
    const rawData = { value: 42 }
    const result = service.transform(transformJs, rawData)

    expect(result.logged).toBe(true)
  })

  it('prevents access to unsafe APIs', () => {
    const transformJs = `
      module.exports = function(data) {
        const fs = require('fs'); // Should fail
        return { hacked: true };
      };
    `
    const rawData = { value: 42 }
    const result = service.transform(transformJs, rawData)

    expect(result).toEqual({ value: 42 })
  })
})
