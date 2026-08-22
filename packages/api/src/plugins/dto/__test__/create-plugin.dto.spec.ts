import type { ValidationError } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { CreatePluginDto } from '../create-plugin.dto'

function flattenConstraints(errors: ValidationError[]): string[] {
  return errors.flatMap(error => [
    ...Object.values(error.constraints ?? {}),
    ...flattenConstraints(error.children ?? []),
  ])
}

async function violations(payload: Record<string, any>): Promise<string[]> {
  const errors = await validate(plainToInstance(CreatePluginDto, payload))
  return flattenConstraints(errors)
}

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

  describe('nested dataSources validation', () => {
    it('rejects a data source with a non-string url', async () => {
      const payload = { name: 'Weather Plugin', dataSources: [{ name: 'weather', url: 123, method: 'GET' }] }

      const errors = await violations(payload)

      expect(errors.some(message => message.includes('url must be a string'))).toBe(true)
    })

    it('rejects a data source missing a name', async () => {
      const payload = { name: 'Weather Plugin', dataSources: [{ url: 'https://api.example.com', method: 'GET' }] }

      const errors = await violations(payload)

      expect(errors.some(message => message.includes('name must be a string'))).toBe(true)
    })
  })

  describe('plugin kind', () => {
    it('defaults to Poll', () => {
      expect(plainToInstance(CreatePluginDto, { name: 'Weather Plugin' }).kind).toBe('Poll')
    })

    it('accepts Poll and Webhook', async () => {
      await expect(violations({ name: 'Poll Plugin', kind: 'Poll' })).resolves.toEqual([])
      await expect(violations({ name: 'Webhook Plugin', kind: 'Webhook', mergeStrategy: 'standard' })).resolves.toEqual([])
    })

    it('rejects any other kind', async () => {
      await expect(violations({ name: 'Weird Plugin', kind: 'Push' })).resolves.toContain(
        'kind must be one of the following values: Poll, Webhook',
      )
    })
  })

  describe('poll-kind field restrictions', () => {
    it('rejects a Merge Strategy', async () => {
      await expect(violations({ name: 'Poll Plugin', mergeStrategy: 'standard' })).resolves.toContain(
        'A Poll-kind Plugin cannot have a Merge Strategy',
      )
    })

    it('rejects a Stream Limit', async () => {
      await expect(violations({ name: 'Poll Plugin', streamLimit: 10 })).resolves.toContain(
        'A Poll-kind Plugin cannot have a Stream Limit',
      )
    })

    it('rejects a Webhook Token', async () => {
      await expect(violations({ name: 'Poll Plugin', webhookToken: 'token-abc' })).resolves.toContain(
        'The Webhook Token is issued by Kuroshiro and cannot be set directly',
      )
    })
  })

  describe('webhook-kind field restrictions', () => {
    it('rejects a Data Source', async () => {
      const payload = { name: 'Webhook Plugin', kind: 'Webhook', mergeStrategy: 'standard', dataSources: [{ name: 'source', url: 'https://api.example.com' }] }

      await expect(violations(payload)).resolves.toContain('A Webhook-kind Plugin cannot have Data Sources')
    })

    it('requires a Merge Strategy', async () => {
      await expect(violations({ name: 'Webhook Plugin', kind: 'Webhook' })).resolves.toContain(
        'A Webhook-kind Plugin requires a Merge Strategy',
      )
    })

    it('rejects an unknown Merge Strategy', async () => {
      await expect(violations({ name: 'Webhook Plugin', kind: 'Webhook', mergeStrategy: 'append' })).resolves.toContain(
        'mergeStrategy must be one of the following values: standard, deep_merge, stream',
      )
    })

    it('requires a Stream Limit for the stream Merge Strategy', async () => {
      await expect(violations({ name: 'Webhook Plugin', kind: 'Webhook', mergeStrategy: 'stream' })).resolves.toContain(
        'A stream Merge Strategy requires a Stream Limit',
      )
    })

    it('accepts a Stream Limit alongside the stream Merge Strategy', async () => {
      await expect(violations({ name: 'Webhook Plugin', kind: 'Webhook', mergeStrategy: 'stream', streamLimit: 50 })).resolves.toEqual([])
    })

    it('rejects a Stream Limit for any other Merge Strategy', async () => {
      await expect(violations({ name: 'Webhook Plugin', kind: 'Webhook', mergeStrategy: 'deep_merge', streamLimit: 50 })).resolves.toContain(
        'A Stream Limit is only valid for the stream Merge Strategy',
      )
    })
  })
})
