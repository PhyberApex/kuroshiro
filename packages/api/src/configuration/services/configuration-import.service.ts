import type { ConfigurationImportSummary, ImportCheck, ImportCounts, ImportWarning, Ref } from 'kuroshiro-shared'
import type { EntityManager, Repository } from 'typeorm'
import type { ParsedDataSource, ParsedPlugin } from '../../plugins/services/plugin-importer.service.js'
import type {
  AssignmentManifestEntry,
  ConfigurationManifest,
  DeviceManifestEntry,
  FirmwareManifestEntry,
  InstanceSettingsManifestEntry,
  LegacyAssignmentManifestFields,
  LegacyPluginManifestFields,
  PaletteManifestEntry,
  PluginManifestDataSource,
  PluginManifestEntry,
  PluginManifestField,
  PluginManifestTemplate,
  ScreenManifestEntry,
} from '../types.js'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { BOOLEAN_SETTING_KEYS, CONFIGURATION_REDACTION_SENTINEL, SETTING_KEYS } from 'kuroshiro-shared'
import { DeviceModel } from '../../device-models/entities/device-model.entity.js'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { ApiException } from '../../errors/api.exception.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { firmwareFilePath } from '../../firmware/firmware-paths.js'
import { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import { PluginDataSource } from '../../plugins/entities/plugin-data-source.entity.js'
import { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
import { PluginTemplate } from '../../plugins/entities/plugin-template.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { Schedule } from '../../schedule/schedule.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { INSTANCE_SETTINGS_ID, InstanceSettings } from '../../settings/entities/instance-settings.entity.js'
import { fileExists } from '../../utils/fileExists.js'
import generateApikey from '../../utils/generateApikey.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { CONFIG_SCHEMA_VERSION, PREVIOUS_CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { CONFIG_ARCHIVE_FILES } from '../types.js'

/** What one run over an archive has done so far. A check runs the same import and is rolled back at its end. */
interface ImportRun {
  checkOnly: boolean
  created: ImportCounts
  updated: ImportCounts
  warnings: ImportWarning[]
  devices: { added: Ref[], overwritten: Ref[] }
  /** The Plugins of a schemaVersion 2 archive that held Plugin Variables or per-Assignment Field Values, which have nowhere to go (ADR-0032). */
  pluginsWithDroppedValues: Set<string>
}

interface ArchiveContents {
  zip: AdmZip
  manifest: ConfigurationManifest
  plugins: Array<PluginManifestEntry & LegacyPluginManifestFields>
  devices: DeviceManifestEntry[]
  screens: ScreenManifestEntry[]
  assignments: Array<AssignmentManifestEntry & LegacyAssignmentManifestFields>
  palettes: PaletteManifestEntry[]
  firmware: FirmwareManifestEntry[]
  settings: InstanceSettingsManifestEntry
}

/** Thrown at the end of a check's transaction, so that the database rolls back everything the check did. */
class CheckFinished extends Error {}

function notAZip(): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, 'archive-not-zip', 'The file is not a .zip that can be read.')
}

