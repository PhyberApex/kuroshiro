import { describe, expect, it } from 'vitest'
import { UpdatePluginDto } from '../update-plugin.dto'

describe('update-plugin dto', () => {
  it('creates dto with partial fields', () => {
    const dto = new UpdatePluginDto()
    dto.name = 'Updated Plugin'

    expect(dto.name).toBe('Updated Plugin')
    expect(dto.description).toBeUndefined()
    expect(dto.refreshInterval).toBeUndefined()
  })

  it('updates dataSource', () => {
    const dto = new UpdatePluginDto()
    dto.dataSource = {
      url: 'https://new-api.example.com',
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: { key: 'value' },
    }

    expect(dto.dataSource?.url).toBe('https://new-api.example.com')
    expect(dto.dataSource?.method).toBe('POST')
  })

  it('updates templates', () => {
    const dto = new UpdatePluginDto()
    dto.templates = [
      { layout: 'half_horizontal', liquidMarkup: 'New template' },
    ]

    expect(dto.templates).toHaveLength(1)
    expect(dto.templates?.[0].layout).toBe('half_horizontal')
  })

  it('updates fields', () => {
    const dto = new UpdatePluginDto()
    dto.fields = [
      { keyname: 'new_field', fieldType: 'string', name: 'New Field', required: false },
    ]

    expect(dto.fields).toHaveLength(1)
    expect(dto.fields?.[0].keyname).toBe('new_field')
  })
})
