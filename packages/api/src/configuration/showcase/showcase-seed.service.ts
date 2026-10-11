import type { OnApplicationBootstrap } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DeviceModelSyncService } from '../../device-models/device-model-sync.service.js'
import { Device } from '../../devices/devices.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'
import { ConfigurationImportService } from '../services/configuration-import.service.js'
import { buildShowcaseArchiveZip } from './showcase-archive.js'

/**
 * On a demo-mode boot against an empty database, imports the showcase Configuration Archive
 * (ADR-0042) through the same path a manual import uses, so a fresh public demo or a contributor's
 * `KUROSHIRO_DEMO_MODE=true` checkout comes up furnished instead of blank. Demo mode is the only
 * trigger — there is no dev-environment signal, so a self-hoster's blank instance stays blank.
 */
@Injectable()
export class ShowcaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShowcaseSeedService.name)

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    private readonly deviceModelSync: DeviceModelSyncService,
    private readonly configurationImport: ConfigurationImportService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.configService.get<boolean>('demo_mode')) {
      this.logger.debug('Demo mode is off; skipping the showcase seed')
      return
    }

    const [deviceCount, pluginCount] = await Promise.all([
      this.deviceRepository.count(),
      this.pluginRepository.count(),
    ])
    if (deviceCount > 0 || pluginCount > 0) {
      this.logger.debug('The database already has a Device or a Plugin; skipping the showcase seed')
      return
    }

    // The importer only warns and nulls a Device's Device Model/Palette reference it can't resolve
    // (ADR-0021) — an explicit await here, rather than relying on bootstrap ordering across modules,
    // guarantees the snapshot rows this archive references exist first.
    await this.deviceModelSync.seedFromSnapshot()

    try {
      const summary = await this.configurationImport.importFromZip(buildShowcaseArchiveZip())
      const warnings = summary.warnings.length > 0 ? `, ${summary.warnings.length} warning(s)` : ''
      this.logger.log(`Imported the showcase archive: ${JSON.stringify(summary.created)} created${warnings}`)
    }
    catch (error) {
      this.logger.error(`Failed to import the showcase archive, starting with an empty database instead: ${getErrorMessage(error)}`)
    }
  }
}
