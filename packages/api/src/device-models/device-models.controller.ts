import type { DeviceModelList, DeviceModelSyncResult, PaletteRead } from 'kuroshiro-shared'
import { Body, Controller, Delete, Get, Logger, Param, Post } from '@nestjs/common'
import { ApiException } from '../errors/api.exception.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { CustomPalettesService } from './custom-palettes.service.js'
import { DeviceModelReadsService } from './device-model-reads.service.js'
import { DeviceModelSyncService } from './device-model-sync.service.js'
import { CreateCustomPaletteDto } from './dto/create-custom-palette.dto.js'
import { Palette } from './entities/palette.entity.js'

@Controller('device-models')
export class DeviceModelsController {
  private readonly logger = new Logger(DeviceModelsController.name)

  constructor(
    private readonly reads: DeviceModelReadsService,
    private readonly syncService: DeviceModelSyncService,
    private readonly customPalettesService: CustomPalettesService,
  ) {}

  @Get()
  getAll(): Promise<DeviceModelList> {
    return this.reads.listModels()
  }

  @Get('palettes')
  getPalettes(): Promise<PaletteRead[]> {
    return this.reads.listPalettes()
  }

  @Post('palettes')
  createPalette(@Body() dto: CreateCustomPaletteDto): Promise<Palette> {
    return this.customPalettesService.create(dto)
  }

  @Delete('palettes/:id')
  deletePalette(@Param('id') id: string): Promise<void> {
    return this.customPalettesService.delete(id)
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
