import type { ValidationError } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { UpdatePluginDto } from '../update-plugin.dto.js'

function flattenConstraints(errors: ValidationError[]): string[] {
  return errors.flatMap(error => [
    ...Object.values(error.constraints ?? {}),
    ...flattenConstraints(error.children ?? []),
  ])
}

async function violations(payload: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(UpdatePluginDto, payload), { whitelist: true, forbidNonWhitelisted: true })
  return flattenConstraints(errors)
}

describe('update-plugin dto', () => {
  it('accepts an empty body, and everything the Plugin page\'s form holds', async () => {
    await expect(violations({})).resolves.toEqual([])
    await expect(violations({
      name: 'Weather',
      description: null,
      refreshInterval: 90,
      templates: [{ size: 'full', liquidMarkup: '<p>{{ weather.temperature }}</p>' }],
      dataSources: [
        { id: '00000000-0000-4000-8000-000000000000', name: 'weather', mode: 'fetch', method: 'POST', url: 'https://api.example.com/{{ city }}', headers: { Authorization: 'Bearer token' }, body: { key: 'value' } },
        { name: 'greeting', mode: 'literal', literalValue: { text: 'hello' } },
      ],
      fields: [{ keyname: 'city', fieldType: 'string', name: 'City', required: false }],
      fieldValues: { city: 'Berlin' },
    })).resolves.toEqual([])
  })

  it('rejects a data source with a non-string url', async () => {
    const errors = await violations({ dataSources: [{ name: 'weather', url: 123, method: 'GET' }] })

    expect(errors).toContain('url must be a string')
  })

  it('rejects a Data Source id that is not an id', async () => {
    const errors = await violations({ dataSources: [{ id: 'first', name: 'weather', mode: 'fetch', url: 'https://api.example.com' }] })

    expect(errors).toEqual(['id must be a UUID'])
  })

  it('rejects a Template of a size Kuroshiro does not know', async () => {
    const errors = await violations({ templates: [{ size: 'third', liquidMarkup: 'x' }] })

    expect(errors).toEqual(['size must be one of the following values: full, half_horizontal, half_vertical, quadrant'])
  })

  it.each(['kind', 'mergeStrategy', 'streamLimit', 'webhookToken', 'sourceRecipeId', 'sourceRecipeSnapshot'])('rejects %s, which is fixed when the Plugin is created', async (property) => {
    await expect(violations({ [property]: 'Poll' })).resolves.toEqual([`property ${property} should not exist`])
  })
})
