import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { makePlugin, makePluginDataSource, makePluginField, makePluginTemplate } from '../../test/fixtures.js'
import { PluginExporterService } from '../services/plugin-exporter.service.js'
import { PluginImporterService } from '../services/plugin-importer.service.js'
import { PluginRendererService } from '../services/plugin-renderer.service.js'

function buildFlatRecipeArchive(settings: Record<string, unknown>, files: Record<string, string> = { 'full.liquid': '<div>{{ source.title }}</div>' }): Buffer {
  const zip = new AdmZip()
  zip.addFile('settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, 'utf8'))
  }
  return zip.toBuffer()
}

describe('pluginImporterService recipe import', () => {
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

    it('puts shared.liquid at the top of every layout, so its templates and styles reach each of them as on TRMNL', async () => {
      const settings = { name: 'Shared Partial', strategy: 'polling', polling_url: 'https://api.example.com' }
      const shared = '<style>.x{}</style>{% template main %}<div>{{ title }}</div>{% endtemplate %}'
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': '{% render "main", title: "Full" %}',
        'quadrant.liquid': '<p>Quadrant</p>',
        'shared.liquid': shared,
      })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.templates.find(t => t.layout === 'full')?.liquidMarkup).toBe(`${shared}\n{% render "main", title: "Full" %}`)
      expect(result.templates.find(t => t.layout === 'quadrant')?.liquidMarkup).toBe(`${shared}\n<p>Quadrant</p>`)
    })

    it('leaves a layout alone when shared.liquid is blank', async () => {
      const settings = { name: 'Blank Shared', strategy: 'polling', polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings, { 'full.liquid': '<p>Full</p>', 'shared.liquid': '  \n' })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.templates[0].liquidMarkup).toBe('<p>Full</p>')
    })

    it('reads a field\'s placeholder, help_text, group, min, max, step, maxlength and rows into its attributes, numbers as numbers', async () => {
      const settings = {
        name: 'Fields Recipe',
        strategy: 'polling',
        polling_url: 'https://api.example.com',
        custom_fields: [
          { keyname: 'posts', field_type: 'number', name: 'Posts', placeholder: '3', min: '1', max: 5, step: 0.5, help_text: 'Maximum 5.', group: 'Display' },
          { keyname: 'prompt', field_type: 'text', name: 'Prompt', rows: 8, maxlength: '200' },
          { keyname: 'city', field_type: 'string', name: 'City' },
        ],
      }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.fields.map(field => field.attributes)).toEqual([
        { placeholder: '3', min: 1, max: 5, step: 0.5, hint: 'Maximum 5.', group: 'Display' },
        { rows: 8, maxlength: 200 },
        {},
      ])
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

    it('keeps a select field\'s options, and they survive a .trmnlp export and re-import', async () => {
      const settings = {
        name: 'Weather',
        strategy: 'polling',
        polling_url: 'https://api.example.com',
        custom_fields: [
          { keyname: 'units', field_type: 'select', name: 'Units', options: [{ Metric: 'metric' }, { Imperial: 'imperial' }, 'kelvin'], default_value: 'metric' },
        ],
      }
      const expectedOptions = [
        { label: 'Metric', value: 'metric' },
        { label: 'Imperial', value: 'imperial' },
        { label: 'kelvin', value: 'kelvin' },
      ]

      const service = new PluginImporterService()
      const imported = await service.importFromRecipeArchive(buildFlatRecipeArchive(settings), '1')

      expect(imported.fields[0].options).toEqual(expectedOptions)

      const exported = await new PluginExporterService().exportToZip(makePlugin({
        name: imported.name,
        dataSources: imported.dataSources.map(source => makePluginDataSource(source)),
        templates: imported.templates.map(template => makePluginTemplate(template)),
        fields: imported.fields.map(field => makePluginField(field)),
      }))
      const reimported = service.parseZip(new AdmZip(exported), 'weather')

      expect(reimported.fields[0].options).toEqual(expectedOptions)
    })

    it('imports a field of a type Kuroshiro has no control for, and one with no type at all', async () => {
      const settings = {
        name: 'Odd Fields',
        strategy: 'polling',
        polling_url: 'https://api.example.com',
        custom_fields: [
          { keyname: 'when', field_type: 'time_zone', name: 'Time zone' },
          { keyname: 'bare' },
        ],
      }

      const result = await new PluginImporterService().importFromRecipeArchive(buildFlatRecipeArchive(settings), '1')

      expect(result.fields.map(field => [field.keyname, field.fieldType, field.name])).toEqual([
        ['when', 'time_zone', 'Time zone'],
        ['bare', 'string', 'bare'],
      ])
    })

    it('rejects an OAuth-enabled recipe with a clear error', async () => {
      const settings = { name: 'OAuth Recipe', strategy: 'polling', oauth_enabled: true, polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toThrow('OAuth')
    })

    it('refuses an OAuth-enabled recipe whose archive spells the flag as the string "true"', async () => {
      const settings = { name: 'OAuth Recipe', strategy: 'polling', oauth_enabled: 'true', polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toThrow('OAuth')
    })

    it('imports a recipe whose archive spells oauth_enabled as the string "false"', async () => {
      const settings = { name: 'Plain Recipe', strategy: 'polling', oauth_enabled: 'false', oauth_pkce_enabled: 'no', polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.name).toBe('Plain Recipe')
      expect(result.dataSources[0].url).toBe('https://api.example.com')
    })

    it('imports a "static" strategy recipe whose static_data is a JSON string, as TRMNL archives ship it', async () => {
      const settings = { name: 'Static Recipe', strategy: 'static', oauth_enabled: 'false', static_data: '{"title":"Hello","count":3}' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources[0]).toMatchObject({ name: 'source', mode: 'literal', literalValue: { title: 'Hello', count: 3 } })
    })

    it('imports a "static" strategy recipe whose static_data is the string "{}" as an empty literal value', async () => {
      const settings = { name: 'Static Recipe', strategy: 'static', static_data: '{}' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources[0].literalValue).toEqual({})
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

    it('keeps a "static" strategy recipe\'s transform.js on its literal Data Source, since TRMNL runs it on the Field Values', async () => {
      const settings = { name: 'Static Recipe', strategy: 'static', static_data: { title: 'Hello' } }
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': '<div>{{ title }}</div>',
        'transform.js': 'async function run(input) { return input }\nmodule.exports = { run }',
      })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources[0]).toMatchObject({ name: 'source', mode: 'literal', literalValue: { title: 'Hello' }, transformJs: 'async function run(input) { return input }\nmodule.exports = { run }' })
    })

    it('rejects a recipe with a missing/unrecognized strategy, naming the value', async () => {
      const settings = { name: 'No Strategy Recipe', polling_url: 'https://api.example.com' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toThrow(/strategy/i)
    })

    it('rejects a "plugin_merge" strategy recipe, naming the value', async () => {
      const settings = { name: 'Merge Recipe', strategy: 'plugin_merge' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toThrow(/plugin_merge/)
    })

    it('imports a "none" strategy recipe, shaped like DWD Rainradar (#1261), as a Poll plugin with zero Data Sources', async () => {
      const settings = {
        name: 'DWD Rainradar',
        strategy: 'none',
        polling_url: '',
        static_data: '',
        custom_fields: [
          { keyname: 'station', field_type: 'string', name: 'Station', default_value: 'Hamburg' },
        ],
      }
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': '<img src="{{ station }}.png">',
        'half_horizontal.liquid': 'Half H',
        'half_vertical.liquid': 'Half V',
        'quadrant.liquid': 'Quad',
        'shared.liquid': '{% template main %}shared{% endtemplate %}',
      })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '490885')

      expect(result.kind).toBe('Poll')
      expect(result.dataSources).toEqual([])
      expect(result.templates).toHaveLength(4)
      expect(result.templates.map(t => t.layout).sort()).toEqual(['full', 'half_horizontal', 'half_vertical', 'quadrant'])
      expect(result.fields).toHaveLength(1)
      expect(result.fields[0]).toMatchObject({ keyname: 'station', defaultValue: 'Hamburg' })
      expect(result.sourceRecipeId).toBe('490885')
    })

    it('gives a "none" strategy recipe with a transform.js an empty literal Data Source named "source" to run it on', async () => {
      const settings = { name: 'None Recipe', strategy: 'none', static_data: '' }
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': '<div>{{ computed }}</div>',
        'transform.js': 'function run(input) { return { computed: 1 } }',
      })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources).toEqual([expect.objectContaining({ name: 'source', mode: 'literal', literalValue: {}, transformJs: 'function run(input) { return { computed: 1 } }' })])
    })

    it('gives a polling recipe with no polling_url and a transform.js an empty literal Data Source named "source", as the transform fetches itself', async () => {
      const settings = { name: 'Self-fetching Recipe', strategy: 'polling', polling_url: '' }
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': '<div>{{ computed }}</div>',
        'transform.js': 'async function run(input) { return { computed: 1 } }',
      })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.dataSources).toEqual([expect.objectContaining({ name: 'source', mode: 'literal', literalValue: {}, transformJs: 'async function run(input) { return { computed: 1 } }' })])
    })

    it.each(['python', 'ruby', 'php'])('refuses a recipe whose serverless code is %s, which Kuroshiro cannot run', async (language) => {
      const settings = { name: 'Other Language', strategy: 'polling', polling_url: 'https://api.example.com', serverless_language: language }
      const archive = buildFlatRecipeArchive(settings, { 'full.liquid': 'x', [`transform.${language === 'python' ? 'py' : language === 'ruby' ? 'rb' : 'php'}`]: 'def run(input): return input' })

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toMatchObject({ code: 'recipe-serverless-language', details: { language } })
    })

    it('imports a recipe that names a serverless language but ships no serverless code', async () => {
      const settings = { name: 'Node by default', strategy: 'polling', polling_url: 'https://api.example.com', serverless_language: 'python' }
      const archive = buildFlatRecipeArchive(settings, { 'full.liquid': 'x' })

      const service = new PluginImporterService()
      expect((await service.importFromRecipeArchive(archive, '1')).name).toBe('Node by default')
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

    it('imports a Recipe that uses TRMNL custom filters and renders them as trmnl.com does', async () => {
      const settings = { name: 'Reading List', strategy: 'polling', polling_url: 'https://api.example.com/books' }
      const archive = buildFlatRecipeArchive(settings, {
        'full.liquid': '{% assign shelf = payload | parse_json %}<p>{{ "book" | pluralize: shelf.books.size }}, {{ shelf.updated | l_date: "%y %b" }}</p>',
      })

      const imported = await new PluginImporterService().importFromRecipeArchive(archive, '1')
      const markup = await new PluginRendererService(new InstanceTimeZone()).render(imported.templates[0].liquidMarkup, {
        payload: JSON.stringify({ books: ['a', 'b'], updated: '2025-01-11' }),
      })

      expect(markup).toBe('<p>2 books, 25 Jan</p>')
    })
  })
})
