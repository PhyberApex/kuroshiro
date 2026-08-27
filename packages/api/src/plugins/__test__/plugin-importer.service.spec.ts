import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { beforeEach, describe, expect, it } from 'vitest'
import { layoutFromTemplateFilename, PluginImporterService } from '../services/plugin-importer.service'

describe('layoutFromTemplateFilename', () => {
  it('detects half_horizontal, half_vertical, and quadrant by substring', () => {
    expect(layoutFromTemplateFilename('half_horizontal')).toBe('half_horizontal')
    expect(layoutFromTemplateFilename('my-half_vertical-template')).toBe('half_vertical')
    expect(layoutFromTemplateFilename('quadrant')).toBe('quadrant')
  })

  it('defaults to full when no known substring matches', () => {
    expect(layoutFromTemplateFilename('full')).toBe('full')
    expect(layoutFromTemplateFilename('anything-else')).toBe('full')
  })
})

describe('pluginImporterService', () => {
  let service: PluginImporterService

  beforeEach(() => {
    service = new PluginImporterService()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('handles polling_body with invalid JSON', async () => {
    const zip = new AdmZip()

    const manifest = {
      name: 'Test Plugin',
    }

    const settings = {
      refresh_interval: 15,
      polling_url: 'https://api.example.com',
      polling_body: 'invalid json{{{',
    }

    zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
    zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
    zip.addFile('src/full.liquid', Buffer.from('test', 'utf8'))

    const tempZipPath = path.join('/tmp', `test-${Date.now()}.zip`)
    await fs.promises.writeFile(tempZipPath, zip.toBuffer())

    const result = await service.importFromFile(tempZipPath)

    await fs.promises.unlink(tempZipPath)

    expect(result.dataSources[0].body).toEqual({})
  })

  it('handles custom_fields from settings instead of manifest', async () => {
    const zip = new AdmZip()

    const manifest = {
      name: 'Test Plugin',
    }

    const settings = {
      refresh_interval: 15,
      endpoint: 'https://api.example.com',
      custom_fields: [
        {
          keyname: 'api_key',
          field_type: 'string',
          name: 'API Key',
        },
      ],
    }

    zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
    zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
    zip.addFile('src/full.liquid', Buffer.from('test', 'utf8'))

    const tempZipPath = path.join('/tmp', `test-${Date.now()}.zip`)
    await fs.promises.writeFile(tempZipPath, zip.toBuffer())

    const result = await service.importFromFile(tempZipPath)

    await fs.promises.unlink(tempZipPath)

    expect(result.fields).toHaveLength(1)
    expect(result.fields[0].keyname).toBe('api_key')
  })

  it('handles polling_headers with invalid JSON', async () => {
    const zip = new AdmZip()

    const manifest = {
      name: 'Test Plugin',
    }

    const settings = {
      refresh_interval: 15,
      polling_url: 'https://api.example.com',
      polling_headers: 'invalid json{{{',
    }

    zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
    zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
    zip.addFile('src/full.liquid', Buffer.from('test', 'utf8'))

    const tempZipPath = path.join('/tmp', `test-${Date.now()}.zip`)
    await fs.promises.writeFile(tempZipPath, zip.toBuffer())

    const result = await service.importFromFile(tempZipPath)

    await fs.promises.unlink(tempZipPath)

    expect(result.dataSources[0].headers).toEqual({})
  })

  it('throws error when ZIP has no templates', async () => {
    const zip = new AdmZip()

    const manifest = {
      name: 'Test Plugin',
    }

    const settings = {
      refresh_interval: 15,
      polling_url: 'https://api.example.com',
    }

    zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
    zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))

    const tempZipPath = path.join('/tmp', `test-${Date.now()}.zip`)
    await fs.promises.writeFile(tempZipPath, zip.toBuffer())

    await expect(service.importFromFile(tempZipPath)).rejects.toThrow('At least one .liquid template file is required')

    await fs.promises.unlink(tempZipPath)
  })

  describe('importFromZip', () => {
    it('should parse a Terminus ZIP file correctly', async () => {
      const zip = new AdmZip()

      const manifest = {
        name: 'Test Plugin',
        description: 'Test Description',
        custom_fields: [
          {
            keyname: 'api_key',
            field_type: 'password',
            name: 'API Key',
            description: 'Your API key',
            optional: false,
          },
        ],
      }

      const settings = {
        refresh_interval: 30,
        endpoint: 'https://api.example.com/data',
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
      }

      const template = '<div>{{ data.title }}</div>'

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from(template, 'utf8'))

      const tmpPath = path.join(__dirname, 'test-plugin.zip')
      zip.writeZip(tmpPath)

      const result = await service.importFromFile(tmpPath)

      expect(result.name).toBe('Test Plugin')
      expect(result.description).toBe('Test Description')
      expect(result.kind).toBe('Poll')
      expect(result.refreshInterval).toBe(30)
      expect(result.dataSources[0].url).toBe('https://api.example.com/data')
      expect(result.dataSources[0].method).toBe('GET')
      expect(result.templates).toHaveLength(1)
      expect(result.templates[0].layout).toBe('full')
      expect(result.templates[0].liquidMarkup).toBe(template)
      expect(result.fields).toHaveLength(1)
      expect(result.fields[0].keyname).toBe('api_key')
      expect(result.fields[0].required).toBe(true)

      fs.unlinkSync(tmpPath)
    })

    it('throws error if manifest is missing', async () => {
      const zip = new AdmZip()
      zip.addFile('src/settings.yml', Buffer.from('refresh_interval: 30', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-no-manifest.zip')
      zip.writeZip(tmpPath)

      await expect(service.importFromFile(tmpPath)).rejects.toThrow('.trmnlp.yml manifest not found')

      fs.unlinkSync(tmpPath)
    })

    it('throws error if settings.yml is missing', async () => {
      const zip = new AdmZip()
      zip.addFile('.trmnlp.yml', Buffer.from('name: Test', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-no-settings.zip')
      zip.writeZip(tmpPath)

      await expect(service.importFromFile(tmpPath)).rejects.toThrow('src/settings.yml not found')

      fs.unlinkSync(tmpPath)
    })

    it('rejects a manifest.yml that is a YAML scalar instead of an object', async () => {
      const zip = new AdmZip()
      zip.addFile('.trmnlp.yml', Buffer.from('just a plain string', 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump({ endpoint: 'https://api.example.com' }), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('test', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-scalar-manifest.zip')
      zip.writeZip(tmpPath)

      await expect(service.importFromFile(tmpPath)).rejects.toThrow('Invalid manifest.yml')

      fs.unlinkSync(tmpPath)
    })

    it('rejects a manifest.yml that is a YAML array instead of an object', async () => {
      const zip = new AdmZip()
      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(['not', 'an', 'object']), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump({ endpoint: 'https://api.example.com' }), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('test', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-array-manifest.zip')
      zip.writeZip(tmpPath)

      await expect(service.importFromFile(tmpPath)).rejects.toThrow('Invalid manifest.yml')

      fs.unlinkSync(tmpPath)
    })

    it('rejects a settings.yml that is a YAML array instead of an object', async () => {
      const zip = new AdmZip()
      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump({ name: 'Test Plugin' }), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(['not', 'an', 'object']), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('test', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-array-settings.zip')
      zip.writeZip(tmpPath)

      await expect(service.importFromFile(tmpPath)).rejects.toThrow('Invalid settings.yml')

      fs.unlinkSync(tmpPath)
    })

    it('parses plugin with Terminus-style settings', async () => {
      const zip = new AdmZip()

      const manifest = {
        name: 'Terminus Plugin',
      }

      const settings = {
        refresh_interval: 45,
        polling_url: 'https://terminus.com/api',
        polling_verb: 'post',
        polling_headers: JSON.stringify({ 'X-API-Key': 'key' }),
        polling_body: JSON.stringify({ query: 'data' }),
      }

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('Template', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-terminus.zip')
      zip.writeZip(tmpPath)

      const result = await service.importFromFile(tmpPath)

      expect(result.name).toBe('Terminus Plugin')
      expect(result.refreshInterval).toBe(45)
      expect(result.dataSources[0].url).toBe('https://terminus.com/api')
      expect(result.dataSources[0].method).toBe('POST')
      expect(result.dataSources[0].headers!['X-API-Key']).toBe('key')
      expect(result.dataSources[0].body!.query).toBe('data')

      fs.unlinkSync(tmpPath)
    })

    it('includes transformJs if transform.js exists', async () => {
      const zip = new AdmZip()

      const manifest = { name: 'Transform Plugin' }
      const settings = {
        refresh_interval: 15,
        endpoint: 'https://api.example.com',
        method: 'GET',
      }

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('Template', 'utf8'))
      zip.addFile('src/transform.js', Buffer.from('module.exports = (data) => data', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-transform.zip')
      zip.writeZip(tmpPath)

      const result = await service.importFromFile(tmpPath)

      expect(result.dataSources[0].transformJs).toBe('module.exports = (data) => data')

      fs.unlinkSync(tmpPath)
    })

    it('uses filename as fallback name', async () => {
      const zip = new AdmZip()

      const manifest = {}
      const settings = {
        endpoint: 'https://api.example.com',
        method: 'GET',
      }

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('Template', 'utf8'))

      const tmpPath = path.join(__dirname, 'my-cool-plugin.zip')
      zip.writeZip(tmpPath)

      const result = await service.importFromFile(tmpPath)

      expect(result.name).toBe('my cool plugin')

      fs.unlinkSync(tmpPath)
    })

    it('supports multiple layout templates', async () => {
      const zip = new AdmZip()

      const manifest = { name: 'Multi Layout' }
      const settings = {
        endpoint: 'https://api.example.com',
        method: 'GET',
      }

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('Full', 'utf8'))
      zip.addFile('src/half_horizontal.liquid', Buffer.from('Half H', 'utf8'))
      zip.addFile('src/quadrant.liquid', Buffer.from('Quad', 'utf8'))

      const tmpPath = path.join(__dirname, 'multi-layout.zip')
      zip.writeZip(tmpPath)

      const result = await service.importFromFile(tmpPath)

      expect(result.templates).toHaveLength(3)
      expect(result.templates.find(t => t.layout === 'full')).toBeTruthy()
      expect(result.templates.find(t => t.layout === 'half_horizontal')).toBeTruthy()
      expect(result.templates.find(t => t.layout === 'quadrant')).toBeTruthy()

      fs.unlinkSync(tmpPath)
    })

    it('throws error for unsupported file format', async () => {
      const tmpPath = path.join(__dirname, 'test.txt')
      fs.writeFileSync(tmpPath, 'not a valid format')

      await expect(service.importFromFile(tmpPath)).rejects.toThrow('Unsupported file format')

      fs.unlinkSync(tmpPath)
    })

    it('parses a "data_sources" array into multiple named data sources', async () => {
      const zip = new AdmZip()

      const manifest = { name: 'Multi Source Plugin' }
      const settings = {
        refresh_interval: 20,
        data_sources: [
          { name: 'weather', endpoint: 'https://api.example.com/weather', method: 'get', headers: { 'X-Key': 'a' } },
          { name: 'air_quality', endpoint: 'https://api.example.com/air', method: 'GET', transform_js: 'module.exports = (d) => d' },
        ],
      }

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('{{ weather.temp }} {{ air_quality.aqi }}', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-multi-source.zip')
      zip.writeZip(tmpPath)

      const result = await service.importFromFile(tmpPath)

      fs.unlinkSync(tmpPath)

      expect(result.dataSources).toHaveLength(2)
      expect(result.dataSources[0]).toMatchObject({ name: 'weather', url: 'https://api.example.com/weather', method: 'GET', headers: { 'X-Key': 'a' } })
      expect(result.dataSources[1]).toMatchObject({ name: 'air_quality', url: 'https://api.example.com/air', method: 'GET', transformJs: 'module.exports = (d) => d' })
    })

    it('round-trips a "mode: literal" entry in a "data_sources" array into a literal-mode Data Source', async () => {
      const zip = new AdmZip()

      const manifest = { name: 'Literal Source Plugin' }
      const settings = {
        data_sources: [
          { name: 'title', mode: 'literal', literal_value: { text: 'Hello' } },
        ],
      }

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('{{ title.text }}', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-literal-source.zip')
      zip.writeZip(tmpPath)

      const result = await service.importFromFile(tmpPath)

      fs.unlinkSync(tmpPath)

      expect(result.dataSources).toHaveLength(1)
      expect(result.dataSources[0]).toMatchObject({ name: 'title', mode: 'literal', literalValue: { text: 'Hello' } })
      expect(result.dataSources[0].url).toBeUndefined()
    })

    it('defaults an unnamed entry in a "data_sources" array to source_N', async () => {
      const zip = new AdmZip()

      const manifest = { name: 'Unnamed Sources' }
      const settings = {
        data_sources: [
          { endpoint: 'https://api.example.com/one' },
          { endpoint: 'https://api.example.com/two' },
        ],
      }

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('Test', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-unnamed-sources.zip')
      zip.writeZip(tmpPath)

      const result = await service.importFromFile(tmpPath)

      fs.unlinkSync(tmpPath)

      expect(result.dataSources[0].name).toBe('source_1')
      expect(result.dataSources[1].name).toBe('source_2')
    })

    it('throws if a "data_sources" entry is missing an endpoint', async () => {
      const zip = new AdmZip()

      const manifest = { name: 'Broken Source' }
      const settings = {
        data_sources: [{ name: 'weather' }],
      }

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('Test', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-broken-source.zip')
      zip.writeZip(tmpPath)

      await expect(service.importFromFile(tmpPath)).rejects.toThrow('missing an "endpoint"')

      fs.unlinkSync(tmpPath)
    })

    it('rejects a legacy singular "data_source" key instead of silently coercing it', async () => {
      const zip = new AdmZip()

      const manifest = { name: 'Stale Export' }
      const settings = {
        data_source: { endpoint: 'https://api.example.com', method: 'GET' },
      }

      zip.addFile('.trmnlp.yml', Buffer.from(yaml.dump(manifest), 'utf8'))
      zip.addFile('src/settings.yml', Buffer.from(yaml.dump(settings), 'utf8'))
      zip.addFile('src/full.liquid', Buffer.from('Test', 'utf8'))

      const tmpPath = path.join(__dirname, 'test-legacy-data-source.zip')
      zip.writeZip(tmpPath)

      await expect(service.importFromFile(tmpPath)).rejects.toThrow('legacy single-data-source format')

      fs.unlinkSync(tmpPath)
    })
  })
})
