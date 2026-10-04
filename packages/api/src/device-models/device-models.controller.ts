import type { DeviceModelList, DeviceModelSyncResult, PaletteRead } from 'kuroshiro-shared'
import { Controller, Get, Logger, Post } from '@nestjs/common'
import { ApiException } from '../errors/api.exception.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
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
  async sync(): Promise<DeviceModelSyncResult> {
    try {
      return await this.syncService.sync()
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Device model sync failed: ${message}`)
      throw new ApiException(502, 'upstream-unreachable', `Could not sync device models from TRMNL: ${message}`, { reason: message })
    }
  }
}
