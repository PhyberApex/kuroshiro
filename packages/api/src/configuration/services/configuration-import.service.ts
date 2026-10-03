import type { ConfigurationImportSummary } from 'kuroshiro-shared'
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
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { BOOLEAN_SETTING_KEYS, CONFIGURATION_REDACTION_SENTINEL, SETTING_KEYS } from 'kuroshiro-shared'
import { DeviceModel } from '../../device-models/entities/device-model.entity.js'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
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
import generateApikey from '../../utils/generateApikey.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { CONFIG_SCHEMA_VERSION, PREVIOUS_CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { CONFIG_ARCHIVE_FILES } from '../types.js'

interface ImportCounts {
  created: Record<string, number>
  updated: Record<string, number>
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

@Injectable()
export class ConfigurationImportService {
  private readonly logger = new Logger(ConfigurationImportService.name)

  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    private readonly pluginImporter: PluginImporterService,
  ) {}

  async importFromZip(buffer: Buffer): Promise<ConfigurationImportSummary> {
    const zip = new AdmZip(buffer)

    const manifest = this.readManifest(zip)
    this.assertSchemaVersion(manifest)

    const pluginEntries = this.readJson<Array<PluginManifestEntry & LegacyPluginManifestFields>>(zip, CONFIG_ARCHIVE_FILES.plugins)
    const deviceEntries = this.readJson<DeviceManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.devices)
    const screenEntries = this.readJson<ScreenManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.screens)
    const assignmentEntries = this.readJson<Array<AssignmentManifestEntry & LegacyAssignmentManifestFields>>(zip, CONFIG_ARCHIVE_FILES.assignments)
    const paletteEntries = this.readJson<PaletteManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.palettes)
    const firmwareEntries = this.readJson<FirmwareManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.firmware)
    const settingsEntry = this.readJson<InstanceSettingsManifestEntry>(zip, CONFIG_ARCHIVE_FILES.settings)

    const counts: ImportCounts = { created: {}, updated: {} }
    const warnings: string[] = manifest.schemaVersion === PREVIOUS_CONFIG_SCHEMA_VERSION
      ? this.legacyContentWarnings(pluginEntries, assignmentEntries)
      : []

    await this.pluginRepository.manager.transaction(async (manager) => {
      const repos = this.reposFor(manager)

      for (const entry of paletteEntries) {
        await this.withEntryContext(`Palette ${entry.id}`, () => this.upsertPalette(repos.palette, entry, counts))
      }

      for (const entry of firmwareEntries) {
        await this.withEntryContext(`Firmware ${entry.id}`, () => this.upsertFirmware(repos.firmware, entry, counts))
      }

      // Insertion order follows the archive's foreign keys (ADR-0021): Palettes,
      // Firmware, Plugins, then Devices (which may reference either), then
      // DevicePlugins/Screens (which reference Devices and Plugins).
      for (const entry of pluginEntries) {
        await this.withEntryContext(`Plugin ${entry.id}`, () => this.upsertPlugin(repos, zip, entry, counts, warnings))
      }

      const deviceIdRemap = new Map<string, string>()
      for (const entry of deviceEntries) {
        const dbId = await this.withEntryContext(`Device ${entry.id}`, () => this.upsertDevice(repos, entry, counts, warnings))
        if (dbId !== entry.id) {
          deviceIdRemap.set(entry.id, dbId)
        }
      }

      for (const entry of assignmentEntries) {
        await this.withEntryContext(`Assignment ${entry.id}`, () => this.upsertAssignment(repos, entry, deviceIdRemap, counts))
      }

      for (const entry of screenEntries) {
        await this.withEntryContext(`Screen ${entry.id}`, () => this.upsertScreen(repos, zip, entry, deviceIdRemap, counts))
      }

      await this.withEntryContext('Instance Settings', () => this.replaceInstanceSettings(repos.instanceSettings, settingsEntry))
    })

    return { created: counts.created, updated: counts.updated, warnings }
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

  /** Runs one entity's upsert, and if it throws, labels the error with the entity so a failed import's response says which entry broke the transaction (ADR-0021). Passes a `BadRequestException` through unchanged since those already carry their own specific message. */
  private async withEntryContext<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    }
    catch (err) {
      if (err instanceof BadRequestException) {
        throw err
      }
      const message = err instanceof Error ? err.message : String(err)
      throw new BadRequestException(`Failed to import ${label}: ${message}`)
    }
  }

  private readManifest(zip: AdmZip): ConfigurationManifest {
    const entry = zip.getEntry(CONFIG_ARCHIVE_FILES.manifest)
    if (!entry) {
      throw new BadRequestException(`${CONFIG_ARCHIVE_FILES.manifest} not found in archive; this Kuroshiro instance expects schemaVersion ${CONFIG_SCHEMA_VERSION}`)
    }
    try {
      return JSON.parse(entry.getData().toString('utf8')) as ConfigurationManifest
    }
    catch {
      throw new BadRequestException(`${CONFIG_ARCHIVE_FILES.manifest} is not valid JSON`)
    }
  }

  private assertSchemaVersion(manifest: ConfigurationManifest): void {
    if (manifest.schemaVersion !== CONFIG_SCHEMA_VERSION && manifest.schemaVersion !== PREVIOUS_CONFIG_SCHEMA_VERSION) {
      throw new BadRequestException(
        `Archive schemaVersion is ${manifest.schemaVersion ?? 'missing'}, but this Kuroshiro instance expects schemaVersion ${CONFIG_SCHEMA_VERSION}`,
      )
    }
  }

  /** A schemaVersion 2 archive's Plugin Variables and per-Assignment Field Values have nowhere to go (ADR-0032); say so only when it actually held some. */
  private legacyContentWarnings(pluginEntries: LegacyPluginManifestFields[], assignmentEntries: LegacyAssignmentManifestFields[]): string[] {
    const variableCount = pluginEntries.reduce((count, entry) => count + (entry.variables?.length ?? 0), 0)
    const fieldValueCount = assignmentEntries.reduce((count, entry) => count + (entry.fieldValues?.length ?? 0), 0)

    return [
      ...(variableCount > 0 ? [`This archive holds ${variableCount} Plugin Variable(s), which no longer exist; they were not imported`] : []),
      ...(fieldValueCount > 0 ? [`This archive holds ${fieldValueCount} Field Value(s) saved per Plugin Assignment; Field Values now belong to the Plugin, so they were not imported`] : []),
    ]
  }

  private readJson<T>(zip: AdmZip, filename: string): T {
    const entry = zip.getEntry(filename)
    if (!entry) {
      throw new BadRequestException(`${filename} not found in archive`)
    }
    return JSON.parse(entry.getData().toString('utf8')) as T
  }

  private bump(counts: ImportCounts, key: string, wasCreated: boolean): void {
    const bucket = wasCreated ? counts.created : counts.updated
    bucket[key] = (bucket[key] ?? 0) + 1
  }

  private async upsertPalette(repo: Repository<Palette>, entry: PaletteManifestEntry, counts: ImportCounts): Promise<void> {
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
    this.bump(counts, 'palettes', !existing)
  }

  private async upsertFirmware(repo: Repository<Firmware>, entry: FirmwareManifestEntry, counts: ImportCounts): Promise<void> {
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
    this.bump(counts, 'firmware', !existing)
  }

  private async resolveDeviceModel(repo: Repository<DeviceModel>, name: string | null, warnings: string[]): Promise<DeviceModel | null> {
    if (!name) {
      return null
    }
    const model = await repo.findOneBy({ name })
    if (!model) {
      warnings.push(`Device Model "${name}" was not found; a Device referencing it was imported without a Device Model`)
    }
    return model
  }

  private async resolvePalette(repo: Repository<Palette>, id: string | null, warnings: string[]): Promise<Palette | null> {
    if (!id) {
      return null
    }
    const palette = await repo.findOneBy({ id })
    if (!palette) {
      warnings.push(`Palette "${id}" was not found; a Device referencing it was imported without a Palette`)
    }
    return palette
  }

  private async resolveFirmware(repo: Repository<Firmware>, id: string | null, warnings: string[]): Promise<Firmware | null> {
    if (!id) {
      return null
    }
    const firmware = await repo.findOneBy({ id })
    if (!firmware) {
      warnings.push(`Firmware "${id}" was not found; a Device referencing it was imported without a target Firmware`)
    }
    return firmware
  }

  private async upsertDevice(repos: TransactionRepos, entry: DeviceManifestEntry, counts: ImportCounts, warnings: string[]): Promise<string> {
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

    device.name = entry.name
    device.friendlyId = entry.friendlyId
    device.mac = entry.mac
    // Hardware re-attached by mac already holds its own live apikey (minted by DeviceSetupService);
    // overwriting it with the archived value would desync the DB from what the physical device sends,
    // breaking its next /display poll. Only a brand-new or exact-id-match row takes the archived apikey.
    if (!reattachedByMac) {
      device.apikey = this.resolveDeviceApikey(entry, device, wasCreated, warnings)
    }
    device.refreshRate = entry.refreshRate
    device.deviceModel = await this.resolveDeviceModel(repos.deviceModel, entry.deviceModelName, warnings)
    device.palette = await this.resolvePalette(repos.palette, entry.paletteId, warnings)
    device.mirrorEnabled = entry.mirrorEnabled ?? undefined
    device.mirrorMac = entry.mirrorMac ?? undefined
    device.mirrorApikey = this.resolveMirrorApikey(entry, device, warnings)
    device.sleepModeEnabled = entry.sleepModeEnabled
    device.sleepStartTime = entry.sleepStartTime
    device.sleepEndTime = entry.sleepEndTime
    device.sleepScreenEnabled = entry.sleepScreenEnabled
    device.targetFirmware = await this.resolveFirmware(repos.firmware, entry.targetFirmwareId, warnings)

    const saved = await repos.device.save(device)
    this.bump(counts, 'devices', wasCreated)
    return saved.id
  }

  /** Shared recovery for a single redacted scalar field (ADR-0028): keeps `keptValue` when `keep` is true, otherwise warns and falls back. Not used for headers, which resolve per-key against a map rather than a single value. */
  private resolveRedactedField<T>(keep: boolean, keptValue: T, fallback: () => T, warningMessage: string, warnings: string[]): T {
    if (keep) {
      return keptValue
    }
    warnings.push(warningMessage)
    return fallback()
  }

  /** A redacted apikey keeps the target row's value when one exists; a brand-new Device gets a freshly minted one, as auto-registration would (ADR-0028). */
  private resolveDeviceApikey(entry: DeviceManifestEntry, device: Device, wasCreated: boolean, warnings: string[]): string {
    if (entry.apikey !== CONFIGURATION_REDACTION_SENTINEL) {
      return entry.apikey
    }
    return this.resolveRedactedField(
      !wasCreated,
      device.apikey,
      () => generateApikey(),
      `Device ${entry.id}: apikey was redacted and no existing value to keep; a new apikey was generated, so the hardware must re-pair`,
      warnings,
    )
  }

  /** A redacted mirrorApikey keeps the target row's value when one is set, otherwise falls back to unset (ADR-0028). */
  private resolveMirrorApikey(entry: DeviceManifestEntry, device: Device, warnings: string[]): string | undefined {
    if (entry.mirrorApikey !== CONFIGURATION_REDACTION_SENTINEL) {
      return entry.mirrorApikey ?? undefined
    }
    return this.resolveRedactedField(
      Boolean(device.mirrorApikey),
      device.mirrorApikey,
      () => undefined,
      `Device ${entry.id}: mirrorApikey was redacted and no existing value to keep; left unset`,
      warnings,
    )
  }

  /**
   * Extracts a `plugins/<id>/` folder into its own in-memory `.trmnlp` zip. The per-Plugin
   * exporter omits `src/settings.yml` entirely when the Plugin has no Data Sources (e.g.
   * every Webhook-kind Plugin), so a placeholder settings file is synthesized to satisfy
   * `parseZip`'s manifest+settings precondition — its content is never read for data
   * sources: `hasSettings` also drives `upsertPlugin` to pass `forcedDataSources: []`
   * rather than touching `PluginImporterService`'s shared parsing rules for real uploads.
   */
  private extractPluginZip(zip: AdmZip, pluginId: string): { zip: AdmZip, hasSettings: boolean } {
    const prefix = `plugins/${pluginId}/`
    const sub = new AdmZip()
    let hasSettings = false

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || !entry.entryName.startsWith(prefix)) {
        continue
      }
      const relativePath = entry.entryName.slice(prefix.length)
      if (relativePath === 'src/settings.yml') {
        hasSettings = true
      }
      sub.addFile(relativePath, entry.getData())
    }

    if (!hasSettings) {
      sub.addFile('src/settings.yml', Buffer.from(yaml.dump({}), 'utf8'))
    }

    return { zip: sub, hasSettings }
  }

  private async upsertPlugin(repos: TransactionRepos, zip: AdmZip, entry: PluginManifestEntry, counts: ImportCounts, warnings: string[]): Promise<void> {
    const existing = await repos.plugin.findOneBy({ id: entry.id })
    const webhookToken = this.resolveWebhookToken(entry, existing, warnings)

    if (webhookToken) {
      const conflict = await repos.plugin.findOneBy({ webhookToken })
      if (conflict && conflict.id !== entry.id) {
        throw new BadRequestException(`Plugin ${entry.id}: webhookToken is already in use by a different Plugin (${conflict.id})`)
      }
    }

    const { zip: subZip, hasSettings } = this.extractPluginZip(zip, entry.id)
    const parsed = this.pluginImporter.parseZip(subZip, entry.id, hasSettings ? undefined : [])

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
    this.bump(counts, 'plugins', !existing)

    await this.upsertPluginDataSources(repos.dataSource, saved, parsed.dataSources, entry.dataSources, counts, warnings)
    await this.upsertPluginTemplates(repos.template, saved, parsed.templates, entry.templates, counts)
    const fields = await this.upsertPluginFields(repos.field, saved, parsed.fields, entry.fields, counts)
    await this.upsertFieldValues(repos.fieldValue, saved, fields, entry.fieldValues, counts, warnings)
  }

  /** A redacted webhookToken keeps the target Plugin's value when one is set, otherwise a fresh one is minted and the external sender must be updated (ADR-0028). */
  private resolveWebhookToken(entry: PluginManifestEntry, existing: Plugin | null, warnings: string[]): string | null {
    if (entry.webhookToken !== CONFIGURATION_REDACTION_SENTINEL) {
      return entry.webhookToken
    }
    return this.resolveRedactedField(
      Boolean(existing?.webhookToken),
      existing?.webhookToken ?? null,
      () => generateApikey(),
      `Plugin ${entry.id}: webhookToken was redacted and no existing value to keep; a new webhookToken was generated, so the external sender must be updated`,
      warnings,
    )
  }

  private async upsertPluginDataSources(repo: Repository<PluginDataSource>, plugin: Plugin, parsedSources: ParsedDataSource[], manifestEntries: PluginManifestDataSource[], counts: ImportCounts, warnings: string[]): Promise<void> {
    const idByName = new Map(manifestEntries.map(e => [e.name, e.id]))

    for (const [index, parsedSource] of parsedSources.entries()) {
      const id = idByName.get(parsedSource.name) ?? randomUUID()
      const existing = await repo.findOneBy({ id })
      const dataSource = existing ?? repo.create({ id })
      dataSource.name = parsedSource.name
      dataSource.mode = parsedSource.mode
      dataSource.method = parsedSource.method ?? 'GET'
      dataSource.url = parsedSource.url ?? null
      dataSource.headers = this.resolveHeaders(plugin, parsedSource, existing, warnings)
      dataSource.body = parsedSource.body
      dataSource.transformJs = parsedSource.transformJs ?? null
      dataSource.literalValue = parsedSource.literalValue ?? null
      dataSource.order = index
      dataSource.plugin = plugin
      await repo.save(dataSource)
      this.bump(counts, 'dataSources', !existing)
    }
  }

  /** A redacted header value keeps the target Data Source's current value for that header name when set, otherwise the header is dropped (ADR-0028). */
  private resolveHeaders(plugin: Plugin, parsedSource: ParsedDataSource, existing: PluginDataSource | null, warnings: string[]): Record<string, string> | undefined {
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
      warnings.push(`Plugin ${plugin.id} Data Source "${parsedSource.name}": header "${key}" was redacted and no existing value to keep; dropped`)
    }
    return resolved
  }

  private async upsertPluginTemplates(repo: Repository<PluginTemplate>, plugin: Plugin, parsedTemplates: ParsedPlugin['templates'], manifestEntries: PluginManifestTemplate[], counts: ImportCounts): Promise<void> {
    const idByLayout = new Map(manifestEntries.map(e => [e.layout, e.id]))

    for (const parsedTemplate of parsedTemplates) {
      const id = idByLayout.get(parsedTemplate.layout) ?? randomUUID()
      const existing = await repo.findOneBy({ id })
      const template = existing ?? repo.create({ id })
      template.layout = parsedTemplate.layout
      template.liquidMarkup = parsedTemplate.liquidMarkup
      template.plugin = plugin
      await repo.save(template)
      this.bump(counts, 'templates', !existing)
    }
  }

  private async upsertPluginFields(repo: Repository<PluginField>, plugin: Plugin, parsedFields: ParsedPlugin['fields'], manifestEntries: PluginManifestField[], counts: ImportCounts): Promise<PluginField[]> {
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
      this.bump(counts, 'fields', !existing)
    }
    return saved
  }

  /** A redacted (password-type) Field Value keeps the target Plugin Field's value when one is stored, otherwise the Plugin Field is left without a value (ADR-0028, ADR-0032). */
  private async upsertFieldValues(repo: Repository<PluginFieldValue>, plugin: Plugin, fields: PluginField[], fieldValues: Record<string, string> | undefined, counts: ImportCounts, warnings: string[]): Promise<void> {
    for (const [keyname, value] of Object.entries(fieldValues ?? {})) {
      const field = fields.find(candidate => candidate.keyname === keyname)
      if (!field) {
        warnings.push(`Plugin ${plugin.id}: Field Value "${keyname}" has no Plugin Field of that keyname; dropped`)
        continue
      }

      const existing = await repo.findOne({ where: { field: { id: field.id } } })
      if (value === CONFIGURATION_REDACTION_SENTINEL) {
        if (!existing) {
          warnings.push(`Plugin ${plugin.id}: Field Value "${field.name}" was redacted and no existing value to keep; left empty`)
        }
        continue
      }

      const fieldValue = existing ?? repo.create({ plugin, field })
      fieldValue.value = value
      await repo.save(fieldValue)
      this.bump(counts, 'fieldValues', !existing)
    }
  }

  private async upsertAssignment(repos: TransactionRepos, entry: AssignmentManifestEntry, deviceIdRemap: Map<string, string>, counts: ImportCounts): Promise<void> {
    const deviceId = deviceIdRemap.get(entry.deviceId) ?? entry.deviceId

    const existing = await repos.devicePlugin.findOneBy({ id: entry.id })
    const assignment = existing ?? repos.devicePlugin.create({ id: entry.id })
    assignment.device = { id: deviceId } as Device
    assignment.plugin = { id: entry.pluginId } as Plugin
    assignment.order = entry.order
    assignment.isActive = entry.isActive
    await repos.devicePlugin.save(assignment)
    this.bump(counts, 'assignments', !existing)
  }

  private async upsertScreen(repos: TransactionRepos, zip: AdmZip, entry: ScreenManifestEntry, deviceIdRemap: Map<string, string>, counts: ImportCounts): Promise<void> {
    const deviceId = deviceIdRemap.get(entry.deviceId) ?? entry.deviceId

    const screen = await this.saveScreenRow(repos, entry, deviceId, counts)

    if (entry.type === 'file') {
      await this.restoreScreenImage(zip, entry.id, deviceId)
    }

    if (entry.schedule) {
      await this.upsertScheduleForScreen(repos.schedule, entry.schedule, screen, counts)
    }

    if (entry.mashupConfiguration) {
      await this.upsertMashupForScreen(repos, entry.mashupConfiguration, screen, counts)
    }
  }

  private async saveScreenRow(repos: TransactionRepos, entry: ScreenManifestEntry, deviceId: string, counts: ImportCounts): Promise<Screen> {
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
    this.bump(counts, 'screens', !existing)
    return saved
  }

  private async upsertScheduleForScreen(repo: Repository<Schedule>, scheduleEntry: NonNullable<ScreenManifestEntry['schedule']>, screen: Screen, counts: ImportCounts): Promise<void> {
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
    this.bump(counts, 'schedules', !existingSchedule)
  }

  private async upsertMashupForScreen(repos: TransactionRepos, mashupEntry: NonNullable<ScreenManifestEntry['mashupConfiguration']>, screen: Screen, counts: ImportCounts): Promise<void> {
    const existingMashup = await repos.mashupConfig.findOneBy({ id: mashupEntry.id })
    const mashup = existingMashup ?? repos.mashupConfig.create({ id: mashupEntry.id })
    mashup.layout = mashupEntry.layout
    mashup.screen = { id: screen.id } as Screen
    await repos.mashupConfig.save(mashup)
    this.bump(counts, 'mashupConfigurations', !existingMashup)

    for (const slotEntry of mashupEntry.slots) {
      const existingSlot = await repos.mashupSlot.findOneBy({ id: slotEntry.id })
      const slot = existingSlot ?? repos.mashupSlot.create({ id: slotEntry.id })
      slot.position = slotEntry.position
      slot.size = slotEntry.size
      slot.order = slotEntry.order
      slot.plugin = { id: slotEntry.pluginId } as Plugin
      slot.mashupConfiguration = { id: mashup.id } as MashupConfiguration
      await repos.mashupSlot.save(slot)
      this.bump(counts, 'mashupSlots', !existingSlot)
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
