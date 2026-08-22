import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { UpdatePluginDto } from '../update-plugin.dto'

async function violations(payload: Record<string, any>): Promise<string[]> {
  const errors = await validate(plainToInstance(UpdatePluginDto, payload))
  return errors.flatMap(error => Object.values(error.constraints ?? {}))
}

describe('update-plugin dto', () => {
  it('creates dto with partial fields', () => {
    const dto = new UpdatePluginDto()
    dto.name = 'Updated Plugin'

    expect(dto.name).toBe('Updated Plugin')
    expect(dto.description).toBeUndefined()
    expect(dto.refreshInterval).toBeUndefined()
  })

  it('updates dataSources array', () => {
    const dto = new UpdatePluginDto()
    dto.dataSources = [
      {
        name: 'weather',
        url: 'https://new-api.example.com',
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: { key: 'value' },
      },
    ]

    expect(dto.dataSources).toHaveLength(1)
    expect(dto.dataSources?.[0].url).toBe('https://new-api.example.com')
    expect(dto.dataSources?.[0].method).toBe('POST')
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

  describe('webhook fields', () => {
    it('accepts a new Merge Strategy and Stream Limit', async () => {
      await expect(violations({ mergeStrategy: 'stream', streamLimit: 20 })).resolves.toEqual([])
    })

    it('rejects an unknown Merge Strategy', async () => {
      await expect(violations({ mergeStrategy: 'append' })).resolves.toContain(
        'mergeStrategy must be one of the following values: standard, deep_merge, stream',
      )
    })

    it('rejects a Stream Limit below 1', async () => {
      await expect(violations({ streamLimit: 0 })).resolves.toContain('streamLimit must not be less than 1')
    })

    it('rejects a kind outside Poll and Webhook', async () => {
      await expect(violations({ kind: 'Push' })).resolves.toContain(
        'kind must be one of the following values: Poll, Webhook',
      )
    })
  })
})
