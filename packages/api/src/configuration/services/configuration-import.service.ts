import type { ConfigurationImportSummary } from 'kuroshiro-shared'
import type { EntityManager, Repository } from 'typeorm'
import type { ParsedDataSource, ParsedPlugin } from '../../plugins/services/plugin-importer.service.js'
import type {
  AssignmentManifestEntry,
  ConfigurationManifest,
  DeviceManifestEntry,
  FirmwareManifestEntry,
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
import { PluginVariable } from '../../plugins/entities/plugin-variable.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { Schedule } from '../../schedule/schedule.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { CONFIG_SCHEMA_VERSION } from '../schema-version.js'
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
  variable: Repository<PluginVariable>
  device: Repository<Device>
  deviceModel: Repository<DeviceModel>
  devicePlugin: Repository<DevicePlugin>
  fieldValue: Repository<PluginFieldValue>
  screen: Repository<Screen>
  schedule: Repository<Schedule>
  mashupConfig: Repository<MashupConfiguration>
  mashupSlot: Repository<MashupSlot>
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

    const pluginEntries = this.readJson<PluginManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.plugins)
    const deviceEntries = this.readJson<DeviceManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.devices)
    const screenEntries = this.readJson<ScreenManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.screens)
    const assignmentEntries = this.readJson<AssignmentManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.assignments)
    const paletteEntries = this.readJson<PaletteManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.palettes)
    const firmwareEntries = this.readJson<FirmwareManifestEntry[]>(zip, CONFIG_ARCHIVE_FILES.firmware)

    const counts: ImportCounts = { created: {}, updated: {} }
    const warnings: string[] = []

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
        await this.withEntryContext(`Plugin ${entry.id}`, () => this.upsertPlugin(repos, zip, entry, counts))
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
      variable: manager.getRepository(PluginVariable),
      device: manager.getRepository(Device),
      deviceModel: manager.getRepository(DeviceModel),
      devicePlugin: manager.getRepository(DevicePlugin),
      fieldValue: manager.getRepository(PluginFieldValue),
      screen: manager.getRepository(Screen),
      schedule: manager.getRepository(Schedule),
      mashupConfig: manager.getRepository(MashupConfiguration),
      mashupSlot: manager.getRepository(MashupSlot),
    }
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
    if (manifest.schemaVersion !== CONFIG_SCHEMA_VERSION) {
      throw new BadRequestException(
        `Archive schemaVersion is ${manifest.schemaVersion ?? 'missing'}, but this Kuroshiro instance expects schemaVersion ${CONFIG_SCHEMA_VERSION}`,
      )
    }
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

    // Re-attach to hardware that already registered under a different id (ADR-0021).
    if (!device) {
      const macMatch = await repos.device.findOneBy({ mac: entry.mac })
      if (macMatch) {
        device = macMatch
        wasCreated = false
      }
    }

    if (!device) {
      device = repos.device.create({ id: entry.id })
    }

    device.name = entry.name
    device.friendlyId = entry.friendlyId
    device.mac = entry.mac
    device.apikey = entry.apikey
    device.refreshRate = entry.refreshRate
    device.deviceModel = await this.resolveDeviceModel(repos.deviceModel, entry.deviceModelName, warnings)
    device.palette = await this.resolvePalette(repos.palette, entry.paletteId, warnings)
    device.mirrorEnabled = entry.mirrorEnabled ?? undefined
    device.mirrorMac = entry.mirrorMac ?? undefined
    device.mirrorApikey = entry.mirrorApikey ?? undefined
    device.sleepModeEnabled = entry.sleepModeEnabled
    device.sleepStartTime = entry.sleepStartTime
    device.sleepEndTime = entry.sleepEndTime
    device.sleepScreenEnabled = entry.sleepScreenEnabled
    device.targetFirmware = await this.resolveFirmware(repos.firmware, entry.targetFirmwareId, warnings)

    const saved = await repos.device.save(device)
    this.bump(counts, 'devices', wasCreated)
    return saved.id
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

  private async upsertPlugin(repos: TransactionRepos, zip: AdmZip, entry: PluginManifestEntry, counts: ImportCounts): Promise<void> {
    if (entry.webhookToken) {
      const conflict = await repos.plugin.findOneBy({ webhookToken: entry.webhookToken })
      if (conflict && conflict.id !== entry.id) {
        throw new BadRequestException(`Plugin ${entry.id}: webhookToken is already in use by a different Plugin (${conflict.id})`)
      }
    }

    const { zip: subZip, hasSettings } = this.extractPluginZip(zip, entry.id)
    const parsed = this.pluginImporter.parseZip(subZip, entry.id, hasSettings ? undefined : [])

    const existing = await repos.plugin.findOneBy({ id: entry.id })
    const plugin = existing ?? repos.plugin.create({ id: entry.id })
    plugin.name = parsed.name
    plugin.description = parsed.description
    plugin.kind = entry.kind
    plugin.refreshInterval = parsed.refreshInterval
    plugin.webhookToken = entry.webhookToken
    plugin.mergeStrategy = entry.mergeStrategy
    plugin.streamLimit = entry.streamLimit
    plugin.sourceRecipeId = entry.sourceRecipeId ?? parsed.sourceRecipeId ?? undefined

    const saved = await repos.plugin.save(plugin)
    this.bump(counts, 'plugins', !existing)

    await this.upsertPluginDataSources(repos.dataSource, saved, parsed.dataSources, entry.dataSources, counts)
    await this.upsertPluginTemplates(repos.template, saved, parsed.templates, entry.templates, counts)
    await this.upsertPluginFields(repos.field, saved, parsed.fields, entry.fields, counts)
    await this.upsertPluginVariables(repos.variable, saved, entry.variables, counts)
  }

  private async upsertPluginDataSources(repo: Repository<PluginDataSource>, plugin: Plugin, parsedSources: ParsedDataSource[], manifestEntries: PluginManifestDataSource[], counts: ImportCounts): Promise<void> {
    const idByName = new Map(manifestEntries.map(e => [e.name, e.id]))

    for (const [index, parsedSource] of parsedSources.entries()) {
      const id = idByName.get(parsedSource.name) ?? randomUUID()
      const existing = await repo.findOneBy({ id })
      const dataSource = existing ?? repo.create({ id })
      dataSource.name = parsedSource.name
      dataSource.mode = parsedSource.mode
      dataSource.method = parsedSource.method ?? 'GET'
      dataSource.url = parsedSource.url ?? null
      dataSource.headers = parsedSource.headers
      dataSource.body = parsedSource.body
      dataSource.transformJs = parsedSource.transformJs ?? null
      dataSource.literalValue = parsedSource.literalValue ?? null
      dataSource.order = index
      dataSource.plugin = plugin
      await repo.save(dataSource)
      this.bump(counts, 'dataSources', !existing)
    }
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

  private async upsertPluginFields(repo: Repository<PluginField>, plugin: Plugin, parsedFields: ParsedPlugin['fields'], manifestEntries: PluginManifestField[], counts: ImportCounts): Promise<void> {
    const idByKeyname = new Map(manifestEntries.map(e => [e.keyname, e.id]))

    for (const parsedField of parsedFields) {
      const id = idByKeyname.get(parsedField.keyname) ?? randomUUID()
      const existing = await repo.findOneBy({ id })
      const field = existing ?? repo.create({ id })
      field.keyname = parsedField.keyname
      field.fieldType = parsedField.fieldType
      field.name = parsedField.name
      field.description = parsedField.description
      field.defaultValue = parsedField.defaultValue
      field.required = parsedField.required
      field.order = parsedField.order
      field.plugin = plugin
      await repo.save(field)
      this.bump(counts, 'fields', !existing)
    }
  }

  private async upsertPluginVariables(repo: Repository<PluginVariable>, plugin: Plugin, manifestVariables: PluginManifestEntry['variables'], counts: ImportCounts): Promise<void> {
    for (const entry of manifestVariables) {
      const existing = await repo.findOneBy({ id: entry.id })
      const variable = existing ?? repo.create({ id: entry.id })
      variable.key = entry.key
      variable.value = entry.value
      variable.isSecret = entry.isSecret
      variable.plugin = plugin
      await repo.save(variable)
      this.bump(counts, 'variables', !existing)
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

    for (const fieldValueEntry of entry.fieldValues) {
      const existingValue = await repos.fieldValue.findOneBy({ id: fieldValueEntry.id })
      const fieldValue = existingValue ?? repos.fieldValue.create({ id: fieldValueEntry.id })
      fieldValue.value = fieldValueEntry.value
      fieldValue.plugin = { id: entry.pluginId } as Plugin
      fieldValue.field = { id: fieldValueEntry.fieldId } as PluginField
      fieldValue.device = { id: deviceId } as Device
      await repos.fieldValue.save(fieldValue)
      this.bump(counts, 'fieldValues', !existingValue)
    }
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
