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

    it.each([
      ['yes', true],
      ['no', false],
      [undefined, false],
    ])('reads no_screen_padding and dark_mode spelled %s as %s', async (spelled, flag) => {
      const settings = { name: 'Flags', strategy: 'polling', polling_url: 'https://api.example.com', ...(spelled === undefined ? {} : { no_screen_padding: spelled, dark_mode: spelled }) }

      const result = await new PluginImporterService().importFromRecipeArchive(buildFlatRecipeArchive(settings), '1')

      expect(result).toMatchObject({ noScreenPadding: flag, darkMode: flag })
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

    it('forces an author_bio and a copyable_webhook_url field to required: false even without an "optional" flag', async () => {
      const settings = {
        name: 'Attribution Recipe',
        strategy: 'webhook',
        custom_fields: [
          { keyname: 'author_bio', field_type: 'author_bio', name: 'Author', description: 'About the author' },
          { keyname: 'webhook_url', field_type: 'copyable_webhook_url', name: 'Webhook URL' },
          { keyname: 'city', field_type: 'string', name: 'City' },
        ],
      }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '1')

      expect(result.fields.map(field => [field.fieldType, field.required])).toEqual([['author_bio', false], ['copyable_webhook_url', false], ['string', true]])
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

    it('stores a bare select option under the value TRMNL derives for it, and keeps a labelled option\'s value', async () => {
      const settings = {
        name: 'Weather',
        strategy: 'polling',
        polling_url: 'https://api.example.com',
        custom_fields: [
          { keyname: 'theme', field_type: 'select', name: 'Theme', options: ['Light', 'Dark Mode', { 'US AQI': 'US AQI' }], default: 'dark_mode' },
        ],
      }
      const expectedOptions = [
        { label: 'Light', value: 'light' },
        { label: 'Dark Mode', value: 'dark_mode' },
        { label: 'US AQI', value: 'US AQI' },
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
      const exportedSettings = yaml.load(new AdmZip(exported).readAsText('.trmnlp.yml')) as { custom_fields: Array<{ options: unknown }> }

      expect(exportedSettings.custom_fields[0].options).toEqual(['Light', 'Dark Mode', { 'US AQI': 'US AQI' }])
      expect(service.parseZip(new AdmZip(exported), 'weather').fields[0].options).toEqual(expectedOptions)
    })

    it('keeps a select\'s multiple flag as an attribute, which the export writes back', async () => {
      const settings = {
        name: 'Days',
        strategy: 'polling',
        polling_url: 'https://api.example.com',
        custom_fields: [
          { keyname: 'days', field_type: 'select', name: 'Days', multiple: true, options: ['mon', 'tue'] },
          { keyname: 'theme', field_type: 'select', name: 'Theme', multiple: 'false', options: ['light'] },
        ],
      }

      const service = new PluginImporterService()
      const imported = await service.importFromRecipeArchive(buildFlatRecipeArchive(settings), '1')

      expect(imported.fields.map(field => field.attributes)).toEqual([{ multiple: true }, {}])

      const exported = await new PluginExporterService().exportToZip(makePlugin({
        name: imported.name,
        dataSources: imported.dataSources.map(source => makePluginDataSource(source)),
        templates: imported.templates.map(template => makePluginTemplate(template)),
        fields: imported.fields.map(field => makePluginField(field)),
      }))
      const manifest = yaml.load(new AdmZip(exported).readAsText('.trmnlp.yml')) as { custom_fields: Array<{ multiple?: boolean }> }

      expect(manifest.custom_fields.map(field => field.multiple)).toEqual([true, undefined])
      expect(service.parseZip(new AdmZip(exported), 'days').fields.map(field => field.attributes)).toEqual([{ multiple: true }, {}])
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

    describe('an OAuth Recipe (ADR-0067)', () => {
      const ADMOB = {
        name: 'AdMob Overview',
        strategy: 'polling',
        polling_url: 'https://admob.googleapis.com/v1/accounts/{{ publisher_id }}/networkReport:generate',
        polling_verb: 'post',
        polling_headers: 'Authorization=Bearer {{ oauth_access_token }}',
        oauth_enabled: 'true',
        oauth_token_url: 'https://oauth2.googleapis.com/token',
        oauth_scopes: 'https://www.googleapis.com/auth/admob.report',
        oauth_refresh_params: '',
        custom_fields: [{
          keyname: 'publisher_id',
          field_type: 'xhrSelect',
          name: 'AdMob account',
          description: 'Connect Google above, then choose the account to show.',
          remote: { url: 'https://admob.googleapis.com/v1/accounts', response_path: 'account', value_field: 'publisherId' },
        }],
      }

      it('imports with its oauth_* settings kept as the Recipe wrote them', async () => {
        const result = await new PluginImporterService().importFromRecipeArchive(buildFlatRecipeArchive(ADMOB), '499993')

        expect(result.oauthSettings).toEqual({
          oauth_enabled: 'true',
          oauth_token_url: 'https://oauth2.googleapis.com/token',
          oauth_scopes: 'https://www.googleapis.com/auth/admob.report',
          oauth_refresh_params: '',
        })
        expect(result.dataSources[0].headers).toEqual({ Authorization: 'Bearer {{ oauth_access_token }}' })
      })

      it('adds a password Plugin Field for each token and the client, after the Recipe\'s own', async () => {
        const result = await new PluginImporterService().importFromRecipeArchive(buildFlatRecipeArchive(ADMOB), '499993')

        expect(result.fields.map(field => [field.keyname, field.fieldType, field.required, field.order])).toEqual([
          ['publisher_id', 'string', true, 1],
          ['oauth_access_token', 'password', false, 2],
          ['oauth_refresh_token', 'password', false, 3],
          ['oauth_client_id', 'password', false, 4],
          ['oauth_client_secret', 'password', false, 5],
        ])
      })

      it('reads an xhrSelect Plugin Field as text typed by hand, keeping its keyname, name and description', async () => {
        const result = await new PluginImporterService().importFromRecipeArchive(buildFlatRecipeArchive(ADMOB), '499993')

        expect(result.fields[0]).toMatchObject({ keyname: 'publisher_id', fieldType: 'string', name: 'AdMob account', description: 'Connect Google above, then choose the account to show.' })
        expect(result.typedByHand).toEqual(['AdMob account'])
      })

      it('reads the flag written as a boolean too', async () => {
        const result = await new PluginImporterService().importFromRecipeArchive(buildFlatRecipeArchive({ ...ADMOB, oauth_enabled: true }), '1')

        expect(result.oauthSettings?.oauth_token_url).toBe('https://oauth2.googleapis.com/token')
      })

      it('keeps no OAuth settings and adds no token fields for a Recipe that does not sign in', async () => {
        const result = await new PluginImporterService().importFromRecipeArchive(buildFlatRecipeArchive({ ...ADMOB, oauth_enabled: 'false', custom_fields: [] }), '1')

        expect(result.oauthSettings).toBeUndefined()
        expect(result.fields).toEqual([])
        expect(result.typedByHand).toEqual([])
      })

      it('travels a .trmnlp export and back, its token fields not doubled', async () => {
        const imported = await new PluginImporterService().importFromRecipeArchive(buildFlatRecipeArchive(ADMOB), '499993')
        const plugin = makePlugin({
          oauthSettings: imported.oauthSettings,
          oauthAccessToken: 'runtime-token',
          dataSources: [makePluginDataSource({ name: 'source', url: imported.dataSources[0].url })],
          fields: imported.fields.map(field => makePluginField(field)),
          templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div></div>' })],
        })

        const zip = new AdmZip(await new PluginExporterService().exportToZip(plugin))
        const reread = new PluginImporterService().parseZip(zip, 'admob')

        expect(reread.oauthSettings).toEqual(imported.oauthSettings)
        expect(reread.fields.map(field => field.keyname)).toEqual(['publisher_id', 'oauth_access_token', 'oauth_refresh_token', 'oauth_client_id', 'oauth_client_secret'])
        expect(zip.getEntries().map(entry => entry.getData().toString('utf8')).join('\n')).not.toContain('runtime-token')
      })
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

    it('refuses a "plugin_merge" strategy recipe, which reads other TRMNL plugin instances, naming the value', async () => {
      const settings = { name: 'Merge Recipe', strategy: 'plugin_merge' }
      const archive = buildFlatRecipeArchive(settings)

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toMatchObject({ code: 'recipe-strategy-unsupported', details: { strategy: 'plugin_merge' }, message: expect.stringMatching(/other TRMNL plugins/) })
    })

    it('imports a "webhook" strategy recipe, shaped like Payment QR Code (#1520), as a Webhook plugin with the standard Merge Strategy', async () => {
      const settings = {
        name: 'Payment QR Code',
        strategy: 'webhook',
        polling_url: '',
        no_screen_padding: 'yes',
        custom_fields: [{ keyname: 'label', field_type: 'string', name: 'Label' }],
      }
      const archive = buildFlatRecipeArchive(settings, { 'shared.liquid': '{% template qr %}<img src="{{ url }}">{% endtemplate %}', 'full.liquid': '{% render "qr", url: payment_url %}', 'quadrant.liquid': '<span>{{ label }}</span>' })

      const service = new PluginImporterService()
      const result = await service.importFromRecipeArchive(archive, '494226')

      expect(result).toMatchObject({ kind: 'Webhook', dataSources: [], mergeStrategy: 'standard', noScreenPadding: true, sourceRecipeId: '494226' })
      expect(result.fields.map(field => field.keyname)).toEqual(['label'])
      expect(result.templates.map(template => template.layout).sort()).toEqual(['full', 'quadrant'])
      expect(result.templates.find(template => template.layout === 'full')?.liquidMarkup).toBe('{% template qr %}<img src="{{ url }}">{% endtemplate %}\n{% render "qr", url: payment_url %}')
    })

    it('refuses a "webhook" strategy recipe that ships a transform, since a Webhook Plugin runs none on its payload', async () => {
      const settings = { name: 'Webhook Transform', strategy: 'webhook' }
      const archive = buildFlatRecipeArchive(settings, { 'full.liquid': 'x', 'transform.js': 'function run(input) { return input }' })

      const service = new PluginImporterService()
      await expect(service.importFromRecipeArchive(archive, '1')).rejects.toMatchObject({ code: 'recipe-webhook-transform' })
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

    it('keeps a polling_url of several lines, one address per line, as the one Data Source\'s URL (ADR-0058)', async () => {
      const settings = { name: 'Have Haze Not', strategy: 'polling', polling_url: 'https://a.example/psi\nhttps://b.example/pm25\nhttps://c.example/aqi?token={{ aqicn_token }}' }
      const archive = buildFlatRecipeArchive(settings, { 'full.liquid': '{{ IDX_0.reading }} {{ IDX_1.reading }}' })

      const result = await new PluginImporterService().importFromRecipeArchive(archive, '482229')

      expect(result.dataSources).toEqual([expect.objectContaining({ name: 'source', mode: 'fetch', url: 'https://a.example/psi\nhttps://b.example/pm25\nhttps://c.example/aqi?token={{ aqicn_token }}' })])
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

    it('reads polling_headers in each form TRMNL writes: key=value pairs joined by &, one Key: Value per line, or JSON', async () => {
      const service = new PluginImporterService()
      const headersOf = async (polling_headers: string) => (await service.importFromRecipeArchive(buildFlatRecipeArchive({ name: 'H', strategy: 'polling', polling_url: 'https://api.example.com', polling_headers }), '1')).dataSources[0].headers

      expect(await headersOf('authorization=Bearer {{ api_key }}&x-plain=as%20is')).toEqual({ 'authorization': 'Bearer {{ api_key }}', 'x-plain': 'as is' })
      expect(await headersOf('Accept: application/json\nX-Key: {{ key }}\nbroken line')).toEqual({ 'Accept': 'application/json', 'X-Key': '{{ key }}' })
      expect(await headersOf('Referer: https://example.com/?a=1')).toEqual({ Referer: 'https://example.com/?a=1' })
      expect(await headersOf('{"X-Limit": 5, "X-Flag": true}')).toEqual({ 'X-Limit': '5', 'X-Flag': 'true' })
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
