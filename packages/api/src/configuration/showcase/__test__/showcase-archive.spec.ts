import type { DeviceManifestEntry, PluginManifestEntry } from '../../types.js'
import AdmZip from 'adm-zip'
import { CONFIGURATION_REDACTION_SENTINEL } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { CONFIG_SCHEMA_VERSION } from '../../schema-version.js'
import { CONFIG_ARCHIVE_FILES } from '../../types.js'
import { buildShowcaseArchiveZip } from '../showcase-archive.js'

function readJson<T>(zip: AdmZip, filename: string): T {
  const entry = zip.getEntry(filename)
  if (!entry) {
    throw new Error(`${filename} not found in the showcase archive`)
  }
  return JSON.parse(entry.getData().toString('utf8')) as T
}

describe('buildShowcaseArchiveZip', () => {
  it('parses as a Configuration Archive whose schemaVersion matches the running instance', () => {
    const zip = new AdmZip(buildShowcaseArchiveZip())

    const manifest = readJson<{ schemaVersion: number, containsSecrets: boolean }>(zip, CONFIG_ARCHIVE_FILES.manifest)

    // A future schema bump must fail this test until the showcase archive is updated for it (Agent Brief addendum).
    expect(manifest.schemaVersion).toBe(CONFIG_SCHEMA_VERSION)
    expect(manifest.containsSecrets).toBe(false)
  })

  it('carries one Device, authored with no fixed apikey', () => {
    const zip = new AdmZip(buildShowcaseArchiveZip())
    const devices = readJson<DeviceManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.devices)

    expect(devices).toHaveLength(1)
    expect(devices[0].apikey).toBe(CONFIGURATION_REDACTION_SENTINEL)
    expect(devices[0].mirrorApikey).toBeNull()
  })

  it('carries only Poll Plugins whose fetch Data Sources name a public https address', () => {
    const zip = new AdmZip(buildShowcaseArchiveZip())
    const plugins = readJson<PluginManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.plugins)

    expect(plugins.length).toBeGreaterThan(0)
    for (const plugin of plugins) {
      expect(plugin.kind).toBe('Poll')
      expect(plugin.webhookToken).toBeNull()

      for (const pluginId of [plugin.id]) {
        const settingsEntry = zip.getEntry(`plugins/${pluginId}/src/settings.yml`)
        expect(settingsEntry).toBeTruthy()
        const settingsYaml = settingsEntry!.getData().toString('utf8')
        // A literal-mode Data Source has no endpoint to check; every fetch endpoint named must be public https.
        const endpoints = [...settingsYaml.matchAll(/endpoint:\s*(\S+)/g)].map(match => match[1].replace(/^['"]|['"]$/g, ''))
        for (const endpoint of endpoints) {
          expect(endpoint.startsWith('https://')).toBe(true)
        }
      }
    }
  })

  it('carries a Recipe-imported Plugin alongside a fetch-mode and a literal-mode Poll Plugin', () => {
    const zip = new AdmZip(buildShowcaseArchiveZip())
    const plugins = readJson<PluginManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.plugins)

    expect(plugins.filter(plugin => plugin.sourceRecipeId !== null)).toHaveLength(1)
  })
})
