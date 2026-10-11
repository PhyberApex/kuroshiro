import type { DeviceModelList, DeviceModelSyncResult, PaletteRead } from 'kuroshiro-shared'
import { Controller, Get, Logger, Post } from '@nestjs/common'
import { syncOr502 } from '../errors/sync-or-502.js'
import { DeviceModelReadsService } from './device-model-reads.service.js'
import { DeviceModelSyncService } from './device-model-sync.service.js'

@Controller('device-models')
export class DeviceModelsController {
  private readonly logger = new Logger(DeviceModelsController.name)

  constructor(
    private readonly reads: DeviceModelReadsService,
    private readonly syncService: DeviceModelSyncService,
  ) {}

  @Get()
  getAll(): Promise<DeviceModelList> {
    return this.reads.listModels()
  }

  @Get('palettes')
  getPalettes(): Promise<PaletteRead[]> {
    return this.reads.listPalettes()
  }

  @Post('sync')
  sync(): Promise<DeviceModelSyncResult> {
    return syncOr502(this.logger, 'device models', () => this.syncService.sync())
  }
}
