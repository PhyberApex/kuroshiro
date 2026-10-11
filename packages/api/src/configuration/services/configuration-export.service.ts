import type { DeviceManifestEntry, ScreenManifestEntry } from '../types.js'
import { Buffer } from 'node:buffer'
import { existsSync, readFileSync } from 'node:fs'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import AdmZip from 'adm-zip'
import { Repository } from 'typeorm'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { sleepImageOriginalPath, sleepImagePath } from '../../devices/device-sleep-image.service.js'
import { Device } from '../../devices/devices.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { INSTANCE_SETTINGS_ID, InstanceSettings } from '../../settings/entities/instance-settings.entity.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { getApiVersion } from '../get-api-version.js'
import { CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { CONFIG_ARCHIVE_FILES } from '../types.js'
import {
  buildAssignmentEntry,
  buildDeviceEntry,
  buildFirmwareEntry,
  buildPaletteEntry,
  buildPluginEntry,
  buildScreenEntry,
  buildSettingsEntry,
  withRedactedHeaders,
} from './configuration-export.mapper.js'

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
    @InjectRepository(Palette)
    private readonly paletteRepository: Repository<Palette>,
    @InjectRepository(Firmware)
    private readonly firmwareRepository: Repository<Firmware>,
    @InjectRepository(InstanceSettings)
    private readonly instanceSettingsRepository: Repository<InstanceSettings>,
    private readonly pluginExporter: PluginExporterService,
    private readonly fieldValues: PluginFieldValuesService,
  ) {}

  async exportToZip(options: { redact?: boolean } = {}): Promise<Buffer> {
    const redact = options.redact ?? false
    const zip = new AdmZip()

    const [plugins, devices, screens, assignments, palettes, firmware, instanceSettings] = await Promise.all([
      this.pluginRepository.find({ relations: { dataSources: true, templates: true, fields: true } }),
      this.deviceRepository.find(),
      this.screenRepository.find({ relations: { device: true, plugin: true, schedule: true, mashupConfiguration: { slots: { plugin: true } } } }),
      this.devicePluginRepository.find({ relations: { device: true, plugin: true } }),
      this.paletteRepository.find({ where: { kind: 'custom' } }),
      this.firmwareRepository.find({ where: { kind: 'custom' } }),
      this.instanceSettingsRepository.findOneBy({ id: INSTANCE_SETTINGS_ID }),
    ])

    this.addJson(zip, CONFIG_ARCHIVE_FILES.manifest, this.buildManifest(redact))

    for (const plugin of plugins) {
      for (const entry of this.pluginExporter.buildEntries(redact ? withRedactedHeaders(plugin) : plugin)) {
        zip.addFile(`plugins/${plugin.id}/${entry.path}`, entry.content)
      }
    }
    const fieldValuesByPlugin = await this.fieldValues.storedByPlugin(plugins.map(plugin => plugin.id))
    this.addJson(zip, CONFIG_ARCHIVE_FILES.plugins, plugins.map(plugin => buildPluginEntry(plugin, fieldValuesByPlugin.get(plugin.id) ?? {}, redact)))

    const deviceEntries: DeviceManifestEntry[] = []
    for (const device of devices) {
      deviceEntries.push(buildDeviceEntry(device, redact))
      this.addSleepImage(zip, device)
    }
    this.addJson(zip, CONFIG_ARCHIVE_FILES.devices, deviceEntries)

    const screenEntries: ScreenManifestEntry[] = []
    for (const screen of screens) {
      screenEntries.push(buildScreenEntry(screen))
      this.addScreenImage(zip, screen)
    }
    this.addJson(zip, CONFIG_ARCHIVE_FILES.screens, screenEntries)

    this.addJson(zip, CONFIG_ARCHIVE_FILES.assignments, assignments.map(assignment => buildAssignmentEntry(assignment)))

    this.addJson(zip, CONFIG_ARCHIVE_FILES.palettes, palettes.map(palette => buildPaletteEntry(palette)))

    this.addJson(zip, CONFIG_ARCHIVE_FILES.firmware, firmware.map(fw => buildFirmwareEntry(fw)))

    this.addJson(zip, CONFIG_ARCHIVE_FILES.settings, buildSettingsEntry(instanceSettings))

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

  /**
   * A Device's own sleep image, next to where a File Screen's lives (ADR-0021).
   * The retained original is written when it is there, so Configuration Import can
   * reconvert it for the target's Device Model and Palette the way slice A's upload does;
   * when only the once-converted PNG survives, that travels instead, same as a File Screen's.
   */
  private addSleepImage(zip: AdmZip, device: Device): void {
    const originalPath = sleepImageOriginalPath(device.id)
    if (existsSync(originalPath)) {
      zip.addFile(`devices/${device.id}/sleep-image.original`, readFileSync(originalPath))
      return
    }
    const convertedPath = sleepImagePath(device.id)
    if (existsSync(convertedPath)) {
      zip.addFile(`devices/${device.id}/sleep-image.png`, readFileSync(convertedPath))
    }
  }

  private addJson(zip: AdmZip, filename: string, value: unknown): void {
    zip.addFile(filename, Buffer.from(JSON.stringify(value, null, 2), 'utf8'))
  }
}
