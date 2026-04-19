import type { Plugin } from '../entities/plugin.entity'
import { describe, expect, it } from 'vitest'
import { PluginDataSource } from '../entities/plugin-data-source.entity'

describe('pluginDataSource entity', () => {
  it('creates a data source with required fields', () => {
    const plugin = { id: 'plugin-1' } as Plugin

    const dataSource = new PluginDataSource()
    dataSource.id = 'ds-1'
    dataSource.plugin = plugin
    dataSource.method = 'GET'
    dataSource.url = 'https://api.weather.com/data'

    expect(dataSource.id).toBe('ds-1')
    expect(dataSource.plugin).toBe(plugin)
    expect(dataSource.method).toBe('GET')
    expect(dataSource.url).toBe('https://api.weather.com/data')
  })

  it('supports POST method', () => {
    const dataSource = new PluginDataSource()
    dataSource.method = 'POST'
    dataSource.url = 'https://api.example.com/webhook'

    expect(dataSource.method).toBe('POST')
  })

  it('stores headers as JSON', () => {
    const dataSource = new PluginDataSource()
    dataSource.headers = {
      'Authorization': 'Bearer token123',
      'Content-Type': 'application/json',
    }

    expect(dataSource.headers).toEqual({
      'Authorization': 'Bearer token123',
      'Content-Type': 'application/json',
    })
  })

  it('stores body as JSON for POST requests', () => {
    const dataSource = new PluginDataSource()
    dataSource.method = 'POST'
    dataSource.body = {
      location: 'Tokyo',
      units: 'metric',
    }

    expect(dataSource.body).toEqual({
      location: 'Tokyo',
      units: 'metric',
    })
  })

  it('has optional headers field', () => {
    const dataSource = new PluginDataSource()
    dataSource.url = 'https://api.example.com'

    expect(dataSource.headers).toBeUndefined()
  })

  it('has optional body field', () => {
    const dataSource = new PluginDataSource()
    dataSource.method = 'GET'

    expect(dataSource.body).toBeUndefined()
  })

  it('defaults method to GET', () => {
    const dataSource = new PluginDataSource()
    expect(dataSource.method).toBe('GET')
  })
})
