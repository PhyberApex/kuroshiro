import type { Plugin } from '../entities/plugin.entity'
import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { beforeEach, describe, expect, it } from 'vitest'
import { PluginExporterService } from '../services/plugin-exporter.service'

describe('pluginExporterService', () => {
  let service: PluginExporterService

  beforeEach(() => {
    service = new PluginExporterService()
  })

  it('exports a basic plugin to ZIP', async () => {
    const plugin = {
      name: 'Test Plugin',
      description: 'Test Description',
      refreshInterval: 15,
      dataSource: {
        url: 'https://api.example.com',
        method: 'GET',
        headers: {},
        body: {},
      },
      templates: [
        {
          layout: 'full',
          liquidMarkup: '<div>{{ data }}</div>',
        },
      ],
      fields: [],
    } as unknown as Plugin

    const buffer = await service.exportToZip(plugin)
    expect(buffer).toBeInstanceOf(Buffer)

    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    expect(entries.length).toBe(3)
    expect(entries.some(e => e.entryName === '.trmnlp.yml')).toBe(true)
    expect(entries.some(e => e.entryName === 'src/settings.yml')).toBe(true)
    expect(entries.some(e => e.entryName === 'src/full.liquid')).toBe(true)
  })

  it('includes manifest with custom fields', async () => {
    const plugin = {
      name: 'Weather Plugin',
      description: 'Shows weather',
      refreshInterval: 30,
      dataSource: {
        url: 'https://api.weather.com',
        method: 'GET',
        headers: {},
        body: {},
      },
      templates: [{ layout: 'full', liquidMarkup: 'Test' }],
      fields: [
        {
          keyname: 'api_key',
          fieldType: 'password',
          name: 'API Key',
          description: 'Your API key',
          defaultValue: '',
          required: true,
        },
      ],
    } as unknown as Plugin

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const manifestEntry = zip.getEntry('.trmnlp.yml')
    const manifestContent = manifestEntry.getData().toString('utf8')
    const manifest = yaml.load(manifestContent) as any

    expect(manifest.name).toBe('Weather Plugin')
    expect(manifest.description).toBe('Shows weather')
    expect(manifest.custom_fields).toHaveLength(1)
    expect(manifest.custom_fields[0].keyname).toBe('api_key')
    expect(manifest.custom_fields[0].field_type).toBe('password')
    expect(manifest.custom_fields[0].optional).toBe(false)
  })

  it('includes settings with data source config', async () => {
    const plugin = {
      name: 'Test',
      refreshInterval: 60,
      dataSource: {
        url: 'https://api.example.com/data',
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: { key: 'value' },
      },
      templates: [{ layout: 'full', liquidMarkup: 'Test' }],
      fields: [],
    } as unknown as Plugin

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const settingsEntry = zip.getEntry('src/settings.yml')
    const settingsContent = settingsEntry.getData().toString('utf8')
    const settings = yaml.load(settingsContent) as any

    expect(settings.refresh_interval).toBe(60)
    expect(settings.endpoint).toBe('https://api.example.com/data')
    expect(settings.method).toBe('POST')
    expect(settings.headers.Authorization).toBe('Bearer token')
    expect(settings.body.key).toBe('value')
  })

  it('exports multiple templates with different layouts', async () => {
    const plugin = {
      name: 'Multi Layout',
      refreshInterval: 15,
      dataSource: {
        url: 'https://api.example.com',
        method: 'GET',
        headers: {},
        body: {},
      },
      templates: [
        { layout: 'full', liquidMarkup: 'Full layout' },
        { layout: 'half_horizontal', liquidMarkup: 'Half layout' },
        { layout: 'quadrant', liquidMarkup: 'Quadrant layout' },
      ],
      fields: [],
    } as unknown as Plugin

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)

    expect(zip.getEntry('src/full.liquid')).toBeTruthy()
    expect(zip.getEntry('src/half_horizontal.liquid')).toBeTruthy()
    expect(zip.getEntry('src/quadrant.liquid')).toBeTruthy()

    const fullContent = zip.getEntry('src/full.liquid').getData().toString('utf8')
    expect(fullContent).toBe('Full layout')
  })

  it('handles plugin without data source', async () => {
    const plugin = {
      name: 'No Data Source',
      refreshInterval: 15,
      templates: [{ layout: 'full', liquidMarkup: 'Static content' }],
      fields: [],
    } as unknown as Plugin

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    expect(entries.some(e => e.entryName === '.trmnlp.yml')).toBe(true)
    expect(entries.some(e => e.entryName === 'src/settings.yml')).toBe(false)
    expect(entries.some(e => e.entryName === 'src/full.liquid')).toBe(true)
  })

  it('handles plugin without templates', async () => {
    const plugin = {
      name: 'No Templates',
      refreshInterval: 15,
      dataSource: {
        url: 'https://api.example.com',
        method: 'GET',
        headers: {},
        body: {},
      },
      fields: [],
    } as unknown as Plugin

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    expect(entries.some(e => e.entryName === '.trmnlp.yml')).toBe(true)
    expect(entries.some(e => e.entryName === 'src/settings.yml')).toBe(true)
    expect(entries.some(e => e.entryName.endsWith('.liquid'))).toBe(false)
  })

  it('handles empty or undefined descriptions and defaults', async () => {
    const plugin = {
      name: 'Test',
      description: undefined,
      refreshInterval: 15,
      dataSource: {
        url: 'https://api.example.com',
        method: 'GET',
        headers: undefined,
        body: undefined,
      },
      templates: [{ layout: 'full', liquidMarkup: 'Test' }],
      fields: [
        {
          keyname: 'field1',
          fieldType: 'string',
          name: 'Field',
          description: undefined,
          defaultValue: undefined,
          required: false,
        },
      ],
    } as unknown as Plugin

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const manifestEntry = zip.getEntry('.trmnlp.yml')
    const manifest = yaml.load(manifestEntry.getData().toString('utf8')) as any

    expect(manifest.description).toBe('')
    expect(manifest.custom_fields[0].description).toBe('')
    expect(manifest.custom_fields[0].default_value).toBe('')
  })
})
