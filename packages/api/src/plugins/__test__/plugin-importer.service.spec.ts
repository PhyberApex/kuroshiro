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
  })
})
