import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { PluginImporterService } from '../services/plugin-importer.service'

function buildFlatRecipeArchive(settings: Record<string, any>, files: Record<string, string> = { 'full.liquid': '<div>{{ source.title }}</div>' }): Buffer {
  const zip = new AdmZip()
  zip.addFile('settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, 'utf8'))
  }
  return zip.toBuffer()
}

describe('pluginImporterService recipe import', () => {
  describe('parseRecipeId', () => {
    it('accepts a bare numeric id', () => {
      const service = new PluginImporterService()
      expect(service.parseRecipeId('150460')).toBe('150460')
    })

    it('extracts the id from a trmnl.com/recipes/:id URL', () => {
      const service = new PluginImporterService()
      expect(service.parseRecipeId('https://trmnl.com/recipes/150460')).toBe('150460')
    })

    it('extracts the id from a trmnl.com/recipes/:id-slug URL', () => {
      const service = new PluginImporterService()
      expect(service.parseRecipeId('https://trmnl.com/recipes/150460-daily-weather')).toBe('150460')
    })

    it('throws on an unrecognized id/URL', () => {
      const service = new PluginImporterService()
      expect(() => service.parseRecipeId('not-a-recipe')).toThrow('Invalid Recipe id or URL')
    })
  })

  describe('importFromRecipeArchive', () => {
    it('parses a flat Recipe archive into the standard parsed-plugin shape', async () => {
      const settings = {
        name: 'Daily Weather',
        description: 'Shows the daily forecast',
        refresh_interval: 30,
        strategy: 'polling',
        polling_url: 'https://api.example.com/weather',
        polling_verb: 'get',
        polling_headers: JSON.stringify({ 'X-Api-Key': 'abc' }),
        custom_fields: [
          {
            keyname: 'api_key',
            field_type: 'string',
            name: 'API Key',
            description: 'Your weather API key',
            default_value: 'default-key',
          },
        ],
      }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '150460')

      expect(result.name).toBe('Daily Weather')
      expect(result.description).toBe('Shows the daily forecast')
      expect(result.kind).toBe('Poll')
      expect(result.refreshInterval).toBe(30)
      expect(result.dataSources).toHaveLength(1)
      expect(result.dataSources[0].url).toBe('https://api.example.com/weather')
      expect(result.dataSources[0].method).toBe('GET')
      expect(result.dataSources[0].headers).toEqual({ 'X-Api-Key': 'abc' })
      expect(result.templates).toHaveLength(1)
      expect(result.templates[0].layout).toBe('full')
      expect(result.fields).toHaveLength(1)
      expect(result.fields[0].keyname).toBe('api_key')
      expect(result.fields[0].defaultValue).toBe('default-key')
      expect(result.sourceRecipeId).toBe('150460')
    })

    it('imports all four layout templates', async () => {
      const settings = { name: 'Multi Layout', strategy: 'polling', polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': 'Full',
        'half_horizontal.liquid': 'Half H',
        'half_vertical.liquid': 'Half V',
        'quadrant.liquid': 'Quad',
      })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.templates).toHaveLength(4)
      expect(result.templates.map(t => t.layout).sort()).toEqual(['full', 'half_horizontal', 'half_vertical', 'quadrant'])
    })

    it('inlines shared.liquid into a layout that renders "main"', async () => {
      const settings = { name: 'Shared Partial', strategy: 'polling', polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': '{% render "main" %}',
        'shared.liquid': '{% template main %}<div>Shared content</div>{% endtemplate %}',
      })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.templates[0].liquidMarkup).toBe('<div>Shared content</div>')
    })

    it('imports a transform.js into the Data Source', async () => {
      const settings = { name: 'Transform Recipe', strategy: 'polling', polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': 'Template',
        'transform.js': 'module.exports = (data) => data',
      })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources[0].transformJs).toBe('module.exports = (data) => data')
    })

    it('forces an author_bio field to required: false even without an "optional" flag', async () => {
      const settings = {
        name: 'Attribution Recipe',
        strategy: 'polling',
        polling_url: 'https://api.example.com',
        custom_fields: [
          { keyname: 'author_bio', field_type: 'author_bio', name: 'Author', description: 'About the author' },
        ],
      }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.fields[0].fieldType).toBe('author_bio')
      expect(result.fields[0].required).toBe(false)
    })

    it('rejects an OAuth-enabled recipe with a clear error', async () => {
      const settings = { name: 'OAuth Recipe', strategy: 'polling', oauth_enabled: true, polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toThrow('OAuth')
    })

    it('imports a "static" strategy recipe as a Poll plugin with one literal-mode Data Source named "source"', async () => {
      const settings = { name: 'Static Recipe', strategy: 'static', static_data: { title: 'Hello', count: 3 } }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.kind).toBe('Poll')
      expect(result.dataSources).toHaveLength(1)
      expect(result.dataSources[0]).toMatchObject({
        name: 'source',
        mode: 'literal',
        literalValue: { title: 'Hello', count: 3 },
      })
      expect(result.dataSources[0].url).toBeUndefined()
      expect(result.sourceRecipeId).toBe('1')
    })

    it('imports a "static" strategy recipe with missing static_data as an empty literal value', async () => {
      const settings = { name: 'Static Recipe', strategy: 'static' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources[0].literalValue).toEqual({})
    })

    it('imports a "static" strategy recipe with a null static_data as an empty literal value', async () => {
      const settings = { name: 'Static Recipe', strategy: 'static', static_data: null }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources[0].literalValue).toEqual({})
    })

    it('rejects a "static" strategy recipe that also carries a transform.js', async () => {
      const settings = { name: 'Static Recipe', strategy: 'static', static_data: { title: 'Hello' } }
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': '<div>{{ source.title }}</div>',
        'transform.js': 'module.exports = (data) => data',
      })

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toThrow(/transform\.js/i)
    })

    it('rejects a recipe with a missing/unrecognized strategy, naming the value', async () => {
      const settings = { name: 'No Strategy Recipe', polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toThrow(/strategy/i)
    })

    it('falls back to an empty object when polling_headers is malformed JSON', async () => {
      const settings = { name: 'Bad Headers', strategy: 'polling', polling_url: 'https://api.example.com', polling_headers: 'not json{{{' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources[0].headers).toEqual({})
    })

    it('falls back to an empty object when polling_body is malformed JSON', async () => {
      const settings = { name: 'Bad Body', strategy: 'polling', polling_url: 'https://api.example.com', polling_body: 'not json{{{' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources[0].body).toEqual({})
    })
  })
})
