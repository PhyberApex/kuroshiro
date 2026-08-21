import { describe, expect, it } from 'vitest'
import { CreatePluginDto } from '../create-plugin.dto'

describe('create-plugin dto', () => {
  it('creates dto with basic fields', () => {
    const dto = new CreatePluginDto()
    dto.name = 'Weather Plugin'
    dto.description = 'Shows weather data'
    dto.refreshInterval = 30

    expect(dto.name).toBe('Weather Plugin')
    expect(dto.description).toBe('Shows weather data')
    expect(dto.refreshInterval).toBe(30)
  })

  it('includes optional dataSources array', () => {
    const dto = new CreatePluginDto()
    dto.dataSources = [
      {
        name: 'weather',
        url: 'https://api.example.com',
        method: 'GET',
        headers: {},
        body: {},
      },
    ]

    expect(dto.dataSources).toHaveLength(1)
    expect(dto.dataSources?.[0].name).toBe('weather')
    expect(dto.dataSources?.[0].url).toBe('https://api.example.com')
  })

  it('includes optional templates array', () => {
    const dto = new CreatePluginDto()
    dto.templates = [
      { layout: 'full', liquidMarkup: 'Template' },
    ]

    expect(dto.templates).toHaveLength(1)
    expect(dto.templates?.[0].layout).toBe('full')
  })

  it('includes optional fields array', () => {
    const dto = new CreatePluginDto()
    dto.fields = [
      { keyname: 'api_key', fieldType: 'password', name: 'API Key', required: true },
    ]

    expect(dto.fields).toHaveLength(1)
    expect(dto.fields?.[0].keyname).toBe('api_key')
  })
})
