import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { beforeEach, describe, expect, it } from 'vitest'
import { PluginImporterService } from '../services/plugin-importer.service'

describe('pluginImporterService', () => {
  let service: PluginImporterService

  beforeEach(() => {
    service = new PluginImporterService()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
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
      expect(result.dataSource.url).toBe('https://api.example.com/data')
      expect(result.dataSource.method).toBe('GET')
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
      expect(result.dataSource.url).toBe('https://terminus.com/api')
      expect(result.dataSource.method).toBe('POST')
      expect(result.dataSource.headers['X-API-Key']).toBe('key')
      expect(result.dataSource.body.query).toBe('data')

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

      expect(result.dataSource.transformJs).toBe('module.exports = (data) => data')

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
  })
})
