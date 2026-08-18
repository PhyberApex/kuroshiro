import { Controller, Get, Logger, Post, ServiceUnavailableException } from '@nestjs/common'
import { DeviceModelSyncResult, DeviceModelSyncService } from './device-model-sync.service'
import { DeviceModelsService } from './device-models.service'
import { DeviceModel } from './entities/device-model.entity'
import { Palette } from './entities/palette.entity'

@Controller('device-models')
export class DeviceModelsController {
  private readonly logger = new Logger(DeviceModelsController.name)

  constructor(
    private readonly deviceModelsService: DeviceModelsService,
    private readonly syncService: DeviceModelSyncService,
  ) {}

  @Get()
  getAll(): Promise<DeviceModel[]> {
    return this.deviceModelsService.findAll()
  }

  @Get('palettes')
  getPalettes(): Promise<Palette[]> {
    return this.deviceModelsService.findAllPalettes()
  }

  @Post('sync')
  async sync(): Promise<DeviceModelSyncResult> {
    try {
      return await this.syncService.sync()
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`Device model sync failed: ${message}`)
      throw new ServiceUnavailableException(`Could not sync device models from TRMNL: ${message}`)
    }
  }
}
