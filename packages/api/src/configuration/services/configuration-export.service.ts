import type { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import type { ParsedPlugin } from '../../plugins/services/plugin-importer.service.js'
import type { Schedule } from '../../schedule/schedule.entity.js'
import type {
  AssignmentFieldValueManifestEntry,
  AssignmentManifestEntry,
  DeviceManifestEntry,
  FirmwareManifestEntry,
  InstanceSettingsManifestEntry,
  MashupConfigurationManifestEntry,
  PaletteManifestEntry,
  PluginManifestEntry,
  PluginManifestVariable,
  ScheduleManifestEntry,
  ScreenManifestEntry,
} from '../types.js'
import { Buffer } from 'node:buffer'
import { existsSync, readFileSync } from 'node:fs'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import AdmZip from 'adm-zip'
import { CONFIGURATION_REDACTION_SENTINEL, SETTING_KEYS } from 'kuroshiro-shared'
import { Repository } from 'typeorm'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import { PluginVariable } from '../../plugins/entities/plugin-variable.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { INSTANCE_SETTINGS_ID, InstanceSettings } from '../../settings/entities/instance-settings.entity.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { getApiVersion } from '../get-api-version.js'
import { CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { CONFIG_ARCHIVE_FILES } from '../types.js'

@Injectable()
export class ConfigurationExportService {
  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    @InjectRepository(DevicePlugin)
    private readonly devicePluginRepository: Repository<DevicePlugin>,
    @InjectRepository(PluginFieldValue)
    private readonly fieldValueRepository: Repository<PluginFieldValue>,
    @InjectRepository(Palette)
    private readonly paletteRepository: Repository<Palette>,
    @InjectRepository(Firmware)
    private readonly firmwareRepository: Repository<Firmware>,
    @InjectRepository(InstanceSettings)
    private readonly instanceSettingsRepository: Repository<InstanceSettings>,
    private readonly pluginExporter: PluginExporterService,
  ) {}

  async exportToZip(options: { redact?: boolean } = {}): Promise<Buffer> {
    const redact = options.redact ?? false
    const zip = new AdmZip()

    const [plugins, devices, screens, assignments, fieldValues, palettes, firmware, instanceSettings] = await Promise.all([
      this.pluginRepository.find({ relations: { dataSources: true, templates: true, fields: true, variables: true } }),
      this.deviceRepository.find(),
      this.screenRepository.find({ relations: { device: true, plugin: true, schedule: true, mashupConfiguration: { slots: { plugin: true } } } }),
      this.devicePluginRepository.find({ relations: { device: true, plugin: true } }),
      this.fieldValueRepository.find({ relations: { field: true, plugin: true, device: true } }),
      this.paletteRepository.find({ where: { kind: 'custom' } }),
      this.firmwareRepository.find({ where: { kind: 'custom' } }),
      this.instanceSettingsRepository.findOneBy({ id: INSTANCE_SETTINGS_ID }),
    ])

    this.addJson(zip, CONFIG_ARCHIVE_FILES.manifest, this.buildManifest(redact))

    for (const plugin of plugins) {
      for (const entry of this.pluginExporter.buildEntries(redact ? this.withRedactedHeaders(plugin) : plugin)) {
        zip.addFile(`plugins/${plugin.id}/${entry.path}`, entry.content)
      }
    }
    this.addJson(zip, CONFIG_ARCHIVE_FILES.plugins, plugins.map(plugin => this.buildPluginEntry(plugin, redact)))

    this.addJson(zip, CONFIG_ARCHIVE_FILES.devices, devices.map(device => this.buildDeviceEntry(device, redact)))

    const screenEntries: ScreenManifestEntry[] = []
    for (const screen of screens) {
      screenEntries.push(this.buildScreenEntry(screen))
      this.addScreenImage(zip, screen)
    }
    this.addJson(zip, CONFIG_ARCHIVE_FILES.screens, screenEntries)

    this.addJson(zip, CONFIG_ARCHIVE_FILES.assignments, assignments.map(assignment => this.buildAssignmentEntry(assignment, fieldValues)))

    this.addJson(zip, CONFIG_ARCHIVE_FILES.palettes, palettes.map(palette => this.buildPaletteEntry(palette)))

    this.addJson(zip, CONFIG_ARCHIVE_FILES.firmware, firmware.map(fw => this.buildFirmwareEntry(fw)))

    this.addJson(zip, CONFIG_ARCHIVE_FILES.settings, this.buildSettingsEntry(instanceSettings))

    return zip.toBuffer()
  }

  private buildManifest(redact: boolean) {
    return {
      kuroshiroVersion: getApiVersion(),
      schemaVersion: CONFIG_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      containsSecrets: !redact,
      ...(redact ? { redacted: true as const } : {}),
    }
  }

  /** A shallow clone whose Data Source header *values* are replaced by the Redaction Sentinel, for `buildEntries` to write into the archive's nested `.trmnlp` — the standalone per-Plugin export/import never sees this clone (ADR-0028). */
  private withRedactedHeaders(plugin: Plugin): Plugin {
    return {
      ...plugin,
      dataSources: (plugin.dataSources || []).map(ds => ({
        ...ds,
        headers: ds.headers && Object.fromEntries(Object.keys(ds.headers).map(key => [key, CONFIGURATION_REDACTION_SENTINEL])),
      })),
    }
  }

  private buildPluginEntry(plugin: Plugin, redact: boolean): PluginManifestEntry {
    return {
      id: plugin.id,
      kind: plugin.kind,
      mergeStrategy: plugin.mergeStrategy ?? null,
      streamLimit: plugin.streamLimit ?? null,
      webhookToken: this.redactWebhookToken(plugin.webhookToken, redact),
      sourceRecipeId: plugin.sourceRecipeId ?? null,
      sourceRecipeSnapshot: this.redactSnapshotHeaders(plugin.sourceRecipeSnapshot as ParsedPlugin | null | undefined, redact),
      dataSources: (plugin.dataSources || []).map(ds => ({ id: ds.id, name: ds.name })),
      templates: (plugin.templates || []).map(template => ({ id: template.id, layout: template.layout })),
      fields: (plugin.fields || []).map(field => ({ id: field.id, keyname: field.keyname })),
      variables: (plugin.variables || []).map(variable => this.buildVariableEntry(variable, redact)),
    }
  }

  private redactWebhookToken(webhookToken: string | null | undefined, redact: boolean): string | null {
    return redact && webhookToken ? CONFIGURATION_REDACTION_SENTINEL : (webhookToken ?? null)
  }

  /** A Recipe Snapshot can carry a Data Source's header values as they stood at import time — redact them the same way `withRedactedHeaders` does for the live Plugin, so a Redacted Archive doesn't leak recipe-time secrets through the snapshot (ADR-0028, ADR-0030). */
  private redactSnapshotHeaders(snapshot: ParsedPlugin | null | undefined, redact: boolean): ParsedPlugin | null {
    if (!snapshot) {
      return null
    }
    if (!redact) {
      return snapshot
    }
    return {
      ...snapshot,
      dataSources: (snapshot.dataSources || []).map(ds => ({
        ...ds,
        headers: ds.headers && Object.fromEntries(Object.keys(ds.headers).map(key => [key, CONFIGURATION_REDACTION_SENTINEL])),
      })),
    }
  }

  private buildVariableEntry(variable: PluginVariable, redact: boolean): PluginManifestVariable {
    return {
      id: variable.id,
      key: variable.key,
      value: redact && variable.isSecret ? CONFIGURATION_REDACTION_SENTINEL : variable.value,
      isSecret: variable.isSecret,
    }
  }

  private buildDeviceEntry(device: Device, redact: boolean): DeviceManifestEntry {
    return {
      id: device.id,
      name: device.name,
      friendlyId: device.friendlyId,
      mac: device.mac,
      apikey: redact ? CONFIGURATION_REDACTION_SENTINEL : device.apikey,
      refreshRate: device.refreshRate,
      deviceModelName: device.deviceModel?.name ?? null,
      paletteId: device.palette?.id ?? null,
      ...this.buildDeviceMirrorFields(device, redact),
      ...this.buildDeviceSleepFields(device),
      targetFirmwareId: device.targetFirmware?.id ?? null,
    }
  }

  private buildDeviceMirrorFields(device: Device, redact: boolean): Pick<DeviceManifestEntry, 'mirrorEnabled' | 'mirrorMac' | 'mirrorApikey'> {
    return {
      mirrorEnabled: device.mirrorEnabled ?? null,
      mirrorMac: device.mirrorMac ?? null,
      mirrorApikey: redact && device.mirrorApikey ? CONFIGURATION_REDACTION_SENTINEL : (device.mirrorApikey ?? null),
    }
  }

  private buildDeviceSleepFields(device: Device): Pick<DeviceManifestEntry, 'sleepModeEnabled' | 'sleepStartTime' | 'sleepEndTime' | 'sleepScreenEnabled'> {
    return {
      sleepModeEnabled: device.sleepModeEnabled,
      sleepStartTime: device.sleepStartTime ?? null,
      sleepEndTime: device.sleepEndTime ?? null,
      sleepScreenEnabled: device.sleepScreenEnabled,
    }
  }

  private buildScreenEntry(screen: Screen): ScreenManifestEntry {
    return {
      id: screen.id,
      deviceId: screen.device.id,
      type: screen.type,
      order: screen.order,
      filename: screen.filename ?? null,
      externalLink: screen.externalLink ?? null,
      html: screen.html ?? null,
      fetchManual: screen.fetchManual,
      pluginId: screen.plugin?.id ?? null,
      devicePluginId: screen.devicePluginId ?? null,
      schedule: screen.schedule ? this.buildScheduleEntry(screen.schedule) : null,
      mashupConfiguration: screen.mashupConfiguration ? this.buildMashupEntry(screen.mashupConfiguration) : null,
    }
  }

  private buildScheduleEntry(schedule: Schedule): ScheduleManifestEntry {
    return {
      id: schedule.id,
      enabled: schedule.enabled,
      weekdays: schedule.weekdays ?? null,
      startTime: schedule.startTime ?? null,
      endTime: schedule.endTime ?? null,
      startDate: schedule.startDate ?? null,
      endDate: schedule.endDate ?? null,
    }
  }

  private buildMashupEntry(mashup: MashupConfiguration): MashupConfigurationManifestEntry {
    return {
      id: mashup.id,
      layout: mashup.layout,
      slots: (mashup.slots || []).map(slot => ({
        id: slot.id,
        position: slot.position,
        size: slot.size,
        order: slot.order,
        pluginId: slot.plugin.id,
      })),
    }
  }

  private addScreenImage(zip: AdmZip, screen: Screen): void {
    if (screen.type !== 'file') {
      return
    }
    const imagePath = resolveAppPath('public', 'screens', 'devices', screen.device.id, `${screen.id}.png`)
    if (!existsSync(imagePath)) {
      return
    }
    zip.addFile(`screens/${screen.id}/${screen.filename ?? `${screen.id}.png`}`, readFileSync(imagePath))
  }

  private buildAssignmentEntry(assignment: DevicePlugin, fieldValues: PluginFieldValue[]): AssignmentManifestEntry {
    const values: AssignmentFieldValueManifestEntry[] = fieldValues
      .filter(fieldValue => fieldValue.plugin.id === assignment.plugin.id && fieldValue.device?.id === assignment.device.id)
      .map(fieldValue => ({ id: fieldValue.id, fieldId: fieldValue.field.id, value: fieldValue.value }))

    return {
      id: assignment.id,
      deviceId: assignment.device.id,
      pluginId: assignment.plugin.id,
      order: assignment.order,
      isActive: assignment.isActive,
      fieldValues: values,
    }
  }

  private buildPaletteEntry(palette: Palette): PaletteManifestEntry {
    return {
      id: palette.id,
      name: palette.name,
      kind: 'custom',
      grays: palette.grays,
      colors: palette.colors ?? null,
      frameworkClass: palette.frameworkClass,
      grayscaleBitDepth: palette.grayscaleBitDepth ?? null,
      deprecated: palette.deprecated,
    }
  }

  /** Only the overridden Settings (ADR-0027) — fallback values (env/built-in default) are never exported. */
  private buildSettingsEntry(instanceSettings: InstanceSettings | null): InstanceSettingsManifestEntry {
    const entry: InstanceSettingsManifestEntry = {}
    if (!instanceSettings)
      return entry
    for (const key of SETTING_KEYS) {
      const value = instanceSettings[key]
      if (value != null)
        entry[key] = value
    }
    return entry
  }

  private buildFirmwareEntry(firmware: Firmware): FirmwareManifestEntry {
    return {
      id: firmware.id,
      version: firmware.version,
      checksum: firmware.checksum,
      compatibleModels: firmware.compatibleModels,
      label: firmware.label ?? null,
      deprecated: firmware.deprecated,
      uploadedAt: firmware.uploadedAt ? firmware.uploadedAt.toISOString() : null,
    }
  }

  private addJson(zip: AdmZip, filename: string, value: unknown): void {
    zip.addFile(filename, Buffer.from(JSON.stringify(value, null, 2), 'utf8'))
  }
}
