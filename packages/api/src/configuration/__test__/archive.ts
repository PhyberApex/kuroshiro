import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { CONFIG_SCHEMA_VERSION } from '../schema-version.js'

interface PluginFolder {
  manifest: Record<string, unknown>
  settings?: Record<string, unknown>
  templates: Record<string, string>
}

export function buildArchive(options: {
  manifest?: Record<string, unknown> | null
  plugins?: unknown[]
  devices?: unknown[]
  screens?: unknown[]
  assignments?: unknown[]
  palettes?: unknown[]
  firmware?: unknown[]
  settings?: Record<string, unknown> | null
  pluginFolders?: Record<string, PluginFolder>
  screenImages?: Record<string, string>
} = {}): Buffer {
  const zip = new AdmZip()

  if (options.manifest !== null) {
    const manifest = options.manifest ?? {
      kuroshiroVersion: '0.13.0',
      schemaVersion: CONFIG_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      containsSecrets: true,
    }
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
  }

  zip.addFile('plugins.json', Buffer.from(JSON.stringify(options.plugins ?? [])))
  zip.addFile('devices.json', Buffer.from(JSON.stringify(options.devices ?? [])))
  zip.addFile('screens.json', Buffer.from(JSON.stringify(options.screens ?? [])))
  zip.addFile('assignments.json', Buffer.from(JSON.stringify(options.assignments ?? [])))
  zip.addFile('palettes.json', Buffer.from(JSON.stringify(options.palettes ?? [])))
  zip.addFile('firmware.json', Buffer.from(JSON.stringify(options.firmware ?? [])))
  if (options.settings !== null) {
    zip.addFile('settings.json', Buffer.from(JSON.stringify(options.settings ?? {})))
  }

  for (const [pluginId, folder] of Object.entries(options.pluginFolders ?? {})) {
    zip.addFile(`plugins/${pluginId}/.trmnlp.yml`, Buffer.from(yaml.dump(folder.manifest)))
    if (folder.settings) {
      zip.addFile(`plugins/${pluginId}/src/settings.yml`, Buffer.from(yaml.dump(folder.settings)))
    }
    for (const [layout, content] of Object.entries(folder.templates)) {
      zip.addFile(`plugins/${pluginId}/src/${layout}.liquid`, Buffer.from(content))
    }
  }

  for (const [screenId, content] of Object.entries(options.screenImages ?? {})) {
    zip.addFile(`screens/${screenId}/${screenId}.png`, Buffer.from(content))
  }

  return zip.toBuffer()
}

export function makeDeviceEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'device-1',
    name: 'Device 1',
    friendlyId: 'ABC123',
    mac: 'AA:BB:CC:DD:EE:FF',
    apikey: 'key1',
    refreshRate: 300,
    deviceModelName: null,
    paletteId: null,
    mirrorEnabled: null,
    mirrorMac: null,
    mirrorApikey: null,
    sleepModeEnabled: false,
    sleepStartTime: null,
    sleepEndTime: null,
    sleepScreenEnabled: false,
    targetFirmwareId: null,
    ...overrides,
  }
}
