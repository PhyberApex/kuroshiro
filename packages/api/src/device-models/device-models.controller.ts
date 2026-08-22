import { Body, Controller, Delete, Get, Logger, Param, Post, ServiceUnavailableException, UsePipes, ValidationPipe } from '@nestjs/common'
import { getErrorMessage } from '../utils/getErrorMessage'
import { CustomPalettesService } from './custom-palettes.service'
import { DeviceModelSyncResult, DeviceModelSyncService } from './device-model-sync.service'
import { DeviceModelsService } from './device-models.service'
import { CreateCustomPaletteDto } from './dto/create-custom-palette.dto'
import { DeviceModel } from './entities/device-model.entity'
import { Palette } from './entities/palette.entity'

@Controller('device-models')
export class DeviceModelsController {
  private readonly logger = new Logger(DeviceModelsController.name)

  constructor(
    private readonly deviceModelsService: DeviceModelsService,
    private readonly syncService: DeviceModelSyncService,
    private readonly customPalettesService: CustomPalettesService,
  ) {}

  @Get()
  getAll(): Promise<DeviceModel[]> {
    return this.deviceModelsService.findAll()
  }

  @Get('palettes')
  getPalettes(): Promise<Palette[]> {
    return this.deviceModelsService.findAllPalettes()
  }

  @Post('palettes')
  @UsePipes(new ValidationPipe({ transform: true }))
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
      throw new ServiceUnavailableException(`Could not sync device models from TRMNL: ${message}`)
    }
  }
}
