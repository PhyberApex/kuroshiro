import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { beforeEach, describe, expect, it } from 'vitest'
import { makePlugin, makePluginDataSource, makePluginField, makePluginTemplate } from '../../test/fixtures'
import { PluginExporterService } from '../services/plugin-exporter.service'

interface ExportedManifest {
  name: string
  description: string
  custom_fields: Array<{ keyname: string, field_type: string, optional: boolean, description: string, default_value: string }>
}

interface ExportedSettings {
  refresh_interval: number
  data_sources?: Array<{ name: string, endpoint: string, method: string, headers?: Record<string, string>, body?: Record<string, unknown>, transform_js?: string }>
}

describe('pluginExporterService', () => {
  let service: PluginExporterService

  beforeEach(() => {
    service = new PluginExporterService()
  })

  it('exports a basic plugin to ZIP', async () => {
    const plugin = makePlugin({
      name: 'Test Plugin',
      description: 'Test Description',
      refreshInterval: 15,
      dataSources: [
        makePluginDataSource({ name: 'source', url: 'https://api.example.com', method: 'GET', headers: {}, body: {}, order: 0 }),
      ],
      templates: [
        makePluginTemplate({ layout: 'full', liquidMarkup: '<div>{{ data }}</div>' }),
      ],
      fields: [],
    })

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
    const plugin = makePlugin({
      name: 'Weather Plugin',
      description: 'Shows weather',
      refreshInterval: 30,
      dataSources: [makePluginDataSource({ name: 'source', url: 'https://api.weather.com', method: 'GET', headers: {}, body: {}, order: 0 })],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test' })],
      fields: [
        makePluginField({
          keyname: 'api_key',
          fieldType: 'password',
          name: 'API Key',
          description: 'Your API key',
          defaultValue: '',
          required: true,
        }),
      ],
    })

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const manifestEntry = zip.getEntry('.trmnlp.yml')!
    const manifestContent = manifestEntry.getData().toString('utf8')
    const manifest = yaml.load(manifestContent) as ExportedManifest

    expect(manifest.name).toBe('Weather Plugin')
    expect(manifest.description).toBe('Shows weather')
    expect(manifest.custom_fields).toHaveLength(1)
    expect(manifest.custom_fields[0].keyname).toBe('api_key')
    expect(manifest.custom_fields[0].field_type).toBe('password')
    expect(manifest.custom_fields[0].optional).toBe(false)
  })

  it('includes settings with a data_sources array', async () => {
    const plugin = makePlugin({
      name: 'Test',
      refreshInterval: 60,
      dataSources: [makePluginDataSource({
        name: 'weather',
        url: 'https://api.example.com/data',
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: { key: 'value' },
        order: 0,
      })],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test' })],
      fields: [],
    })

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const settingsEntry = zip.getEntry('src/settings.yml')!
    const settingsContent = settingsEntry.getData().toString('utf8')
    const settings = yaml.load(settingsContent) as ExportedSettings

    expect(settings.refresh_interval).toBe(60)
    expect(settings.data_sources).toHaveLength(1)
    expect(settings.data_sources![0].name).toBe('weather')
    expect(settings.data_sources![0].endpoint).toBe('https://api.example.com/data')
    expect(settings.data_sources![0].method).toBe('POST')
    expect(settings.data_sources![0].headers!.Authorization).toBe('Bearer token')
    expect(settings.data_sources![0].body!.key).toBe('value')
  })

  it('exports multiple data sources in order, each with its own name', async () => {
    const plugin = makePlugin({
      name: 'Multi Source',
      refreshInterval: 15,
      dataSources: [
        makePluginDataSource({ name: 'air_quality', url: 'https://api.example.com/air', method: 'GET', order: 1 }),
        makePluginDataSource({ name: 'weather', url: 'https://api.example.com/weather', method: 'GET', order: 0, transformJs: 'module.exports = (d) => d' }),
      ],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test' })],
      fields: [],
    })

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const settings = yaml.load(zip.getEntry('src/settings.yml')!.getData().toString('utf8')) as ExportedSettings

    expect(settings.data_sources).toHaveLength(2)
    expect(settings.data_sources![0].name).toBe('weather')
    expect(settings.data_sources![0].transform_js).toBe('module.exports = (d) => d')
    expect(settings.data_sources![1].name).toBe('air_quality')
  })

  it('exports a literal-mode data source as a mode/literal_value entry, not a broken endpoint', async () => {
    const plugin = {
      name: 'Mixed',
      refreshInterval: 15,
      dataSources: [
        { name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', method: 'GET', order: 0 },
        { name: 'title', mode: 'literal', literalValue: { text: 'Hello' }, order: 1 },
      ],
      templates: [{ layout: 'full', liquidMarkup: 'Test' }],
      fields: [],
    } as unknown as Plugin

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const settings = yaml.load(zip.getEntry('src/settings.yml')!.getData().toString('utf8')) as any

    expect(settings.data_sources).toHaveLength(2)
    const literalEntry = settings.data_sources.find((s: any) => s.name === 'title')
    expect(literalEntry.mode).toBe('literal')
    expect(literalEntry.literal_value).toEqual({ text: 'Hello' })
    expect(literalEntry.endpoint).toBeUndefined()

    const fetchEntry = settings.data_sources.find((s: any) => s.name === 'weather')
    expect(fetchEntry.endpoint).toBe('https://api.example.com/weather')
    expect(fetchEntry.mode).toBeUndefined()
  })

  it('exports multiple templates with different layouts', async () => {
    const plugin = makePlugin({
      name: 'Multi Layout',
      refreshInterval: 15,
      dataSources: [makePluginDataSource({ name: 'source', url: 'https://api.example.com', method: 'GET', headers: {}, body: {}, order: 0 })],
      templates: [
        makePluginTemplate({ layout: 'full', liquidMarkup: 'Full layout' }),
        makePluginTemplate({ layout: 'half_horizontal', liquidMarkup: 'Half layout' }),
        makePluginTemplate({ layout: 'quadrant', liquidMarkup: 'Quadrant layout' }),
      ],
      fields: [],
    })

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)

    expect(zip.getEntry('src/full.liquid')).toBeTruthy()
    expect(zip.getEntry('src/half_horizontal.liquid')).toBeTruthy()
    expect(zip.getEntry('src/quadrant.liquid')).toBeTruthy()

    const fullContent = zip.getEntry('src/full.liquid')!.getData().toString('utf8')
    expect(fullContent).toBe('Full layout')
  })

  it('handles plugin without data source', async () => {
    const plugin = makePlugin({
      name: 'No Data Source',
      refreshInterval: 15,
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Static content' })],
      fields: [],
    })

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    expect(entries.some(e => e.entryName === '.trmnlp.yml')).toBe(true)
    expect(entries.some(e => e.entryName === 'src/settings.yml')).toBe(false)
    expect(entries.some(e => e.entryName === 'src/full.liquid')).toBe(true)
  })

  it('handles plugin without templates', async () => {
    const plugin = makePlugin({
      name: 'No Templates',
      refreshInterval: 15,
      dataSources: [makePluginDataSource({ name: 'source', url: 'https://api.example.com', method: 'GET', headers: {}, body: {}, order: 0 })],
      fields: [],
    })

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    expect(entries.some(e => e.entryName === '.trmnlp.yml')).toBe(true)
    expect(entries.some(e => e.entryName === 'src/settings.yml')).toBe(true)
    expect(entries.some(e => e.entryName.endsWith('.liquid'))).toBe(false)
  })

  it('handles empty or undefined descriptions and defaults', async () => {
    const plugin = makePlugin({
      name: 'Test',
      description: undefined,
      refreshInterval: 15,
      dataSources: [makePluginDataSource({
        name: 'source',
        url: 'https://api.example.com',
        method: 'GET',
        headers: undefined,
        body: undefined,
        order: 0,
      })],
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: 'Test' })],
      fields: [
        makePluginField({
          keyname: 'field1',
          fieldType: 'string',
          name: 'Field',
          description: undefined,
          defaultValue: undefined,
          required: false,
        }),
      ],
    })

    const buffer = await service.exportToZip(plugin)
    const zip = new AdmZip(buffer)
    const manifestEntry = zip.getEntry('.trmnlp.yml')!
    const manifest = yaml.load(manifestEntry.getData().toString('utf8')) as ExportedManifest

    expect(manifest.description).toBe('')
    expect(manifest.custom_fields[0].description).toBe('')
    expect(manifest.custom_fields[0].default_value).toBe('')
  })
})
