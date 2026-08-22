import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CustomPalettesService } from './custom-palettes.service'
import { DeviceModelSyncService } from './device-model-sync.service'
import { DeviceModelsController } from './device-models.controller'
import { DeviceModelsService } from './device-models.service'
import { DeviceModel } from './entities/device-model.entity'
import { Palette } from './entities/palette.entity'
import { FallbackScreensService } from './fallback-screens.service'

@Module({
  imports: [TypeOrmModule.forFeature([DeviceModel, Palette]), ConfigModule],
  controllers: [DeviceModelsController],
  providers: [DeviceModelsService, DeviceModelSyncService, FallbackScreensService, CustomPalettesService],
  exports: [DeviceModelsService, FallbackScreensService],
})
export class DeviceModelsModule {}
