import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CustomPalettesService } from './custom-palettes.service.js'
import { DeviceModelSyncService } from './device-model-sync.service.js'
import { DeviceModelsController } from './device-models.controller.js'
import { DeviceModelsService } from './device-models.service.js'
import { DeviceModel } from './entities/device-model.entity.js'
import { Palette } from './entities/palette.entity.js'
import { FallbackScreensService } from './fallback-screens.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([DeviceModel, Palette]), ConfigModule],
  controllers: [DeviceModelsController],
  providers: [DeviceModelsService, DeviceModelSyncService, FallbackScreensService, CustomPalettesService],
  exports: [DeviceModelsService, FallbackScreensService],
})
export class DeviceModelsModule {}