function notAConfigurationArchive(reason: string): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, 'archive-not-configuration', `The .zip is not a Configuration Archive: ${reason}.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface TransactionRepos {
  palette: Repository<Palette>
  firmware: Repository<Firmware>
  plugin: Repository<Plugin>
  dataSource: Repository<PluginDataSource>
  template: Repository<PluginTemplate>
  field: Repository<PluginField>
  device: Repository<Device>
  deviceModel: Repository<DeviceModel>
  devicePlugin: Repository<DevicePlugin>
  fieldValue: Repository<PluginFieldValue>
  screen: Repository<Screen>
  schedule: Repository<Schedule>
  mashupConfig: Repository<MashupConfiguration>
  mashupSlot: Repository<MashupSlot>
  instanceSettings: Repository<InstanceSettings>
}

/** Whether a Plugin's `src/settings.yml` has Data Sources for the importer to read: a Webhook-kind Plugin's has none, and a Poll-kind Plugin's may list none. */
function listsDataSources(settingsYaml: string): boolean {
  try {
    const settings = yaml.load(settingsYaml) as { strategy?: unknown, data_sources?: unknown } | null
    const listsNone = Array.isArray(settings?.data_sources) && settings.data_sources.length === 0
    return !(settings?.strategy === 'webhook' || listsNone)
  }
  catch {
    // Unreadable YAML is the importer's to refuse, with its own message.
    return true
  }
}

@Injectable()
export class ConfigurationImportService {
  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    private readonly pluginImporter: PluginImporterService,
  ) {}

  async importFromZip(buffer: Buffer): Promise<ConfigurationImportSummary> {
    const { created, updated, warnings } = await this.run(this.readArchive(buffer), false)
    return { created, updated, warnings }
  }

  /** What `importFromZip` would do with the same archive: it is that import, rolled back, minus the one thing a rollback does not undo, a File Screen's image written to disk. */
  async checkZip(buffer: Buffer): Promise<ImportCheck> {
    const archive = this.readArchive(buffer)
    const run = await this.run(archive, true)
    return {
      archive: {
        kuroshiroVersion: typeof archive.manifest.kuroshiroVersion === 'string' ? archive.manifest.kuroshiroVersion : null,
        exportedAt: typeof archive.manifest.exportedAt === 'string' ? archive.manifest.exportedAt : null,
        schemaVersion: archive.manifest.schemaVersion,
        redacted: archive.manifest.redacted === true,
      },
      adds: run.created,
      overwrites: run.updated,
      devices: run.devices,
      settings: { overridden: [...SETTING_KEYS, ...BOOLEAN_SETTING_KEYS].filter(key => archive.settings[key] != null).length },
      warnings: run.warnings,
    }
  }

  private readArchive(buffer: Buffer): ArchiveContents {
    const zip = this.openZip(buffer)
    const manifest = this.readManifest(zip)
    this.assertSchemaVersion(manifest)

    return {
      zip,
      manifest,
      plugins: this.readList(zip, CONFIG_ARCHIVE_FILES.plugins),
      devices: this.readList(zip, CONFIG_ARCHIVE_FILES.devices),
      screens: this.readList(zip, CONFIG_ARCHIVE_FILES.screens),
      assignments: this.readList(zip, CONFIG_ARCHIVE_FILES.assignments),
      palettes: this.readList(zip, CONFIG_ARCHIVE_FILES.palettes),
      firmware: this.readList(zip, CONFIG_ARCHIVE_FILES.firmware),
      settings: this.readSettings(zip),
    }
  }

  private async run(archive: ArchiveContents, checkOnly: boolean): Promise<ImportRun> {
    const { zip } = archive
    const run: ImportRun = {
      checkOnly,
      created: {},
      updated: {},
      warnings: [],
      devices: { added: [], overwritten: [] },
      pluginsWithDroppedValues: archive.manifest.schemaVersion === PREVIOUS_CONFIG_SCHEMA_VERSION
        ? this.pluginsWithLegacyValues(archive.plugins, archive.assignments)
        : new Set(),
    }

    try {
      await this.pluginRepository.manager.transaction(async (manager) => {
        const repos = this.reposFor(manager)

        for (const entry of archive.palettes) {
          await this.withEntryContext('Palette', entry.id, () => this.upsertPalette(repos.palette, entry, run))
        }

        for (const entry of archive.firmware) {
          await this.withEntryContext('Firmware', entry.id, () => this.upsertFirmware(repos.firmware, entry, run))
        }

        // Insertion order follows the archive's foreign keys (ADR-0021): Palettes,
        // Firmware, Plugins, then Devices (which may reference either), then
        // DevicePlugins/Screens (which reference Devices and Plugins).
        for (const entry of archive.plugins) {
          await this.withEntryContext('Plugin', entry.id, () => this.upsertPlugin(repos, zip, entry, run))
        }

        const deviceIdRemap = new Map<string, string>()
        for (const entry of archive.devices) {
          const dbId = await this.withEntryContext('Device', entry.id, () => this.upsertDevice(repos, entry, run))
          if (dbId !== entry.id) {
            deviceIdRemap.set(entry.id, dbId)
          }
        }

        for (const entry of archive.assignments) {
          await this.withEntryContext('Assignment', entry.id, () => this.upsertAssignment(repos, entry, deviceIdRemap, run))
        }

        for (const entry of archive.screens) {
          await this.withEntryContext('Screen', entry.id, () => this.upsertScreen(repos, zip, entry, deviceIdRemap, run))
        }

        await this.withEntryContext('Instance Settings', null, () => this.replaceInstanceSettings(repos.instanceSettings, archive.settings))

        if (checkOnly) {
          throw new CheckFinished()
        }
      })
    }
    catch (error) {
      if (!(error instanceof CheckFinished)) {
        throw error
      }
    }

    return run
  }

  private reposFor(manager: EntityManager): TransactionRepos {
    return {
      palette: manager.getRepository(Palette),
      firmware: manager.getRepository(Firmware),
      plugin: manager.getRepository(Plugin),
      dataSource: manager.getRepository(PluginDataSource),
      template: manager.getRepository(PluginTemplate),
      field: manager.getRepository(PluginField),
      device: manager.getRepository(Device),
      deviceModel: manager.getRepository(DeviceModel),
      devicePlugin: manager.getRepository(DevicePlugin),
      fieldValue: manager.getRepository(PluginFieldValue),
      screen: manager.getRepository(Screen),
      schedule: manager.getRepository(Schedule),
      mashupConfig: manager.getRepository(MashupConfiguration),
      mashupSlot: manager.getRepository(MashupSlot),
      instanceSettings: manager.getRepository(InstanceSettings),
    }
  }

  /** Replaces the whole Instance Settings row from the archive (ADR-0027): a Setting absent from `entry` is cleared on the target. */
  private async replaceInstanceSettings(repo: Repository<InstanceSettings>, entry: InstanceSettingsManifestEntry): Promise<void> {
    const existing = await repo.findOneBy({ id: INSTANCE_SETTINGS_ID })
    const row = existing ?? repo.create({ id: INSTANCE_SETTINGS_ID })
    for (const key of SETTING_KEYS)
      row[key] = entry[key] ?? null
    for (const key of BOOLEAN_SETTING_KEYS)
      row[key] = entry[key] ?? null
    await repo.save(row)
  }

  /** Runs one record's upsert, and if it throws, refuses the whole archive naming the record that broke the transaction (ADR-0021). */
  private async withEntryContext<T>(entity: string, id: string | null, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const record = id === null ? entity : `${entity} ${id}`
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'archive-record-refused', `${record} could not be imported: ${reason}`, { entity, id, reason })
    }
  }

  private openZip(buffer: Buffer): AdmZip {
    try {
      return new AdmZip(buffer)
    }
    catch {
      throw notAZip()
    }
  }

  private readManifest(zip: AdmZip): ConfigurationManifest {
    const manifest = this.readJson(zip, CONFIG_ARCHIVE_FILES.manifest)
    if (!isRecord(manifest)) {
      throw notAConfigurationArchive(`${CONFIG_ARCHIVE_FILES.manifest} is not an object`)
    }
    return manifest as unknown as ConfigurationManifest
  }

  private assertSchemaVersion(manifest: ConfigurationManifest): void {
    if (manifest.schemaVersion !== CONFIG_SCHEMA_VERSION && manifest.schemaVersion !== PREVIOUS_CONFIG_SCHEMA_VERSION) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'archive-schema-version',
        `Archive schemaVersion is ${manifest.schemaVersion ?? 'missing'}, but this Kuroshiro instance expects schemaVersion ${CONFIG_SCHEMA_VERSION}`,
        { archive: manifest.schemaVersion ?? null, expected: CONFIG_SCHEMA_VERSION },
      )
    }
  }

  private pluginsWithLegacyValues(pluginEntries: Array<{ id: string } & LegacyPluginManifestFields>, assignmentEntries: Array<{ pluginId: string } & LegacyAssignmentManifestFields>): Set<string> {
    return new Set([
      ...pluginEntries.filter(entry => (entry.variables?.length ?? 0) > 0).map(entry => entry.id),
      ...assignmentEntries.filter(entry => (entry.fieldValues?.length ?? 0) > 0).map(entry => entry.pluginId),
    ])
  }

  private readJson(zip: AdmZip, filename: string): unknown {
    const entry = zip.getEntry(filename)
    if (!entry) {
      throw notAConfigurationArchive(`${filename} not found`)
    }
    const text = this.readEntry(entry)
    try {
      return JSON.parse(text)
    }
    catch {
      throw notAConfigurationArchive(`${filename} is not valid JSON`)
    }
  }

  private readEntry(entry: AdmZip.IZipEntry): string {
    try {
      return entry.getData().toString('utf8')
    }
    catch {
      throw notAZip()
    }
  }

  private readList<T>(zip: AdmZip, filename: string): T[] {
    const list = this.readJson(zip, filename)
    if (!Array.isArray(list)) {
      throw notAConfigurationArchive(`${filename} is not a list`)
    }
    return list as T[]
  }

  private readSettings(zip: AdmZip): InstanceSettingsManifestEntry {
    const settings = this.readJson(zip, CONFIG_ARCHIVE_FILES.settings)
    if (!isRecord(settings)) {
      throw notAConfigurationArchive(`${CONFIG_ARCHIVE_FILES.settings} is not an object`)
    }
    return settings
  }

  private bump(run: ImportRun, key: string, wasCreated: boolean): void {
    const bucket = wasCreated ? run.created : run.updated
    bucket[key] = (bucket[key] ?? 0) + 1
  }

  private async upsertPalette(repo: Repository<Palette>, entry: PaletteManifestEntry, run: ImportRun): Promise<void> {
    const existing = await repo.findOneBy({ id: entry.id })
    const palette = existing ?? repo.create({ id: entry.id })
    palette.name = entry.name
    palette.kind = 'custom'
    palette.grays = entry.grays
    palette.colors = entry.colors
    palette.frameworkClass = entry.frameworkClass
    palette.grayscaleBitDepth = entry.grayscaleBitDepth
    palette.deprecated = entry.deprecated
    await repo.save(palette)
    this.bump(run, 'palettes', !existing)
  }

  private async upsertFirmware(repo: Repository<Firmware>, entry: FirmwareManifestEntry, run: ImportRun): Promise<void> {
    const existing = await repo.findOneBy({ id: entry.id })
    const firmware = existing ?? repo.create({ id: entry.id })
    firmware.version = entry.version
    firmware.kind = 'custom'
    firmware.checksum = entry.checksum
    firmware.compatibleModels = entry.compatibleModels
    firmware.label = entry.label
    firmware.deprecated = entry.deprecated
    firmware.uploadedAt = entry.uploadedAt ? new Date(entry.uploadedAt) : null
    await repo.save(firmware)
    this.bump(run, 'firmware', !existing)
    // The archive never carries a Firmware's file (ADR-0021), so one that is not on this disk cannot be pushed.
    if (!await fileExists(firmwareFilePath(entry.id))) {
      run.warnings.push({ kind: 'firmware-file-missing', firmware: { id: entry.id, version: entry.version } })
    }
  }

  private async resolveDeviceModel(repo: Repository<DeviceModel>, name: string | null, device: Ref, run: ImportRun): Promise<DeviceModel | null> {
    if (!name) {
      return null
    }
    const model = await repo.findOneBy({ name })
    if (!model) {
      run.warnings.push({ kind: 'device-model-unknown', device, deviceModel: name })
    }
    return model
  }

  private async resolvePalette(repo: Repository<Palette>, id: string | null, device: Ref, run: ImportRun): Promise<Palette | null> {
    if (!id) {
      return null
    }
    const palette = await repo.findOneBy({ id })
    if (!palette) {
      run.warnings.push({ kind: 'palette-unknown', device, paletteId: id })
    }
    return palette
  }

  private async resolveFirmware(repo: Repository<Firmware>, id: string | null, device: Ref, run: ImportRun): Promise<Firmware | null> {
    if (!id) {
      return null
    }
    const firmware = await repo.findOneBy({ id })
    if (!firmware) {
      run.warnings.push({ kind: 'firmware-unknown', device, firmwareId: id })
    }
    return firmware
  }

  private async upsertDevice(repos: TransactionRepos, entry: DeviceManifestEntry, run: ImportRun): Promise<string> {
    let device = await repos.device.findOneBy({ id: entry.id })
    let wasCreated = !device
    let reattachedByMac = false

    // Re-attach to hardware that already registered under a different id (ADR-0021).
    if (!device) {
      const macMatch = await repos.device.findOneBy({ mac: entry.mac })
      if (macMatch) {
        device = macMatch
        wasCreated = false
        reattachedByMac = true
      }
    }

    if (!device) {
      device = repos.device.create({ id: entry.id })
    }

    const ref: Ref = { id: device.id, name: entry.name }

    device.name = entry.name
    device.friendlyId = entry.friendlyId
    device.mac = entry.mac
    // Hardware re-attached by mac already holds its own live apikey (minted by DeviceSetupService);
    // overwriting it with the archived value would desync the DB from what the physical device sends,
    // breaking its next /display poll. Only a brand-new or exact-id-match row takes the archived apikey.
    if (!reattachedByMac) {
      device.apikey = this.resolveDeviceApikey(entry, device, wasCreated, ref, run)
    }
    device.refreshRate = entry.refreshRate
    device.deviceModel = await this.resolveDeviceModel(repos.deviceModel, entry.deviceModelName, ref, run)
    device.palette = await this.resolvePalette(repos.palette, entry.paletteId, ref, run)
    device.mirrorEnabled = entry.mirrorEnabled ?? undefined
    device.mirrorMac = entry.mirrorMac ?? undefined
    device.mirrorApikey = this.resolveMirrorApikey(entry, device, ref, run)
    device.sleepModeEnabled = entry.sleepModeEnabled
    device.sleepStartTime = entry.sleepStartTime
    device.sleepEndTime = entry.sleepEndTime
    device.sleepScreenEnabled = entry.sleepScreenEnabled
    device.targetFirmware = await this.resolveFirmware(repos.firmware, entry.targetFirmwareId, ref, run)

    const saved = await repos.device.save(device)
    this.bump(run, 'devices', wasCreated)
    ;(wasCreated ? run.devices.added : run.devices.overwritten).push(ref)
    return saved.id
  }

  /** Shared recovery for a single redacted scalar field (ADR-0028): keeps `keptValue` when `keep` is true, otherwise warns and falls back. Not used for headers, which resolve per-key against a map rather than a single value. */
  private resolveRedactedField<T>(keep: boolean, keptValue: T, fallback: () => T, warning: ImportWarning, run: ImportRun): T {
    if (keep) {
      return keptValue
    }
    run.warnings.push(warning)
    return fallback()
  }

  /** A redacted apikey keeps the target row's value when one exists; a brand-new Device gets a freshly minted one, as auto-registration would (ADR-0028). */
  private resolveDeviceApikey(entry: DeviceManifestEntry, device: Device, wasCreated: boolean, ref: Ref, run: ImportRun): string {
    if (entry.apikey !== CONFIGURATION_REDACTION_SENTINEL) {
      return entry.apikey
    }
    return this.resolveRedactedField(!wasCreated, device.apikey, () => generateApikey(), { kind: 'device-apikey-redacted', device: ref }, run)
  }

  /** A redacted mirrorApikey keeps the target row's value when one is set, otherwise falls back to unset (ADR-0028). */
  private resolveMirrorApikey(entry: DeviceManifestEntry, device: Device, ref: Ref, run: ImportRun): string | undefined {
    if (entry.mirrorApikey !== CONFIGURATION_REDACTION_SENTINEL) {
      return entry.mirrorApikey ?? undefined
    }
    return this.resolveRedactedField(Boolean(device.mirrorApikey), device.mirrorApikey, () => undefined, { kind: 'mirror-apikey-redacted', device: ref }, run)
  }

  /**
   * Extracts a `plugins/<id>/` folder into its own in-memory `.trmnlp` zip. A Plugin without
   * Data Sources (every Webhook-kind Plugin) has a `src/settings.yml` that lists none, or, in
   * an archive of an older Kuroshiro, no such file at all; a placeholder is synthesized then to
   * satisfy `parseZip`'s manifest+settings precondition. `hasDataSources` drives `upsertPlugin`
   * to pass `forcedDataSources: []` rather than touching `PluginImporterService`'s shared
   * parsing rules for real uploads.
   */
  private extractPluginZip(zip: AdmZip, pluginId: string): { zip: AdmZip, hasDataSources: boolean } {
    const prefix = `plugins/${pluginId}/`
    const sub = new AdmZip()
    let hasSettings = false
    let hasDataSources = false

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !entry.entryName.startsWith(prefix)) {
        continue
      }
      const relativePath = entry.entryName.slice(prefix.length)
      if (relativePath === 'src/settings.yml') {
        hasSettings = true
        hasDataSources = listsDataSources(entry.getData().toString('utf8'))
      }
      sub.addFile(relativePath, entry.getData())
    }

    if (!hasSettings) {
      sub.addFile('src/settings.yml', Buffer.from(yaml.dump({}), 'utf8'))
    }

    return { zip: sub, hasDataSources }
  }

  private async upsertPlugin(repos: TransactionRepos, zip: AdmZip, entry: PluginManifestEntry, run: ImportRun): Promise<void> {
    const existing = await repos.plugin.findOneBy({ id: entry.id })

    const { zip: subZip, hasDataSources } = this.extractPluginZip(zip, entry.id)
    const parsed = this.pluginImporter.parseZip(subZip, entry.id, hasDataSources ? undefined : [])
    const ref: Ref = { id: entry.id, name: parsed.name }

    if (run.pluginsWithDroppedValues.has(entry.id)) {
      run.warnings.push({ kind: 'previous-version-values-dropped', plugin: ref })
    }

    const webhookToken = this.resolveWebhookToken(entry, existing, ref, run)
    await this.assertWebhookTokenFree(repos.plugin, entry.id, webhookToken)

    const plugin = existing ?? repos.plugin.create({ id: entry.id })
    plugin.name = parsed.name
    plugin.description = parsed.description
    plugin.kind = entry.kind
    plugin.refreshInterval = parsed.refreshInterval
    plugin.webhookToken = webhookToken
    plugin.mergeStrategy = entry.mergeStrategy
    plugin.streamLimit = entry.streamLimit
    plugin.sourceRecipeId = entry.sourceRecipeId ?? parsed.sourceRecipeId ?? undefined
    plugin.sourceRecipeSnapshot = entry.sourceRecipeSnapshot ? { ...entry.sourceRecipeSnapshot } : null

    const saved = await repos.plugin.save(plugin)
    this.bump(run, 'plugins', !existing)

    await this.upsertPluginDataSources(repos.dataSource, saved, parsed.dataSources, entry.dataSources, ref, run)
    await this.upsertPluginTemplates(repos.template, saved, parsed.templates, entry.templates, run)
    const fields = await this.upsertPluginFields(repos.field, saved, parsed.fields, entry.fields, run)
    await this.upsertFieldValues(repos.fieldValue, saved, fields, entry.fieldValues, ref, run)
  }

  private async assertWebhookTokenFree(repo: Repository<Plugin>, pluginId: string, webhookToken: string | null): Promise<void> {
    if (!webhookToken) {
      return
    }
    const holder = await repo.findOneBy({ webhookToken })
    if (holder && holder.id !== pluginId) {
      throw new Error(`its Webhook Token is already in use by a different Plugin (${holder.id})`)
    }
  }

  /** A redacted webhookToken keeps the target Plugin's value when one is set, otherwise a fresh one is minted and the external sender must be updated (ADR-0028). */
  private resolveWebhookToken(entry: PluginManifestEntry, existing: Plugin | null, ref: Ref, run: ImportRun): string | null {
    if (entry.webhookToken !== CONFIGURATION_REDACTION_SENTINEL) {
      return entry.webhookToken
    }
    return this.resolveRedactedField(Boolean(existing?.webhookToken), existing?.webhookToken ?? null, () => generateApikey(), { kind: 'webhook-token-redacted', plugin: ref }, run)
  }

  private async upsertPluginDataSources(repo: Repository<PluginDataSource>, plugin: Plugin, parsedSources: ParsedDataSource[], manifestEntries: PluginManifestDataSource[], ref: Ref, run: ImportRun): Promise<void> {
    const idByName = new Map(manifestEntries.map(e => [e.name, e.id]))

    for (const [index, parsedSource] of parsedSources.entries()) {
      const id = idByName.get(parsedSource.name) ?? randomUUID()
      const existing = await repo.findOneBy({ id })
      const dataSource = existing ?? repo.create({ id })
      dataSource.name = parsedSource.name
      dataSource.mode = parsedSource.mode
      dataSource.method = parsedSource.method ?? 'GET'
      dataSource.url = parsedSource.url ?? null
      dataSource.headers = this.resolveHeaders(ref, parsedSource, existing, run)
      dataSource.body = parsedSource.body
      dataSource.transformJs = parsedSource.transformJs ?? null
      dataSource.literalValue = parsedSource.literalValue ?? null
      dataSource.order = index
      dataSource.plugin = plugin
      await repo.save(dataSource)
      this.bump(run, 'dataSources', !existing)
    }
  }

  /** A redacted header value keeps the target Data Source's current value for that header name when set, otherwise the header is dropped (ADR-0028). */
  private resolveHeaders(plugin: Ref, parsedSource: ParsedDataSource, existing: PluginDataSource | null, run: ImportRun): Record<string, string> | undefined {
    if (!parsedSource.headers) {
      return parsedSource.headers
    }
    const existingHeaders = existing?.headers ?? {}
    const resolved: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsedSource.headers)) {
      if (value !== CONFIGURATION_REDACTION_SENTINEL) {
        resolved[key] = value
        continue
      }
      if (Object.hasOwn(existingHeaders, key)) {
        resolved[key] = existingHeaders[key]
        continue
      }
      run.warnings.push({ kind: 'header-redacted', plugin, dataSource: parsedSource.name, header: key })
    }
    return resolved
  }

  private async upsertPluginTemplates(repo: Repository<PluginTemplate>, plugin: Plugin, parsedTemplates: ParsedPlugin['templates'], manifestEntries: PluginManifestTemplate[], run: ImportRun): Promise<void> {
    const idByLayout = new Map(manifestEntries.map(e => [e.layout, e.id]))

    for (const parsedTemplate of parsedTemplates) {
      const id = idByLayout.get(parsedTemplate.layout) ?? randomUUID()
      // A Plugin has one Template per size, so the stored one of this size is the one to replace, whatever its id.
      const existing = await repo.findOneBy({ id }) ?? await repo.findOneBy({ plugin: { id: plugin.id }, layout: parsedTemplate.layout })
      const template = existing ?? repo.create({ id })
      template.layout = parsedTemplate.layout
      template.liquidMarkup = parsedTemplate.liquidMarkup
      template.plugin = plugin
      await repo.save(template)
      this.bump(run, 'templates', !existing)
    }
  }

  private async upsertPluginFields(repo: Repository<PluginField>, plugin: Plugin, parsedFields: ParsedPlugin['fields'], manifestEntries: PluginManifestField[], run: ImportRun): Promise<PluginField[]> {
    const idByKeyname = new Map(manifestEntries.map(e => [e.keyname, e.id]))
    const saved: PluginField[] = []

    for (const parsedField of parsedFields) {
      const id = idByKeyname.get(parsedField.keyname) ?? randomUUID()
      const existing = await repo.findOneBy({ id })
      const field = existing ?? repo.create({ id })
      field.keyname = parsedField.keyname
      field.fieldType = parsedField.fieldType
      field.name = parsedField.name
      field.description = parsedField.description
      field.defaultValue = parsedField.defaultValue
      field.options = parsedField.options ?? null
      field.required = parsedField.required
      field.order = parsedField.order
      field.plugin = plugin
      saved.push(await repo.save(field))
      this.bump(run, 'fields', !existing)
    }
    return saved
  }

  /** A redacted (password-type) Field Value keeps the target Plugin Field's value when one is stored, otherwise the Plugin Field is left without a value (ADR-0028, ADR-0032). */
  private async upsertFieldValues(repo: Repository<PluginFieldValue>, plugin: Plugin, fields: PluginField[], fieldValues: Record<string, string> | undefined, ref: Ref, run: ImportRun): Promise<void> {
    for (const [keyname, value] of Object.entries(fieldValues ?? {})) {
      const field = fields.find(candidate => candidate.keyname === keyname)
      if (!field) {
        run.warnings.push({ kind: 'field-value-without-field', plugin: ref, keyname })
        continue
      }

      // An empty value is no value: the Plugin Field's default applies, as on a save.
      if (!value) {
        continue
      }

      const existing = await repo.findOne({ where: { field: { id: field.id } } })
      if (value === CONFIGURATION_REDACTION_SENTINEL) {
        if (!existing) {
          run.warnings.push({ kind: 'field-value-redacted', plugin: ref, keyname, label: field.name })
        }
        continue
      }

      const fieldValue = existing ?? repo.create({ plugin, field })
      fieldValue.value = value
      await repo.save(fieldValue)
      this.bump(run, 'fieldValues', !existing)
    }
  }

  private async upsertAssignment(repos: TransactionRepos, entry: AssignmentManifestEntry, deviceIdRemap: Map<string, string>, run: ImportRun): Promise<void> {
    const deviceId = deviceIdRemap.get(entry.deviceId) ?? entry.deviceId

    const existing = await repos.devicePlugin.findOneBy({ id: entry.id })
    const assignment = existing ?? repos.devicePlugin.create({ id: entry.id })
    assignment.device = { id: deviceId } as Device
    assignment.plugin = { id: entry.pluginId } as Plugin
    assignment.order = entry.order
    assignment.isActive = entry.isActive
    await repos.devicePlugin.save(assignment)
    this.bump(run, 'assignments', !existing)
  }

  private async upsertScreen(repos: TransactionRepos, zip: AdmZip, entry: ScreenManifestEntry, deviceIdRemap: Map<string, string>, run: ImportRun): Promise<void> {
    const deviceId = deviceIdRemap.get(entry.deviceId) ?? entry.deviceId

    const screen = await this.saveScreenRow(repos, entry, deviceId, run)

    if (entry.type === 'file' && !run.checkOnly) {
      await this.restoreScreenImage(zip, entry.id, deviceId)
    }

    if (entry.schedule) {
      await this.upsertScheduleForScreen(repos.schedule, entry.schedule, screen, run)
    }

    if (entry.mashupConfiguration) {
      await this.upsertMashupForScreen(repos, entry.mashupConfiguration, screen, run)
    }
  }

  private async saveScreenRow(repos: TransactionRepos, entry: ScreenManifestEntry, deviceId: string, run: ImportRun): Promise<Screen> {
    const existing = await repos.screen.findOneBy({ id: entry.id })
    const screen = existing ?? repos.screen.create({ id: entry.id })
    screen.device = { id: deviceId } as Device
    screen.type = entry.type
    screen.order = entry.order
    screen.filename = entry.filename
    screen.externalLink = entry.externalLink
    screen.html = entry.html
    screen.fetchManual = entry.fetchManual
    screen.plugin = entry.pluginId ? ({ id: entry.pluginId } as Plugin) : null
    screen.devicePluginId = entry.devicePluginId
    // The restored Screen's render is stale until the next poll recomputes it (ADR-0021).
    screen.isActive = false
    screen.generatedAt = new Date()
    screen.cachedPluginOutput = null
    const saved = await repos.screen.save(screen)
    this.bump(run, 'screens', !existing)
    return saved
  }

  private async upsertScheduleForScreen(repo: Repository<Schedule>, scheduleEntry: NonNullable<ScreenManifestEntry['schedule']>, screen: Screen, run: ImportRun): Promise<void> {
    const existingSchedule = await repo.findOneBy({ id: scheduleEntry.id })
    const schedule = existingSchedule ?? repo.create({ id: scheduleEntry.id })
    schedule.enabled = scheduleEntry.enabled
    schedule.weekdays = scheduleEntry.weekdays
    schedule.startTime = scheduleEntry.startTime
    schedule.endTime = scheduleEntry.endTime
    schedule.startDate = scheduleEntry.startDate
    schedule.endDate = scheduleEntry.endDate
    schedule.screen = { id: screen.id } as Screen
    await repo.save(schedule)
    this.bump(run, 'schedules', !existingSchedule)
  }

  private async upsertMashupForScreen(repos: TransactionRepos, mashupEntry: NonNullable<ScreenManifestEntry['mashupConfiguration']>, screen: Screen, run: ImportRun): Promise<void> {
    const existingMashup = await repos.mashupConfig.findOneBy({ id: mashupEntry.id })
    const mashup = existingMashup ?? repos.mashupConfig.create({ id: mashupEntry.id })
    mashup.layout = mashupEntry.layout
    mashup.screen = { id: screen.id } as Screen
    await repos.mashupConfig.save(mashup)
    this.bump(run, 'mashupConfigurations', !existingMashup)

    for (const slotEntry of mashupEntry.slots) {
      const existingSlot = await repos.mashupSlot.findOneBy({ id: slotEntry.id })
      const slot = existingSlot ?? repos.mashupSlot.create({ id: slotEntry.id })
      slot.position = slotEntry.position
      slot.size = slotEntry.size
      slot.order = slotEntry.order
      slot.plugin = { id: slotEntry.pluginId } as Plugin
      slot.mashupConfiguration = { id: mashup.id } as MashupConfiguration
      await repos.mashupSlot.save(slot)
      this.bump(run, 'mashupSlots', !existingSlot)
    }
  }

  private async restoreScreenImage(zip: AdmZip, screenId: string, deviceId: string): Promise<void> {
    const imageEntry = zip.getEntries().find(e => !e.isDirectory && e.entryName.startsWith(`screens/${screenId}/`))
    if (!imageEntry) {
      return
    }
    const destDir = resolveAppPath('public', 'screens', 'devices', deviceId)
    await fs.promises.mkdir(destDir, { recursive: true })
    await fs.promises.writeFile(path.join(destDir, `${screenId}.png`), imageEntry.getData())
  }
}
